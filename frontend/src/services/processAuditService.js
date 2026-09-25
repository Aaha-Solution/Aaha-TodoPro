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
    try {
      const formData = new FormData();
      for (const file of fileList) {
        formData.append('files', file);
      }
      const res = await api.post('/process-audit/requests/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data?.data?.files || res.data?.files || [];
    } catch (err) {
      console.error('Failed to upload files to process audit:', err);
      return Array.from(fileList).map((f) => {
        const ext = f.name.split('.').pop()?.toUpperCase() || 'FILE';
        const isImage = ['PNG', 'JPG', 'JPEG', 'WEBP', 'GIF', 'SVG'].includes(ext);
        return {
          name: f.name,
          filename: f.name,
          url: URL.createObjectURL(f),
          size: `${(f.size / (1024 * 1024)).toFixed(2)} MB`,
          type: ext,
          isImage,
        };
      });
    }
  },

  createRequest: async (data) => {
    const res = await api.post('/process-audit/requests', data);
    return res.data;
  },

  getUsers: async (department) => {
    try {
      const params = department ? { department } : {};
      const res = await api.get('/process-audit/users', { params });
      return res.data?.data || res.data || [];
    } catch (err) {
      console.error('Failed to fetch users from DB:', err);
      return [];
    }
  },

  getApprovals: async (params) => {
    try {
      const res = await api.get('/process-audit/approvals', { params });
      return res.data?.data || res.data || [];
    } catch (err) {
      console.error('Failed to fetch approvals from DB:', err);
      return [];
    }
  },

  updateRequestStatus: async (id, status, details = {}) => {
    let payload = { status };
    if (typeof details === 'string') {
      payload.rejectionReason = details;
    } else if (typeof details === 'object' && details !== null) {
      payload = { ...payload, ...details };
    }
    const res = await api.put(`/process-audit/requests/${id}/status`, payload);
    return res.data?.data || res.data;
  },

  getNotifications: async (params) => {
    try {
      const res = await api.get('/process-audit/notifications', { params });
      return res.data?.data || res.data || [];
    } catch (err) {
      console.error('Failed to fetch notifications from DB:', err);
      return [];
    }
  },

  markNotificationAsRead: async (id) => {
    try {
      const res = await api.patch(`/process-audit/notifications/${id}/read`);
      return res.data?.data || res.data;
    } catch (err) {
      console.error(`Failed to mark notification ${id} as read:`, err);
    }
  },

  markAllNotificationsAsRead: async (user) => {
    try {
      const res = await api.patch('/process-audit/notifications/mark-all-read', { user });
      return res.data?.data || res.data;
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err);
    }
  }
};
