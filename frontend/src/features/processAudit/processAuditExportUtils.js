import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { parseAttachments } from '../../components/common/attachmentUtils';
import { fetchAttachmentImageBase64 } from '../../components/common/attachmentUtils';
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

export const getProcessAuditDisplayStatus = (r) => {
  if (!r) return 'Pending';
  const sLower = String(r.status || 'Pending').toLowerCase();
  if (sLower.includes('close')) return 'Closed';
  if (sLower.includes('reject')) return 'Rejected';
  if (sLower.includes('pending')) return 'Pending';
  if (sLower === 'open' || sLower.includes('open') || sLower.includes('reopen')) return 'Open';
  if (sLower.includes('signed off') || sLower.includes('signed')) return 'Signed off';
  if (sLower.includes('review') || sLower.includes('approval') || sLower.includes('progress')) return 'Awaiting Review';

  const isCloserCompleted = Boolean(
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
    ...dFiles.filter(isImg).map((a) => ({ ...a, label: 'Issue Defect Evidence Image' })),
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

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'India Nippon Electricals Limited';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet(sheetName, {
    views: [{ showGridLines: true }]
  });

  // 33 Columns configuration
  const colWidths = [
    // 1-16: REQUESTOR (Audit Observation & Parameters)
    8,  // 1: SL NO
    14, // 2: ISSUE NO
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
    34, // 14: AUDIT OBSERVATION
    24, // 15: ADDITIONAL COMMENTS
    26, // 16: AUDIT EVIDENCE ATTACHMENTS
    // 17-26: CLOSER (Root Cause & Actions)
    30, // 17: 5-WHY ROOT CAUSE ANALYSIS
    24, // 18: OVERALL ROOT CAUSE
    28, // 19: TEMPORARY ACTION
    15, // 20: TEMPORARY TARGET DATE
    18, // 21: TEMPORARY CLOSED BY
    24, // 22: TEMPORARY EVIDENCE
    28, // 23: PERMANENT ACTION
    15, // 24: PERMANENT TARGET DATE
    18, // 25: PERMANENT CLOSED BY
    24, // 26: PERMANENT EVIDENCE
    // 27-28: REASSIGNMENT TRACKING
    16, // 27: REASSIGNED STATUS
    36, // 28: REASSIGNMENT DETAILS
    // 29-32: AUDITOR REVIEW & CLOSURE SIGN-OFF
    24, // 29: AUDITOR REVIEW REMARKS
    16, // 30: STATUS
    18, // 31: REVIEWED / CLOSED BY
    14  // 32: CLOSED AT
  ];

  colWidths.forEach((w, i) => {
    worksheet.getColumn(i + 1).width = w;
  });

  // ROW 1: SUPER HEADINGS
  worksheet.mergeCells('A1:P1');
  const superReq = worksheet.getCell('A1');
  superReq.value = 'REQUESTOR (AUDIT OBSERVATION & PARAMETERS)';
  superReq.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FF1E3A8A' } }; // blue-900
  superReq.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } }; // blue-100
  superReq.alignment = { vertical: 'middle', horizontal: 'center' };

  worksheet.mergeCells('Q1:Z1');
  const superCloser = worksheet.getCell('Q1');
  superCloser.value = 'CLOSER (ROOT CAUSE & ACTIONS)';
  superCloser.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FF7C2D12' } }; // orange-900
  superCloser.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEDD5' } }; // orange-100
  superCloser.alignment = { vertical: 'middle', horizontal: 'center' };

  worksheet.mergeCells('AA1:AB1');
  const superReassign = worksheet.getCell('AA1');
  superReassign.value = 'REASSIGNMENT TRACKING';
  superReassign.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FF4C1D95' } }; // violet-900
  superReassign.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDE9FE' } }; // violet-100
  superReassign.alignment = { vertical: 'middle', horizontal: 'center' };

  worksheet.mergeCells('AC1:AF1');
  const superStatus = worksheet.getCell('AC1');
  superStatus.value = 'AUDITOR REVIEW & CLOSURE SIGN-OFF';
  superStatus.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FF065F46' } }; // emerald-900
  superStatus.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } }; // emerald-100
  superStatus.alignment = { vertical: 'middle', horizontal: 'center' };

  worksheet.getRow(1).height = 24;

  // ROW 2: DETAILED COLUMN HEADINGS
  const columnHeaders = [
    'SL NO',
    'ISSUE NO',
    'ESCALATION DATE',
    'SHIFT',
    'PRODUCT',
    'MODEL',
    'PROCESS / OPERATION',
    'ISSUE TYPE',
    'PRIORITY',
    'ASSIGNED DEPT',
    'ASSIGNED EXECUTOR',
    'LOGGED BY AUDITOR',
    'AUDITOR EMAIL',
    'AUDIT OBSERVATION',
    'ADDITIONAL COMMENTS',
    'AUDIT EVIDENCE ATTACHMENTS',
    '5-WHY ROOT CAUSE ANALYSIS',
    'OVERALL ROOT CAUSE',
    'TEMPORARY ACTION',
    'TEMPORARY TARGET DATE',
    'TEMPORARY CLOSED BY',
    'TEMPORARY EVIDENCE',
    'PERMANENT ACTION',
    'PERMANENT TARGET DATE',
    'PERMANENT CLOSED BY',
    'PERMANENT EVIDENCE',
    'REASSIGNED STATUS',
    'REASSIGNMENT DETAILS',
    'AUDITOR REVIEW REMARKS',
    'STATUS',
    'REVIEWED / CLOSED BY',
    'CLOSED AT'
  ];

  const headerRow = worksheet.getRow(2);
  headerRow.values = columnHeaders;
  headerRow.height = 30;

  headerRow.eachCell((cell, colNumber) => {
    cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      bottom: { style: 'medium', color: { argb: 'FF475569' } },
      right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
    };

    if (colNumber <= 16) {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } }; // blue-900
    } else if (colNumber <= 26) {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF9A3412' } }; // orange-800
    } else if (colNumber <= 28) {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF5B21B6' } }; // violet-800
    } else {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF065F46' } }; // emerald-800
    }
  });

  // DATA ROWS
  reqList.forEach((r, idx) => {
    const rowIdx = idx + 3;
    const reqNo = r.issue_no || (r.id ? `PA-${r.id}` : `#${idx + 1}`);
    const escDate = r.escalation_date ? formatDateDDMMYYYY(r.escalation_date) : (r.created_at ? formatDateDDMMYYYY(r.created_at) : '—');
    const closedAt = r.closed_at ? formatDateDDMMYYYY(r.closed_at) : '—';

    const creatorAttachments = parseAttachments(r.attachments);
    const creatorAttStr = creatorAttachments.map(a => a.name || a.filename).filter(Boolean).join(', ') || '—';

    const tempAttachments = parseAttachments(r.temporary_evidence_attachment || r.action_attachments);
    const tempAttStr = tempAttachments.map(a => a.name || a.filename).filter(Boolean).join(', ') || '—';

    const permAttachments = parseAttachments(r.permanent_evidence_attachment);
    const permAttStr = permAttachments.map(a => a.name || a.filename).filter(Boolean).join(', ') || '—';

    const whyAnalysisVal = (() => {
      const parsedWhys = parseWhyList(r.prod_why_why || r.why_why);
      if (parsedWhys.length > 0) {
        return parsedWhys.map((w, i) => w && String(w).trim() ? `W${i + 1}: ${String(w).trim()}` : null).filter(Boolean).join('\n') || '—';
      }
      return '—';
    })();

    const tempTargetDate = (r.temporary_target_date ? formatDateDDMMYYYY(r.temporary_target_date) : '') ||
      (r.target_date ? formatDateDDMMYYYY(r.target_date) : '—');
    const permTargetDate = r.permanent_target_date ? formatDateDDMMYYYY(r.permanent_target_date) : '—';

    const tempClosedBy = r.temporary_closed_by || r.closer_updated_by || r.action_taken_by || r.executor || '—';
    const permClosedBy = r.permanent_closed_by || r.closer_updated_by || r.approved_by || '—';

    const { reassignedStatus, reassignmentDetails } = formatReassignmentHistory(r.reassignment_history);
    const displayStatus = getProcessAuditDisplayStatus(r);

    const rowData = [
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
      r.created_by || '—',
      resolveAuditorEmail(r),
      r.issue_observation || r.problem || '—',
      r.comments || '—',
      creatorAttStr,
      whyAnalysisVal,
      r.root_cause || '—',
      r.temporary_action || r.action || '—',
      tempTargetDate,
      tempClosedBy,
      tempAttStr,
      r.permanent_fix || r.corrective_action || '—',
      permTargetDate,
      permClosedBy,
      permAttStr,
      reassignedStatus,
      reassignmentDetails,
      r.creator_remark || r.remarks || '—',
      displayStatus,
      r.reviewed_by || r.approved_by || r.closed_by || '—',
      closedAt
    ];

    const dataRow = worksheet.getRow(rowIdx);
    dataRow.values = rowData;
    dataRow.height = 24;

    dataRow.eachCell((cell, colNumber) => {
      cell.font = { name: 'Arial', size: 9 };
      cell.alignment = { vertical: 'middle', wrapText: true };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
      };

      if (idx % 2 === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      }

      // Center-align code/date/status columns
      if ([1, 2, 3, 4, 8, 9, 20, 24, 28, 31, 33].includes(colNumber)) {
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      }

      // Format Status badge color
      if (colNumber === 31) {
        cell.font = { name: 'Arial', size: 9, bold: true };
        if (displayStatus === 'Closed') {
          cell.font.color = { argb: 'FF15803D' }; // green-700
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } }; // green-100
        } else if (displayStatus === 'Signed off') {
          cell.font.color = { argb: 'FF4338CA' }; // indigo-700
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E7FF' } }; // indigo-100
        } else if (displayStatus === 'Rejected') {
          cell.font.color = { argb: 'FFB91C1C' }; // red-700
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } }; // red-100
        } else {
          cell.font.color = { argb: 'FFB45309' }; // amber-700
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } }; // amber-100
        }
      }
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const downloadUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = fileName || `Process_Audit_Report_${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(downloadUrl);
};

/**
 * Common PDF Export function for Process Audit (Approvals, AllRequests, Details Modal)
 */
export const exportProcessAuditToPdf = async ({
  requests,
  fileName,
  title = 'Process Audit Observation & Action Report',
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
    doc.text(`PROCESS AUDIT INSPECTION REPORT  |  ${reqNo}`, bannerTextX, 66);

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
        0: { cellWidth: 150 },
        1: { cellWidth: 365 }
      },
      head: [
        [
          {
            content: '2. AUDIT OBSERVATION & DEFECT PROBLEM DESCRIPTION',
            colSpan: 2,
            styles: {
              fillColor: [37, 99, 235], // blue-600
              textColor: [255, 255, 255],
              fontStyle: 'bold',
              fontSize: 8.5
            }
          }
        ]
      ],
      body: [
        [
          { content: 'Issue / Observation:', styles: { fontStyle: 'bold', textColor: [71, 85, 105], fillColor: [248, 250, 252] } },
          { content: r.issue_observation || r.problem || 'No observation recorded.' }
        ],
        [
          { content: 'Comments:', styles: { fontStyle: 'bold', textColor: [71, 85, 105], fillColor: [248, 250, 252] } },
          { content: r.comments || '—' }
        ],
        [
          { content: 'Auditor Defect Attachment(s):', styles: { fontStyle: 'bold', textColor: [71, 85, 105], fillColor: [248, 250, 252] } },
          { content: creatorAttStr }
        ]
      ],
      styles: { fontSize: 8, cellPadding: 3.5, valign: 'middle' }
    });

    // Section 3: 3. ROOT CAUSE OCCURRENCE ANALYSIS (5-WHY)
    const sec3Y = doc.lastAutoTable.finalY + 8;
    const whys = parseWhyList(r.prod_why_why || r.why_why);
    const whyRows = [];
    for (let i = 0; i < 5; i++) {
      const cause = (whys[i] && String(whys[i]).trim()) || '—';
      if (i === 0 || cause !== '—') {
        whyRows.push([`Why ${i + 1} (W${i + 1})`, cause]);
      }
    }

    autoTable(doc, {
      startY: sec3Y,
      theme: 'grid',
      margin: { left: 40, right: 40 },
      tableWidth: 515,
      head: [
        [
          {
            content: '3. ROOT CAUSE OCCURRENCE ANALYSIS (5-WHY)',
            colSpan: 2,
            styles: {
              fillColor: [217, 119, 6], // amber-600
              textColor: [255, 255, 255],
              fontStyle: 'bold',
              fontSize: 8.5
            }
          }
        ],
        [
          { content: 'LEVEL', styles: { halign: 'center', fontStyle: 'bold', fillColor: [245, 158, 11], textColor: [255, 255, 255] } },
          { content: 'ROOT CAUSE OCCURRENCE INVESTIGATION (5-WHY)', styles: { fontStyle: 'bold', fillColor: [245, 158, 11], textColor: [255, 255, 255] } }
        ]
      ],
      body: whyRows.length > 0 ? whyRows : [
        ['Why 1 (W1)', r.root_cause || 'Root cause pending closer investigation.']
      ],
      headStyles: { fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 110, fontStyle: 'bold', halign: 'center' },
        1: { cellWidth: 405 }
      },
      styles: { fontSize: 8, cellPadding: 3.5, valign: 'middle' }
    });

    // Section 4: 4. ACTION & CLOSURE SIGN-OFF
    const sec4Y = doc.lastAutoTable.finalY + 8;
    const tempActionVal = r.temporary_action || r.action || '—';
    const tempTargetDateVal = (r.temporary_target_date ? formatDateDDMMYYYY(r.temporary_target_date) : '') ||
      (r.target_date ? formatDateDDMMYYYY(r.target_date) : '—');
    const tempClosedByVal = r.temporary_closed_by || r.closer_updated_by || r.action_taken_by || r.executor || '—';

    const permActionVal = r.permanent_fix || r.corrective_action || '—';
    const permTargetDateVal = r.permanent_target_date ? formatDateDDMMYYYY(r.permanent_target_date) : '—';
    const permClosedByVal = r.permanent_closed_by || r.closer_updated_by || r.approved_by || '—';

    const closedByVal = isClosedStatus
      ? (r.reviewed_by || r.approved_by || r.closed_by || 'Quality Auditor')
      : (r.reviewed_by ? `Reviewed by ${r.reviewed_by}` : 'Pending Closure Authorization');

    const closedDateVal = isClosedStatus
      ? (r.closed_at ? formatDateDDMMYYYY(r.closed_at) : (r.updated_at ? formatDateDDMMYYYY(r.updated_at) : '—'))
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

  // Multi-record landscape summary table export
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

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('INDIA NIPPON ELECTRICALS LIMITED', textStartX, 30);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(37, 99, 235);
  doc.text(title, textStartX, 44);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(`Generated: ${today} | Total Records: ${reqList.length} ${filterText ? `| ${filterText}` : ''}`, textStartX, 56);

  const tableHeaders = [
    [
      { content: '#', styles: { halign: 'center' } },
      { content: 'Req No', styles: { halign: 'center' } },
      { content: 'Date', styles: { halign: 'center' } },
      { content: 'Model / Process' },
      { content: 'Observation & Findings' },
      { content: 'Department' },
      { content: 'Executor' },
      { content: 'Root Cause & Action' },
      { content: 'Target Date', styles: { halign: 'center' } },
      { content: 'Status', styles: { halign: 'center' } },
      { content: 'Remarks' }
    ]
  ];

  const tableData = reqList.map((r, idx) => {
    const reqNo = r.issue_no || (r.id ? `PA-${r.id}` : `#${idx + 1}`);
    const escDate = r.escalation_date ? formatDateDDMMYYYY(r.escalation_date) : (r.created_at ? formatDateDDMMYYYY(r.created_at) : '—');
    const displayStatus = getProcessAuditDisplayStatus(r);

    return [
      idx + 1,
      reqNo,
      escDate,
      `${r.model || r.stage || '—'} / ${r.process_operation || r.line || '—'}`,
      r.issue_observation || r.problem || '—',
      r.department || '—',
      r.executor || '—',
      [r.root_cause ? `RC: ${r.root_cause}` : '', r.corrective_action ? `Action: ${r.corrective_action}` : ''].filter(Boolean).join(' | ') || '—',
      r.target_date ? formatDateDDMMYYYY(r.target_date) : '—',
      displayStatus,
      r.creator_remark || r.remarks || '—'
    ];
  });

  autoTable(doc, {
    startY: 68,
    head: tableHeaders,
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold'
    },
    styles: {
      fontSize: 7.5,
      cellPadding: 3,
      overflow: 'linebreak'
    },
    columnStyles: {
      0: { cellWidth: 20 },
      1: { cellWidth: 45 },
      2: { cellWidth: 45 },
      3: { cellWidth: 80 },
      4: { cellWidth: 150 },
      5: { cellWidth: 65 },
      6: { cellWidth: 65 },
      7: { cellWidth: 150 },
      8: { cellWidth: 45 },
      9: { cellWidth: 45 },
      10: { cellWidth: 70 }
    }
  });

  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Page ${i} of ${pageCount}  |  Generated on ${formatDateDDMMYYYY(new Date())}`,
      24,
      doc.internal.pageSize.height - 15
    );
  }

  doc.save(fileName || `Process_Audit_Log_${today}.pdf`);
};
