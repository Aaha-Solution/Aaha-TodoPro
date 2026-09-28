import pool from '../../../shared/db.js';
import path from 'path';

// Auto-ensure table structure for storing binary attachments directly in MySQL
export const ensureAttachmentTable = async () => {
  if (!pool) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS process_audit_attachment_files (
        id INT AUTO_INCREMENT PRIMARY KEY,
        filename VARCHAR(255) NOT NULL,
        original_name VARCHAR(255) NOT NULL,
        mime_type VARCHAR(100) NOT NULL DEFAULT 'application/octet-stream',
        file_size INT NOT NULL DEFAULT 0,
        file_data LONGBLOB NOT NULL,
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_filename (filename)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('[Process Audit Service] process_audit_attachment_files table verified.');
  } catch (err) {
    console.warn('[Process Audit Service] ensureAttachmentTable warning:', err.message);
  }
};

// Initialize table on startup
(async () => {
  await ensureAttachmentTable();
})();

export const Attachment = {
  // Save file buffer directly into MySQL database (LONGBLOB) - No disk storage
  saveAttachment: async (file) => {
    if (!pool) throw new Error('Database pool not available');
    await ensureAttachmentTable();

    const originalName = file.originalname || 'attachment';
    const ext = path.extname(originalName);
    const cleanBase = path.basename(originalName, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e6);
    const filename = `${cleanBase}-${uniqueSuffix}${ext}`;
    const mimeType = file.mimetype || 'application/octet-stream';
    const fileSize = file.size || (file.buffer ? file.buffer.length : 0);
    const fileBuffer = file.buffer;

    if (!fileBuffer || fileBuffer.length === 0) {
      throw new Error(`File buffer is empty for ${originalName}`);
    }

    // Insert binary buffer directly into MySQL LONGBLOB column
    const query = `
      INSERT INTO process_audit_attachment_files 
      (filename, original_name, mime_type, file_size, file_data, uploaded_at)
      VALUES (?, ?, ?, ?, ?, NOW())
    `;

    const [result] = await pool.query(query, [
      filename,
      originalName,
      mimeType,
      fileSize,
      fileBuffer,
    ]);

    const insertedId = result.insertId;
    const extName = ext.replace('.', '').toUpperCase() || 'FILE';

    return {
      id: insertedId,
      name: originalName,
      filename,
      url: `/api/process-audit/attachments/${insertedId}`,
      path: `/api/process-audit/attachments/${insertedId}`,
      size: `${(fileSize / (1024 * 1024)).toFixed(2)} MB`,
      sizeBytes: fileSize,
      type: extName,
      mime_type: mimeType,
    };
  },

  // Retrieve binary data and metadata directly from MySQL database
  getAttachmentByIdOrFilename: async (idOrFilename) => {
    if (!pool) throw new Error('Database pool not available');
    await ensureAttachmentTable();

    let raw = String(idOrFilename || '').trim();
    let decoded = raw;
    try {
      decoded = decodeURIComponent(raw);
    } catch {
      decoded = raw;
    }

    const cleanBase = decoded
      .replace(/^uploads[/\\]attachments[/\\]/i, '')
      .replace(/^attachments[/\\]/i, '')
      .replace(/^\/?api\/process-audit\/(uploads\/attachments\/|attachments\/)?/i, '');

    const isNumeric = /^\d+$/.test(cleanBase);

    // 1. Fetch by primary key ID directly from MySQL
    if (isNumeric) {
      const [rows] = await pool.query(
        'SELECT id, filename, original_name, mime_type, file_size, file_data, uploaded_at FROM process_audit_attachment_files WHERE id = ? LIMIT 1',
        [parseInt(cleanBase, 10)]
      );
      if (rows.length > 0) return rows[0];
    }

    const ext = path.extname(cleanBase);
    const baseWithoutExt = path.basename(cleanBase, ext);
    const spaceVersion = cleanBase.replace(/_/g, ' ');
    const underscoreVersion = cleanBase.replace(/\s+/g, '_');

    // 2. Fetch by filename directly from MySQL
    const [matchRows] = await pool.query(
      `SELECT id, filename, original_name, mime_type, file_size, file_data, uploaded_at 
       FROM process_audit_attachment_files 
       WHERE filename = ? 
          OR original_name = ? 
          OR original_name = ?
          OR filename = ?
          OR original_name LIKE ?
          OR filename LIKE ?
          OR original_name LIKE ?
       ORDER BY id DESC LIMIT 1`,
      [
        cleanBase,
        cleanBase,
        spaceVersion,
        underscoreVersion,
        `%${cleanBase}%`,
        `%${cleanBase}%`,
        `%${baseWithoutExt}%`,
      ]
    );

    if (matchRows.length > 0) {
      return matchRows[0];
    }

    return null;
  },
};

export default Attachment;
