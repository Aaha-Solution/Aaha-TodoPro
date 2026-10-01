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

  getAll: async () => {
    if (!pool) throw new Error('Database connection pool is not available');
    const [rows] = await pool.query(
      'SELECT id, employee_id, COALESCE(employee_id, CAST(id AS CHAR)) AS employeeId, name, email, role, department, status, created_at, updated_at FROM users ORDER BY id ASC'
    );
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
