import { ihlrService } from './ihlrService';
import { processAuditService } from './processAuditService';

/**
 * Helper to safely format ISO/timestamp dates into human-readable strings.
 */
const formatStreamDate = (dateVal) => {
  if (!dateVal) return 'Recent Today';
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return String(dateVal);
    return `${d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} • ${d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })}`;
  } catch {
    return String(dateVal);
  }
};

/**
 * Loads and standardizes IHLR notifications & recent defect requests.
 */
export const fetchIhlrNotificationsFeed = async (user) => {
  try {
    const [apiNotifs, requests] = await Promise.all([
      ihlrService
        .getNotifications({
          user: user?.name,
          user_id: user?.id,
          role: user?.role,
        })
        .catch(() => []),
      ihlrService.getRequests().catch(() => []),
    ]);

    const streamList = [];

    if (Array.isArray(apiNotifs)) {
      apiNotifs.forEach((n) => {
        streamList.push({
          id: `notif-${n.id}`,
          notifId: n.id,
          rawId: n.rawId,
          reqNo: n.reqNo || (n.requestId ? `#${n.requestId}` : '#IHLR'),
          badgeLabel: n.badgeLabel || (n.type === 'submission_confirmed' ? 'REPORT LOGGED' : 'ACTION REQUIRED'),
          accentColor: n.accentColor || (n.type === 'submission_confirmed' ? 'blue' : 'amber'),
          department: n.department || 'QUALITY',
          title: n.title,
          message: n.message,
          timeDisplay: formatStreamDate(n.date),
          subCategory: 'LINE DEFECT REPORT',
          footerFlag: n.footerFlag || (n.type === 'submission_confirmed' ? 'SYSTEM_LOGS' : 'ACTION_REQUIRED'),
          read: Boolean(n.read),
          type: n.type || 'info',
          link: n.link || '/ihlr/my-requests',
        });
      });
    }

    if (Array.isArray(requests)) {
      requests.forEach((r, idx) => {
        const reqNo = String(r.req_no || '').startsWith('IHLR-') ? r.req_no : `IHLR-${r.req_no || idx + 1}`;
        const isClosed = (r.status || '').toUpperCase() === 'CLOSED';
        const isInProgress = (r.status || '').toUpperCase() === 'IN_PROGRESS';
        const dept = (r.resp || r.department || 'PRODUCTION').toUpperCase();
        const fourM = r.four_m ? `4M: ${r.four_m} • ${r.problem_detected_at || 'CELL INSPECTION'}` : '4M: METHOD • PROCESS LINE';
        const formattedDate = formatStreamDate(r.created_at || r.batch_date);

        if (!streamList.some((s) => s.reqNo === `#${reqNo}`)) {
          if (isClosed) {
            streamList.push({
              id: `req-closed-${r.id || idx}`,
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
              read: true,
              type: 'closed',
              link: '/ihlr/my-requests',
            });
          } else if (isInProgress) {
            streamList.push({
              id: `req-progress-${r.id || idx}`,
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
              read: false,
              type: 'in_progress',
              link: '/ihlr/my-requests',
            });
          } else {
            streamList.push({
              id: `req-open-${r.id || idx}`,
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
              read: false,
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
    const [apiNotifs, requests] = await Promise.all([
      processAuditService
        .getNotifications({
          user: user?.name,
          user_id: user?.id,
          role: user?.role,
        })
        .catch(() => []),
      processAuditService.getRequests().catch(() => []),
    ]);

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
          read: Boolean(n.read),
          type: n.type || 'info',
          link: n.link || (isApproval ? '/process-audit/approvals' : '/process-audit/my-requests'),
        });
      });
    }

    if (Array.isArray(requests)) {
      requests.forEach((r, idx) => {
        const reqNo = String(r.issue_no || '').startsWith('PA-') ? r.issue_no : `PA-${r.issue_no || r.id || idx + 1}`;
        const status = (r.status || '').toUpperCase();
        const isApproved = status === 'APPROVED' || status === 'CLOSED';
        const isRejected = status === 'REJECTED';
        const dept = (r.department || 'PRODUCTION').toUpperCase();
        const subCat = r.four_m ? `4M: ${r.four_m} • ${r.process_operation || 'AUDIT'}` : `PROCESS: ${r.process_operation || 'AUDIT'}`;
        const formattedDate = formatStreamDate(r.created_at);

        if (!streamList.some((s) => s.reqNo === `#${reqNo}`)) {
          if (isApproved) {
            streamList.push({
              id: `pa-req-app-${r.id || idx}`,
              rawId: r.id,
              reqNo: `#${reqNo}`,
              badgeLabel: 'AUDIT APPROVED',
              accentColor: 'emerald',
              department: dept,
              title: `Audit Observation Approved & Verified – ${reqNo}`,
              message: `Audit observation ${reqNo} (Model: ${r.model || 'OLS LONG ARM'}, Operation: "${r.process_operation || 'Assembly'}") has been verified and signed off by ${r.executor || 'Department Lead'}. Status: Approved.`,
              timeDisplay: formattedDate,
              subCategory: subCat,
              footerFlag: 'SYSTEM_LOGS',
              read: true,
              type: 'approved',
              link: '/process-audit/my-requests',
            });
          } else if (isRejected) {
            streamList.push({
              id: `pa-req-rej-${r.id || idx}`,
              rawId: r.id,
              reqNo: `#${reqNo}`,
              badgeLabel: 'CORRECTION NEEDED',
              accentColor: 'rose',
              department: dept,
              title: `Observation Returned for Clarification – ${reqNo}`,
              message: `Audit issue ${reqNo} ("${r.audit_finding || r.issue_description || 'Observation details'}") requires further containment. Returned by ${r.executor || 'Sign-off Lead'}. Reason: ${r.rejection_reason || 'Pending action'}.`,
              timeDisplay: formattedDate,
              subCategory: subCat,
              footerFlag: 'ACTION_REQUIRED',
              read: false,
              type: 'rejected',
              link: '/process-audit/my-requests',
            });
          } else {
            streamList.push({
              id: `pa-req-pen-${r.id || idx}`,
              rawId: r.id,
              reqNo: `#${reqNo}`,
              badgeLabel: 'SIGN-OFF REQUIRED',
              accentColor: 'amber',
              department: dept,
              title: `Observation Assigned for Sign-off – ${reqNo}`,
              message: `New process audit finding ${reqNo} recorded for ${r.process_operation || 'Production Line'} (Model: ${r.model || 'OLS LONG ARM'}). Assigned to ${r.executor || 'Lead'} (${dept}) for review and closure.`,
              timeDisplay: formattedDate,
              subCategory: subCat,
              footerFlag: 'ACTION_REQUIRED',
              read: false,
              type: 'pending',
              link: '/process-audit/approvals',
            });
          }
        }
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
 * Tab-aware mark notification as read
 */
export const markNotificationReadForTab = async (tab, notifId, rawId) => {
  const idToMark = notifId || rawId;
  if (!idToMark) return;
  return tab === 'ihlr'
    ? ihlrService.markNotificationAsRead(idToMark).catch(() => {})
    : processAuditService.markNotificationAsRead(idToMark).catch(() => {});
};

/**
 * Tab-aware mark all notifications as read
 */
export const markAllNotificationsReadForTab = async (tab, userName) => {
  return tab === 'ihlr'
    ? ihlrService.markAllNotificationsAsRead(userName).catch(() => {})
    : processAuditService.markAllNotificationsAsRead(userName).catch(() => {});
};
