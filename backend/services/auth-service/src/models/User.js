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
      'SELECT id, name, email, role, department, status, created_at, updated_at FROM users WHERE id = ?',
      [id]
    );
    return rows && rows.length > 0 ? rows[0] : null;
  },

  getAll: async () => {
    if (!pool) throw new Error('Database connection pool is not available');
    const [rows] = await pool.query(
      'SELECT id, name, email, role, department, status, created_at, updated_at FROM users ORDER BY id ASC'
    );
    return rows;
  },

  create: async (userData) => {
    if (!pool) throw new Error('Database connection pool is not available');
    const { name, email, password = 'PlantUser@123', role = 'user', department = 'Production Planning', status = 'ACTIVE' } = userData;
    const hashedPassword = bcrypt.hashSync(password, 10);
    const [result] = await pool.query(
      'INSERT INTO users (name, email, password, role, department, status) VALUES (?, ?, ?, ?, ?, ?)',
      [name, email, hashedPassword, role, department, status.toUpperCase()]
    );
    const [rows] = await pool.query(
      'SELECT id, name, email, role, department, status, created_at FROM users WHERE id = ?',
      [result.insertId]
    );
    return rows[0];
  },

  update: async (id, updates) => {
    if (!pool) throw new Error('Database connection pool is not available');
    const { name, email, role, department, status } = updates;
    await pool.query(
      'UPDATE users SET name = ?, email = ?, role = ?, department = ?, status = ? WHERE id = ?',
      [name, email, role, department, status ? status.toUpperCase() : 'ACTIVE', id]
    );
    const [rows] = await pool.query(
      'SELECT id, name, email, role, department, status, updated_at FROM users WHERE id = ?',
      [id]
    );
    return rows && rows.length > 0 ? rows[0] : null;
  },

  delete: async (id) => {
    if (!pool) throw new Error('Database connection pool is not available');
    const [result] = await pool.query('DELETE FROM users WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }
};
