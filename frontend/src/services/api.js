import axios from 'axios';
import { storage } from '../utils/storage';

const DEFAULT_GATEWAY_URL = import.meta.env.VITE_GATEWAY_URL || 'http://localhost:5000';

/**
 * Dynamically resolves the API Gateway Base URL.
 * Priority:
 * 1. import.meta.env.VITE_GATEWAY_URL
 * 2. import.meta.env.VITE_API_BASE_URL (stripping trailing /api)
 * 3. Default: DEFAULT_GATEWAY_URL (from env)
 */
export const getGatewayBaseUrl = () => {
  if (import.meta.env.VITE_GATEWAY_URL) {
    return import.meta.env.VITE_GATEWAY_URL.replace(/\/+$/, '');
  }
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL.replace(/\/api\/?$/, '').replace(/\/+$/, '');
  }
  return DEFAULT_GATEWAY_URL.replace(/\/+$/, '');
};

/**
 * Dynamically resolves the Base API URL (e.g. https://api.sadhish.info/api)
 */
export const getApiBaseUrl = () => {
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL.replace(/\/+$/, '');
  }
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
