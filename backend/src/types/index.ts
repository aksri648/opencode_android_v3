import type { Sandbox } from '@daytona/sdk';

export interface Workspace {
  id: string;
  name: string;
  status: 'creating' | 'running' | 'stopped' | 'error';
  createdAt: string;
  sandbox?: Sandbox;
}

export interface TerminalSession {
  id: string;
  name: string;
  workspaceId: string;
  createdAt: string;
}

export interface TerminalMessage {
  type: 'input' | 'output' | 'resize' | 'close' | 'create' | 'created' | 'error';
  terminalId?: string;
  data?: string;
  cols?: number;
  rows?: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
}
