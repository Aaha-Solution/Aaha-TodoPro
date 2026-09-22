import pool from '../../../shared/db.js';
import { successResponse, errorResponse } from '../../../shared/response.js';

export const getNotifications = async (req, res) => {
  try {
    if (!pool) throw new Error('Database pool not available');
    const [requests] = await pool.query(
      'SELECT id, stage, line, status, updated_at FROM process_audit_requests ORDER BY updated_at DESC LIMIT 10'
    );
    const notifications = requests.map((r, idx) => ({
      id: idx + 1,
      title: `Request ${r.id}: ${r.status}`,
      message: `Production request ${r.id} for ${r.line} (${r.stage}) is currently marked as ${r.status}.`,
      date: r.updated_at 
        ? new Date(r.updated_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
        : 'Recent',
      read: false
    }));
    return successResponse(res, notifications);
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};
