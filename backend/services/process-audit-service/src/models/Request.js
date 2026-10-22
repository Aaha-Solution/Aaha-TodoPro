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
      { name: 'permanent_target_date', type: 'VARCHAR(50) NULL' }
    ];
    for (const c of neededCols) {
      if (!colNames.includes(c.name)) {
        await pool.query(`ALTER TABLE process_audit_requests ADD COLUMN ${c.name} ${c.type}`).catch(() => {});
      }
    }

    const updates = [];
    const params = [];

    const allowedFields = [
      'issue_no', 'escalation_date', 'product', 'model', 'process_operation',
      'shift', 'issue_type', 'priority', 'issue_observation', 'attachments',
      'department', 'executor', 'comments', 'status', 'created_by', 'created_by_id',
      'root_cause', 'corrective_action', 'action_attachments', 'standardization_details',
      'target_date', 'action_taken_by', 'approved_by', 'approved_by_id',
      'approved_by_email', 'creator_remark', 'closed_by', 'closed_by_id',
      'rejection_reason', 'reassignment_history',
      'prod_why_why', 'temporary_action', 'temporary_evidence_attachment', 'temporary_target_date',
      'permanent_fix', 'permanent_evidence_attachment', 'permanent_target_date'
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

    let rejectionReason = null;
    let rootCause = null;
    let correctiveAction = null;
    let actionAttachments = null;
    let standardizationDetails = null;
    let targetDate = null;
    let actionTakenBy = null;
    let creatorRemark = null;
    let prodWhyWhy = null;
    let temporaryAction = null;
    let temporaryEvidenceAttachment = null;
    let temporaryTargetDate = null;
    let permanentFix = null;
    let permanentEvidenceAttachment = null;
    let permanentTargetDate = null;

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
      prodWhyWhy = details.prod_why_why !== undefined ? details.prod_why_why : null;
      temporaryAction = details.temporary_action !== undefined ? details.temporary_action : null;
      temporaryEvidenceAttachment = details.temporary_evidence_attachment !== undefined ? details.temporary_evidence_attachment : null;
      temporaryTargetDate = details.temporary_target_date !== undefined ? details.temporary_target_date : null;
      permanentFix = details.permanent_fix !== undefined ? details.permanent_fix : null;
      permanentEvidenceAttachment = details.permanent_evidence_attachment !== undefined ? details.permanent_evidence_attachment : null;
      permanentTargetDate = details.permanent_target_date !== undefined ? details.permanent_target_date : null;
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

    const isClosed = status.toLowerCase().includes('close');
    if (isClosed) {
      const closedBy = details.closed_by || details.closedBy || actionTakenBy || 'Request Creator';
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
    const reassignedBy = (data.reassigned_by || data.reassignedBy || 'Quality Auditor').trim();
    const reassignedById = data.reassigned_by_id || data.reassignedById || null;

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
      previous_department: prevDept,
      previous_executor: prevExec,
      new_department: newDept,
      new_executor: newExec,
      reason: reason || 'Department / Executor reassigned by Quality Auditor'
    };

    history.push(logEntry);

    await pool.query(
      `UPDATE process_audit_requests 
       SET department = ?, executor = ?, reassignment_history = ?, creator_remark = COALESCE(?, creator_remark), status = 'Pending' 
       WHERE id = ? OR issue_no = ?`,
      [newDept, newExec, JSON.stringify(history), reason || null, numericId, String(id)]
    );

    const [updatedRows] = await pool.query('SELECT * FROM process_audit_requests WHERE id = ? OR issue_no = ?', [numericId, String(id)]);
    return {
      updated: updatedRows[0],
      logEntry,
      prevDept,
      prevExec,
      newDept,
      newExec
    };
  }
};
