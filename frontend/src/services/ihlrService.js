import api from './api';
import { storage } from '../utils/storage';
import { isIhlrRequestVisibleToUser } from '../utils/ihlrAuthUtils';

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
  getDashboardStats: async (filters = {}) => {
    try {
      const currentUser = storage.getUser();
      const userParams = currentUser ? {
        user_name: currentUser.name,
        user_email: currentUser.email,
        user_id: currentUser.id,
        role: currentUser.role,
        user_department: currentUser.department,
        department: currentUser.department
      } : {};
      const res = await api.get('/ihlr/dashboard', { params: { ...userParams, ...filters } });
      const stats = res.data?.data || res.data;
      return stats;
    } catch {
      let scopedStore = [...localIhlrStore];
      const currentUser = storage.getUser();
      // Apply department filter
      const deptFilter = (filters.resp || filters.filter_dept || '').trim().toUpperCase();
      if (deptFilter && deptFilter !== 'ALL') {
        scopedStore = scopedStore.filter(r => (r.resp || '').trim().toUpperCase() === deptFilter);
      }
      // Apply date filter (defaults to current year)
      const currentYear = new Date().getFullYear();
      const isAllTime = filters.allTime === true || filters.all_time === true;
      let startDate = (filters.startDate || filters.start_date || '').trim();
      let endDate = (filters.endDate || filters.end_date || '').trim();

      if (!isAllTime && !startDate && !endDate) {
        const year = filters.year || currentYear;
        startDate = `${year}-01-01`;
        endDate = `${year}-12-31`;
      }

      if (startDate || endDate) {
        scopedStore = scopedStore.filter(r => {
          const dStr = (r.batch_date || r.created_at || '').split('T')[0];
          if (!dStr) return false;
          if (startDate && dStr < startDate) return false;
          if (endDate && dStr > endDate) return false;
          return true;
        });
      }
      const total = scopedStore.length;
      const open = scopedStore.filter(r => {
        const s = (r.status || '').toUpperCase();
        return s === 'OPEN' || s === 'PENDING';
      }).length;
      const inProgress = scopedStore.filter(r => {
        const s = (r.status || '').toUpperCase();
        return s === 'IN_PROGRESS' || s === 'IN-PROGRESS';
      }).length;
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const monthlyTrend = monthNames.map((name, idx) => {
        const mReqs = scopedStore.filter(r => {
          const dStr = (r.batch_date || r.created_at || '').split('T')[0];
          if (!dStr) return false;
          const d = new Date(dStr);
          return !isNaN(d.getTime()) && d.getMonth() === idx;
        });
        return {
          month: name,
          monthIndex: idx,
          total: mReqs.length,
          open: mReqs.filter(r => (r.status || '').toUpperCase() === 'OPEN' || (r.status || '').toUpperCase() === 'PENDING').length,
          inProgress: mReqs.filter(r => (r.status || '').toUpperCase().includes('PROGRESS') || (r.status || '').toUpperCase().includes('REVIEW')).length,
          closed: mReqs.filter(r => (r.status || '').toUpperCase() === 'CLOSED').length
        };
      });

      const standardDepts = ['PRODUCTION', 'MAINTENANCE', 'PED', 'MATERIALS', 'MARKETING', 'INCOMING QUALITY'];
      const departmentBreakdown = standardDepts.map(dept => {
        const dReqs = scopedStore.filter(r => (r.resp || '').trim().toUpperCase() === dept);
        return {
          department: dept,
          total: dReqs.length,
          open: dReqs.filter(r => (r.status || '').toUpperCase() === 'OPEN' || (r.status || '').toUpperCase() === 'PENDING').length,
          inProgress: dReqs.filter(r => (r.status || '').toUpperCase().includes('PROGRESS') || (r.status || '').toUpperCase().includes('REVIEW')).length,
          closed: dReqs.filter(r => (r.status || '').toUpperCase() === 'CLOSED').length
        };
      });

      const fourMCategories = ['MAN', 'MACHINE', 'METHOD', 'MATERIAL'];
      const fourMDetails = fourMCategories.map(cat => {
        const cReqs = scopedStore.filter(r => (r.four_m || '').trim().toUpperCase() === cat);
        return {
          category: cat,
          total: cReqs.length,
          open: cReqs.filter(r => (r.status || '').toUpperCase() === 'OPEN' || (r.status || '').toUpperCase() === 'PENDING').length,
          inProgress: cReqs.filter(r => (r.status || '').toUpperCase().includes('PROGRESS') || (r.status || '').toUpperCase().includes('REVIEW')).length,
          closed: cReqs.filter(r => (r.status || '').toUpperCase() === 'CLOSED').length
        };
      });

      const shiftList = ['Shift 1', 'Shift 2', 'Shift 3', 'General'];
      const shiftBreakdown = shiftList.map(shiftName => {
        const sReqs = scopedStore.filter(r => String(r.shift || '').toLowerCase().includes(shiftName.toLowerCase().replace('shift ', '')));
        return {
          shift: shiftName,
          total: sReqs.length,
          open: sReqs.filter(r => (r.status || '').toUpperCase() === 'OPEN' || (r.status || '').toUpperCase() === 'PENDING').length,
          inProgress: sReqs.filter(r => (r.status || '').toUpperCase().includes('PROGRESS') || (r.status || '').toUpperCase().includes('REVIEW')).length,
          closed: sReqs.filter(r => (r.status || '').toUpperCase() === 'CLOSED').length
        };
      });

      const isUserAdmin = currentUser?.role?.toUpperCase() === 'ADMIN' || currentUser?.department?.toUpperCase() === 'INCOMING QUALITY';
      return {
        total,
        open,
        pending: isUserAdmin ? open : (open + inProgress),
        inProgress,
        closed,
        fourMBreakdown: {
          MAN: scopedStore.filter(r => (r.four_m || '').toUpperCase() === 'MAN').length,
          MACHINE: scopedStore.filter(r => (r.four_m || '').toUpperCase() === 'MACHINE').length,
          METHOD: scopedStore.filter(r => (r.four_m || '').toUpperCase() === 'METHOD').length,
          MATERIAL: scopedStore.filter(r => (r.four_m || '').toUpperCase() === 'MATERIAL').length,
        },
        fourMDetails,
        monthlyTrend,
        departmentBreakdown,
        shiftBreakdown,
        recentRequests: scopedStore.slice(0, 5)
      };
    }
  },

  getRequests: async (filters = {}) => {
    try {
      const currentUser = storage.getUser();
      const userParams = currentUser ? {
        user_name: currentUser.name,
        user_email: currentUser.email,
        user_id: currentUser.id,
        role: currentUser.role,
        department: currentUser.department
      } : {};
      const res = await api.get('/ihlr/requests', { params: { ...userParams, ...filters } });
      const data = res.data?.data || res.data || [];
      return data;
    } catch {
      let data = [...localIhlrStore];
      if (filters.search) {
        const q = filters.search.toLowerCase();
        data = data.filter(r => 
          (r.problem && r.problem.toLowerCase().includes(q)) ||
          (r.model && r.model.toLowerCase().includes(q)) ||
          (r.received_from && r.received_from.toLowerCase().includes(q)) ||
          (r.analysis_done_by && r.analysis_done_by.toLowerCase().includes(q)) ||
          (r.resp_person && r.resp_person.toLowerCase().includes(q))
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
      if (filters.startDate || filters.endDate) {
        data = data.filter(r => {
          const dStr = (r.batch_date || r.created_at || '').split('T')[0];
          if (!dStr) return false;
          if (filters.startDate && dStr < filters.startDate) return false;
          if (filters.endDate && dStr > filters.endDate) return false;
          return true;
        });
      }
      return data;
    }
  },

  getRequestById: async (id) => {
    try {
      const res = await api.get(`/ihlr/requests/${id}`);
      return res.data?.data || res.data;
    } catch (err) {
      console.error(`[ihlrService] getRequestById(${id}) failed:`, err);
      throw err;
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
    } catch (err) {
      console.error('[ihlrService] createRequest failed:', err);
      throw err;
    }
  },

  updateRequest: async (id, updates) => {
    try {
      const res = await api.put(`/ihlr/requests/${id}`, updates);
      return res.data?.data || res.data;
    } catch (err) {
      console.error(`[ihlrService] updateRequest(${id}) failed:`, err);
      throw err;
    }
  },

  deleteRequest: async (id) => {
    try {
      const res = await api.delete(`/ihlr/requests/${id}`);
      return res.data?.data || res.data;
    } catch (err) {
      console.error(`[ihlrService] deleteRequest(${id}) failed:`, err);
      throw err;
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
      const res = await api.patch(`/ihlr/notifications/${id}/read`, { read: true });
      return res.data?.data || res.data;
    } catch {
      return null;
    }
  },

  markNotificationAsUnread: async (id) => {
    try {
      const res = await api.patch(`/ihlr/notifications/${id}/unread`, { read: false });
      return res.data?.data || res.data;
    } catch {
      return null;
    }
  },

  markAllNotificationsAsRead: async (user = '') => {
    try {
      const payload = typeof user === 'object' && user !== null ? user : { user };
      const res = await api.patch('/ihlr/notifications/mark-all-read', payload);
      return res.data?.data || res.data;
    } catch {
      return null;
    }
  }
};

export default ihlrService;
