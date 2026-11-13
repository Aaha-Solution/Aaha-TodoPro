import { ihlrService } from './ihlrService';
import { processAuditService } from './processAuditService';
import { storage } from '../utils/storage';
import { isIhlrRequestVisibleToUser } from '../utils/ihlrAuthUtils';

/**
 * Helper to safely format ISO/timestamp dates into human-readable strings.
 */
const formatStreamDate = (dateVal) => {
  if (!dateVal) return 'Recent Today';
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return String(dateVal);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const time = d.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    return `${day}/${month}/${year} • ${time}`;
  } catch {
    return String(dateVal);
  }
};

/**
 * Helper to extract a normalized numeric epoch timestamp from any notification or request item
 * for rock-solid chronological sorting (newest first).
 */
export const getNotificationSortTime = (item) => {
  if (!item) return 0;
  const candidates = [item.createdAt, item.rawDate, item.created_at, item.date, item.timeDisplay];
  for (const candidate of candidates) {
    if (!candidate) continue;
    if (candidate instanceof Date && !isNaN(candidate.getTime())) return candidate.getTime();
    if (typeof candidate === 'number' && !isNaN(candidate) && candidate > 0) return candidate;
    if (typeof candidate === 'string') {
      const trimmed = candidate.trim();
      const direct = new Date(trimmed.replace(' ', 'T'));
      if (!isNaN(direct.getTime())) return direct.getTime();
      const rawDirect = new Date(trimmed);
      if (!isNaN(rawDirect.getTime())) return rawDirect.getTime();
      const dmyMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:[^\d]+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
      if (dmyMatch) {
        const [_, day, month, year, hours, minutes, seconds] = dmyMatch;
        const d = new Date(Number(year), Number(month) - 1, Number(day), Number(hours || 0), Number(minutes || 0), Number(seconds || 0));
        if (!isNaN(d.getTime())) return d.getTime();
      }
    }
  }
  const idCandidate = Number(item.notifId || item.rawId);
  if (!isNaN(idCandidate) && idCandidate > 0) return idCandidate;
  return 0;
};


/**
 * Read state overrides cache (persists read/unread state in localStorage)
/**
 * Helper to get a stable, isolated user key for localStorage overrides.
 */
export const getNotificationStorageUserKey = (user) => {
  if (!user) return 'global';
  if (typeof user === 'string') return user.trim().toLowerCase();
  const idStr = user.id !== undefined && user.id !== null ? String(user.id).trim() : '';
  const nameStr = user.name ? String(user.name).trim().toLowerCase() : '';
  const emailStr = user.email ? String(user.email).trim().toLowerCase() : '';
  return idStr || nameStr || emailStr || 'global';
};

/**
 * Read state overrides cache (persists read/unread state in localStorage per user)
 */
export const getReadOverrides = (tab, user) => {
  try {
    const userKey = getNotificationStorageUserKey(user);
    const key = `notifications_read_${tab}_${userKey}`;
    const raw = localStorage.getItem(key);
    let parsed = raw ? JSON.parse(raw) : null;
    if (!parsed && user?.name && userKey !== user.name.trim().toLowerCase()) {
      const altKey = `notifications_read_${tab}_${user.name.trim().toLowerCase()}`;
      const altRaw = localStorage.getItem(altKey);
      if (altRaw) parsed = JSON.parse(altRaw);
    }
    return parsed || {};
  } catch {
    return {};
  }
};

export const getReadOverride = (tab, user, notifKey) => {
  const overrides = getReadOverrides(tab, user);
  if (notifKey === undefined || notifKey === null) return null;
  return overrides[String(notifKey)] !== undefined ? Boolean(overrides[String(notifKey)]) : null;
};

export const setReadOverride = (tab, user, notifKey, isRead) => {
  try {
    const userKey = getNotificationStorageUserKey(user);
    const key = `notifications_read_${tab}_${userKey}`;
    const current = getReadOverrides(tab, user);
    current[String(notifKey)] = Boolean(isRead);
    localStorage.setItem(key, JSON.stringify(current));
    if (user?.name && userKey !== user.name.trim().toLowerCase()) {
      const altKey = `notifications_read_${tab}_${user.name.trim().toLowerCase()}`;
      localStorage.setItem(altKey, JSON.stringify(current));
    }
  } catch (e) {
    console.warn('Failed to save read override in localStorage:', e);
  }
};

/**
 * Loads and standardizes IHLR notifications & recent defect requests.
 */
export const fetchIhlrNotificationsFeed = async (user) => {
  try {
    const storedUser = storage.getUser() || {};
    const resolvedUser = {
      ...storedUser,
      ...(user || {}),
      department: (user?.department || storedUser?.department || '').trim().toUpperCase(),
    };

    const userRole = (resolvedUser?.role || '').trim().toUpperCase();
    const userDept = (resolvedUser?.department || '').trim().toUpperCase();
    const isAdmin = userRole === 'ADMIN' || userDept === 'QAD';

    const [apiNotifs, requests] = await Promise.all([
      ihlrService
        .getNotifications({
          user: resolvedUser?.name,
          user_name: resolvedUser?.name,
          user_id: resolvedUser?.id,
          user_email: resolvedUser?.email,
          role: resolvedUser?.role,
          department: resolvedUser?.department,
        })
        .catch(() => []),
      ihlrService.getRequests().catch(() => []),
    ]);

    const overrides = getReadOverrides('ihlr', resolvedUser);
    const streamList = [];

    if (Array.isArray(apiNotifs) && apiNotifs.length > 0) {
      apiNotifs.forEach((n) => {
        const uName = (resolvedUser?.name || '').trim().toLowerCase();
        const uEmail = (resolvedUser?.email || '').trim().toLowerCase();
        const uId = String(resolvedUser?.id || '');

        const nName = (n.user_name || '').trim().toLowerCase();
        const nEmail = (n.user_email || '').trim().toLowerCase();
        const nId = String(n.user_id || '');

        const nNameList = nName.split(',').map((s) => s.trim()).filter(Boolean);
        const nEmailList = nEmail.split(',').map((s) => s.trim()).filter(Boolean);

        const isDirectMatch =
          (uId && nId && uId === nId) ||
          (uName && nName && (uName === nName || nNameList.includes(uName))) ||
          (uEmail && nEmail && (uEmail === nEmail || nEmailList.includes(uEmail)));

        // If explicitly addressed to another user (different user_id), never show it to the current user
        if (nId && uId && nId !== uId && !isDirectMatch) return;

        // Non-admins only see notifications directly addressed to them
        if (!isAdmin && !isDirectMatch) return;

        // Personal action & acknowledgment notifications:
        // 'submission_confirmed' ("Your report has been logged"), 'assignment_required' ("assigned to you"),
        // 'countermeasure_saved' ("Closer Submission Acknowledged"), and 'countermeasure_updated' ("Closer Countermeasures Submitted")
        // are strictly personal to the addressed recipient and MUST NEVER appear in other users' streams (including Admin)
        if (
          (n.type === 'submission_confirmed' ||
            n.type === 'request_created' ||
            n.type === 'assignment_required' ||
            n.type === 'countermeasure_saved' ||
            n.type === 'countermeasure_updated' ||
            n.type === 'cc_notification') &&
          !isDirectMatch
        ) {
          return;
        }

        const isClosedNotif =
          ['case_closed', 'closure_confirmed', 'closed'].includes(n.type) ||
          (n.title && n.title.toLowerCase().includes('closed')) ||
          n.badgeLabel === 'CASE CLOSED';
        const isPendingSignoff =
          ['closer_completed_pending_review', 'closer_completed_pending_admin_signoff', 'pending_requester_signoff'].includes(n.type) ||
          (n.title && n.title.toLowerCase().includes('pending sign-off')) ||
          (n.title && n.title.toLowerCase().includes('pending fields'));
        const isUpdatedNotif =
          !isPendingSignoff &&
          (['countermeasure_updated', 'countermeasure_saved'].includes(n.type) ||
          n.badgeLabel === 'COUNTERMEASURE SUBMITTED');
        const isConfirmedNotif = n.type === 'submission_confirmed';
        const isAssignmentNotif =
          !isPendingSignoff &&
          !isClosedNotif &&
          !isUpdatedNotif &&
          (n.type === 'assignment_required' ||
            n.type === 'approval_required' ||
            n.type === 'qad_action_required' ||
            (n.title && n.title.toLowerCase().includes('action required') && !n.title.toLowerCase().includes('sign-off')) ||
            (n.title && n.title.toLowerCase().includes('new request assigned')));
        const isCcNotif =
          n.type === 'cc_notification' ||
          (n.title && n.title.toLowerCase().includes('cc notification'));

        const notifIdStr = `notif-${n.id}`;
        const reqNoKey = n.reqNo || (n.requestId ? (String(n.requestId).startsWith('#') ? n.requestId : `#${n.requestId}`) : '');

        // Resolve matched request to extract creator (raisedBy) and assigned person (assignedTo)
        const cleanReqId = n.request_id || n.rawId;
        const cleanReqNo = String(n.req_no || n.reqNo || reqNoKey || '').replace(/^#/, '').trim();
        const matchedReq = Array.isArray(requests)
          ? requests.find((r) =>
              (cleanReqId && Number(r.id) === Number(cleanReqId)) ||
              (cleanReqNo && String(r.req_no || '').replace(/^#/, '').trim() === cleanReqNo)
            )
          : null;

        const raisedBy = n.raised_by || matchedReq?.created_by || n.created_by || '';
        const assignedTo = n.assigned_to || matchedReq?.resp_person || n.resp_person || '';
        const assignedBy = matchedReq?.reviewed_by || raisedBy;

        // Format simplified clean message: "<reqNo> (<model>). Request raised and assigned by <Person> to <You/User>"
        const reqTag = cleanReqNo ? (cleanReqNo.startsWith('IHLR-') ? cleanReqNo : `IHLR-${cleanReqNo}`) : (reqNoKey ? reqNoKey.replace(/^#/, '') : 'IHLR');
        const modelLabel = n.request_model || matchedReq?.model || n.model || 'Model';
        const rName = raisedBy || 'Requester';
        const aName = assignedTo || n.user_name || 'Assigned Person';

        const reqDept = (matchedReq?.resp || matchedReq?.department || n.department || '').trim().toUpperCase();
        const isAckNotif = n.type === 'countermeasure_saved';

        let notifMessage = '';
        if (isClosedNotif) {
          notifMessage = `${reqTag} (${modelLabel}). Request verified and closed`;
        } else if (isPendingSignoff) {
          notifMessage = `${reqTag} (${modelLabel}). Countermeasures submitted by ${aName} — pending sign-off`;
        } else if (isAckNotif) {
          notifMessage = `${reqTag} (${modelLabel}). Your closer countermeasures${reqDept ? ` (${reqDept})` : ''} have been submitted — awaiting review`;
        } else if (isUpdatedNotif) {
          notifMessage = `${reqTag} (${modelLabel}). Countermeasures submitted by ${matchedReq?.closer_updated_by || aName}${reqDept ? ` (${reqDept})` : ''} — awaiting review`;
        } else if (isConfirmedNotif) {
          notifMessage = `${reqTag} (${modelLabel}). Request raised by you (${rName}) and assigned to ${aName}`;
        } else if (isAssignmentNotif) {
          notifMessage = `${reqTag} (${modelLabel}). Request raised and assigned by ${rName} to you (${aName})`;
        } else if (isCcNotif) {
          notifMessage = `${reqTag} (${modelLabel}). Request raised and assigned by ${rName} to ${aName}`;
        } else if (n.type === 'assigned_to_ihlr' || n.type === 'ihlr_reassigned') {
          notifMessage = `${reqTag} (${modelLabel}). Request reassigned by ${assignedBy || 'Admin'} to ${aName}`;
        } else {
          notifMessage = `${reqTag} (${modelLabel}). Request raised and assigned by ${rName} to ${aName}`;
        }

        // Authoritative read status:
        // Database is the ground truth for persisted notifications.
        // If DB has is_read field (0 or 1), use it directly: if is_read === 0, it is DEFINITIVELY UNREAD.
        let isItemRead = false;
        if (n.is_read !== undefined && n.is_read !== null) {
          isItemRead = Number(n.is_read) === 1;
          if (!isItemRead) {
            // Clean up any stale local override for this active unread notification
            setReadOverride('ihlr', resolvedUser, notifIdStr, false);
            setReadOverride('ihlr', resolvedUser, n.id, false);
          }
        } else {
          const savedRead =
            getReadOverride('ihlr', resolvedUser, notifIdStr) ??
            getReadOverride('ihlr', resolvedUser, n.id);
          isItemRead = savedRead !== null ? savedRead : Boolean(n.read);
        }

        const currentBadgeLabel = isClosedNotif
          ? 'CASE CLOSED'
          : isPendingSignoff
          ? 'PENDING SIGN-OFF'
          : isAckNotif
          ? 'SUBMISSION ACKNOWLEDGED'
          : isUpdatedNotif
          ? 'COUNTERMEASURE SUBMITTED'
          : isConfirmedNotif
          ? 'REPORT LOGGED'
          : isCcNotif
          ? 'CC NOTIFICATION'
          : n.badgeLabel || 'ACTION REQUIRED';

        // Deduplicate streamList:
        // 1. By unique notification ID
        // 2. By request key and event badge (prevent duplicate cards for the exact same event/badge, while preserving distinct lifecycle stages like REPORT LOGGED and PENDING SIGN-OFF)
        const isDuplicate = streamList.some((s) => {
          if (s.id === notifIdStr) return true;
          if (reqNoKey && s.reqNo === reqNoKey) {
            if (s.badgeLabel === currentBadgeLabel) return true;
            if (s.type === n.type && s.title === n.title) return true;
          }
          return false;
        });

        if (isDuplicate) return;

        streamList.push({
          id: notifIdStr,
          notifId: n.id,
          rawId: n.rawId,
          reqNo: n.reqNo || (n.requestId ? (String(n.requestId).startsWith('#') ? n.requestId : `#${n.requestId}`) : '#IHLR'),
          badgeLabel: currentBadgeLabel,
          accentColor: isClosedNotif
            ? 'emerald'
            : isPendingSignoff
            ? 'amber'
            : isUpdatedNotif
            ? 'indigo'
            : isConfirmedNotif
            ? 'blue'
            : isCcNotif
            ? 'blue'
            : n.accentColor || 'amber',
          department: isClosedNotif
            ? 'QUALITY VERIFIED'
            : isPendingSignoff
            ? 'QUALITY SIGN-OFF'
            : isCcNotif
            ? 'INFORMATION'
            : reqDept || n.department || 'PRODUCTION',
          title: n.title,
          message: notifMessage,
          raisedBy,
          assignedTo,
          assignedBy,
          timeDisplay: formatStreamDate(n.date),
          createdAt: n.created_at || n.date,
          rawDate: n.created_at || n.date,
          subCategory: 'LINE DEFECT REPORT',
          footerFlag: isClosedNotif
            ? 'CASE_CLOSED'
            : isPendingSignoff
            ? 'ACTION_REQUIRED'
            : isUpdatedNotif
            ? 'OPERATIONAL_UPDATE'
            : isConfirmedNotif
            ? 'SYSTEM_LOGS'
            : isCcNotif
            ? 'SYSTEM_LOGS'
            : n.footerFlag || 'ACTION_REQUIRED',
          read: isItemRead,
          type: n.type || (isClosedNotif ? 'closed' : isCcNotif ? 'info' : 'info'),
          link: n.link || (isCcNotif ? '/ihlr/all-requests' : '/ihlr/approvals'),
        });
      });
    }

    if (Array.isArray(requests)) {
      requests.forEach((r, idx) => {
        // Enforce strict access control:
        // Operational users only see notifications for requests where they are the selected responsible person or creator!
        // Other departments (e.g. PED) and unassigned users MUST NOT receive notifications for this request.
        if (!isIhlrRequestVisibleToUser(r, resolvedUser)) {
          return;
        }

        const reqNo = String(r.req_no || '').startsWith('IHLR-') ? r.req_no : `IHLR-${r.req_no || idx + 1}`;
        const isClosed = (r.status || '').toUpperCase() === 'CLOSED';
        const isInProgress = ['IN_PROGRESS', 'IN-PROGRESS', 'AWAITING REVIEW', 'AWAITING_REVIEW', 'APPROVAL_PENDING', 'APPROVAL PENDING', 'UNDER_REVIEW'].includes((r.status || '').toUpperCase());
        const dept = (r.resp || r.department || 'PRODUCTION').toUpperCase();
        const fourM = r.four_m ? `4M: ${r.four_m} • ${r.problem_detected_at || 'CELL INSPECTION'}` : '4M: METHOD • PROCESS LINE';
        const formattedDate = formatStreamDate(r.created_at || r.batch_date);

        if (!streamList.some((s) => s.reqNo === `#${reqNo}`)) {
          const reqCardId = isClosed
            ? `req-closed-${r.id || idx}`
            : isInProgress
            ? `req-progress-${r.id || idx}`
            : `req-open-${r.id || idx}`;

          let isReqRead = isClosed ? true : false;
          if (overrides[reqCardId] !== undefined) {
            isReqRead = overrides[reqCardId];
          } else if (overrides[`req-${r.id}`] !== undefined) {
            isReqRead = overrides[`req-${r.id}`];
          } else if (overrides[`#${reqNo}`] !== undefined) {
            isReqRead = overrides[`#${reqNo}`];
          }

          if (isClosed) {
            streamList.push({
              id: reqCardId,
              rawId: r.id,
              reqNo: `#${reqNo}`,
              badgeLabel: 'CONTAINMENT APPROVED',
              accentColor: 'emerald',
              department: dept,
              title: `Defect Containment & Closure Approved – ${reqNo}`,
              message: `Rejection incident ${reqNo} (Model: ${r.model || 'OLS LONG ARM'}, Defect: "${r.problem || 'Quality variance'}") has been verified. 5-Why root cause countermeasure confirmed by ${r.analysis_done_by || 'Quality Assurance'}. Status: Closed.`,
              timeDisplay: formattedDate,
              createdAt: r.created_at || r.batch_date,
              rawDate: r.created_at || r.batch_date,
              subCategory: fourM,
              footerFlag: 'SYSTEM_LOGS',
              read: isReqRead,
              type: 'closed',
              link: '/ihlr/all-requests',
            });
          } else if (isInProgress) {
            streamList.push({
              id: reqCardId,
              rawId: r.id,
              reqNo: `#${reqNo}`,
              badgeLabel: 'COUNTERMEASURE REQUIRED',
              accentColor: 'amber',
              department: dept,
              title: `Occurrence Countermeasure in Progress – ${reqNo}`,
              message: `Line rejection report ${reqNo} ("${r.problem || 'Defect under investigation'}"). Assigned responsible person ${r.resp_person || 'Supervisor'} (${dept}) is executing containment and 5-Why countermeasure actions. Target Date: ${r.target_date ? String(r.target_date).split('T')[0] : 'TBD'}.`,
              timeDisplay: formattedDate,
              createdAt: r.created_at || r.batch_date,
              rawDate: r.created_at || r.batch_date,
              subCategory: fourM,
              footerFlag: 'ACTION_REQUIRED',
              read: isReqRead,
              type: 'in_progress',
              link: '/ihlr/all-requests',
            });
          } else {
            streamList.push({
              id: reqCardId,
              rawId: r.id,
              reqNo: `#${reqNo}`,
              badgeLabel: 'NEW LINE REJECTION',
              accentColor: 'blue',
              department: dept,
              title: `New Defect Incident Logged – ${reqNo}`,
              message: `Incident ${reqNo} detected at ${r.problem_detected_at || 'Assembly Line'} for Model ${r.model || 'OLS LONG ARM'} (Rejected Qty: ${r.actual_qty || 1} units). Assigned to ${r.resp_person || 'Supervisor'} (${dept}). Quality team initiated 5-Why problem root cause isolation.`,
              timeDisplay: formattedDate,
              createdAt: r.created_at || r.batch_date,
              rawDate: r.created_at || r.batch_date,
              subCategory: fourM,
              footerFlag: 'ACTION_REQUIRED',
              read: isReqRead,
              type: 'open',
              link: '/ihlr/all-requests',
            });
          }
        }
      });
    }

    // Guarantee all IHLR notifications are sorted chronologically descending (newest first)
    streamList.sort((a, b) => {
      const timeA = getNotificationSortTime(a);
      const timeB = getNotificationSortTime(b);
      if (timeB !== timeA) return timeB - timeA;
      const idA = Number(a.notifId || a.rawId || 0);
      const idB = Number(b.notifId || b.rawId || 0);
      return idB - idA;
    });

    return streamList;
  } catch (err) {
    console.error('Failed to load IHLR notifications:', err);
    return [];
  }
};

/**
 * Loads and standardizes Process Audit notifications & recent audit requests.
 */
export const fetchProcessAuditNotificationsFeed = async (user) => {
  try {
    const storedUser = storage.getUser() || {};
    const resolvedUser = {
      ...storedUser,
      ...(user || {}),
      department: (user?.department || storedUser?.department || '').trim().toUpperCase(),
    };

    const userRole = (resolvedUser?.role || '').trim().toUpperCase();
    const userDept = (resolvedUser?.department || '').trim().toUpperCase();
    const isAdmin =
      userRole === 'ADMIN' ||
      userRole === 'SUPER_ADMIN' ||
      userRole === 'SUPER ADMIN' ||
      userDept === 'QAD' ||
      (resolvedUser?.name || '').toLowerCase().includes('admin');

    const [apiNotifs, requests] = await Promise.all([
      processAuditService
        .getNotifications({
          user: resolvedUser?.name,
          user_name: resolvedUser?.name,
          user_id: resolvedUser?.id,
          user_email: resolvedUser?.email,
          role: resolvedUser?.role,
          department: resolvedUser?.department,
        })
        .catch(() => []),
      processAuditService.getRequests().catch(() => []),
    ]);

    const streamList = [];

    if (Array.isArray(apiNotifs) && apiNotifs.length > 0) {
      apiNotifs.forEach((n) => {
        const uName = (resolvedUser?.name || '').trim().toLowerCase();
        const uEmail = (resolvedUser?.email || '').trim().toLowerCase();
        const uId = String(resolvedUser?.id || '');

        const nName = (n.user_name || '').trim().toLowerCase();
        const nEmail = (n.user_email || '').trim().toLowerCase();
        const nId = String(n.user_id || '');

        const nNameList = nName.split(',').map((s) => s.trim()).filter(Boolean);
        const nEmailList = nEmail.split(',').map((s) => s.trim()).filter(Boolean);

        const isDirectMatch =
          (uId && nId && uId === nId) ||
          (uName && nName && (uName === nName || nNameList.includes(uName))) ||
          (uEmail && nEmail && (uEmail === nEmail || nEmailList.includes(uEmail)));

        // If explicitly addressed to another user (different user_id), never show it to the current user
        if (nId && uId && nId !== uId && !isDirectMatch) return;

        // Non-admins only see notifications directly addressed to them
        if (!isAdmin && !isDirectMatch) return;

        // Personal action & acknowledgment notifications:
        // 'submission_confirmed' ("Your report has been logged"), 'assignment_required' ("assigned to you"),
        // and 'countermeasure_saved' ("Your 5-Why analysis... submitted") are strictly personal to the recipient
        // and MUST NEVER appear in other users' streams (including Admin)
        if (
          (n.type === 'submission_confirmed' ||
            n.type === 'request_created' ||
            n.type === 'assignment_required' ||
            n.type === 'countermeasure_saved' ||
            n.type === 'cc_notification') &&
          !isDirectMatch
        ) {
          return;
        }

        const isClosedNotif =
          ['case_closed', 'closure_confirmed', 'closed', 'request_closed'].includes(n.type) ||
          (n.title && n.title.toLowerCase().includes('closed')) ||
          n.badgeLabel === 'CASE CLOSED';
        const isPendingSignoff =
          ['closer_completed_pending_review', 'closer_completed_pending_admin_signoff', 'pending_requester_signoff'].includes(n.type) ||
          (n.title && n.title.toLowerCase().includes('pending sign-off')) ||
          (n.title && n.title.toLowerCase().includes('pending fields'));
        const isUpdatedNotif =
          ['countermeasure_updated', 'countermeasure_saved'].includes(n.type) ||
          n.badgeLabel === 'COUNTERMEASURE SUBMITTED' ||
          n.badgeLabel === 'ACTION SUBMITTED';
        const isConfirmedNotif = n.type === 'submission_confirmed' || n.type === 'request_created';
        const isReassignedNotif =
          n.type === 'reassigned' ||
          n.type === 'pa_reassigned' ||
          (n.title && n.title.toLowerCase().includes('reassign')) ||
          (n.message && n.message.toLowerCase().includes('reassign')) ||
          n.badgeLabel === 'REASSIGNED';
        const isAssignmentNotif =
          n.type === 'assignment_required' ||
          n.type === 'approval_required' ||
          (n.title && n.title.toLowerCase().includes('action required')) ||
          (n.title && n.title.toLowerCase().includes('new request assigned'));
        const isCcNotif =
          n.type === 'cc_notification' ||
          (n.title && n.title.toLowerCase().includes('cc notification'));

        const notifIdStr = `pa-notif-${n.id}`;
        const rawReq = n.requestId || n.issue_no || '';
        const reqNoKey = rawReq ? (String(rawReq).startsWith('#') ? rawReq : `#${rawReq}`) : '#PA';

        const cleanPaId = n.request_id || n.rawId;
        const cleanIssueNo = String(n.issue_no || n.issueNo || n.requestId || '').replace(/^#/, '').trim();
        const matchedPaReq = Array.isArray(requests)
          ? requests.find((r) =>
              (cleanPaId && Number(r.id) === Number(cleanPaId)) ||
              (cleanIssueNo && String(r.issue_no || '').replace(/^#/, '').trim() === cleanIssueNo)
            )
          : null;

        const raisedBy = n.raised_by || matchedPaReq?.creator || matchedPaReq?.created_by || '';
        const assignedTo = n.assigned_to || matchedPaReq?.closer || matchedPaReq?.executor || matchedPaReq?.resp_person || '';
        const assignedBy = matchedPaReq?.reviewed_by || raisedBy;

        // Authoritative read status
        let isItemRead = false;
        if (n.is_read !== undefined && n.is_read !== null) {
          isItemRead = Number(n.is_read) === 1;
          if (!isItemRead) {
            setReadOverride('process-audit', resolvedUser, notifIdStr, false);
            setReadOverride('process-audit', resolvedUser, n.id, false);
          }
        } else {
          const savedRead =
            getReadOverride('process-audit', resolvedUser, notifIdStr) ??
            getReadOverride('process-audit', resolvedUser, n.id);
          isItemRead = savedRead !== null ? savedRead : Boolean(n.read);
        }

        // Deduplicate streamList
        const isDuplicate = streamList.some((s) => {
          if (s.id === notifIdStr) return true;
          if (reqNoKey && s.reqNo === reqNoKey) {
            if (isAssignmentNotif && (s.type === 'assignment_required' || s.type === 'approval_required' || s.badgeLabel === 'ACTION REQUIRED')) return true;
            if (isClosedNotif && s.badgeLabel === 'CASE CLOSED') return true;
            if (isPendingSignoff && s.badgeLabel === 'PENDING SIGN-OFF') return true;
            if (isUpdatedNotif && (s.badgeLabel === 'COUNTERMEASURE SUBMITTED' || s.badgeLabel === 'ACTION SUBMITTED')) return true;
            if (isConfirmedNotif && s.badgeLabel === 'REPORT LOGGED') return true;
            if (isCcNotif && s.badgeLabel === 'CC NOTIFICATION') return true;
            if (isReassignedNotif && s.badgeLabel === 'REASSIGNED') return true;
            if (s.type === n.type && s.title === n.title) return true;
          }
          return false;
        });

        if (isDuplicate) return;

        let notifTitle = n.title;
        const paReqTag = cleanIssueNo ? (cleanIssueNo.startsWith('PA-') ? cleanIssueNo : `PA-${cleanIssueNo}`) : (reqNoKey ? reqNoKey.replace(/^#/, '') : 'PA');
        const paModelLabel = matchedPaReq?.model || matchedPaReq?.product || 'Process Audit';
        const paRName = raisedBy || 'Auditor';
        const paAName = assignedTo || n.user_name || 'Assigned Closer';

        let notifMessage = '';
        if (isClosedNotif) {
          notifMessage = `${paReqTag} (${paModelLabel}). Finding verified and closed`;
        } else if (isPendingSignoff) {
          notifMessage = `${paReqTag} (${paModelLabel}). Countermeasures submitted by ${paAName} — pending sign-off`;
        } else if (isConfirmedNotif) {
          notifMessage = `${paReqTag} (${paModelLabel}). Request raised by you (${paRName}) and assigned to ${paAName}`;
        } else if (isAssignmentNotif) {
          notifMessage = `${paReqTag} (${paModelLabel}). Request raised and assigned by ${paRName} to you (${paAName})`;
        } else if (isCcNotif) {
          notifMessage = `${paReqTag} (${paModelLabel}). Request raised and assigned by ${paRName} to ${paAName}`;
        } else if (isReassignedNotif) {
          notifMessage = `${paReqTag} (${paModelLabel}). Request reassigned by ${assignedBy || 'Admin'} to ${paAName}`;
        } else {
          notifMessage = `${paReqTag} (${paModelLabel}). Request raised and assigned by ${paRName} to ${paAName}`;
        }

        if (isReassignedNotif && notifTitle && notifTitle.includes('Assigned') && !notifTitle.includes('Reassigned')) {
          notifTitle = notifTitle.replace(/\bAssigned\b/g, 'Reassigned');
        }

        streamList.push({
          id: notifIdStr,
          notifId: n.id,
          rawId: n.rawId || n.id,
          reqNo: reqNoKey,
          badgeLabel: isClosedNotif
            ? 'CASE CLOSED'
            : isPendingSignoff
            ? 'PENDING SIGN-OFF'
            : isReassignedNotif
            ? 'REASSIGNED'
            : isUpdatedNotif
            ? 'ACTION SUBMITTED'
            : isConfirmedNotif
            ? 'REPORT LOGGED'
            : isCcNotif
            ? 'CC NOTIFICATION'
            : n.badgeLabel || 'ACTION REQUIRED',
          accentColor: isClosedNotif
            ? 'emerald'
            : isPendingSignoff
            ? 'amber'
            : isReassignedNotif
            ? 'purple'
            : isUpdatedNotif
            ? 'indigo'
            : isConfirmedNotif
            ? 'blue'
            : isCcNotif
            ? 'blue'
            : n.accentColor || 'amber',
          department: n.department || (isClosedNotif ? 'QUALITY VERIFIED' : isPendingSignoff ? 'QUALITY SIGN-OFF' : isCcNotif ? 'INFORMATION' : 'PRODUCTION'),
          title: notifTitle,
          message: notifMessage,
          raisedBy,
          assignedTo,
          assignedBy,
          timeDisplay: formatStreamDate(n.date || n.time || n.created_at),
          subCategory: 'PROCESS AUDIT OBSERVATION',
          footerFlag: isClosedNotif
            ? 'CASE_CLOSED'
            : isPendingSignoff
            ? 'ACTION_REQUIRED'
            : isReassignedNotif
            ? 'REASSIGNED'
            : isUpdatedNotif
            ? 'OPERATIONAL_UPDATE'
            : isConfirmedNotif
            ? 'SYSTEM_LOGS'
            : isCcNotif
            ? 'SYSTEM_LOGS'
            : n.footerFlag || 'ACTION_REQUIRED',
          read: isItemRead,
          type: n.type || (isClosedNotif ? 'closed' : isCcNotif ? 'info' : 'info'),
          link: n.link || (isClosedNotif || isCcNotif ? '/process-audit/all-requests' : '/process-audit/approvals'),
        });
      });
    }

    if (Array.isArray(requests)) {
      requests.forEach((r, idx) => {
        const uName = (resolvedUser?.name || '').trim().toLowerCase();
        const uId = String(resolvedUser?.id || '');
        const uEmail = (resolvedUser?.email || '').trim().toLowerCase();
        const execNames = (r.executor || '').toLowerCase().split(',').map((s) => s.trim()).filter(Boolean);
        const rCreatedBy = (r.created_by || '').trim().toLowerCase();
        const ccEmails = (r.notify_emails || '').toLowerCase().split(',').map((s) => s.trim()).filter(Boolean);
        const isExec = uName && execNames.includes(uName);
        const isCreator = (uName && rCreatedBy === uName) || (uId && String(r.created_by_id) === uId);
        const isCcUser = uEmail && ccEmails.includes(uEmail);

        if (!isAdmin && !isExec && !isCreator && !isCcUser) return;

        const reqNo = r.issue_no ? (String(r.issue_no).startsWith('#') ? r.issue_no : `#${r.issue_no}`) : `#PA-${r.id || idx + 1}`;
        if (streamList.some((s) => s.reqNo === reqNo)) return;

        const isClosed = (r.status || '').toLowerCase() === 'closed';
        const isApproved = (r.status || '').toLowerCase().includes('approved') || (r.status || '').toLowerCase().includes('review') || (r.status || '').toLowerCase().includes('progress');

        const badgeLabel = isClosed
          ? 'CASE CLOSED'
          : isApproved
          ? 'COUNTERMEASURE REQUIRED'
          : 'ACTION REQUIRED';
        const accentColor = isClosed ? 'emerald' : 'amber';
        const footerFlag = isClosed ? 'CASE_CLOSED' : 'ACTION_REQUIRED';

        const savedRead = getReadOverride('process-audit', resolvedUser, `req-${r.id || idx}`) ?? getReadOverride('process-audit', resolvedUser, reqNo);

        streamList.push({
          id: `pa-req-${r.id || idx}`,
          rawId: r.id,
          reqNo,
          badgeLabel,
          accentColor,
          department: r.department || (isClosed ? 'QUALITY VERIFIED' : 'PRODUCTION'),
          title: `Audit Request ${r.issue_no || r.id}`,
          message: `Request #${r.issue_no || r.id} (${r.model || 'Process'}) - "${r.issue_observation || r.problem || 'Audit observation'}".`,
          timeDisplay: formatStreamDate(r.created_at || r.escalation_date),
          subCategory: 'PROCESS AUDIT OBSERVATION',
          footerFlag,
          read: savedRead !== null ? savedRead : false,
          type: r.status || 'info',
          link: isClosed ? '/process-audit/all-requests' : '/process-audit/approvals',
        });
      });
    }

    return streamList;
  } catch (err) {
    console.error('Failed to load Process Audit notifications:', err);
    return [];
  }
};

/**
 * Universal feed getter based on tab name: 'ihlr' | 'process-audit'
 */
export const fetchNotificationsForTab = async (tab, user) => {
  return tab === 'ihlr'
    ? fetchIhlrNotificationsFeed(user)
    : fetchProcessAuditNotificationsFeed(user);
};

/**
 * Tab-aware mark notification as read / unread
 */
export const markNotificationReadForTab = async (tab, notifId, rawId, isRead = true, user = null, fullId = null, reqNo = null) => {
  const activeUser = user || storage.getUser();
  // Save read override in localStorage
  if (fullId) setReadOverride(tab, activeUser, fullId, isRead);
  if (notifId) setReadOverride(tab, activeUser, notifId, isRead);
  if (!notifId && rawId) setReadOverride(tab, activeUser, `req-${rawId}`, isRead);
  if (!notifId && reqNo) setReadOverride(tab, activeUser, reqNo, isRead);

  const idToMark = notifId;
  if (!idToMark) return;

  if (tab === 'ihlr') {
    return isRead
      ? ihlrService.markNotificationAsRead(idToMark).catch(() => {})
      : ihlrService.markNotificationAsUnread(idToMark).catch(() => {});
  } else {
    return isRead
      ? processAuditService.markNotificationAsRead(idToMark).catch(() => {})
      : processAuditService.markNotificationAsUnread(idToMark).catch(() => {});
  }
};

/**
 * Tab-aware mark all notifications as read
 */
export const markAllNotificationsReadForTab = async (tab, userName, user = null, allIds = []) => {
  const resolvedUser = user || storage.getUser();
  const payload =
    typeof userName === 'object' && userName !== null
      ? userName
      : {
          user: userName || resolvedUser?.name,
          user_name: userName || resolvedUser?.name,
          user_id: resolvedUser?.id,
          user_email: resolvedUser?.email,
        };

  if (Array.isArray(allIds) && allIds.length > 0) {
    allIds.forEach((id) => setReadOverride(tab, resolvedUser, id, true));
  }
  return tab === 'ihlr'
    ? ihlrService.markAllNotificationsAsRead(payload).catch(() => {})
    : processAuditService.markAllNotificationsAsRead(payload).catch(() => {});
};
