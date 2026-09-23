import path from 'path';
import { successResponse, errorResponse } from '../../../shared/response.js';
import { IhlrRequest } from '../models/IhlrRequest.js';
import { IhlrAttachment } from '../models/IhlrAttachment.js';

// In-memory fallback if DB is not reachable
let fallbackRequests = [];

export const getNextReqNo = async (req, res) => {
  try {
    let nextReqNo = await IhlrRequest.getNextReqNo();
    if (!nextReqNo) {
      let max = 0;
      for (const r of fallbackRequests) {
        const match = String(r.req_no || '').match(/(\d+)/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > max) max = num;
        }
      }
      nextReqNo = `IHLR-${max + 1}`;
    }
    return successResponse(res, { nextReqNo }, 'Next Request Number calculated');
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

export const getDashboardStats = async (req, res) => {
  try {
    let requests = await IhlrRequest.getAll();
    if (!requests) requests = fallbackRequests;

    const total = requests.length;
    const open = requests.filter(r => r.status === 'OPEN').length;
    const inProgress = requests.filter(r => r.status === 'IN_PROGRESS').length;
    const closed = requests.filter(r => r.status === 'CLOSED').length;

    const fourMBreakdown = {
      MAN: requests.filter(r => (r.four_m || '').toUpperCase() === 'MAN').length,
      MACHINE: requests.filter(r => (r.four_m || '').toUpperCase() === 'MACHINE').length,
      METHOD: requests.filter(r => (r.four_m || '').toUpperCase() === 'METHOD').length,
      MATERIAL: requests.filter(r => (r.four_m || '').toUpperCase() === 'MATERIAL').length,
    };

    return successResponse(res, {
      total,
      open,
      inProgress,
      closed,
      fourMBreakdown,
      recentRequests: requests.slice(0, 5)
    }, 'IHLR dashboard metrics retrieved successfully');
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

export const getIhlrRequests = async (req, res) => {
  try {
    let requests = await IhlrRequest.getAll();
    if (!requests) requests = fallbackRequests;

    const { search, shift, fourM, status } = req.query;

    if (search) {
      const q = search.toLowerCase();
      requests = requests.filter(r => 
        (r.problem && r.problem.toLowerCase().includes(q)) ||
        (r.model && r.model.toLowerCase().includes(q)) ||
        (r.received_from && r.received_from.toLowerCase().includes(q)) ||
        (r.analysis_done_by && r.analysis_done_by.toLowerCase().includes(q)) ||
        (String(r.req_no) && String(r.req_no).toLowerCase().includes(q))
      );
    }

    if (shift && shift !== 'All') {
      const s = String(shift).trim().toLowerCase();
      requests = requests.filter(r => {
        const reqShift = String(r.shift || '').trim().toLowerCase();
        return reqShift === s ||
          reqShift.replace('shift', '').trim() === s.replace('shift', '').trim() ||
          (s.includes('1') && (reqShift === '1' || reqShift === 'i' || reqShift === 'shift 1' || reqShift === 'shift i')) ||
          (s.includes('2') && (reqShift === '2' || reqShift === 'ii' || reqShift === 'shift 2' || reqShift === 'shift ii')) ||
          (s.includes('3') && (reqShift === '3' || reqShift === 'iii' || reqShift === 'shift 3' || reqShift === 'shift iii'));
      });
    }

    if (fourM && fourM !== 'All') {
      requests = requests.filter(r => (r.four_m || '').toUpperCase() === fourM.toUpperCase());
    }

    if (status && status !== 'All') {
      requests = requests.filter(r => (r.status || '').toUpperCase() === status.toUpperCase());
    }

    return successResponse(res, requests, 'IHLR requests retrieved successfully');
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

export const getIhlrRequestById = async (req, res) => {
  try {
    const { id } = req.params;
    let request = await IhlrRequest.getById(id);
    if (!request) {
      request = fallbackRequests.find(r => String(r.id) === String(id));
    }

    if (!request) {
      return errorResponse(res, 'IHLR Request not found', 404);
    }

    return successResponse(res, request, 'IHLR request details retrieved');
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

export const createIhlrRequest = async (req, res) => {
  try {
    const data = req.body;
    if (!data.problem || !data.model) {
      return errorResponse(res, 'Problem description and Model are required', 400);
    }

    let created = await IhlrRequest.create(data);
    if (!created) {
      const newId = fallbackRequests.length > 0 ? Math.max(...fallbackRequests.map(r => r.id)) + 1 : 1;
      let calculatedReqNo = data.req_no;
      if (!calculatedReqNo) {
        let max = 0;
        for (const r of fallbackRequests) {
          const match = String(r.req_no || '').match(/(\d+)/);
          if (match) {
            const num = parseInt(match[1], 10);
            if (num > max) max = num;
          }
        }
        calculatedReqNo = `IHLR-${max + 1}`;
      }
      created = {
        id: newId,
        req_no: calculatedReqNo,
        batch_date: data.batch_date || new Date().toISOString().split('T')[0],
        shift: data.shift || 'I',
        problem: data.problem,
        model: data.model,
        problem_detected_at: data.problem_detected_at || '',
        received_from: data.received_from || '',
        analysis_done_by: data.analysis_done_by || '',
        defect_image: data.defect_image || '',
        qa_why_why: data.qa_why_why || [],
        actual_qty: data.actual_qty ? Number(data.actual_qty) : 1,
        four_m: data.four_m || 'MAN',
        resp: data.resp || 'PRODUCTION',
        resp_person: data.resp_person || '',
        prod_why_why: data.prod_why_why || [],
        action: data.action || '',
        evidence_attachment: data.evidence_attachment || '',
        target_date: data.target_date || null,
        remarks: data.remarks || '',
        status: data.status || 'OPEN',
        created_at: new Date().toISOString()
      };
      fallbackRequests.unshift(created);
    }

    return successResponse(res, created, 'IHLR request created successfully', 201);
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

export const updateIhlrRequest = async (req, res) => {
  try {
    const { id } = req.params;
    let updated = await IhlrRequest.update(id, req.body);
    if (!updated) {
      const idx = fallbackRequests.findIndex(r => String(r.id) === String(id));
      if (idx !== -1) {
        fallbackRequests[idx] = { ...fallbackRequests[idx], ...req.body, updated_at: new Date().toISOString() };
        updated = fallbackRequests[idx];
      }
    }

    if (!updated) {
      return errorResponse(res, 'IHLR Request not found to update', 404);
    }

    return successResponse(res, updated, 'IHLR request updated successfully');
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

export const deleteIhlrRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await IhlrRequest.delete(id);
    if (!deleted) {
      fallbackRequests = fallbackRequests.filter(r => String(r.id) !== String(id));
    }
    return successResponse(res, { id }, 'IHLR request deleted successfully');
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

export const getIhlrNotifications = async (req, res) => {
  try {
    const requests = (await IhlrRequest.getAll()) || [];
    const notifications = requests.slice(0, 15).map((r) => {
      const isClosed = (r.status || '').toUpperCase() === 'CLOSED';
      const isInProgress = (r.status || '').toUpperCase() === 'IN_PROGRESS';
      let title = 'New IHLR Report Logged';
      let msg = `${String(r.req_no).startsWith('IHLR-') ? r.req_no : `#${r.req_no}`} (Model: ${r.model || '—'}) reported at ${r.problem_detected_at || 'Line'} with defect "${r.problem || '—'}".`;

      if (isClosed) {
        title = 'IHLR Case Closed';
        msg = `${String(r.req_no).startsWith('IHLR-') ? r.req_no : `#${r.req_no}`} (${r.model || '—'}) verified and closed.`;
      } else if (isInProgress) {
        title = 'Occurrence Cause Updated';
        msg = `Corrective countermeasure in progress for ${String(r.req_no).startsWith('IHLR-') ? r.req_no : `#${r.req_no}`} (${r.model || '—'}). Target Date: ${r.target_date ? String(r.target_date).split('T')[0] : 'TBD'}.`;
      }

      return {
        id: r.id,
        title,
        message: msg,
        date: r.created_at ? new Date(r.created_at).toLocaleString('en-US', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Recent',
        status: r.status || 'OPEN',
        read: false
      };
    });

    return successResponse(res, notifications, 'IHLR notifications retrieved');
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

export const uploadAttachments = async (req, res) => {
  try {
    const files = req.files || [];
    const savedFiles = [];

    for (const file of files) {
      const ext = path.extname(file.originalname).replace('.', '').toUpperCase();
      const cleanBase = path.basename(file.originalname, path.extname(file.originalname)).replace(/[^a-zA-Z0-9_-]/g, '_');
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e6);
      const uniqueFilename = `${cleanBase}-${uniqueSuffix}.${ext.toLowerCase()}`;

      // Insert binary buffer directly into MySQL LONGBLOB
      const saved = await IhlrAttachment.create({
        filename: uniqueFilename,
        original_name: file.originalname,
        mime_type: file.mimetype || 'application/octet-stream',
        file_size: file.size,
        file_data: file.buffer,
        request_id: req.body.request_id || null
      });

      savedFiles.push({
        id: saved.id,
        name: file.originalname,
        filename: uniqueFilename,
        path: `attachments/binary/${saved.id}`,
        url: `/api/ihlr/attachments/binary/${saved.id}`,
        size: `${(file.size / (1024 * 1024)).toFixed(2)} MB`,
        type: ext,
      });
    }

    return successResponse(res, { files: savedFiles }, 'Files uploaded and stored in database successfully');
  } catch (err) {
    console.error('Binary upload error:', err);
    return errorResponse(res, err.message);
  }
};

/**
 * Stream binary attachment directly from MySQL database by numeric ID or filename
 */
export const getBinaryAttachment = async (req, res) => {
  try {
    const { id } = req.params;
    let attachment = await IhlrAttachment.getById(id);

    if (!attachment) {
      attachment = await IhlrAttachment.getByFilename(id);
    }

    if (!attachment || !attachment.file_data) {
      return res.status(404).send('Attachment not found in database');
    }

    // Set binary response headers
    res.setHeader('Content-Type', attachment.mime_type || 'application/octet-stream');
    res.setHeader('Content-Length', attachment.file_size || attachment.file_data.length);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(attachment.original_name || attachment.filename)}"`
    );
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24h

    return res.end(attachment.file_data);
  } catch (err) {
    console.error('Failed to stream binary attachment from DB:', err);
    return res.status(500).send('Error streaming binary attachment: ' + err.message);
  }
};

/**
 * Stream binary attachment by unique filename
 */
export const getBinaryAttachmentByFilename = async (req, res) => {
  try {
    const { filename } = req.params;
    const attachment = await IhlrAttachment.getByFilename(filename);

    if (!attachment || !attachment.file_data) {
      return res.status(404).send('Attachment not found in database');
    }

    res.setHeader('Content-Type', attachment.mime_type || 'application/octet-stream');
    res.setHeader('Content-Length', attachment.file_size || attachment.file_data.length);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(attachment.original_name || attachment.filename)}"`
    );
    res.setHeader('Cache-Control', 'public, max-age=86400');

    return res.end(attachment.file_data);
  } catch (err) {
    console.error('Failed to stream binary attachment by filename from DB:', err);
    return res.status(500).send('Error streaming binary attachment: ' + err.message);
  }
};
