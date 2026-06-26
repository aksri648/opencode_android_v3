export interface Workspace {
  id: string;
  name: string;
  status: 'creating' | 'running' | 'stopped' | 'error';
  createdAt: string;
}

export interface Terminal {
  id: string;
  name: string;
  workspaceId: string;
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
}

export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
}

export interface TerminalMessage {
  type: 'input' | 'output' | 'resize' | 'close' | 'create' | 'created' | 'error';
  terminalId?: string;
  data?: string;
  cols?: number;
  rows?: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export type ConnectionStatus = 'connected' | 'offline' | 'checking';
