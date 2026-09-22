import api from './api';

export const processAuditService = {
  getDashboardStats: async () => {
    try {
      const res = await api.get('/process-audit/dashboard');
      return res.data;
    } catch {
      return {
        totalRequests: 42,
        pendingAudits: 8,
        completedAudits: 31,
        openCapa: 3,
        auditPerformance: 94.2,
      };
    }
  },

  getRequests: async (params) => {
    try {
      const res = await api.get('/process-audit/requests', { params });
      return res.data;
    } catch {
      return [
        { id: 'PA-2026-001', department: 'Stator Winding', auditor: 'Ramesh K', date: '2026-09-15', status: 'Pending Review', score: '88%' },
        { id: 'PA-2026-002', department: 'Rotor Die Casting', auditor: 'Anand M', date: '2026-09-16', status: 'Approved', score: '96%' },
        { id: 'PA-2026-003', department: 'Assembly Line 2', auditor: 'Priya S', date: '2026-09-17', status: 'In Progress', score: 'Ongoing' },
      ];
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
