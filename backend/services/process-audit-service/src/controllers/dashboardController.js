import pool from '../../../shared/db.js';
import { verifyToken } from '../../../shared/jwt.js';
import { successResponse, errorResponse } from '../../../shared/response.js';

export const getDashboardMetrics = async (req, res) => {
  try {
    if (!pool) throw new Error('Database pool not available');
    const { department, month } = req.query;
    const startDate = (req.query.startDate || req.query.start_date || req.query.from_date || '').trim();
    const endDate = (req.query.endDate || req.query.end_date || req.query.to_date || '').trim();

    const authHeader = req.headers.authorization;
    let tokenUser = null;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        tokenUser = verifyToken(authHeader.split(' ')[1]);
      } catch {}
    }
    const userRole = (req.query.role || tokenUser?.role || req.user?.role || '').trim().toUpperCase();
    const userDept = (req.query.user_department || req.query.department_user || tokenUser?.department || req.user?.department || '').trim().toUpperCase();
    const isAdmin = userRole === 'ADMIN' || userDept === 'QAD';

    const targetDept = (req.query.filter_dept || req.query.filterDept || (department && department.trim().toUpperCase() !== 'ALL' ? department.trim() : '')).trim();

    let effectiveDept = null;
    if (!isAdmin && userDept && userDept !== 'QAD') {
      effectiveDept = userDept;
    } else if (targetDept && targetDept.toUpperCase() !== 'ALL') {
      if (isAdmin && userDept === 'QAD' && targetDept.toUpperCase() === 'QAD' && !req.query.filter_dept) {
        effectiveDept = null;
      } else {
        effectiveDept = targetDept;
      }
    }

    let query = 'SELECT status, COUNT(*) as count FROM process_audit_requests';
    const conditions = [];
    const params = [];

    if (effectiveDept) {
      conditions.push('UPPER(TRIM(department)) = UPPER(TRIM(?))');
      params.push(effectiveDept);
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
      else if (s.includes('progress') || s.includes('signed') || s.includes('review') || s.includes('approval') || (s.includes('approved') && !s.includes('pending'))) inProgress += c;
      else if (s === 'open' || s.includes('open') || s.includes('reopen')) openCount += c;
      else if (s.includes('rejected') || s.includes('reject')) rejected += c;
      else if (s.includes('pending execution') || s.includes('pending')) pendingExecution += c;
      else pendingExecution += c;
    });

    const auditPerformance = totalRequests > 0 ? Number((((approved + closed) / totalRequests) * 100).toFixed(1)) : 100.0;

    // Fetch department breakdown distribution (respecting timeline date filters)
    let deptQuery = 'SELECT UPPER(TRIM(department)) as dept, COUNT(*) as count FROM process_audit_requests';
    const deptConditions = [];
    const deptParams = [];
    if (effectiveDept) {
      deptConditions.push('UPPER(TRIM(department)) = UPPER(TRIM(?))');
      deptParams.push(effectiveDept);
    }
    if (month && month !== 'All') {
      deptConditions.push("(DATE_FORMAT(escalation_date, '%Y-%m') = ? OR DATE_FORMAT(created_at, '%Y-%m') = ?)");
      deptParams.push(month, month);
    }
    if (startDate) {
      deptConditions.push('DATE(COALESCE(escalation_date, created_at)) >= ?');
      deptParams.push(startDate);
    }
    if (endDate) {
      deptConditions.push('DATE(COALESCE(escalation_date, created_at)) <= ?');
      deptParams.push(endDate);
    }
    if (deptConditions.length > 0) {
      deptQuery += ' WHERE ' + deptConditions.join(' AND ');
    }
    deptQuery += ' GROUP BY UPPER(TRIM(department))';

    const [deptRows] = await pool.query(deptQuery, deptParams).catch(() => [[]]);
    const departmentBreakdown = {};
    (deptRows || []).forEach(r => {
      const d = (r.dept || '').trim();
      if (d) departmentBreakdown[d] = Number(r.count) || 0;
    });

    // Fetch matching requests for analytical chart breakdowns
    let chartReqQuery = 'SELECT id, status, department, shift, process_operation, escalation_date, created_at FROM process_audit_requests';
    if (conditions.length > 0) {
      chartReqQuery += ' WHERE ' + conditions.join(' AND ');
    }
    const [chartRows] = await pool.query(chartReqQuery, params).catch(() => [[]]);

    const getStatusCategory = (r) => {
      const s = (r.status || '').toLowerCase();
      if (s.includes('close')) return 'closed';
      if (s.includes('progress') || s.includes('signed') || s.includes('review') || s.includes('approval') || (s.includes('approved') && !s.includes('pending'))) return 'inProgress';
      return 'open';
    };

    // 1. Monthly Trend (12 Months)
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlyTrend = monthNames.map((name, index) => {
      const mReqs = (chartRows || []).filter(r => {
        const dVal = r.escalation_date || r.created_at;
        if (!dVal) return false;
        const d = new Date(dVal);
        return !isNaN(d.getTime()) && d.getMonth() === index;
      });
      return {
        month: name,
        monthIndex: index,
        total: mReqs.length,
        open: mReqs.filter(r => getStatusCategory(r) === 'open').length,
        inProgress: mReqs.filter(r => getStatusCategory(r) === 'inProgress').length,
        closed: mReqs.filter(r => getStatusCategory(r) === 'closed').length
      };
    });

    // 2. Department Breakdown List
    const standardDepts = ['PRODUCTION', 'MAINTENANCE', 'PED', 'MATERIALS', 'MARKETING', 'INCOMING QUALITY', 'QAD'];
    const existingDepts = (chartRows || []).map(r => (r.department || '').trim().toUpperCase()).filter(Boolean);
    const uniqueDepts = Array.from(new Set([...standardDepts, ...existingDepts]));
    const departmentBreakdownList = uniqueDepts.map(dept => {
      const dReqs = (chartRows || []).filter(r => (r.department || '').trim().toUpperCase() === dept);
      return {
        department: dept,
        total: dReqs.length,
        open: dReqs.filter(r => getStatusCategory(r) === 'open').length,
        inProgress: dReqs.filter(r => getStatusCategory(r) === 'inProgress').length,
        closed: dReqs.filter(r => getStatusCategory(r) === 'closed').length
      };
    }).sort((a, b) => b.total - a.total);

    // 3. Shift Breakdown
    const normalizeShift = (val) => {
      const s = String(val || '').toLowerCase().trim();
      if (s.includes('night') || s.includes('3') || s === 'iii') return 'Night (Shift 3)';
      if (s.includes('even') || s.includes('2') || s === 'ii') return 'Evening (Shift 2)';
      if (s.includes('morn') || s.includes('1') || s === 'i') return 'Morning (Shift 1)';
      if (s.includes('gen')) return 'General';
      return 'General';
    };
    const shiftList = ['Morning (Shift 1)', 'Evening (Shift 2)', 'Night (Shift 3)', 'General'];
    const shiftBreakdown = shiftList.map(shiftName => {
      const sReqs = (chartRows || []).filter(r => normalizeShift(r.shift) === shiftName);
      return {
        shift: shiftName,
        total: sReqs.length,
        open: sReqs.filter(r => getStatusCategory(r) === 'open').length,
        inProgress: sReqs.filter(r => getStatusCategory(r) === 'inProgress').length,
        closed: sReqs.filter(r => getStatusCategory(r) === 'closed').length
      };
    });

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
      auditPerformance,
      departmentBreakdown,
      departmentBreakdownList,
      monthlyTrend,
      shiftBreakdown
    };
    return successResponse(res, data, 'Process audit dashboard metrics retrieved from DB');
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};
