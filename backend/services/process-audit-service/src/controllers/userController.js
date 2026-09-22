import pool from '../../../shared/db.js';
import { successResponse, errorResponse } from '../../../shared/response.js';

export const getUsers = async (req, res) => {
  try {
    if (!pool) throw new Error('Database pool not available');
    const [users] = await pool.query(
      'SELECT id, name, email, role, department as dept, status FROM users ORDER BY id ASC'
    );
    return successResponse(res, users);
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};
