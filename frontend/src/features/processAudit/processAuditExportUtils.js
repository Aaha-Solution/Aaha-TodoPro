import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { parseAttachments, resolveAttachmentUrl, fetchAttachmentImageBase64 } from '../../components/common/attachmentUtils';
import { formatDateDDMMYYYY } from '../../utils/dateUtils';
import nipponLogo from '../../assets/Nippon Logo.png';

/**
 * Checks if a given attachment file is an image
 */
export const isImageAttachment = (att) => {
  if (!att) return false;
  if (att.isImage) return true;
  const n = att.name || att.filename || (typeof att === 'string' ? att : '');
  const ext = (n.split('.').pop() || '').toLowerCase();
  return ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg', 'jfif'].includes(ext);
};

/**
 * Helper to convert company logo to Base64 for jsPDF / Excel embedding
 */
export const loadLogoBase64 = async () => {
  const tryFetch = async (url) => {
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const blob = await res.blob();
      return await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  };

  const tryCanvas = (url) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || img.width;
          canvas.height = img.naturalHeight || img.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/png'));
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = url;
    });
  };

  const sources = [nipponLogo, '/images/logo.png', '/assets/Nippon Logo.png'];
  for (const src of sources) {
    if (!src) continue;
    let b64 = await tryFetch(src);
    if (!b64) b64 = await tryCanvas(src);
    if (b64) return b64;
  }
  return null;
};

/**
 * Converts a 1-based column number into an Excel column letter (e.g., 1 -> 'A', 26 -> 'Z', 27 -> 'AA')
 */
export const getExcelColLetter = (colIndex) => {
  let temp;
  let letter = '';
  let c = colIndex;
  while (c > 0) {
    temp = (c - 1) % 26;
    letter = String.fromCharCode(65 + temp) + letter;
    c = Math.floor((c - temp - 1) / 26);
  }
  return letter;
};

/**
 * Formats reassignment history into structured Yes/No status and readable multiline string
 */
export const formatReassignmentHistory = (history) => {
  let reassignList = history;
  if (typeof reassignList === 'string') {
    try {
      reassignList = JSON.parse(reassignList);
    } catch {
      reassignList = [];
    }
  }
  const hasReassignments = Array.isArray(reassignList) && reassignList.length > 0;
  const reassignedStatus = hasReassignments ? 'Yes' : 'No';

  let reassignmentDetails = '—';
  if (hasReassignments) {
    if (reassignList.length === 1) {
      const entry = reassignList[0];
      const prevPerson = entry.prev_resp_person || entry.previous_executor || '';
      const prevDept = entry.prev_resp || entry.previous_department || '';
      const nextPerson = entry.new_resp_person || entry.new_executor || '';
      const nextDept = entry.new_resp || entry.new_department || '';
      const prev = [prevPerson, prevDept ? `(${prevDept})` : ''].filter(Boolean).join(' ');
      const next = [nextPerson, nextDept ? `(${nextDept})` : ''].filter(Boolean).join(' ');
      const dateStr = entry.reassigned_at ? formatDateDDMMYYYY(entry.reassigned_at) : '';
      const by = entry.reassigned_by ? `by ${entry.reassigned_by}` : '';
      const on = dateStr ? `on ${dateStr}` : '';
      const meta = [by, on].filter(Boolean).join(' ');
      const remarksText = entry.remarks || entry.reason || '';
      reassignmentDetails = `From: ${prev || '—'} → To: ${next || '—'}${meta ? ` (${meta})` : ''}${remarksText ? ` | Remarks: ${remarksText}` : ''}`;
    } else {
      reassignmentDetails = reassignList.map((entry, i) => {
        const prevPerson = entry.prev_resp_person || entry.previous_executor || '';
        const prevDept = entry.prev_resp || entry.previous_department || '';
        const nextPerson = entry.new_resp_person || entry.new_executor || '';
        const nextDept = entry.new_resp || entry.new_department || '';
        const prev = [prevPerson, prevDept ? `(${prevDept})` : ''].filter(Boolean).join(' ');
        const next = [nextPerson, nextDept ? `(${nextDept})` : ''].filter(Boolean).join(' ');
        const dateStr = entry.reassigned_at ? formatDateDDMMYYYY(entry.reassigned_at) : '';
        const by = entry.reassigned_by ? `by ${entry.reassigned_by}` : '';
        const on = dateStr ? `on ${dateStr}` : '';
        const meta = [by, on].filter(Boolean).join(' ');
        const remarksText = entry.remarks || entry.reason || '';
        return `${i + 1}. From: ${prev || '—'} → To: ${next || '—'}${meta ? ` (${meta})` : ''}${remarksText ? ` | Remarks: ${remarksText}` : ''}`;
      }).join('\n');
    }
  }

  return {
    reassignedStatus,
    reassignmentDetails,
    hasReassignments,
    count: hasReassignments ? reassignList.length : 0,
    list: hasReassignments ? reassignList : []
  };
};

/**
 * Returns user-facing status label matching the UI: Closed, Awaiting Review, Pending
 */
export const getProcessAuditDisplayStatus = (statusOrReq, maybeReq) => {
  const r = (typeof statusOrReq === 'object' && statusOrReq !== null) ? statusOrReq : (typeof maybeReq === 'object' && maybeReq !== null ? maybeReq : null);
  const rawStatus = (typeof statusOrReq === 'string' ? statusOrReq : r?.status) || '';
  const sLower = String(rawStatus || 'Pending').toLowerCase().trim();
  if (sLower.includes('close')) return 'Closed';
  if (sLower.includes('reject')) return 'Rejected';
  if (sLower.includes('review') || sLower.includes('approval') || sLower.includes('progress') || sLower.includes('signed')) return 'Awaiting Review';

  const isCloserCompleted = Boolean(r) && Boolean(
    (r.temporary_action && String(r.temporary_action).trim()) ||
    (r.permanent_fix && String(r.permanent_fix).trim()) ||
    (r.corrective_action && String(r.corrective_action).trim()) ||
    (r.action && String(r.action).trim()) ||
    (r.root_cause && String(r.root_cause).trim()) ||
    (r.prod_why_why && (Array.isArray(r.prod_why_why) ? r.prod_why_why.some((w) => w && w.trim()) : Boolean(r.prod_why_why))) ||
    (r.standardization_details && String(r.standardization_details).trim()) ||
    Boolean(r.temporary_target_date || r.permanent_target_date || r.target_date) ||
    Boolean(r.action_taken_by) ||
    (r.temporary_evidence_attachment && parseAttachments(r.temporary_evidence_attachment).length > 0) ||
    (r.permanent_evidence_attachment && parseAttachments(r.permanent_evidence_attachment).length > 0) ||
    (r.action_attachments && parseAttachments(r.action_attachments).length > 0)
  );

  if (isCloserCompleted) return 'Awaiting Review';
  return 'Pending';
};

export const parseWhyList = (val) => {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      return [val];
    }
  }
  return [];
};

/**
 * Safely resolves the Auditor Email with comprehensive fallback logic
 */
export const resolveAuditorEmail = (r) => {
  if (!r) return '—';

  // 1. Explicit email field directly on request
  const directEmail = r.created_by_email || r.creator_email || r.auditor_email || r.email || r.user_email;
  if (directEmail && typeof directEmail === 'string' && directEmail.trim() && directEmail.includes('@')) {
    return directEmail.trim();
  }

  // 2. Nested user email
  if (r.user && typeof r.user === 'object' && r.user.email && typeof r.user.email === 'string' && r.user.email.includes('@')) {
    return r.user.email.trim();
  }

  // 3. If created_by itself is an email
  if (r.created_by && typeof r.created_by === 'string' && r.created_by.includes('@')) {
    return r.created_by.trim();
  }

  // 4. Try matching with logged-in user in session/local storage
  try {
    const rawUser = sessionStorage.getItem('todo_user') || localStorage.getItem('todo_user');
    if (rawUser) {
      const parsed = JSON.parse(rawUser);
      if (parsed?.email && parsed.email.includes('@')) {
        const creatorName = (r.created_by || '').trim().toLowerCase();
        const userName = (parsed.name || '').trim().toLowerCase();
        if (
          !creatorName ||
          creatorName === 'quality auditor' ||
          (userName && creatorName === userName) ||
          (r.created_by_id && parsed.id && String(r.created_by_id) === String(parsed.id))
        ) {
          return parsed.email.trim();
        }
      }
    }
  } catch {
    // ignore
  }

  return '—';
};

/**
 * Universal helper to collect and fetch base64 data for all defect and evidence images in Process Audit
 */
export const getProcessAuditExportImages = async (targetReq) => {
  const isImg = (att) => {
    if (!att) return false;
    if (att.isImage) return true;
    const n = att.name || att.filename || (typeof att === 'string' ? att : '');
    const ext = (n.split('.').pop() || '').toUpperCase();
    return ['PNG', 'JPG', 'JPEG', 'WEBP', 'GIF', 'BMP', 'SVG', 'JFIF'].includes(ext);
  };

  const reqData = targetReq || {};
  const dFiles = parseAttachments(reqData.attachments);
  const tFiles = parseAttachments(reqData.temporary_evidence_attachment || reqData.action_attachments);
  const pFiles = parseAttachments(reqData.permanent_evidence_attachment);

  const items = [
    ...dFiles.filter(isImg).map((a) => ({ ...a, label: 'Audit Defect Evidence Image' })),
    ...tFiles.filter(isImg).map((a) => ({ ...a, label: 'Temporary Action Evidence Image' })),
    ...pFiles.filter(isImg).map((a) => ({ ...a, label: 'Permanent Action Evidence Image' }))
  ];

  const results = await Promise.all(
    items.map(async (item) => {
      try {
        const data = await fetchAttachmentImageBase64(item, 'process-audit');
        if (!data) return null;
        return { ...data, label: item.label };
      } catch (err) {
        console.warn('Could not load Process Audit attachment image for export:', err);
        return null;
      }
    })
  );
  return results.filter(Boolean);
};

/**
 * Common Excel Export function for Process Audit (Approvals, AllRequests, Dashboard, Details Modal)
 * Generates official dynamic-column workbook matching IHLR with Super Headings, embedded images for all evidence attachments, and reassignment history.
 */
export const exportProcessAuditToExcel = async ({
  requests,
  fileName,
  sheetName = 'Process Audit Log'
}) => {
  const reqList = Array.isArray(requests) ? requests : [requests].filter(Boolean);
  if (reqList.length === 0) {
    throw new Error('No data available to export.');
  }

  // Parse defect/observation files, temporary evidence files, and permanent evidence files
  const reqParsedDefectFiles = reqList.map((r) => parseAttachments(r.attachments));
  const reqParsedTempFiles = reqList.map((r) => parseAttachments(r.temporary_evidence_attachment || r.action_attachments));
  const reqParsedPermFiles = reqList.map((r) => parseAttachments(r.permanent_evidence_attachment));

  // Determine maximum counts for each evidence category across all exported requests
  const maxDefectCount = Math.max(1, ...reqParsedDefectFiles.map((files) => files.length));
  const maxTempCount = Math.max(1, ...reqParsedTempFiles.map((files) => files.length));
  const maxPermCount = Math.max(1, ...reqParsedPermFiles.map((files) => files.length));

  // Helper to load file metadata and image base64
  const loadFilesData = async (files) => {
    return await Promise.all(
      files.map(async (file) => {
        const isImg = isImageAttachment(file);
        if (isImg) {
          const imgData = await fetchAttachmentImageBase64(file, 'process-audit');
          if (imgData && imgData.base64) {
            return {
              isImage: true,
              imgData,
              name: file.name || file.filename || 'Evidence Image',
              file
            };
          }
        }
        return {
          isImage: false,
          imgData: null,
          name: file.name || file.filename || (typeof file === 'string' ? file : 'Attachment'),
          file
        };
      })
    );
  };

  // Preload evidence data & image thumbnails for ALL attachments across all rows (Defect, Temporary, Permanent)
  const [rowDefectData, rowTempData, rowPermData] = await Promise.all([
    Promise.all(reqParsedDefectFiles.map(loadFilesData)),
    Promise.all(reqParsedTempFiles.map(loadFilesData)),
    Promise.all(reqParsedPermFiles.map(loadFilesData))
  ]);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'India Nippon Electricals Limited';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet(sheetName, {
    views: [{ showGridLines: true }]
  });

  // Dynamic headers for observation evidence (AUDIT EVIDENCE 1, AUDIT EVIDENCE 2, ...)
  const defectEvidenceHeaders = Array.from(
    { length: maxDefectCount },
    (_, i) => (maxDefectCount > 1 ? `AUDIT EVIDENCE ${i + 1}` : 'AUDIT EVIDENCE 1')
  );

  // Dynamic headers for closer temporary evidence (TEMPORARY EVIDENCE 1, TEMPORARY EVIDENCE 2, ...)
  const tempEvidenceHeaders = Array.from(
    { length: maxTempCount },
    (_, i) => (maxTempCount > 1 ? `TEMPORARY EVIDENCE ${i + 1}` : 'TEMPORARY EVIDENCE 1')
  );

  // Dynamic headers for closer permanent evidence (PERMANENT EVIDENCE 1, PERMANENT EVIDENCE 2, ...)
  const permEvidenceHeaders = Array.from(
    { length: maxPermCount },
    (_, i) => (maxPermCount > 1 ? `PERMANENT EVIDENCE ${i + 1}` : 'PERMANENT EVIDENCE 1')
  );

  // Calculate dynamic section column boundaries:
  // 1. Requestor: 15 fixed columns + maxDefectCount dynamic evidence columns + 1 fixed column (LOGGED AT)
  const requestorEndCol = 16 + maxDefectCount;

  // 2. Closer: 9 fixed columns (WHY 1..5, OVERALL ROOT CAUSE, TEMP ACTION, TEMP TARGET DATE, TEMP CLOSED BY)
  //            + maxTempCount (TEMPORARY EVIDENCE 1..N)
  //            + 3 fixed columns (PERMANENT ACTION, PERMANENT TARGET DATE, PERM CLOSED BY)
  //            + maxPermCount (PERMANENT EVIDENCE 1..N)
  const closerStartCol = requestorEndCol + 1;
  const closerColCount = 12 + maxTempCount + maxPermCount;
  const closerEndCol = closerStartCol + closerColCount - 1;

  // 3. Reassignment Tracking: 2 columns (REASSIGNED STATUS, REASSIGNMENT DETAILS)
  const reassignStartCol = closerEndCol + 1;
  const reassignEndCol = reassignStartCol + 2 - 1;

  // 4. Auditor Review & Closure Sign-off: 4 columns (AUDITOR REVIEW REMARKS, REVIEWED / CLOSED BY, STATUS, CLOSED AT)
  const statusStartCol = reassignEndCol + 1;
  const statusEndCol = statusStartCol + 4 - 1;

  // Dynamic column widths configuration matching IHLR exactly
  const colWidths = [
    // 1-15: REQUESTOR (Audit Observation & Parameters)
    8,  // 1: SL NO
    14, // 2: AUDIT REQ NO
    14, // 3: ESCALATION DATE
    12, // 4: SHIFT
    16, // 5: PRODUCT
    18, // 6: MODEL
    20, // 7: PROCESS / OPERATION
    14, // 8: ISSUE TYPE
    12, // 9: PRIORITY
    18, // 10: ASSIGNED DEPT
    20, // 11: ASSIGNED EXECUTOR
    18, // 12: LOGGED BY AUDITOR
    22, // 13: AUDITOR EMAIL
    32, // 14: AUDIT OBSERVATION
    24, // 15: ADDITIONAL COMMENTS
    // Dynamic Observation Evidence columns
    ...Array(maxDefectCount).fill(22),
    // Fixed Trailing Requestor column
    16, // LOGGED AT
    // Closer before Temp Evidence
    20, // WHY 1
    20, // WHY 2
    20, // WHY 3
    20, // WHY 4
    20, // WHY 5
    24, // OVERALL ROOT CAUSE
    30, // TEMPORARY ACTION
    16, // TEMPORARY TARGET DATE
    20, // TEMPORARY CLOSED BY
    // Dynamic Temporary Evidence columns
    ...Array(maxTempCount).fill(22),
    // Closer between Temp and Perm Evidence
    32, // PERMANENT ACTION
    16, // PERMANENT TARGET DATE
    20, // PERMANENT CLOSED BY
    // Dynamic Permanent Evidence columns
    ...Array(maxPermCount).fill(22),
    // Reassignment Tracking
    16, // REASSIGNED STATUS
    38, // REASSIGNMENT DETAILS
    // Auditor Review & Closure Sign-Off
    24, // AUDITOR REVIEW REMARKS
    18, // REVIEWED / CLOSED BY
    20, // STATUS
    16  // CLOSED AT
  ];

  colWidths.forEach((w, i) => {
    worksheet.getColumn(i + 1).width = w;
  });

  // ==============================================================
  // ROW 1: SUPER HEADINGS (Phase Header Row matching IHLR design)
  // ==============================================================
  worksheet.mergeCells(`A1:${getExcelColLetter(requestorEndCol)}1`);
  const superReq = worksheet.getCell('A1');
  superReq.value = 'REQUESTOR (AUDIT OBSERVATION & PARAMETERS)';
  superReq.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FF78350F' } }; // amber-900
  superReq.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } }; // amber-100
  superReq.alignment = { vertical: 'middle', horizontal: 'center' };

  worksheet.mergeCells(`${getExcelColLetter(closerStartCol)}1:${getExcelColLetter(closerEndCol)}1`);
  const superCloser = worksheet.getCell(`${getExcelColLetter(closerStartCol)}1`);
  superCloser.value = 'CLOSER (ROOT CAUSE & ACTIONS)';
  superCloser.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FF7C2D12' } }; // orange-900
  superCloser.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEDD5' } }; // orange-100
  superCloser.alignment = { vertical: 'middle', horizontal: 'center' };

  worksheet.mergeCells(`${getExcelColLetter(reassignStartCol)}1:${getExcelColLetter(reassignEndCol)}1`);
  const superReassign = worksheet.getCell(`${getExcelColLetter(reassignStartCol)}1`);
  superReassign.value = 'REASSIGNMENT TRACKING';
  superReassign.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FF4C1D95' } }; // violet-900
  superReassign.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDE9FE' } }; // violet-100
  superReassign.alignment = { vertical: 'middle', horizontal: 'center' };

  worksheet.mergeCells(`${getExcelColLetter(statusStartCol)}1:${getExcelColLetter(statusEndCol)}1`);
  const superStatus = worksheet.getCell(`${getExcelColLetter(statusStartCol)}1`);
  superStatus.value = 'AUDITOR REVIEW & CLOSURE SIGN-OFF';
  superStatus.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FF1E293B' } }; // slate-800
  superStatus.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } }; // slate-100
  superStatus.alignment = { vertical: 'middle', horizontal: 'center' };

  const superRow = worksheet.getRow(1);
  superRow.height = 30;
  superRow.eachCell({ includeEmpty: true }, (c) => {
    c.border = {
      top: { style: 'medium', color: { argb: 'FFCBD5E1' } },
      bottom: { style: 'medium', color: { argb: 'FFCBD5E1' } },
      left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
    };
  });

  // ==============================================================
  // ROW 2: SUB-COLUMN HEADERS (Grouped strictly by Super Headings)
  // ==============================================================
  const subHeaders = [
    // 1-15 Requestor (Strictly in CreateRequest form order!)
    'SL NO', 'AUDIT REQ NO', 'ESCALATION DATE', 'SHIFT', 'PRODUCT',
    'MODEL', 'PROCESS / OPERATION', 'ISSUE TYPE', 'PRIORITY',
    'ASSIGNED DEPT', 'ASSIGNED EXECUTOR', 'LOGGED BY AUDITOR', 'AUDITOR EMAIL',
    'AUDIT OBSERVATION', 'ADDITIONAL COMMENTS',
    // Dynamic Defect Evidence columns (AUDIT EVIDENCE 1, AUDIT EVIDENCE 2, ...)
    ...defectEvidenceHeaders,
    'LOGGED AT',
    // Closer before Temp Evidence
    'WHY 1', 'WHY 2', 'WHY 3', 'WHY 4', 'WHY 5',
    'OVERALL ROOT CAUSE',
    'TEMPORARY ACTION', 'TEMPORARY TARGET DATE', 'TEMPORARY CLOSED BY',
    // Dynamic Temporary Evidence columns (TEMPORARY EVIDENCE 1, TEMPORARY EVIDENCE 2, ...)
    ...tempEvidenceHeaders,
    // Closer between Temp and Perm Evidence
    'PERMANENT ACTION', 'PERMANENT TARGET DATE', 'PERMANENT CLOSED BY',
    // Dynamic Permanent Evidence columns (PERMANENT EVIDENCE 1, PERMANENT EVIDENCE 2, ...)
    ...permEvidenceHeaders,
    // 2 Reassignment Tracking columns
    'REASSIGNED STATUS', 'REASSIGNMENT DETAILS',
    // 4 Remarks, Review & Status columns
    'AUDITOR REVIEW REMARKS', 'REVIEWED / CLOSED BY', 'STATUS', 'CLOSED AT'
  ];

  const headerRow2 = worksheet.addRow(subHeaders);
  headerRow2.height = 28;

  headerRow2.eachCell((cell, colNum) => {
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      bottom: { style: 'medium', color: { argb: 'FF94A3B8' } },
      left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
    };

    if (colNum <= requestorEndCol) {
      cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF78350F' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDE68A' } }; // amber-200
    } else if (colNum <= closerEndCol) {
      cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF7C2D12' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFED7AA' } }; // orange-200
    } else if (colNum <= reassignEndCol) {
      cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF4C1D95' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDDD6FE' } }; // violet-200
    } else {
      cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF1E293B' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } }; // slate-200
    }
  });

  // ==============================================================
  // DATA ROWS (Starts at Row 3)
  // ==============================================================
  const regularFont = { name: 'Arial', size: 9.5, color: { argb: 'FF1E293B' } };
  const thinBorder = {
    top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
  };

  // Calculate 1-indexed column locations
  const defectColStart = 16;
  const createdAtCol = 16 + maxDefectCount;

  const whysStartCol = createdAtCol + 1;
  const overallRootCauseCol = whysStartCol + 5;
  const tempActionCol = overallRootCauseCol + 1;
  const tempTargetDateCol = tempActionCol + 1;
  const tempClosedByCol = tempTargetDateCol + 1;
  const tempColStart = tempClosedByCol + 1;

  const permActionCol = tempColStart + maxTempCount;
  const permTargetDateCol = permActionCol + 1;
  const permClosedByCol = permTargetDateCol + 1;
  const permColStart = permClosedByCol + 1;

  const reassignStatusCol = permColStart + maxPermCount;
  const reassignDetailsCol = reassignStatusCol + 1;

  const remarksCol = reassignDetailsCol + 1;
  const reviewedByCol = remarksCol + 1;
  const statusCol = reviewedByCol + 1;
  const closedAtCol = statusCol + 1;

  reqList.forEach((r, idx) => {
    const defectList = rowDefectData[idx] || [];
    const tempList = rowTempData[idx] || [];
    const permList = rowPermData[idx] || [];
    const rowNum = idx + 3;

    const { reassignedStatus, reassignmentDetails, hasReassignments, count } = formatReassignmentHistory(r.reassignment_history);

    // Build values for dynamic evidence columns
    const buildEvidenceValues = (fileList, maxCount) => {
      const values = [];
      for (let e = 0; e < maxCount; e++) {
        const fileItem = fileList[e];
        if (!fileItem) {
          values.push('—');
        } else if (fileItem.isImage && fileItem.imgData?.base64) {
          values.push('');
        } else {
          values.push(fileItem.name || 'Attachment');
        }
      }
      return values;
    };

    const defectValues = buildEvidenceValues(defectList, maxDefectCount);
    const tempValues = buildEvidenceValues(tempList, maxTempCount);
    const permValues = buildEvidenceValues(permList, maxPermCount);

    const whyArray = parseWhyList(r.prod_why_why || r.why_why);
    const reqNo = r.issue_no || (r.id ? `PA-${r.id}` : `#${idx + 1}`);
    const escDate = r.escalation_date ? formatDateDDMMYYYY(r.escalation_date) : (r.created_at ? formatDateDDMMYYYY(r.created_at) : '—');
    const displayStatus = getProcessAuditDisplayStatus(r);
    const closedAt = r.closed_at ? formatDateDDMMYYYY(r.closed_at) : '—';

    const tempTargetDate = (r.temporary_target_date ? formatDateDDMMYYYY(r.temporary_target_date) : '') ||
      (r.target_date ? formatDateDDMMYYYY(r.target_date) : '—');
    const permTargetDate = r.permanent_target_date ? formatDateDDMMYYYY(r.permanent_target_date) : '—';
    const tempClosedBy = r.temporary_closed_by || r.closer_updated_by || r.action_taken_by || '—';
    const permClosedBy = r.permanent_closed_by || r.closer_updated_by || r.closed_by || '—';

    const rowData = [
      // 1-15 Requestor (Strictly in form order!)
      idx + 1,
      reqNo,
      escDate,
      r.shift || '—',
      r.product || '—',
      r.model || r.stage || '—',
      r.process_operation || r.line || '—',
      r.issue_type || '—',
      r.priority || '—',
      r.department || '—',
      r.executor || '—',
      r.created_by || 'Quality Auditor',
      resolveAuditorEmail(r),
      r.issue_observation || r.problem || '—',
      r.comments || '—',

      // Dynamic Defect Evidence values
      ...defectValues,

      // Trailing Requestor column
      r.created_at ? formatDateDDMMYYYY(r.created_at) : '—',

      // Closer before Temp Evidence
      whyArray[0] || '—',
      whyArray[1] || '—',
      whyArray[2] || '—',
      whyArray[3] || '—',
      whyArray[4] || '—',
      r.root_cause || '—',
      r.temporary_action || r.action || '—',
      tempTargetDate,
      tempClosedBy,

      // Dynamic Temporary Evidence values
      ...tempValues,

      // Closer between Temp and Perm Evidence
      r.permanent_fix || r.corrective_action || '—',
      permTargetDate,
      permClosedBy,

      // Dynamic Permanent Evidence values
      ...permValues,

      // Reassignment Tracking
      reassignedStatus,
      reassignmentDetails,

      // Auditor Review & Closure Sign-off
      r.creator_remark || r.remarks || '—',
      r.reviewed_by || r.approved_by || r.closed_by || '—',
      displayStatus,
      closedAt
    ];

    const row = worksheet.addRow(rowData);

    const hasAnyImage = [
      ...defectList,
      ...tempList,
      ...permList
    ].some((f) => f.isImage && f.imgData?.base64);

    row.height = hasAnyImage ? 56 : (hasReassignments && count > 1 ? Math.max(36, count * 18) : 24);

    row.eachCell((cell) => {
      cell.font = regularFont;
      cell.border = thinBorder;
      cell.alignment = { vertical: 'middle', wrapText: true };
    });

    // Center align specific columns
    row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' }; // SL NO
    row.getCell(2).alignment = { vertical: 'middle', horizontal: 'center' }; // AUDIT REQ NO
    row.getCell(3).alignment = { vertical: 'middle', horizontal: 'center' }; // ESCALATION DATE
    row.getCell(4).alignment = { vertical: 'middle', horizontal: 'center' }; // SHIFT
    row.getCell(8).alignment = { vertical: 'middle', horizontal: 'center' }; // ISSUE TYPE
    row.getCell(9).alignment = { vertical: 'middle', horizontal: 'center' }; // PRIORITY
    row.getCell(createdAtCol).alignment = { vertical: 'middle', horizontal: 'center' }; // LOGGED AT
    row.getCell(tempTargetDateCol).alignment = { vertical: 'middle', horizontal: 'center' }; // TEMP TARGET DATE
    row.getCell(tempClosedByCol).alignment = { vertical: 'middle', horizontal: 'center' }; // TEMP CLOSED BY
    row.getCell(permTargetDateCol).alignment = { vertical: 'middle', horizontal: 'center' }; // PERM TARGET DATE
    row.getCell(permClosedByCol).alignment = { vertical: 'middle', horizontal: 'center' }; // PERM CLOSED BY
    row.getCell(reassignStatusCol).alignment = { vertical: 'middle', horizontal: 'center' }; // REASSIGNED STATUS
    row.getCell(reviewedByCol).alignment = { vertical: 'middle', horizontal: 'center' }; // REVIEWED BY
    row.getCell(statusCol).alignment = { vertical: 'middle', horizontal: 'center' }; // STATUS
    row.getCell(closedAtCol).alignment = { vertical: 'middle', horizontal: 'center' }; // CLOSED AT

    // Alternate row background fill
    if (idx % 2 === 1) {
      row.eachCell((c) => {
        if (!c.fill) {
          c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
        }
      });
    }

    // Configure Hyperlinks for non-image files or fallback
    const configureEvidenceCells = (startCol, maxCount, fileList) => {
      for (let e = 0; e < maxCount; e++) {
        const fileItem = fileList[e];
        const cellCol = startCol + e;
        const evCell = row.getCell(cellCol);
        evCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };

        if (!fileItem) {
          evCell.value = '—';
          evCell.font = { name: 'Arial', size: 9, color: { argb: 'FF94A3B8' } };
        } else if (fileItem.isImage && fileItem.imgData?.base64) {
          evCell.value = '';
        } else {
          const fileUrl = resolveAttachmentUrl(fileItem.file || fileItem, 'process-audit');
          if (fileUrl) {
            evCell.value = {
              text: fileItem.name,
              hyperlink: fileUrl,
              tooltip: `Click to download ${fileItem.name}`
            };
            evCell.font = { name: 'Arial', size: 9, color: { argb: 'FF2563EB' }, underline: true };
          }
        }
      }
    };

    configureEvidenceCells(defectColStart, maxDefectCount, defectList);
    configureEvidenceCells(tempColStart, maxTempCount, tempList);
    configureEvidenceCells(permColStart, maxPermCount, permList);

    // Apply UI-matched status styling in Excel
    const statusCell = row.getCell(statusCol);
    if (displayStatus === 'Closed') {
      statusCell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF15803D' } }; // emerald-700
      statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } }; // emerald-100
    } else if (displayStatus === 'Awaiting Review' || displayStatus === 'Signed off') {
      statusCell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFB45309' } }; // amber-700
      statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } }; // amber-100
    } else {
      statusCell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFE11D48' } }; // rose-600
      statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE4E6' } }; // rose-100
    }

    // Embed image thumbnails into cells for each evidence group
    const embedEvidenceImages = (colStart, fileList) => {
      fileList.forEach((fileItem, fileIdx) => {
        if (fileItem.isImage && fileItem.imgData?.base64) {
          try {
            const imgId = workbook.addImage({
              base64: fileItem.imgData.base64,
              extension: fileItem.imgData.extension === 'png' ? 'png' : 'jpeg'
            });
            const colZeroIndexed = (colStart - 1) + fileIdx;
            worksheet.addImage(imgId, {
              tl: { col: colZeroIndexed + 0.12, row: rowNum - 0.88 },
              ext: { width: 85, height: 48 },
              editAs: 'oneCell'
            });
          } catch (e) {
            console.warn(`Could not add image at col ${colStart + fileIdx} to Excel:`, e);
          }
        }
      });
    };

    embedEvidenceImages(defectColStart, defectList);
    embedEvidenceImages(tempColStart, tempList);
    embedEvidenceImages(permColStart, permList);
  });

  const today = new Date().toISOString().slice(0, 10);
  const targetFileName = fileName || `Process_Audit_Analysis_Report_${today}.xlsx`;
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = targetFileName.endsWith('.xlsx') ? targetFileName : `${targetFileName}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(downloadUrl);
};

/**
 * Common PDF Export function for Process Audit (Approvals, AllRequests, Dashboard, Details Modal)
 * Generates official landscape document with company logo, table formatting, and page numbers matching IHLR.
 */
export const exportProcessAuditToPdf = async ({
  requests,
  fileName,
  title = 'Process Audit Observation & Verification Log',
  filterText = ''
}) => {
  const reqList = Array.isArray(requests) ? requests : [requests].filter(Boolean);
  if (reqList.length === 0) {
    throw new Error('No data available to export.');
  }

  const logoData = await loadLogoBase64();

  // If exporting a SINGLE report, generate a comprehensive vertical Inspection Report
  if (reqList.length === 1) {
    const r = reqList[0];
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'pt',
      format: 'a4'
    });

    const reqNo = r.issue_no || (r.id ? `PA-${r.id}` : '#1');
    const escDate = r.escalation_date ? formatDateDDMMYYYY(r.escalation_date) : (r.created_at ? formatDateDDMMYYYY(r.created_at) : '—');
    const displayStatus = getProcessAuditDisplayStatus(r);
    const isClosedStatus = displayStatus === 'Closed' || (String(r.status || '').toLowerCase().includes('close'));

    // Parse all attachment categories
    const creatorAttachments = parseAttachments(r.attachments);
    const temporaryEvidenceAttachments = parseAttachments(r.temporary_evidence_attachment || r.action_attachments);
    const permanentEvidenceAttachments = parseAttachments(r.permanent_evidence_attachment);

    const creatorAttStr = creatorAttachments.length > 0 ? creatorAttachments.map(a => a.name || a.filename).filter(Boolean).join(', ') : 'None';
    const tempEvidenceAttStr = temporaryEvidenceAttachments.length > 0 ? temporaryEvidenceAttachments.map(a => a.name || a.filename).filter(Boolean).join(', ') : 'None';
    const permEvidenceAttStr = permanentEvidenceAttachments.length > 0 ? permanentEvidenceAttachments.map(a => a.name || a.filename).filter(Boolean).join(', ') : 'None';

    const { hasReassignments, reassignmentDetails } = formatReassignmentHistory(r.reassignment_history);

    // Fetch embedded evidence images
    const exportImages = await getProcessAuditExportImages(r);

    // Header Banner
    doc.setFillColor(30, 41, 59); // slate-800
    doc.rect(40, 30, 515, 48, 'F');

    let bannerTextX = 55;
    if (logoData) {
      try {
        doc.addImage(logoData, 'PNG', 48, 36, 36, 36);
        bannerTextX = 92;
      } catch (imgErr) {
        console.warn('Could not add logo to PDF:', imgErr);
      }
    }

    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('INDIA NIPPON ELECTRICALS LIMITED', bannerTextX, 52);

    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(191, 219, 254);
    doc.text(`Process Audit Deviation Action Report   |  ${reqNo}`, bannerTextX, 66);

    // Section 1: 1. AUDIT INCIDENT & PARAMETERS (Structured 4-Column Key-Value Grid)
    autoTable(doc, {
      startY: 86,
      theme: 'grid',
      margin: { left: 40, right: 40 },
      tableWidth: 515,
      columnStyles: {
        0: { cellWidth: 105 },
        1: { cellWidth: 152.5 },
        2: { cellWidth: 105 },
        3: { cellWidth: 152.5 }
      },
      styles: { fontSize: 8, cellPadding: 3.5, valign: 'middle' },
      head: [
        [
          {
            content: '1. AUDIT INCIDENT & PARAMETERS',
            colSpan: 4,
            styles: {
              fillColor: [30, 41, 59], // slate-800
              textColor: [255, 255, 255],
              fontStyle: 'bold',
              fontSize: 8.5
            }
          }
        ]
      ],
      body: [
        [
          { content: 'ISSUE NO', styles: { fontStyle: 'bold', textColor: [71, 85, 105], fillColor: [248, 250, 252] } },
          { content: reqNo, styles: { fontStyle: 'bold', textColor: [37, 99, 235] } },
          { content: 'Current Status:', styles: { fontStyle: 'bold', textColor: [71, 85, 105], fillColor: [248, 250, 252] } },
          {
            content: displayStatus.toUpperCase(),
            styles: {
              fontStyle: 'bold',
              textColor: isClosedStatus
                ? [22, 101, 52]
                : (displayStatus === 'Awaiting Review' || displayStatus === 'Signed off')
                  ? [180, 83, 9]
                  : [225, 29, 72]
            }
          }
        ],
        [
          { content: 'Escalation Date:', styles: { fontStyle: 'bold', textColor: [71, 85, 105], fillColor: [248, 250, 252] } },
          escDate,
          { content: 'Work Shift:', styles: { fontStyle: 'bold', textColor: [71, 85, 105], fillColor: [248, 250, 252] } },
          r.shift || 'Shift 1'
        ],
        [
          { content: 'Product :', styles: { fontStyle: 'bold', textColor: [71, 85, 105], fillColor: [248, 250, 252] } },
          r.product || '—',
          { content: 'Model:', styles: { fontStyle: 'bold', textColor: [71, 85, 105], fillColor: [248, 250, 252] } },
          r.model || r.stage || '—'
        ],
        [
          { content: 'PROCESS / OPERATION:', styles: { fontStyle: 'bold', textColor: [71, 85, 105], fillColor: [248, 250, 252] } },
          r.process_operation || r.line || '—',
          { content: 'Issue Type:', styles: { fontStyle: 'bold', textColor: [71, 85, 105], fillColor: [248, 250, 252] } },
          r.issue_type || '—'
        ],
        [
          { content: 'Priority:', styles: { fontStyle: 'bold', textColor: [71, 85, 105], fillColor: [248, 250, 252] } },
          r.priority || '—',
          { content: 'Assigned Department:', styles: { fontStyle: 'bold', textColor: [71, 85, 105], fillColor: [248, 250, 252] } },
          r.department || '—'
        ],
        [
          { content: 'Assigned Closer Person:', styles: { fontStyle: 'bold', textColor: [71, 85, 105], fillColor: [248, 250, 252] } },
          r.executor || '—',
          { content: 'Logged By (Auditor):', styles: { fontStyle: 'bold', textColor: [71, 85, 105], fillColor: [248, 250, 252] } },
          r.created_by || 'Quality Auditor'
        ],
        [
          { content: 'Auditor Email:', styles: { fontStyle: 'bold', textColor: [71, 85, 105], fillColor: [248, 250, 252] } },
          resolveAuditorEmail(r),
          { content: 'Temporary Closed By:', styles: { fontStyle: 'bold', textColor: [71, 85, 105], fillColor: [248, 250, 252] } },
          r.temporary_closed_by || r.closer_updated_by || r.action_taken_by || r.executor || '—'
        ],
        [
          { content: 'Issue Created At:', styles: { fontStyle: 'bold', textColor: [71, 85, 105], fillColor: [248, 250, 252] } },
          r.created_at ? formatDateDDMMYYYY(r.created_at) : '—',
          { content: 'Last Updated At:', styles: { fontStyle: 'bold', textColor: [71, 85, 105], fillColor: [248, 250, 252] } },
          r.updated_at ? formatDateDDMMYYYY(r.updated_at) : (r.created_at ? formatDateDDMMYYYY(r.created_at) : '—')
        ]
      ]
    });

    // Section 2: 2. AUDIT OBSERVATION & DEFECT PROBLEM DESCRIPTION
    const sec2Y = doc.lastAutoTable.finalY + 8;
    autoTable(doc, {
      startY: sec2Y,
      theme: 'grid',
      margin: { left: 40, right: 40 },
      tableWidth: 515,
      columnStyles: {
        0: { cellWidth: 160 },
        1: { cellWidth: 355 }
      },
      head: [
        [
          {
            content: '2. AUDIT OBSERVATION & DEFECT PROBLEM DESCRIPTION',
            colSpan: 2,
            styles: {
              fillColor: [30, 41, 59], // slate-800
              textColor: [255, 255, 255],
              fontStyle: 'bold',
              fontSize: 8.5
            }
          }
        ]
      ],
      body: [
        [
          { content: 'Audit Observation / Defect Details:', styles: { fontStyle: 'bold', textColor: [71, 85, 105], fillColor: [248, 250, 252] } },
          { content: r.issue_observation || r.problem || '—' }
        ],
        [
          { content: 'Additional Comments & Notes:', styles: { fontStyle: 'bold', textColor: [71, 85, 105], fillColor: [248, 250, 252] } },
          { content: r.comments || '—' }
        ],
        [
          { content: 'Audit Evidence Attachment(s):', styles: { fontStyle: 'bold', textColor: [71, 85, 105], fillColor: [248, 250, 252] } },
          { content: creatorAttStr }
        ]
      ],
      styles: { fontSize: 8, cellPadding: 3.5, valign: 'middle' }
    });

    // Section 3: 3. ROOT CAUSE OCCURRENCE ANALYSIS (5-WHY)
    const whyList = parseWhyList(r.prod_why_why || r.why_why);
    const sec3Y = doc.lastAutoTable.finalY + 8;
    autoTable(doc, {
      startY: sec3Y,
      theme: 'grid',
      margin: { left: 40, right: 40 },
      tableWidth: 515,
      columnStyles: {
        0: { cellWidth: 160 },
        1: { cellWidth: 355 }
      },
      head: [
        [
          {
            content: '3. ROOT CAUSE OCCURRENCE ANALYSIS (5-WHY)',
            colSpan: 2,
            styles: {
              fillColor: [245, 158, 11], // amber-500
              textColor: [255, 255, 255],
              fontStyle: 'bold',
              fontSize: 8.5
            }
          }
        ]
      ],
      body: [
        [
          { content: 'Why 1 (Occurrence Cause):', styles: { fontStyle: 'bold', textColor: [71, 85, 105], fillColor: [248, 250, 252] } },
          { content: whyList[0] || '—' }
        ],
        [
          { content: 'Why 2:', styles: { fontStyle: 'bold', textColor: [71, 85, 105], fillColor: [248, 250, 252] } },
          { content: whyList[1] || '—' }
        ],
        [
          { content: 'Why 3:', styles: { fontStyle: 'bold', textColor: [71, 85, 105], fillColor: [248, 250, 252] } },
          { content: whyList[2] || '—' }
        ],
        [
          { content: 'Why 4:', styles: { fontStyle: 'bold', textColor: [71, 85, 105], fillColor: [248, 250, 252] } },
          { content: whyList[3] || '—' }
        ],
        [
          { content: 'Why 5:', styles: { fontStyle: 'bold', textColor: [71, 85, 105], fillColor: [248, 250, 252] } },
          { content: whyList[4] || '—' }
        ],
        [
          { content: 'Overall Root Cause Summary:', styles: { fontStyle: 'bold', textColor: [71, 85, 105], fillColor: [248, 250, 252] } },
          { content: r.root_cause || '—' }
        ]
      ],
      styles: { fontSize: 8, cellPadding: 3.5, valign: 'middle' }
    });

    // Section 4: 4. ACTION & CLOSURE SIGN-OFF
    const sec4Y = doc.lastAutoTable.finalY + 8;
    const tempActionVal = r.temporary_action || r.action || '—';
    const permActionVal = r.permanent_fix || r.corrective_action || '—';
    const tempTargetDateVal = r.temporary_target_date ? formatDateDDMMYYYY(r.temporary_target_date) : (r.target_date ? formatDateDDMMYYYY(r.target_date) : '—');
    const permTargetDateVal = r.permanent_target_date ? formatDateDDMMYYYY(r.permanent_target_date) : '—';
    const tempClosedByVal = r.temporary_closed_by || r.closer_updated_by || r.action_taken_by || '—';
    const permClosedByVal = r.permanent_closed_by || r.closer_updated_by || r.closed_by || '—';
    const closedByVal = r.reviewed_by || r.approved_by || r.closed_by || '—';
    const closedDateVal = r.closed_at
      ? formatDateDDMMYYYY(r.closed_at)
      : isClosedStatus
      ? (r.updated_at ? formatDateDDMMYYYY(r.updated_at) : '—')
      : '—';

    autoTable(doc, {
      startY: sec4Y,
      theme: 'grid',
      margin: { left: 40, right: 40 },
      tableWidth: 515,
      columnStyles: {
        0: { cellWidth: 160 },
        1: { cellWidth: 355 }
      },
      head: [
        [
          {
            content: '4. ACTION & CLOSURE SIGN-OFF',
            colSpan: 2,
            styles: {
              fillColor: [16, 185, 129], // emerald-600
              textColor: [255, 255, 255],
              fontStyle: 'bold',
              fontSize: 8.5
            }
          }
        ]
      ],
      body: [
        [
          { content: 'Temporary Action:', styles: { fontStyle: 'bold', textColor: [71, 85, 105], fillColor: [248, 250, 252] } },
          { content: tempActionVal }
        ],
        [
          { content: 'Temporary Target Date:', styles: { fontStyle: 'bold', textColor: [71, 85, 105], fillColor: [248, 250, 252] } },
          { content: tempTargetDateVal }
        ],
        [
          { content: 'Temporary Closed By:', styles: { fontStyle: 'bold', textColor: [71, 85, 105], fillColor: [248, 250, 252] } },
          { content: tempClosedByVal }
        ],
        [
          { content: 'Temporary Evidence Attachment(s):', styles: { fontStyle: 'bold', textColor: [71, 85, 105], fillColor: [248, 250, 252] } },
          { content: tempEvidenceAttStr }
        ],
        [
          { content: 'Permanent Action:', styles: { fontStyle: 'bold', textColor: [71, 85, 105], fillColor: [248, 250, 252] } },
          { content: permActionVal }
        ],
        [
          { content: 'Permanent Target Date:', styles: { fontStyle: 'bold', textColor: [71, 85, 105], fillColor: [248, 250, 252] } },
          { content: permTargetDateVal }
        ],
        [
          { content: 'Permanent Closed By:', styles: { fontStyle: 'bold', textColor: [71, 85, 105], fillColor: [248, 250, 252] } },
          { content: permClosedByVal }
        ],
        [
          { content: 'Permanent Evidence Attachment(s):', styles: { fontStyle: 'bold', textColor: [71, 85, 105], fillColor: [248, 250, 252] } },
          { content: permEvidenceAttStr }
        ],
        [
          { content: 'Responsible Closer Person:', styles: { fontStyle: 'bold', textColor: [71, 85, 105], fillColor: [248, 250, 252] } },
          { content: r.executor || '—' }
        ],
        [
          { content: 'Responsible Department:', styles: { fontStyle: 'bold', textColor: [71, 85, 105], fillColor: [248, 250, 252] } },
          { content: r.department || '—' }
        ],
        [
          { content: 'Reassignment Tracking History:', styles: { fontStyle: 'bold', textColor: [71, 85, 105], fillColor: [248, 250, 252] } },
          { content: hasReassignments ? reassignmentDetails : 'No (Re-Assignee)' }
        ],
        [
          { content: 'Auditor Review / Sign-off Remarks:', styles: { fontStyle: 'bold', textColor: [71, 85, 105], fillColor: [248, 250, 252] } },
          { content: r.creator_remark || r.remarks || '—' }
        ],
        [
          { content: 'Closure Sign-off Status:', styles: { fontStyle: 'bold', textColor: [71, 85, 105], fillColor: [248, 250, 252] } },
          {
            content: isClosedStatus ? 'CLOSED (Authorized & Verified)' : displayStatus.toUpperCase(),
            styles: {
              fontStyle: 'bold',
              textColor: isClosedStatus ? [22, 101, 52] : [180, 83, 9]
            }
          }
        ],
        [
          { content: 'Reviewed / Closed By:', styles: { fontStyle: 'bold', textColor: [71, 85, 105], fillColor: [248, 250, 252] } },
          { content: closedByVal }
        ],
        [
          { content: 'Closure Date:', styles: { fontStyle: 'bold', textColor: [71, 85, 105], fillColor: [248, 250, 252] } },
          { content: closedDateVal }
        ]
      ],
      styles: { fontSize: 8, cellPadding: 3.5, valign: 'middle' }
    });

    // Section 5: 5. EMBEDDED AUDIT & ACTION EVIDENCE IMAGES
    if (exportImages && exportImages.length > 0) {
      let currentY = doc.lastAutoTable.finalY + 12;
      if (currentY + 60 > doc.internal.pageSize.height - 40) {
        doc.addPage();
        currentY = 40;
      }

      // Section 5 Title Box
      doc.setFillColor(30, 41, 59);
      doc.rect(40, currentY, 515, 18, 'F');
      doc.setFontSize(8.5);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text(`5. EMBEDDED AUDIT & ACTION EVIDENCE IMAGES (${exportImages.length})`, 48, currentY + 12);
      currentY += 24;

      for (const img of exportImages) {
        if (currentY + 220 > doc.internal.pageSize.height - 40) {
          doc.addPage();
          currentY = 40;
        }

        doc.setFillColor(241, 245, 249);
        doc.rect(40, currentY, 515, 18, 'F');
        doc.setDrawColor(203, 213, 225);
        doc.rect(40, currentY, 515, 18, 'S');

        doc.setFontSize(8);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(30, 41, 59);
        doc.text(`${img.label}: ${img.name}`, 48, currentY + 12);

        try {
          doc.addImage(img.dataUrl, (img.extension || 'JPEG').toUpperCase(), 40, currentY + 22, 340, 180);
        } catch (imgErr) {
          console.warn('Failed to embed image in PDF:', imgErr);
        }

        currentY += 210;
      }
    }

    // Footer
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Page ${i} of ${pageCount}  |  INDIA NIPPON ELECTRICALS LIMITED  |  Generated on ${formatDateDDMMYYYY(new Date())}`,
        40,
        doc.internal.pageSize.height - 20
      );
    }

    const safeNo = String(reqNo).replace(/[^a-zA-Z0-9_-]/g, '_');
    doc.save(fileName || `Process_Audit_Inspection_Report_${safeNo}_${new Date().toISOString().slice(0, 10)}.pdf`);
    return;
  }

  // Preload image thumbnails for rows that contain an image
  const rowImages = await Promise.all(
    reqList.map(async (r) => {
      const defectFiles = parseAttachments(r.attachments);
      const firstImg = defectFiles.find(isImageAttachment);
      if (!firstImg) return null;
      return await fetchAttachmentImageBase64(firstImg, 'process-audit');
    })
  );

  // Multi-record landscape summary table export matching IHLR exactly
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'pt',
    format: 'a4'
  });

  const today = new Date().toISOString().slice(0, 10);
  let textStartX = 24;
  if (logoData) {
    try {
      doc.addImage(logoData, 'PNG', 24, 16, 42, 42);
      textStartX = 74;
    } catch {
      textStartX = 24;
    }
  }

  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text('INDIA NIPPON ELECTRICALS LIMITED', textStartX, 30);

  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(37, 99, 235); // blue-600
  doc.text(title, textStartX, 44);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139); // slate-500
  const metaText = filterText
    ? `Generated: ${today} | Total Records: ${reqList.length} | ${filterText}`
    : `Generated: ${today} | Total Records: ${reqList.length}`;
  doc.text(metaText, textStartX, 56);

  // Right-aligned Document Label
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text('PROCESS AUDIT ACTION LOG', doc.internal.pageSize.width - 24, 30, { align: 'right' });

  // Super Headings & Detailed Column Headers (14 columns covering all audit phases)
  const tableHeaders = [
    [
      {
        content: 'REQUESTOR (AUDIT OBSERVATION & PARAMETERS)',
        colSpan: 8,
        styles: {
          fillColor: [254, 243, 199], // amber-100
          textColor: [120, 53, 15],  // amber-900
          halign: 'center',
          fontStyle: 'bold',
          fontSize: 8
        }
      },
      {
        content: 'CLOSER (ROOT CAUSE & ACTIONS)',
        colSpan: 4,
        styles: {
          fillColor: [255, 237, 213], // orange-100
          textColor: [124, 45, 18],  // orange-900
          halign: 'center',
          fontStyle: 'bold',
          fontSize: 8
        }
      },
      {
        content: 'REMARKS & STATUS',
        colSpan: 2,
        styles: {
          fillColor: [241, 245, 249], // slate-100
          textColor: [30, 41, 59],   // slate-800
          halign: 'center',
          fontStyle: 'bold',
          fontSize: 8
        }
      }
    ],
    [
      'SL NO',
      'AUDIT REQ NO',
      'ESCALATION DATE / SHIFT',
      'PRODUCT / MODEL',
      'PROCESS / OPERATION',
      'AUDIT OBSERVATION',
      'ASSIGNED DEPT / EXECUTOR',
      'AUDIT EVIDENCE',
      'OCCURRENCE CAUSE (5-WHY)',
      'ACTIONS TAKEN (TEMP / PERM)',
      'TARGET DATES',
      'CLOSER EVIDENCE',
      'REMARKS',
      'STATUS'
    ]
  ];

  const tableRows = reqList.map((r, idx) => {
    const defectFiles = parseAttachments(r.attachments);
    const imgObj = rowImages[idx];
    const fileCellText = imgObj?.dataUrl
      ? (defectFiles.length > 1 ? `\n\n(+${defectFiles.length - 1} more file${defectFiles.length - 1 > 1 ? 's' : ''})` : '')
      : (defectFiles.map((a) => a.name).join(', ') || '—');

    const tempEvFiles = parseAttachments(r.temporary_evidence_attachment || r.action_attachments);
    const permEvFiles = parseAttachments(r.permanent_evidence_attachment);
    const closerEvFiles = [...tempEvFiles, ...permEvFiles];
    const closerEvStr = closerEvFiles.length > 0 ? closerEvFiles.map(a => a.name).join(', ') : '—';

    let deptExecutorStr = r.department || '—';
    if (r.executor) deptExecutorStr += `\n(${r.executor})`;

    const whyList = parseWhyList(r.prod_why_why || r.why_why);
    const occCause = whyList[0] || r.root_cause || '—';

    const displayStatus = getProcessAuditDisplayStatus(r);
    let statusStr = displayStatus.toUpperCase();
    if (r.reviewed_by && r.reviewed_by.trim()) {
      statusStr += `\nReviewed: ${r.reviewed_by.trim()}`;
    }

    let actionStr = '—';
    if (r.temporary_action && r.permanent_fix) {
      actionStr = `Temp: ${r.temporary_action}\nPerm: ${r.permanent_fix}`;
    } else if (r.temporary_action || r.action) {
      actionStr = `Temp: ${r.temporary_action || r.action}`;
    } else if (r.permanent_fix) {
      actionStr = `Perm: ${r.permanent_fix}`;
    }

    let targetDateStr = '—';
    const tempTDate = r.temporary_target_date || r.target_date;
    const permTDate = r.permanent_target_date;
    if (tempTDate && permTDate) {
      targetDateStr = `Temp: ${formatDateDDMMYYYY(tempTDate)}\nPerm: ${formatDateDDMMYYYY(permTDate)}`;
    } else if (tempTDate) {
      targetDateStr = `Temp: ${formatDateDDMMYYYY(tempTDate)}`;
    } else if (permTDate) {
      targetDateStr = `Perm: ${formatDateDDMMYYYY(permTDate)}`;
    }

    const reqNo = r.issue_no || (r.id ? `PA-${r.id}` : `#${idx + 1}`);
    const escDate = r.escalation_date ? formatDateDDMMYYYY(r.escalation_date) : (r.created_at ? formatDateDDMMYYYY(r.created_at) : '—');

    return [
      idx + 1,
      reqNo,
      `${escDate}\n${r.shift || 'Shift 1'}`,
      `${r.product || '—'}\n${r.model || r.stage || '—'}`,
      r.process_operation || r.line || '—',
      r.issue_observation || r.problem || '—',
      deptExecutorStr,
      fileCellText,
      occCause,
      actionStr,
      targetDateStr,
      closerEvStr,
      r.creator_remark || r.remarks || '—',
      statusStr
    ];
  });

  autoTable(doc, {
    head: tableHeaders,
    body: tableRows,
    startY: 68,
    theme: 'grid',
    margin: { left: 24, right: 24, top: 16, bottom: 20 },
    styles: {
      fontSize: 7,
      cellPadding: 3,
      valign: 'middle',
      overflow: 'linebreak'
    },
    headStyles: {
      fillColor: [30, 41, 59], // Dark slate header for 2nd row
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
      fontSize: 7.5
    },
    columnStyles: {
      0: { cellWidth: 20, halign: 'center' },
      1: { cellWidth: 42, fontStyle: 'bold', halign: 'center' },
      2: { cellWidth: 52, halign: 'center' },
      3: { cellWidth: 56 },
      4: { cellWidth: 50 },
      5: { cellWidth: 72 },
      6: { cellWidth: 54, halign: 'center' },
      7: { cellWidth: 56, minCellHeight: 34, halign: 'center', valign: 'middle' },
      8: { cellWidth: 62 },
      9: { cellWidth: 70 },
      10: { cellWidth: 52, halign: 'center' },
      11: { cellWidth: 50 },
      12: { cellWidth: 58 },
      13: { cellWidth: 50, halign: 'center', fontStyle: 'bold' }
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252] // slate-50
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 13) {
        const text = String(data.cell.raw || '').toUpperCase();
        if (text.startsWith('CLOSED')) {
          data.cell.styles.textColor = [22, 101, 52]; // emerald-700
          data.cell.styles.fontStyle = 'bold';
        } else if (text.includes('REVIEW') || text.includes('SIGNED') || text.includes('PROGRESS')) {
          data.cell.styles.textColor = [180, 83, 9]; // amber-700
          data.cell.styles.fontStyle = 'bold';
        } else {
          data.cell.styles.textColor = [225, 29, 72]; // rose-600
          data.cell.styles.fontStyle = 'bold';
        }
      }
    },
    didDrawCell: (data) => {
      if (data.section === 'body' && data.column.index === 7) {
        const imgObj = rowImages[data.row.index];
        if (imgObj && imgObj.dataUrl) {
          try {
            const padding = 2;
            const cellW = data.cell.width - padding * 2;
            const cellH = data.cell.height - padding * 2;
            const imgW = Math.min(cellW, 54);
            const imgH = Math.min(cellH, 28);
            const x = data.cell.x + (data.cell.width - imgW) / 2;
            const y = data.cell.y + (data.cell.height - imgH) / 2;
            doc.addImage(imgObj.dataUrl, imgObj.extension === 'png' ? 'PNG' : 'JPEG', x, y, imgW, imgH);
          } catch (e) {
            console.warn('Could not draw PDF cell image:', e);
          }
        }
      }
    },
    didDrawPage: (data) => {
      const pageCount = doc.internal.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Page ${data.pageNumber} of ${pageCount}`,
        doc.internal.pageSize.width - 60,
        doc.internal.pageSize.height - 15
      );
    }
  });

  const targetFileName = fileName || `Process_Audit_Analysis_Report_${today}.pdf`;
  doc.save(targetFileName.endsWith('.pdf') ? targetFileName : `${targetFileName}.pdf`);
};
