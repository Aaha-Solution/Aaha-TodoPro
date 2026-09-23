import pool from '../../../shared/db.js';
import { successResponse, errorResponse } from '../../../shared/response.js';

export const getUsers = async (req, res) => {
  try {
    if (!pool) throw new Error('Database pool not available');
    const { department } = req.query;
    let query = 'SELECT id, name, email, role, department, department as dept, status FROM users';
    const params = [];
    if (department && department.trim() && department !== 'All') {
      query += ' WHERE LOWER(TRIM(department)) = LOWER(TRIM(?))';
      params.push(department);
    }
    query += ' ORDER BY name ASC, id ASC';
    const [users] = await pool.query(query, params);
    return successResponse(res, users);
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};
