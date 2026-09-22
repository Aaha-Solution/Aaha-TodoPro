import pool from '../config/db.js';

export const User = {
  findByEmail: async (email) => {
    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    return rows[0] || null;
  },

  findById: async (id) => {
    const [rows] = await pool.query('SELECT id, name, email, role, department, status, created_at, updated_at FROM users WHERE id = ?', [id]);
    return rows[0] || null;
  },

  getAll: async () => {
    const [rows] = await pool.query(
      'SELECT id, name, email, role, department, status, created_at, updated_at FROM users ORDER BY id ASC'
    );
    return rows;
  },

  create: async (userData) => {
    const { name, email, password = 'PlantUser@123', role = 'user', department = 'Production Planning', status = 'ACTIVE' } = userData;
    const bcrypt = (await import('bcryptjs')).default;
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
    const { name, email, role, department, status } = updates;
    await pool.query(
      'UPDATE users SET name = ?, email = ?, role = ?, department = ?, status = ? WHERE id = ?',
      [name, email, role, department, status ? status.toUpperCase() : 'ACTIVE', id]
    );

    const [rows] = await pool.query(
      'SELECT id, name, email, role, department, status, updated_at FROM users WHERE id = ?',
      [id]
    );
    return rows[0] || null;
  },

  delete: async (id) => {
    const [result] = await pool.query('DELETE FROM users WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }
};
