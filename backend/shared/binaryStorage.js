import multer from 'multer';
import path from 'path';
import pool from './db.js';

// Fallback in-memory store if database is offline
const fallbackStore = new Map();
let fallbackIdCounter = 1;

/**
 * Automatically ensure the common binary attachments table exists
 */
(async function initTable() {
  try {
    if (pool) {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS app_attachments (
          id INT AUTO_INCREMENT PRIMARY KEY,
          module_name VARCHAR(50) NOT NULL DEFAULT 'COMMON',
          ref_id INT NULL,
          filename VARCHAR(255) NOT NULL,
          original_name VARCHAR(255) NOT NULL,
          mime_type VARCHAR(100) NOT NULL,
          file_size BIGINT NOT NULL,
          file_data LONGBLOB NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_mod (module_name),
          INDEX idx_ref (ref_id),
          INDEX idx_fn (filename)
        )
      `);
      console.log('[Common Binary Storage] app_attachments table initialized (LONGBLOB storage)');
    }
  } catch (err) {
    console.warn('[Common Binary Storage] Table init warning:', err.message);
  }
})();

/**
 * Reusable Multer middleware configured for memory storage
 * Keeps binary file buffers in memory for direct database saving
 */
export const uploadMemory = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max per file
  },
});

/**
 * Save an array of files into MySQL LONGBLOB
 * @param {Array} files - req.files from multer
 * @param {Object} options - { module_name, ref_id, urlPrefix }
 * @returns {Promise<Array>} List of saved file objects with streaming URLs
 */
export const saveBinaryFiles = async (files = [], options = {}) => {
  const {
    module_name = 'COMMON',
    ref_id = null,
    urlPrefix = '/api/ihlr/attachments/binary'
  } = options;

  const savedFiles = [];

  for (const file of files) {
    const ext = path.extname(file.originalname).replace('.', '').toUpperCase();
    const cleanBase = path.basename(file.originalname, path.extname(file.originalname)).replace(/[^a-zA-Z0-9_-]/g, '_');
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e6);
    const uniqueFilename = `${cleanBase}-${uniqueSuffix}.${ext.toLowerCase()}`;

    let savedId = null;

    try {
      if (pool) {
        const [result] = await pool.query(
          `INSERT INTO app_attachments (module_name, ref_id, filename, original_name, mime_type, file_size, file_data)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [module_name, ref_id, uniqueFilename, file.originalname, file.mimetype || 'application/octet-stream', file.size, file.buffer]
        );
        savedId = result.insertId;
      }
    } catch (err) {
      console.warn('[Common Binary Storage] DB insert error, using fallback:', err.message);
    }

    if (!savedId) {
      savedId = fallbackIdCounter++;
      const record = {
        id: savedId,
        module_name,
        ref_id,
        filename: uniqueFilename,
        original_name: file.originalname,
        mime_type: file.mimetype || 'application/octet-stream',
        file_size: file.size,
        file_data: file.buffer,
        created_at: new Date().toISOString()
      };
      fallbackStore.set(savedId, record);
      fallbackStore.set(uniqueFilename, record);
    }

    savedFiles.push({
      id: savedId,
      name: file.originalname,
      filename: uniqueFilename,
      path: `attachments/binary/${savedId}`,
      url: `${urlPrefix}/${savedId}`,
      size: `${(file.size / (1024 * 1024)).toFixed(2)} MB`,
      type: ext,
      module: module_name
    });
  }

  return savedFiles;
};

/**
 * Retrieve binary file record from database by ID or filename
 */
export const getBinaryFile = async (identifier) => {
  try {
    if (pool) {
      const isNum = !isNaN(identifier);
      const query = isNum
        ? 'SELECT id, module_name, filename, original_name, mime_type, file_size, file_data FROM app_attachments WHERE id = ?'
        : 'SELECT id, module_name, filename, original_name, mime_type, file_size, file_data FROM app_attachments WHERE filename = ?';
      
      const [rows] = await pool.query(query, [identifier]);
      if (rows && rows.length > 0) {
        return rows[0];
      }

      // Check legacy ihlr_attachments table if not found in app_attachments
      try {
        const legacyQuery = isNum
          ? 'SELECT id, filename, original_name, mime_type, file_size, file_data FROM ihlr_attachments WHERE id = ?'
          : 'SELECT id, filename, original_name, mime_type, file_size, file_data FROM ihlr_attachments WHERE filename = ?';
        const [legacyRows] = await pool.query(legacyQuery, [identifier]);
        if (legacyRows && legacyRows.length > 0) {
          return legacyRows[0];
        }
      } catch {}
    }
  } catch (err) {
    console.warn('[Common Binary Storage] getBinaryFile error:', err.message);
  }

  return fallbackStore.get(Number(identifier)) || fallbackStore.get(identifier) || null;
};

/**
 * Reusable Express route handler to stream binary file directly from database
 * Sets Content-Type, Content-Disposition, and Cache headers
 */
export const streamBinaryFile = async (req, res) => {
  try {
    const identifier = req.params.id || req.params.filename;
    const attachment = await getBinaryFile(identifier);

    if (!attachment || !attachment.file_data) {
      return res.status(404).send('File attachment not found in database');
    }

    res.setHeader('Content-Type', attachment.mime_type || 'application/octet-stream');
    res.setHeader('Content-Length', attachment.file_size || attachment.file_data.length);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(attachment.original_name || attachment.filename)}"`
    );
    res.setHeader('Cache-Control', 'public, max-age=86400'); // 24h caching

    return res.end(attachment.file_data);
  } catch (err) {
    console.error('[Common Binary Storage] Stream error:', err);
    return res.status(500).send('Error streaming binary file: ' + err.message);
  }
};
