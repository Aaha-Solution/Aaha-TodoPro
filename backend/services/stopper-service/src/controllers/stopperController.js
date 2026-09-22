import { successResponse, errorResponse } from '../../../shared/response.js';
import pool from '../../../shared/db.js';

export const getAllStoppers = async (req, res) => {
  try {
    if (!pool) throw new Error('Database pool not available');
    const [rows] = await pool.query('SELECT * FROM line_stoppers ORDER BY triggered_at DESC');
    return successResponse(res, rows);
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

export const getActiveStoppers = async (req, res) => {
  try {
    if (!pool) throw new Error('Database pool not available');
    const [rows] = await pool.query("SELECT * FROM line_stoppers WHERE status = 'ACTIVE' ORDER BY triggered_at DESC");
    return successResponse(res, rows);
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

export const triggerStopper = async (req, res) => {
  try {
    if (!pool) throw new Error('Database pool not available');
    const { line, partNumber, category, severity = 'CRITICAL', reason, containment, triggeredBy } = req.body;
    if (!line || !reason) {
      return errorResponse(res, 'Line and reason are required to trigger line halt', 400);
    }

    const id = `STOP-${Date.now()}`;
    await pool.query(
      `INSERT INTO line_stoppers (id, line, part_number, category, severity, reason, containment, status, triggered_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?)`,
      [id, line, partNumber || 'INEL-ASSY-GEN', category || 'Quality Deviation', severity, reason, containment || 'Line stopped immediately', triggeredBy || 'Quality Lead']
    );

    const [rows] = await pool.query('SELECT * FROM line_stoppers WHERE id = ?', [id]);
    return successResponse(res, rows[0], 'Line stopper halt initiated', 201);
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

export const clearStopper = async (req, res) => {
  try {
    if (!pool) throw new Error('Database pool not available');
    const { id } = req.params;
    const { clearedBy, clearanceRemarks } = req.body;

    const [result] = await pool.query(
      `UPDATE line_stoppers SET status = 'RESOLVED', cleared_by = ?, clearance_remarks = ?, cleared_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [clearedBy || 'Authorized Lead', clearanceRemarks || 'Corrective action verified', id]
    );

    if (result.affectedRows === 0) {
      return errorResponse(res, 'Stopper not found in database', 404);
    }

    const [rows] = await pool.query('SELECT * FROM line_stoppers WHERE id = ?', [id]);
    return successResponse(res, rows[0], 'Line stopper successfully resolved');
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};
