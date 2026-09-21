import { successResponse } from '../../utils/response.js';

export const getDashboardMetrics = async (req, res) => {
  const data = {
    totalRequests: 5,
    pendingExecution: 1,
    inExecution: 0,
    pendingApproval: 2,
    approved: 1,
    rejected: 1,
  };
  return successResponse(res, data, 'Dashboard metrics retrieved');
};
