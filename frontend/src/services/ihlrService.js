import api from './api';

export const ihlrService = {
  getDashboardStats: async () => {
    try {
      const res = await api.get('/ihlr/dashboard');
      return res.data;
    } catch {
      return {
        totalRejections: 128,
        ppmRate: 420,
        pendingRCA: 4,
        scrapWeightKg: 184.5,
        costImpact: '₹ 1,42,800',
      };
    }
  },

  getLineRejections: async () => {
    try {
      const res = await api.get('/ihlr/line-rejections');
      return res.data;
    } catch {
      return [
        { id: 'LR-101', partNumber: 'INEL-CDI-902', line: 'SMT Line 1', defectType: 'Solder Bridge', qty: 12, status: 'RCA Assigned' },
        { id: 'LR-102', partNumber: 'INEL-REG-401', line: 'Molding Cell B', defectType: 'Flash / Burr', qty: 5, status: 'Contained' },
      ];
    }
  },

  getScrapMonitoring: async () => {
    try {
      const res = await api.get('/ihlr/scrap');
      return res.data;
    } catch {
      return [
        { id: 'SCRAP-088', material: 'Copper Wire', weightKg: 45.2, disposalStatus: 'Approved For Recirculation' },
      ];
    }
  }
};
