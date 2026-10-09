import pool from '../../../shared/db.js';
import { successResponse, errorResponse } from '../../../shared/response.js';

export const getDashboardMetrics = async (req, res) => {
  try {
    if (!pool) throw new Error('Database pool not available');
    const { department, month, user, user_id, role } = req.query;
    const startDate = (req.query.startDate || req.query.start_date || req.query.from_date || '').trim();
    const endDate = (req.query.endDate || req.query.end_date || req.query.to_date || '').trim();

    const userRole = (role || req.user?.role || '').trim().toUpperCase();
    const isAdmin = userRole === 'ADMIN';

    let query = 'SELECT status, COUNT(*) as count FROM process_audit_requests';
    const conditions = [];
    const params = [];

    // Filter by user unless Admin
    if (!isAdmin) {
      const uName = (user || req.user?.name || req.user?.email || '').trim();
      const uId = Number(user_id || req.user?.id) || 0;
      if (uName || uId) {
        conditions.push(`(
          (created_by_id IS NOT NULL AND created_by_id = ?) 
          OR LOWER(TRIM(created_by)) = LOWER(?)
          OR LOWER(created_by) LIKE CONCAT('%', LOWER(?), '%')
          OR LOWER(TRIM(executor)) = LOWER(?)
          OR LOWER(executor) LIKE CONCAT('%', LOWER(?), '%')
        )`);
        params.push(uId, uName, uName, uName, uName);
      }
    }

    if (department && department !== 'All') {
      conditions.push('UPPER(TRIM(department)) = UPPER(TRIM(?))');
      params.push(department);
    }

    if (month && month !== 'All') {
      conditions.push("(DATE_FORMAT(escalation_date, '%Y-%m') = ? OR DATE_FORMAT(created_at, '%Y-%m') = ?)");
      params.push(month, month);
    }

    if (startDate) {
      conditions.push('DATE(COALESCE(escalation_date, created_at)) >= ?');
      params.push(startDate);
    }

    if (endDate) {
      conditions.push('DATE(COALESCE(escalation_date, created_at)) <= ?');
      params.push(endDate);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    query += ' GROUP BY status';

    const [rows] = await pool.query(query, params);
    
    let totalRequests = 0;
    let pendingExecution = 0;
    let inProgress = 0;
    let openCount = 0;
    let approved = 0;
    let closed = 0;
    let rejected = 0;

    rows.forEach(r => {
      const c = Number(r.count) || 0;
      totalRequests += c;
      const s = (r.status || '').toLowerCase();
      if (s.includes('close')) closed += c;
      else if (s.includes('progress') || s.includes('signed') || (s.includes('approved') && !s.includes('pending'))) inProgress += c;
      else if (s === 'open' || s.includes('open') || s.includes('reopen')) openCount += c;
      else if (s.includes('rejected') || s.includes('reject')) rejected += c;
      else if (s.includes('pending execution') || s.includes('pending')) pendingExecution += c;
      else pendingExecution += c;
    });

    const auditPerformance = totalRequests > 0 ? Number((((approved + closed) / totalRequests) * 100).toFixed(1)) : 100.0;

    const data = {
      totalRequests,
      pendingExecution,
      inProgress,
      open: openCount,
      approved,
      closed,
      rejected,
      inExecution: inProgress,
      pendingApproval: 0,
      openCapa: rejected,
      auditPerformance
    };
    return successResponse(res, data, 'Process audit dashboard metrics retrieved from DB');
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};
