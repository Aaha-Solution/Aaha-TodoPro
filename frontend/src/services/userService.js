import api from './api';

export const userService = {
  getUsers: async () => {
    const response = await api.get('/users');
    return response.data?.data || [];
  },

  getUserById: async (id) => {
    const response = await api.get(`/users/${id}`);
    return response.data?.data || null;
  },

  createUser: async (userData) => {
    const response = await api.post('/users', userData);
    return response.data?.data;
  },

  updateUser: async (id, updates) => {
    const response = await api.put(`/users/${id}`, updates);
    return response.data?.data;
  },

  deleteUser: async (id) => {
    const response = await api.delete(`/users/${id}`);
    return response.data?.data;
  },

  checkEmployeeId: async (employeeId, excludeId = null) => {
    const params = new URLSearchParams({ employeeId });
    if (excludeId) params.append('excludeId', excludeId);
    const response = await api.get(`/users/check-emp-id?${params.toString()}`);
    return response.data?.data;
  }
};
