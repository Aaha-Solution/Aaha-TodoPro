import pool from '../../../shared/db.js';

// Auto-ensure table structure matches the actual form fields with INT AUTO_INCREMENT primary key
const ensureTable = async () => {
  if (!pool) return;
  try {
    const [cols] = await pool.query(`SHOW COLUMNS FROM process_audit_requests`).catch(() => [[]]);
    const colNames = cols.map((c) => c.Field);
    const idCol = cols.find((c) => c.Field === 'id');

    // If table exists but id is not AUTO_INCREMENT, migrate it
    if (idCol && (!idCol.Extra || !idCol.Extra.toLowerCase().includes('auto_increment'))) {
      const [rows] = await pool.query(`SELECT id FROM process_audit_requests`);
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const numericId = parseInt(String(row.id).replace(/\D/g, ''), 10) || (i + 1);
        await pool.query(`UPDATE process_audit_requests SET id = ?, issue_no = ? WHERE id = ?`, [numericId, String(numericId), row.id]);
      }
      await pool.query(`ALTER TABLE process_audit_requests MODIFY id INT AUTO_INCREMENT`);
    }

    // Ensure all existing rows have issue_no formatted with 'PA-'
    await pool.query(`UPDATE process_audit_requests SET issue_no = CONCAT('PA-', id) WHERE issue_no NOT LIKE 'PA-%'`).catch(() => {});

    // If existing table is empty and has obsolete columns, drop it
    if (cols.length > 0 && !colNames.includes('product')) {
      const [rows] = await pool.query(`SELECT COUNT(*) as count FROM process_audit_requests`).catch(() => [[{ count: 0 }]]);
      if (rows[0]?.count === 0) {
        await pool.query(`DROP TABLE IF EXISTS process_audit_requests`);
      }
    }

    // Ensure created_by and created_by_id columns exist in MySQL without default value
    if (!colNames.includes('created_by')) {
      await pool.query(`ALTER TABLE process_audit_requests ADD COLUMN created_by VARCHAR(100) NULL`).catch(() => {});
    }
    if (!colNames.includes('created_by_id')) {
      await pool.query(`ALTER TABLE process_audit_requests ADD COLUMN created_by_id INT NULL`).catch(() => {});
    }

    // Ensure executor resolution columns exist in MySQL
    if (!colNames.includes('root_cause')) {
      await pool.query(`ALTER TABLE process_audit_requests ADD COLUMN root_cause TEXT NULL`).catch(() => {});
    }
    if (!colNames.includes('corrective_action')) {
      await pool.query(`ALTER TABLE process_audit_requests ADD COLUMN corrective_action TEXT NULL`).catch(() => {});
    }
    if (!colNames.includes('action_attachments')) {
      await pool.query(`ALTER TABLE process_audit_requests ADD COLUMN action_attachments JSON NULL`).catch(() => {});
    }
    if (!colNames.includes('standardization_details')) {
      await pool.query(`ALTER TABLE process_audit_requests ADD COLUMN standardization_details TEXT NULL`).catch(() => {});
    }
    if (!colNames.includes('target_date')) {
      await pool.query(`ALTER TABLE process_audit_requests ADD COLUMN target_date VARCHAR(50) NULL`).catch(() => {});
    }
    if (!colNames.includes('action_taken_by')) {
      await pool.query(`ALTER TABLE process_audit_requests ADD COLUMN action_taken_by VARCHAR(100) NULL`).catch(() => {});
    }
    if (!colNames.includes('action_taken_at')) {
      await pool.query(`ALTER TABLE process_audit_requests ADD COLUMN action_taken_at TIMESTAMP NULL`).catch(() => {});
    }

    // Drop any existing defaults on MySQL columns
    await pool.query(`ALTER TABLE process_audit_requests MODIFY issue_type VARCHAR(50) NULL`).catch(() => {});
    await pool.query(`ALTER TABLE process_audit_requests MODIFY priority VARCHAR(50) NULL`).catch(() => {});
    await pool.query(`ALTER TABLE process_audit_requests MODIFY created_by VARCHAR(100) NULL`).catch(() => {});

    await pool.query(`
      CREATE TABLE IF NOT EXISTS process_audit_requests (
        id INT AUTO_INCREMENT PRIMARY KEY,
        issue_no VARCHAR(50) NOT NULL,
        escalation_date DATE NOT NULL,
        product VARCHAR(100) NOT NULL,
        model VARCHAR(100) NOT NULL,
        process_operation VARCHAR(100) NOT NULL,
        shift VARCHAR(50) NOT NULL,
        issue_type VARCHAR(50),
        priority VARCHAR(50),
        issue_observation TEXT,
        attachments JSON,
        department VARCHAR(100) NOT NULL,
        executor VARCHAR(100) NOT NULL,
        comments TEXT,
        status VARCHAR(50) DEFAULT 'Pending Execution',
        root_cause TEXT,
        corrective_action TEXT,
        action_attachments JSON,
        standardization_details TEXT,
        target_date VARCHAR(50),
        action_taken_by VARCHAR(100),
        action_taken_at TIMESTAMP NULL,
        created_by VARCHAR(100),
        created_by_id INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    // Ensure existing rows without created_by get populated if created_by_id exists
    await pool.query(`
      UPDATE process_audit_requests r
      JOIN users u ON r.created_by_id = u.id
      SET r.created_by = COALESCE(u.name, u.email)
      WHERE r.created_by IS NULL OR TRIM(r.created_by) = ''
    `).catch(() => {});
  } catch (err) {
    console.warn('[process_audit_requests] Table structure sync notice:', err.message);
  }
};
ensureTable();

export const ProcessAuditRequest = {
  findAll: async (filters = {}) => {
    if (!pool) throw new Error('Database connection pool is not available');
    let query = `
      SELECT r.*, COALESCE(NULLIF(TRIM(r.created_by), ''), u.name, u.email) AS created_by
      FROM process_audit_requests r
      LEFT JOIN users u ON r.created_by_id = u.id
    `;
    const conditions = [];
    const params = [];

    // Filter by creator
    if (filters.created_by_id && filters.created_by) {
      conditions.push(`(r.created_by_id = ? OR LOWER(r.created_by) = LOWER(?))`);
      params.push(filters.created_by_id, filters.created_by);
    } else if (filters.created_by_id) {
      conditions.push(`r.created_by_id = ?`);
      params.push(filters.created_by_id);
    } else if (filters.created_by) {
      conditions.push(`LOWER(r.created_by) = LOWER(?)`);
      params.push(filters.created_by);
    }

    // Filter by executor (exact match or full-word boundary)
    if (filters.executor) {
      conditions.push(`(LOWER(TRIM(r.executor)) = LOWER(TRIM(?)) OR LOWER(r.executor) REGEXP CONCAT('(^|[^a-zA-Z0-9])', ?, '([^a-zA-Z0-9]|$)'))`);
      params.push(filters.executor, filters.executor);
    }

    // Filter by general user (either creator OR executor)
    if (filters.user) {
      conditions.push(`(
        r.created_by_id = ? 
        OR LOWER(TRIM(r.created_by)) = LOWER(TRIM(?)) 
        OR LOWER(TRIM(r.executor)) = LOWER(TRIM(?))
        OR LOWER(r.executor) REGEXP CONCAT('(^|[^a-zA-Z0-9])', ?, '([^a-zA-Z0-9]|$)')
      )`);
      params.push(
        filters.user_id || 0,
        filters.user,
        filters.user,
        filters.user
      );
    }

    if (conditions.length > 0) {
      query += ` WHERE ` + conditions.join(' AND ');
    }

    query += ` ORDER BY r.id DESC`;

    const [rows] = await pool.query(query, params);
    return rows;
  },

  getNextId: async () => {
    if (!pool) return '1';
    try {
      const [rows] = await pool.query('SELECT COALESCE(MAX(id), 0) + 1 AS nextId FROM process_audit_requests');
      const nextId = rows?.[0]?.nextId;
      return String(nextId || 1);
    } catch (err) {
      console.warn('Could not calculate next ID:', err.message);
      return '1';
    }
  },

  create: async (data) => {
    if (!pool) throw new Error('Database connection pool is not available');
    const escalation_date = data.escalation_date || data.date || new Date().toISOString().split('T')[0];
    const product = data.product || data.unit || 'Standard';
    const model = data.model || data.stage || 'Standard';
    const process_operation = data.process_operation || data.processOperation || data.line || 'General';
    const shift = data.shift || 'General';
    const issue_type = data.issue_type !== undefined ? data.issue_type : (data.issueType !== undefined ? data.issueType : null);
    const priority = data.priority !== undefined ? data.priority : null;
    const issue_observation = data.issue_observation || data.issueObservation || '';
    const attachments = JSON.stringify(data.attachments || []);
    const department = data.department || 'PRODUCTION';
    const executor = data.executor || 'Plant Lead';
    const comments = data.comments || '';
    const status = data.status || 'Pending Execution';
    const created_by = data.created_by || data.createdBy || data.creator_name || data.creator || null;
    const created_by_id = data.created_by_id || data.createdById || data.userId || null;

    // issue_no can be passed from frontend or match the auto-increment id
    let issue_no = data.issue_no || data.requestId || '';

    // Notice: id is omitted from the INSERT query so MySQL's AUTO_INCREMENT automatically assigns 1, 2, 3...
    const query = `
      INSERT INTO process_audit_requests 
      (issue_no, escalation_date, product, model, process_operation, shift, issue_type, priority, issue_observation, attachments, department, executor, comments, status, created_by, created_by_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const [result] = await pool.query(query, [
      issue_no || 'TEMP',
      escalation_date,
      product,
      model,
      process_operation,
      shift,
      issue_type,
      priority,
      issue_observation,
      attachments,
      department,
      executor,
      comments,
      status,
      created_by,
      created_by_id
    ]);

    const insertedId = result.insertId;

    if (!issue_no || issue_no === 'TEMP') {
      issue_no = `PA-${insertedId}`;
      await pool.query('UPDATE process_audit_requests SET issue_no = ? WHERE id = ?', [issue_no, insertedId]);
    }

    const [rows] = await pool.query('SELECT * FROM process_audit_requests WHERE id = ?', [insertedId]);
    return rows[0] || { id: insertedId, issue_no: issue_no || `PA-${insertedId}`, ...data };
  },

  updateStatus: async (id, status, details = {}) => {
    if (!pool) throw new Error('Database connection pool is not available');
    const numericId = parseInt(String(id).replace(/\D/g, ''), 10) || id;

    // Check if columns exist
    const [cols] = await pool.query(`SHOW COLUMNS FROM process_audit_requests`).catch(() => [[]]);
    const colNames = cols.map((c) => c.Field);
    if (!colNames.includes('rejection_reason')) {
      await pool.query(`ALTER TABLE process_audit_requests ADD COLUMN rejection_reason TEXT NULL`).catch(() => {});
    }
    if (!colNames.includes('root_cause')) {
      await pool.query(`ALTER TABLE process_audit_requests ADD COLUMN root_cause TEXT NULL`).catch(() => {});
    }
    if (!colNames.includes('corrective_action')) {
      await pool.query(`ALTER TABLE process_audit_requests ADD COLUMN corrective_action TEXT NULL`).catch(() => {});
    }
    if (!colNames.includes('action_attachments')) {
      await pool.query(`ALTER TABLE process_audit_requests ADD COLUMN action_attachments JSON NULL`).catch(() => {});
    }
    if (!colNames.includes('standardization_details')) {
      await pool.query(`ALTER TABLE process_audit_requests ADD COLUMN standardization_details TEXT NULL`).catch(() => {});
    }
    if (!colNames.includes('target_date')) {
      await pool.query(`ALTER TABLE process_audit_requests ADD COLUMN target_date VARCHAR(50) NULL`).catch(() => {});
    }
    if (!colNames.includes('action_taken_by')) {
      await pool.query(`ALTER TABLE process_audit_requests ADD COLUMN action_taken_by VARCHAR(100) NULL`).catch(() => {});
    }
    if (!colNames.includes('action_taken_at')) {
      await pool.query(`ALTER TABLE process_audit_requests ADD COLUMN action_taken_at TIMESTAMP NULL`).catch(() => {});
    }

    let rejectionReason = null;
    let rootCause = null;
    let correctiveAction = null;
    let actionAttachments = null;
    let standardizationDetails = null;
    let targetDate = null;
    let actionTakenBy = null;

    if (typeof details === 'string') {
      rejectionReason = details;
    } else if (typeof details === 'object' && details !== null) {
      rejectionReason = details.rejectionReason !== undefined ? details.rejectionReason : (details.rejection_reason !== undefined ? details.rejection_reason : null);
      rootCause = details.root_cause !== undefined ? details.root_cause : (details.rootCause !== undefined ? details.rootCause : null);
      correctiveAction = details.corrective_action !== undefined ? details.corrective_action : (details.correctiveAction !== undefined ? details.correctiveAction : null);
      actionAttachments = details.action_attachments !== undefined ? details.action_attachments : (details.actionAttachments !== undefined ? details.actionAttachments : null);
      standardizationDetails = details.standardization_details !== undefined ? details.standardization_details : (details.standardizationDetails !== undefined ? details.standardizationDetails : null);
      targetDate = details.target_date !== undefined ? details.target_date : (details.targetDate !== undefined ? details.targetDate : null);
      actionTakenBy = details.action_taken_by !== undefined ? details.action_taken_by : (details.actionTakenBy !== undefined ? details.actionTakenBy : null);
    }

    const updates = ['status = ?'];
    const params = [status];

    if (rejectionReason !== null) {
      updates.push('rejection_reason = ?');
      params.push(rejectionReason);
    }
    if (rootCause !== null) {
      updates.push('root_cause = ?');
      params.push(rootCause);
    }
    if (correctiveAction !== null) {
      updates.push('corrective_action = ?');
      params.push(correctiveAction);
    }
    if (actionAttachments !== null) {
      updates.push('action_attachments = ?');
      params.push(typeof actionAttachments === 'string' ? actionAttachments : JSON.stringify(actionAttachments));
    }
    if (standardizationDetails !== null) {
      updates.push('standardization_details = ?');
      params.push(standardizationDetails);
    }
    if (targetDate !== null) {
      updates.push('target_date = ?');
      params.push(targetDate);
    }
    if (actionTakenBy !== null) {
      updates.push('action_taken_by = ?');
      params.push(actionTakenBy);
      updates.push('action_taken_at = NOW()');
    }

    params.push(numericId, String(id));

    const query = `UPDATE process_audit_requests SET ${updates.join(', ')} WHERE id = ? OR issue_no = ?`;
    await pool.query(query, params);

    const [rows] = await pool.query(`SELECT * FROM process_audit_requests WHERE id = ? OR issue_no = ?`, [numericId, String(id)]);
    return rows[0];
  }
};
