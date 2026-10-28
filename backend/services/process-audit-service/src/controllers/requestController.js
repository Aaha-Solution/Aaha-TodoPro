import path from 'path';
import pool from '../../../shared/db.js';
import { verifyToken } from '../../../shared/jwt.js';
import { ProcessAuditRequest } from '../models/Request.js';
import Attachment from '../models/Attachment.js';
import { successResponse, errorResponse } from '../../../shared/response.js';
import { broadcastEvent } from '../../../shared/realtimeNotifier.js';
import { sendProcessAuditRequestEmails, sendProcessAuditCloserEmails, sendEmail, generateEmailTemplate } from '../../../shared/mailer.js';

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
    const { created_by, created_by_id, executor, user, role, scope, is_dashboard, all, department } = req.query;

    const authHeader = req.headers.authorization;
    let tokenUser = null;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        tokenUser = verifyToken(authHeader.split(' ')[1]);
      } catch {}
    }

    const userRole = (role || tokenUser?.role || req.user?.role || '').trim().toUpperCase();
    const userDept = (req.query.user_department || req.query.department_user || tokenUser?.department || req.user?.department || '').trim().toUpperCase();
    const isAdmin = userRole === 'ADMIN' || userDept === 'QAD';
    const isDashboardScope = scope === 'dashboard' || is_dashboard === 'true' || all === 'true';

    const filters = {};

    const targetDept = (req.query.filter_dept || req.query.filterDept || (department && department.trim().toUpperCase() !== 'ALL' ? department.trim() : '')).trim();

    // Requests are common plant-wide for all departments. Filter by department only when an explicit filter is specified.
    let effectiveDept = null;
    if (targetDept && targetDept.toUpperCase() !== 'ALL') {
      effectiveDept = targetDept;
    }

    if (effectiveDept) {
      filters.department = effectiveDept;
    }

    const isMyRequestsScope = scope === 'my' || scope === 'my_requests' || req.query.my === 'true';
    if (isMyRequestsScope && !isAdmin) {
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

    if (requestData.escalation_date) {
      const escStr = String(requestData.escalation_date).split('T')[0];
      const todayStr = new Date().toISOString().split('T')[0];
      if (escStr > todayStr) {
        return errorResponse(res, 'Escalation Date cannot be a future date. Please select today or a past date.', 400);
      }
    }

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

    // Resolve Creator User details
    let creatorUser = {
      id: requestData.created_by_id || req.user?.id || null,
      name: requestData.created_by || req.user?.name || 'Quality Auditor',
      email: req.user?.email || null,
      department: req.user?.department || 'QAD'
    };

    if (pool && (!creatorUser.email || !creatorUser.id)) {
      const [uRows] = await pool.query(
        'SELECT id, name, email, department, role FROM users WHERE id = ? OR (email IS NOT NULL AND LOWER(email) = LOWER(?)) OR (name IS NOT NULL AND LOWER(name) = LOWER(?)) LIMIT 1',
        [creatorUser.id || 0, creatorUser.email || '', creatorUser.name || '']
      ).catch(() => [[]]);
      if (uRows && uRows.length > 0) {
        creatorUser = {
          id: uRows[0].id,
          name: uRows[0].name,
          email: uRows[0].email,
          department: uRows[0].department || 'QAD',
          role: uRows[0].role
        };
      }
    }

    // Verify department authorization: Authenticated user must be from QAD, Production, or ADMIN
    const uDept = (creatorUser.department || '').trim().toUpperCase();
    const uRole = (creatorUser.role || req.user?.role || '').trim().toUpperCase();
    if (uRole !== 'ADMIN' && uDept !== 'QAD' && uDept !== 'PRODUCTION') {
      return errorResponse(
        res,
        'Access Denied: Only personnel from QAD, Production, or Admin are authorized to create Process Audit requests.',
        403
      );
    }

    // Resolve Executor(s) list and their user accounts for notifications & emails
    const executorList = String(requestData.executor || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const assignedUsersList = [];
    if (executorList.length > 0) {
      for (const execName of executorList) {
        let [execUserRows] = await pool.query(
          'SELECT id, name, email, department FROM users WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) OR LOWER(TRIM(email)) = LOWER(TRIM(?)) LIMIT 1',
          [execName, execName]
        ).catch(() => [[]]);

        if (execUserRows && execUserRows.length > 0) {
          assignedUsersList.push(execUserRows[0]);
        } else {
          assignedUsersList.push({
            id: null,
            name: execName,
            email: `${execName.toLowerCase().replace(/\s+/g, '')}@gmail.com`,
            department: requestData.department || 'Production'
          });
        }
      }
    } else {
      assignedUsersList.push({
        id: null,
        name: 'Assigned Executor',
        email: 'executor@gmail.com',
        department: requestData.department || 'Production'
      });
    }

    const assignedUser = assignedUsersList[0];
    const combinedAssignedEmails = assignedUsersList.map((u) => u.email).filter(Boolean).join(', ');

    requestData.created_by = (requestData.created_by && String(requestData.created_by).replace(/[0-9]/g, '').trim()) || creatorUser.name;
    requestData.created_by_id = creatorUser.id || requestData.created_by_id;
    requestData.created_by_email = creatorUser.email || requestData.created_by_email;
    requestData.executor_email = combinedAssignedEmails || assignedUser.email;

    const created = await ProcessAuditRequest.create(requestData);
    const issueNo = created.issue_no || (created.id ? `PA-${created.id}` : 'PA-1');
    const assignedNamesDisplay = assignedUsersList.map((u) => u.name).join(', ') || assignedUser.name;

    // 1. Insert In-App Notifications: exactly matching IHLR architecture
    if (pool && created) {
      try {
        // Notification A: For Raised Person (Confirmation)
        await pool.query(
          `INSERT INTO process_audit_notifications 
           (user_id, user_name, user_email, request_id, issue_no, type, title, message, link, is_read) 
           VALUES (?, ?, ?, ?, ?, 'submission_confirmed', ?, ?, '/process-audit/all-requests', 0)`,
          [
            creatorUser.id,
            creatorUser.name,
            creatorUser.email,
            created.id,
            issueNo,
            `Process Audit Finding Logged: #${issueNo}`,
            `Your Process Audit observation report for "${created.model || created.product || 'Audit'}" has been logged and assigned to ${assignedNamesDisplay} (${created.department || 'Production'}).`
          ]
        ).catch((e) => console.warn('[PA Notification A Error]:', e.message));

        // Notification B: For Each Assigned Executor in the field (Action Required)
        for (const userItem of assignedUsersList) {
          await pool.query(
            `INSERT INTO process_audit_notifications 
             (user_id, user_name, user_email, request_id, issue_no, type, title, message, link, is_read) 
             VALUES (?, ?, ?, ?, ?, 'assignment_required', ?, ?, '/process-audit/approvals', 0)`,
            [
              userItem.id,
              userItem.name,
              userItem.email,
              created.id,
              issueNo,
              `Action Required: Process Audit #${issueNo} Assigned`,
              `Process Audit report #${issueNo} (${created.model || 'Process'} - "${created.issue_observation || created.problem || 'Observation'}") has been assigned to you by ${creatorUser.name}. Please inspect and submit root cause action.`
            ]
          ).catch((e) => console.warn('[PA Notification B Error]:', e.message));
        }
      } catch (notifErr) {
        console.warn('[Process Audit Notifications] Error inserting multi-user in-app notifications:', notifErr.message);
      }
    }

    // 2. Trigger Emails to Raised Person AND All Assigned Executors
    try {
      let isFirst = true;
      for (const userItem of assignedUsersList) {
        sendProcessAuditRequestEmails({
          request: created,
          creatorUser,
          assignedUser: userItem,
          skipCreator: !isFirst
        }).catch((mailErr) => console.warn('[Process Audit Mailer] Non-blocking email dispatch warning:', mailErr.message));
        isFirst = false;
      }
    } catch (mailSyncErr) {
      console.warn('[Process Audit Mailer] Sync email dispatch warning:', mailSyncErr.message);
    }

    // 3. Broadcast Realtime WebSocket Event
    broadcastEvent('process_audit:created', created);
    broadcastEvent('notifications:refresh', { module: 'process_audit', action: 'created', id: created.id, reqNo: issueNo });

    return successResponse(res, created, 'Process audit request created successfully. Notifications and emails dispatched to both auditor and assigned executor.', 201);
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
      action_taken_by: body.temporary_closed_by || body.action_taken_by || body.actionTakenBy || body.approved_by || body.approvedBy || req.user?.name || null,
      approved_by: body.approved_by || body.approvedBy || body.action_taken_by || body.actionTakenBy || req.user?.name || null,
      approved_by_id: body.approved_by_id || body.approvedById || req.user?.id || null,
      approved_by_email: body.approved_by_email || body.approvedByEmail || req.user?.email || null,
      approved_by_role: body.approved_by_role || body.approvedByRole || req.user?.role || null,
      comments: body.comments || null,
      creator_remark: body.creator_remark || body.creatorRemark || body.remark || null,
      reviewed_by: body.reviewed_by || body.reviewedBy || body.approved_by || body.approvedBy || null,
      reviewed_by_id: body.reviewed_by_id || body.reviewedById || body.approved_by_id || body.approvedById || null,
      reviewed_by_email: body.reviewed_by_email || body.reviewedByEmail || body.approved_by_email || body.approvedByEmail || null,
      closed_by: body.closed_by !== undefined ? body.closed_by : (body.closedBy !== undefined ? body.closedBy : (body.permanent_closed_by || (String(status).toLowerCase() === 'closed' ? req.user?.name : null))),
      closed_by_id: body.closed_by_id || body.closedById || req.user?.id || null,
      prod_why_why: body.prod_why_why || null,
      temporary_action: body.temporary_action || null,
      temporary_evidence_attachment: body.temporary_evidence_attachment || null,
      temporary_target_date: body.temporary_target_date || null,
      permanent_fix: body.permanent_fix || null,
      permanent_evidence_attachment: body.permanent_evidence_attachment || null,
      permanent_target_date: body.permanent_target_date || null,
      temporary_closed_by: body.temporary_closed_by !== undefined ? body.temporary_closed_by : (body.action_taken_by || null),
      permanent_closed_by: body.permanent_closed_by !== undefined ? body.permanent_closed_by : null,
      closer_updated_by: req.user?.name || body.closer_updated_by || body.closerUpdatedBy || null,
      closer_updated_by_id: req.user?.id || body.closer_updated_by_id || body.closerUpdatedById || null,
      closer_updated_by_email: req.user?.email || body.closer_updated_by_email || body.closerUpdatedByEmail || null
    };

    // Retrieve previous state to detect transitions
    const numericId = parseInt(String(id).replace(/\D/g, ''), 10) || id;
    const [existingRows] = await pool.query(
      'SELECT * FROM process_audit_requests WHERE id = ? OR issue_no = ?',
      [numericId, String(id)]
    ).catch(() => [[]]);
    const existing = existingRows?.[0] || null;

    if (existing && String(existing.status || '').toUpperCase() === 'CLOSED') {
      return errorResponse(res, 'This request is closed and cannot be edited.', 403);
    }

    const updated = await ProcessAuditRequest.updateStatus(id, status, details);
    if (!updated) {
      return errorResponse(res, 'Request not found or status update failed', 404);
    }

    const issueNo = updated.issue_no || (updated.id ? `PA-${updated.id}` : 'PA-1');

    // Trigger In-App Notifications and Email Dispatch matching IHLR pattern
    if (pool && updated) {
      try {
        const wasAlreadyClosed = String(existing?.status || '').toUpperCase() === 'CLOSED';
        const isNowClosed = String(updated.status || '').toUpperCase() === 'CLOSED';
        const isClosed = isNowClosed && !wasAlreadyClosed;
        const closerName = req.user?.name || details.action_taken_by || updated.executor || 'Assigned Executor';
        const closerDept = updated.department || req.user?.department || 'PRODUCTION';

        // Fetch Quality Admin users from DB
        let adminUsers = [];
        const [aRows] = await pool.query(
          "SELECT id, name, email FROM users WHERE UPPER(role) = 'ADMIN' OR UPPER(department) = 'QAD'"
        ).catch(() => [[]]);
        if (aRows && aRows.length > 0) {
          adminUsers = aRows;
        } else {
          adminUsers = [{ id: null, name: 'Quality Admin', email: 'admin@gmail.com' }];
        }

        // Resolve Creator User details
        let creatorEmail = updated.created_by_email || null;
        let creatorName = updated.created_by || 'Quality Auditor';
        let creatorId = updated.created_by_id || null;
        if (pool && (!creatorEmail || !creatorId)) {
          const [crRows] = await pool.query(
            'SELECT id, name, email FROM users WHERE id = ? OR LOWER(TRIM(name)) = LOWER(TRIM(?)) LIMIT 1',
            [creatorId || 0, creatorName]
          ).catch(() => [[]]);
          if (crRows && crRows.length > 0) {
            creatorId = crRows[0].id;
            creatorEmail = crRows[0].email;
            creatorName = crRows[0].name;
          }
        }

        if (isClosed) {
          // SCENARIO 2: CASE CLOSED by Admin
          // Build a deduplicated map of unique recipients so that no person receives duplicate notifications.
          const recipientsMap = new Map();

          const addRecipient = (userId, userName, userEmail, link) => {
            const cleanEmail = userEmail ? String(userEmail).trim().toLowerCase() : '';
            const cleanName = userName ? String(userName).trim().toLowerCase() : '';
            const cleanId = userId ? String(userId).trim() : '';

            const key = cleanId ? `id_${cleanId}` : (cleanEmail ? `email_${cleanEmail}` : `name_${cleanName}`);
            if (!key) return;

            for (const [_, ex] of recipientsMap) {
              if (cleanId && ex.user_id && String(ex.user_id) === cleanId) return;
              if (cleanEmail && ex.user_email && String(ex.user_email).toLowerCase() === cleanEmail) return;
              if (cleanName && ex.user_name && String(ex.user_name).toLowerCase() === cleanName) return;
            }

            recipientsMap.set(key, {
              user_id: userId || null,
              user_name: userName || 'User',
              user_email: userEmail || '',
              link: link || '/process-audit/approvals'
            });
          };

          // 1. Requester / Creator
          if (creatorId || creatorName || creatorEmail) {
            addRecipient(creatorId, creatorName, creatorEmail, '/process-audit/all-requests');
          }

          // 2. Assigned Executor(s)
          const closedCloserNames = (updated.executor || '')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
          if (closedCloserNames.length > 0) {
            const placeholders = closedCloserNames.map(() => '?').join(',');
            const [closerRows] = await pool.query(
              `SELECT id, name, email FROM users WHERE LOWER(TRIM(name)) IN (${placeholders})`,
              closedCloserNames.map((n) => n.toLowerCase())
            ).catch(() => [[]]);
            if (closerRows && closerRows.length > 0) {
              for (const cUser of closerRows) {
                addRecipient(cUser.id, cUser.name, cUser.email, '/process-audit/approvals');
              }
            }
          }

          // 3. Quality Admin users
          for (const admin of adminUsers) {
            addRecipient(admin.id, admin.name, admin.email, '/process-audit/approvals');
          }

          // Insert exactly one notification per unique recipient into DB
          for (const [_, recipient] of recipientsMap) {
            const [existingRows] = await pool.query(
              `SELECT id FROM process_audit_notifications 
               WHERE request_id = ? AND type = 'case_closed' 
                 AND (
                   (? IS NOT NULL AND user_id = ?) OR 
                   (? != '' AND LOWER(TRIM(user_email)) = LOWER(TRIM(?)))
                 ) LIMIT 1`,
              [
                updated.id || id,
                recipient.user_id, recipient.user_id,
                recipient.user_email, recipient.user_email
              ]
            ).catch(() => [[]]);

            if (!existingRows || existingRows.length === 0) {
              await pool.query(
                `INSERT INTO process_audit_notifications 
                 (user_id, user_name, user_email, request_id, issue_no, type, title, message, link, is_read) 
                 VALUES (?, ?, ?, ?, ?, 'case_closed', ?, ?, ?, 0)`,
                [
                  recipient.user_id,
                  recipient.user_name,
                  recipient.user_email,
                  updated.id || id,
                  issueNo,
                  `Process Audit Case Closed: #${issueNo}`,
                  `Process Audit finding #${issueNo} (${updated.model || 'Process'}) has been verified and marked as CLOSED.`,
                  recipient.link
                ]
              ).catch((e) => console.warn('[Process Audit Case Closed Notif Error]:', e.message));
            }
          }

          // Mark pending assignment and sign-off notifications as read for this closed request
          await pool.query(
            `UPDATE process_audit_notifications 
             SET is_read = 1 
             WHERE (request_id = ? OR issue_no = ?) AND type IN ('assignment_required', 'approval_required', 'closer_completed_pending_review', 'closer_completed_pending_admin_signoff')`,
            [updated.id, issueNo]
          ).catch(() => {});

          // Dispatch Case Closed emails
          try {
            sendProcessAuditCloserEmails({
              request: updated,
              closerUser: req.user,
              creatorUser: {
                id: creatorId,
                name: creatorName,
                email: creatorEmail
              },
              assignedUser: {
                name: updated.executor,
                email: updated.executor_email,
                department: updated.department
              },
              adminUsers
            }).catch((mailErr) => console.warn('[Process Audit Mailer] Case closed email dispatch warning:', mailErr.message));
          } catch (mailSyncErr) {
            console.warn('[Process Audit Mailer] Sync case closed email dispatch warning:', mailSyncErr.message);
          }

        } else if (
          body.is_reassign || body.isReassign || details?.is_reassign ||
          (String(status).toLowerCase() === 'pending' &&
           !body.temporary_action && !body.permanent_fix && !body.prod_why_why &&
           !details.temporary_action && !details.permanent_fix && !details.prod_why_why &&
           !details.corrective_action)
        ) {
          // Reassignment or status transition without closer countermeasure submission; do not trigger closer submission notifications
        } else if (
          body.temporary_action || body.permanent_fix || body.prod_why_why ||
          details.temporary_action || details.permanent_fix || details.prod_why_why ||
          details.corrective_action ||
          String(status).toLowerCase().includes('progress') ||
          String(status).toLowerCase().includes('approval') ||
          String(status).toLowerCase().includes('review')
        ) {
          // SCENARIO 3: CLOSER DETAILS SUBMITTED (Countermeasures & 5-Why)
          // Mark the executor's previous pending assignment/approval notification as read
          await pool.query(
            `UPDATE process_audit_notifications 
             SET is_read = 1 
             WHERE (request_id = ? OR issue_no = ?) AND type IN ('assignment_required', 'approval_required')`,
            [updated.id, issueNo]
          ).catch(() => {});

          // Notification A: For Raised Person (Requester) to complete pending review
          if (creatorId || creatorName || creatorEmail) {
            await pool.query(
              `INSERT INTO process_audit_notifications 
               (user_id, user_name, user_email, request_id, issue_no, type, title, message, link, is_read) 
               VALUES (?, ?, ?, ?, ?, 'closer_completed_pending_review', ?, ?, '/process-audit/approvals', 0)`,
              [
                creatorId,
                creatorName,
                creatorEmail || '',
                updated.id || id,
                issueNo,
                `Closer Actions Submitted #${issueNo}`,
                `Closer ${closerName} (${closerDept}) has completed 5-Why root cause analysis and corrective action for #${issueNo} (${updated.model || 'Process'}). Quality Admin review and closure sign-off pending.`
              ]
            ).catch((e) => console.warn('[PA Closer Review Notif Error]:', e.message));
          }

          // Notification B: For Quality Admins to review and sign-off pending fields
          for (const admin of adminUsers) {
            if (creatorEmail && admin.email && creatorEmail.toLowerCase() === admin.email.toLowerCase()) {
              continue;
            }
            await pool.query(
              `INSERT INTO process_audit_notifications 
               (user_id, user_name, user_email, request_id, issue_no, type, title, message, link, is_read) 
               VALUES (?, ?, ?, ?, ?, 'closer_completed_pending_admin_signoff', ?, ?, '/process-audit/approvals', 0)`,
              [
                admin.id || null,
                admin.name || 'Admin',
                admin.email || 'admin@gmail.com',
                updated.id || id,
                issueNo,
                `Admin Action Required: Pending Sign-Off #${issueNo}`,
                `Closer ${closerName} (${closerDept}) has completed actions for #${issueNo} (${updated.model || 'Process'}). Action required: Please enter validation remarks and update status to finalize closure.`
              ]
            ).catch((e) => console.warn('[PA Admin Notif Error]:', e.message));
          }

          // Notification C: For Each Closer / Assigned Person Individually (Acknowledgment)
          const closerNamesList = (updated.executor || closerName || '')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);

          const targetClosers = [];
          if (closerNamesList.length > 0) {
            const placeholders = closerNamesList.map(() => '?').join(',');
            const [uRows] = await pool.query(
              `SELECT id, name, email FROM users WHERE LOWER(TRIM(name)) IN (${placeholders})`,
              closerNamesList.map((n) => n.toLowerCase())
            ).catch(() => [[]]);
            if (uRows && uRows.length > 0) {
              targetClosers.push(...uRows);
            }
          }

          if (req.user?.id && !targetClosers.some((u) => String(u.id) === String(req.user.id))) {
            targetClosers.push({
              id: req.user.id,
              name: req.user.name,
              email: req.user.email
            });
          }

          if (targetClosers.length === 0 && (closerName || updated.executor)) {
            targetClosers.push({
              id: null,
              name: closerName || updated.executor,
              email: updated.executor_email || ''
            });
          }

          for (const cUser of targetClosers) {
            await pool.query(
              `INSERT INTO process_audit_notifications 
               (user_id, user_name, user_email, request_id, issue_no, type, title, message, link, is_read) 
               VALUES (?, ?, ?, ?, ?, 'countermeasure_saved', ?, ?, '/process-audit/approvals', 0)`,
              [
                cUser.id || null,
                cUser.name,
                cUser.email || '',
                updated.id || id,
                issueNo,
                `Closer Submission Acknowledged: #${issueNo}`,
                `Your 5-Why root cause analysis and corrective action for #${issueNo} (${updated.model || 'Process'}) have been submitted. The Auditor and Quality Admin have been alerted with notification & email to complete the pending validation remarks and status sign-off.`
              ]
            ).catch((e) => console.warn('[PA Closer Notif Error]:', e.message));
          }

          // Trigger Closer Email Dispatch to Requester, Quality Admins, and Closer
          try {
            sendProcessAuditCloserEmails({
              request: updated,
              closerUser: req.user,
              creatorUser: {
                id: creatorId,
                name: creatorName,
                email: creatorEmail
              },
              assignedUser: {
                name: updated.executor,
                email: updated.executor_email,
                department: updated.department
              },
              adminUsers
            }).catch((mailErr) => console.warn('[Process Audit Mailer] Closer email dispatch warning:', mailErr.message));
          } catch (mailSyncErr) {
            console.warn('[Process Audit Mailer] Sync closer email dispatch warning:', mailSyncErr.message);
          }
        }
      } catch (notifErr) {
        console.warn('[Process Audit Closer Notification Warning]:', notifErr.message);
      }
    }

    // Broadcast Realtime WebSocket Event
    broadcastEvent('process_audit:updated', updated);
    broadcastEvent('notifications:refresh', { module: 'process_audit', action: 'updated', id: updated.id, reqNo: issueNo });

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

    const numericId = parseInt(String(id).replace(/\D/g, ''), 10) || id;
    const [existingRows] = await pool.query(
      'SELECT status FROM process_audit_requests WHERE id = ? OR issue_no = ?',
      [numericId, String(id)]
    ).catch(() => [[]]);
    const existing = existingRows?.[0] || null;
    if (existing && String(existing.status || '').toUpperCase() === 'CLOSED') {
      return errorResponse(res, 'This request is closed and cannot be reassigned or modified.', 403);
    }

    // Verify department authorization: Only QAD or ADMIN can reassign
    const userId = req.user?.id || body.reassigned_by_id;
    const userName = req.user?.name || body.reassigned_by;
    const userRole = (req.user?.role || body.role || '').toUpperCase();
    const userDept = (req.user?.department || body.user_department || '').toUpperCase();

    let isAuthorized = userRole === 'ADMIN' || userDept === 'QAD';
    if (!isAuthorized && (userId || userName)) {
      const [uRows] = await pool.query(
        'SELECT department, role FROM users WHERE id = ? OR LOWER(name) = LOWER(?) LIMIT 1',
        [userId || 0, userName || '']
      );
      if (uRows.length > 0) {
        const uD = (uRows[0].department || '').trim().toUpperCase();
        const uR = (uRows[0].role || '').trim().toUpperCase();
        if (uR === 'ADMIN' || uD === 'QAD') {
          isAuthorized = true;
        }
      }
    }

    if (!isAuthorized) {
      return errorResponse(
        res,
        'Access Denied: Only personnel from QAD or ADMIN are authorized to reassign requests.',
        403
      );
    }

    const reassignedByName = req.user?.name || body.reassigned_by || body.reviewed_by || 'Quality Auditor';
    const reassignedById = req.user?.id || body.reassigned_by_id || body.reviewed_by_id || null;
    const reassignedByEmail = req.user?.email || body.reassigned_by_email || body.reviewed_by_email || null;

    const result = await ProcessAuditRequest.reassign(id, {
      new_department,
      new_executor,
      reason,
      reassigned_by: reassignedByName,
      reassigned_by_id: reassignedById,
      reassigned_by_email: reassignedByEmail,
      reviewed_by: reassignedByName,
      reviewed_by_id: reassignedById,
      reviewed_by_email: reassignedByEmail
    });

    const updated = result.updated;
    const issueNo = updated.issue_no || (updated.id ? `PA-${updated.id}` : 'PA-1');

    // Notify new executor(s) and clean up old executor notification
    try {
      // Mark old executor pending assignment notifications as read
      await pool.query(
        `UPDATE process_audit_notifications 
         SET is_read = 1 
         WHERE (request_id = ? OR issue_no = ?) 
           AND type IN ('assignment_required', 'approval_required', 'assigned_to_pa', 'pa_reassigned', 'reassigned')`,
        [updated.id, issueNo]
      ).catch(() => {});

      // A. Send in-app notification and email to ALL newly selected assignee(s)
      const newNames = String(new_executor || '').split(',').map((s) => s.trim()).filter(Boolean);
      const targetUsers = [];

      if (newNames.length > 0) {
        for (const nameItem of newNames) {
          let [nuRows] = await pool.query(
            'SELECT id, name, email, department, role FROM users WHERE (LOWER(TRIM(name)) = LOWER(TRIM(?)) OR LOWER(TRIM(email)) = LOWER(TRIM(?))) AND UPPER(TRIM(department)) = UPPER(TRIM(?)) LIMIT 1',
            [nameItem, nameItem, new_department]
          ).catch(() => [[]]);
          if (!nuRows || nuRows.length === 0) {
            [nuRows] = await pool.query(
              'SELECT id, name, email, department, role FROM users WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) OR LOWER(TRIM(email)) = LOWER(TRIM(?)) LIMIT 1',
              [nameItem, nameItem]
            ).catch(() => [[]]);
          }
          if (nuRows && nuRows.length > 0) {
            targetUsers.push(nuRows[0]);
          } else {
            targetUsers.push({
              id: null,
              name: nameItem,
              email: `${nameItem.toLowerCase().replace(/\s+/g, '')}@gmail.com`,
              department: new_department
            });
          }
        }
      } else {
        const [deptRows] = await pool.query(
          'SELECT id, name, email FROM users WHERE UPPER(TRIM(department)) = UPPER(TRIM(?))',
          [new_department]
        ).catch(() => [[]]);
        if (deptRows && deptRows.length > 0) {
          targetUsers.push(...deptRows);
        }
      }

      const reasonText = reason ? ` Reason: "${reason}"` : '';

      for (const u of targetUsers) {
        await pool.query(
          `INSERT INTO process_audit_notifications 
           (user_id, user_name, user_email, request_id, issue_no, type, title, message, link, is_read) 
           VALUES (?, ?, ?, ?, ?, 'pa_reassigned', ?, ?, '/process-audit/approvals', 0)`,
          [
            u.id || null,
            u.name,
            u.email,
            updated.id || id,
            issueNo,
            `Action Required: Process Audit #${issueNo} Reassigned`,
            `Process Audit report #${issueNo} (${updated.model || 'Process'}) has been reassigned to you for ${new_department} by ${reassignedByName}.${reasonText} Please inspect and submit root cause actions.`
          ]
        ).catch((e) => console.warn('[PA Reassign Notif Error]:', e.message));

        try {
          const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
          const tableData = [
            { label: 'Request Number', value: issueNo },
            { label: 'Product / Model', value: `${updated.product || '—'} (${updated.model || '—'})` },
            { label: 'Process / Operation', value: updated.process_operation || '—' },
            { label: 'New Department', value: new_department },
            { label: 'New Executor', value: u.name || new_executor },
            { label: 'Reassigned By', value: reassignedByName },
            { label: 'Reassignment Reason', value: reason || 'Department workflow reallocation' },
            { label: 'Status', value: 'Pending' }
          ];

          const execHtml = generateEmailTemplate({
            headerTitle: `Action Required: Process Audit #${issueNo} Reassigned`,
            headerSubtitle: `A process audit finding has been reassigned to you for investigation and corrective action.`,
            recipientName: u.name || new_executor,
            greetingMessage: `Process Audit report <strong>${issueNo}</strong> (${updated.model || 'Process'}) has been reassigned to you in <strong>${new_department}</strong> by <strong>${reassignedByName}</strong>.${reasonText ? `<br><br><strong>Reason:</strong> ${reason}` : ''}<br><br><strong>Current Status:</strong> <span style="display:inline-block; padding: 2px 8px; font-weight:700; background:#fef3c7; color:#b45309; border-radius:4px;">Pending</span>`,
            tableData,
            actionButtonText: 'Open Report & Submit Action',
            actionButtonUrl: `${baseUrl}/process-audit/approvals`,
            footerNote: 'Immediate action required: please inspect the process finding and record corrective containment measures in the portal.',
            badgeColor: '#f59e0b',
            badgeText: 'REASSIGNED'
          });

          sendEmail({
            to: u.email || process.env.SMTP_USER || '',
            recipientName: u.name || new_executor || 'Assigned Closer',
            recipientRole: 'ASSIGNED_CLOSER',
            subject: `[Process Audit Action Required] Audit Finding #${issueNo} Reassigned to You (${new_department}) - Pending`,
            text: `Dear ${u.name || 'Team Member'},\n\nProcess Audit report #${issueNo} (${updated.model || 'Process'}) has been reassigned to you (${new_department}) by ${reassignedByName}.${reasonText}\n\nPlease review and submit root cause analysis and containment actions at: ${baseUrl}/process-audit/approvals\n\nThank you,\nQuality Portal`,
            html: execHtml,
            referenceNo: issueNo,
            moduleType: 'PROCESS_AUDIT',
            requestId: updated.id
          }).catch((err) => console.warn('[PA Reassign Mail Warning]:', err.message));
        } catch (mErr) {
          console.warn('[PA Reassign Mail Sync Warning]:', mErr.message);
        }
      }

      // B. Notify Creator / Requester about the reassignment
      let creatorEmail = updated.created_by_email || null;
      let creatorName = updated.created_by || 'Quality Requester';
      let creatorId = updated.created_by_id || null;
      if (pool && (!creatorEmail || !creatorId)) {
        const [crRows] = await pool.query(
          'SELECT id, name, email FROM users WHERE id = ? OR LOWER(TRIM(name)) = LOWER(TRIM(?)) LIMIT 1',
          [creatorId || 0, creatorName]
        ).catch(() => [[]]);
        if (crRows && crRows.length > 0) {
          creatorId = crRows[0].id;
          creatorEmail = crRows[0].email;
          creatorName = crRows[0].name;
        }
      }

      if (creatorId || creatorName || creatorEmail) {
        await pool.query(
          `INSERT INTO process_audit_notifications 
           (user_id, user_name, user_email, request_id, issue_no, type, title, message, link, is_read) 
           VALUES (?, ?, ?, ?, ?, 'reassigned', ?, ?, '/process-audit/all-requests', 0)`,
          [
            creatorId || null,
            creatorName,
            creatorEmail || '',
            updated.id || id,
            issueNo,
            `Process Audit Case Reassigned: #${issueNo}`,
            `Process Audit report #${issueNo} (${updated.model || 'Process'}) has been reassigned to ${new_executor} (${new_department}) by ${reassignedByName}.${reasonText}`
          ]
        ).catch((e) => console.warn('[PA Reassign Req Notif Error]:', e.message));

        try {
          const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
          const tableData = [
            { label: 'Request Number', value: issueNo },
            { label: 'Product / Model', value: `${updated.product || '—'} (${updated.model || '—'})` },
            { label: 'Process / Operation', value: updated.process_operation || '—' },
            { label: 'New Department', value: new_department },
            { label: 'New Executor', value: new_executor },
            { label: 'Reassigned By', value: reassignedByName },
            { label: 'Reassignment Reason', value: reason || 'Department workflow reallocation' },
            { label: 'Status', value: 'Pending' }
          ];

          const creatorHtml = generateEmailTemplate({
            headerTitle: `Process Audit Reassigned: #${issueNo}`,
            headerSubtitle: `Your process audit observation finding has been reassigned to a new department/executor.`,
            recipientName: creatorName || 'Quality Requester',
            greetingMessage: `Your Process Audit observation report <strong>${issueNo}</strong> (${updated.model || 'Process'}) has been reassigned to <strong>${new_executor}</strong> (<strong>${new_department}</strong>) by <strong>${reassignedByName}</strong>.${reasonText ? `<br><br><strong>Reason:</strong> ${reason}` : ''}`,
            tableData,
            actionButtonText: 'View Process Audit Requests',
            actionButtonUrl: `${baseUrl}/process-audit/all-requests`,
            footerNote: 'You will receive an update once the new department submits actions.',
            badgeColor: '#3b82f6',
            badgeText: 'REASSIGNED'
          });

          sendEmail({
            to: creatorEmail || process.env.SMTP_USER || '',
            recipientName: creatorName || 'Quality Requester',
            recipientRole: 'RAISED_PERSON',
            subject: `[Process Audit Notice] Request #${issueNo} Reassigned to ${new_executor} (${new_department})`,
            text: `Dear ${creatorName || 'Quality Requester'},\n\nYour Process Audit report #${issueNo} (${updated.model || 'Process'}) has been reassigned to ${new_executor} (${new_department}) by ${reassignedByName}.${reasonText}\n\nView details: ${baseUrl}/process-audit/all-requests\n\nThank you,\nQuality Portal`,
            html: creatorHtml,
            referenceNo: issueNo,
            moduleType: 'PROCESS_AUDIT',
            requestId: updated.id
          }).catch((err) => console.warn('[PA Reassign Req Mail Warning]:', err.message));
        } catch (mReqErr) {
          console.warn('[PA Reassign Req Mail Sync Warning]:', mReqErr.message);
        }
      }
    } catch (notifErr) {
      console.warn('[Process Audit Reassignment Notifications Warning]:', notifErr.message);
    }

    // Broadcast Realtime WebSocket Event
    broadcastEvent('process_audit:reassigned', updated);
    broadcastEvent('notifications:refresh', { module: 'process_audit', action: 'reassigned', id: updated.id, reqNo: issueNo });

    return successResponse(res, updated, 'Request reassigned successfully. Notifications and emails dispatched.');
  } catch (err) {
    return errorResponse(res, err.message);
  }
};

export const updateRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body || {};

    const authHeader = req.headers.authorization;
    let tokenUser = null;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        tokenUser = verifyToken(authHeader.split(' ')[1]);
      } catch {}
    }
    const userRole = (body.user?.role || tokenUser?.role || req.user?.role || '').trim().toUpperCase();
    const userDept = (body.user?.department || tokenUser?.department || req.user?.department || '').trim().toUpperCase();
    const isAdmin = userRole === 'ADMIN' || userDept === 'QAD';
    if (!isAdmin) {
      return errorResponse(res, 'Access denied. Edit mode is only permitted for Admin role.', 403);
    }

    const numericId = parseInt(String(id).replace(/\D/g, ''), 10) || id;
    const [existingRows] = await pool.query(
      'SELECT status FROM process_audit_requests WHERE id = ? OR issue_no = ?',
      [numericId, String(id)]
    ).catch(() => [[]]);
    const existing = existingRows?.[0] || null;
    if (existing && String(existing.status || '').toUpperCase() === 'CLOSED') {
      return errorResponse(res, 'This request is closed and cannot be edited.', 403);
    }

    if (body.escalation_date) {
      const escStr = String(body.escalation_date).split('T')[0];
      const todayStr = new Date().toISOString().split('T')[0];
      if (escStr > todayStr) {
        return errorResponse(res, 'Escalation Date cannot be a future date. Please select today or a past date.', 400);
      }
    }

    let parsedAttachments = undefined;
    if (body.attachments !== undefined) {
      if (typeof body.attachments === 'string') {
        try {
          parsedAttachments = JSON.parse(body.attachments);
        } catch {
          parsedAttachments = [];
        }
      } else if (Array.isArray(body.attachments)) {
        parsedAttachments = body.attachments;
      }
    }

    if (req.files && req.files.length > 0) {
      const uploadedFiles = [];
      for (const file of req.files) {
        const saved = await Attachment.saveAttachment(file);
        uploadedFiles.push(saved);
      }
      parsedAttachments = [...(parsedAttachments || []), ...uploadedFiles];
    }

    let parsedActionAttachments = undefined;
    if (body.action_attachments !== undefined) {
      if (typeof body.action_attachments === 'string') {
        try {
          parsedActionAttachments = JSON.parse(body.action_attachments);
        } catch {
          parsedActionAttachments = [];
        }
      } else if (Array.isArray(body.action_attachments)) {
        parsedActionAttachments = body.action_attachments;
      }
    }

    const updates = { ...body };
    if (parsedAttachments !== undefined) updates.attachments = parsedAttachments;
    if (parsedActionAttachments !== undefined) updates.action_attachments = parsedActionAttachments;

    const updated = await ProcessAuditRequest.update(id, updates);
    if (!updated) {
      return errorResponse(res, 'Process Audit Request not found', 404);
    }

    broadcastEvent('process_audit:updated', updated);
    broadcastEvent('notifications:refresh', { module: 'process_audit', action: 'updated', id: updated.id });

    return successResponse(res, updated, 'Process Audit Request updated successfully');
  } catch (err) {
    return errorResponse(res, err.message);
  }
};

export const getProcessAuditEmailLogs = async (req, res) => {
  try {
    if (!pool) return successResponse(res, []);
    const [rows] = await pool.query(
      `SELECT id, module_type, request_id, reference_no, recipient_role, recipient_name, recipient_email, subject, delivery_status, smtp_response, error_message, sent_at 
       FROM email_logs 
       WHERE module_type = 'PROCESS_AUDIT' 
       ORDER BY id DESC LIMIT 50`
    );
    return successResponse(res, rows || [], 'Process Audit Email logs retrieved');
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

export const testProcessAuditEmail = async (req, res) => {
  try {
    const to = req.body?.to || process.env.SMTP_USER || '';
    const recipientName = req.body?.name || 'Process Audit Tester';
    const html = generateEmailTemplate({
      headerTitle: 'INEL Process Audit Portal Diagnostic',
      headerSubtitle: 'Outbound SMTP Verification Test',
      recipientName,
      greetingMessage: 'This is an automated test notification dispatched from the INEL Process Audit Quality Management Portal to verify outbound email delivery and template formatting.',
      tableData: [
        { label: 'SMTP Host', value: process.env.SMTP_HOST || 'localhost' },
        { label: 'Sender Account', value: process.env.SMTP_USER || 'Environment Config' },
        { label: 'Dispatched At', value: new Date().toLocaleString() }
      ],
      badgeColor: '#10b981',
      badgeText: 'TEST EMAIL'
    });
    const result = await sendEmail({
      to,
      recipientName,
      recipientRole: 'TESTER',
      subject: '[INEL Process Audit Portal] Test Email Notification',
      text: 'This is a test notification from INEL Process Audit Quality Management Portal using configured SMTP credentials.',
      html,
      moduleType: 'PROCESS_AUDIT',
      referenceNo: 'TEST-PA-001'
    });
    return successResponse(res, result, 'Test email dispatch executed');
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};


