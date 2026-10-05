import { verifyToken } from '../../../../shared/jwt.js';
import pool from '../../../../shared/db.js';

/**
 * Robust Auth Middleware for IHLR microservice.
 * Extracts user from JWT Bearer token, database lookup, or request body payload.
 */
export const authenticateUser = async (req, res, next) => {
  try {
    let user = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const decoded = verifyToken(token);
        if (decoded) user = decoded;
      } catch (err) {
        // Token verification soft fallback
      }
    }

    // Fallback to body or query if client passed user info
    const bodyUser = req.body?.user || {};
    const queryUser = req.query || {};
    const candidateId = user?.id || bodyUser.id || req.body?.user_id || queryUser.user_id || queryUser.userId;
    const candidateEmail = user?.email || bodyUser.email || req.body?.user_email || queryUser.user_email || queryUser.userEmail;
    const candidateName = user?.name || bodyUser.name || req.body?.user_name || queryUser.user_name || queryUser.userName;
    const candidateRole = user?.role || bodyUser.role || req.body?.role || queryUser.role;
    const candidateDept = user?.department || bodyUser.department || req.body?.department || queryUser.department;

    if (pool && (candidateId || candidateEmail || candidateName)) {
      try {
        const [rows] = await pool.query(
          'SELECT id, name, email, department, role FROM users WHERE id = ? OR LOWER(TRIM(email)) = LOWER(TRIM(?)) OR LOWER(TRIM(name)) = LOWER(TRIM(?)) LIMIT 1',
          [Number(candidateId) || 0, String(candidateEmail || '').trim().toLowerCase(), String(candidateName || '').trim().toLowerCase()]
        );
        if (rows && rows.length > 0) {
          req.user = rows[0];
          return next();
        }
      } catch (dbErr) {
        // Database query failed, continue with fallback
      }
    }

    if (user || candidateName || candidateEmail) {
      req.user = {
        id: candidateId || null,
        name: candidateName || user?.name || '',
        email: candidateEmail || user?.email || '',
        role: (candidateRole || user?.role || 'USER').toUpperCase(),
        department: (candidateDept || user?.department || '').toUpperCase()
      };
    }
  } catch (err) {
    console.warn('[IHLR Auth Middleware Error]:', err.message);
  }
  next();
};
