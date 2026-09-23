import { Approval } from '../models/Approval.js';
import { successResponse, errorResponse } from '../../../shared/response.js';

export const getAllApprovals = async (req, res) => {
  try {
    const filters = {
      requestId: req.query.request_id || req.query.requestId,
      issueNo: req.query.issue_no || req.query.issueNo,
      approvedBy: req.query.approved_by || req.query.approvedBy,
    };
    const approvals = await Approval.getApprovals(filters);
    return successResponse(res, approvals, 'Approvals retrieved successfully');
  } catch (err) {
    console.error('Failed to get approvals:', err);
    return errorResponse(res, err.message, 500);
  }
};

export const getApprovalByRequestId = async (req, res) => {
  try {
    const { id } = req.params;
    const approval = await Approval.getApprovalByRequestId(id);
    if (!approval) {
      return errorResponse(res, 'No approval found for this request', 404);
    }
    return successResponse(res, approval, 'Approval details retrieved');
  } catch (err) {
    console.error('Failed to get approval details:', err);
    return errorResponse(res, err.message, 500);
  }
};
