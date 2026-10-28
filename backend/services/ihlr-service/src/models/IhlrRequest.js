import pool from '../../../shared/db.js';

const resolveIhlrStatus = (r) => {
  const currentStatus = String(r.status || '').trim().toUpperCase();
  if (currentStatus === 'CLOSED') return 'CLOSED';
  if (currentStatus === 'IN_PROGRESS' || currentStatus === 'IN-PROGRESS') return 'IN_PROGRESS';
  if (currentStatus === 'OPEN') return 'OPEN';
  return currentStatus || 'OPEN';
};

const safeJsonParse = (val, fallback = []) => {
  if (!val) return fallback;
  if (typeof val === 'object') return val;
  try {
    return JSON.parse(val);
  } catch {
    return fallback;
  }
};

let tableVerified = false;
const ensureColumns = async () => {
  if (tableVerified || !pool) return;
  try {
    const [cols] = await pool.query('SHOW COLUMNS FROM ihlr_requests');
    const colNames = (cols || []).map(c => c.Field);
    if (!colNames.includes('reassignment_history')) {
      await pool.query('ALTER TABLE ihlr_requests ADD COLUMN reassignment_history JSON NULL AFTER remarks').catch(() => {});
    }
    if (!colNames.includes('closer_updated_by')) {
      await pool.query('ALTER TABLE ihlr_requests ADD COLUMN closer_updated_by VARCHAR(100) NULL AFTER permanent_closed_by').catch(() => {});
    }
    if (!colNames.includes('closer_updated_by_id')) {
      await pool.query('ALTER TABLE ihlr_requests ADD COLUMN closer_updated_by_id INT NULL AFTER closer_updated_by').catch(() => {});
    }
    if (!colNames.includes('closer_updated_by_email')) {
      await pool.query('ALTER TABLE ihlr_requests ADD COLUMN closer_updated_by_email VARCHAR(150) NULL AFTER closer_updated_by_id').catch(() => {});
    }
    if (!colNames.includes('closer_updated_at')) {
      await pool.query('ALTER TABLE ihlr_requests ADD COLUMN closer_updated_at TIMESTAMP NULL AFTER closer_updated_by_email').catch(() => {});
    }
    if (!colNames.includes('notify_emails')) {
      await pool.query('ALTER TABLE ihlr_requests ADD COLUMN notify_emails VARCHAR(500) NULL AFTER resp_person_email').catch(() => {});
    }
    // Ensure no duplicate req_no exist (resolve duplicate req_no by re-assigning CONCAT('IHLR-', id))
    await pool.query(`
      UPDATE ihlr_requests r1
      JOIN ihlr_requests r2 
        ON r1.req_no = r2.req_no AND r1.id > r2.id
      SET r1.req_no = CONCAT('IHLR-', r1.id)
    `).catch(() => {});
    tableVerified = true;
  } catch (err) {
    console.warn('[IHLR Model] Column verification warning:', err.message);
  }
};

export const IhlrRequest = {
  getAll: async () => {
    try {
      if (pool) {
        await ensureColumns();
        const [rows] = await pool.query('SELECT * FROM ihlr_requests ORDER BY id DESC');
        return rows.map(r => ({
          ...r,
          status: resolveIhlrStatus(r),
          qa_why_why: safeJsonParse(r.qa_why_why),
          prod_why_why: safeJsonParse(r.prod_why_why),
          reassignment_history: safeJsonParse(r.reassignment_history)
        }));
      }
    } catch (err) {
      console.warn('[IHLR Model] DB Query failed, falling back to in-memory:', err.message);
    }
    return null;
  },

  getById: async (id) => {
    try {
      if (pool) {
        await ensureColumns();
        const [rows] = await pool.query('SELECT * FROM ihlr_requests WHERE id = ? OR req_no = ? LIMIT 1', [id, id]);
        if (rows && rows.length > 0) {
          const r = rows[0];
          return {
            ...r,
            status: resolveIhlrStatus(r),
            qa_why_why: safeJsonParse(r.qa_why_why),
            prod_why_why: safeJsonParse(r.prod_why_why),
            reassignment_history: safeJsonParse(r.reassignment_history)
          };
        }
      }
    } catch (err) {
      console.warn('[IHLR Model] getById DB Query failed:', err.message);
    }
    return null;
  },

  getNextReqNo: async () => {
    try {
      if (pool) {
        const [rows] = await pool.query('SELECT req_no, id FROM ihlr_requests');
        let max = 0;
        for (const r of rows) {
          const match = String(r.req_no || '').match(/(\d+)/);
          if (match) {
            const num = parseInt(match[1], 10);
            if (num > max) max = num;
          }
          if (r.id && r.id > max) max = r.id;
        }
        return `IHLR-${max + 1}`;
      }
    } catch (err) {
      console.warn('[IHLR Model] getNextReqNo DB Query failed:', err.message);
    }
    return null;
  },

  create: async (data) => {
    try {
      if (pool) {
        let {
          req_no,
          batch_date,
          shift = 'Shift 1',
          problem,
          model,
          problem_detected_at,
          received_from,
          analysis_done_by,
          defect_image,
          qa_why_why = [],
          actual_qty = 1,
          four_m = 'MAN',
          resp = 'PRODUCTION',
          resp_person = '',
          prod_why_why = [],
          temporary_action = '',
          temporary_evidence_attachment = '',
          temporary_target_date = null,
          permanent_fix = '',
          permanent_evidence_attachment = '',
          permanent_target_date = null,
          remarks = '',
          status = 'OPEN',
          created_by = '',
          created_by_id = null,
          created_by_email = '',
          resp_person_email = '',
          notify_emails = ''
        } = data;

        if (!req_no) {
          req_no = (await IhlrRequest.getNextReqNo()) || 'IHLR-1';
        }

        let normalizedShift = String(shift || 'Shift 1').trim();
        if (normalizedShift.toLowerCase().includes('gen')) normalizedShift = 'General';
        else if (normalizedShift.includes('1') || normalizedShift.toLowerCase() === 'i') normalizedShift = 'Shift 1';
        else if (normalizedShift.includes('2') || normalizedShift.toLowerCase() === 'ii') normalizedShift = 'Shift 2';
        else if (normalizedShift.includes('3') || normalizedShift.toLowerCase() === 'iii') normalizedShift = 'Shift 3';

        let normalizedReceivedFrom = String(received_from || '').trim().toUpperCase();
        normalizedReceivedFrom = normalizedReceivedFrom === 'D3' ? 'D3' : 'LINE';
        created_by = String(created_by || '').replace(/[0-9]/g, '').trim();

        const [result] = await pool.query(
          `INSERT INTO ihlr_requests (
            req_no, batch_date, shift, problem, model, problem_detected_at, 
            received_from, analysis_done_by, defect_image, qa_why_why, 
            actual_qty, four_m, resp, resp_person, prod_why_why,
            temporary_action, temporary_evidence_attachment, temporary_target_date,
            permanent_fix, permanent_evidence_attachment, permanent_target_date, remarks, status,
            created_by, created_by_id, created_by_email, resp_person_email, notify_emails
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            req_no,
            batch_date || new Date().toISOString().split('T')[0],
            normalizedShift,
            problem,
            model,
            problem_detected_at,
            normalizedReceivedFrom,
            analysis_done_by,
            defect_image || '',
            JSON.stringify(qa_why_why),
            actual_qty,
            four_m,
            resp,
            resp_person,
            JSON.stringify(prod_why_why),
            temporary_action || '',
            temporary_evidence_attachment || '',
            temporary_target_date || null,
            permanent_fix,
            permanent_evidence_attachment,
            permanent_target_date || null,
            remarks,
            status,
            created_by || null,
            created_by_id || null,
            created_by_email || null,
            resp_person_email || null,
            notify_emails || null
          ]
        );

        const insertedId = result.insertId;

        // Check if req_no was not provided, or if the requested req_no is already taken by another request (concurrent creation race condition)
        let isDuplicate = false;
        if (req_no && req_no !== 'TEMP') {
          const [existing] = await pool.query(
            'SELECT id FROM ihlr_requests WHERE req_no = ? AND id != ? LIMIT 1',
            [req_no, insertedId]
          );
          if (existing && existing.length > 0) {
            isDuplicate = true;
          }
        }

        if (!req_no || req_no === 'TEMP' || isDuplicate) {
          const [allRows] = await pool.query('SELECT req_no, id FROM ihlr_requests WHERE id != ?', [insertedId]);
          let max = 0;
          for (const r of allRows) {
            const match = String(r.req_no || '').match(/(\d+)/);
            if (match) {
              const num = parseInt(match[1], 10);
              if (num > max) max = num;
            }
            if (r.id && r.id > max) max = r.id;
          }
          const nextNum = Math.max(max + 1, insertedId);
          req_no = `IHLR-${nextNum}`;
          await pool.query('UPDATE ihlr_requests SET req_no = ? WHERE id = ?', [req_no, insertedId]);
        }

        const [rows] = await pool.query('SELECT * FROM ihlr_requests WHERE id = ?', [insertedId]);
        if (rows && rows.length > 0) {
          const r = rows[0];
          return {
            ...r,
            qa_why_why: typeof r.qa_why_why === 'string' ? JSON.parse(r.qa_why_why) : (r.qa_why_why || []),
            prod_why_why: typeof r.prod_why_why === 'string' ? JSON.parse(r.prod_why_why) : (r.prod_why_why || [])
          };
        }
      }
    } catch (err) {
      console.warn('[IHLR Model] create DB Query failed:', err.message);
    }
    return null;
  },

  update: async (id, updates) => {
    try {
      if (pool) {
        await ensureColumns();
        const fields = [];
        const values = [];

        const allowed = [
          'req_no', 'batch_date', 'shift', 'problem', 'model', 
          'problem_detected_at', 'received_from', 'analysis_done_by', 
          'defect_image', 'actual_qty', 'four_m', 'resp', 'resp_person', 'resp_person_email', 'notify_emails',
          'temporary_action', 'temporary_evidence_attachment', 'temporary_target_date', 'temporary_closed_by',
          'permanent_fix', 'permanent_evidence_attachment', 'permanent_target_date', 'permanent_closed_by',
          'remarks', 'status',
          'created_by', 'created_by_id', 'created_by_email',
          'reviewed_by', 'reviewed_by_id', 'reviewed_by_email',
          'closer_updated_by', 'closer_updated_by_id', 'closer_updated_by_email', 'closer_updated_at'
        ];

        for (const key of allowed) {
          if (updates[key] !== undefined) {
            fields.push(`${key} = ?`);
            let val = updates[key];
            if ((key === 'batch_date' || key === 'permanent_target_date' || key === 'temporary_target_date') && (val === '' || !val)) {
              val = null;
            }
            if ((key === 'created_by' || key === 'analysis_done_by' || key === 'reviewed_by' || key === 'temporary_closed_by' || key === 'permanent_closed_by' || key === 'closer_updated_by') && val) {
              val = String(val).replace(/[0-9]/g, '').trim();
            }
            if (key === 'shift' && val) {
              const s = String(val).trim().toLowerCase();
              if (s.includes('gen')) val = 'General';
              else if (s.includes('1') || s === 'i') val = 'Shift 1';
              else if (s.includes('2') || s === 'ii') val = 'Shift 2';
              else if (s.includes('3') || s === 'iii') val = 'Shift 3';
            }
            if (key === 'received_from' && val) {
              const rf = String(val).trim().toUpperCase();
              val = rf === 'D3' ? 'D3' : 'LINE';
            }
            values.push(val);
          }
        }

        if (updates.qa_why_why !== undefined) {
          fields.push('qa_why_why = ?');
          values.push(typeof updates.qa_why_why === 'string' ? updates.qa_why_why : JSON.stringify(updates.qa_why_why));
        }

        if (updates.prod_why_why !== undefined) {
          fields.push('prod_why_why = ?');
          values.push(typeof updates.prod_why_why === 'string' ? updates.prod_why_why : JSON.stringify(updates.prod_why_why));
        }

        if (updates.reassignment_history !== undefined) {
          fields.push('reassignment_history = ?');
          values.push(typeof updates.reassignment_history === 'string' ? updates.reassignment_history : JSON.stringify(updates.reassignment_history));
        }

        if (fields.length > 0) {
          values.push(id, id);
          try {
            await pool.query(`UPDATE ihlr_requests SET ${fields.join(', ')} WHERE id = ? OR req_no = ?`, values);
          } catch (queryErr) {
            if (queryErr.message && queryErr.message.includes('reassignment_history')) {
              await pool.query('ALTER TABLE ihlr_requests ADD COLUMN reassignment_history JSON NULL AFTER remarks').catch(() => {});
              await pool.query(`UPDATE ihlr_requests SET ${fields.join(', ')} WHERE id = ? OR req_no = ?`, values);
            } else {
              throw queryErr;
            }
          }
        }

        return await IhlrRequest.getById(id);
      }
    } catch (err) {
      console.warn('[IHLR Model] update DB Query failed:', err.message);
    }
    return null;
  },

  delete: async (id) => {
    try {
      if (pool) {
        const [result] = await pool.query('DELETE FROM ihlr_requests WHERE id = ?', [id]);
        return result.affectedRows > 0;
      }
    } catch (err) {
      console.warn('[IHLR Model] delete DB Query failed:', err.message);
    }
    return false;
  }
};

export default IhlrRequest;
