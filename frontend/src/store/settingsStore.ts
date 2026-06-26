import { create } from 'zustand';
import { Preferences } from '@capacitor/preferences';
import type { ConnectionStatus } from '@/types';

interface SettingsState {
  backendUrl: string;
  connectionStatus: ConnectionStatus;
  setBackendUrl: (url: string) => void;
  setConnectionStatus: (status: ConnectionStatus) => void;
  loadSettings: () => Promise<void>;
  saveSettings: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  backendUrl: 'https://opencode-android-backend.onrender.com',
  connectionStatus: 'offline',
  setBackendUrl: (url) => set({ backendUrl: url }),
  setConnectionStatus: (status) => set({ connectionStatus: status }),
  loadSettings: async () => {
    const { value } = await Preferences.get({ key: 'backendUrl' });
    if (value) set({ backendUrl: value });
  },
  saveSettings: async () => {
    await Preferences.set({ key: 'backendUrl', value: get().backendUrl });
  },
}));
