import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import type { TerminalMessage } from '../types';
import { daytonaService } from '../services/daytona';

interface ConnectedClient {
  ws: WebSocket;
  terminalId?: string;
  workspaceId?: string;
  sshConnected: boolean;
  inputQueue: string[];
  // Guard to prevent duplicate cleanup on simultaneous close events
  cleaned: boolean;
}

export function setupWebSocket(server: Server): void {
  const wss = new WebSocketServer({ server, path: '/ws' });

  const clients = new Map<string, ConnectedClient>();

  wss.on('connection', (ws: WebSocket) => {
    const clientId = crypto.randomUUID();
    clients.set(clientId, { ws, sshConnected: false, inputQueue: [], cleaned: false });

    console.log(`[WS] Client connected: ${clientId}`);

    // Heartbeat — keep the WebSocket itself alive
    const heartbeat = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      }
    }, 30000);

    // Track whether this client is currently setting up SSH
    // to prevent overlapping create requests
    let creatingTerminal = false;

    ws.on('message', async (data: Buffer) => {
      try {
        const msg: TerminalMessage = JSON.parse(data.toString());
        const client = clients.get(clientId);
        if (!client) return;

        switch (msg.type) {
          case 'create': {
            // Prevent overlapping create requests from the same client
            if (creatingTerminal) {
              console.log(`[WS] Ignoring duplicate create from client ${clientId} (already creating)`);
              break;
            }
            creatingTerminal = true;
            console.log(`[WS] Received create message from client ${clientId}`);

            try {
              // Clean up any previous terminal for this client before creating a new one
              if (client.terminalId) {
                console.log(`[WS] Cleaning up previous terminal ${client.terminalId} for client ${clientId}`);
                try {
                  await daytonaService.closeTerminal(client.terminalId);
                } catch {
                  // Ignore cleanup errors
                }
                client.terminalId = undefined;
                client.sshConnected = false;
                client.inputQueue = [];
              }

              // Get or create a workspace
              const workspace = await daytonaService.getOrCreateWorkspace();
              client.workspaceId = workspace.id;

              // Create terminal session
              const terminal = await daytonaService.createTerminal(
                workspace.id,
                msg.cols || 120,
                msg.rows || 40
              );
              client.terminalId = terminal.id;

              // Check if client disconnected while we were creating
              if (ws.readyState !== WebSocket.OPEN) {
                console.log(`[WS] Client ${clientId} disconnected during terminal creation, cleaning up`);
                await daytonaService.closeTerminal(terminal.id);
                creatingTerminal = false;
                break;
              }

              // Connect via SSH
              await daytonaService.connectTerminalSsh(
                terminal.id,
                // onData: forward SSH output to client WebSocket
                (sshData: string) => {
                  if (ws.readyState === WebSocket.OPEN) {
                    const response: TerminalMessage = {
                      type: 'output',
                      terminalId: terminal.id,
                      data: sshData,
                    };
                    ws.send(JSON.stringify(response));
                  }
                },
                // onReady: SSH connected, notify client
                () => {
                  console.log(`[WS] SSH ready for terminal ${terminal.id}`);
                  client.sshConnected = true;

                  // Send any queued input
                  while (client.inputQueue.length > 0) {
                    const queuedData = client.inputQueue.shift()!;
                    daytonaService.writeTerminal(terminal.id, queuedData).catch((err) => {
                      console.error(`[WS] Failed to write queued input:`, err);
                    });
                  }

                  // Notify client terminal is ready
                  if (ws.readyState === WebSocket.OPEN) {
                    const response: TerminalMessage = {
                      type: 'created',
                      terminalId: terminal.id,
                    };
                    ws.send(JSON.stringify(response));
                  }
                },
                // onError: SSH connection failed
                (err: Error) => {
                  console.error(`[WS] SSH error for terminal ${terminal.id}:`, err);
                  client.sshConnected = false;
                  client.terminalId = undefined;
                  const errorResponse: TerminalMessage = {
                    type: 'error',
                    terminalId: terminal.id,
                    data: `SSH connection failed: ${err.message}`,
                  };
                  if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify(errorResponse));
                  }
                },
                // onClose: SSH connection closed — notify client so it can
                // decide whether to reconnect (with backoff)
                () => {
                  console.log(`[WS] SSH closed for terminal ${terminal.id}`);
                  client.sshConnected = false;
                  // Don't clear terminalId here — the client may reconnect
                  // and we need the association

                  // Notify client that SSH disconnected
                  if (ws.readyState === WebSocket.OPEN) {
                    const disconnectResponse: TerminalMessage = {
                      type: 'error',
                      terminalId: terminal.id,
                      data: 'SSH session disconnected',
                    };
                    ws.send(JSON.stringify(disconnectResponse));
                  }
                }
              );

              console.log(`[WS] Terminal created: ${terminal.id} on workspace ${workspace.id}`);
            } finally {
              creatingTerminal = false;
            }
            break;
          }

          case 'input': {
            if (msg.terminalId && msg.data) {
              if (client.sshConnected) {
                const written = await daytonaService.writeTerminal(msg.terminalId, msg.data);
                if (!written) {
                  // SSH dropped, queue for reconnection
                  client.sshConnected = false;
                  client.inputQueue.push(msg.data);
                }
              } else {
                // Queue input until SSH is ready
                client.inputQueue.push(msg.data);
              }
            }
            break;
          }

          case 'resize': {
            if (msg.terminalId && msg.cols && msg.rows) {
              await daytonaService.resizeTerminal(msg.terminalId, msg.cols, msg.rows);
            }
            break;
          }

          case 'close': {
            if (msg.terminalId) {
              await daytonaService.closeTerminal(msg.terminalId);
              client.terminalId = undefined;
              client.sshConnected = false;
              client.inputQueue = [];
            }
            break;
          }
        }
      } catch (err) {
        console.error('[WS] Error processing message:', err);
        const errorResponse: TerminalMessage = {
          type: 'error',
          data: err instanceof Error ? err.message : 'Failed to process message',
        };
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(errorResponse));
        }
      }
    });

    ws.on('close', async () => {
      clearInterval(heartbeat);
      const client = clients.get(clientId);

      if (client && !client.cleaned) {
        client.cleaned = true;

        // Clean up SSH connection
        if (client.terminalId) {
          try {
            await daytonaService.closeTerminal(client.terminalId);
          } catch {
            // Ignore cleanup errors
          }
        }
      }

      clients.delete(clientId);
      console.log(`[WS] Client disconnected: ${clientId}`);
    });

    ws.on('error', (err) => {
      console.error(`[WS] Error for client ${clientId}:`, err);
      clearInterval(heartbeat);
      const client = clients.get(clientId);
      if (client && !client.cleaned) {
        client.cleaned = true;
        if (client.terminalId) {
          daytonaService.closeTerminal(client.terminalId).catch(() => {});
        }
      }
      clients.delete(clientId);
    });
  });

  console.log('[WS] WebSocket server initialized on /ws');
}
