import path from 'path';
import { successResponse, errorResponse } from '../../../shared/response.js';
import { IhlrRequest } from '../models/IhlrRequest.js';
import { saveBinaryFiles, streamBinaryFile } from '../../../shared/binaryStorage.js';
import pool from '../../../shared/db.js';
import { sendIhlrRequestEmails, sendIhlrCloserEmails, sendEmail } from '../../../../shared/mailer.js';
import { broadcastEvent } from '../../../shared/realtimeNotifier.js';



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

const parseToDateStr = (val) => {
  if (!val) return '';
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return '';
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const str = String(val).trim();
  if (!str) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    return str.substring(0, 10);
  }
  const slashParts = str.split('/');
  if (slashParts.length === 3 && slashParts[2].length === 4) {
    return `${slashParts[2]}-${slashParts[1].padStart(2, '0')}-${slashParts[0].padStart(2, '0')}`;
  }
  const hyphenParts = str.split('-');
  if (hyphenParts.length === 3 && hyphenParts[2].length === 4) {
    return `${hyphenParts[2]}-${hyphenParts[1].padStart(2, '0')}-${hyphenParts[0].padStart(2, '0')}`;
  }
  try {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }
  } catch {}
  return '';
};

export const getDashboardStats = async (req, res) => {
  try {
    let requests = await IhlrRequest.getAll();
    if (!requests) requests = fallbackRequests;

    const userRole = (req.query.role || req.user?.role || '').trim().toUpperCase();
    const userDept = (req.query.user_department || req.user?.department || (req.query.filter_dept || req.query.resp ? '' : req.query.department) || '').trim().toUpperCase();
    const isAdmin = userRole === 'ADMIN' || userDept === 'INCOMING QUALITY';

    // 1. Department-wise filter (by responsible department: resp / filter_dept)
    const targetDept = (req.query.resp || req.query.filter_dept || '').trim().toUpperCase();
    if (targetDept && targetDept !== 'ALL') {
      requests = requests.filter(r => (r.resp || '').trim().toUpperCase() === targetDept);
    }

    // 2. Date filter (by incident batch_date or created_at - defaults to current year)
    const currentYear = new Date().getFullYear();
    const isAllTime = req.query.allTime === 'true' || req.query.all_time === 'true';

    let startDate = (req.query.startDate || req.query.start_date || req.query.from_date || '').trim();
    let endDate = (req.query.endDate || req.query.end_date || req.query.to_date || '').trim();

    // By default for dashboard, fetch current year data unless allTime or custom range is given
    if (!isAllTime && !startDate && !endDate) {
      const year = req.query.year || currentYear;
      startDate = `${year}-01-01`;
      endDate = `${year}-12-31`;
    }

    if (startDate || endDate) {
      requests = requests.filter(r => {
        const itemDateStr = parseToDateStr(r.batch_date || r.created_at);
        if (!itemDateStr) return false;
        if (startDate && itemDateStr < startDate) return false;
        if (endDate && itemDateStr > endDate) return false;
        return true;
      });
    }

    const total = requests.length;
    const open = requests.filter(r => {
      const s = (r.status || '').toUpperCase();
      return s === 'OPEN' || s === 'PENDING';
    }).length;
    const inProgress = requests.filter(r => {
      const s = (r.status || '').toUpperCase();
      return s === 'IN_PROGRESS' || s === 'IN-PROGRESS';
    }).length;
    const closed = requests.filter(r => (r.status || '').toUpperCase() === 'CLOSED').length;

    const fourMBreakdown = {
      MAN: requests.filter(r => (r.four_m || '').toUpperCase() === 'MAN').length,
      MACHINE: requests.filter(r => (r.four_m || '').toUpperCase() === 'MACHINE').length,
      METHOD: requests.filter(r => (r.four_m || '').toUpperCase() === 'METHOD').length,
      MATERIAL: requests.filter(r => (r.four_m || '').toUpperCase() === 'MATERIAL').length,
    };

    const sortedRequests = [...requests].sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0));

    return successResponse(res, {
      total,
      open,
      pending: open,
      inProgress,
      approvalPending: inProgress,
      closed,
      fourMBreakdown,
      recentRequests: sortedRequests.slice(0, 5),
      currentYear,
      filter: {
        startDate,
        endDate,
        year: req.query.year || currentYear,
        isDefaultYear: !isAllTime && startDate === `${currentYear}-01-01` && endDate === `${currentYear}-12-31`
      }
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
        (String(r.req_no) && String(r.req_no).toLowerCase().includes(q)) ||
        (r.resp_person && r.resp_person.toLowerCase().includes(q))
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
          (s.includes('3') && (reqShift === '3' || reqShift === 'iii' || reqShift === 'shift 3' || reqShift === 'shift iii')) ||
          (s.includes('gen') && reqShift.includes('gen'));
      });
    }

    if (fourM && fourM !== 'All') {
      requests = requests.filter(r => (r.four_m || '').toUpperCase() === fourM.toUpperCase());
    }

    if (status && status !== 'All') {
      const targetStatus = status.toUpperCase();
      if (targetStatus === 'OPEN' || targetStatus === 'PENDING') {
        requests = requests.filter(r => {
          const s = (r.status || '').toUpperCase();
          return s === 'OPEN' || s === 'PENDING';
        });
      } else {
        requests = requests.filter(r => (r.status || '').toUpperCase() === targetStatus);
      }
    }

    // Department filter (resp / filter_dept)
    const targetDept = (req.query.resp || req.query.filter_dept || '').trim().toUpperCase();
    if (targetDept && targetDept !== 'ALL') {
      requests = requests.filter(r => (r.resp || '').trim().toUpperCase() === targetDept);
    }

    // Date filter
    const startDate = (req.query.startDate || req.query.start_date || req.query.from_date || '').trim();
    const endDate = (req.query.endDate || req.query.end_date || req.query.to_date || '').trim();
    if (startDate || endDate) {
      requests = requests.filter(r => {
        const itemDateStr = parseToDateStr(r.batch_date || r.created_at);
        if (!itemDateStr) return false;
        if (startDate && itemDateStr < startDate) return false;
        if (endDate && itemDateStr > endDate) return false;
        return true;
      });
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

    // 2. Resolve Assigned Person(s) (Selected Person(s) in field) details from DB
    const assignedNames = String(data.resp_person || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    let assignedUsersList = [];
    if (assignedNames.length > 0 && pool) {
      for (const name of assignedNames) {
        const [aRows] = await pool.query(
          'SELECT id, name, email, department, role FROM users WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) OR LOWER(TRIM(email)) = LOWER(TRIM(?)) LIMIT 1',
          [name, name]
        ).catch(() => [[]]);
        if (aRows && aRows.length > 0) {
          assignedUsersList.push(aRows[0]);
        } else {
          assignedUsersList.push({
            id: null,
            name: name,
            email: `${name.toLowerCase().replace(/\s+/g, '')}@gmail.com`,
            department: data.resp || 'PRODUCTION'
          });
        }
      }
    }

    if (assignedUsersList.length === 0) {
      assignedUsersList = [{
        id: null,
        name: data.resp_person || 'Assigned Officer',
        email: data.resp_person_email || `${String(data.resp_person || 'user').toLowerCase().replace(/\s+/g, '')}@gmail.com`,
        department: data.resp || 'PRODUCTION'
      }];
    }

    const assignedUser = assignedUsersList[0];
    const combinedAssignedEmails = assignedUsersList.map((u) => u.email).filter(Boolean).join(', ');

    // Enrich payload with resolved creator & assigned emails
    data.created_by = creatorUser.name;
    data.created_by_id = creatorUser.id;
    data.created_by_email = creatorUser.email;
    data.resp_person_email = combinedAssignedEmails || assignedUser.email;

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
      let normalizedShift = String(data.shift || 'Shift 1').trim();
      if (normalizedShift.toLowerCase().includes('gen')) normalizedShift = 'General';
      else if (normalizedShift.includes('1') || normalizedShift.toLowerCase() === 'i') normalizedShift = 'Shift 1';
      else if (normalizedShift.includes('2') || normalizedShift.toLowerCase() === 'ii') normalizedShift = 'Shift 2';
      else if (normalizedShift.includes('3') || normalizedShift.toLowerCase() === 'iii') normalizedShift = 'Shift 3';

      created = {
        id: newId,
        req_no: calculatedReqNo,
        batch_date: data.batch_date || new Date().toISOString().split('T')[0],
        shift: normalizedShift,
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
        resp_person_email: combinedAssignedEmails || assignedUser.email,
        created_at: new Date().toISOString()
      };
      fallbackRequests.unshift(created);
    }

    const reqNo = created.req_no || `IHLR-${created.id || '1'}`;

    // 3. Insert In-App Notifications for Raised Person & All Selected Persons
    if (pool && created) {
      try {
        const assignedNamesDisplay = assignedUsersList.map((u) => u.name).join(', ') || assignedUser.name;

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
            `Your IHLR defect observation report for "${created.model}" has been logged and assigned to ${assignedNamesDisplay} (${created.resp || 'Production'}).`
          ]
        );

        // Notification B: For Each Selected Person in the field (Action Required)
        for (const userItem of assignedUsersList) {
          await pool.query(
            `INSERT INTO ihlr_notifications 
             (user_id, user_name, user_email, request_id, req_no, type, title, message, link, is_read) 
             VALUES (?, ?, ?, ?, ?, 'assignment_required', ?, ?, '/ihlr/approvals', 0)`,
            [
              userItem.id,
              userItem.name,
              userItem.email,
              created.id,
              reqNo,
              `Action Required: IHLR Report #${reqNo} Assigned`,
              `Defect report #${reqNo} (${created.model} - "${created.problem}") has been assigned to you by ${creatorUser.name}. Please inspect and submit 5-Why root cause countermeasure.`
            ]
          );
        }
      } catch (notifErr) {
        console.warn('[IHLR Notifications] Error inserting multi-user in-app notifications:', notifErr.message);
      }
    }

    // 4. Trigger Emails to Raised Person AND All Selected Persons
    try {
      for (const userItem of assignedUsersList) {
        sendIhlrRequestEmails({
          request: created,
          creatorUser,
          assignedUser: userItem
        }).catch(mailErr => console.warn('[IHLR Mailer] Non-blocking email dispatch warning:', mailErr.message));
      }
    } catch (mailSyncErr) {
      console.warn('[IHLR Mailer] Sync email dispatch warning:', mailSyncErr.message);
    }

    // 5. Broadcast Realtime WebSocket Event
    broadcastEvent('ihlr:created', created);
    broadcastEvent('notifications:refresh', { module: 'ihlr', action: 'created', reqNo });

    return successResponse(res, created, 'IHLR request created successfully. Notifications and emails dispatched to both raised person and selected person.', 201);
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

export const updateIhlrRequest = async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Fetch existing request from DB or fallback
    let existing = null;
    if (pool) {
      const [existingRows] = await pool.query('SELECT * FROM ihlr_requests WHERE id = ? LIMIT 1', [id]).catch(() => [[]]);
      if (existingRows && existingRows.length > 0) {
        existing = existingRows[0];
      }
    }
    if (!existing) {
      existing = fallbackRequests.find(r => String(r.id) === String(id));
    }

    if (!existing) {
      return errorResponse(res, 'IHLR Request not found to update', 404);
    }

    const clean = (val) => (val || '').trim().toLowerCase().replace(/^(mr\.|mrs\.|ms\.)\s+/i, '');
    const userRole = (req.user?.role || req.body?.user?.role || req.body?.role || '').toUpperCase();
    const userDept = (req.user?.department || req.body?.user?.department || req.body?.department || '').toUpperCase();
    const isAdmin = userRole === 'ADMIN' || userDept === 'INCOMING QUALITY';
    const userName = clean(req.user?.name || req.body?.user?.name || req.body?.user_name);
    const userEmail = clean(req.user?.email || req.body?.user?.email || req.body?.user_email);
    const userId = req.user?.id ? String(req.user.id) : (req.body?.user?.id ? String(req.body.user.id) : null);

    // Guard: Once closed, only Admin can modify closed records
    const isClosed = String(existing.status || '').toUpperCase() === 'CLOSED';
    if (isClosed && !isAdmin) {
      return errorResponse(res, 'This incident is closed. Only Admin can modify closed records.', 403);
    }

    // Closer & Requester permission checks
    const respPerson = clean(existing.resp_person);
    const respPersonList = respPerson.split(',').map((s) => clean(s)).filter(Boolean);
    const respEmail = clean(existing.resp_person_email);
    const respEmailList = respEmail.split(',').map((s) => clean(s)).filter(Boolean);
    const respDept = clean(existing.resp);
    const isCloser = Boolean(
      (respPerson && (userName === respPerson || respPersonList.includes(userName) || respPersonList.some((p) => p.includes(userName) || userName.includes(p)))) ||
      (respEmail && userEmail && (userEmail === respEmail || respEmailList.includes(userEmail) || respEmail.includes(userEmail))) ||
      (respDept && userDept && clean(userDept) === respDept)
    );

    const createdBy = clean(existing.created_by);
    const createdEmail = clean(existing.created_by_email);
    const createdId = existing.created_by_id ? String(existing.created_by_id) : null;
    const isRequester = Boolean(
      (createdId && userId && createdId === userId) ||
      (createdBy && (userName === createdBy || userName.includes(createdBy) || createdBy.includes(userName))) ||
      (createdEmail && userEmail && userEmail === createdEmail)
    );

    if (!isAdmin && !isCloser) {
      return errorResponse(res, 'You are not authorized to update this IHLR request. Only the assigned closer or admin can submit updates.', 403);
    }

    // Single-Submission Rule for Closer:
    // Closer user can submit details ONLY ONCE. Only Quality Admin can update multiple times.
    if (!isAdmin && isCloser) {
      const isAlreadySubmittedByCloser = Boolean(
        String(existing.status || '').toUpperCase() === 'IN_PROGRESS' ||
        String(existing.status || '').toUpperCase() === 'CLOSED' ||
        (existing.action && String(existing.action).trim().length > 0) ||
        (existing.target_date && String(existing.target_date).trim().length > 0) ||
        (Array.isArray(existing.prod_why_why) && existing.prod_why_why.some((w) => Boolean(w && String(w).trim()))) ||
        (typeof existing.prod_why_why === 'string' && existing.prod_why_why.trim().length > 0 && existing.prod_why_why !== '[]')
      );

      if (isAlreadySubmittedByCloser) {
        return errorResponse(
          res,
          'Closer details have already been submitted once for this request. Only Quality Admin has permission to modify closer records multiple times.',
          403
        );
      }
    }

    // Role-based field segregation:
    // - Closer can ONLY update: prod_why_why, action, evidence_attachment, target_date
    // - Admin can update any field (including remarks, status, resp, resp_person)
    let safeUpdates = {};
    if (isAdmin) {
      const allowed = [
        'req_no', 'batch_date', 'shift', 'problem', 'model', 
        'problem_detected_at', 'received_from', 'analysis_done_by', 
        'defect_image', 'actual_qty', 'four_m', 'resp', 'resp_person', 'resp_person_email',
        'prod_why_why', 'action', 'evidence_attachment', 'target_date', 'remarks', 'status'
      ];
      for (const k of allowed) {
        if (req.body[k] !== undefined) safeUpdates[k] = req.body[k];
      }
    } else {
      if (isCloser) {
        if (req.body.prod_why_why !== undefined) safeUpdates.prod_why_why = req.body.prod_why_why;
        if (req.body.action !== undefined) safeUpdates.action = req.body.action;
        if (req.body.evidence_attachment !== undefined) safeUpdates.evidence_attachment = req.body.evidence_attachment;
        if (req.body.target_date !== undefined) safeUpdates.target_date = req.body.target_date;

        // Automatically transition status to IN_PROGRESS when closer updates their fields
        const currentStatus = String(existing.status || '').toUpperCase();
        if (currentStatus !== 'CLOSED') {
          safeUpdates.status = 'IN_PROGRESS';
        }
      }
    }

    if (!safeUpdates.status && String(existing.status || '').toUpperCase() === 'OPEN') {
      const hasCloserUpdates = safeUpdates.prod_why_why !== undefined || safeUpdates.action !== undefined || safeUpdates.evidence_attachment !== undefined || safeUpdates.target_date !== undefined;
      if (hasCloserUpdates) {
        safeUpdates.status = 'IN_PROGRESS';
      }
    }

    // Auto-resolve new assigned closer email from users table if reassigned
    if (safeUpdates.resp_person && pool && !safeUpdates.resp_person_email) {
      const names = String(safeUpdates.resp_person).split(',').map((s) => s.trim()).filter(Boolean);
      let emails = [];
      for (const n of names) {
        const [uRows] = await pool.query(
          'SELECT email FROM users WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) LIMIT 1',
          [n]
        ).catch(() => [[]]);
        if (uRows && uRows.length > 0 && uRows[0].email) {
          emails.push(uRows[0].email);
        }
      }
      if (emails.length > 0) {
        safeUpdates.resp_person_email = emails.join(', ');
      }
    }

    const prevRespPerson = existing.resp_person;
    const isReassigned = Boolean(
      safeUpdates.resp_person &&
      clean(safeUpdates.resp_person) !== clean(prevRespPerson)
    );

    // Clean dates and JSON structures safely
    if (safeUpdates.target_date !== undefined) {
      safeUpdates.target_date = safeUpdates.target_date ? String(safeUpdates.target_date).split('T')[0] : null;
    }
    if (safeUpdates.prod_why_why !== undefined && typeof safeUpdates.prod_why_why === 'string') {
      try {
        safeUpdates.prod_why_why = JSON.parse(safeUpdates.prod_why_why);
      } catch {
        safeUpdates.prod_why_why = [safeUpdates.prod_why_why];
      }
    }

    if (Object.keys(safeUpdates).length === 0) {
      return errorResponse(res, 'No permissible fields provided for update based on your role.', 400);
    }

    let updated = await IhlrRequest.update(id, safeUpdates);
    if (!updated) {
      const idx = fallbackRequests.findIndex(r => String(r.id) === String(id));
      if (idx !== -1) {
        fallbackRequests[idx] = { ...fallbackRequests[idx], ...safeUpdates, updated_at: new Date().toISOString() };
        updated = fallbackRequests[idx];
      }
    }

    if (!updated) {
      return errorResponse(res, 'IHLR Request not found to update', 404);
    }

    // 1. Trigger In-App Notifications and Email Dispatch
    if (pool && updated) {
      try {
        const reqNo = updated.req_no || `IHLR-${updated.id || id}`;
        const isClosed = String(updated.status || '').toUpperCase() === 'CLOSED';
        const closerName = req.user?.name || updated.resp_person || 'Assigned Officer';
        const closerDept = updated.resp || req.user?.department || 'PRODUCTION';

        // Fetch Quality Admin users from DB
        let adminUsers = [];
        const [aRows] = await pool.query(
          "SELECT id, name, email FROM users WHERE UPPER(role) = 'ADMIN' OR UPPER(department) = 'INCOMING QUALITY'"
        ).catch(() => [[]]);
        if (aRows && aRows.length > 0) {
          adminUsers = aRows;
        } else {
          adminUsers = [{ id: null, name: 'Quality Admin', email: 'admin@gmail.com' }];
        }

        // Notification A: For Raised Person (Requester) to complete pending fields
        if (updated.created_by_id || updated.created_by || updated.created_by_email) {
          const reqNotifType = isClosed ? 'case_closed' : 'closer_completed_pending_review';
          const reqNotifTitle = isClosed ? `IHLR Case Closed: #${reqNo}` : `Closer Countermeasures Submitted #${reqNo}`;
          const reqNotifMsg = isClosed
            ? `Defect report #${reqNo} (${updated.model || 'Model'}) has been verified and marked as CLOSED.`
            : `Closer ${closerName} (${closerDept}) has completed 5-Why root cause analysis and corrective action for #${reqNo} (${updated.model || 'Model'}). Quality Admin review and closure sign-off pending.`;

          await pool.query(
            `INSERT INTO ihlr_notifications 
             (user_id, user_name, user_email, request_id, req_no, type, title, message, link, is_read) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, '/ihlr/approvals', 0)`,
            [
              updated.created_by_id || null,
              updated.created_by || 'Quality Requester',
              updated.created_by_email || '',
              updated.id || id,
              reqNo,
              reqNotifType,
              reqNotifTitle,
              reqNotifMsg
            ]
          );
        }

        // Notification B: For Quality Admins to review and sign-off pending fields
        for (const admin of adminUsers) {
          // Avoid duplicate notification if requester is this admin
          if (updated.created_by_email && admin.email && updated.created_by_email.toLowerCase() === admin.email.toLowerCase()) {
            continue;
          }
          const adminNotifType = isClosed ? 'case_closed' : 'closer_completed_pending_admin_signoff';
          const adminNotifTitle = isClosed ? `IHLR Case Closed: #${reqNo}` : `Admin Action Required: Pending Sign-Off #${reqNo}`;
          const adminNotifMsg = isClosed
            ? `Defect report #${reqNo} (${updated.model || 'Model'}) has been signed off and closed.`
            : `Closer ${closerName} (${closerDept}) has completed countermeasures for #${reqNo} (${updated.model || 'Model'}). Action required: Please enter validation remarks and update status to finalize closure.`;

          await pool.query(
            `INSERT INTO ihlr_notifications 
             (user_id, user_name, user_email, request_id, req_no, type, title, message, link, is_read) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, '/ihlr/approvals', 0)`,
            [
              admin.id || null,
              admin.name || 'Admin',
              admin.email || 'admin@gmail.com',
              updated.id || id,
              reqNo,
              adminNotifType,
              adminNotifTitle,
              adminNotifMsg
            ]
          ).catch((e) => console.warn('[Admin Notif Error]:', e.message));
        }

        // Notification C: For Closer / Assigned Person (Acknowledgment)
        let closerUserId = null;
        let closerEmail = updated.resp_person_email || '';
        let closerPersonName = updated.resp_person || closerName;

        if (closerPersonName || closerEmail) {
          const [uRows] = await pool.query(
            'SELECT id, name, email FROM users WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) OR LOWER(TRIM(email)) = LOWER(TRIM(?)) LIMIT 1',
            [closerPersonName || '', closerEmail || closerPersonName || '']
          ).catch(() => [[]]);
          if (uRows && uRows.length > 0) {
            closerUserId = uRows[0].id;
            closerEmail = closerEmail || uRows[0].email;
            closerPersonName = uRows[0].name || closerPersonName;
          }
        }

        const closerNotifType = isClosed ? 'closure_confirmed' : 'countermeasure_saved';
        const closerNotifTitle = isClosed ? `IHLR Case Closed: #${reqNo}` : `Closer Submission Acknowledged: #${reqNo}`;
        const closerNotifMsg = isClosed
          ? `You have closed defect report #${reqNo} (${updated.model || 'Model'}). Containment and root cause countermeasures have been signed off.`
          : `Your 5-Why root cause analysis and corrective action for #${reqNo} (${updated.model || 'Model'}) have been submitted. The Requester and Quality Admin have been alerted with notification & email to complete the pending validation remarks and status sign-off.`;

        await pool.query(
          `INSERT INTO ihlr_notifications 
           (user_id, user_name, user_email, request_id, req_no, type, title, message, link, is_read) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, '/ihlr/approvals', 0)`,
          [
            closerUserId,
            closerPersonName,
            closerEmail,
            updated.id || id,
            reqNo,
            closerNotifType,
            closerNotifTitle,
            closerNotifMsg
          ]
        ).catch((e) => console.warn('[Closer Notif Error]:', e.message));

        // 2. Trigger Closer Email Dispatch to Requester, Quality Admins, and Closer
        try {
          sendIhlrCloserEmails({
            request: updated,
            closerUser: req.user,
            creatorUser: {
              id: updated.created_by_id,
              name: updated.created_by,
              email: updated.created_by_email
            },
            assignedUser: {
              name: updated.resp_person,
              email: updated.resp_person_email,
              department: updated.resp
            },
            adminUsers
          }).catch(mailErr => console.warn('[IHLR Mailer] Closer email dispatch warning:', mailErr.message));
        } catch (mailSyncErr) {
          console.warn('[IHLR Mailer] Sync closer email dispatch warning:', mailSyncErr.message);
        }

        // 3. If Reassigned, send distinct notification and email to newly assigned closer(s)
        if (isReassigned && updated.resp_person) {
          const newNames = String(updated.resp_person).split(',').map((s) => s.trim()).filter(Boolean);
          for (const nameItem of newNames) {
            let itemCloserId = null;
            let itemCloserEmail = '';
            if (pool) {
              const [nuRows] = await pool.query(
                'SELECT id, name, email FROM users WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) OR LOWER(TRIM(email)) = LOWER(TRIM(?)) LIMIT 1',
                [nameItem, nameItem]
              ).catch(() => [[]]);
              if (nuRows && nuRows.length > 0) {
                itemCloserId = nuRows[0].id;
                itemCloserEmail = nuRows[0].email;
              } else {
                itemCloserEmail = `${nameItem.toLowerCase().replace(/\s+/g, '')}@gmail.com`;
              }

              await pool.query(
                `INSERT INTO ihlr_notifications 
                 (user_id, user_name, user_email, request_id, req_no, type, title, message, link, is_read) 
                 VALUES (?, ?, ?, ?, ?, 'assigned_to_ihlr', ?, ?, '/ihlr/approvals', 0)`,
                [
                  itemCloserId,
                  nameItem,
                  itemCloserEmail,
                  updated.id || id,
                  reqNo,
                  `IHLR Defect Report Assigned: #${reqNo}`,
                  `You have been assigned to IHLR defect report #${reqNo} (${updated.model || 'Model'}) for ${updated.resp || 'Department'}. Please submit 5-Why root cause analysis and corrective countermeasures.`
                ]
              ).catch((e) => console.warn('[Reassign Notif Error]:', e.message));
            }

            if (itemCloserEmail) {
              try {
                sendEmail({
                  to: itemCloserEmail,
                  recipientName: nameItem,
                  recipientRole: 'ASSIGNED_CLOSER',
                  subject: `[IHLR Action Required] Defect Report Assigned to You: #${reqNo}`,
                  text: `Dear ${nameItem},\n\nIHLR incident #${reqNo} (${updated.model || 'Model'}) has been assigned to you (${updated.resp}).\n\nPlease review and submit 5-Why root cause analysis and containment actions at: http://localhost:5173/ihlr/approvals\n\nThank you,\nQuality Portal`,
                  referenceNo: reqNo,
                  moduleType: 'IHLR'
                }).catch((err) => console.warn('[Reassign Mail Warning]:', err.message));
              } catch (mErr) {
                console.warn('[Reassign Mail Sync Warning]:', mErr.message);
              }
            }
          }
        }

      } catch (notifErr) {
        console.warn('[IHLR Closer Notification Warning]:', notifErr.message);
      }
    }

    // Broadcast Realtime WebSocket Event
    broadcastEvent('ihlr:updated', updated);
    broadcastEvent('notifications:refresh', { module: 'ihlr', action: 'updated', id: updated.id || id, reqNo });

    return successResponse(res, updated, 'IHLR closer log updated successfully. Notifications and emails dispatched to Requester and Admin to complete pending fields.');
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

    // Broadcast Realtime WebSocket Event
    broadcastEvent('ihlr:deleted', { id });
    broadcastEvent('notifications:refresh', { module: 'ihlr', action: 'deleted', id });

    return successResponse(res, { id }, 'IHLR request deleted successfully');
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

export const getIhlrNotifications = async (req, res) => {
  try {
    const userName = (req.query.user || req.query.user_name || req.user?.name || '').trim();
    const userId = req.query.user_id ? Number(req.query.user_id) : (req.user?.id || null);
    const userEmail = (req.query.user_email || req.query.email || req.user?.email || '').trim().toLowerCase();
    const userRole = (req.query.role || req.user?.role || '').trim().toUpperCase();

    const userDept = (req.query.department || req.user?.department || '').trim().toUpperCase();
    const isAdmin = userRole === 'ADMIN' || userDept === 'INCOMING QUALITY';

    let notifRows = [];
    if (pool) {
      let query = 'SELECT * FROM ihlr_notifications';
      const params = [];
      const conditions = [];

      if (userId) {
        conditions.push('user_id = ?');
        params.push(userId);
      }
      if (userName) {
        conditions.push('LOWER(TRIM(user_name)) = LOWER(TRIM(?))');
        params.push(userName);
      }
      if (userEmail) {
        conditions.push('LOWER(TRIM(user_email)) = LOWER(TRIM(?))');
        params.push(userEmail);
      }
      if (isAdmin) {
        conditions.push("LOWER(TRIM(user_name)) = 'admin'");
        conditions.push("LOWER(TRIM(user_email)) LIKE '%admin%'");
        conditions.push("type LIKE '%admin%'");
      }

      if (conditions.length > 0) {
        query += ` WHERE (${conditions.join(' OR ')})`;
      } else if (!isAdmin) {
        return successResponse(res, [], 'IHLR notifications retrieved');
      }
      query += ' ORDER BY id DESC LIMIT 50';
      const [rows] = await pool.query(query, params).catch(() => [[]]);
      notifRows = rows || [];
    }

    // Also include synthetic recent request stream if notifications table is empty
    if (notifRows.length === 0) {
      let requests = (await IhlrRequest.getAll()) || [];
      if (!isAdmin) {
        if (!userName && !userId && !userEmail) {
          return successResponse(res, [], 'IHLR notifications retrieved');
        }
        requests = requests.filter(r => {
          const assignedNames = (r.resp_person || '')
            .toLowerCase()
            .split(',')
            .map(s => s.trim())
            .filter(Boolean);
          const assignedEmails = (r.resp_person_email || '')
            .toLowerCase()
            .split(',')
            .map(s => s.trim())
            .filter(Boolean);
          const rCreatedBy = (r.created_by || '').trim().toLowerCase();
          const rCreatedEmail = (r.created_by_email || '').trim().toLowerCase();

          const isAssigned =
            (userName && (assignedNames.includes(userName.toLowerCase()) || assignedNames.some(p => p.includes(userName.toLowerCase()) || userName.toLowerCase().includes(p)))) ||
            (userEmail && assignedEmails.includes(userEmail.toLowerCase()));
          const isCreator =
            (userName && (rCreatedBy === userName.toLowerCase() || userName.toLowerCase() === rCreatedBy)) ||
            (userEmail && rCreatedEmail === userEmail.toLowerCase()) ||
            (userId && String(r.created_by_id) === String(userId));

          return isAssigned || isCreator;
        });
      }
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
          link: '/ihlr/approvals'
        };
      });
      return successResponse(res, notifications, 'IHLR notifications retrieved');
    }

    const formatted = notifRows.map(n => {
      const isConfirmed = n.type === 'submission_confirmed';
      const isClosed = n.type === 'case_closed' || n.type === 'closure_confirmed' || n.type === 'closed';
      const isUpdated = n.type === 'countermeasure_updated' || n.type === 'countermeasure_saved';
      const isPendingSignoff = n.type === 'closer_completed_pending_review' || n.type === 'closer_completed_pending_admin_signoff' || n.type === 'pending_requester_signoff';

      let badgeLabel = 'ACTION REQUIRED';
      let accentColor = 'amber';
      let footerFlag = 'ACTION_REQUIRED';
      let dept = 'PRODUCTION';

      if (isPendingSignoff) {
        badgeLabel = 'PENDING SIGN-OFF';
        accentColor = 'amber';
        footerFlag = 'ACTION_REQUIRED';
        dept = 'QUALITY SIGN-OFF';
      } else if (isConfirmed) {
        badgeLabel = 'REPORT LOGGED';
        accentColor = 'blue';
        footerFlag = 'SYSTEM_LOGS';
        dept = 'INCOMING QUALITY';
      } else if (isClosed) {
        badgeLabel = 'CASE CLOSED';
        accentColor = 'emerald';
        footerFlag = 'CASE_CLOSED';
        dept = 'QUALITY VERIFIED';
      } else if (isUpdated) {
        badgeLabel = 'COUNTERMEASURE SUBMITTED';
        accentColor = 'indigo';
        footerFlag = 'OPERATIONAL_UPDATE';
        dept = 'PRODUCTION';
      }

      return {
        id: n.id,
        rawId: n.request_id,
        requestId: n.req_no,
        reqNo: String(n.req_no).startsWith('IHLR-') ? `#${n.req_no}` : `#IHLR-${n.req_no}`,
        badgeLabel,
        accentColor,
        department: dept,
        title: n.title,
        message: n.message,
        date: n.created_at ? new Date(n.created_at).toLocaleString('en-US', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Recent Today',
        subCategory: 'LINE DEFECT REPORT',
        footerFlag,
        read: Boolean(n.is_read),
        type: n.type,
        link: n.link || '/ihlr/approvals'
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
    const isRead = req.body?.read !== undefined ? (req.body.read ? 1 : 0) : 1;
    if (pool) {
      await pool.query('UPDATE ihlr_notifications SET is_read = ? WHERE id = ?', [isRead, id]);
    }
    broadcastEvent('notifications:refresh', { module: 'ihlr', action: isRead ? 'read' : 'unread', id });
    return successResponse(res, null, `Notification marked as ${isRead ? 'read' : 'unread'}`);
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

export const markIhlrNotificationUnread = async (req, res) => {
  try {
    const { id } = req.params;
    if (pool) {
      await pool.query('UPDATE ihlr_notifications SET is_read = 0 WHERE id = ?', [id]);
    }
    broadcastEvent('notifications:refresh', { module: 'ihlr', action: 'unread', id });
    return successResponse(res, null, 'Notification marked as unread');
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

export const markAllIhlrNotificationsRead = async (req, res) => {
  try {
    const userName = (req.body?.user || req.body?.user_name || req.query.user || req.query.user_name || req.user?.name || '').trim();
    const userId = req.body?.user_id || req.query.user_id || req.user?.id;
    const userEmail = (req.body?.user_email || req.query.user_email || req.user?.email || '').trim().toLowerCase();

    if (pool) {
      const conditions = [];
      const params = [];
      if (userId) {
        conditions.push('user_id = ?');
        params.push(userId);
      }
      if (userName) {
        conditions.push('LOWER(TRIM(user_name)) = LOWER(TRIM(?))');
        params.push(userName);
      }
      if (userEmail) {
        conditions.push('LOWER(TRIM(user_email)) = LOWER(TRIM(?))');
        params.push(userEmail);
      }

      if (conditions.length > 0) {
        await pool.query(`UPDATE ihlr_notifications SET is_read = 1 WHERE ${conditions.join(' OR ')}`, params);
      }
    }
    broadcastEvent('notifications:refresh', { module: 'ihlr', action: 'mark_all_read', userId, userName });
    return successResponse(res, null, 'Notifications marked as read');
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
