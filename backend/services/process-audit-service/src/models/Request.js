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

    await pool.query(`
      CREATE TABLE IF NOT EXISTS process_audit_requests (
        id INT AUTO_INCREMENT PRIMARY KEY,
        issue_no VARCHAR(50) NOT NULL,
        escalation_date DATE NOT NULL,
        product VARCHAR(100) NOT NULL,
        model VARCHAR(100) NOT NULL,
        process_operation VARCHAR(100) NOT NULL,
        shift VARCHAR(50) NOT NULL,
        issue_type VARCHAR(50) DEFAULT 'New',
        priority VARCHAR(50) DEFAULT 'Medium',
        issue_observation TEXT,
        attachments JSON,
        department VARCHAR(100) NOT NULL,
        executor VARCHAR(100) NOT NULL,
        comments TEXT,
        status VARCHAR(50) DEFAULT 'Pending Execution',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
  } catch (err) {
    console.warn('[process_audit_requests] Table structure sync notice:', err.message);
  }
};
ensureTable();

export const ProcessAuditRequest = {
  findAll: async () => {
    if (!pool) throw new Error('Database connection pool is not available');
    const [rows] = await pool.query('SELECT * FROM process_audit_requests ORDER BY id DESC');
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
    const issue_type = data.issue_type || data.issueType || 'New';
    const priority = data.priority || 'Medium';
    const issue_observation = data.issue_observation || data.issueObservation || '';
    const attachments = JSON.stringify(data.attachments || []);
    const department = data.department || 'PRODUCTION';
    const executor = data.executor || 'Plant Lead';
    const comments = data.comments || '';
    const status = data.status || 'Pending Execution';

    // issue_no can be passed from frontend or match the auto-increment id
    let issue_no = data.issue_no || data.requestId || '';

    // Notice: id is omitted from the INSERT query so MySQL's AUTO_INCREMENT automatically assigns 1, 2, 3...
    const query = `
      INSERT INTO process_audit_requests 
      (issue_no, escalation_date, product, model, process_operation, shift, issue_type, priority, issue_observation, attachments, department, executor, comments, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      status
    ]);

    const insertedId = result.insertId;

    if (!issue_no || issue_no === 'TEMP') {
      issue_no = `PA-${insertedId}`;
      await pool.query('UPDATE process_audit_requests SET issue_no = ? WHERE id = ?', [issue_no, insertedId]);
    }

    const [rows] = await pool.query('SELECT * FROM process_audit_requests WHERE id = ?', [insertedId]);
    return rows[0] || { id: insertedId, issue_no: issue_no || `PA-${insertedId}`, ...data };
  }
};
