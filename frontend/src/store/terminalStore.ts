import { create } from 'zustand';
import type { Terminal } from '@/types';

interface TerminalState {
  terminals: Terminal[];
  activeTerminalId: string | null;
  addTerminal: (terminal: Terminal) => void;
  removeTerminal: (id: string) => void;
  setActiveTerminal: (id: string) => void;
  updateTerminalStatus: (id: string, status: Terminal['status']) => void;
}

export const useTerminalStore = create<TerminalState>((set) => ({
  terminals: [],
  activeTerminalId: null,
  addTerminal: (terminal) =>
    set((state) => ({
      terminals: [...state.terminals, terminal],
      activeTerminalId: state.activeTerminalId ?? terminal.id,
    })),
  removeTerminal: (id) =>
    set((state) => ({
      terminals: state.terminals.filter((t) => t.id !== id),
      activeTerminalId:
        state.activeTerminalId === id
          ? state.terminals.find((t) => t.id !== id)?.id ?? null
          : state.activeTerminalId,
    })),
  setActiveTerminal: (id) => set({ activeTerminalId: id }),
  updateTerminalStatus: (id, status) =>
    set((state) => ({
      terminals: state.terminals.map((t) =>
        t.id === id ? { ...t, status } : t
      ),
    })),
}));
