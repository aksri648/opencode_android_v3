import { create } from 'zustand';
import type { FileNode } from '@/types';

interface FileState {
  tree: FileNode[];
  selectedFile: string | null;
  fileContent: string;
  expandedFolders: Set<string>;
  setTree: (tree: FileNode[]) => void;
  setSelectedFile: (path: string | null) => void;
  setFileContent: (content: string) => void;
  toggleFolder: (path: string) => void;
}

export const useFileStore = create<FileState>((set) => ({
  tree: [],
  selectedFile: null,
  fileContent: '',
  expandedFolders: new Set<string>(),
  setTree: (tree) => set({ tree }),
  setSelectedFile: (path) => set({ selectedFile: path }),
  setFileContent: (content) => set({ fileContent: content }),
  toggleFolder: (path) =>
    set((state) => {
      const next = new Set(state.expandedFolders);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return { expandedFolders: next };
    }),
}));
