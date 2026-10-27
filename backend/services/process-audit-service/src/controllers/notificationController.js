import pool from '../../../shared/db.js';
import { successResponse, errorResponse } from '../../../shared/response.js';
import { broadcastEvent } from '../../../shared/realtimeNotifier.js';
import { ProcessAuditRequest } from '../models/Request.js';

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
      conditions.push("type = 'submission_confirmed'");
      conditions.push("type = 'case_closed'");
      conditions.push("type = 'reassigned'");
      conditions.push("type = 'approval_required'");
      conditions.push("type = 'assignment_required'");
      conditions.push("type = 'countermeasure_saved'");
    }

    if (conditions.length > 0) {
      query += ` WHERE (${conditions.join(' OR ')})`;
    } else if (!isAdmin) {
      return successResponse(res, [], 'Process Audit notifications retrieved');
    }

    query += ` ORDER BY id DESC LIMIT 50`;

    const [rows] = await pool.query(query, params).catch(() => [[]]);
    const rawRows = rows || [];

    // Deduplicate so that no user receives duplicate notifications for the same request and event type
    const seen = new Set();
    notifRows = rawRows.filter((r) => {
      const key = `${r.request_id || r.issue_no}_${r.type}`;
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
          msg = `Request #${r.issue_no} has countermeasures submitted and is pending sign-off.`;
          badgeLabel = 'PENDING SIGN-OFF';
          accentColor = 'amber';
        } else if (isRejected) {
          title = `Request Needs Attention: #${r.issue_no}`;
          msg = `Audit request #${r.issue_no} could not be signed off by ${r.executor}.`;
          badgeLabel = 'CORRECTION NEEDED';
          accentColor = 'rose';
        } else {
          title = `Action Required: Process Audit #${r.issue_no}`;
          msg = `Audit request #${r.issue_no} (${r.department}) assigned to ${r.executor} for root cause countermeasures.`;
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
      const isReassigned = n.type === 'reassigned' || n.type === 'pa_reassigned';
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
        badgeLabel = 'COUNTERMEASURE SUBMITTED';
        accentColor = 'indigo';
        footerFlag = 'OPERATIONAL_UPDATE';
        dept = 'PRODUCTION';
      } else if (isReassigned) {
        badgeLabel = 'REASSIGNED';
        accentColor = 'purple';
        footerFlag = 'OPERATIONAL_UPDATE';
        dept = 'QUALITY AUDIT';
      } else if (isApproval) {
        badgeLabel = 'ACTION REQUIRED';
        accentColor = 'amber';
        footerFlag = 'ACTION_REQUIRED';
        dept = 'PRODUCTION';
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
        title: n.title,
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
           type IN ('approval_required', 'assignment_required', 'request_approved', 'request_closed', 'case_closed', 'request_rejected', 'reassigned', 'request_created', 'submission_confirmed', 'closer_completed_pending_review', 'closer_completed_pending_admin_signoff', 'countermeasure_saved')`,
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
