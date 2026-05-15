import axios from 'axios';

export const storageKeys = {
  token: 'swiftpos_token',
  user: 'swiftpos_user',
  storeId: 'swiftpos_store_id',
  theme: 'swiftpos_theme',
};

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api',
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(storageKeys.token);
  const storeId = localStorage.getItem(storageKeys.storeId);

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  if (storeId) {
    config.headers['X-Store-Id'] = storeId;
  }

  return config;
});

export default api;
