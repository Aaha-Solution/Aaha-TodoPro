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
    const isAdmin = userRole === 'ADMIN';

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
        if (uRole !== 'ADMIN' && uDept !== 'INCOMING QUALITY') {
          return errorResponse(
            res,
            'Access Denied: Only personnel from the INCOMING QUALITY department are authorized to create Process Audit requests.',
            403
          );
        }
      }
    }

    const created = await ProcessAuditRequest.create(requestData);

    // Auto-create in-app notification for assigned executor
    if (created && created.executor) {
      try {
        const issueNo = created.issue_no || (created.id ? `PA-${created.id}` : 'PA-1');
        const creator = created.created_by || 'Quality Auditor';
        const dept = created.department || 'Production';
        const stage = created.model || 'Standard';
        const line = created.process_operation || 'General';

        // Resolve executor user_id if available
        const [execUserRows] = await pool.query(
          'SELECT id FROM users WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) LIMIT 1',
          [created.executor.trim()]
        ).catch(() => [[]]);
        const execUserId = execUserRows?.[0]?.id || null;

        await pool.query(
          `INSERT INTO process_audit_notifications 
           (user_name, user_id, request_id, issue_no, type, title, message, link) 
           VALUES (?, ?, ?, ?, 'approval_required', ?, ?, '/process-audit/approvals')`,
          [
            created.executor.trim(),
            execUserId,
            created.id,
            issueNo,
            `New Audit Request Assigned for Sign-off: #${issueNo}`,
            `Request #${issueNo} for ${dept} (${stage} - ${line}) has been assigned to you by ${creator}. Awaiting your review & sign-off.`
          ]
        );
      } catch (notifErr) {
        console.warn('Failed to insert executor notification:', notifErr.message);
      }
    }

    return successResponse(res, created, 'Production request created', 201);
  } catch (err) {
    return errorResponse(res, err.message);
  }
};

export const updateRequestStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body || {};
    const { status, rejectionReason } = body;
    if (!status) {
      return errorResponse(res, 'Status is required', 400);
    }

    let parsedActionAttachments = body.action_attachments || body.actionAttachments || null;
    if (typeof parsedActionAttachments === 'string') {
      try {
        parsedActionAttachments = JSON.parse(parsedActionAttachments);
      } catch {
        parsedActionAttachments = [];
      }
    }

    // If files were uploaded simultaneously with this status update
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
      parsedActionAttachments = Array.isArray(parsedActionAttachments)
        ? [...parsedActionAttachments, ...uploadedFiles]
        : uploadedFiles;
    }

    const details = {
      rejectionReason: rejectionReason || body.rejection_reason || null,
      root_cause: body.root_cause || body.rootCause || null,
      corrective_action: body.corrective_action || body.correctiveAction || null,
      action_attachments: parsedActionAttachments,
      standardization_details: body.standardization_details || body.standardizationDetails || null,
      target_date: body.target_date || body.targetDate || null,
      action_taken_by: body.action_taken_by || body.actionTakenBy || body.approved_by || body.approvedBy || req.user?.name || null,
      approved_by: body.approved_by || body.approvedBy || body.action_taken_by || body.actionTakenBy || req.user?.name || null,
      approved_by_id: body.approved_by_id || body.approvedById || req.user?.id || null,
      approved_by_email: body.approved_by_email || body.approvedByEmail || req.user?.email || null,
      approved_by_role: body.approved_by_role || body.approvedByRole || req.user?.role || null,
      comments: body.comments || null,
    };

    const updated = await ProcessAuditRequest.updateStatus(id, status, details);

    // Auto-mark the executor's approval notification as read once actioned
    if (updated) {
      try {
        await pool.query(
          `UPDATE process_audit_notifications 
           SET is_read = 1 
           WHERE (request_id = ? OR issue_no = ?) AND type = 'approval_required'`,
          [updated.id, updated.issue_no || id]
        );
      } catch (notifErr) {
        console.warn('Failed to update executor notification read status:', notifErr.message);
      }
    }

    // Auto-create notification for request creator
    if (updated && updated.created_by) {
      try {
        const issueNo = updated.issue_no || (updated.id ? `PA-${updated.id}` : 'PA-1');
        const isApproved = status.toLowerCase().includes('approved');
        const isRejected = status.toLowerCase().includes('reject');
        const actionWord = isApproved ? 'Approved' : isRejected ? 'Rejected' : status;
        const msg = isRejected && rejectionReason
          ? `Your audit request #${issueNo} was rejected by ${updated.executor}. Reason: ${rejectionReason}`
          : `Your audit request #${issueNo} was ${actionWord.toLowerCase()} by ${updated.executor}.`;

        await pool.query(
          `INSERT INTO process_audit_notifications 
           (user_name, user_id, request_id, issue_no, type, title, message, link) 
           VALUES (?, ?, ?, ?, ?, ?, ?, '/process-audit/my-requests')`,
          [
            updated.created_by.trim(),
            updated.created_by_id || null,
            updated.id,
            issueNo,
            isApproved ? 'request_approved' : 'request_rejected',
            `Audit Request #${issueNo} ${actionWord}`,
            msg
          ]
        );
      } catch (notifErr) {
        console.warn('Failed to insert creator notification:', notifErr.message);
      }
    }

    return successResponse(res, updated, `Request status updated to ${status}`);
  } catch (err) {
    return errorResponse(res, err.message);
  }
};
