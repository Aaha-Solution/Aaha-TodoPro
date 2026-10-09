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
 * Read state overrides cache (persists read/unread state in localStorage)
 */
export const getReadOverrides = (tab, user) => {
  try {
    const key = `notifications_read_${tab}_${user?.id || user?.name || 'global'}`;
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : {};
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
    const key = `notifications_read_${tab}_${user?.id || user?.name || 'global'}`;
    const current = getReadOverrides(tab, user);
    current[String(notifKey)] = Boolean(isRead);
    localStorage.setItem(key, JSON.stringify(current));
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
    const isAdmin = userRole === 'ADMIN' || userDept === 'INCOMING QUALITY';

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
        // Enforce user visibility safeguard: non-admins only see notifications meant for them
        if (!isAdmin) {
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

          if (!isDirectMatch) return;
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
          ['countermeasure_updated', 'countermeasure_saved'].includes(n.type) ||
          n.badgeLabel === 'COUNTERMEASURE SUBMITTED';
        const isConfirmedNotif = n.type === 'submission_confirmed';

        const notifIdStr = `notif-${n.id}`;

        // Authoritative read status from DB:
        // When server explicitly returns read / is_read, that is the single source of truth.
        // Stale localStorage overrides must NOT silence unread database notifications.
        let isItemRead = false;
        if (n.read !== undefined) {
          isItemRead = Boolean(n.read);
        } else if (n.is_read !== undefined) {
          isItemRead = Boolean(Number(n.is_read) === 1);
        } else if (overrides[notifIdStr] !== undefined) {
          isItemRead = Boolean(overrides[notifIdStr]);
        } else if (overrides[n.id] !== undefined) {
          isItemRead = Boolean(overrides[n.id]);
        }

        streamList.push({
          id: notifIdStr,
          notifId: n.id,
          rawId: n.rawId,
          reqNo: n.reqNo || (n.requestId ? `#${n.requestId}` : '#IHLR'),
          badgeLabel: isClosedNotif
            ? 'CASE CLOSED'
            : isPendingSignoff
            ? 'PENDING SIGN-OFF'
            : isUpdatedNotif
            ? 'COUNTERMEASURE SUBMITTED'
            : isConfirmedNotif
            ? 'REPORT LOGGED'
            : n.badgeLabel || 'ACTION REQUIRED',
          accentColor: isClosedNotif
            ? 'emerald'
            : isPendingSignoff
            ? 'amber'
            : isUpdatedNotif
            ? 'indigo'
            : isConfirmedNotif
            ? 'blue'
            : n.accentColor || 'amber',
          department: n.department || (isClosedNotif ? 'QUALITY VERIFIED' : isPendingSignoff ? 'QUALITY SIGN-OFF' : 'PRODUCTION'),
          title: n.title,
          message: n.message,
          timeDisplay: formatStreamDate(n.date),
          subCategory: 'LINE DEFECT REPORT',
          footerFlag: isClosedNotif
            ? 'CASE_CLOSED'
            : isPendingSignoff
            ? 'ACTION_REQUIRED'
            : isUpdatedNotif
            ? 'OPERATIONAL_UPDATE'
            : isConfirmedNotif
            ? 'SYSTEM_LOGS'
            : n.footerFlag || 'ACTION_REQUIRED',
          read: isItemRead,
          type: n.type || (isClosedNotif ? 'closed' : 'info'),
          link: n.link || '/ihlr/approvals',
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
        const isInProgress = (r.status || '').toUpperCase() === 'IN_PROGRESS';
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
              subCategory: fourM,
              footerFlag: 'SYSTEM_LOGS',
              read: isReqRead,
              type: 'closed',
              link: '/ihlr/my-requests',
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
              subCategory: fourM,
              footerFlag: 'ACTION_REQUIRED',
              read: isReqRead,
              type: 'in_progress',
              link: '/ihlr/my-requests',
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
              subCategory: fourM,
              footerFlag: 'ACTION_REQUIRED',
              read: isReqRead,
              type: 'open',
              link: '/ihlr/my-requests',
            });
          }
        }
      });
    }

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
    const activeUser = user || storage.getUser();
    const apiNotifs = await processAuditService
      .getNotifications({
        user: activeUser?.name,
        user_name: activeUser?.name,
        user_id: activeUser?.id,
        role: activeUser?.role,
        department: activeUser?.department,
      })
      .catch(() => []);

    const streamList = [];

    if (Array.isArray(apiNotifs)) {
      apiNotifs.forEach((n) => {
        const isApproval = n.type === 'approval_required' || (n.title && n.title.toLowerCase().includes('sign-off'));
        const isApproved = n.type === 'approved' || (n.title && n.title.toLowerCase().includes('approved'));
        const isRejected = n.type === 'rejected' || (n.title && n.title.toLowerCase().includes('rejected'));

        const badgeLabel = isApproval ? 'SIGN-OFF REQUIRED' : isApproved ? 'AUDIT APPROVED' : isRejected ? 'CORRECTION NEEDED' : 'AUDIT ALERT';
        const accentColor = isApproval ? 'amber' : isApproved ? 'emerald' : isRejected ? 'rose' : 'blue';
        const footerFlag = isApproval || isRejected ? 'ACTION_REQUIRED' : isApproved ? 'SYSTEM_LOGS' : 'OPERATIONAL_UPDATE';

        const rawReq = n.requestId || n.issue_no || '';
        const reqNo = rawReq ? (String(rawReq).startsWith('#') ? rawReq : `#${rawReq}`) : '#PA';

        const savedRead = getReadOverride('process-audit', activeUser, `pa-notif-${n.id}`) ?? getReadOverride('process-audit', activeUser, n.id);
        const isRead = savedRead !== null ? savedRead : Boolean(n.read || n.is_read);

        streamList.push({
          id: `pa-notif-${n.id}`,
          notifId: n.id,
          rawId: n.id,
          reqNo,
          badgeLabel,
          accentColor,
          department: n.department || 'QUALITY AUDIT',
          title: n.title,
          message: n.message,
          timeDisplay: formatStreamDate(n.date || n.time),
          subCategory: 'PROCESS AUDIT OBSERVATION',
          footerFlag,
          read: isRead,
          type: n.type || 'info',
          link: n.link || (isApproval ? '/process-audit/approvals' : '/process-audit/my-requests'),
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
export const markNotificationReadForTab = async (tab, notifId, rawId, isRead = true, user = null, fullId = null) => {
  // Save read override in localStorage
  if (fullId) setReadOverride(tab, user, fullId, isRead);
  if (notifId) setReadOverride(tab, user, notifId, isRead);
  if (rawId) setReadOverride(tab, user, `req-${rawId}`, isRead);

  const idToMark = notifId;
  if (!idToMark) return;

  if (tab === 'ihlr') {
    return isRead
      ? ihlrService.markNotificationAsRead(idToMark).catch(() => {})
      : ihlrService.markNotificationAsUnread(idToMark).catch(() => {});
  } else {
    return processAuditService.markNotificationAsRead(idToMark).catch(() => {});
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
    : processAuditService.markAllNotificationsAsRead(userName || resolvedUser?.name).catch(() => {});
};
