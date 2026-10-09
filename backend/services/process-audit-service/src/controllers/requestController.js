import path from 'path';
import pool from '../../../shared/db.js';
import { ProcessAuditRequest } from '../models/Request.js';
import Attachment from '../models/Attachment.js';
import { successResponse, errorResponse } from '../../../shared/response.js';
import { broadcastEvent } from '../../../shared/realtimeNotifier.js';

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
      
      const userName = user || req.user?.name || req.user?.email || created_by || executor;
      const uId = req.query.user_id || req.user?.id || created_by_id;
      if (userName || uId) {
        filters.user = userName;
        filters.user_id = uId;
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
    const formatted = [];
    for (const file of files) {
      const saved = await Attachment.saveAttachment(file);
      formatted.push(saved);
    }
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
      const uploadedFiles = [];
      for (const file of req.files) {
        const saved = await Attachment.saveAttachment(file);
        uploadedFiles.push(saved);
      }
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

    // Auto-create in-app notification for assigned executor(s)
    if (created && created.executor) {
      try {
        const issueNo = created.issue_no || (created.id ? `PA-${created.id}` : 'PA-1');
        const creator = created.created_by || 'Quality Auditor';
        const dept = created.department || 'Production';
        const stage = created.model || 'Standard';
        const line = created.process_operation || 'General';

        const executorList = String(created.executor)
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);

        for (const execName of executorList) {
          // Resolve executor user_id if available
          const [execUserRows] = await pool.query(
            'SELECT id FROM users WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) OR LOWER(TRIM(email)) = LOWER(TRIM(?)) LIMIT 1',
            [execName, execName]
          ).catch(() => [[]]);
          const execUserId = execUserRows?.[0]?.id || null;

          await pool.query(
            `INSERT INTO process_audit_notifications 
             (user_name, user_id, request_id, issue_no, type, title, message, link) 
             VALUES (?, ?, ?, ?, 'approval_required', ?, ?, '/process-audit/approvals')`,
            [
              execName,
              execUserId,
              created.id,
              issueNo,
              `New Request Assigned: #${issueNo}`,
              `${creator} assigned request #${issueNo} (${dept}) to you for review and sign-off.`
            ]
          );
        }

        // Auto-create in-app notification for the request creator / requestor
        if (created.created_by) {
          await pool.query(
            `INSERT INTO process_audit_notifications 
             (user_name, user_id, request_id, issue_no, type, title, message, link) 
             VALUES (?, ?, ?, ?, 'request_created', ?, ?, '/process-audit/my-requests')`,
            [
              created.created_by,
              created.created_by_id || null,
              created.id,
              issueNo,
              `Request Created: #${issueNo}`,
              `Audit request #${issueNo} for ${dept} (${created.model || 'Process'}) has been raised and assigned to ${created.executor}.`
            ]
          );
        }
      } catch (notifErr) {
        console.warn('Failed to insert executor/creator notification:', notifErr.message);
      }
    }

    // Broadcast Realtime WebSocket Event
    broadcastEvent('process_audit:created', created);
    broadcastEvent('notifications:refresh', { module: 'process_audit', action: 'created', id: created.id });

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
      const uploadedFiles = [];
      for (const file of req.files) {
        const saved = await Attachment.saveAttachment(file);
        uploadedFiles.push(saved);
      }
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
      creator_remark: body.creator_remark || body.creatorRemark || body.remark || null,
      closed_by: body.closed_by || body.closedBy || req.user?.name || null,
      closed_by_id: body.closed_by_id || body.closedById || req.user?.id || null,
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

    if (updated) {
      const issueNo = updated.issue_no || (updated.id ? `PA-${updated.id}` : 'PA-1');
      const lowerStatus = status.toLowerCase();
      const isApproved = lowerStatus.includes('approved') || lowerStatus.includes('progress') || lowerStatus.includes('signed');
      const isRejected = lowerStatus.includes('reject');
      const isClosed = lowerStatus.includes('close');
      const isOpen = lowerStatus === 'open';

      // 1. When approved / signed off by executor: Notify Creator with direct deep-link to request
      if (isApproved && updated.created_by) {
        try {
          const msg = `${updated.executor} completed the sign-off for request #${issueNo}. Please review and close when ready.`;
          await pool.query(
            `INSERT INTO process_audit_notifications 
             (user_name, user_id, request_id, issue_no, type, title, message, link) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              updated.created_by.trim(),
              updated.created_by_id || null,
              updated.id,
              issueNo,
              'request_approved',
              `Request #${issueNo} Signed Off`,
              msg,
              `/process-audit/my-requests?requestId=${updated.id}`
            ]
          );
        } catch (notifErr) {
          console.warn('Failed to insert creator approval notification:', notifErr.message);
        }
      } else if (isRejected && updated.created_by) {
        // When rejected by executor
        try {
          const msg = rejectionReason
            ? `${updated.executor} could not sign off request #${issueNo}. Note: "${rejectionReason}"`
            : `${updated.executor} could not sign off request #${issueNo}.`;
          await pool.query(
            `INSERT INTO process_audit_notifications 
             (user_name, user_id, request_id, issue_no, type, title, message, link) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              updated.created_by.trim(),
              updated.created_by_id || null,
              updated.id,
              issueNo,
              'request_rejected',
              `Request #${issueNo} Needs Attention`,
              msg,
              `/process-audit/my-requests?requestId=${updated.id}`
            ]
          );
        } catch (notifErr) {
          console.warn('Failed to insert creator rejection notification:', notifErr.message);
        }
      }

      // 2. When creator reviews and marks Closed or Open: Notify Executor & mark creator's notification as read
      if ((isClosed || isOpen) && updated.executor) {
        try {
          // Mark creator's request_approved notification as read
          await pool.query(
            `UPDATE process_audit_notifications 
             SET is_read = 1 
             WHERE (request_id = ? OR issue_no = ?) AND type = 'request_approved'`,
            [updated.id, updated.issue_no || id]
          ).catch(() => {});

          const remarkText = details.creator_remark ? ` Remark: "${details.creator_remark}"` : '';
          const actionText = isClosed ? 'Closed' : 'Reopened';
          const msg = `Request #${issueNo} was marked as ${isClosed ? 'Closed' : 'Open'} by ${updated.created_by || 'Creator'}.${remarkText}`;

          await pool.query(
            `INSERT INTO process_audit_notifications 
             (user_name, user_id, request_id, issue_no, type, title, message, link) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              updated.executor.trim(),
              null,
              updated.id,
              issueNo,
              isClosed ? 'request_closed' : 'request_reopened',
              `Request #${issueNo} ${actionText}`,
              msg,
              `/process-audit/approvals?requestId=${updated.id}`
            ]
          );
        } catch (notifErr) {
          console.warn('Failed to insert executor closure notification:', notifErr.message);
        }
      }
    }

    // Broadcast Realtime WebSocket Event
    broadcastEvent('process_audit:updated', updated);
    broadcastEvent('notifications:refresh', { module: 'process_audit', action: 'updated', id: updated.id, status });

    return successResponse(res, updated, `Request status updated to ${status}`);
  } catch (err) {
    return errorResponse(res, err.message);
  }
};

export const reassignRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body || {};
    const { new_department, new_executor, reason } = body;

    if (!new_department || !new_executor) {
      return errorResponse(res, 'New department and new executor are required for reassignment', 400);
    }

    // Verify department authorization: Only INCOMING QUALITY or ADMIN can reassign
    const userId = req.user?.id || body.reassigned_by_id;
    const userName = req.user?.name || body.reassigned_by;
    const userRole = (req.user?.role || body.role || '').toUpperCase();
    const userDept = (req.user?.department || body.user_department || '').toUpperCase();

    let isAuthorized = userRole === 'ADMIN' || userDept === 'INCOMING QUALITY' || userDept.includes('INCOMING');
    if (!isAuthorized && (userId || userName)) {
      const [uRows] = await pool.query(
        'SELECT department, role FROM users WHERE id = ? OR LOWER(name) = LOWER(?) LIMIT 1',
        [userId || 0, userName || '']
      );
      if (uRows.length > 0) {
        const uD = (uRows[0].department || '').trim().toUpperCase();
        const uR = (uRows[0].role || '').trim().toUpperCase();
        if (uR === 'ADMIN' || uD === 'INCOMING QUALITY' || uD.includes('INCOMING')) {
          isAuthorized = true;
        }
      }
    }

    if (!isAuthorized) {
      return errorResponse(
        res,
        'Access Denied: Only personnel from INCOMING QUALITY or ADMIN are authorized to reassign requests.',
        403
      );
    }

    const reassignedByName = req.user?.name || body.reassigned_by || 'Quality Auditor';
    const reassignedById = req.user?.id || body.reassigned_by_id || null;

    const result = await ProcessAuditRequest.reassign(id, {
      new_department,
      new_executor,
      reason,
      reassigned_by: reassignedByName,
      reassigned_by_id: reassignedById,
    });

    const updated = result.updated;
    const issueNo = updated.issue_no || (updated.id ? `PA-${updated.id}` : 'PA-1');

    // Notify new executor and clean up old executor notification
    try {
      // Mark old executor approval notification as read
      await pool.query(
        `UPDATE process_audit_notifications 
         SET is_read = 1 
         WHERE (request_id = ? OR issue_no = ?) AND type = 'approval_required' AND LOWER(TRIM(user_name)) = LOWER(TRIM(?))`,
        [updated.id, issueNo, result.prevExec]
      ).catch(() => {});

      // Lookup new executor user_id
      const [execUserRows] = await pool.query(
        'SELECT id FROM users WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) LIMIT 1',
        [new_executor.trim()]
      ).catch(() => [[]]);
      const newExecUserId = execUserRows?.[0]?.id || null;

      const reasonText = reason ? ` Reason: "${reason}"` : '';
      const notifMsg = `Request #${issueNo} was reassigned to you by ${reassignedByName}.${reasonText}`;

      await pool.query(
        `INSERT INTO process_audit_notifications 
         (user_name, user_id, request_id, issue_no, type, title, message, link) 
         VALUES (?, ?, ?, ?, 'approval_required', ?, ?, '/process-audit/approvals')`,
        [
          new_executor.trim(),
          newExecUserId,
          updated.id,
          issueNo,
          `Request #${issueNo} Reassigned to You`,
          notifMsg
        ]
      );
    } catch (notifErr) {
      console.warn('Failed to insert reassignment notification:', notifErr.message);
    }

    // Broadcast Realtime WebSocket Event
    broadcastEvent('process_audit:reassigned', updated);
    broadcastEvent('notifications:refresh', { module: 'process_audit', action: 'reassigned', id: updated.id });

    return successResponse(res, updated, 'Request reassigned successfully');
  } catch (err) {
    return errorResponse(res, err.message);
  }
};

