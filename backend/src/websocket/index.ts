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
}

export function setupWebSocket(server: Server): void {
  const wss = new WebSocketServer({ server, path: '/ws' });

  const clients = new Map<string, ConnectedClient>();

  wss.on('connection', (ws: WebSocket) => {
    const clientId = crypto.randomUUID();
    clients.set(clientId, { ws, sshConnected: false, inputQueue: [] });

    console.log(`[WS] Client connected: ${clientId}`);

    // Heartbeat
    const heartbeat = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      }
    }, 30000);

    ws.on('message', async (data: Buffer) => {
      try {
        const msg: TerminalMessage = JSON.parse(data.toString());
        const client = clients.get(clientId);
        if (!client) return;

        switch (msg.type) {
          case 'create': {
            console.log(`[WS] Received create message from client ${clientId}`);

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
                const response: TerminalMessage = {
                  type: 'created',
                  terminalId: terminal.id,
                };
                ws.send(JSON.stringify(response));
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
              // onClose: SSH connection closed
              () => {
                console.log(`[WS] SSH closed for terminal ${terminal.id}`);
                client.sshConnected = false;
                client.terminalId = undefined;
              }
            );

            console.log(`[WS] Terminal created: ${terminal.id} on workspace ${workspace.id}`);
            break;
          }

          case 'input': {
            if (msg.terminalId && msg.data) {
              if (client.sshConnected) {
                try {
                  await daytonaService.writeTerminal(msg.terminalId, msg.data);
                } catch {
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

      // Clean up SSH connection
      if (client?.terminalId) {
        try {
          await daytonaService.closeTerminal(client.terminalId);
        } catch {
          // Ignore cleanup errors
        }
      }

      clients.delete(clientId);
      console.log(`[WS] Client disconnected: ${clientId}`);
    });

    ws.on('error', (err) => {
      console.error(`[WS] Error for client ${clientId}:`, err);
      clearInterval(heartbeat);
      clients.delete(clientId);
    });
  });

  console.log('[WS] WebSocket server initialized on /ws');
}
