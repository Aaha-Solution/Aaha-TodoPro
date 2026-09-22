import pool from '../../../shared/db.js';

export const ProcessAuditRequest = {
  findAll: async () => {
    if (!pool) throw new Error('Database connection pool is not available');
    const [rows] = await pool.query('SELECT * FROM process_audit_requests ORDER BY created_at DESC');
    return rows;
  },

  create: async (data) => {
    if (!pool) throw new Error('Database connection pool is not available');
    const id = data.id || `REQ-${Math.floor(1000 + Math.random() * 9000)}`;
    const batch_date = data.batch_date || data.date || new Date().toISOString().split('T')[0];
    const shift = data.shift || 'Morning';
    const priority = data.priority || 'High';
    const quantity = String(data.quantity || '1000');
    const unit = data.unit || 'Units';
    const stage = data.stage || 'Assembly';
    const line = data.line || 'Line A - Main Chassis Assembly';
    const creator = data.creator || 'Admin';
    const executor = data.executor || 'Plant Lead';
    const status = data.status || 'Pending Execution';
    const comments = data.comments || '';

    const query = `
      INSERT INTO process_audit_requests 
      (id, batch_date, shift, priority, quantity, unit, stage, line, creator, executor, status, comments)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    await pool.query(query, [
      id, batch_date, shift, priority, quantity, unit, stage, line, creator, executor, status, comments
    ]);

    const [rows] = await pool.query('SELECT * FROM process_audit_requests WHERE id = ?', [id]);
    return rows[0];
  }
};
