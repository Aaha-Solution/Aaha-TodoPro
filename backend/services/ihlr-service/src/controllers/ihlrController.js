import path from 'path';
import { successResponse, errorResponse } from '../../../shared/response.js';
import { IhlrRequest } from '../models/IhlrRequest.js';
import { saveBinaryFiles, streamBinaryFile } from '../../../shared/binaryStorage.js';
import pool from '../../../shared/db.js';
import { sendIhlrRequestEmails } from '../../../shared/mailer.js';

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

    // 1. Resolve Creator (Raised Person) details from DB
    let creatorUser = null;
    const creatorIdentifier = data.created_by_id || data.created_by || data.analysis_done_by || req.user?.id || req.user?.name || req.user?.email;
    if (creatorIdentifier && pool) {
      const [uRows] = await pool.query(
        'SELECT id, name, email, department, role FROM users WHERE id = ? OR LOWER(TRIM(name)) = LOWER(TRIM(?)) OR LOWER(TRIM(email)) = LOWER(TRIM(?)) LIMIT 1',
        [Number(creatorIdentifier) || 0, String(creatorIdentifier), String(creatorIdentifier)]
      ).catch(() => [[]]);
      if (uRows && uRows.length > 0) {
        creatorUser = uRows[0];
      }
    }
    if (!creatorUser) {
      creatorUser = {
        id: data.created_by_id || req.user?.id || null,
        name: data.created_by || data.analysis_done_by || req.user?.name || 'Incoming Quality Admin',
        email: data.created_by_email || req.user?.email || 'quality@inel.co.in',
        department: 'INCOMING QUALITY'
      };
    }

    // 2. Resolve Assigned Person (Selected Person in field) details from DB
    let assignedUser = null;
    if (data.resp_person && pool) {
      const [aRows] = await pool.query(
        'SELECT id, name, email, department, role FROM users WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) OR LOWER(TRIM(email)) = LOWER(TRIM(?)) LIMIT 1',
        [String(data.resp_person), String(data.resp_person)]
      ).catch(() => [[]]);
      if (aRows && aRows.length > 0) {
        assignedUser = aRows[0];
      }
    }
    if (!assignedUser) {
      assignedUser = {
        id: null,
        name: data.resp_person || 'Assigned Officer',
        email: data.resp_person_email || `${String(data.resp_person || 'user').toLowerCase().replace(/\s+/g, '')}@gmail.com`,
        department: data.resp || 'PRODUCTION'
      };
    }

    // Enrich payload with resolved creator & assigned emails
    data.created_by = creatorUser.name;
    data.created_by_id = creatorUser.id;
    data.created_by_email = creatorUser.email;
    data.resp_person_email = assignedUser.email;

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
        created_by: creatorUser.name,
        created_by_id: creatorUser.id,
        created_by_email: creatorUser.email,
        resp_person_email: assignedUser.email,
        created_at: new Date().toISOString()
      };
      fallbackRequests.unshift(created);
    }

    const reqNo = created.req_no || `IHLR-${created.id || '1'}`;

    // 3. Insert In-App Notifications for BOTH Raised Person & Selected Person
    if (pool && created) {
      try {
        // Notification A: For Raised Person (Confirmation)
        await pool.query(
          `INSERT INTO ihlr_notifications 
           (user_id, user_name, user_email, request_id, req_no, type, title, message, link, is_read) 
           VALUES (?, ?, ?, ?, ?, 'submission_confirmed', ?, ?, '/ihlr/my-requests', 0)`,
          [
            creatorUser.id,
            creatorUser.name,
            creatorUser.email,
            created.id,
            reqNo,
            `IHLR Defect Report Logged: #${reqNo}`,
            `Your IHLR defect observation report for "${created.model}" has been logged and assigned to ${assignedUser.name} (${created.resp || 'Production'}).`
          ]
        );

        // Notification B: For Selected Person in the field (Action Required)
        await pool.query(
          `INSERT INTO ihlr_notifications 
           (user_id, user_name, user_email, request_id, req_no, type, title, message, link, is_read) 
           VALUES (?, ?, ?, ?, ?, 'assignment_required', ?, ?, '/ihlr/my-requests', 0)`,
          [
            assignedUser.id,
            assignedUser.name,
            assignedUser.email,
            created.id,
            reqNo,
            `Action Required: IHLR Report #${reqNo} Assigned`,
            `Defect report #${reqNo} (${created.model} - "${created.problem}") has been assigned to you by ${creatorUser.name}. Please inspect and submit 5-Why root cause countermeasure.`
          ]
        );
      } catch (notifErr) {
        console.warn('[IHLR Notifications] Error inserting dual in-app notifications:', notifErr.message);
      }
    }

    // 4. Trigger Dual Emails (to Raised Person AND Selected Person)
    try {
      sendIhlrRequestEmails({
        request: created,
        creatorUser,
        assignedUser
      }).catch(mailErr => console.warn('[IHLR Mailer] Non-blocking email dispatch warning:', mailErr.message));
    } catch (mailSyncErr) {
      console.warn('[IHLR Mailer] Sync email dispatch warning:', mailSyncErr.message);
    }

    return successResponse(res, created, 'IHLR request created successfully. Notifications and emails dispatched to both raised person and selected person.', 201);
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
    const userName = (req.query.user || req.query.user_name || req.user?.name || '').trim();
    const userId = req.query.user_id ? Number(req.query.user_id) : (req.user?.id || null);
    const userRole = (req.query.role || req.user?.role || '').trim().toUpperCase();
    const isAdmin = userRole === 'ADMIN';

    let notifRows = [];
    if (pool) {
      let query = 'SELECT * FROM ihlr_notifications';
      const params = [];
      if (!isAdmin && (userName || userId)) {
        query += ' WHERE (LOWER(TRIM(user_name)) = LOWER(TRIM(?)) OR user_id = ?)';
        params.push(userName, userId);
      }
      query += ' ORDER BY id DESC LIMIT 50';
      const [rows] = await pool.query(query, params).catch(() => [[]]);
      notifRows = rows || [];
    }

    // Also include synthetic recent request stream if notifications table is empty
    if (notifRows.length === 0) {
      const requests = (await IhlrRequest.getAll()) || [];
      const notifications = requests.slice(0, 15).map((r) => {
        const isClosed = (r.status || '').toUpperCase() === 'CLOSED';
        const isInProgress = (r.status || '').toUpperCase() === 'IN_PROGRESS';
        let title = 'New IHLR Report Logged';
        let msg = `${String(r.req_no).startsWith('IHLR-') ? r.req_no : `#${r.req_no}`} (Model: ${r.model || '—'}) reported with defect "${r.problem || '—'}".`;

        if (isClosed) {
          title = 'IHLR Case Closed';
          msg = `${String(r.req_no).startsWith('IHLR-') ? r.req_no : `#${r.req_no}`} (${r.model || '—'}) verified and closed.`;
        } else if (isInProgress) {
          title = 'Occurrence Cause Updated';
          msg = `Corrective countermeasure in progress for ${String(r.req_no).startsWith('IHLR-') ? r.req_no : `#${r.req_no}`}.`;
        }

        return {
          id: r.id,
          rawId: r.id,
          requestId: r.req_no,
          reqNo: String(r.req_no).startsWith('IHLR-') ? `#${r.req_no}` : `#IHLR-${r.req_no}`,
          title,
          message: msg,
          date: r.created_at ? new Date(r.created_at).toLocaleString('en-US', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Recent Today',
          status: r.status || 'OPEN',
          read: false,
          link: '/ihlr/my-requests'
        };
      });
      return successResponse(res, notifications, 'IHLR notifications retrieved');
    }

    const formatted = notifRows.map(n => {
      const isConfirmed = n.type === 'submission_confirmed';
      return {
        id: n.id,
        rawId: n.request_id,
        requestId: n.req_no,
        reqNo: String(n.req_no).startsWith('IHLR-') ? `#${n.req_no}` : `#IHLR-${n.req_no}`,
        badgeLabel: isConfirmed ? 'REPORT LOGGED' : 'ACTION REQUIRED',
        accentColor: isConfirmed ? 'blue' : 'amber',
        department: isConfirmed ? 'INCOMING QUALITY' : 'PRODUCTION',
        title: n.title,
        message: n.message,
        date: n.created_at ? new Date(n.created_at).toLocaleString('en-US', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Recent Today',
        subCategory: 'LINE DEFECT REPORT',
        footerFlag: isConfirmed ? 'SYSTEM_LOGS' : 'ACTION_REQUIRED',
        read: Boolean(n.is_read),
        type: isConfirmed ? 'confirmed' : 'assignment',
        link: n.link || '/ihlr/my-requests'
      };
    });

    return successResponse(res, formatted, 'IHLR notifications retrieved');
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

export const markIhlrNotificationRead = async (req, res) => {
  try {
    const { id } = req.params;
    if (pool) {
      await pool.query('UPDATE ihlr_notifications SET is_read = 1 WHERE id = ?', [id]);
    }
    return successResponse(res, null, 'Notification marked as read');
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

export const markAllIhlrNotificationsRead = async (req, res) => {
  try {
    const userName = (req.body?.user || req.query.user || '').trim();
    if (pool) {
      if (userName) {
        await pool.query('UPDATE ihlr_notifications SET is_read = 1 WHERE LOWER(TRIM(user_name)) = LOWER(TRIM(?))', [userName]);
      } else {
        await pool.query('UPDATE ihlr_notifications SET is_read = 1');
      }
    }
    return successResponse(res, null, 'All notifications marked as read');
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

export const uploadAttachments = async (req, res) => {
  try {
    const savedFiles = await saveBinaryFiles(req.files || [], {
      module_name: 'IHLR',
      ref_id: req.body.request_id || null,
      urlPrefix: '/api/ihlr/attachments/binary'
    });

    return successResponse(res, { files: savedFiles }, 'Files uploaded and stored in database successfully');
  } catch (err) {
    console.error('Binary upload error:', err);
    return errorResponse(res, err.message);
  }
};

/**
 * Stream binary attachment directly from database (shared binary storage handler)
 */
export const getBinaryAttachment = streamBinaryFile;
export const getBinaryAttachmentByFilename = streamBinaryFile;
