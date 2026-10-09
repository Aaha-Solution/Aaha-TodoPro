import pool from '../../../shared/db.js';
import { successResponse, errorResponse } from '../../../shared/response.js';
import { broadcastEvent } from '../../../shared/realtimeNotifier.js';

// Auto-ensure process_audit_notifications table exists
const ensureNotificationTable = async () => {
  if (!pool) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS process_audit_notifications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NULL,
        user_name VARCHAR(100) NOT NULL,
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
    const userId = req.query.user_id || req.user?.id || null;
    const userRole = (req.query.role || req.user?.role || '').trim().toUpperCase();
    const userDept = (req.query.department || req.user?.department || '').trim().toUpperCase();
    const isAdmin = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN' || userRole === 'SUPER ADMIN' || userDept === 'INCOMING QUALITY';

    // Auto-sync any unnotified assigned pending requests from process_audit_requests
    await pool.query(`
      INSERT INTO process_audit_notifications (user_name, user_id, request_id, issue_no, type, title, message, link)
      SELECT 
        r.executor, 
        u.id,
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
          WHERE n.request_id = r.id AND LOWER(TRIM(n.user_name)) = LOWER(TRIM(r.executor))
        )
    `).catch(() => {});

    if (!isAdmin && !userName && !userId) {
      return successResponse(res, []);
    }

    let query = `SELECT * FROM process_audit_notifications`;
    const params = [];

    if (!isAdmin) {
      if (userName && userId) {
        query += ` WHERE (LOWER(TRIM(user_name)) = LOWER(TRIM(?)) OR user_id = ?)`;
        params.push(userName, userId);
      } else if (userName) {
        query += ` WHERE LOWER(TRIM(user_name)) = LOWER(TRIM(?))`;
        params.push(userName);
      } else if (userId) {
        query += ` WHERE user_id = ?`;
        params.push(userId);
      }
    }

    query += ` ORDER BY id DESC LIMIT 50`;

    const [rows] = await pool.query(query, params);

    const formatted = rows.map((n) => {
      const d = n.created_at ? new Date(n.created_at) : new Date();
      return {
        id: n.id,
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
        requestId: n.issue_no,
        type: n.type,
        link: n.link || '/process-audit/approvals',
        read: Boolean(n.is_read),
      };
    });

    return successResponse(res, formatted);
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

export const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('UPDATE process_audit_notifications SET is_read = 1 WHERE id = ?', [id]);
    broadcastEvent('notifications:refresh', { module: 'process_audit', action: 'read', id });
    return successResponse(res, { id }, 'Notification marked as read');
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

export const markAllAsRead = async (req, res) => {
  try {
    const userName = (req.body.user || req.query.user || req.user?.name || '').trim();
    if (userName) {
      await pool.query('UPDATE process_audit_notifications SET is_read = 1 WHERE LOWER(TRIM(user_name)) = LOWER(TRIM(?))', [userName]);
    } else {
      await pool.query('UPDATE process_audit_notifications SET is_read = 1');
    }
    broadcastEvent('notifications:refresh', { module: 'process_audit', action: 'mark_all_read', userName });
    return successResponse(res, null, 'All notifications marked as read');
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};
