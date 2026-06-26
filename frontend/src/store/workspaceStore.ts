import { create } from 'zustand';
import type { Workspace } from '@/types';

interface WorkspaceState {
  workspace: Workspace | null;
  workspaceStatus: Workspace['status'] | 'idle';
  setWorkspace: (workspace: Workspace | null) => void;
  setWorkspaceStatus: (status: Workspace['status'] | 'idle') => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  workspace: null,
  workspaceStatus: 'idle',
  setWorkspace: (workspace) => set({ workspace }),
  setWorkspaceStatus: (status) => set({ workspaceStatus: status }),
}));
