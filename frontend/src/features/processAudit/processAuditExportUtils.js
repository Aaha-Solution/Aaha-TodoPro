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
      const prev = [entry.previous_executor, entry.previous_department ? `(${entry.previous_department})` : ''].filter(Boolean).join(' ');
      const next = [entry.new_executor, entry.new_department ? `(${entry.new_department})` : ''].filter(Boolean).join(' ');
      const dateStr = entry.reassigned_at ? formatDateDDMMYYYY(entry.reassigned_at) : '';
      const by = entry.reassigned_by ? `by ${entry.reassigned_by}` : '';
      const on = dateStr ? `on ${dateStr}` : '';
      const meta = [by, on].filter(Boolean).join(' ');
      reassignmentDetails = `From: ${prev || '—'} → To: ${next || '—'}${meta ? ` (${meta})` : ''}${entry.reason ? ` | Reason: ${entry.reason}` : ''}`;
    } else {
      reassignmentDetails = reassignList.map((entry, i) => {
        const prev = [entry.previous_executor, entry.previous_department ? `(${entry.previous_department})` : ''].filter(Boolean).join(' ');
        const next = [entry.new_executor, entry.new_department ? `(${entry.new_department})` : ''].filter(Boolean).join(' ');
        const dateStr = entry.reassigned_at ? formatDateDDMMYYYY(entry.reassigned_at) : '';
        const by = entry.reassigned_by ? `by ${entry.reassigned_by}` : '';
        const on = dateStr ? `on ${dateStr}` : '';
        const meta = [by, on].filter(Boolean).join(' ');
        return `${i + 1}. From: ${prev || '—'} → To: ${next || '—'}${meta ? ` (${meta})` : ''}${entry.reason ? ` | Reason: ${entry.reason}` : ''}`;
      }).join('\n');
    }
  }

  return {
    reassignedStatus,
    reassignmentDetails,
    hasReassignments,
    count: hasReassignments ? reassignList.length : 0
  };
};

export const getProcessAuditDisplayStatus = (r) => {
  if (!r) return 'Pending';
  const sLower = String(r.status || 'Pending').toLowerCase();
  if (sLower.includes('close')) return 'Closed';
  if (sLower.includes('reject')) return 'Rejected';
  if (sLower === 'open' || sLower.includes('open') || sLower.includes('reopen')) return 'Open';
  if (sLower.includes('signed off') || sLower.includes('signed')) return 'Signed off';

  const isCloserCompleted = Boolean(
    sLower.includes('approval') ||
    sLower.includes('progress') ||
    sLower.includes('review') ||
    (r.corrective_action && String(r.corrective_action).trim()) ||
    (r.action && String(r.action).trim()) ||
    (r.root_cause && String(r.root_cause).trim()) ||
    (r.standardization_details && String(r.standardization_details).trim()) ||
    Boolean(r.target_date) ||
    Boolean(r.action_taken_by) ||
    (r.action_attachments && parseAttachments(r.action_attachments).length > 0)
  );

  if (isCloserCompleted) return 'Awaiting Review';
  return 'Pending';
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

  // 26 Columns configuration
  const colWidths = [
    // 1-13: REQUESTOR (Audit Observation & Parameters)
    8,  // 1: SL NO
    14, // 2: REQ NO
    14, // 3: ESCALATION DATE
    12, // 4: SHIFT
    16, // 5: PRODUCT
    18, // 6: MODEL / STAGE
    20, // 7: PROCESS / OPERATION
    14, // 8: ISSUE TYPE
    12, // 9: PRIORITY
    18, // 10: ASSIGNED DEPT
    20, // 11: ASSIGNED EXECUTOR
    18, // 12: CREATED BY
    34, // 13: OBSERVATION / COMMENTS
    24, // 14: AUDIT EVIDENCE ATTACHMENTS
    // 15-20: CLOSER (Root Cause & Corrective Action)
    26, // 15: ROOT CAUSE ANALYSIS
    32, // 16: CORRECTIVE ACTIONS & COUNTERMEASURES
    26, // 17: STANDARDIZATION DETAILS
    14, // 18: TARGET DATE
    18, // 19: ACTION TAKEN BY
    24, // 20: ACTION EVIDENCE ATTACHMENTS
    // 21-22: REASSIGNMENT TRACKING
    16, // 21: REASSIGNED STATUS
    36, // 22: REASSIGNMENT DETAILS
    // 23-26: REMARKS & STATUS
    24, // 23: AUDITOR REMARKS
    14, // 24: STATUS
    18, // 25: CLOSED BY
    14  // 26: CLOSED AT
  ];

  colWidths.forEach((w, i) => {
    worksheet.getColumn(i + 1).width = w;
  });

  // ROW 1: SUPER HEADINGS
  worksheet.mergeCells('A1:N1');
  const superReq = worksheet.getCell('A1');
  superReq.value = 'REQUESTOR (AUDIT OBSERVATION & PARAMETERS)';
  superReq.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FF78350F' } }; // amber-900
  superReq.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } }; // amber-100
  superReq.alignment = { vertical: 'middle', horizontal: 'center' };

  worksheet.mergeCells('O1:T1');
  const superCloser = worksheet.getCell('O1');
  superCloser.value = 'CLOSER (ROOT CAUSE, ACTION & STANDARDIZATION)';
  superCloser.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FF7C2D12' } }; // orange-900
  superCloser.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEDD5' } }; // orange-100
  superCloser.alignment = { vertical: 'middle', horizontal: 'center' };

  worksheet.mergeCells('U1:V1');
  const superReassign = worksheet.getCell('U1');
  superReassign.value = 'REASSIGNMENT TRACKING';
  superReassign.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FF4C1D95' } }; // violet-900
  superReassign.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDE9FE' } }; // violet-100
  superReassign.alignment = { vertical: 'middle', horizontal: 'center' };

  worksheet.mergeCells('W1:Z1');
  const superStatus = worksheet.getCell('W1');
  superStatus.value = 'AUDITOR REVIEW & CLOSURE';
  superStatus.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FF065F46' } }; // emerald-900
  superStatus.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } }; // emerald-100
  superStatus.alignment = { vertical: 'middle', horizontal: 'center' };

  worksheet.getRow(1).height = 24;

  // ROW 2: DETAILED COLUMN HEADINGS
  const columnHeaders = [
    'SL NO',
    'AUDIT REQ NO',
    'ESCALATION DATE',
    'SHIFT',
    'PRODUCT',
    'MODEL / STAGE',
    'PROCESS / OPERATION',
    'ISSUE TYPE',
    'PRIORITY',
    'ASSIGNED DEPT',
    'ASSIGNED EXECUTOR',
    'CREATED BY',
    'OBSERVATION & COMMENTS',
    'AUDIT EVIDENCE',
    'ROOT CAUSE ANALYSIS',
    'CORRECTIVE ACTIONS',
    'STANDARDIZATION DETAILS',
    'TARGET DATE',
    'ACTION TAKEN BY',
    'ACTION EVIDENCE',
    'REASSIGNED STATUS',
    'REASSIGNMENT DETAILS',
    'AUDITOR REMARKS',
    'STATUS',
    'CLOSED BY',
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

    if (colNumber <= 14) {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } }; // blue-900
    } else if (colNumber <= 20) {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF9A3412' } }; // orange-800
    } else if (colNumber <= 22) {
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
    const targetDate = r.target_date ? formatDateDDMMYYYY(r.target_date) : '—';
    const closedAt = r.closed_at ? formatDateDDMMYYYY(r.closed_at) : '—';

    const creatorAttachments = parseAttachments(r.attachments);
    const creatorAttStr = creatorAttachments.map(a => a.name || a.filename).filter(Boolean).join(', ') || '—';

    const actionAttachments = parseAttachments(r.action_attachments);
    const actionAttStr = actionAttachments.map(a => a.name || a.filename).filter(Boolean).join(', ') || '—';

    const { reassignedStatus, reassignmentDetails } = formatReassignmentHistory(r.reassignment_history);

    const displayStatus = getProcessAuditDisplayStatus(r);

    const obsText = [r.issue_observation || r.problem, r.comments].filter(Boolean).join(' | ') || '—';

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
      obsText,
      creatorAttStr,
      r.root_cause || '—',
      r.corrective_action || '—',
      r.standardization_details || '—',
      targetDate,
      r.action_taken_by || r.approved_by || '—',
      actionAttStr,
      reassignedStatus,
      reassignmentDetails,
      r.creator_remark || r.remarks || '—',
      displayStatus,
      r.closed_by || '—',
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
      if ([1, 2, 3, 4, 8, 9, 18, 21, 24, 26].includes(colNumber)) {
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      }

      // Format Status badge color
      if (colNumber === 24) {
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
    doc.text(`PROCESS AUDIT OBSERVATION & ACTION REPORT  |  ${reqNo}`, bannerTextX, 66);

    // Section 1: Basic Parameters Table
    autoTable(doc, {
      startY: 88,
      theme: 'plain',
      styles: { fontSize: 8.5, cellPadding: 3 },
      body: [
        [
          { content: 'Audit Req No:', styles: { fontStyle: 'bold', textColor: [71, 85, 105] } },
          { content: reqNo, styles: { fontStyle: 'bold', textColor: [37, 99, 235] } },
          { content: 'Status:', styles: { fontStyle: 'bold', textColor: [71, 85, 105] } },
          {
            content: displayStatus.toUpperCase(),
            styles: {
              fontStyle: 'bold',
              textColor: displayStatus === 'Closed' ? [22, 101, 52] : displayStatus === 'Signed off' ? [67, 56, 202] : [180, 83, 9]
            }
          }
        ],
        [
          { content: 'Escalation Date:', styles: { fontStyle: 'bold', textColor: [71, 85, 105] } },
          escDate,
          { content: 'Shift:', styles: { fontStyle: 'bold', textColor: [71, 85, 105] } },
          r.shift || '—'
        ],
        [
          { content: 'Product:', styles: { fontStyle: 'bold', textColor: [71, 85, 105] } },
          r.product || '—',
          { content: 'Model / Stage:', styles: { fontStyle: 'bold', textColor: [71, 85, 105] } },
          r.model || r.stage || '—'
        ],
        [
          { content: 'Process / Line:', styles: { fontStyle: 'bold', textColor: [71, 85, 105] } },
          r.process_operation || r.line || '—',
          { content: 'Issue Type:', styles: { fontStyle: 'bold', textColor: [71, 85, 105] } },
          r.issue_type || '—'
        ],
        [
          { content: 'Priority:', styles: { fontStyle: 'bold', textColor: [71, 85, 105] } },
          r.priority || '—',
          { content: 'Created By:', styles: { fontStyle: 'bold', textColor: [71, 85, 105] } },
          r.created_by || 'Quality Auditor'
        ],
        [
          { content: 'Assigned Dept:', styles: { fontStyle: 'bold', textColor: [71, 85, 105] } },
          r.department || '—',
          { content: 'Assigned Executor:', styles: { fontStyle: 'bold', textColor: [71, 85, 105] } },
          r.executor || '—'
        ]
      ]
    });

    // Section 2: Defect Problem Description & Observation
    const lastY = doc.lastAutoTable.finalY + 8;
    autoTable(doc, {
      startY: lastY,
      head: [['AUDIT OBSERVATION & DEFECT PROBLEM DESCRIPTION']],
      body: [
        [`Audit Findings: ${r.issue_observation || r.problem || 'No observation recorded.'}`],
        ...(r.comments ? [[`Additional Comments: ${r.comments}`]] : [])
      ],
      theme: 'grid',
      headStyles: { fillColor: [59, 130, 246], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
      styles: { fontSize: 8.5, cellPadding: 4 }
    });

    // Section 3: Root Cause & Corrective Actions
    const actionY = doc.lastAutoTable.finalY + 8;
    const actionAttachments = parseAttachments(r.action_attachments);
    const creatorAttachments = parseAttachments(r.attachments);
    const { hasReassignments, reassignmentDetails } = formatReassignmentHistory(r.reassignment_history);

    autoTable(doc, {
      startY: actionY,
      head: [['EXECUTOR CORRECTIVE ACTION & STANDARDIZATION REPORT']],
      body: [
        [`Root Cause Analysis: ${r.root_cause || 'Root cause pending executor submission.'}`],
        [`Corrective Actions: ${r.corrective_action || 'Corrective action pending submission.'}`],
        ...(r.standardization_details ? [[`Standardization Details: ${r.standardization_details}`]] : []),
        [`Target Date: ${r.target_date ? formatDateDDMMYYYY(r.target_date) : '—'}  |  Action Taken By: ${r.action_taken_by || r.approved_by || r.executor || 'Assigned Executor'}`],
        ...(hasReassignments ? [[`Reassignment History: ${reassignmentDetails}`]] : []),
        ...(r.creator_remark || r.remarks ? [[`Sign-off Remarks / Auditor Notes: ${r.creator_remark || r.remarks}`]] : []),
        [`Status: ${displayStatus.toUpperCase()}  |  Closed By: ${r.closed_by || '—'}  |  Closed Date: ${r.closed_at ? formatDateDDMMYYYY(r.closed_at) : '—'}`],
        ...(creatorAttachments.length > 0 ? [[`Audit Creator Attachments (${creatorAttachments.length}): ${creatorAttachments.map(a => a.name || a.filename).join(', ')}`]] : []),
        ...(actionAttachments.length > 0 ? [[`Action Evidence Attachments (${actionAttachments.length}): ${actionAttachments.map(a => a.name || a.filename).join(', ')}`]] : [])
      ],
      theme: 'grid',
      headStyles: { fillColor: [16, 185, 129], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
      styles: { fontSize: 8.5, cellPadding: 4 }
    });

    // Footer
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Page ${i} of ${pageCount}  |  Generated on ${formatDateDDMMYYYY(new Date())}`,
        40,
        doc.internal.pageSize.height - 20
      );
    }

    const safeNo = String(reqNo).replace(/[^a-zA-Z0-9_-]/g, '_');
    doc.save(fileName || `Process_Audit_Report_${safeNo}_${new Date().toISOString().slice(0, 10)}.pdf`);
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
