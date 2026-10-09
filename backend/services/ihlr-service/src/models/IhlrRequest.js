import pool from '../../../shared/db.js';

const resolveIhlrStatus = (r) => {
  const currentStatus = String(r.status || '').trim().toUpperCase();
  if (currentStatus === 'CLOSED') return 'CLOSED';
  if (currentStatus === 'IN_PROGRESS' || currentStatus === 'IN-PROGRESS') return 'IN_PROGRESS';

  const prodWhys = typeof r.prod_why_why === 'string'
    ? (() => { try { return JSON.parse(r.prod_why_why); } catch { return []; } })()
    : (r.prod_why_why || []);
  const hasWhys = Array.isArray(prodWhys) && prodWhys.some(w => Boolean(w && String(w).trim()));
  const hasAction = Boolean(r.action && String(r.action).trim());
  const hasEvidence = Boolean(r.evidence_attachment && String(r.evidence_attachment).trim() && r.evidence_attachment !== '[]');
  const hasTargetDate = Boolean(r.target_date);

  if (hasWhys || hasAction || hasEvidence || hasTargetDate) {
    return 'IN_PROGRESS';
  }
  return currentStatus || 'OPEN';
};

export const IhlrRequest = {
  getAll: async () => {
    try {
      if (pool) {
        const [rows] = await pool.query('SELECT * FROM ihlr_requests ORDER BY id DESC');
        return rows.map(r => ({
          ...r,
          status: resolveIhlrStatus(r),
          qa_why_why: typeof r.qa_why_why === 'string' ? JSON.parse(r.qa_why_why) : (r.qa_why_why || []),
          prod_why_why: typeof r.prod_why_why === 'string' ? JSON.parse(r.prod_why_why) : (r.prod_why_why || [])
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
        const [rows] = await pool.query('SELECT * FROM ihlr_requests WHERE id = ?', [id]);
        if (rows && rows.length > 0) {
          const r = rows[0];
          return {
            ...r,
            status: resolveIhlrStatus(r),
            qa_why_why: typeof r.qa_why_why === 'string' ? JSON.parse(r.qa_why_why) : (r.qa_why_why || []),
            prod_why_why: typeof r.prod_why_why === 'string' ? JSON.parse(r.prod_why_why) : (r.prod_why_why || [])
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
          action = '',
          evidence_attachment = '',
          target_date = null,
          remarks = '',
          status = 'OPEN',
          created_by = '',
          created_by_id = null,
          created_by_email = '',
          resp_person_email = ''
        } = data;

        if (!req_no) {
          req_no = (await IhlrRequest.getNextReqNo()) || 'IHLR-1';
        }

        let normalizedShift = String(shift || 'Shift 1').trim();
        if (normalizedShift.toLowerCase().includes('gen')) normalizedShift = 'General';
        else if (normalizedShift.includes('1') || normalizedShift.toLowerCase() === 'i') normalizedShift = 'Shift 1';
        else if (normalizedShift.includes('2') || normalizedShift.toLowerCase() === 'ii') normalizedShift = 'Shift 2';
        else if (normalizedShift.includes('3') || normalizedShift.toLowerCase() === 'iii') normalizedShift = 'Shift 3';

        const [result] = await pool.query(
          `INSERT INTO ihlr_requests (
            req_no, batch_date, shift, problem, model, problem_detected_at, 
            received_from, analysis_done_by, defect_image, qa_why_why, 
            actual_qty, four_m, resp, resp_person, prod_why_why, action, 
            evidence_attachment, target_date, remarks, status,
            created_by, created_by_id, created_by_email, resp_person_email
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            req_no,
            batch_date || new Date().toISOString().split('T')[0],
            normalizedShift,
            problem,
            model,
            problem_detected_at,
            received_from,
            analysis_done_by,
            defect_image || '',
            JSON.stringify(qa_why_why),
            actual_qty,
            four_m,
            resp,
            resp_person,
            JSON.stringify(prod_why_why),
            action,
            evidence_attachment,
            target_date || null,
            remarks,
            status,
            created_by || null,
            created_by_id || null,
            created_by_email || null,
            resp_person_email || null
          ]
        );

        const [rows] = await pool.query('SELECT * FROM ihlr_requests WHERE id = ?', [result.insertId]);
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
        const fields = [];
        const values = [];

        const allowed = [
          'req_no', 'batch_date', 'shift', 'problem', 'model', 
          'problem_detected_at', 'received_from', 'analysis_done_by', 
          'defect_image', 'actual_qty', 'four_m', 'resp', 'resp_person',
          'action', 'evidence_attachment', 'target_date', 'remarks', 'status'
        ];

        for (const key of allowed) {
          if (updates[key] !== undefined) {
            fields.push(`${key} = ?`);
            let val = updates[key];
            if ((key === 'target_date' || key === 'batch_date') && (val === '' || !val)) {
              val = null;
            }
            if (key === 'shift' && val) {
              const s = String(val).trim().toLowerCase();
              if (s.includes('gen')) val = 'General';
              else if (s.includes('1') || s === 'i') val = 'Shift 1';
              else if (s.includes('2') || s === 'ii') val = 'Shift 2';
              else if (s.includes('3') || s === 'iii') val = 'Shift 3';
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

        if (fields.length > 0) {
          values.push(id);
          await pool.query(`UPDATE ihlr_requests SET ${fields.join(', ')} WHERE id = ?`, values);
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
