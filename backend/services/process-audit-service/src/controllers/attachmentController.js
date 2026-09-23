import Attachment from '../models/Attachment.js';
import { errorResponse, successResponse } from '../../../shared/response.js';

/**
 * Stream binary attachment directly from MySQL database with inline disposition
 * Enables image rendering (<img src="...">) and PDF viewer (<iframe src="...">)
 */
export const getAttachment = async (req, res) => {
  try {
    const idOrFilename = req.params.id || req.params.filename;
    if (!idOrFilename) {
      return errorResponse(res, 'Attachment identifier is required', 400);
    }

    const fileRecord = await Attachment.getAttachmentByIdOrFilename(idOrFilename);
    if (!fileRecord || !fileRecord.file_data) {
      return errorResponse(res, 'Attachment not found in database', 404);
    }

    const mimeType = fileRecord.mime_type || 'application/octet-stream';
    const filename = fileRecord.original_name || fileRecord.filename || 'attachment';

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Length', fileRecord.file_data.length);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(filename)}"`);
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24h

    return res.end(fileRecord.file_data);
  } catch (err) {
    console.error('[Process Audit Service] Error streaming attachment:', err);
    return errorResponse(res, 'Failed to stream attachment: ' + err.message, 500);
  }
};

/**
 * Download binary attachment with attachment disposition (forces save-as)
 */
export const downloadAttachment = async (req, res) => {
  try {
    const idOrFilename = req.params.id || req.params.filename;
    if (!idOrFilename) {
      return errorResponse(res, 'Attachment identifier is required', 400);
    }

    const fileRecord = await Attachment.getAttachmentByIdOrFilename(idOrFilename);
    if (!fileRecord || !fileRecord.file_data) {
      return errorResponse(res, 'Attachment not found in database', 404);
    }

    const mimeType = fileRecord.mime_type || 'application/octet-stream';
    const filename = fileRecord.original_name || fileRecord.filename || 'attachment';

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Length', fileRecord.file_data.length);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);

    return res.end(fileRecord.file_data);
  } catch (err) {
    console.error('[Process Audit Service] Error downloading attachment:', err);
    return errorResponse(res, 'Failed to download attachment: ' + err.message, 500);
  }
};

/**
 * Return metadata about an attachment without streaming the heavy binary data
 */
export const getAttachmentInfo = async (req, res) => {
  try {
    const idOrFilename = req.params.id || req.params.filename;
    const fileRecord = await Attachment.getAttachmentByIdOrFilename(idOrFilename);
    if (!fileRecord) {
      return errorResponse(res, 'Attachment not found', 404);
    }

    return successResponse(res, {
      id: fileRecord.id,
      filename: fileRecord.filename,
      original_name: fileRecord.original_name,
      mime_type: fileRecord.mime_type,
      file_size: fileRecord.file_size,
      uploaded_at: fileRecord.uploaded_at,
      url: `/api/process-audit/attachments/${fileRecord.id}`,
    });
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
};
