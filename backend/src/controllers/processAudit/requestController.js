import { ProcessAuditRequest } from '../../models/processAudit/Request.js';
import { successResponse, errorResponse } from '../../utils/response.js';

export const getAllRequests = async (req, res) => {
  try {
    const requests = await ProcessAuditRequest.findAll();
    return successResponse(res, requests);
  } catch (err) {
    return errorResponse(res, err.message);
  }
};

export const createRequest = async (req, res) => {
  try {
    const created = await ProcessAuditRequest.create(req.body);
    return successResponse(res, created, 'Production request created', 201);
  } catch (err) {
    return errorResponse(res, err.message);
  }
};
