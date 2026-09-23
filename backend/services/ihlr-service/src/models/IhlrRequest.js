import pool from '../../../shared/db.js';

export const IhlrRequest = {
  getAll: async () => {
    try {
      if (pool) {
        const [rows] = await pool.query('SELECT * FROM ihlr_requests ORDER BY id DESC');
        return rows.map(r => ({
          ...r,
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
          shift = 'I',
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
          status = 'OPEN'
        } = data;

        if (!req_no) {
          req_no = (await IhlrRequest.getNextReqNo()) || 'IHLR-1';
        }

        const [result] = await pool.query(
          `INSERT INTO ihlr_requests (
            req_no, batch_date, shift, problem, model, problem_detected_at, 
            received_from, analysis_done_by, defect_image, qa_why_why, 
            actual_qty, four_m, resp, resp_person, prod_why_why, action, 
            evidence_attachment, target_date, remarks, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            req_no,
            batch_date || new Date().toISOString().split('T')[0],
            shift,
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
            status
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
            values.push(updates[key]);
          }
        }

        if (updates.qa_why_why !== undefined) {
          fields.push('qa_why_why = ?');
          values.push(JSON.stringify(updates.qa_why_why));
        }

        if (updates.prod_why_why !== undefined) {
          fields.push('prod_why_why = ?');
          values.push(JSON.stringify(updates.prod_why_why));
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
