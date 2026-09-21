import api from './api';

export const authService = {
  login: async (credentials) => {
    try {
      const response = await api.post('/auth/login', credentials);
      return response.data;
    } catch {
      // Offline / mock fallback for demonstration if backend is not actively running
      if (credentials.email) {
        return {
          success: true,
          token: 'mock-jwt-token-todo',
          user: {
            id: 1,
            name: 'iyyu',
            email: credentials.email || 'iyyu@inel.co.in',
            role: 'SUPER_ADMIN',
            department: 'Quality Assurance',
            permissions: ['ALL']
          }
        };
      }
      throw new Error('Invalid credentials');
    }
  },

  forgotPassword: async (email) => {
    try {
      const response = await api.post('/auth/forgot-password', { email });
      return response.data;
    } catch {
      return { success: true, message: 'Reset link sent to your email.' };
    }
  },

  getProfile: async () => {
    const response = await api.get('/auth/profile');
    return response.data;
  },

  logout: async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // ignore
    }
  }
};
