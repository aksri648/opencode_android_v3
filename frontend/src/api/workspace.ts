import api from './client';
import type { Workspace } from '@/types';

export const workspaceApi = {
  create: async (): Promise<Workspace> => {
    const res = await api.post('/workspace/create');
    return res.data.data;
  },
  delete: async (id: string) => {
    const res = await api.post('/workspace/delete', { id });
    return res.data;
  },
  status: async (id: string) => {
    const res = await api.get('/workspace/status', { params: { id } });
    return res.data.data;
  },
};
