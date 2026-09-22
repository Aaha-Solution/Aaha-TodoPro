import api from './api';

export const processAuditService = {
  getDashboardStats: async () => {
    try {
      const res = await api.get('/process-audit/dashboard');
      return res.data?.data || res.data || {};
    } catch (err) {
      console.error('Failed to fetch dashboard metrics:', err);
      return {};
    }
  },

  getRequests: async (params) => {
    try {
      const res = await api.get('/process-audit/requests', { params });
      return res.data?.data || res.data || [];
    } catch (err) {
      console.error('Failed to fetch requests from DB:', err);
      return [];
    }
  },

  getNextId: async () => {
    try {
      const res = await api.get('/process-audit/requests/next-id');
      const raw = res.data?.data?.nextId || res.data?.nextId || '1';
      return String(raw).startsWith('PA-') ? raw : `PA-${raw}`;
    } catch {
      return 'PA-1';
    }
  },

  uploadAttachments: async (fileList) => {
    const formData = new FormData();
    for (const file of fileList) {
      formData.append('files', file);
    }
    const res = await api.post('/process-audit/requests/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return res.data?.data?.files || res.data?.files || [];
  },

  createRequest: async (data) => {
    const res = await api.post('/process-audit/requests', data);
    return res.data;
  },

  getUsers: async () => {
    try {
      const res = await api.get('/process-audit/users');
      return res.data;
    } catch {
      return [
        { id: 1, name: 'iyyu', email: 'iyyu@inel.co.in', role: 'Super Admin', dept: 'Quality' },
        { id: 2, name: 'Ramesh K', email: 'ramesh@inel.co.in', role: 'Auditor', dept: 'Operations' },
      ];
    }
  }
};
