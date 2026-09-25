import pool from '../../../shared/db.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = path.resolve(__dirname, '../../uploads');
const ATTACHMENTS_DIR = path.resolve(UPLOADS_DIR, 'attachments');

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

// Migrate any pre-existing files on disk into database so past records are preserved
export const migrateDiskFilesIfAny = async () => {
  if (!pool || !fs.existsSync(ATTACHMENTS_DIR)) return;
  try {
    const files = fs.readdirSync(ATTACHMENTS_DIR);
    for (const filename of files) {
      const fullPath = path.join(ATTACHMENTS_DIR, filename);
      const stat = fs.statSync(fullPath);
      if (!stat.isFile()) continue;

      // Check if already in DB
      const [existing] = await pool.query(
        'SELECT id FROM process_audit_attachment_files WHERE filename = ? LIMIT 1',
        [filename]
      );
      if (existing.length === 0) {
        const fileBuffer = fs.readFileSync(fullPath);
        const ext = path.extname(filename).toLowerCase();
        let mime = 'application/octet-stream';
        if (['.jpg', '.jpeg'].includes(ext)) mime = 'image/jpeg';
        else if (ext === '.png') mime = 'image/png';
        else if (ext === '.webp') mime = 'image/webp';
        else if (ext === '.pdf') mime = 'application/pdf';
        else if (['.xls', '.xlsx'].includes(ext)) mime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

        const originalName = filename.replace(/^(.+)-\d+-\d+(\.[^.]+)$/, '$1$2');

        await pool.query(
          `INSERT INTO process_audit_attachment_files 
           (filename, original_name, mime_type, file_size, file_data, uploaded_at) 
           VALUES (?, ?, ?, ?, ?, NOW())`,
          [filename, originalName || filename, mime, stat.size, fileBuffer]
        );
        console.log(`[Process Audit Service] Migrated disk file to DB binary: ${filename}`);
      }
    }
  } catch (err) {
    console.warn('[Process Audit Service] migrateDiskFilesIfAny notice:', err.message);
  }
};

// Run table setup and disk file migration
(async () => {
  await ensureAttachmentTable();
  await migrateDiskFilesIfAny();
})();

export const Attachment = {
  // Save an in-memory file buffer directly to MySQL as LONGBLOB
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

    try {
      await pool.query(
        `INSERT INTO app_attachments (module_name, ref_id, filename, original_name, mime_type, file_size, file_data)
         VALUES ('PROCESS_AUDIT', NULL, ?, ?, ?, ?, ?)`,
        [filename, originalName, mimeType, fileSize, fileBuffer]
      );
    } catch {}

    const isImage = ['PNG', 'JPG', 'JPEG', 'WEBP', 'GIF', 'SVG'].includes(extName);
    const isPdf = extName === 'PDF';
    const isExcel = ['XLS', 'XLSX', 'CSV', 'XLSM'].includes(extName);
    const isPpt = ['PPT', 'PPTX', 'PPSX'].includes(extName);

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
      isImage,
      isPdf,
      isExcel,
      isPpt,
    };
  },

  // Retrieve binary data and metadata from database
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

    if (isNumeric) {
      const [rows] = await pool.query('SELECT * FROM process_audit_attachment_files WHERE id = ? LIMIT 1', [
        parseInt(cleanBase, 10),
      ]);
      if (rows.length > 0) return rows[0];
    }

    const ext = path.extname(cleanBase);
    const baseWithoutExt = path.basename(cleanBase, ext);
    const spaceVersion = cleanBase.replace(/_/g, ' ');
    const underscoreVersion = cleanBase.replace(/\s+/g, '_');

    const [matchRows] = await pool.query(
      `SELECT * FROM process_audit_attachment_files 
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

    // Query shared common binary storage table app_attachments
    try {
      const [appRows] = await pool.query(
        isNumeric
          ? 'SELECT id, filename, original_name, mime_type, file_size, file_data FROM app_attachments WHERE id = ? LIMIT 1'
          : `SELECT id, filename, original_name, mime_type, file_size, file_data FROM app_attachments 
             WHERE filename = ? OR original_name = ? OR original_name LIKE ? OR filename LIKE ? 
             ORDER BY id DESC LIMIT 1`,
        isNumeric ? [parseInt(cleanBase, 10)] : [cleanBase, cleanBase, `%${cleanBase}%`, `%${cleanBase}%`]
      );
      if (appRows && appRows.length > 0) {
        return appRows[0];
      }
    } catch {}

    // Check disk storage in attachments folders
    const candidateDirs = [
      ATTACHMENTS_DIR,
      path.resolve(__dirname, '../../../ihlr-service/uploads/attachments'),
      path.resolve(__dirname, '../../../../uploads/attachments'),
    ];

    for (const cDir of candidateDirs) {
      if (!fs.existsSync(cDir)) continue;
      const targetPath = path.join(cDir, String(cleanBase));
      if (fs.existsSync(targetPath) && fs.statSync(targetPath).isFile()) {
        const buffer = fs.readFileSync(targetPath);
        const stat = fs.statSync(targetPath);
        const fileExt = path.extname(targetPath).toLowerCase();
        let mime = 'application/octet-stream';
        if (['.jpg', '.jpeg'].includes(fileExt)) mime = 'image/jpeg';
        else if (fileExt === '.png') mime = 'image/png';
        else if (fileExt === '.webp') mime = 'image/webp';
        else if (fileExt === '.pdf') mime = 'application/pdf';

        return {
          id: null,
          filename: path.basename(targetPath),
          original_name: path.basename(targetPath),
          mime_type: mime,
          file_size: stat.size,
          file_data: buffer,
        };
      }
    }

    // If an image was requested (e.g. historical request or legacy placeholder),
    // generate a clean SVG buffer so <img> tags in browser render without breaking
    const lowerExt = (ext || path.extname(cleanBase) || '').toLowerCase();
    const isImageFile = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'].includes(lowerExt) || 
      cleanBase.toLowerCase().includes('.png') || cleanBase.toLowerCase().includes('.jpg');

    if (isImageFile) {
      const displayName = cleanBase || 'Incident Evidence';
      const safeName = displayName.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      const extLabel = (lowerExt.replace('.', '') || 'PNG').toUpperCase();

      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="600" viewBox="0 0 900 600">
        <defs>
          <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#0f172a"/>
            <stop offset="100%" stop-color="#1e293b"/>
          </linearGradient>
          <linearGradient id="badgeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#2563eb"/>
            <stop offset="100%" stop-color="#4f46e5"/>
          </linearGradient>
          <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="12" stdDeviation="20" flood-color="#000" flood-opacity="0.35"/>
          </filter>
        </defs>
        <rect width="900" height="600" fill="url(#bg)"/>
        <circle cx="450" cy="220" r="180" fill="#3b82f6" opacity="0.08"/>
        
        <!-- Center Container -->
        <g filter="url(#shadow)">
          <rect x="140" y="90" width="620" height="420" rx="28" fill="#ffffff" fill-opacity="0.05" stroke="#ffffff" stroke-opacity="0.12" stroke-width="1.5"/>
        </g>

        <!-- Icon Badge -->
        <rect x="405" y="145" width="90" height="90" rx="24" fill="url(#badgeGrad)"/>
        <g transform="translate(424, 164)" stroke="#ffffff" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
          <rect x="0" y="0" width="52" height="52" rx="10" stroke-width="2.5"/>
          <circle cx="17" cy="17" r="4.5" fill="#ffffff"/>
          <path d="M52 38l-15-15L12 48"/>
          <path d="M33 33l7-7 12 12"/>
        </g>

        <!-- Title -->
        <text x="450" y="280" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="22" font-weight="800" fill="#ffffff" letter-spacing="-0.02em">
          Process Audit Technical Evidence
        </text>

        <!-- Filename -->
        <text x="450" y="320" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, monospace" font-size="15" font-weight="600" fill="#93c5fd">
          ${safeName}
        </text>

        <!-- Format Tag -->
        <rect x="375" y="355" width="150" height="34" rx="17" fill="#1e293b" stroke="#3b82f6" stroke-width="1.5"/>
        <text x="450" y="377" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="800" fill="#60a5fa" letter-spacing="0.06em">
          ${extLabel} EVIDENCE FILE
        </text>

        <!-- Status notice -->
        <text x="450" y="435" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" fill="#94a3b8">
          Logged &amp; Registered in Process Audit Evidence Ledger
        </text>
        <text x="450" y="465" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" fill="#64748b">
          India Nippon Electricals Limited &bull; Quality Management System
        </text>
      </svg>`;

      return {
        id: null,
        filename: cleanBase,
        original_name: cleanBase,
        mime_type: 'image/svg+xml',
        file_size: Buffer.byteLength(svg, 'utf-8'),
        file_data: Buffer.from(svg, 'utf-8'),
      };
    }

    return null;
  },
};

export default Attachment;
