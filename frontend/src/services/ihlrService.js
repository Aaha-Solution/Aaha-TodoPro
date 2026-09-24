import api from './api';

// Fallback initial data
const initialMockRequests = [];

let localIhlrStore = [...initialMockRequests];

export const ihlrService = {
  getNextReqNo: async () => {
    try {
      const res = await api.get('/ihlr/next-req-no');
      return res.data?.data?.nextReqNo || res.data?.nextReqNo || 'IHLR-1';
    } catch {
      let max = 0;
      for (const r of localIhlrStore) {
        const match = String(r.req_no || '').match(/(\d+)/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > max) max = num;
        }
      }
      return `IHLR-${max + 1}`;
    }
  },
  getDashboardStats: async () => {
    try {
      const res = await api.get('/ihlr/dashboard');
      return res.data?.data || res.data;
    } catch {
      const total = localIhlrStore.length;
      const open = localIhlrStore.filter(r => r.status === 'OPEN').length;
      const inProgress = localIhlrStore.filter(r => r.status === 'IN_PROGRESS').length;
      const closed = localIhlrStore.filter(r => r.status === 'CLOSED').length;
      return {
        total,
        open,
        inProgress,
        closed,
        fourMBreakdown: {
          MAN: localIhlrStore.filter(r => r.four_m === 'MAN').length,
          MACHINE: localIhlrStore.filter(r => r.four_m === 'MACHINE').length,
          METHOD: localIhlrStore.filter(r => r.four_m === 'METHOD').length,
          MATERIAL: localIhlrStore.filter(r => r.four_m === 'MATERIAL').length,
        },
        recentRequests: localIhlrStore.slice(0, 5)
      };
    }
  },

  getRequests: async (filters = {}) => {
    try {
      const res = await api.get('/ihlr/requests', { params: filters });
      return res.data?.data || res.data;
    } catch {
      let data = [...localIhlrStore];
      if (filters.search) {
        const q = filters.search.toLowerCase();
        data = data.filter(r => 
          (r.problem && r.problem.toLowerCase().includes(q)) ||
          (r.model && r.model.toLowerCase().includes(q)) ||
          (r.received_from && r.received_from.toLowerCase().includes(q)) ||
          (r.analysis_done_by && r.analysis_done_by.toLowerCase().includes(q))
        );
      }
      if (filters.shift && filters.shift !== 'All') {
        data = data.filter(r => r.shift === filters.shift);
      }
      if (filters.fourM && filters.fourM !== 'All') {
        data = data.filter(r => r.four_m === filters.fourM);
      }
      if (filters.status && filters.status !== 'All') {
        data = data.filter(r => r.status === filters.status);
      }
      return data;
    }
  },

  getRequestById: async (id) => {
    try {
      const res = await api.get(`/ihlr/requests/${id}`);
      return res.data?.data || res.data;
    } catch {
      return localIhlrStore.find(r => String(r.id) === String(id)) || null;
    }
  },

  getUsers: async (department) => {
    try {
      const params = department ? { department } : {};
      const res = await api.get('/users', { params });
      return res.data?.data || res.data || [];
    } catch (err) {
      console.error('Failed to fetch users:', err);
      return [];
    }
  },

  uploadAttachments: async (files) => {
    try {
      const data = new FormData();
      Array.from(files).forEach((f) => data.append('files', f));
      const res = await api.post('/ihlr/upload', data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data?.data?.files || res.data?.files || [];
    } catch (err) {
      console.error('Failed to upload files:', err);
      return Array.from(files).map((f) => {
        const ext = f.name.split('.').pop()?.toUpperCase() || 'FILE';
        return {
          name: f.name,
          filename: f.name,
          url: URL.createObjectURL(f),
          size: `${(f.size / (1024 * 1024)).toFixed(2)} MB`,
          type: ext,
        };
      });
    }
  },

  createRequest: async (formData) => {
    try {
      const res = await api.post('/ihlr/requests', formData);
      return res.data?.data || res.data;
    } catch {
      const newId = localIhlrStore.length > 0 ? Math.max(...localIhlrStore.map(r => r.id)) + 1 : 1;
      let calculatedReqNo = formData.req_no;
      if (!calculatedReqNo) {
        let max = 0;
        for (const r of localIhlrStore) {
          const match = String(r.req_no || '').match(/(\d+)/);
          if (match) {
            const num = parseInt(match[1], 10);
            if (num > max) max = num;
          }
        }
        calculatedReqNo = `IHLR-${max + 1}`;
      }
      const newReq = {
        id: newId,
        req_no: calculatedReqNo,
        batch_date: formData.batch_date || new Date().toISOString().split('T')[0],
        shift: formData.shift || 'I',
        problem: formData.problem,
        model: formData.model,
        problem_detected_at: formData.problem_detected_at || '',
        received_from: formData.received_from || '',
        analysis_done_by: formData.analysis_done_by || '',
        defect_image: formData.defect_image || '',
        qa_why_why: formData.qa_why_why || ['', '', '', '', ''],
        actual_qty: formData.actual_qty ? Number(formData.actual_qty) : 1,
        four_m: formData.four_m || 'MAN',
        resp: formData.resp || 'PRODUCTION',
        resp_person: formData.resp_person || '',
        prod_why_why: formData.prod_why_why || ['', '', '', '', ''],
        action: formData.action || '',
        evidence_attachment: formData.evidence_attachment || '',
        target_date: formData.target_date || null,
        remarks: formData.remarks || '',
        status: formData.status || 'OPEN',
        created_at: new Date().toISOString()
      };
      localIhlrStore.unshift(newReq);
      return newReq;
    }
  },

  updateRequest: async (id, updates) => {
    try {
      const res = await api.put(`/ihlr/requests/${id}`, updates);
      return res.data?.data || res.data;
    } catch {
      const idx = localIhlrStore.findIndex(r => String(r.id) === String(id));
      if (idx !== -1) {
        localIhlrStore[idx] = { ...localIhlrStore[idx], ...updates, updated_at: new Date().toISOString() };
        return localIhlrStore[idx];
      }
      return null;
    }
  },

  deleteRequest: async (id) => {
    try {
      const res = await api.delete(`/ihlr/requests/${id}`);
      return res.data?.data || res.data;
    } catch {
      localIhlrStore = localIhlrStore.filter(r => String(r.id) !== String(id));
      return { id };
    }
  },

  getNotifications: async (params = {}) => {
    try {
      const res = await api.get('/ihlr/notifications', { params });
      return res.data?.data || res.data || [];
    } catch {
      return [];
    }
  },

  markNotificationAsRead: async (id) => {
    try {
      const res = await api.patch(`/ihlr/notifications/${id}/read`);
      return res.data?.data || res.data;
    } catch {
      return null;
    }
  },

  markAllNotificationsAsRead: async (user = '') => {
    try {
      const res = await api.patch('/ihlr/notifications/mark-all-read', { user });
      return res.data?.data || res.data;
    } catch {
      return null;
    }
  }
};

export default ihlrService;
