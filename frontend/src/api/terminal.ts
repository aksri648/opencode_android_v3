import api from './client';
import type { Terminal } from '@/types';

export const terminalApi = {
  create: async (): Promise<Terminal> => {
    const res = await api.post('/terminal/create');
    return res.data.data;
  },
  list: async (): Promise<Terminal[]> => {
    const res = await api.get('/terminal/list');
    return res.data.data;
  },
  remove: async (id: string) => {
    const res = await api.delete(`/terminal/${id}`);
    return res.data;
  },
};
