import path from 'path';
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
    const requests = await ProcessAuditRequest.findAll();
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

    const created = await ProcessAuditRequest.create(requestData);
    return successResponse(res, created, 'Production request created', 201);
  } catch (err) {
    return errorResponse(res, err.message);
  }
};
