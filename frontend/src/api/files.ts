import api from './client';
import type { FileNode } from '@/types';

export const filesApi = {
  tree: async (): Promise<FileNode[]> => {
    const res = await api.get('/files/tree');
    return res.data.data;
  },
  content: async (path: string): Promise<string> => {
    const res = await api.get('/files/content', { params: { path } });
    return res.data.data;
  },
  download: async (): Promise<Blob> => {
    const res = await api.post('/download', {}, { responseType: 'blob' });
    return res.data;
  },
};
