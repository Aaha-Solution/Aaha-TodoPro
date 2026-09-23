import pool from '../../../shared/db.js';

// In-memory fallback if MySQL is not reachable
const fallbackAttachments = new Map();
let fallbackIdCounter = 1;

// Ensure table exists on module load
(async function initTable() {
  try {
    if (pool) {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS ihlr_attachments (
          id INT AUTO_INCREMENT PRIMARY KEY,
          request_id INT NULL,
          filename VARCHAR(255) NOT NULL,
          original_name VARCHAR(255) NOT NULL,
          mime_type VARCHAR(100) NOT NULL,
          file_size BIGINT NOT NULL,
          file_data LONGBLOB NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_req (request_id),
          INDEX idx_fn (filename)
        )
      `);
      console.log('[IHLR Attachment Model] ihlr_attachments table initialized (LONGBLOB storage)');
    }
  } catch (err) {
    console.warn('[IHLR Attachment Model] Table init warning:', err.message);
  }
})();

export const IhlrAttachment = {
  /**
   * Save a binary file buffer directly into MySQL LONGBLOB
   */
  create: async ({ request_id = null, filename, original_name, mime_type, file_size, file_data }) => {
    try {
      if (pool) {
        const [result] = await pool.query(
          `INSERT INTO ihlr_attachments (request_id, filename, original_name, mime_type, file_size, file_data)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [request_id, filename, original_name, mime_type, file_size, file_data]
        );

        return {
          id: result.insertId,
          request_id,
          filename,
          original_name,
          mime_type,
          file_size,
          created_at: new Date().toISOString()
        };
      }
    } catch (err) {
      console.warn('[IHLR Attachment Model] create query failed, using in-memory:', err.message);
    }

    // In-memory fallback
    const id = fallbackIdCounter++;
    const record = {
      id,
      request_id,
      filename,
      original_name,
      mime_type,
      file_size,
      file_data,
      created_at: new Date().toISOString()
    };
    fallbackAttachments.set(id, record);
    fallbackAttachments.set(filename, record);
    return record;
  },

  /**
   * Retrieve binary attachment record by numeric ID
   */
  getById: async (id) => {
    try {
      if (pool) {
        const [rows] = await pool.query(
          'SELECT id, request_id, filename, original_name, mime_type, file_size, file_data, created_at FROM ihlr_attachments WHERE id = ?',
          [id]
        );
        if (rows && rows.length > 0) {
          return rows[0];
        }
      }
    } catch (err) {
      console.warn('[IHLR Attachment Model] getById failed:', err.message);
    }
    return fallbackAttachments.get(Number(id)) || null;
  },

  /**
   * Retrieve binary attachment record by unique filename
   */
  getByFilename: async (filename) => {
    try {
      if (pool) {
        const [rows] = await pool.query(
          'SELECT id, request_id, filename, original_name, mime_type, file_size, file_data, created_at FROM ihlr_attachments WHERE filename = ?',
          [filename]
        );
        if (rows && rows.length > 0) {
          return rows[0];
        }
      }
    } catch (err) {
      console.warn('[IHLR Attachment Model] getByFilename failed:', err.message);
    }
    return fallbackAttachments.get(filename) || null;
  }
};

export default IhlrAttachment;
