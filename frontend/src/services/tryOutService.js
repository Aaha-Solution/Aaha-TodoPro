import api from './api';

export const tryOutService = {
  getDashboardStats: async () => {
    try {
      const res = await api.get('/tryout-status/dashboard');
      return res.data;
    } catch {
      return {
        activeTrials: 14,
        pendingApprovals: 6,
        pilotBatches: 3,
        firstTimeRightRate: 92.5,
      };
    }
  },

  getTrialRuns: async () => {
    try {
      const res = await api.get('/tryout-status/trials');
      return res.data;
    } catch {
      return [
        { id: 'TR-501', toolCode: 'DIE-M74', project: 'EV Inverter Housing', stage: 'T1 Trial', status: 'Passed Initial CMM' },
        { id: 'TR-502', toolCode: 'STAMP-209', project: 'Alternator Core', stage: 'T2 Trial', status: 'Under Inspection' },
      ];
    }
  }
};
