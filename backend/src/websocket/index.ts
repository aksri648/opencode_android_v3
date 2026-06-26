import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import type { TerminalMessage } from '../types';
import { daytonaService } from '../services/daytona';
import type { PtyHandle } from '@daytona/sdk';

interface ConnectedClient {
  ws: WebSocket;
  terminalId?: string;
  workspaceId?: string;
  ptyHandle?: PtyHandle;
}

export function setupWebSocket(server: Server): void {
  const wss = new WebSocketServer({ server, path: '/ws' });

  const clients = new Map<string, ConnectedClient>();

  wss.on('connection', (ws: WebSocket) => {
    const clientId = crypto.randomUUID();
    clients.set(clientId, { ws });

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

            // Connect PTY on the sandbox — onData bridges to the client WS
            const ptyHandle = await daytonaService.connectTerminalPty(
              terminal.id,
              (ptyData: Uint8Array) => {
                // Forward PTY output to client WebSocket
                if (ws.readyState === WebSocket.OPEN) {
                  const response: TerminalMessage = {
                    type: 'output',
                    terminalId: terminal.id,
                    data: new TextDecoder().decode(ptyData),
                  };
                  ws.send(JSON.stringify(response));
                }
              },
              msg.cols || 120,
              msg.rows || 40
            );

            client.ptyHandle = ptyHandle;

            // Notify client terminal is ready
            const response: TerminalMessage = {
              type: 'created',
              terminalId: terminal.id,
            };
            ws.send(JSON.stringify(response));

            console.log(`[WS] Terminal created: ${terminal.id} on workspace ${workspace.id}`);
            break;
          }

          case 'input': {
            if (msg.terminalId && msg.data) {
              await daytonaService.writeTerminal(msg.terminalId, msg.data);
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
              client.ptyHandle = undefined;
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

      // Clean up PTY
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
