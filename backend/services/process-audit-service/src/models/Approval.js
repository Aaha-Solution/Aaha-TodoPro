import pool from '../../../shared/db.js';

// Auto-ensure table structure for separate approvals audit trail
export const ensureApprovalsTable = async () => {
  if (!pool) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS process_audit_approvals (
        id INT AUTO_INCREMENT PRIMARY KEY,
        request_id INT NOT NULL,
        issue_no VARCHAR(50) NOT NULL,
        approved_by VARCHAR(100) NOT NULL,
        approved_by_id INT NULL,
        approved_by_email VARCHAR(100) NULL,
        approved_by_role VARCHAR(50) NULL,
        department VARCHAR(100) NULL,
        executor VARCHAR(100) NULL,
        root_cause TEXT NULL,
        corrective_action TEXT NULL,
        action_attachments JSON NULL,
        standardization_details TEXT NULL,
        target_date VARCHAR(50) NULL,
        status VARCHAR(50) DEFAULT 'Approved',
        comments TEXT NULL,
        approved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_request_id (request_id),
        INDEX idx_issue_no (issue_no),
        INDEX idx_approved_by (approved_by)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('[Process Audit Service] process_audit_approvals table verified.');
  } catch (err) {
    console.warn('[Process Audit Service] ensureApprovalsTable warning:', err.message);
  }
};

ensureApprovalsTable();

export const Approval = {
  createApproval: async (data) => {
    if (!pool) throw new Error('Database pool not available');
    await ensureApprovalsTable();

    const requestId = data.request_id || data.requestId;
    const issueNo = data.issue_no || data.issueNo || (requestId ? `PA-${requestId}` : 'PA-1');
    const approvedBy = data.approved_by || data.approvedBy || data.action_taken_by || 'Assigned Executor';
    const approvedById = data.approved_by_id || data.approvedById || null;
    const approvedByEmail = data.approved_by_email || data.approvedByEmail || null;
    const approvedByRole = data.approved_by_role || data.approvedByRole || null;
    const department = data.department || null;
    const executor = data.executor || null;
    const rootCause = data.root_cause || data.rootCause || null;
    const correctiveAction = data.corrective_action || data.correctiveAction || null;
    const actionAttachments = data.action_attachments !== undefined
      ? (typeof data.action_attachments === 'string' ? data.action_attachments : JSON.stringify(data.action_attachments))
      : null;
    const standardizationDetails = data.standardization_details || data.standardizationDetails || null;
    const targetDate = data.target_date || data.targetDate || null;
    const status = data.status || 'Approved';
    const comments = data.comments || null;

    const query = `
      INSERT INTO process_audit_approvals
      (request_id, issue_no, approved_by, approved_by_id, approved_by_email, approved_by_role, department, executor, root_cause, corrective_action, action_attachments, standardization_details, target_date, status, comments, approved_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `;

    const [res] = await pool.query(query, [
      requestId,
      issueNo,
      approvedBy,
      approvedById,
      approvedByEmail,
      approvedByRole,
      department,
      executor,
      rootCause,
      correctiveAction,
      actionAttachments,
      standardizationDetails,
      targetDate,
      status,
      comments,
    ]);

    const [rows] = await pool.query(`SELECT * FROM process_audit_approvals WHERE id = ?`, [res.insertId]);
    return rows[0];
  },

  getApprovals: async (filters = {}) => {
    if (!pool) throw new Error('Database pool not available');
    await ensureApprovalsTable();

    let query = `SELECT * FROM process_audit_approvals WHERE 1=1`;
    const params = [];

    if (filters.requestId || filters.request_id) {
      query += ` AND request_id = ?`;
      params.push(filters.requestId || filters.request_id);
    }
    if (filters.issueNo || filters.issue_no) {
      query += ` AND issue_no = ?`;
      params.push(filters.issueNo || filters.issue_no);
    }
    if (filters.approvedBy || filters.approved_by) {
      query += ` AND LOWER(approved_by) = LOWER(?)`;
      params.push(filters.approvedBy || filters.approved_by);
    }

    query += ` ORDER BY approved_at DESC, id DESC`;

    const [rows] = await pool.query(query, params);
    return rows;
  },

  getApprovalByRequestId: async (requestId) => {
    if (!pool) throw new Error('Database pool not available');
    await ensureApprovalsTable();

    const [rows] = await pool.query(
      `SELECT * FROM process_audit_approvals WHERE request_id = ? OR issue_no = ? ORDER BY approved_at DESC LIMIT 1`,
      [requestId, String(requestId)]
    );
    return rows[0] || null;
  },
};

export default Approval;
