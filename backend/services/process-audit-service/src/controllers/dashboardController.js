import pool from '../../../shared/db.js';
import { successResponse, errorResponse } from '../../../shared/response.js';

export const getDashboardMetrics = async (req, res) => {
  try {
    if (!pool) throw new Error('Database pool not available');
    const [rows] = await pool.query('SELECT status, COUNT(*) as count FROM process_audit_requests GROUP BY status');
    
    let totalRequests = 0;
    let pendingExecution = 0;
    let inExecution = 0;
    let pendingApproval = 0;
    let approved = 0;
    let rejected = 0;

    rows.forEach(r => {
      const c = Number(r.count) || 0;
      totalRequests += c;
      const s = (r.status || '').toLowerCase();
      if (s.includes('pending execution')) pendingExecution += c;
      else if (s.includes('in execution')) inExecution += c;
      else if (s.includes('pending approval')) pendingApproval += c;
      else if (s.includes('approved')) approved += c;
      else if (s.includes('rejected')) rejected += c;
    });

    const auditPerformance = totalRequests > 0 ? Number(((approved / totalRequests) * 100).toFixed(1)) : 100.0;

    const data = {
      totalRequests,
      pendingExecution,
      inExecution,
      pendingApproval,
      approved,
      rejected,
      openCapa: rejected,
      auditPerformance
    };
    return successResponse(res, data, 'Process audit dashboard metrics retrieved from DB');
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};
