import pool from '../../../shared/db.js';
import { Approval } from './Approval.js';

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

    // Ensure no duplicate issue_no exist (resolve duplicate issue_no by re-assigning CONCAT('PA-', id))
    await pool.query(`
      UPDATE process_audit_requests r1
      JOIN process_audit_requests r2 
        ON r1.issue_no = r2.issue_no AND r1.id > r2.id
      SET r1.issue_no = CONCAT('PA-', r1.id)
    `).catch(() => {});

    // If existing table is empty and has obsolete columns, drop it
    if (cols.length > 0 && !colNames.includes('product')) {
      const [rows] = await pool.query(`SELECT COUNT(*) as count FROM process_audit_requests`).catch(() => [[{ count: 0 }]]);
      if (rows[0]?.count === 0) {
        await pool.query(`DROP TABLE IF EXISTS process_audit_requests`);
      }
    }

    // Ensure created_by, created_by_id, and created_by_email columns exist in MySQL without default value
    if (!colNames.includes('created_by')) {
      await pool.query(`ALTER TABLE process_audit_requests ADD COLUMN created_by VARCHAR(100) NULL`).catch(() => {});
    }
    if (!colNames.includes('created_by_id')) {
      await pool.query(`ALTER TABLE process_audit_requests ADD COLUMN created_by_id INT NULL`).catch(() => {});
    }
    if (!colNames.includes('created_by_email')) {
      await pool.query(`ALTER TABLE process_audit_requests ADD COLUMN created_by_email VARCHAR(150) NULL`).catch(() => {});
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
    if (!colNames.includes('approved_by')) {
      await pool.query(`ALTER TABLE process_audit_requests ADD COLUMN approved_by VARCHAR(100) NULL`).catch(() => {});
    }
    if (!colNames.includes('approved_by_id')) {
      await pool.query(`ALTER TABLE process_audit_requests ADD COLUMN approved_by_id INT NULL`).catch(() => {});
    }
    if (!colNames.includes('approved_by_email')) {
      await pool.query(`ALTER TABLE process_audit_requests ADD COLUMN approved_by_email VARCHAR(100) NULL`).catch(() => {});
    }
    if (!colNames.includes('approved_at')) {
      await pool.query(`ALTER TABLE process_audit_requests ADD COLUMN approved_at TIMESTAMP NULL`).catch(() => {});
    }
    if (!colNames.includes('reassignment_history')) {
      await pool.query(`ALTER TABLE process_audit_requests ADD COLUMN reassignment_history JSON NULL`).catch(() => {});
    }
    if (!colNames.includes('prod_why_why')) {
      await pool.query(`ALTER TABLE process_audit_requests ADD COLUMN prod_why_why JSON NULL`).catch(() => {});
    }
    if (!colNames.includes('temporary_action')) {
      await pool.query(`ALTER TABLE process_audit_requests ADD COLUMN temporary_action TEXT NULL`).catch(() => {});
    }
    if (!colNames.includes('temporary_evidence_attachment')) {
      await pool.query(`ALTER TABLE process_audit_requests ADD COLUMN temporary_evidence_attachment JSON NULL`).catch(() => {});
    }
    if (!colNames.includes('temporary_target_date')) {
      await pool.query(`ALTER TABLE process_audit_requests ADD COLUMN temporary_target_date VARCHAR(50) NULL`).catch(() => {});
    }
    if (!colNames.includes('permanent_fix')) {
      await pool.query(`ALTER TABLE process_audit_requests ADD COLUMN permanent_fix TEXT NULL`).catch(() => {});
    }
    if (!colNames.includes('permanent_evidence_attachment')) {
      await pool.query(`ALTER TABLE process_audit_requests ADD COLUMN permanent_evidence_attachment JSON NULL`).catch(() => {});
    }
    if (!colNames.includes('permanent_target_date')) {
      await pool.query(`ALTER TABLE process_audit_requests ADD COLUMN permanent_target_date VARCHAR(50) NULL`).catch(() => {});
    }
    if (!colNames.includes('temporary_closed_by')) {
      await pool.query(`ALTER TABLE process_audit_requests ADD COLUMN temporary_closed_by VARCHAR(100) NULL`).catch(() => {});
    }
    if (!colNames.includes('permanent_closed_by')) {
      await pool.query(`ALTER TABLE process_audit_requests ADD COLUMN permanent_closed_by VARCHAR(100) NULL`).catch(() => {});
    }
    if (!colNames.includes('reviewed_by')) {
      await pool.query(`ALTER TABLE process_audit_requests ADD COLUMN reviewed_by VARCHAR(100) NULL`).catch(() => {});
    }
    if (!colNames.includes('reviewed_by_id')) {
      await pool.query(`ALTER TABLE process_audit_requests ADD COLUMN reviewed_by_id INT NULL`).catch(() => {});
    }
    if (!colNames.includes('reviewed_by_email')) {
      await pool.query(`ALTER TABLE process_audit_requests ADD COLUMN reviewed_by_email VARCHAR(150) NULL`).catch(() => {});
    }
    if (!colNames.includes('closer_updated_by')) {
      await pool.query(`ALTER TABLE process_audit_requests ADD COLUMN closer_updated_by VARCHAR(100) NULL`).catch(() => {});
    }
    if (!colNames.includes('closer_updated_by_id')) {
      await pool.query(`ALTER TABLE process_audit_requests ADD COLUMN closer_updated_by_id INT NULL`).catch(() => {});
    }
    if (!colNames.includes('closer_updated_by_email')) {
      await pool.query(`ALTER TABLE process_audit_requests ADD COLUMN closer_updated_by_email VARCHAR(150) NULL`).catch(() => {});
    }
    if (!colNames.includes('closer_updated_at')) {
      await pool.query(`ALTER TABLE process_audit_requests ADD COLUMN closer_updated_at TIMESTAMP NULL`).catch(() => {});
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
        status VARCHAR(50) DEFAULT 'Pending',
        root_cause TEXT,
        corrective_action TEXT,
        action_attachments JSON,
        standardization_details TEXT,
        target_date VARCHAR(50),
        action_taken_by VARCHAR(100),
        action_taken_at TIMESTAMP NULL,
        approved_by VARCHAR(100),
        approved_by_id INT NULL,
        approved_by_email VARCHAR(100),
        approved_at TIMESTAMP NULL,
        creator_remark TEXT,
        reviewed_by VARCHAR(100),
        reviewed_by_id INT NULL,
        reviewed_by_email VARCHAR(150),
        closed_by VARCHAR(100),
        closed_by_id INT NULL,
        closed_at TIMESTAMP NULL,
        created_by VARCHAR(100),
        created_by_id INT NULL,
        created_by_email VARCHAR(150) NULL,
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

    // Ensure existing rows without created_by_email get populated from users table
    await pool.query(`
      UPDATE process_audit_requests
      SET created_by_email = created_by
      WHERE (created_by_email IS NULL OR TRIM(created_by_email) = '')
        AND created_by LIKE '%@%'
    `).catch(() => {});

    await pool.query(`
      UPDATE process_audit_requests r
      JOIN users u ON (r.created_by_id = u.id OR (r.created_by IS NOT NULL AND LOWER(TRIM(r.created_by)) = LOWER(TRIM(u.name))))
      SET r.created_by_email = u.email
      WHERE (r.created_by_email IS NULL OR TRIM(r.created_by_email) = '') AND u.email IS NOT NULL AND TRIM(u.email) != ''
    `).catch(() => {});

    await pool.query(`
      UPDATE process_audit_requests r
      JOIN (
        SELECT email FROM users 
        WHERE (UPPER(TRIM(department)) = 'QAD' OR UPPER(TRIM(role)) = 'ADMIN') 
          AND email IS NOT NULL AND TRIM(email) != '' 
        ORDER BY id ASC LIMIT 1
      ) u
      SET r.created_by_email = u.email
      WHERE (r.created_by_email IS NULL OR TRIM(r.created_by_email) = '')
    `).catch(() => {});

    // Clean up corrupted creator_remark where it was erroneously copied from comments or populated before closure/reopening
    await pool.query(`
      UPDATE process_audit_requests
      SET creator_remark = NULL
      WHERE (creator_remark = comments OR TRIM(creator_remark) = TRIM(comments))
         OR (LOWER(status) NOT LIKE '%close%' AND LOWER(status) NOT LIKE '%open%' AND LOWER(status) NOT LIKE '%reopen%')
    `).catch(() => {});

    // Sync legacy 'Pending Execution' statuses to 'Pending'
    await pool.query(`
      UPDATE process_audit_requests
      SET status = 'Pending'
      WHERE status = 'Pending Execution' OR status IS NULL OR status = ''
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
      SELECT r.*, 
        COALESCE(NULLIF(TRIM(r.created_by), ''), u.name, u.email) AS created_by,
        COALESCE(NULLIF(TRIM(r.created_by_email), ''), u.email, (
          SELECT email FROM users WHERE (UPPER(TRIM(department)) = 'QAD' OR UPPER(TRIM(role)) = 'ADMIN') AND email IS NOT NULL AND TRIM(email) != '' LIMIT 1
        )) AS created_by_email
      FROM process_audit_requests r
      LEFT JOIN users u ON (r.created_by_id = u.id OR (r.created_by IS NOT NULL AND LOWER(TRIM(r.created_by)) = LOWER(TRIM(u.name))))
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

    // Filter by general user (either creator OR assigned executor)
    if (filters.user || filters.user_id) {
      const uName = (filters.user || '').trim();
      const uId = filters.user_id ? Number(filters.user_id) : 0;
      conditions.push(`(
        (r.created_by_id IS NOT NULL AND r.created_by_id = ?) 
        OR LOWER(TRIM(r.created_by)) = LOWER(?)
        OR LOWER(r.created_by) LIKE CONCAT('%', LOWER(?), '%')
        OR LOWER(TRIM(r.executor)) = LOWER(?)
        OR LOWER(r.executor) LIKE CONCAT('%', LOWER(?), '%')
      )`);
      params.push(uId, uName, uName, uName, uName);
    }

    // Filter by department
    if (filters.department && filters.department !== 'All') {
      conditions.push(`UPPER(TRIM(r.department)) = UPPER(TRIM(?))`);
      params.push(filters.department);
    }

    if (conditions.length > 0) {
      query += ` WHERE ` + conditions.join(' AND ');
    }

    query += ` ORDER BY r.created_at DESC, r.id DESC`;

    const [rows] = await pool.query(query, params);
    return rows;
  },

  getNextId: async () => {
    if (!pool) return '1';
    try {
      const [rows] = await pool.query('SELECT issue_no, id FROM process_audit_requests');
      let max = 0;
      for (const r of rows) {
        const match = String(r.issue_no || '').match(/(\d+)/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > max) max = num;
        }
      }
      return String(max + 1);
    } catch (err) {
      console.warn('Could not calculate next ID:', err.message);
      return '1';
    }
  },

  findById: async (id) => {
    if (!pool) return null;
    const numericId = parseInt(String(id).replace(/\D/g, ''), 10) || id;
    const [rows] = await pool.query(`
      SELECT r.*, 
        COALESCE(NULLIF(TRIM(r.created_by), ''), u.name, u.email) AS created_by,
        COALESCE(NULLIF(TRIM(r.created_by_email), ''), u.email, (
          SELECT email FROM users WHERE (UPPER(TRIM(department)) = 'QAD' OR UPPER(TRIM(role)) = 'ADMIN') AND email IS NOT NULL AND TRIM(email) != '' LIMIT 1
        )) AS created_by_email
      FROM process_audit_requests r
      LEFT JOIN users u ON (r.created_by_id = u.id OR (r.created_by IS NOT NULL AND LOWER(TRIM(r.created_by)) = LOWER(TRIM(u.name))))
      WHERE r.id = ? OR r.issue_no = ?
    `, [numericId, String(id)]);
    return rows[0] || null;
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
    const status = data.status || 'Pending';
    const created_by = data.created_by || data.createdBy || data.creator_name || data.creator || null;
    const created_by_id = data.created_by_id || data.createdById || data.userId || null;
    const created_by_email = data.created_by_email || data.creator_email || data.email || null;

    // issue_no can be passed from frontend or match the auto-increment id
    let issue_no = data.issue_no || data.requestId || '';

    // Notice: id is omitted from the INSERT query so MySQL's AUTO_INCREMENT automatically assigns 1, 2, 3...
    const query = `
      INSERT INTO process_audit_requests 
      (issue_no, escalation_date, product, model, process_operation, shift, issue_type, priority, issue_observation, attachments, department, executor, comments, status, created_by, created_by_id, created_by_email)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      created_by_id,
      created_by_email
    ]);

    const insertedId = result.insertId;

    // Check if issue_no was not provided, or if the requested issue_no is already taken by another request (concurrent creation race condition)
    let isDuplicate = false;
    if (issue_no && issue_no !== 'TEMP') {
      const [existing] = await pool.query(
        'SELECT id FROM process_audit_requests WHERE issue_no = ? AND id != ? LIMIT 1',
        [issue_no, insertedId]
      );
      if (existing && existing.length > 0) {
        isDuplicate = true;
      }
    }

    if (!issue_no || issue_no === 'TEMP' || isDuplicate) {
      issue_no = `PA-${insertedId}`;
      await pool.query('UPDATE process_audit_requests SET issue_no = ? WHERE id = ?', [issue_no, insertedId]);
    }

    const [rows] = await pool.query('SELECT * FROM process_audit_requests WHERE id = ?', [insertedId]);
    return rows[0] || { id: insertedId, issue_no: issue_no || `PA-${insertedId}`, ...data };
  },

  update: async (id, data = {}) => {
    if (!pool) throw new Error('Database connection pool is not available');
    const numericId = parseInt(String(id).replace(/\D/g, ''), 10) || id;

    // Check / ensure columns exist
    const [cols] = await pool.query(`SHOW COLUMNS FROM process_audit_requests`).catch(() => [[]]);
    const colNames = (cols || []).map((c) => c.Field);
    const neededCols = [
      { name: 'rejection_reason', type: 'TEXT NULL' },
      { name: 'root_cause', type: 'TEXT NULL' },
      { name: 'corrective_action', type: 'TEXT NULL' },
      { name: 'action_attachments', type: 'JSON NULL' },
      { name: 'standardization_details', type: 'TEXT NULL' },
      { name: 'target_date', type: 'VARCHAR(50) NULL' },
      { name: 'action_taken_by', type: 'VARCHAR(100) NULL' },
      { name: 'action_taken_at', type: 'TIMESTAMP NULL' },
      { name: 'approved_by', type: 'VARCHAR(100) NULL' },
      { name: 'approved_by_id', type: 'INT NULL' },
      { name: 'approved_by_email', type: 'VARCHAR(100) NULL' },
      { name: 'approved_at', type: 'TIMESTAMP NULL' },
      { name: 'creator_remark', type: 'TEXT NULL' },
      { name: 'closed_by', type: 'VARCHAR(100) NULL' },
      { name: 'closed_by_id', type: 'INT NULL' },
      { name: 'closed_at', type: 'TIMESTAMP NULL' },
      { name: 'reassignment_history', type: 'JSON NULL' },
      { name: 'prod_why_why', type: 'JSON NULL' },
      { name: 'temporary_action', type: 'TEXT NULL' },
      { name: 'temporary_evidence_attachment', type: 'JSON NULL' },
      { name: 'temporary_target_date', type: 'VARCHAR(50) NULL' },
      { name: 'permanent_fix', type: 'TEXT NULL' },
      { name: 'permanent_evidence_attachment', type: 'JSON NULL' },
      { name: 'permanent_target_date', type: 'VARCHAR(50) NULL' },
      { name: 'temporary_closed_by', type: 'VARCHAR(100) NULL' },
      { name: 'permanent_closed_by', type: 'VARCHAR(100) NULL' },
      { name: 'reviewed_by', type: 'VARCHAR(100) NULL' },
      { name: 'reviewed_by_email', type: 'VARCHAR(150) NULL' },
      { name: 'closer_updated_by', type: 'VARCHAR(100) NULL' },
      { name: 'closer_updated_by_id', type: 'INT NULL' },
      { name: 'closer_updated_by_email', type: 'VARCHAR(150) NULL' },
      { name: 'closer_updated_at', type: 'TIMESTAMP NULL' }
    ];
    for (const c of neededCols) {
      if (!colNames.includes(c.name)) {
        await pool.query(`ALTER TABLE process_audit_requests ADD COLUMN ${c.name} ${c.type}`).catch(() => {});
      }
    }

    // Check if department or executor changed to auto-append to reassignment_history
    const [existingRows] = await pool.query('SELECT * FROM process_audit_requests WHERE id = ? OR issue_no = ?', [numericId, String(id)]);
    const existingReq = existingRows[0];
    if (existingReq) {
      const prevDept = (existingReq.department || '').trim();
      const prevExec = (existingReq.executor || '').trim();
      const newDept = data.department !== undefined ? (data.department || '').trim() : prevDept;
      const newExec = data.executor !== undefined ? (data.executor || '').trim() : prevExec;

      const isDeptChanged = Boolean(data.department !== undefined && newDept !== prevDept);
      const isExecChanged = Boolean(data.executor !== undefined && newExec !== prevExec);

      if ((isDeptChanged || isExecChanged) && data.reassignment_history === undefined) {
        let currentHistory = [];
        if (existingReq.reassignment_history) {
          if (Array.isArray(existingReq.reassignment_history)) {
            currentHistory = existingReq.reassignment_history;
          } else if (typeof existingReq.reassignment_history === 'string') {
            try {
              const parsed = JSON.parse(existingReq.reassignment_history);
              currentHistory = Array.isArray(parsed) ? parsed : [parsed];
            } catch {
              currentHistory = [];
            }
          }
        }

        const logEntry = {
          id: currentHistory.length + 1,
          reassigned_at: new Date().toISOString(),
          reassigned_by: data.updated_by || data.user_name || (data.user && data.user.name) || 'Quality Auditor',
          reassigned_by_id: data.updated_by_id || data.user_id || (data.user && data.user.id) || null,
          previous_department: prevDept || '—',
          previous_executor: prevExec || '—',
          new_department: newDept || '—',
          new_executor: newExec || '—',
          prev_resp: prevDept || '—',
          prev_resp_person: prevExec || '—',
          new_resp: newDept || '—',
          new_resp_person: newExec || '—',
          remarks: data.reassign_remarks || data.remarks || data.reason || `Department / Executor updated from ${prevDept || '—'} (${prevExec || '—'}) to ${newDept || '—'} (${newExec || '—'})`,
          reason: data.reassign_remarks || data.remarks || data.reason || `Department / Executor updated from ${prevDept || '—'} (${prevExec || '—'}) to ${newDept || '—'} (${newExec || '—'})`
        };

        currentHistory.push(logEntry);
        data.reassignment_history = currentHistory;
      }
    }

    const updates = [];
    const params = [];

    const allowedFields = [
      'issue_no', 'escalation_date', 'product', 'model', 'process_operation',
      'shift', 'issue_type', 'priority', 'issue_observation', 'attachments',
      'department', 'executor', 'comments', 'status', 'created_by', 'created_by_id', 'created_by_email',
      'root_cause', 'corrective_action', 'action_attachments', 'standardization_details',
      'target_date', 'action_taken_by', 'approved_by', 'approved_by_id',
      'approved_by_email', 'creator_remark', 'reviewed_by', 'reviewed_by_id', 'reviewed_by_email', 'closed_by', 'closed_by_id',
      'rejection_reason', 'reassignment_history',
      'prod_why_why', 'temporary_action', 'temporary_evidence_attachment', 'temporary_target_date',
      'permanent_fix', 'permanent_evidence_attachment', 'permanent_target_date',
      'temporary_closed_by', 'permanent_closed_by',
      'closer_updated_by', 'closer_updated_by_id', 'closer_updated_by_email', 'closer_updated_at'
    ];

    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        let val = data[field];
        if (
          field === 'attachments' ||
          field === 'action_attachments' ||
          field === 'reassignment_history' ||
          field === 'prod_why_why' ||
          field === 'temporary_evidence_attachment' ||
          field === 'permanent_evidence_attachment'
        ) {
          if (typeof val === 'object' && val !== null) {
            val = JSON.stringify(val);
          }
        }
        updates.push(`${field} = ?`);
        params.push(val);
      }
    }

    if (data.status) {
      const s = String(data.status).toLowerCase();
      if (s.includes('close') && !data.closed_at) {
        updates.push('closed_at = NOW()');
      }
      if ((s.includes('approved') || s.includes('signed')) && !data.approved_at) {
        updates.push('approved_at = NOW()');
      }
    }

    if (data.action_taken_by && !data.action_taken_at) {
      updates.push('action_taken_at = NOW()');
    }

    if (updates.length === 0) {
      const [rows] = await pool.query('SELECT * FROM process_audit_requests WHERE id = ? OR issue_no = ?', [numericId, String(id)]);
      return rows[0];
    }

    params.push(numericId, String(id));
    await pool.query(`UPDATE process_audit_requests SET ${updates.join(', ')} WHERE id = ? OR issue_no = ?`, params);

    const [rows] = await pool.query('SELECT * FROM process_audit_requests WHERE id = ? OR issue_no = ?', [numericId, String(id)]);
    return rows[0];
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
    if (!colNames.includes('approved_by')) {
      await pool.query(`ALTER TABLE process_audit_requests ADD COLUMN approved_by VARCHAR(100) NULL`).catch(() => {});
    }
    if (!colNames.includes('approved_by_id')) {
      await pool.query(`ALTER TABLE process_audit_requests ADD COLUMN approved_by_id INT NULL`).catch(() => {});
    }
    if (!colNames.includes('approved_by_email')) {
      await pool.query(`ALTER TABLE process_audit_requests ADD COLUMN approved_by_email VARCHAR(100) NULL`).catch(() => {});
    }
    if (!colNames.includes('approved_at')) {
      await pool.query(`ALTER TABLE process_audit_requests ADD COLUMN approved_at TIMESTAMP NULL`).catch(() => {});
    }
    if (!colNames.includes('creator_remark')) {
      await pool.query(`ALTER TABLE process_audit_requests ADD COLUMN creator_remark TEXT NULL`).catch(() => {});
    }
    if (!colNames.includes('closed_by')) {
      await pool.query(`ALTER TABLE process_audit_requests ADD COLUMN closed_by VARCHAR(100) NULL`).catch(() => {});
    }
    if (!colNames.includes('closed_by_id')) {
      await pool.query(`ALTER TABLE process_audit_requests ADD COLUMN closed_by_id INT NULL`).catch(() => {});
    }
    if (!colNames.includes('closed_at')) {
      await pool.query(`ALTER TABLE process_audit_requests ADD COLUMN closed_at TIMESTAMP NULL`).catch(() => {});
    }
    if (!colNames.includes('prod_why_why')) {
      await pool.query(`ALTER TABLE process_audit_requests ADD COLUMN prod_why_why JSON NULL`).catch(() => {});
    }
    if (!colNames.includes('temporary_action')) {
      await pool.query(`ALTER TABLE process_audit_requests ADD COLUMN temporary_action TEXT NULL`).catch(() => {});
    }
    if (!colNames.includes('temporary_evidence_attachment')) {
      await pool.query(`ALTER TABLE process_audit_requests ADD COLUMN temporary_evidence_attachment JSON NULL`).catch(() => {});
    }
    if (!colNames.includes('temporary_target_date')) {
      await pool.query(`ALTER TABLE process_audit_requests ADD COLUMN temporary_target_date VARCHAR(50) NULL`).catch(() => {});
    }
    if (!colNames.includes('permanent_fix')) {
      await pool.query(`ALTER TABLE process_audit_requests ADD COLUMN permanent_fix TEXT NULL`).catch(() => {});
    }
    if (!colNames.includes('permanent_evidence_attachment')) {
      await pool.query(`ALTER TABLE process_audit_requests ADD COLUMN permanent_evidence_attachment JSON NULL`).catch(() => {});
    }
    if (!colNames.includes('permanent_target_date')) {
      await pool.query(`ALTER TABLE process_audit_requests ADD COLUMN permanent_target_date VARCHAR(50) NULL`).catch(() => {});
    }
    if (!colNames.includes('temporary_closed_by')) {
      await pool.query(`ALTER TABLE process_audit_requests ADD COLUMN temporary_closed_by VARCHAR(100) NULL`).catch(() => {});
    }
    if (!colNames.includes('permanent_closed_by')) {
      await pool.query(`ALTER TABLE process_audit_requests ADD COLUMN permanent_closed_by VARCHAR(100) NULL`).catch(() => {});
    }
    if (!colNames.includes('reviewed_by')) {
      await pool.query(`ALTER TABLE process_audit_requests ADD COLUMN reviewed_by VARCHAR(100) NULL`).catch(() => {});
    }
    if (!colNames.includes('reviewed_by_id')) {
      await pool.query(`ALTER TABLE process_audit_requests ADD COLUMN reviewed_by_id INT NULL`).catch(() => {});
    }
    if (!colNames.includes('reviewed_by_email')) {
      await pool.query(`ALTER TABLE process_audit_requests ADD COLUMN reviewed_by_email VARCHAR(150) NULL`).catch(() => {});
    }

    let rejectionReason = null;
    let rootCause = null;
    let correctiveAction = null;
    let actionAttachments = null;
    let standardizationDetails = null;
    let targetDate = null;
    let actionTakenBy = null;
    let creatorRemark = null;
    let reviewedBy = null;
    let reviewedById = null;
    let reviewedByEmail = null;
    let prodWhyWhy = null;
    let temporaryAction = null;
    let temporaryEvidenceAttachment = null;
    let temporaryTargetDate = null;
    let temporaryClosedBy = null;
    let permanentFix = null;
    let permanentEvidenceAttachment = null;
    let permanentTargetDate = null;
    let permanentClosedBy = null;
    let closerUpdatedBy = null;
    let closerUpdatedById = null;
    let closerUpdatedByEmail = null;

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
      creatorRemark = details.creator_remark !== undefined ? details.creator_remark : (details.creatorRemark !== undefined ? details.creatorRemark : (details.remark !== undefined ? details.remark : null));
      reviewedBy = details.reviewed_by !== undefined ? details.reviewed_by : (details.reviewedBy !== undefined ? details.reviewedBy : null);
      reviewedById = details.reviewed_by_id !== undefined ? details.reviewed_by_id : (details.reviewedById !== undefined ? details.reviewedById : null);
      reviewedByEmail = details.reviewed_by_email !== undefined ? details.reviewed_by_email : (details.reviewedByEmail !== undefined ? details.reviewedByEmail : null);
      prodWhyWhy = details.prod_why_why !== undefined ? details.prod_why_why : null;
      temporaryAction = details.temporary_action !== undefined ? details.temporary_action : null;
      temporaryEvidenceAttachment = details.temporary_evidence_attachment !== undefined ? details.temporary_evidence_attachment : null;
      temporaryTargetDate = details.temporary_target_date !== undefined ? details.temporary_target_date : null;
      temporaryClosedBy = details.temporary_closed_by !== undefined ? details.temporary_closed_by : null;
      permanentFix = details.permanent_fix !== undefined ? details.permanent_fix : null;
      permanentEvidenceAttachment = details.permanent_evidence_attachment !== undefined ? details.permanent_evidence_attachment : null;
      permanentTargetDate = details.permanent_target_date !== undefined ? details.permanent_target_date : null;
      permanentClosedBy = details.permanent_closed_by !== undefined ? details.permanent_closed_by : null;
      closerUpdatedBy = details.closer_updated_by !== undefined ? details.closer_updated_by : null;
      closerUpdatedById = details.closer_updated_by_id !== undefined ? details.closer_updated_by_id : null;
      closerUpdatedByEmail = details.closer_updated_by_email !== undefined ? details.closer_updated_by_email : null;
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
    if (creatorRemark !== null) {
      updates.push('creator_remark = ?');
      params.push(creatorRemark);
    }
    if (prodWhyWhy !== null) {
      updates.push('prod_why_why = ?');
      params.push(typeof prodWhyWhy === 'string' ? prodWhyWhy : JSON.stringify(prodWhyWhy));
    }
    if (temporaryAction !== null) {
      updates.push('temporary_action = ?');
      params.push(temporaryAction);
    }
    if (temporaryEvidenceAttachment !== null) {
      updates.push('temporary_evidence_attachment = ?');
      params.push(typeof temporaryEvidenceAttachment === 'string' ? temporaryEvidenceAttachment : JSON.stringify(temporaryEvidenceAttachment));
    }
    if (temporaryTargetDate !== null) {
      updates.push('temporary_target_date = ?');
      params.push(temporaryTargetDate);
    }
    if (temporaryClosedBy !== null) {
      updates.push('temporary_closed_by = ?');
      params.push(temporaryClosedBy);
    }
    if (permanentFix !== null) {
      updates.push('permanent_fix = ?');
      params.push(permanentFix);
    }
    if (permanentEvidenceAttachment !== null) {
      updates.push('permanent_evidence_attachment = ?');
      params.push(typeof permanentEvidenceAttachment === 'string' ? permanentEvidenceAttachment : JSON.stringify(permanentEvidenceAttachment));
    }
    if (permanentTargetDate !== null) {
      updates.push('permanent_target_date = ?');
      params.push(permanentTargetDate);
    }
    if (permanentClosedBy !== null) {
      updates.push('permanent_closed_by = ?');
      params.push(permanentClosedBy);
    }
    if (reviewedBy !== null) {
      updates.push('reviewed_by = ?');
      params.push(reviewedBy);
    }
    if (reviewedById !== null) {
      updates.push('reviewed_by_id = ?');
      params.push(reviewedById);
    }
    if (reviewedByEmail !== null) {
      updates.push('reviewed_by_email = ?');
      params.push(reviewedByEmail);
    }
    if (closerUpdatedBy !== null) {
      updates.push('closer_updated_by = ?');
      params.push(closerUpdatedBy);
      updates.push('closer_updated_at = NOW()');
    }
    if (closerUpdatedById !== null) {
      updates.push('closer_updated_by_id = ?');
      params.push(closerUpdatedById);
    }
    if (closerUpdatedByEmail !== null) {
      updates.push('closer_updated_by_email = ?');
      params.push(closerUpdatedByEmail);
    }

    const isClosed = status.toLowerCase().includes('close');
    if (isClosed) {
      const closedBy = details.permanent_closed_by || details.closed_by || details.closedBy || actionTakenBy || 'Request Creator';
      const closedById = details.closed_by_id || details.closedById || null;
      updates.push('closed_by = ?');
      params.push(closedBy);
      if (closedById !== null) {
        updates.push('closed_by_id = ?');
        params.push(closedById);
      }
      updates.push('closed_at = NOW()');
    }

    const isApproved = status.toLowerCase().includes('approved') || status.toLowerCase().includes('progress') || status.toLowerCase().includes('signed') || status.toLowerCase().includes('approval') || status.toLowerCase().includes('review');
    if (isApproved) {
      const approvedBy = details.approved_by || details.approvedBy || actionTakenBy || 'Assigned Executor';
      const approvedById = details.approved_by_id || details.approvedById || null;
      const approvedByEmail = details.approved_by_email || details.approvedByEmail || null;

      updates.push('approved_by = ?');
      params.push(approvedBy);
      if (approvedById !== null) {
        updates.push('approved_by_id = ?');
        params.push(approvedById);
      }
      if (approvedByEmail !== null) {
        updates.push('approved_by_email = ?');
        params.push(approvedByEmail);
      }
      updates.push('approved_at = NOW()');
    }

    params.push(numericId, String(id));

    const query = `UPDATE process_audit_requests SET ${updates.join(', ')} WHERE id = ? OR issue_no = ?`;
    await pool.query(query, params);

    const [rows] = await pool.query(`SELECT * FROM process_audit_requests WHERE id = ? OR issue_no = ?`, [numericId, String(id)]);
    const updatedRow = rows[0];

    // If status is Approved, save into the separate process_audit_approvals table
    if (updatedRow && isApproved) {
      try {
        await Approval.createApproval({
          request_id: updatedRow.id,
          issue_no: updatedRow.issue_no || (updatedRow.id ? `PA-${updatedRow.id}` : String(id)),
          approved_by: updatedRow.approved_by || details.approved_by || details.approvedBy || actionTakenBy || updatedRow.executor || 'Assigned Executor',
          approved_by_id: details.approved_by_id || details.approvedById || null,
          approved_by_email: details.approved_by_email || details.approvedByEmail || null,
          approved_by_role: details.approved_by_role || details.approvedByRole || null,
          department: updatedRow.department,
          executor: updatedRow.executor,
          root_cause: updatedRow.root_cause,
          corrective_action: updatedRow.corrective_action,
          action_attachments: updatedRow.action_attachments,
          standardization_details: updatedRow.standardization_details,
          target_date: updatedRow.target_date,
          reviewed_by: updatedRow.reviewed_by || details.reviewed_by || details.reviewedBy || null,
          reviewed_by_id: updatedRow.reviewed_by_id || details.reviewed_by_id || details.reviewedById || null,
          reviewed_by_email: updatedRow.reviewed_by_email || details.reviewed_by_email || details.reviewedByEmail || null,
          status: 'Approved',
          comments: details.comments || null,
        });
      } catch (apprErr) {
        console.warn('Failed to insert into separate process_audit_approvals table:', apprErr.message);
      }
    }

    return updatedRow;
  },

  reassign: async (id, data = {}) => {
    if (!pool) throw new Error('Database connection pool is not available');
    const numericId = parseInt(String(id).replace(/\D/g, ''), 10) || id;

    const [cols] = await pool.query(`SHOW COLUMNS FROM process_audit_requests`).catch(() => [[]]);
    const colNames = cols.map((c) => c.Field);
    if (!colNames.includes('reassignment_history')) {
      await pool.query(`ALTER TABLE process_audit_requests ADD COLUMN reassignment_history JSON NULL`).catch(() => {});
    }

    const [rows] = await pool.query('SELECT * FROM process_audit_requests WHERE id = ? OR issue_no = ?', [numericId, String(id)]);
    if (rows.length === 0) throw new Error('Audit Request not found');
    const req = rows[0];

    const prevDept = req.department;
    const prevExec = req.executor;
    const newDept = (data.new_department || data.department || prevDept).trim();
    const newExec = (data.new_executor || data.executor || prevExec).trim();
    const reason = (data.reason || '').trim();
    const reassignedBy = (data.reassigned_by || data.reassignedBy || data.reviewed_by || data.reviewedBy || 'Quality Auditor').trim();
    const reassignedById = data.reassigned_by_id || data.reassignedById || data.reviewed_by_id || data.reviewedById || null;
    const reassignedByEmail = data.reassigned_by_email || data.reassignedByEmail || data.reviewed_by_email || data.reviewedByEmail || null;

    let history = [];
    if (req.reassignment_history) {
      if (Array.isArray(req.reassignment_history)) {
        history = req.reassignment_history;
      } else if (typeof req.reassignment_history === 'string') {
        try {
          const parsed = JSON.parse(req.reassignment_history);
          history = Array.isArray(parsed) ? parsed : [parsed];
        } catch {
          history = [];
        }
      }
    }

    const logEntry = {
      id: history.length + 1,
      reassigned_at: new Date().toISOString(),
      reassigned_by: reassignedBy,
      reassigned_by_id: reassignedById,
      reassigned_by_email: reassignedByEmail,
      previous_department: prevDept,
      previous_executor: prevExec,
      new_department: newDept,
      new_executor: newExec,
      prev_resp: prevDept,
      prev_resp_person: prevExec,
      new_resp: newDept,
      new_resp_person: newExec,
      remarks: reason || 'Department / Executor reassigned by Quality Auditor',
      reason: reason || 'Department / Executor reassigned by Quality Auditor'
    };

    history.push(logEntry);

    await pool.query(
      `UPDATE process_audit_requests 
       SET department = ?, executor = ?, reassignment_history = ?, 
           creator_remark = COALESCE(?, creator_remark), 
           reviewed_by = ?, reviewed_by_id = ?, reviewed_by_email = ?,
           status = 'Pending' 
       WHERE id = ? OR issue_no = ?`,
      [newDept, newExec, JSON.stringify(history), reason || null, reassignedBy, reassignedById, reassignedByEmail, numericId, String(id)]
    );

    const hydrated = await ProcessAuditRequest.findById(numericId).catch(() => null);
    const [updatedRows] = await pool.query('SELECT * FROM process_audit_requests WHERE id = ? OR issue_no = ?', [numericId, String(id)]);
    return {
      updated: hydrated || updatedRows[0],
      logEntry,
      prevDept,
      prevExec,
      newDept,
      newExec
    };
  }
};
