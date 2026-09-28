import axios from 'axios';
import { storage } from '../utils/storage';

/**
 * Dynamically resolves the API Gateway Base URL.
 * Automatically adapts to:
 * - localhost (local development)
 * - LAN IP, e.g. http://192.168.0.169:5000 (accessing from other devices on the same Wi-Fi/network)
 * - Domain names or production environments
 */
export const getGatewayBaseUrl = () => {
  if (typeof window !== 'undefined' && window.location && window.location.hostname) {
    const { protocol, hostname } = window.location;
    return `${protocol}//${hostname}:5000`;
  }
  return (import.meta.env.VITE_GATEWAY_URL || 'http://localhost:5000').replace(/\/+$/, '');
};

export const getApiBaseUrl = () => {
  return `${getGatewayBaseUrl()}/api`;
};

const api = axios.create({
  baseURL: getApiBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  // Dynamically ensure request always targets the host IP/domain of the current browser session
  config.baseURL = getApiBaseUrl();

  const token = storage.getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // When sending FormData, remove Content-Type so browser automatically sets multipart/form-data with boundary
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      storage.clear();
      // Avoid redirect loops on login page
      if (window.location.pathname !== '/login') {          
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
