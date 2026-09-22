import pool from '../../../shared/db.js';

// Auto-ensure table structure matches the actual form fields
const ensureTable = async () => {
  if (!pool) return;
  try {
    const [cols] = await pool.query(`SHOW COLUMNS FROM process_audit_requests`).catch(() => [[]]);
    const colNames = cols.map((c) => c.Field);

    // If existing table is empty and has the old obsolete columns (like 'quantity' / 'unit' / 'stage'), drop it
    if (cols.length > 0 && !colNames.includes('product')) {
      const [rows] = await pool.query(`SELECT COUNT(*) as count FROM process_audit_requests`).catch(() => [[{ count: 0 }]]);
      if (rows[0]?.count === 0) {
        await pool.query(`DROP TABLE IF EXISTS process_audit_requests`);
      }
    }

    await pool.query(`
      CREATE TABLE IF NOT EXISTS process_audit_requests (
        id VARCHAR(50) PRIMARY KEY,
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
    const [rows] = await pool.query('SELECT * FROM process_audit_requests ORDER BY created_at DESC');
    return rows;
  },

  getNextId: async () => {
    if (!pool) return 'PA-1';
    try {
      const [rows] = await pool.query('SELECT id, issue_no FROM process_audit_requests ORDER BY created_at DESC, id DESC LIMIT 50');
      if (!rows || rows.length === 0) {
        return 'PA-1';
      }

      let maxNum = 0;
      for (const row of rows) {
        const idStr = String(row.issue_no || row.id || '');
        const match = idStr.match(/(?:PA-|REQ-)?(\d+)/i);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNum) maxNum = num;
        }
      }

      const nextNum = maxNum > 0 ? maxNum + 1 : 1;
      return `PA-${nextNum}`;
    } catch (err) {
      console.warn('Could not calculate next ID:', err.message);
      return 'PA-1';
    }
  },

  create: async (data) => {
    if (!pool) throw new Error('Database connection pool is not available');
    const issue_no = data.issue_no || data.requestId || data.id || await ProcessAuditRequest.getNextId();
    const id = issue_no;
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

    const query = `
      INSERT INTO process_audit_requests 
      (id, issue_no, escalation_date, product, model, process_operation, shift, issue_type, priority, issue_observation, attachments, department, executor, comments, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    try {
      await pool.query(query, [
        id,
        issue_no,
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
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        const nextNum = await ProcessAuditRequest.getNextId();
        await pool.query(query, [
          nextNum,
          nextNum,
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
        const [rows] = await pool.query('SELECT * FROM process_audit_requests WHERE id = ?', [nextNum]);
        return rows[0] || { id: nextNum, issue_no: nextNum, ...data };
      }
      throw err;
    }

    const [rows] = await pool.query('SELECT * FROM process_audit_requests WHERE id = ?', [id]);
    return rows[0] || { id, issue_no, ...data };
  }
};
