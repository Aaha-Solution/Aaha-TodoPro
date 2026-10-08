import api from './api';

export const userService = {
  getUsers: async () => {
    try {
      const response = await api.get('/users');
      const data = response.data?.data || response.data;
      if (Array.isArray(data) && data.length > 0) {
        return data.map((u) => ({
          ...u,
          employeeId: u.employeeId || u.employee_id || String(u.id),
        }));
      }
    } catch (err) {
      console.warn('api.get(/users) notice, trying fallback /process-audit/users:', err.message);
    }

    // High-availability fallback to /process-audit/users
    try {
      const fallbackRes = await api.get('/process-audit/users');
      const fallbackData = fallbackRes.data?.data || fallbackRes.data;
      if (Array.isArray(fallbackData)) {
        return fallbackData.map((u) => ({
          ...u,
          employeeId: u.employeeId || u.employee_id || String(u.id),
        }));
      }
    } catch (err2) {
      console.error('All user endpoints failed:', err2.message);
    }

    return [];
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
