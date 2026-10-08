import pool from '../../../shared/db.js';
import bcrypt from 'bcryptjs';

let isChecked = false;
let hasEmpId = false;

// Safely ensure users table schema compatibility
const checkOrAddEmployeeIdColumn = async () => {
  if (isChecked) return hasEmpId;
  if (!pool) return false;
  try {
    const [cols] = await pool.query("SHOW COLUMNS FROM users LIKE 'employee_id'");
    if (cols && cols.length > 0) {
      hasEmpId = true;
      isChecked = true;
      return true;
    }
    // Attempt to add employee_id column to users table if missing
    try {
      await pool.query("ALTER TABLE users ADD COLUMN employee_id VARCHAR(100) NULL AFTER id");
      await pool.query("UPDATE users SET employee_id = CAST(id AS CHAR) WHERE employee_id IS NULL");
      hasEmpId = true;
      isChecked = true;
      console.log('[Auth Service] Successfully added employee_id column to users table');
      return true;
    } catch (alterErr) {
      console.warn('[Auth Service] Users table has no employee_id column, falling back to id mapping:', alterErr.message);
      hasEmpId = false;
      isChecked = true;
      return false;
    }
  } catch (err) {
    console.warn('[Auth Service] Column check error:', err.message);
    hasEmpId = false;
    return false;
  }
};

export const User = {
  findByEmail: async (email) => {
    if (!pool) throw new Error('Database connection pool is not available');
    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    return rows && rows.length > 0 ? rows[0] : null;
  },

  findById: async (id) => {
    if (!pool) throw new Error('Database connection pool is not available');
    const hasCol = await checkOrAddEmployeeIdColumn();
    const query = hasCol
      ? 'SELECT id, employee_id, COALESCE(employee_id, CAST(id AS CHAR)) AS employeeId, name, email, role, department, status, created_at, updated_at FROM users WHERE id = ?'
      : 'SELECT id, CAST(id AS CHAR) AS employee_id, CAST(id AS CHAR) AS employeeId, name, email, role, department, status, created_at, updated_at FROM users WHERE id = ?';
    const [rows] = await pool.query(query, [id]);
    return rows && rows.length > 0 ? rows[0] : null;
  },

  findByEmployeeId: async (employeeId) => {
    if (!pool) throw new Error('Database connection pool is not available');
    const hasCol = await checkOrAddEmployeeIdColumn();
    if (hasCol) {
      const [rows] = await pool.query(
        'SELECT id, employee_id, COALESCE(employee_id, CAST(id AS CHAR)) AS employeeId, name, email, role, department, status FROM users WHERE LOWER(TRIM(employee_id)) = LOWER(TRIM(?)) OR CAST(id AS CHAR) = ?',
        [employeeId, employeeId]
      );
      return rows && rows.length > 0 ? rows[0] : null;
    } else {
      const [rows] = await pool.query(
        'SELECT id, CAST(id AS CHAR) AS employee_id, CAST(id AS CHAR) AS employeeId, name, email, role, department, status FROM users WHERE CAST(id AS CHAR) = ?',
        [employeeId]
      );
      return rows && rows.length > 0 ? rows[0] : null;
    }
  },

  findByEmployeeIdExcludingUser: async (employeeId, excludeUserId) => {
    if (!pool) throw new Error('Database connection pool is not available');
    const hasCol = await checkOrAddEmployeeIdColumn();
    if (hasCol) {
      const [rows] = await pool.query(
        'SELECT id, employee_id, COALESCE(employee_id, CAST(id AS CHAR)) AS employeeId, name, email, role, department, status FROM users WHERE (LOWER(TRIM(employee_id)) = LOWER(TRIM(?)) OR CAST(id AS CHAR) = ?) AND id != ?',
        [employeeId, employeeId, excludeUserId]
      );
      return rows && rows.length > 0 ? rows[0] : null;
    } else {
      const [rows] = await pool.query(
        'SELECT id, CAST(id AS CHAR) AS employee_id, CAST(id AS CHAR) AS employeeId, name, email, role, department, status FROM users WHERE CAST(id AS CHAR) = ? AND id != ?',
        [employeeId, excludeUserId]
      );
      return rows && rows.length > 0 ? rows[0] : null;
    }
  },

  getAll: async () => {
    if (!pool) throw new Error('Database connection pool is not available');
    const hasCol = await checkOrAddEmployeeIdColumn();
    const query = hasCol
      ? 'SELECT id, employee_id, COALESCE(employee_id, CAST(id AS CHAR)) AS employeeId, name, email, role, department, status, created_at, updated_at FROM users ORDER BY id ASC'
      : 'SELECT id, CAST(id AS CHAR) AS employee_id, CAST(id AS CHAR) AS employeeId, name, email, role, department, status, created_at, updated_at FROM users ORDER BY id ASC';
    const [rows] = await pool.query(query);
    return rows;
  },

  create: async (userData) => {
    if (!pool) throw new Error('Database connection pool is not available');
    const hasCol = await checkOrAddEmployeeIdColumn();
    const { employeeId, name, email, password = 'PlantUser@123', role = 'USER', department = 'PRODUCTION', status = 'ACTIVE' } = userData;
    const normalizedRole = (role && role.toUpperCase() === 'ADMIN') ? 'ADMIN' : 'USER';
    const hashedPassword = bcrypt.hashSync(password, 10);
    const empId = employeeId && String(employeeId).trim() ? String(employeeId).trim() : null;

    let result;
    if (hasCol) {
      const [res] = await pool.query(
        'INSERT INTO users (employee_id, name, email, password, role, department, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [empId, name, email, hashedPassword, normalizedRole, department, (status || 'ACTIVE').toUpperCase()]
      );
      result = res;
      if (!empId) {
        await pool.query('UPDATE users SET employee_id = CAST(id AS CHAR) WHERE id = ?', [result.insertId]);
      }
    } else {
      const [res] = await pool.query(
        'INSERT INTO users (name, email, password, role, department, status) VALUES (?, ?, ?, ?, ?, ?)',
        [name, email, hashedPassword, normalizedRole, department, (status || 'ACTIVE').toUpperCase()]
      );
      result = res;
    }

    return await User.findById(result.insertId);
  },

  update: async (id, updates) => {
    if (!pool) throw new Error('Database connection pool is not available');
    const hasCol = await checkOrAddEmployeeIdColumn();
    const { employeeId, name, role, department, status, password } = updates;
    const normalizedRole = (role && role.toUpperCase() === 'ADMIN') ? 'ADMIN' : 'USER';
    
    let query = 'UPDATE users SET name = ?, role = ?, department = ?, status = ?';
    let params = [name, normalizedRole, department, status ? status.toUpperCase() : 'ACTIVE'];

    if (hasCol && employeeId !== undefined && employeeId !== null && String(employeeId).trim() !== '') {
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
    return await User.findById(id);
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
