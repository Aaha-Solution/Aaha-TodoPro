/**
 * Process Audit Controller - Unified Microservice Controller
 * Consolidated to match the IHLR controller architecture.
 */
import path from 'path';
import pool from '../../../shared/db.js';
import { verifyToken } from '../../../shared/jwt.js';
import { successResponse, errorResponse } from '../../../shared/response.js';
import { broadcastEvent } from '../../../shared/realtimeNotifier.js';
import { sendProcessAuditRequestEmails, sendProcessAuditCloserEmails, sendEmail, generateEmailTemplate } from '../../../shared/mailer.js';
import { ProcessAuditRequest, Approval } from '../models/ProcessAuditRequest.js';
import { ProcessAuditAttachment as Attachment } from '../models/ProcessAuditAttachment.js';

// ======================================================
// 1. ATTACHMENT CONTROLLER METHODS
// ======================================================

/**
 * Stream binary attachment directly from MySQL database with inline disposition
 * Enables image rendering (<img src="...">) and PDF viewer (<iframe src="...">)
 */
export const getAttachment = async (req, res) => {
  try {
    const idOrFilename = req.params.id || req.params.filename;
    if (!idOrFilename) {
      return errorResponse(res, 'Attachment identifier is required', 400);
    }

    const fileRecord = await Attachment.getAttachmentByIdOrFilename(idOrFilename);
    if (!fileRecord || !fileRecord.file_data) {
      return errorResponse(res, 'Attachment not found in database', 404);
    }

    let mimeType = fileRecord.mime_type || 'application/octet-stream';
    const filename = fileRecord.original_name || fileRecord.filename || 'attachment';
    const ext = filename.split('.').pop()?.toLowerCase();
    if (ext === 'jfif' || ext === 'jpg' || ext === 'jpeg') {
      mimeType = 'image/jpeg';
    } else if (ext === 'png') {
      mimeType = 'image/png';
    } else if (ext === 'webp') {
      mimeType = 'image/webp';
    } else if (ext === 'gif') {
      mimeType = 'image/gif';
    } else if (ext === 'svg') {
      mimeType = 'image/svg+xml';
    } else if (ext === 'pdf') {
      mimeType = 'application/pdf';
    }

    const isDownload = req.query.download === '1' || req.query.download === 'true';
    const dispositionType = isDownload ? 'attachment' : 'inline';

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Length', fileRecord.file_data.length);
    res.setHeader('Content-Disposition', `${dispositionType}; filename="${encodeURIComponent(filename)}"`);
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24h

    return res.end(fileRecord.file_data);
  } catch (err) {
    console.error('[Process Audit Service] Error streaming attachment:', err);
    return errorResponse(res, 'Failed to stream attachment: ' + err.message, 500);
  }
};

/**
 * Download binary attachment with attachment disposition (forces save-as)
 */
export const downloadAttachment = async (req, res) => {
  try {
    const idOrFilename = req.params.id || req.params.filename;
    if (!idOrFilename) {
      return errorResponse(res, 'Attachment identifier is required', 400);
    }

    const fileRecord = await Attachment.getAttachmentByIdOrFilename(idOrFilename);
    if (!fileRecord || !fileRecord.file_data) {
      return errorResponse(res, 'Attachment not found in database', 404);
    }

    let mimeType = fileRecord.mime_type || 'application/octet-stream';
    const filename = fileRecord.original_name || fileRecord.filename || 'attachment';
    const ext = filename.split('.').pop()?.toLowerCase();
    if (ext === 'jfif' || ext === 'jpg' || ext === 'jpeg' || mimeType === 'image/jfif' || mimeType === 'image/pjpeg') {
      mimeType = 'image/jpeg';
    }

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Length', fileRecord.file_data.length);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);

    return res.end(fileRecord.file_data);
  } catch (err) {
    console.error('[Process Audit Service] Error downloading attachment:', err);
    return errorResponse(res, 'Failed to download attachment: ' + err.message, 500);
  }
};

/**
 * Return metadata about an attachment without streaming the heavy binary data
 */
export const getAttachmentInfo = async (req, res) => {
  try {
    const idOrFilename = req.params.id || req.params.filename;
    const fileRecord = await Attachment.getAttachmentByIdOrFilename(idOrFilename);
    if (!fileRecord) {
      return errorResponse(res, 'Attachment not found', 404);
    }

    return successResponse(res, {
      id: fileRecord.id,
      filename: fileRecord.filename,
      original_name: fileRecord.original_name,
      mime_type: fileRecord.mime_type,
      file_size: fileRecord.file_size,
      uploaded_at: fileRecord.uploaded_at,
      url: `/api/process-audit/attachments/${fileRecord.id}`,
    });
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
};


// ======================================================
// 2. USER CONTROLLER METHODS
// ======================================================

export const getUsers = async (req, res) => {
  try {
    if (!pool) throw new Error('Database pool not available');
    const { department } = req.query;
    let query = 'SELECT id, name, email, role, department, department as dept, status FROM users';
    const params = [];
    if (department && department.trim() && department !== 'All') {
      query += ' WHERE LOWER(TRIM(department)) = LOWER(TRIM(?))';
      params.push(department);
    }
    query += ' ORDER BY name ASC, id ASC';
    const [users] = await pool.query(query, params);
    return successResponse(res, users);
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};


// ======================================================
// 3. DASHBOARD CONTROLLER METHODS
// ======================================================

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

    // Dashboard is common plant-wide for all roles and departments.
    // Filter by department only when an explicit department filter is selected.
    let effectiveDept = null;
    if (targetDept && targetDept.toUpperCase() !== 'ALL') {
      effectiveDept = targetDept;
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


// ======================================================
// 4. APPROVAL CONTROLLER METHODS
// ======================================================

export const getAllApprovals = async (req, res) => {
  try {
    const filters = {
      requestId: req.query.request_id || req.query.requestId,
      issueNo: req.query.issue_no || req.query.issueNo,
      approvedBy: req.query.approved_by || req.query.approvedBy,
    };
    const approvals = await Approval.getApprovals(filters);
    return successResponse(res, approvals, 'Approvals retrieved successfully');
  } catch (err) {
    console.error('Failed to get approvals:', err);
    return errorResponse(res, err.message, 500);
  }
};

export const getApprovalByRequestId = async (req, res) => {
  try {
    const { id } = req.params;
    const approval = await Approval.getApprovalByRequestId(id);
    if (!approval) {
      return errorResponse(res, 'No approval found for this request', 404);
    }
    return successResponse(res, approval, 'Approval details retrieved');
  } catch (err) {
    console.error('Failed to get approval details:', err);
    return errorResponse(res, err.message, 500);
  }
};


// ======================================================
// 5. NOTIFICATION CONTROLLER METHODS
// ======================================================

// Auto-ensure process_audit_notifications table exists
const ensureNotificationTable = async () => {
  if (!pool) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS process_audit_notifications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NULL,
        user_name VARCHAR(100) NOT NULL,
        user_email VARCHAR(150) NULL,
        request_id INT NOT NULL,
        issue_no VARCHAR(50) NOT NULL,
        type VARCHAR(50) DEFAULT 'assignment',
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        link VARCHAR(255) DEFAULT '/process-audit/approvals',
        is_read TINYINT(1) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Ensure user_email column exists in existing tables
    const [cols] = await pool.query(`SHOW COLUMNS FROM process_audit_notifications LIKE 'user_email'`).catch(() => [[]]);
    if (!cols || cols.length === 0) {
      await pool.query(`ALTER TABLE process_audit_notifications ADD COLUMN user_email VARCHAR(150) NULL`).catch(() => {});
    }

    // Clean up duplicate fallback notifications where assignment_required already exists for the request
    await pool.query(`
      DELETE FROM process_audit_notifications 
      WHERE type = 'approval_required' 
        AND title LIKE 'New Request Assigned:%'
        AND request_id IN (
          SELECT req_id FROM (
            SELECT DISTINCT request_id AS req_id FROM process_audit_notifications WHERE type = 'assignment_required'
          ) AS sub
        )
    `).catch(() => {});

    // Auto-fix existing reassignment notifications that were saved as 'assignment_required' or had 'Assigned' in title
    await pool.query(`
      UPDATE process_audit_notifications 
      SET type = 'pa_reassigned', 
          title = REPLACE(title, 'Assigned', 'Reassigned')
      WHERE (message LIKE '%has been reassigned%' OR message LIKE '%reassigned to you%')
        AND (title LIKE '%Assigned%' AND title NOT LIKE '%Reassigned%')
    `).catch(() => {});

    // Auto-fix existing notifications where temporary_closed_by was mistakenly used in message
    await pool.query(`
      UPDATE process_audit_notifications n
      LEFT JOIN process_audit_requests r ON n.request_id = r.id
      SET n.message = REPLACE(
        n.message,
        'TEMPORARY CLOSED BY',
        COALESCE(NULLIF(TRIM(r.closer_updated_by), ''), NULLIF(TRIM(r.executor), ''), 'Assigned Executor')
      )
      WHERE n.message LIKE '%TEMPORARY CLOSED BY%'
    `).catch(() => {});
  } catch (err) {
    console.warn('[process_audit_notifications] table ensure warning:', err.message);
  }
};
ensureNotificationTable();

export const getNotifications = async (req, res) => {
  try {
    if (!pool) throw new Error('Database pool not available');
    await ensureNotificationTable();

    const userName = (req.query.user || req.query.user_name || req.query.user_email || req.user?.name || req.user?.email || '').trim();
    const userId = req.query.user_id ? Number(req.query.user_id) : (req.user?.id || null);
    const userEmail = (req.query.user_email || req.query.email || req.user?.email || '').trim().toLowerCase();
    const userRole = (req.query.role || req.user?.role || '').trim().toUpperCase();
    const userDept = (req.query.department || req.user?.department || '').trim().toUpperCase();
    const isAdmin = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN' || userRole === 'SUPER ADMIN' || userDept === 'QAD' || userName.toLowerCase().includes('admin');

    // Auto-sync fallback: only insert if NO notification of any type exists for this request
    await pool.query(`
      INSERT INTO process_audit_notifications (user_name, user_id, user_email, request_id, issue_no, type, title, message, link)
      SELECT 
        r.executor, 
        u.id,
        u.email,
        r.id, 
        r.issue_no, 
        'approval_required',
        CONCAT('New Request Assigned: #', r.issue_no),
        CONCAT('New request #', r.issue_no, ' (', r.department, ' - ', r.model, ') has been assigned to you for review & sign-off.'),
        '/process-audit/approvals'
      FROM process_audit_requests r
      LEFT JOIN users u ON LOWER(TRIM(u.name)) = LOWER(TRIM(r.executor))
      WHERE r.executor IS NOT NULL 
        AND TRIM(r.executor) != ''
        AND r.status NOT IN ('Approved', 'Rejected', 'Closed')
        AND NOT EXISTS (
          SELECT 1 FROM process_audit_notifications n 
          WHERE n.request_id = r.id
        )
    `).catch(() => {});

    let notifRows = [];
    let query = `SELECT * FROM process_audit_notifications`;
    const params = [];
    const conditions = [];

    if (userId) {
      conditions.push('user_id = ?');
      params.push(userId);
    }
    if (userName) {
      conditions.push('LOWER(TRIM(user_name)) = LOWER(TRIM(?))');
      params.push(userName);
      conditions.push('FIND_IN_SET(?, REPLACE(LOWER(user_name), ", ", ","))');
      params.push(userName.toLowerCase());
    }
    if (userEmail) {
      conditions.push('LOWER(TRIM(user_email)) = LOWER(TRIM(?))');
      params.push(userEmail);
      conditions.push('FIND_IN_SET(?, REPLACE(LOWER(user_email), ", ", ","))');
      params.push(userEmail.toLowerCase());
    }
    if (isAdmin) {
      conditions.push("LOWER(TRIM(user_name)) LIKE '%admin%'");
      conditions.push("LOWER(TRIM(user_email)) LIKE '%admin%'");
      conditions.push("type LIKE '%admin%'");
      conditions.push("type = 'closer_completed_pending_admin_signoff'");
      conditions.push("type = 'closer_completed_pending_review'");
      conditions.push("type = 'case_closed'");
      conditions.push("type = 'reassigned'");
      conditions.push("type = 'pa_reassigned'");
      conditions.push("type = 'approval_required'");
      conditions.push("type = 'assignment_required'");
      conditions.push("type = 'assigned_to_pa'");
    }

    if (conditions.length > 0) {
      query += ` WHERE (${conditions.join(' OR ')})`;
    } else if (!isAdmin) {
      return successResponse(res, [], 'Process Audit notifications retrieved');
    }

    query += ` ORDER BY id DESC LIMIT 50`;

    const [rows] = await pool.query(query, params).catch(() => [[]]);
    const rawRows = rows || [];

    // Deduplicate so that no user receives duplicate notifications for the same request, user, and event type
    const seen = new Set();
    notifRows = rawRows.filter((r) => {
      const key = `${r.request_id || r.issue_no}_${r.type}_${r.user_name || r.user_id || ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Also include synthetic recent request stream if notifications table is empty
    if (notifRows.length === 0) {
      let requests = (await ProcessAuditRequest.getAll()) || [];
      if (!isAdmin) {
        if (!userName && !userId && !userEmail) {
          return successResponse(res, [], 'Process Audit notifications retrieved');
        }
        requests = requests.filter(r => {
          const execNames = (r.executor || '').toLowerCase().split(',').map(s => s.trim()).filter(Boolean);
          const rCreatedBy = (r.created_by || '').trim().toLowerCase();
          const isExec = userName && execNames.includes(userName.toLowerCase());
          const isCreator = (userName && rCreatedBy === userName.toLowerCase()) || (userId && String(r.created_by_id) === String(userId));
          return isExec || isCreator;
        });
      }
      const notifications = requests.slice(0, 15).map(r => {
        const isClosed = (r.status || '').toLowerCase() === 'closed';
        const isApproved = (r.status || '').toLowerCase().includes('approved') || (r.status || '').toLowerCase().includes('review');
        const isRejected = (r.status || '').toLowerCase().includes('reject');
        let title = `Audit Request Raised: #${r.issue_no}`;
        let msg = `Audit request #${r.issue_no} (${r.model || 'Model'} - ${r.department}) logged with problem "${r.problem || r.issue_observation || '—'}".`;
        let badgeLabel = 'REPORT LOGGED';
        let accentColor = 'blue';

        if (isClosed) {
          title = `Audit Request Closed: #${r.issue_no}`;
          msg = `Request #${r.issue_no} (${r.model || 'Model'}) has been signed off and closed.`;
          badgeLabel = 'CASE CLOSED';
          accentColor = 'emerald';
        } else if (isApproved) {
          title = `Pending Sign-Off: #${r.issue_no}`;
          msg = `Request #${r.issue_no} has actions submitted and is pending sign-off.`;
          badgeLabel = 'PENDING SIGN-OFF';
          accentColor = 'amber';
        } else if (isRejected) {
          title = `Request Needs Attention: #${r.issue_no}`;
          msg = `Audit request #${r.issue_no} could not be signed off by ${r.executor}.`;
          badgeLabel = 'CORRECTION NEEDED';
          accentColor = 'rose';
        } else {
          title = `Action Required: Process Audit #${r.issue_no}`;
          msg = `Audit request #${r.issue_no} (${r.department}) assigned to ${r.executor} for root cause actions.`;
          badgeLabel = 'ACTION REQUIRED';
          accentColor = 'amber';
        }

        return {
          id: r.id,
          rawId: r.id,
          requestId: r.issue_no,
          reqNo: String(r.issue_no).startsWith('#') ? r.issue_no : `#${r.issue_no}`,
          title,
          message: msg,
          date: r.created_at ? new Date(r.created_at).toLocaleString('en-US', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Recent Today',
          time: r.created_at ? new Date(r.created_at).toLocaleString('en-US', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Recent Today',
          badgeLabel,
          accentColor,
          department: r.department || 'QUALITY AUDIT',
          subCategory: 'PROCESS AUDIT OBSERVATION',
          footerFlag: isClosed ? 'CASE_CLOSED' : isApproved ? 'ACTION_REQUIRED' : 'SYSTEM_LOGS',
          status: r.status || 'Open',
          read: false,
          type: r.status || 'info',
          link: isClosed ? '/process-audit/all-requests' : '/process-audit/approvals'
        };
      });
      return successResponse(res, notifications, 'Process Audit notifications retrieved');
    }

    const formatted = notifRows.map((n) => {
      const d = n.created_at ? new Date(n.created_at) : new Date();
      const isConfirmed = n.type === 'submission_confirmed' || n.type === 'request_created';
      const isClosed = ['case_closed', 'closed', 'request_closed'].includes(n.type) || (n.title && n.title.toLowerCase().includes('closed'));
      const isUpdated = ['countermeasure_updated', 'countermeasure_saved'].includes(n.type);
      const isPendingSignoff = ['closer_completed_pending_review', 'closer_completed_pending_admin_signoff', 'pending_requester_signoff'].includes(n.type) || (n.title && n.title.toLowerCase().includes('sign-off pending'));
      const isReassigned =
        n.type === 'reassigned' ||
        n.type === 'pa_reassigned' ||
        (n.title && n.title.toLowerCase().includes('reassign')) ||
        (n.message && n.message.toLowerCase().includes('reassign'));
      const isApproval = n.type === 'assignment_required' || n.type === 'approval_required' || (n.title && n.title.toLowerCase().includes('action required'));

      let badgeLabel = 'ACTION REQUIRED';
      let accentColor = 'amber';
      let footerFlag = 'ACTION_REQUIRED';
      let dept = n.department || 'QUALITY AUDIT';

      if (isPendingSignoff) {
        badgeLabel = 'PENDING SIGN-OFF';
        accentColor = 'amber';
        footerFlag = 'ACTION_REQUIRED';
        dept = 'QUALITY SIGN-OFF';
      } else if (isReassigned) {
        badgeLabel = 'REASSIGNED';
        accentColor = 'purple';
        footerFlag = 'REASSIGNED';
        dept = n.department || 'PRODUCTION';
      } else if (isConfirmed) {
        badgeLabel = 'REPORT LOGGED';
        accentColor = 'blue';
        footerFlag = 'SYSTEM_LOGS';
        dept = 'QAD';
      } else if (isClosed) {
        badgeLabel = 'CASE CLOSED';
        accentColor = 'emerald';
        footerFlag = 'CASE_CLOSED';
        dept = 'QUALITY VERIFIED';
      } else if (isUpdated) {
        badgeLabel = 'ACTION SUBMITTED';
        accentColor = 'indigo';
        footerFlag = 'OPERATIONAL_UPDATE';
        dept = 'PRODUCTION';
      } else if (isApproval) {
        badgeLabel = 'ACTION REQUIRED';
        accentColor = 'amber';
        footerFlag = 'ACTION_REQUIRED';
        dept = 'PRODUCTION';
      }

      let notifTitle = n.title;
      if (isReassigned && notifTitle && notifTitle.includes('Assigned') && !notifTitle.includes('Reassigned')) {
        notifTitle = notifTitle.replace(/\bAssigned\b/g, 'Reassigned');
      }

      return {
        id: n.id,
        user_id: n.user_id,
        user_name: n.user_name,
        user_email: n.user_email,
        rawId: n.request_id,
        requestId: n.issue_no,
        reqNo: String(n.issue_no).startsWith('#') ? n.issue_no : `#${n.issue_no}`,
        badgeLabel,
        accentColor,
        department: dept,
        title: notifTitle,
        message: n.message,
        date: d.toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
        time: d.toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
        timeDisplay: d.toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
        subCategory: 'PROCESS AUDIT OBSERVATION',
        footerFlag,
        type: n.type,
        link: n.link || (isClosed ? '/process-audit/all-requests' : '/process-audit/approvals'),
        read: Boolean(n.is_read),
        is_read: n.is_read,
      };
    });

    return successResponse(res, formatted, 'Process Audit notifications retrieved');
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

export const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const isRead = req.body?.read !== undefined ? (req.body.read ? 1 : 0) : 1;
    if (pool) {
      await pool.query('UPDATE process_audit_notifications SET is_read = ? WHERE id = ?', [isRead, id]);
    }
    broadcastEvent('notifications:refresh', { module: 'process_audit', action: isRead ? 'read' : 'unread', id });
    return successResponse(res, { id }, `Notification marked as ${isRead ? 'read' : 'unread'}`);
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

export const markAsUnread = async (req, res) => {
  try {
    const { id } = req.params;
    if (pool) {
      await pool.query('UPDATE process_audit_notifications SET is_read = 0 WHERE id = ?', [id]);
    }
    broadcastEvent('notifications:refresh', { module: 'process_audit', action: 'unread', id });
    return successResponse(res, { id }, 'Notification marked as unread');
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

export const markAllAsRead = async (req, res) => {
  try {
    const userName = (req.body?.user || req.body?.user_name || req.query.user || req.query.user_name || req.user?.name || '').trim();
    const userId = req.body?.user_id || req.query.user_id || req.user?.id;
    const userEmail = (req.body?.user_email || req.query.user_email || req.user?.email || '').trim().toLowerCase();
    const userRole = (req.body?.role || req.query.role || req.user?.role || '').trim().toUpperCase();
    const userDept = (req.body?.department || req.query.department || req.user?.department || '').trim().toUpperCase();
    const isAdmin = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN' || userRole === 'SUPER ADMIN' || userDept === 'QAD' || userName.toLowerCase().includes('admin');

    if (pool) {
      if (isAdmin) {
        await pool.query(
          `UPDATE process_audit_notifications SET is_read = 1 WHERE 
           user_id = ? OR 
           LOWER(TRIM(user_name)) LIKE '%admin%' OR 
           LOWER(TRIM(user_email)) LIKE '%admin%' OR 
           type IN ('approval_required', 'assignment_required', 'assigned_to_pa', 'request_approved', 'request_closed', 'case_closed', 'request_rejected', 'reassigned', 'pa_reassigned', 'request_created', 'submission_confirmed', 'closer_completed_pending_review', 'closer_completed_pending_admin_signoff', 'countermeasure_saved')`,
          [userId || 1]
        );
      } else {
        const conditions = [];
        const params = [];
        if (userId) {
          conditions.push('user_id = ?');
          params.push(userId);
        }
        if (userName) {
          conditions.push('LOWER(TRIM(user_name)) = LOWER(TRIM(?))');
          params.push(userName);
          conditions.push('FIND_IN_SET(?, REPLACE(LOWER(user_name), ", ", ","))');
          params.push(userName.toLowerCase());
        }
        if (userEmail) {
          conditions.push('LOWER(TRIM(user_email)) = LOWER(TRIM(?))');
          params.push(userEmail);
          conditions.push('FIND_IN_SET(?, REPLACE(LOWER(user_email), ", ", ","))');
          params.push(userEmail.toLowerCase());
        }

        if (conditions.length > 0) {
          await pool.query(`UPDATE process_audit_notifications SET is_read = 1 WHERE ${conditions.join(' OR ')}`, params);
        } else {
          await pool.query('UPDATE process_audit_notifications SET is_read = 1');
        }
      }
    }
    broadcastEvent('notifications:refresh', { module: 'process_audit', action: 'mark_all_read', userName });
    return successResponse(res, null, 'All notifications marked as read');
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};


// ======================================================
// 6. REQUEST & LIFECYCLE CONTROLLER METHODS
// ======================================================

export const getNextId = async (req, res) => {
  try {
    const nextId = await ProcessAuditRequest.getNextId();
    return successResponse(res, { nextId });
  } catch (err) {
    return errorResponse(res, err.message);
  }
};

export const getAllRequests = async (req, res) => {
  try {
    const { created_by, created_by_id, executor, user, role, scope, is_dashboard, all, department } = req.query;

    const authHeader = req.headers.authorization;
    let tokenUser = null;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        tokenUser = verifyToken(authHeader.split(' ')[1]);
      } catch {}
    }

    const userRole = (role || tokenUser?.role || req.user?.role || '').trim().toUpperCase();
    const userDept = (req.query.user_department || req.query.department_user || tokenUser?.department || req.user?.department || '').trim().toUpperCase();
    const isAdmin = userRole === 'ADMIN' || userDept === 'QAD';
    const isDashboardScope = scope === 'dashboard' || is_dashboard === 'true' || all === 'true';

    const filters = {};

    const targetDept = (req.query.filter_dept || req.query.filterDept || (department && department.trim().toUpperCase() !== 'ALL' ? department.trim() : '')).trim();

    // Requests are common plant-wide for all departments. Filter by department only when an explicit filter is specified.
    let effectiveDept = null;
    if (targetDept && targetDept.toUpperCase() !== 'ALL') {
      effectiveDept = targetDept;
    }

    if (effectiveDept) {
      filters.department = effectiveDept;
    }

    const isMyRequestsScope = scope === 'my' || scope === 'my_requests' || req.query.my === 'true';
    if (isMyRequestsScope && !isAdmin) {
      if (created_by) filters.created_by = created_by;
      if (created_by_id) filters.created_by_id = created_by_id;
      if (executor) filters.executor = executor;
      
      const userName = user || req.user?.name || req.user?.email || created_by || executor;
      const uId = req.query.user_id || req.user?.id || created_by_id;
      if (userName || uId) {
        filters.user = userName;
        filters.user_id = uId;
      }
    }

    const requests = await ProcessAuditRequest.findAll(filters);
    return successResponse(res, requests);
  } catch (err) {
    return errorResponse(res, err.message);
  }
};

export const uploadAttachments = async (req, res) => {
  try {
    const files = req.files || [];
    const formatted = [];
    for (const file of files) {
      const saved = await Attachment.saveAttachment(file);
      formatted.push(saved);
    }
    return successResponse(res, { files: formatted }, 'Files uploaded successfully');
  } catch (err) {
    return errorResponse(res, err.message);
  }
};

export const createRequest = async (req, res) => {
  try {
    const requestData = { ...req.body };

    if (requestData.escalation_date) {
      const escStr = String(requestData.escalation_date).split('T')[0];
      const todayStr = new Date().toISOString().split('T')[0];
      if (escStr > todayStr) {
        return errorResponse(res, 'Escalation Date cannot be a future date. Please select today or a past date.', 400);
      }
    }

    // If attachments were sent as a JSON string (e.g. from multipart form)
    let parsedAttachments = [];
    if (requestData.attachments) {
      if (typeof requestData.attachments === 'string') {
        try {
          parsedAttachments = JSON.parse(requestData.attachments);
        } catch {
          parsedAttachments = [];
        }
      } else if (Array.isArray(requestData.attachments)) {
        parsedAttachments = requestData.attachments;
      }
    }

    // If files were uploaded simultaneously in this multipart request
    if (req.files && req.files.length > 0) {
      const uploadedFiles = [];
      for (const file of req.files) {
        const saved = await Attachment.saveAttachment(file);
        uploadedFiles.push(saved);
      }
      parsedAttachments = [...parsedAttachments, ...uploadedFiles];
    }

    requestData.attachments = parsedAttachments;

    // Sanitize text fields to eliminate leading/trailing whitespace
    if (requestData.model) requestData.model = String(requestData.model).trim();
    if (requestData.product) requestData.product = String(requestData.product).trim();
    if (requestData.process_operation) requestData.process_operation = String(requestData.process_operation).trim();
    if (requestData.issue_observation) requestData.issue_observation = String(requestData.issue_observation).trim();
    if (requestData.comments) requestData.comments = String(requestData.comments).trim();

    // Resolve Creator User details
    let creatorUser = {
      id: requestData.created_by_id || req.user?.id || null,
      name: requestData.created_by || req.user?.name || 'Quality Auditor',
      email: req.user?.email || null,
      department: req.user?.department || 'QAD'
    };

    if (pool && (!creatorUser.email || !creatorUser.id)) {
      const [uRows] = await pool.query(
        'SELECT id, name, email, department, role FROM users WHERE id = ? OR (email IS NOT NULL AND LOWER(email) = LOWER(?)) OR (name IS NOT NULL AND LOWER(name) = LOWER(?)) LIMIT 1',
        [creatorUser.id || 0, creatorUser.email || '', creatorUser.name || '']
      ).catch(() => [[]]);
      if (uRows && uRows.length > 0) {
        creatorUser = {
          id: uRows[0].id,
          name: uRows[0].name,
          email: uRows[0].email,
          department: uRows[0].department || 'QAD',
          role: uRows[0].role
        };
      }
    }

    // Verify department authorization: Authenticated user must be from QAD, Production, or ADMIN
    const uDept = (creatorUser.department || '').trim().toUpperCase();
    const uRole = (creatorUser.role || req.user?.role || '').trim().toUpperCase();
    if (uRole !== 'ADMIN' && uDept !== 'QAD' && uDept !== 'PRODUCTION') {
      return errorResponse(
        res,
        'Access Denied: Only personnel from QAD, Production, or Admin are authorized to create Process Audit requests.',
        403
      );
    }

    // Resolve Executor(s) list and their user accounts for notifications & emails
    const executorList = String(requestData.executor || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const assignedUsersList = [];
    if (executorList.length > 0) {
      for (const execName of executorList) {
        let [execUserRows] = await pool.query(
          'SELECT id, name, email, department FROM users WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) OR LOWER(TRIM(email)) = LOWER(TRIM(?)) LIMIT 1',
          [execName, execName]
        ).catch(() => [[]]);

        if (execUserRows && execUserRows.length > 0) {
          assignedUsersList.push(execUserRows[0]);
        } else {
          assignedUsersList.push({
            id: null,
            name: execName,
            email: `${execName.toLowerCase().replace(/\s+/g, '')}@gmail.com`,
            department: requestData.department || 'Production'
          });
        }
      }
    } else {
      assignedUsersList.push({
        id: null,
        name: 'Assigned Executor',
        email: 'executor@gmail.com',
        department: requestData.department || 'Production'
      });
    }

    const assignedUser = assignedUsersList[0];
    const combinedAssignedEmails = assignedUsersList.map((u) => u.email).filter(Boolean).join(', ');

    requestData.created_by = (requestData.created_by && String(requestData.created_by).replace(/[0-9]/g, '').trim()) || creatorUser.name;
    requestData.created_by_id = creatorUser.id || requestData.created_by_id;
    requestData.created_by_email = creatorUser.email || requestData.created_by_email;
    requestData.executor_email = combinedAssignedEmails || assignedUser.email;
    requestData.notify_emails = String(requestData.notify_emails || requestData.cc_emails || '').trim();

    if (!creatorUser.email && requestData.created_by_email) {
      creatorUser.email = requestData.created_by_email;
    }

    // Parse notify / CC email list upfront so it is in scope for both DB notifications and email dispatch
    const notifyEmailsList = Array.from(new Set(
      String(requestData.notify_emails || '')
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter((s) => s && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s))
    ));

    const created = await ProcessAuditRequest.create(requestData);
    const issueNo = created.issue_no || (created.id ? `PA-${created.id}` : 'PA-1');
    const assignedNamesDisplay = assignedUsersList.map((u) => u.name).join(', ') || assignedUser.name;

    // 1. Insert In-App Notifications: exactly matching IHLR architecture
    if (pool && created) {
      try {
        // Notification A: For Raised Person (Confirmation)
        await pool.query(
          `INSERT INTO process_audit_notifications 
           (user_id, user_name, user_email, request_id, issue_no, type, title, message, link, is_read) 
           VALUES (?, ?, ?, ?, ?, 'submission_confirmed', ?, ?, '/process-audit/all-requests', 0)`,
          [
            creatorUser.id,
            creatorUser.name,
            creatorUser.email,
            created.id,
            issueNo,
            `Process Audit Finding Logged: #${issueNo}`,
            `Your Process Audit observation report for "${created.model || created.product || 'Audit'}" has been logged and assigned to ${assignedNamesDisplay} (${created.department || 'Production'}).`
          ]
        ).catch((e) => console.warn('[PA Notification A Error]:', e.message));

        // Notification B: For Each Assigned Executor in the field (Action Required)
        for (const userItem of assignedUsersList) {
          await pool.query(
            `INSERT INTO process_audit_notifications 
             (user_id, user_name, user_email, request_id, issue_no, type, title, message, link, is_read) 
             VALUES (?, ?, ?, ?, ?, 'assignment_required', ?, ?, '/process-audit/approvals', 0)`,
            [
              userItem.id,
              userItem.name,
              userItem.email,
              created.id,
              issueNo,
              `Action Required: Process Audit #${issueNo} Assigned`,
              `Process Audit report #${issueNo} (${created.model || 'Process'} - "${created.issue_observation || created.problem || 'Observation'}") has been assigned to you by ${creatorUser.name}. Please inspect and submit root cause action.`
            ]
          ).catch((e) => console.warn('[PA Notification B Error]:', e.message));
        }

        // Notification C: For Each CC / Notify Email (if any)
        for (const notifyEmail of notifyEmailsList) {
          let notifyUser = null;
          if (pool) {
            const [uRows] = await pool.query(
              'SELECT id, name, email, department FROM users WHERE LOWER(TRIM(email)) = ? LIMIT 1',
              [notifyEmail]
            ).catch(() => [[]]);
            if (uRows && uRows.length > 0) notifyUser = uRows[0];
          }

          if (pool && notifyUser) {
            await pool.query(
              `INSERT INTO process_audit_notifications 
               (user_id, user_name, user_email, request_id, issue_no, type, title, message, link, is_read) 
               VALUES (?, ?, ?, ?, ?, 'cc_notification', ?, ?, '/process-audit/all-requests', 0)`,
              [
                notifyUser.id,
                notifyUser.name,
                notifyUser.email,
                created.id,
                issueNo,
                `CC Notification: Process Audit #${issueNo}`,
                `You have been CC'd on Process Audit finding #${issueNo} for "${created.model || created.product || 'Process Audit'}" logged by ${creatorUser.name}.`
              ]
            ).catch((err) => console.warn('[PA Notifications] Error inserting CC in-app notification:', err.message));
          }
        }
      } catch (notifErr) {
        console.warn('[Process Audit Notifications] Error inserting multi-user in-app notifications:', notifErr.message);
      }
    }

    // 2. Trigger Emails to Raised Person AND All Assigned Executors (with CC recipients)
    try {
      const allAssignedNamesDisplay = (assignedUsersList && assignedUsersList.length > 0)
        ? assignedUsersList.map((u) => u.name).filter(Boolean).join(', ')
        : (created.executor || (assignedUser && assignedUser.name) || '');

      const allAssignedEmails = (assignedUsersList && assignedUsersList.length > 0)
        ? Array.from(new Set(assignedUsersList.map((u) => u.email).filter(Boolean))).join(', ')
        : (created.executor_email || (assignedUser && assignedUser.email) || '');

      const targetDept = (created.department || requestData.department || (assignedUsersList && assignedUsersList[0]?.department) || (assignedUser && assignedUser.department) || 'Production').trim();

      // Dispatch a single consolidated notification to all assignees & CC recipients so no one receives duplicate emails
      sendProcessAuditRequestEmails({
        request: created,
        creatorUser,
        assignedUser: {
          name: allAssignedNamesDisplay,
          email: allAssignedEmails,
          department: targetDept
        },
        allAssignedNames: allAssignedNamesDisplay,
        ccList: notifyEmailsList
      }).catch((mailErr) => console.warn('[Process Audit Mailer] Non-blocking email dispatch warning:', mailErr.message));
    } catch (mailSyncErr) {
      console.warn('[Process Audit Mailer] Sync email dispatch warning:', mailSyncErr.message);
    }

    // 3. Broadcast Realtime WebSocket Event
    broadcastEvent('process_audit:created', created);
    broadcastEvent('notifications:refresh', { module: 'process_audit', action: 'created', id: created.id, reqNo: issueNo });

    return successResponse(res, created, 'Process audit request created successfully. Notifications and emails dispatched to both auditor and assigned executor.', 201);
  } catch (err) {
    return errorResponse(res, err.message);
  }
};

export const updateRequestStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body || {};
    const { status, rejectionReason } = body;
    if (!status) {
      return errorResponse(res, 'Status is required', 400);
    }

    let parsedActionAttachments = body.action_attachments || body.actionAttachments || null;
    if (typeof parsedActionAttachments === 'string') {
      try {
        parsedActionAttachments = JSON.parse(parsedActionAttachments);
      } catch {
        parsedActionAttachments = [];
      }
    }

    // If files were uploaded simultaneously with this status update
    if (req.files && req.files.length > 0) {
      const uploadedFiles = [];
      for (const file of req.files) {
        const saved = await Attachment.saveAttachment(file);
        uploadedFiles.push(saved);
      }
      parsedActionAttachments = Array.isArray(parsedActionAttachments)
        ? [...parsedActionAttachments, ...uploadedFiles]
        : uploadedFiles;
    }

    let sanitizedWhys = null;
    if (body.prod_why_why) {
      if (Array.isArray(body.prod_why_why)) {
        sanitizedWhys = body.prod_why_why.map((w) => String(w || '').trim());
      } else if (typeof body.prod_why_why === 'string') {
        try {
          const parsed = JSON.parse(body.prod_why_why);
          sanitizedWhys = Array.isArray(parsed) ? parsed.map((w) => String(w || '').trim()) : body.prod_why_why.trim();
        } catch {
          sanitizedWhys = body.prod_why_why.trim();
        }
      }
    }

    const details = {
      rejectionReason: rejectionReason || body.rejection_reason || null,
      root_cause: (body.root_cause || body.rootCause || '').trim() || null,
      corrective_action: (body.corrective_action || body.correctiveAction || '').trim() || null,
      action_attachments: parsedActionAttachments,
      standardization_details: (body.standardization_details || body.standardizationDetails || '').trim() || null,
      target_date: body.target_date || body.targetDate || null,
      action_taken_by: (body.closer_updated_by || body.approved_by || req.user?.name || body.action_taken_by || '').trim() || null,
      approved_by: (body.approved_by || body.approvedBy || body.action_taken_by || body.actionTakenBy || req.user?.name || '').trim() || null,
      approved_by_id: body.approved_by_id || body.approvedById || req.user?.id || null,
      approved_by_email: body.approved_by_email || body.approvedByEmail || req.user?.email || null,
      approved_by_role: body.approved_by_role || body.approvedByRole || req.user?.role || null,
      comments: (body.comments || '').trim() || null,
      creator_remark: (body.creator_remark || body.creatorRemark || body.remark || '').trim() || null,
      reviewed_by: (body.reviewed_by || body.reviewedBy || body.approved_by || body.approvedBy || '').trim() || null,
      reviewed_by_id: body.reviewed_by_id || body.reviewedById || body.approved_by_id || body.approvedById || null,
      reviewed_by_email: body.reviewed_by_email || body.reviewedByEmail || body.approved_by_email || body.approvedByEmail || null,
      closed_by: body.closed_by !== undefined ? (body.closed_by ? String(body.closed_by).trim() : null) : (body.closedBy !== undefined ? (body.closedBy ? String(body.closedBy).trim() : null) : (body.permanent_closed_by ? String(body.permanent_closed_by).trim() : (String(status).toLowerCase() === 'closed' ? req.user?.name : null))),
      closed_by_id: body.closed_by_id || body.closedById || req.user?.id || null,
      prod_why_why: sanitizedWhys,
      temporary_action: body.temporary_action ? String(body.temporary_action).trim() : null,
      temporary_evidence_attachment: body.temporary_evidence_attachment || null,
      temporary_target_date: body.temporary_target_date || null,
      permanent_fix: body.permanent_fix ? String(body.permanent_fix).trim() : null,
      permanent_evidence_attachment: body.permanent_evidence_attachment || null,
      permanent_target_date: body.permanent_target_date || null,
      temporary_closed_by: body.temporary_closed_by !== undefined ? (body.temporary_closed_by ? String(body.temporary_closed_by).trim() : null) : (body.action_taken_by ? String(body.action_taken_by).trim() : null),
      permanent_closed_by: body.permanent_closed_by !== undefined ? (body.permanent_closed_by ? String(body.permanent_closed_by).trim() : null) : null,
      closer_updated_by: req.user?.name || body.closer_updated_by || body.closerUpdatedBy || null,
      closer_updated_by_id: req.user?.id || body.closer_updated_by_id || body.closerUpdatedById || null,
      closer_updated_by_email: req.user?.email || body.closer_updated_by_email || body.closerUpdatedByEmail || null
    };

    // Retrieve previous state to detect transitions
    const numericId = parseInt(String(id).replace(/\D/g, ''), 10) || id;
    const [existingRows] = await pool.query(
      'SELECT * FROM process_audit_requests WHERE id = ? OR issue_no = ?',
      [numericId, String(id)]
    ).catch(() => [[]]);
    const existing = existingRows?.[0] || null;

    if (existing && String(existing.status || '').toUpperCase() === 'CLOSED') {
      return errorResponse(res, 'This request is closed and cannot be edited.', 403);
    }

    const updated = await ProcessAuditRequest.updateStatus(id, status, details);
    if (!updated) {
      return errorResponse(res, 'Request not found or status update failed', 404);
    }

    const issueNo = updated.issue_no || (updated.id ? `PA-${updated.id}` : 'PA-1');

    // Trigger In-App Notifications and Email Dispatch matching IHLR pattern
    if (pool && updated) {
      try {
        const wasAlreadyClosed = String(existing?.status || '').toUpperCase() === 'CLOSED';
        const isNowClosed = String(updated.status || '').toUpperCase() === 'CLOSED';
        const isClosed = isNowClosed && !wasAlreadyClosed;
        let authUser = req.user;
        if (!authUser) {
          const authHeader = req.headers.authorization;
          if (authHeader && authHeader.startsWith('Bearer ')) {
            try {
              authUser = verifyToken(authHeader.split(' ')[1]);
            } catch {}
          }
        }
        const closerName = 
          (body.closer_updated_by && !String(body.closer_updated_by).toLowerCase().includes('temporary closed') && String(body.closer_updated_by).trim()) ||
          (authUser?.name && !String(authUser.name).toLowerCase().includes('temporary closed') && String(authUser.name).trim()) ||
          (body.approved_by && !String(body.approved_by).toLowerCase().includes('temporary closed') && String(body.approved_by).trim()) ||
          (updated.executor && String(updated.executor).trim()) ||
          (existing?.executor && String(existing.executor).trim()) ||
          'Assigned Executor';
        const closerDept = updated.department || authUser?.department || req.user?.department || 'PRODUCTION';

        // Fetch Quality Admin users from DB
        let adminUsers = [];
        const [aRows] = await pool.query(
          "SELECT id, name, email FROM users WHERE UPPER(role) = 'ADMIN' OR UPPER(department) = 'QAD'"
        ).catch(() => [[]]);
        if (aRows && aRows.length > 0) {
          adminUsers = aRows;
        } else {
          adminUsers = [{ id: null, name: 'Quality Admin', email: 'admin@gmail.com' }];
        }

        // Resolve Creator User details
        let creatorEmail = updated.created_by_email || null;
        let creatorName = updated.created_by || 'Quality Auditor';
        let creatorId = updated.created_by_id || null;
        if (pool && (!creatorEmail || !creatorId)) {
          const [crRows] = await pool.query(
            'SELECT id, name, email FROM users WHERE id = ? OR LOWER(TRIM(name)) = LOWER(TRIM(?)) LIMIT 1',
            [creatorId || 0, creatorName]
          ).catch(() => [[]]);
          if (crRows && crRows.length > 0) {
            creatorId = crRows[0].id;
            creatorEmail = crRows[0].email;
            creatorName = crRows[0].name;
          }
        }

        if (isClosed) {
          // SCENARIO 2: CASE CLOSED by Admin
          // Build a deduplicated map of unique recipients so that no person receives duplicate notifications.
          const recipientsMap = new Map();

          const addRecipient = (userId, userName, userEmail, link) => {
            const cleanEmail = userEmail ? String(userEmail).trim().toLowerCase() : '';
            const cleanName = userName ? String(userName).trim().toLowerCase() : '';
            const cleanId = userId ? String(userId).trim() : '';

            const key = cleanId ? `id_${cleanId}` : (cleanEmail ? `email_${cleanEmail}` : `name_${cleanName}`);
            if (!key) return;

            for (const [_, ex] of recipientsMap) {
              if (cleanId && ex.user_id && String(ex.user_id) === cleanId) return;
              if (cleanEmail && ex.user_email && String(ex.user_email).toLowerCase() === cleanEmail) return;
              if (cleanName && ex.user_name && String(ex.user_name).toLowerCase() === cleanName) return;
            }

            recipientsMap.set(key, {
              user_id: userId || null,
              user_name: userName || 'User',
              user_email: userEmail || '',
              link: link || '/process-audit/approvals'
            });
          };

          // 1. Requester / Creator
          if (creatorId || creatorName || creatorEmail) {
            addRecipient(creatorId, creatorName, creatorEmail, '/process-audit/all-requests');
          }

          // 2. Assigned Executor(s)
          const closedCloserNames = (updated.executor || '')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
          if (closedCloserNames.length > 0) {
            const placeholders = closedCloserNames.map(() => '?').join(',');
            const [closerRows] = await pool.query(
              `SELECT id, name, email FROM users WHERE LOWER(TRIM(name)) IN (${placeholders})`,
              closedCloserNames.map((n) => n.toLowerCase())
            ).catch(() => [[]]);
            if (closerRows && closerRows.length > 0) {
              for (const cUser of closerRows) {
                addRecipient(cUser.id, cUser.name, cUser.email, '/process-audit/approvals');
              }
            }
          }

          // 3. Quality Admin users
          for (const admin of adminUsers) {
            addRecipient(admin.id, admin.name, admin.email, '/process-audit/approvals');
          }

          // Insert exactly one notification per unique recipient into DB
          for (const [_, recipient] of recipientsMap) {
            const [existingRows] = await pool.query(
              `SELECT id FROM process_audit_notifications 
               WHERE request_id = ? AND type = 'case_closed' 
                 AND (
                   (? IS NOT NULL AND user_id = ?) OR 
                   (? != '' AND LOWER(TRIM(user_email)) = LOWER(TRIM(?)))
                 ) LIMIT 1`,
              [
                updated.id || id,
                recipient.user_id, recipient.user_id,
                recipient.user_email, recipient.user_email
              ]
            ).catch(() => [[]]);

            if (!existingRows || existingRows.length === 0) {
              await pool.query(
                `INSERT INTO process_audit_notifications 
                 (user_id, user_name, user_email, request_id, issue_no, type, title, message, link, is_read) 
                 VALUES (?, ?, ?, ?, ?, 'case_closed', ?, ?, ?, 0)`,
                [
                  recipient.user_id,
                  recipient.user_name,
                  recipient.user_email,
                  updated.id || id,
                  issueNo,
                  `Process Audit Case Closed: #${issueNo}`,
                  `Process Audit finding #${issueNo} (${updated.model || 'Process'}) has been verified and marked as CLOSED.`,
                  recipient.link
                ]
              ).catch((e) => console.warn('[Process Audit Case Closed Notif Error]:', e.message));
            }
          }

          // Mark pending assignment and sign-off notifications as read for this closed request
          await pool.query(
            `UPDATE process_audit_notifications 
             SET is_read = 1 
             WHERE (request_id = ? OR issue_no = ?) AND type IN ('assignment_required', 'approval_required', 'closer_completed_pending_review', 'closer_completed_pending_admin_signoff')`,
            [updated.id, issueNo]
          ).catch(() => {});

          // Dispatch Case Closed emails
          try {
            sendProcessAuditCloserEmails({
              request: updated,
              closerUser: req.user,
              creatorUser: {
                id: creatorId,
                name: creatorName,
                email: creatorEmail
              },
              assignedUser: {
                name: updated.executor,
                email: updated.executor_email,
                department: updated.department
              },
              adminUsers
            }).catch((mailErr) => console.warn('[Process Audit Mailer] Case closed email dispatch warning:', mailErr.message));
          } catch (mailSyncErr) {
            console.warn('[Process Audit Mailer] Sync case closed email dispatch warning:', mailSyncErr.message);
          }

        } else if (
          body.is_reassign || body.isReassign || details?.is_reassign ||
          (String(status).toLowerCase() === 'pending' &&
           !body.temporary_action && !body.permanent_fix && !body.prod_why_why &&
           !details.temporary_action && !details.permanent_fix && !details.prod_why_why &&
           !details.corrective_action)
        ) {
          // Reassignment or status transition without closer countermeasure submission; do not trigger closer submission notifications
        } else if (
          body.temporary_action || body.permanent_fix || body.prod_why_why ||
          details.temporary_action || details.permanent_fix || details.prod_why_why ||
          details.corrective_action ||
          String(status).toLowerCase().includes('progress') ||
          String(status).toLowerCase().includes('approval') ||
          String(status).toLowerCase().includes('review')
        ) {
          // SCENARIO 3: CLOSER DETAILS SUBMITTED (Countermeasures & 5-Why)
          // Mark the executor's previous pending assignment/approval notification as read
          await pool.query(
            `UPDATE process_audit_notifications 
             SET is_read = 1 
             WHERE (request_id = ? OR issue_no = ?) AND type IN ('assignment_required', 'approval_required')`,
            [updated.id, issueNo]
          ).catch(() => {});

          // Notification A: For Raised Person (Requester) to complete pending review
          if (creatorId || creatorName || creatorEmail) {
            await pool.query(
              `INSERT INTO process_audit_notifications 
               (user_id, user_name, user_email, request_id, issue_no, type, title, message, link, is_read) 
               VALUES (?, ?, ?, ?, ?, 'closer_completed_pending_review', ?, ?, '/process-audit/approvals', 0)`,
              [
                creatorId,
                creatorName,
                creatorEmail || '',
                updated.id || id,
                issueNo,
                `Closer Actions Submitted #${issueNo}`,
                `Closer ${closerName} (${closerDept}) has completed 5-Why root cause analysis and corrective action for #${issueNo} (${updated.model || 'Process'}). Quality Admin review and closure sign-off pending.`
              ]
            ).catch((e) => console.warn('[PA Closer Review Notif Error]:', e.message));
          }

          // Notification B: For Quality Admins to review and sign-off pending fields
          for (const admin of adminUsers) {
            if (creatorEmail && admin.email && creatorEmail.toLowerCase() === admin.email.toLowerCase()) {
              continue;
            }
            await pool.query(
              `INSERT INTO process_audit_notifications 
               (user_id, user_name, user_email, request_id, issue_no, type, title, message, link, is_read) 
               VALUES (?, ?, ?, ?, ?, 'closer_completed_pending_admin_signoff', ?, ?, '/process-audit/approvals', 0)`,
              [
                admin.id || null,
                admin.name || 'Admin',
                admin.email || 'admin@gmail.com',
                updated.id || id,
                issueNo,
                `Admin Action Required: Pending Sign-Off #${issueNo}`,
                `Closer ${closerName} (${closerDept}) has completed actions for #${issueNo} (${updated.model || 'Process'}). Action required: Please enter validation remarks and update status to finalize closure.`
              ]
            ).catch((e) => console.warn('[PA Admin Notif Error]:', e.message));
          }

          // Notification C: For Each Closer / Assigned Person Individually (Acknowledgment)
          const closerNamesList = (updated.executor || closerName || '')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);

          const targetClosers = [];
          if (closerNamesList.length > 0) {
            const placeholders = closerNamesList.map(() => '?').join(',');
            const [uRows] = await pool.query(
              `SELECT id, name, email FROM users WHERE LOWER(TRIM(name)) IN (${placeholders})`,
              closerNamesList.map((n) => n.toLowerCase())
            ).catch(() => [[]]);
            if (uRows && uRows.length > 0) {
              targetClosers.push(...uRows);
            }
          }

          if (req.user?.id && !targetClosers.some((u) => String(u.id) === String(req.user.id))) {
            targetClosers.push({
              id: req.user.id,
              name: req.user.name,
              email: req.user.email
            });
          }

          if (targetClosers.length === 0 && (closerName || updated.executor)) {
            targetClosers.push({
              id: null,
              name: closerName || updated.executor,
              email: updated.executor_email || ''
            });
          }

          for (const cUser of targetClosers) {
            await pool.query(
              `INSERT INTO process_audit_notifications 
               (user_id, user_name, user_email, request_id, issue_no, type, title, message, link, is_read) 
               VALUES (?, ?, ?, ?, ?, 'countermeasure_saved', ?, ?, '/process-audit/approvals', 0)`,
              [
                cUser.id || null,
                cUser.name,
                cUser.email || '',
                updated.id || id,
                issueNo,
                `Closer Submission Acknowledged: #${issueNo}`,
                `Your 5-Why root cause analysis and corrective action for #${issueNo} (${updated.model || 'Process'}) have been submitted. The Auditor and Quality Admin have been alerted with notification & email to complete the pending validation remarks and status sign-off.`
              ]
            ).catch((e) => console.warn('[PA Closer Notif Error]:', e.message));
          }

          // Trigger Closer Email Dispatch to Requester, Quality Admins, and Closer
          try {
            sendProcessAuditCloserEmails({
              request: updated,
              closerUser: req.user,
              creatorUser: {
                id: creatorId,
                name: creatorName,
                email: creatorEmail
              },
              assignedUser: {
                name: updated.executor,
                email: updated.executor_email,
                department: updated.department
              },
              adminUsers
            }).catch((mailErr) => console.warn('[Process Audit Mailer] Closer email dispatch warning:', mailErr.message));
          } catch (mailSyncErr) {
            console.warn('[Process Audit Mailer] Sync closer email dispatch warning:', mailSyncErr.message);
          }
        }
      } catch (notifErr) {
        console.warn('[Process Audit Closer Notification Warning]:', notifErr.message);
      }
    }

    // Broadcast Realtime WebSocket Event
    broadcastEvent('process_audit:updated', updated);
    broadcastEvent('notifications:refresh', { module: 'process_audit', action: 'updated', id: updated.id, reqNo: issueNo });

    return successResponse(res, updated, `Request status updated to ${status}`);
  } catch (err) {
    return errorResponse(res, err.message);
  }
};

export const reassignRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body || {};
    const { new_department, new_executor, reason } = body;

    if (!new_department || !new_executor) {
      return errorResponse(res, 'New department and new executor are required for reassignment', 400);
    }

    const numericId = parseInt(String(id).replace(/\D/g, ''), 10) || id;
    const [existingRows] = await pool.query(
      'SELECT status FROM process_audit_requests WHERE id = ? OR issue_no = ?',
      [numericId, String(id)]
    ).catch(() => [[]]);
    const existing = existingRows?.[0] || null;
    if (existing && String(existing.status || '').toUpperCase() === 'CLOSED') {
      return errorResponse(res, 'This request is closed and cannot be reassigned or modified.', 403);
    }

    // Verify department authorization: Only QAD or ADMIN can reassign
    const userId = req.user?.id || body.reassigned_by_id;
    const userName = req.user?.name || body.reassigned_by;
    const userRole = (req.user?.role || body.role || '').toUpperCase();
    const userDept = (req.user?.department || body.user_department || '').toUpperCase();

    let isAuthorized = userRole === 'ADMIN' || userDept === 'QAD';
    if (!isAuthorized && (userId || userName)) {
      const [uRows] = await pool.query(
        'SELECT department, role FROM users WHERE id = ? OR LOWER(name) = LOWER(?) LIMIT 1',
        [userId || 0, userName || '']
      );
      if (uRows.length > 0) {
        const uD = (uRows[0].department || '').trim().toUpperCase();
        const uR = (uRows[0].role || '').trim().toUpperCase();
        if (uR === 'ADMIN' || uD === 'QAD') {
          isAuthorized = true;
        }
      }
    }

    if (!isAuthorized) {
      return errorResponse(
        res,
        'Access Denied: Only personnel from QAD or ADMIN are authorized to reassign requests.',
        403
      );
    }

    const reassignedByName = req.user?.name || body.reassigned_by || body.reviewed_by || 'Quality Auditor';
    const reassignedById = req.user?.id || body.reassigned_by_id || body.reviewed_by_id || null;
    const reassignedByEmail = req.user?.email || body.reassigned_by_email || body.reviewed_by_email || null;

    const result = await ProcessAuditRequest.reassign(id, {
      new_department,
      new_executor,
      reason,
      reassigned_by: reassignedByName,
      reassigned_by_id: reassignedById,
      reassigned_by_email: reassignedByEmail,
      reviewed_by: reassignedByName,
      reviewed_by_id: reassignedById,
      reviewed_by_email: reassignedByEmail
    });

    const updated = result.updated;
    const issueNo = updated.issue_no || (updated.id ? `PA-${updated.id}` : 'PA-1');

    // Notify new executor(s) and clean up old executor notification
    try {
      // Mark old executor pending assignment notifications as read
      await pool.query(
        `UPDATE process_audit_notifications 
         SET is_read = 1 
         WHERE (request_id = ? OR issue_no = ?) 
           AND type IN ('assignment_required', 'approval_required', 'assigned_to_pa', 'pa_reassigned', 'reassigned')`,
        [updated.id, issueNo]
      ).catch(() => {});

      // A. Send in-app notification and email to ALL newly selected assignee(s)
      const newNames = String(new_executor || '').split(',').map((s) => s.trim()).filter(Boolean);
      const targetUsers = [];

      if (newNames.length > 0) {
        for (const nameItem of newNames) {
          let [nuRows] = await pool.query(
            'SELECT id, name, email, department, role FROM users WHERE (LOWER(TRIM(name)) = LOWER(TRIM(?)) OR LOWER(TRIM(email)) = LOWER(TRIM(?))) AND UPPER(TRIM(department)) = UPPER(TRIM(?)) LIMIT 1',
            [nameItem, nameItem, new_department]
          ).catch(() => [[]]);
          if (!nuRows || nuRows.length === 0) {
            [nuRows] = await pool.query(
              'SELECT id, name, email, department, role FROM users WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) OR LOWER(TRIM(email)) = LOWER(TRIM(?)) LIMIT 1',
              [nameItem, nameItem]
            ).catch(() => [[]]);
          }
          if (nuRows && nuRows.length > 0) {
            targetUsers.push(nuRows[0]);
          } else {
            targetUsers.push({
              id: null,
              name: nameItem,
              email: `${nameItem.toLowerCase().replace(/\s+/g, '')}@gmail.com`,
              department: new_department
            });
          }
        }
      } else {
        const [deptRows] = await pool.query(
          'SELECT id, name, email FROM users WHERE UPPER(TRIM(department)) = UPPER(TRIM(?))',
          [new_department]
        ).catch(() => [[]]);
        if (deptRows && deptRows.length > 0) {
          targetUsers.push(...deptRows);
        }
      }

      const reasonText = reason ? ` Reason: "${reason}"` : '';

      for (const u of targetUsers) {
        await pool.query(
          `INSERT INTO process_audit_notifications 
           (user_id, user_name, user_email, request_id, issue_no, type, title, message, link, is_read) 
           VALUES (?, ?, ?, ?, ?, 'pa_reassigned', ?, ?, '/process-audit/approvals', 0)`,
          [
            u.id || null,
            u.name,
            u.email,
            updated.id || id,
            issueNo,
            `Action Required: Process Audit #${issueNo} Reassigned`,
            `Process Audit report #${issueNo} (${updated.model || 'Process'}) has been reassigned to you for ${new_department} by ${reassignedByName}.${reasonText} Please inspect and submit root cause actions.`
          ]
        ).catch((e) => console.warn('[PA Reassign Notif Error]:', e.message));

        try {
          const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
          const tableData = [
            { label: 'Request Number', value: issueNo },
            { label: 'Product / Model', value: `${updated.product || '—'} (${updated.model || '—'})` },
            { label: 'Process / Operation', value: updated.process_operation || '—' },
            { label: 'New Department', value: new_department },
            { label: 'New Executor', value: u.name || new_executor },
            { label: 'Reassigned By', value: reassignedByName },
            { label: 'Reassignment Reason', value: reason || 'Department workflow reallocation' },
            { label: 'Status', value: 'Pending' }
          ];

          const execHtml = generateEmailTemplate({
            headerTitle: `Action Required: Process Audit #${issueNo} Reassigned`,
            headerSubtitle: `A process audit finding has been reassigned to you for investigation and corrective action.`,
            recipientName: u.name || new_executor,
            greetingMessage: `Process Audit report <strong>${issueNo}</strong> (${updated.model || 'Process'}) has been reassigned to you in <strong>${new_department}</strong> by <strong>${reassignedByName}</strong>.${reasonText ? `<br><br><strong>Reason:</strong> ${reason}` : ''}<br><br><strong>Current Status:</strong> <span style="display:inline-block; padding: 2px 8px; font-weight:700; background:#fef3c7; color:#b45309; border-radius:4px;">Pending</span>`,
            tableData,
            actionButtonText: 'Open Report & Submit Action',
            actionButtonUrl: `${baseUrl}/process-audit/approvals`,
            footerNote: 'Immediate action required: please inspect the process finding and record corrective containment measures in the portal.',
            badgeColor: '#f59e0b',
            badgeText: 'REASSIGNED'
          });

          const allCcEmails = Array.from(new Set(
            String(updated.notify_emails || '')
              .split(',')
              .map((s) => s.trim().toLowerCase())
              .filter((s) => s && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s))
          ));

          sendEmail({
            to: u.email || process.env.SMTP_USER || '',
            recipientName: u.name || new_executor || 'Assigned Closer',
            recipientRole: 'ASSIGNED_CLOSER',
            subject: `[Process Audit Action Required] Audit Finding #${issueNo} Reassigned to You (${new_department}) - Pending`,
            text: `Dear ${u.name || 'Team Member'},\n\nProcess Audit report #${issueNo} (${updated.model || 'Process'}) has been reassigned to you (${new_department}) by ${reassignedByName}.${reasonText}\n\nPlease review and submit root cause analysis and containment actions at: ${baseUrl}/process-audit/approvals\n\nThank you,\nQuality Portal`,
            html: execHtml,
            referenceNo: issueNo,
            moduleType: 'PROCESS_AUDIT',
            requestId: updated.id,
            cc: allCcEmails
          }).catch((err) => console.warn('[PA Reassign Mail Warning]:', err.message));
        } catch (mErr) {
          console.warn('[PA Reassign Mail Sync Warning]:', mErr.message);
        }
      }

      // B. Notify Creator / Requester about the reassignment
      let creatorEmail = updated.created_by_email || null;
      let creatorName = updated.created_by || 'Quality Requester';
      let creatorId = updated.created_by_id || null;
      if (pool && (!creatorEmail || !creatorId)) {
        const [crRows] = await pool.query(
          'SELECT id, name, email FROM users WHERE id = ? OR LOWER(TRIM(name)) = LOWER(TRIM(?)) LIMIT 1',
          [creatorId || 0, creatorName]
        ).catch(() => [[]]);
        if (crRows && crRows.length > 0) {
          creatorId = crRows[0].id;
          creatorEmail = crRows[0].email;
          creatorName = crRows[0].name;
        }
      }

      if (creatorId || creatorName || creatorEmail) {
        await pool.query(
          `INSERT INTO process_audit_notifications 
           (user_id, user_name, user_email, request_id, issue_no, type, title, message, link, is_read) 
           VALUES (?, ?, ?, ?, ?, 'reassigned', ?, ?, '/process-audit/all-requests', 0)`,
          [
            creatorId || null,
            creatorName,
            creatorEmail || '',
            updated.id || id,
            issueNo,
            `Process Audit Case Reassigned: #${issueNo}`,
            `Process Audit report #${issueNo} (${updated.model || 'Process'}) has been reassigned to ${new_executor} (${new_department}) by ${reassignedByName}.${reasonText}`
          ]
        ).catch((e) => console.warn('[PA Reassign Req Notif Error]:', e.message));

        try {
          const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
          const tableData = [
            { label: 'Request Number', value: issueNo },
            { label: 'Product / Model', value: `${updated.product || '—'} (${updated.model || '—'})` },
            { label: 'Process / Operation', value: updated.process_operation || '—' },
            { label: 'New Department', value: new_department },
            { label: 'New Executor', value: new_executor },
            { label: 'Reassigned By', value: reassignedByName },
            { label: 'Reassignment Reason', value: reason || 'Department workflow reallocation' },
            { label: 'Status', value: 'Pending' }
          ];

          const creatorHtml = generateEmailTemplate({
            headerTitle: `Process Audit Reassigned: #${issueNo}`,
            headerSubtitle: `Your process audit observation finding has been reassigned to a new department/executor.`,
            recipientName: creatorName || 'Quality Requester',
            greetingMessage: `Your Process Audit observation report <strong>${issueNo}</strong> (${updated.model || 'Process'}) has been reassigned to <strong>${new_executor}</strong> (<strong>${new_department}</strong>) by <strong>${reassignedByName}</strong>.${reasonText ? `<br><br><strong>Reason:</strong> ${reason}` : ''}`,
            tableData,
            actionButtonText: 'View Process Audit Requests',
            actionButtonUrl: `${baseUrl}/process-audit/all-requests`,
            footerNote: 'You will receive an update once the new department submits actions.',
            badgeColor: '#3b82f6',
            badgeText: 'REASSIGNED'
          });

          sendEmail({
            to: creatorEmail || process.env.SMTP_USER || '',
            recipientName: creatorName || 'Quality Requester',
            recipientRole: 'RAISED_PERSON',
            subject: `[Process Audit Notice] Request #${issueNo} Reassigned to ${new_executor} (${new_department})`,
            text: `Dear ${creatorName || 'Quality Requester'},\n\nYour Process Audit report #${issueNo} (${updated.model || 'Process'}) has been reassigned to ${new_executor} (${new_department}) by ${reassignedByName}.${reasonText}\n\nView details: ${baseUrl}/process-audit/all-requests\n\nThank you,\nQuality Portal`,
            html: creatorHtml,
            referenceNo: issueNo,
            moduleType: 'PROCESS_AUDIT',
            requestId: updated.id
          }).catch((err) => console.warn('[PA Reassign Req Mail Warning]:', err.message));
        } catch (mReqErr) {
          console.warn('[PA Reassign Req Mail Sync Warning]:', mReqErr.message);
        }
      }
    } catch (notifErr) {
      console.warn('[Process Audit Reassignment Notifications Warning]:', notifErr.message);
    }

    // Broadcast Realtime WebSocket Event
    broadcastEvent('process_audit:reassigned', updated);
    broadcastEvent('notifications:refresh', { module: 'process_audit', action: 'reassigned', id: updated.id, reqNo: issueNo });

    return successResponse(res, updated, 'Request reassigned successfully. Notifications and emails dispatched.');
  } catch (err) {
    return errorResponse(res, err.message);
  }
};

export const updateRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body || {};

    const authHeader = req.headers.authorization;
    let tokenUser = null;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        tokenUser = verifyToken(authHeader.split(' ')[1]);
      } catch {}
    }
    const userRole = (body.user?.role || tokenUser?.role || req.user?.role || '').trim().toUpperCase();
    const userDept = (body.user?.department || tokenUser?.department || req.user?.department || '').trim().toUpperCase();
    const isAdmin = userRole === 'ADMIN' || userDept === 'QAD';
    if (!isAdmin) {
      return errorResponse(res, 'Access denied. Edit mode is only permitted for Admin role.', 403);
    }

    const numericId = parseInt(String(id).replace(/\D/g, ''), 10) || id;
    const [existingRows] = await pool.query(
      'SELECT status FROM process_audit_requests WHERE id = ? OR issue_no = ?',
      [numericId, String(id)]
    ).catch(() => [[]]);
    const existing = existingRows?.[0] || null;
    if (existing && String(existing.status || '').toUpperCase() === 'CLOSED') {
      return errorResponse(res, 'This request is closed and cannot be edited.', 403);
    }

    if (body.escalation_date) {
      const escStr = String(body.escalation_date).split('T')[0];
      const todayStr = new Date().toISOString().split('T')[0];
      if (escStr > todayStr) {
        return errorResponse(res, 'Escalation Date cannot be a future date. Please select today or a past date.', 400);
      }
    }

    let parsedAttachments = undefined;
    if (body.attachments !== undefined) {
      if (typeof body.attachments === 'string') {
        try {
          parsedAttachments = JSON.parse(body.attachments);
        } catch {
          parsedAttachments = [];
        }
      } else if (Array.isArray(body.attachments)) {
        parsedAttachments = body.attachments;
      }
    }

    if (req.files && req.files.length > 0) {
      const uploadedFiles = [];
      for (const file of req.files) {
        const saved = await Attachment.saveAttachment(file);
        uploadedFiles.push(saved);
      }
      parsedAttachments = [...(parsedAttachments || []), ...uploadedFiles];
    }

    let parsedActionAttachments = undefined;
    if (body.action_attachments !== undefined) {
      if (typeof body.action_attachments === 'string') {
        try {
          parsedActionAttachments = JSON.parse(body.action_attachments);
        } catch {
          parsedActionAttachments = [];
        }
      } else if (Array.isArray(body.action_attachments)) {
        parsedActionAttachments = body.action_attachments;
      }
    }

    const updates = { ...body };
    if (updates.model) updates.model = String(updates.model).trim();
    if (updates.product) updates.product = String(updates.product).trim();
    if (updates.process_operation) updates.process_operation = String(updates.process_operation).trim();
    if (updates.issue_observation) updates.issue_observation = String(updates.issue_observation).trim();
    if (updates.comments) updates.comments = String(updates.comments).trim();
    if (parsedAttachments !== undefined) updates.attachments = parsedAttachments;
    if (parsedActionAttachments !== undefined) updates.action_attachments = parsedActionAttachments;

    const updated = await ProcessAuditRequest.update(id, updates);
    if (!updated) {
      return errorResponse(res, 'Process Audit Request not found', 404);
    }

    broadcastEvent('process_audit:updated', updated);
    broadcastEvent('notifications:refresh', { module: 'process_audit', action: 'updated', id: updated.id });

    return successResponse(res, updated, 'Process Audit Request updated successfully');
  } catch (err) {
    return errorResponse(res, err.message);
  }
};

export const getProcessAuditEmailLogs = async (req, res) => {
  try {
    if (!pool) return successResponse(res, []);
    const [rows] = await pool.query(
      `SELECT id, module_type, request_id, reference_no, recipient_role, recipient_name, recipient_email, subject, delivery_status, smtp_response, error_message, sent_at 
       FROM email_logs 
       WHERE module_type = 'PROCESS_AUDIT' 
       ORDER BY id DESC LIMIT 50`
    );
    return successResponse(res, rows || [], 'Process Audit Email logs retrieved');
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

export const testProcessAuditEmail = async (req, res) => {
  try {
    const to = req.body?.to || process.env.SMTP_USER || '';
    const recipientName = req.body?.name || 'Process Audit Tester';
    const html = generateEmailTemplate({
      headerTitle: 'INEL Process Audit Portal Diagnostic',
      headerSubtitle: 'Outbound SMTP Verification Test',
      recipientName,
      greetingMessage: 'This is an automated test notification dispatched from the INEL Process Audit Quality Management Portal to verify outbound email delivery and template formatting.',
      tableData: [
        { label: 'SMTP Host', value: process.env.SMTP_HOST || 'localhost' },
        { label: 'Sender Account', value: process.env.SMTP_USER || 'Environment Config' },
        { label: 'Dispatched At', value: new Date().toLocaleString() }
      ],
      badgeColor: '#10b981',
      badgeText: 'TEST EMAIL'
    });
    const result = await sendEmail({
      to,
      recipientName,
      recipientRole: 'TESTER',
      subject: '[INEL Process Audit Portal] Test Email Notification',
      text: 'This is a test notification from INEL Process Audit Quality Management Portal using configured SMTP credentials.',
      html,
      moduleType: 'PROCESS_AUDIT',
      referenceNo: 'TEST-PA-001'
    });
    return successResponse(res, result, 'Test email dispatch executed');
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};




// Universal aliases matching IHLR convention
export const getProcessAuditRequests = getAllRequests;
export const createProcessAuditRequest = createRequest;
export const updateProcessAuditRequest = updateRequest;
export const getNextReqNo = getNextId;
export const getDashboardStats = getDashboardMetrics;
export const getProcessAuditNotifications = getNotifications;
export const markProcessAuditNotificationRead = markAsRead;
export const markProcessAuditNotificationUnread = markAsUnread;
export const markAllProcessAuditNotificationsRead = markAllAsRead;
