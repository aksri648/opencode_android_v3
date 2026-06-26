import { Daytona, type Sandbox } from '@daytona/sdk';
import { Client as SSHClient, type ClientChannel } from 'ssh2';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import type { Workspace, TerminalSession, FileNode } from '../types';

interface SshConnection {
  client: SSHClient;
  stream: ClientChannel;
  ready: boolean;
}

class DaytonaService {
  private daytona: Daytona;
  private workspaces: Map<string, Workspace> = new Map();
  private terminals: Map<string, TerminalSession> = new Map();
  private sshConnections: Map<string, SshConnection> = new Map();

  constructor() {
    this.daytona = new Daytona({
      apiKey: config.daytona.apiKey,
      apiUrl: config.daytona.apiUrl,
      target: config.daytona.target,
    });
  }

  // ── Workspace (Sandbox) Management ──────────────────────────

  async createWorkspace(name?: string): Promise<Workspace> {
    const sandbox = await this.daytona.create({
      name: name || `workspace-${Date.now()}`,
      language: 'typescript',
      autoStopInterval: 0,
      autoDeleteInterval: -1,
    });

    const workspace: Workspace = {
      id: sandbox.id,
      name: sandbox.name,
      status: sandbox.state === 'started' ? 'running' : 'creating',
      createdAt: sandbox.createdAt || new Date().toISOString(),
      sandbox,
    };

    this.workspaces.set(workspace.id, workspace);
    return workspace;
  }

  async deleteWorkspace(id: string): Promise<boolean> {
    const workspace = this.workspaces.get(id);
    if (!workspace) return false;

    try {
      if (workspace.sandbox) {
        await this.daytona.delete(workspace.sandbox);
      }
    } catch (err) {
      console.error(`[Daytona] Failed to delete workspace ${id}:`, err);
    }

    this.workspaces.delete(id);
    return true;
  }

  async startWorkspace(id: string): Promise<Workspace | null> {
    const workspace = this.workspaces.get(id);
    if (!workspace || !workspace.sandbox) return null;

    try {
      await this.daytona.start(workspace.sandbox);
      workspace.status = 'running';
    } catch (err) {
      console.error(`[Daytona] Failed to start workspace ${id}:`, err);
      workspace.status = 'error';
    }

    return workspace;
  }

  async stopWorkspace(id: string): Promise<Workspace | null> {
    const workspace = this.workspaces.get(id);
    if (!workspace || !workspace.sandbox) return null;

    try {
      await this.daytona.stop(workspace.sandbox);
      workspace.status = 'stopped';
    } catch (err) {
      console.error(`[Daytona] Failed to stop workspace ${id}:`, err);
    }

    return workspace;
  }

  async getWorkspaceStatus(id: string): Promise<Workspace | null> {
    const workspace = this.workspaces.get(id);
    if (!workspace || !workspace.sandbox) return null;

    try {
      await workspace.sandbox.refreshData();
      workspace.status = workspace.sandbox.state === 'started' ? 'running' : 'stopped';
    } catch (err) {
      console.error(`[Daytona] Failed to get workspace status ${id}:`, err);
    }

    return workspace;
  }

  async getOrCreateWorkspace(): Promise<Workspace> {
    // Reuse existing running workspace
    for (const ws of this.workspaces.values()) {
      if (ws.status === 'running' && ws.sandbox) {
        try {
          await ws.sandbox.refreshData();
          if (ws.sandbox.state === 'started') {
            return ws;
          }
        } catch {
          // Workspace might be gone, continue
        }
      }
    }

    // Create new workspace
    return this.createWorkspace();
  }

  // ── Terminal (SSH) Management ───────────────────────────────

  async createTerminal(workspaceId: string, cols = 120, rows = 40): Promise<TerminalSession> {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace?.sandbox) {
      throw new Error('Workspace not found or not running');
    }

    const terminalId = uuidv4();
    const terminalName = `Terminal ${this.terminals.size + 1}`;

    const terminal: TerminalSession = {
      id: terminalId,
      name: terminalName,
      workspaceId,
      createdAt: new Date().toISOString(),
    };

    this.terminals.set(terminalId, terminal);
    return terminal;
  }

  async connectTerminalSsh(
    terminalId: string,
    onData: (data: string) => void,
    onReady?: () => void,
    onError?: (err: Error) => void,
    onClose?: () => void
  ): Promise<void> {
    const terminal = this.terminals.get(terminalId);
    if (!terminal) throw new Error('Terminal not found');

    const workspace = this.workspaces.get(terminal.workspaceId);
    if (!workspace?.sandbox) throw new Error('Workspace not found');

    // Get SSH access from Daytona
    const sshAccess = await workspace.sandbox.createSshAccess();
    
    // Parse SSH command to extract host, port, user
    // Format: ssh -p PORT USER@HOST
    const sshCommandMatch = sshAccess.sshCommand.match(/ssh -p (\d+) (\S+)@(\S+)/);
    if (!sshCommandMatch) {
      throw new Error(`Failed to parse SSH command: ${sshAccess.sshCommand}`);
    }
    
    const port = parseInt(sshCommandMatch[1], 10);
    const user = sshCommandMatch[2];
    const host = sshCommandMatch[3];

    const sshClient = new SSHClient();

    return new Promise<void>((resolve, reject) => {
      sshClient.on('ready', () => {
        console.log(`[SSH] Connected for terminal ${terminalId}`);

        // Open a shell session
        sshClient.shell(
          {
            term: 'xterm-256color',
          },
          (err: Error | undefined, stream: ClientChannel) => {
            if (err) {
              console.error(`[SSH] Shell error for terminal ${terminalId}:`, err);
              onError?.(err);
              reject(err);
              return;
            }

            this.sshConnections.set(terminalId, {
              client: sshClient,
              stream,
              ready: true,
            });

            // Handle stream data
            stream.on('data', (data: Buffer) => {
              onData(data.toString('utf-8'));
            });

            // Handle stream close
            stream.on('close', () => {
              console.log(`[SSH] Stream closed for terminal ${terminalId}`);
              this.sshConnections.delete(terminalId);
              onClose?.();
            });

            // Handle stream error
            stream.stderr.on('data', (data: Buffer) => {
              console.error(`[SSH] Stderr for terminal ${terminalId}:`, data.toString());
            });

            onReady?.();
            resolve();
          }
        );
      });

      sshClient.on('error', (err: Error) => {
        console.error(`[SSH] Connection error for terminal ${terminalId}:`, err);
        this.sshConnections.delete(terminalId);
        onError?.(err);
        reject(err);
      });

      sshClient.on('close', () => {
        console.log(`[SSH] Connection closed for terminal ${terminalId}`);
        this.sshConnections.delete(terminalId);
        onClose?.();
      });

      // Connect using SSH access details
      sshClient.connect({
        host,
        port,
        username: user,
        password: sshAccess.token,
      });
    });
  }

  async writeTerminal(terminalId: string, data: string): Promise<void> {
    const conn = this.sshConnections.get(terminalId);
    if (!conn?.ready) throw new Error('Terminal SSH not connected');

    conn.stream.write(data);
  }

  async resizeTerminal(terminalId: string, cols: number, rows: number): Promise<void> {
    const conn = this.sshConnections.get(terminalId);
    if (!conn?.ready) throw new Error('Terminal SSH not connected');

    conn.stream.setWindow(rows, cols, 0, 0);
  }

  async closeTerminal(terminalId: string): Promise<void> {
    const conn = this.sshConnections.get(terminalId);
    if (conn) {
      try {
        conn.stream.close();
        conn.client.end();
      } catch {
        // Ignore disconnect errors
      }
      this.sshConnections.delete(terminalId);
    }

    this.terminals.delete(terminalId);
  }

  async listTerminals(): Promise<TerminalSession[]> {
    return Array.from(this.terminals.values());
  }

  async deleteTerminal(id: string): Promise<boolean> {
    await this.closeTerminal(id);
    return this.terminals.delete(id);
  }

  // ── File System ─────────────────────────────────────────────

  async listFiles(workspaceId: string, path = '.'): Promise<FileNode[]> {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace?.sandbox) throw new Error('Workspace not found');

    const files = await workspace.sandbox.fs.listFiles(path);

    const nodes: FileNode[] = [];
    for (const file of files) {
      const fullPath = path === '.' ? `/${file.name}` : `${path}/${file.name}`;
      const node: FileNode = {
        name: file.name,
        path: fullPath,
        type: file.isDir ? 'directory' : 'file',
      };

      if (file.isDir) {
        try {
          node.children = await this.listFiles(workspaceId, fullPath);
        } catch {
          node.children = [];
        }
      }

      nodes.push(node);
    }

    return nodes;
  }

  async readFile(filePath: string): Promise<string> {
    // Find the first available workspace
    const workspace = Array.from(this.workspaces.values())[0];
    if (!workspace?.sandbox) throw new Error('No workspace available');

    const buffer = await workspace.sandbox.fs.downloadFile(filePath);
    return buffer.toString('utf-8');
  }

  async downloadWorkspace(): Promise<Buffer> {
    const workspace = await this.getOrCreateWorkspace();
    if (!workspace.sandbox) throw new Error('No workspace available');

    // Use archive to create a zip, then read the archive
    // The archive method creates a tar; for zip we download all files
    const files = await this.listFiles(workspace.id, '.');
    const archiver = require('archiver');
    const { PassThrough } = require('stream');

    return new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      const passThrough = new PassThrough();

      passThrough.on('data', (chunk: Buffer) => chunks.push(chunk));
      passThrough.on('end', () => resolve(Buffer.concat(chunks)));
      passThrough.on('error', reject);

      const archive = archiver('zip', { zlib: { level: 9 } });
      archive.pipe(passThrough);

      const addFiles = async (nodes: FileNode[], prefix = '') => {
        for (const node of nodes) {
          if (node.type === 'file') {
            try {
              const content = await workspace.sandbox!.fs.downloadFile(
                node.path.startsWith('/') ? node.path.slice(1) : node.path
              );
              archive.append(content, { name: `${prefix}${node.name}` });
            } catch (err) {
              console.error(`[Daytona] Failed to read file ${node.path}:`, err);
            }
          } else if (node.children) {
            await addFiles(node.children, `${prefix}${node.name}/`);
          }
        }
      };

      addFiles(files)
        .then(() => archive.finalize())
        .catch(reject);
    });
  }
}

export const daytonaService = new DaytonaService();
