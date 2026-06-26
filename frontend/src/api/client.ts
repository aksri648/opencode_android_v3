import axios from 'axios';
import { Preferences } from '@capacitor/preferences';

let cachedUrl = '';

async function getBaseUrl(): Promise<string> {
  if (cachedUrl) return cachedUrl;
  const { value } = await Preferences.get({ key: 'backendUrl' });
  cachedUrl = value || '';
  return cachedUrl;
}

export function clearUrlCache() {
  cachedUrl = '';
}

const api = axios.create({
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(async (config) => {
  const baseUrl = await getBaseUrl();
  if (baseUrl) {
    config.baseURL = baseUrl;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Future: handle auth refresh
    }
    return Promise.reject(error);
  }
);

export default api;
