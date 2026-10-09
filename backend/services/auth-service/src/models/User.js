import pool from '../../../shared/db.js';
import bcrypt from 'bcryptjs';

export const User = {
  findByEmail: async (email) => {
    if (!pool) throw new Error('Database connection pool is not available');
    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    return rows && rows.length > 0 ? rows[0] : null;
  },

  findById: async (id) => {
    if (!pool) throw new Error('Database connection pool is not available');
    const [rows] = await pool.query(
      'SELECT id, employee_id, COALESCE(employee_id, CAST(id AS CHAR)) AS employeeId, name, email, role, department, status, created_at, updated_at FROM users WHERE id = ?',
      [id]
    );
    return rows && rows.length > 0 ? rows[0] : null;
  },

  findByEmployeeId: async (employeeId) => {
    if (!pool) throw new Error('Database connection pool is not available');
    const [rows] = await pool.query(
      'SELECT id, employee_id, COALESCE(employee_id, CAST(id AS CHAR)) AS employeeId, name, email, role, department, status FROM users WHERE LOWER(TRIM(employee_id)) = LOWER(TRIM(?))',
      [employeeId]
    );
    return rows && rows.length > 0 ? rows[0] : null;
  },

  findByEmployeeIdExcludingUser: async (employeeId, excludeUserId) => {
    if (!pool) throw new Error('Database connection pool is not available');
    const [rows] = await pool.query(
      'SELECT id, employee_id, COALESCE(employee_id, CAST(id AS CHAR)) AS employeeId, name, email, role, department, status FROM users WHERE LOWER(TRIM(employee_id)) = LOWER(TRIM(?)) AND id != ?',
      [employeeId, excludeUserId]
    );
    return rows && rows.length > 0 ? rows[0] : null;
  },

  hasAssociatedData: async (id, userName, userEmail) => {
    if (!pool) return false;
    try {
      const cleanName = (userName || '').trim();
      const cleanEmail = (userEmail || '').trim();
      const userId = Number(id);

      // 1. Check IHLR Requests (Creator or Assigned Person)
      const [ihlrRows] = await pool.query(
        `SELECT id FROM ihlr_requests 
         WHERE created_by_id = ? 
            OR (LENGTH(?) > 0 AND LOWER(created_by) = LOWER(?))
            OR (LENGTH(?) > 0 AND LOWER(created_by_email) = LOWER(?))
            OR (LENGTH(?) > 0 AND LOWER(resp_person) LIKE LOWER(?))
            OR (LENGTH(?) > 0 AND LOWER(resp_person_email) LIKE LOWER(?))
         LIMIT 1`,
        [userId, cleanName, cleanName, cleanEmail, cleanEmail, cleanName, `%${cleanName}%`, cleanEmail, `%${cleanEmail}%`]
      ).catch(() => [[]]);
      if (ihlrRows && ihlrRows.length > 0) return true;

      // 2. Check Process Audit Requests (Creator, Executor, or Approver)
      const [paRows] = await pool.query(
        `SELECT id FROM process_audit_requests 
         WHERE created_by_id = ? 
            OR approved_by_id = ?
            OR (LENGTH(?) > 0 AND LOWER(created_by) = LOWER(?))
            OR (LENGTH(?) > 0 AND LOWER(executor) = LOWER(?))
            OR (LENGTH(?) > 0 AND LOWER(approved_by) = LOWER(?))
         LIMIT 1`,
        [userId, userId, cleanName, cleanName, cleanName, cleanName, cleanName, cleanName]
      ).catch(() => [[]]);
      if (paRows && paRows.length > 0) return true;

      // 3. Check Process Audit Approvals
      const [paApprRows] = await pool.query(
        `SELECT id FROM process_audit_approvals 
         WHERE approved_by_id = ? 
            OR (LENGTH(?) > 0 AND LOWER(approved_by) = LOWER(?))
            OR (LENGTH(?) > 0 AND LOWER(executor) = LOWER(?))
         LIMIT 1`,
        [userId, cleanName, cleanName, cleanName, cleanName]
      ).catch(() => [[]]);
      if (paApprRows && paApprRows.length > 0) return true;

      return false;
    } catch (err) {
      console.warn('Error checking user associated data:', err.message);
      return false;
    }
  },

  getAll: async () => {
    if (!pool) throw new Error('Database connection pool is not available');
    const [rows] = await pool.query(
      'SELECT id, employee_id, COALESCE(employee_id, CAST(id AS CHAR)) AS employeeId, name, email, role, department, status, created_at, updated_at FROM users ORDER BY id ASC'
    );
    if (Array.isArray(rows)) {
      for (const u of rows) {
        u.hasData = await User.hasAssociatedData(u.id, u.name, u.email);
      }
    }
    return rows;
  },

  create: async (userData) => {
    if (!pool) throw new Error('Database connection pool is not available');
    const { employeeId, name, email, password = 'PlantUser@123', role = 'USER', department = 'PRODUCTION', status = 'ACTIVE' } = userData;
    const normalizedRole = (role && role.toUpperCase() === 'ADMIN') ? 'ADMIN' : 'USER';
    const hashedPassword = bcrypt.hashSync(password, 10);
    const empId = employeeId && String(employeeId).trim() ? String(employeeId).trim() : null;

    const [result] = await pool.query(
      'INSERT INTO users (employee_id, name, email, password, role, department, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [empId, name, email, hashedPassword, normalizedRole, department, status.toUpperCase()]
    );

    if (!empId) {
      await pool.query('UPDATE users SET employee_id = CAST(id AS CHAR) WHERE id = ?', [result.insertId]);
    }

    const [rows] = await pool.query(
      'SELECT id, employee_id, COALESCE(employee_id, CAST(id AS CHAR)) AS employeeId, name, email, role, department, status, created_at FROM users WHERE id = ?',
      [result.insertId]
    );
    return rows[0];
  },

  update: async (id, updates) => {
    if (!pool) throw new Error('Database connection pool is not available');
    const { employeeId, name, role, department, status, password } = updates;
    const normalizedRole = (role && role.toUpperCase() === 'ADMIN') ? 'ADMIN' : 'USER';
    
    let query = 'UPDATE users SET name = ?, role = ?, department = ?, status = ?';
    let params = [name, normalizedRole, department, status ? status.toUpperCase() : 'ACTIVE'];

    if (employeeId !== undefined && employeeId !== null && String(employeeId).trim() !== '') {
      query += ', employee_id = ?';
      params.push(String(employeeId).trim());
    }

    if (password && typeof password === 'string' && password.trim()) {
      const hashedPassword = bcrypt.hashSync(password.trim(), 10);
      query += ', password = ?';
      params.push(hashedPassword);
    }

    query += ' WHERE id = ?';
    params.push(id);

    await pool.query(query, params);

    const [rows] = await pool.query(
      'SELECT id, employee_id, COALESCE(employee_id, CAST(id AS CHAR)) AS employeeId, name, email, role, department, status, updated_at FROM users WHERE id = ?',
      [id]
    );
    return rows && rows.length > 0 ? rows[0] : null;
  },

  delete: async (id) => {
    if (!pool) throw new Error('Database connection pool is not available');
    const [result] = await pool.query('DELETE FROM users WHERE id = ?', [id]);
    return result.affectedRows > 0;
  },

  updatePassword: async (id, newPassword) => {
    if (!pool) throw new Error('Database connection pool is not available');
    const hashedPassword = bcrypt.hashSync(newPassword, 10);
    const [result] = await pool.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, id]);
    return result.affectedRows > 0;
  }
};
