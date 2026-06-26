import api from './client';

export const healthApi = {
  check: async () => {
    const res = await api.get('/health');
    return res.data;
  },
};
