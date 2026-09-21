import pool from '../config/db.js';

export const User = {
  findByEmail: async (email) => {
    try {
      const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
      return rows[0] || null;
    } catch {
      // Mock fallback if DB offline
      return {
        id: 1,
        name: 'iyyu',
        email: email || 'iyyu@gmail.com',
        role: 'CREATOR',
        department: 'Production Planning',
      };
    }
  },

  getAll: async () => {
    try {
      const [rows] = await pool.query('SELECT id, name, email, role, department, status FROM users');
      return rows;
    } catch {
      return [
        { id: 1, name: 'iyyu', email: 'iyyu@inel.co.in', role: 'Request Creator', department: 'Production Planning', status: 'Active' },
        { id: 2, name: 'Kumar Vel', email: 'kumar.vel@inel.co.in', role: 'Line Execution Lead', department: 'Assembly', status: 'Active' },
        { id: 3, name: 'Ravi Chandran', email: 'ravi.chandran@inel.co.in', role: 'Quality & Inspection Lead', department: 'Quality Control', status: 'Active' },
      ];
    }
  }
};
