import path from 'path';
import pool from '../../../shared/db.js';
import { ProcessAuditRequest } from '../models/Request.js';
import { successResponse, errorResponse } from '../../../shared/response.js';

export const getNextId = async (req, res) => {
  try {
    const nextId = await ProcessAuditRequest.getNextId();
    return successResponse(res, { nextId });
  } catch (err) {
    return errorResponse(res, err.message);
  }
};

export const getAllRequests = async (req, res) => {
  try {
    const { created_by, created_by_id, executor, user, role } = req.query;

    const userRole = (role || req.user?.role || '').trim().toUpperCase();
    const isAdmin = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN' || userRole === 'SUPER ADMIN';

    const filters = {};
    if (!isAdmin) {
      if (created_by) filters.created_by = created_by;
      if (created_by_id) filters.created_by_id = created_by_id;
      if (executor) filters.executor = executor;
      if (user) {
        filters.user = user;
        filters.user_id = req.query.user_id || req.user?.id;
      }
    }

    const requests = await ProcessAuditRequest.findAll(filters);
    return successResponse(res, requests);
  } catch (err) {
    return errorResponse(res, err.message);
  }
};

export const uploadAttachments = async (req, res) => {
  try {
    const files = req.files || [];
    const formatted = files.map((file) => {
      const ext = path.extname(file.originalname).replace('.', '').toUpperCase();
      return {
        name: file.originalname,
        filename: file.filename,
        path: `uploads/attachments/${file.filename}`,
        url: `/api/process-audit/uploads/attachments/${file.filename}`,
        size: `${(file.size / (1024 * 1024)).toFixed(2)} MB`,
        type: ext,
      };
    });
    return successResponse(res, { files: formatted }, 'Files uploaded successfully');
  } catch (err) {
    return errorResponse(res, err.message);
  }
};

export const createRequest = async (req, res) => {
  try {
    const requestData = { ...req.body };

    // If attachments were sent as a JSON string (e.g. from multipart form)
    let parsedAttachments = [];
    if (requestData.attachments) {
      if (typeof requestData.attachments === 'string') {
        try {
          parsedAttachments = JSON.parse(requestData.attachments);
        } catch {
          parsedAttachments = [];
        }
      } else if (Array.isArray(requestData.attachments)) {
        parsedAttachments = requestData.attachments;
      }
    }

    // If files were uploaded simultaneously in this multipart request
    if (req.files && req.files.length > 0) {
      const uploadedFiles = req.files.map((file) => {
        const ext = path.extname(file.originalname).replace('.', '').toUpperCase();
        return {
          name: file.originalname,
          filename: file.filename,
          path: `uploads/attachments/${file.filename}`,
          url: `/api/process-audit/uploads/attachments/${file.filename}`,
          size: `${(file.size / (1024 * 1024)).toFixed(2)} MB`,
          type: ext,
        };
      });
      parsedAttachments = [...parsedAttachments, ...uploadedFiles];
    }

    requestData.attachments = parsedAttachments;
    requestData.created_by = requestData.created_by || req.user?.name || req.user?.email || null;
    requestData.created_by_id = requestData.created_by_id || req.user?.id || null;

    // Verify department authorization: Only INCOMING QUALITY department (or Admin) can create requests
    const creatorId = requestData.created_by_id || req.user?.id;
    if (creatorId || requestData.created_by) {
      const [uRows] = await pool.query(
        'SELECT department, role FROM users WHERE id = ? OR LOWER(name) = LOWER(?) OR LOWER(email) = LOWER(?) LIMIT 1',
        [creatorId || 0, requestData.created_by || '', requestData.created_by || '']
      );
      if (uRows.length > 0) {
        const uDept = (uRows[0].department || '').trim().toUpperCase();
        const uRole = (uRows[0].role || '').trim().toUpperCase();
        if (uRole !== 'ADMIN' && uRole !== 'SUPER_ADMIN' && uRole !== 'SUPER ADMIN' && uDept !== 'INCOMING QUALITY') {
          return errorResponse(
            res,
            'Access Denied: Only personnel from the INCOMING QUALITY department are authorized to create Process Audit requests.',
            403
          );
        }
      }
    }

    const created = await ProcessAuditRequest.create(requestData);
    return successResponse(res, created, 'Production request created', 201);
  } catch (err) {
    return errorResponse(res, err.message);
  }
};

export const updateRequestStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, rejectionReason } = req.body;
    if (!status) {
      return errorResponse(res, 'Status is required', 400);
    }
    const updated = await ProcessAuditRequest.updateStatus(id, status, rejectionReason);
    return successResponse(res, updated, `Request status updated to ${status}`);
  } catch (err) {
    return errorResponse(res, err.message);
  }
};
