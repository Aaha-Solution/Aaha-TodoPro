import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { parseAttachments } from './IhlrAttachmentView';
import { fetchAttachmentImageBase64 } from '../../components/common/attachmentUtils';
import { formatDateDDMMYYYY } from '../../utils/dateUtils';
import { formatIhlrShiftDisplay } from '../../utils/constants';
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
 * Helper to convert company logo to Base64 for jsPDF embedding
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
      const prev = [entry.prev_resp_person, entry.prev_resp ? `(${entry.prev_resp})` : ''].filter(Boolean).join(' ');
      const next = [entry.new_resp_person, entry.new_resp ? `(${entry.new_resp})` : ''].filter(Boolean).join(' ');
      const dateStr = entry.reassigned_at ? formatDateDDMMYYYY(entry.reassigned_at) : '';
      const by = entry.reassigned_by ? `by ${entry.reassigned_by}` : '';
      const on = dateStr ? `on ${dateStr}` : '';
      const meta = [by, on].filter(Boolean).join(' ');
      reassignmentDetails = `From: ${prev || '—'} → To: ${next || '—'}${meta ? ` (${meta})` : ''}${entry.remarks ? ` | Remarks: ${entry.remarks}` : ''}`;
    } else {
      reassignmentDetails = reassignList.map((entry, i) => {
        const prev = [entry.prev_resp_person, entry.prev_resp ? `(${entry.prev_resp})` : ''].filter(Boolean).join(' ');
        const next = [entry.new_resp_person, entry.new_resp ? `(${entry.new_resp})` : ''].filter(Boolean).join(' ');
        const dateStr = entry.reassigned_at ? formatDateDDMMYYYY(entry.reassigned_at) : '';
        const by = entry.reassigned_by ? `by ${entry.reassigned_by}` : '';
        const on = dateStr ? `on ${dateStr}` : '';
        const meta = [by, on].filter(Boolean).join(' ');
        return `${i + 1}. From: ${prev || '—'} → To: ${next || '—'}${meta ? ` (${meta})` : ''}${entry.remarks ? ` | Remarks: ${entry.remarks}` : ''}`;
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
 * Returns user-facing status label strictly matching the UI:
 * - CLOSED: closed or approved
 * - AWAITING REVIEW: closer containment/action completed or status IN_PROGRESS / APPROVAL_PENDING / AWAITING_REVIEW / UNDER_REVIEW
 * - PENDING: status OPEN or newly reassigned/awaiting closer containment action
 */
export const getIhlrDisplayStatus = (statusOrReq, maybeReq) => {
  const req = (typeof statusOrReq === 'object' && statusOrReq !== null)
    ? statusOrReq
    : (typeof maybeReq === 'object' && maybeReq !== null ? maybeReq : null);

  const rawStatus = (typeof statusOrReq === 'string'
    ? statusOrReq
    : req?.status) || '';

  const s = String(rawStatus).trim().toUpperCase();

  if (s === 'CLOSED' || s === 'APPROVED') {
    return 'CLOSED';
  }

  const isReqOpen = s === 'OPEN';
  const isCompleted = !isReqOpen && (
    s === 'IN_PROGRESS' ||
    s === 'IN-PROGRESS' ||
    s === 'APPROVAL_PENDING' ||
    s === 'APPROVAL PENDING' ||
    s === 'AWAITING_REVIEW' ||
    s === 'AWAITING REVIEW' ||
    s === 'UNDER_REVIEW' ||
    (req && (
      Boolean((req.temporary_action || req.permanent_fix) && String(req.temporary_action || req.permanent_fix).trim()) &&
      Boolean(req.temporary_target_date || req.permanent_target_date) &&
      (Array.isArray(req.prod_why_why)
        ? req.prod_why_why.some((w) => Boolean(w && String(w).trim()))
        : Boolean(req.prod_why_why?.[0] && String(req.prod_why_why[0]).trim()))
    ))
  );

  if (isCompleted) {
    return 'AWAITING REVIEW';
  }

  return 'PENDING';
};

/**
 * Common Excel Export function for all IHLR modules (Dashboard, AllRequests, Approvals, Details Modal)
 * Generates official 33-column workbook with Super Headings, embedded images, and reassignment history.
 */
export const exportIhlrToExcel = async ({
  requests,
  fileName,
  sheetName = 'IHLR Analysis Log'
}) => {
  const reqList = Array.isArray(requests) ? requests : [requests].filter(Boolean);
  if (reqList.length === 0) {
    throw new Error('No data available to export.');
  }

  // Preload image thumbnails for rows that contain an image
  const rowImages = await Promise.all(
    reqList.map(async (r) => {
      const defectFiles = parseAttachments(r.defect_image);
      const firstImg = defectFiles.find(isImageAttachment);
      if (!firstImg) return null;
      return await fetchAttachmentImageBase64(firstImg, 'ihlr');
    })
  );

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'India Nippon Electricals Limited';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet(sheetName, {
    views: [{ showGridLines: true }]
  });

  // 33 Columns configuration
  const colWidths = [
    // 1-21: REQUESTOR (Defect Investigation & QA 5-Why)
    8,  // 1: SL NO
    14, // 2: REQ NO
    14, // 3: INCIDENT DATE
    12, // 4: SHIFT
    20, // 5: MODEL NAME / PART
    32, // 6: PROBLEM / DEFECT DESCRIPTION
    20, // 7: PROBLEM DETECTED AT
    22, // 8: RECEIVED FROM (LINE/CELL)
    18, // 9: ANALYSIS DONE BY
    16, // 10: ACTUAL REJECTED QTY
    16, // 11: 4M CATEGORY
    18, // 12: RESPONSIBILITY (RESP)
    22, // 13: USER NAME (BASED ON DEP)
    22, // 14: DEFECT EVIDENCE / ATTACHMENT (Thumbnail)
    20, // 15: QA WHY 1
    20, // 16: QA WHY 2
    20, // 17: QA WHY 3
    20, // 18: QA WHY 4
    20, // 19: QA WHY 5
    18, // 20: RAISED BY
    14, // 21: CREATED AT
    // 22-34: CLOSER (Temporary & Permanent Actions)
    20, // 22: PROD WHY 1
    20, // 23: PROD WHY 2
    20, // 24: PROD WHY 3
    20, // 25: PROD WHY 4
    20, // 26: PROD WHY 5
    30, // 27: TEMPORARY ACTION
    16, // 28: TEMPORARY TARGET DATE
    18, // 29: TEM CLOSED BY
    26, // 30: TEMPORARY EVIDENCE
    30, // 31: PERMANENT ACTION
    16, // 32: PERMANENT TARGET DATE
    18, // 33: PERM CLOSED BY
    26, // 34: PERMANENT EVIDENCE
    // 35-36: REASSIGNMENT TRACKING
    16, // 35: REASSIGNED STATUS
    38, // 36: REASSIGNMENT DETAILS
    // 37-39: REMARKS, REVIEWED BY & STATUS
    24, // 37: REMARKS
    18, // 38: REVIEWED BY
    20  // 39: STATUS
  ];

  colWidths.forEach((w, i) => {
    worksheet.getColumn(i + 1).width = w;
  });

  // ==============================================================
  // ROW 1: SUPER HEADINGS (Phase Header Row matching user design)
  // ==============================================================
  worksheet.mergeCells('A1:U1');
  const superReq = worksheet.getCell('A1');
  superReq.value = 'REQUESTOR (DEFECT INVESTIGATION & QA 5-WHY)';
  superReq.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FF78350F' } }; // amber-900
  superReq.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } }; // amber-100
  superReq.alignment = { vertical: 'middle', horizontal: 'center' };

  worksheet.mergeCells('V1:AH1');
  const superCloser = worksheet.getCell('V1');
  superCloser.value = 'CLOSER (TEMPORARY & PERMANENT ACTIONS)';
  superCloser.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FF7C2D12' } }; // orange-900
  superCloser.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEDD5' } }; // orange-100
  superCloser.alignment = { vertical: 'middle', horizontal: 'center' };

  worksheet.mergeCells('AI1:AJ1');
  const superReassign = worksheet.getCell('AI1');
  superReassign.value = 'REASSIGNMENT TRACKING';
  superReassign.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FF4C1D95' } }; // violet-900
  superReassign.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDE9FE' } }; // violet-100
  superReassign.alignment = { vertical: 'middle', horizontal: 'center' };

  worksheet.mergeCells('AK1:AM1');
  const superStatus = worksheet.getCell('AK1');
  superStatus.value = 'REMARKS, REVIEW & STATUS';
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
    // 1-21 Requestor (Strictly in CreateRequest form order!)
    'SL NO', 'REQ NO', 'INCIDENT DATE', 'SHIFT', 'MODEL NAME / PART',
    'PROBLEM / DEFECT DESCRIPTION', 'PROBLEM DETECTED AT', 'RECEIVED FROM (LINE/CELL)',
    'ANALYSIS DONE BY', 'ACTUAL REJECTED QTY', '4M CATEGORY',
    'RESPONSIBILITY (RESP)', 'USER NAME (BASED ON DEP)', 'DEFECT EVIDENCE / ATTACHMENT',
    'QA WHY 1', 'QA WHY 2', 'QA WHY 3', 'QA WHY 4', 'QA WHY 5',
    'RAISED BY', 'CREATED AT',
    // 22-34 Closer
    'PROD WHY 1', 'PROD WHY 2', 'PROD WHY 3', 'PROD WHY 4', 'PROD WHY 5',
    'TEMPORARY ACTION', 'TEMPORARY TARGET DATE', 'TEM CLOSED BY', 'TEMPORARY EVIDENCE',
    'PERMANENT ACTION', 'PERMANENT TARGET DATE', 'PERM CLOSED BY', 'PERMANENT EVIDENCE',
    // 35-36 Reassignment Tracking
    'REASSIGNED STATUS', 'REASSIGNMENT DETAILS',
    // 37-39 Remarks, Reviewed By & Status
    'REMARKS', 'REVIEWED BY', 'STATUS'
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

    if (colNum <= 21) {
      cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF78350F' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDE68A' } }; // amber-200
    } else if (colNum <= 32) {
      cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF7C2D12' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFED7AA' } }; // orange-200
    } else if (colNum <= 34) {
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

  reqList.forEach((r, idx) => {
    const defectFiles = parseAttachments(r.defect_image);
    const evidenceFiles = parseAttachments(r.temporary_evidence_attachment || r.evidence_attachment);
    const permanentEvidenceFiles = parseAttachments(r.permanent_evidence_attachment);
    const imgObj = rowImages[idx];
    const rowNum = idx + 3;

    const { reassignedStatus, reassignmentDetails, hasReassignments, count } = formatReassignmentHistory(r.reassignment_history);

    const rowData = [
      // 1-21 Requestor (Strictly in CreateRequest form order!)
      idx + 1,
      String(r.req_no).startsWith('IHLR-') ? r.req_no : `#${r.req_no}`,
      formatDateDDMMYYYY(r.batch_date),
      formatIhlrShiftDisplay(r.shift, true),
      r.model || '—',
      r.problem || '—',
      r.problem_detected_at || '—',
      r.received_from || '—',
      r.analysis_done_by || '—',
      r.actual_qty ? `${r.actual_qty} Nos` : '1 Nos',
      r.four_m || '—',
      r.resp || '—',
      r.resp_person || '—',
      imgObj ? '' : (defectFiles.map((a) => a.name).join(', ') || '—'),
      r.why_why?.[0] || r.qa_why_why?.[0] || '—',
      r.why_why?.[1] || r.qa_why_why?.[1] || '—',
      r.why_why?.[2] || r.qa_why_why?.[2] || '—',
      r.why_why?.[3] || r.qa_why_why?.[3] || '—',
      r.why_why?.[4] || r.qa_why_why?.[4] || '—',
      r.created_by || '—',
      r.created_at ? formatDateDDMMYYYY(r.created_at) : '—',

      // 22-32 Closer
      r.prod_why_why?.[0] || '—',
      r.prod_why_why?.[1] || '—',
      r.prod_why_why?.[2] || '—',
      r.prod_why_why?.[3] || '—',
      r.prod_why_why?.[4] || '—',
      r.temporary_action || r.action || '—',
      (r.temporary_target_date || r.target_date) ? formatDateDDMMYYYY(r.temporary_target_date || r.target_date) : '—',
      r.temporary_closed_by || r.closer_updated_by || '—',
      evidenceFiles.map((a) => a.name).join(', ') || 'None',
      r.permanent_fix || '—',
      r.permanent_target_date ? formatDateDDMMYYYY(r.permanent_target_date) : '—',
      r.permanent_closed_by || r.closer_updated_by || '—',
      permanentEvidenceFiles.map((a) => a.name).join(', ') || 'None',

      // 35-36 Reassignment Tracking
      reassignedStatus,
      reassignmentDetails,

      // 37-39 Remarks, Reviewed By & Status
      r.remarks || '—',
      r.reviewed_by || '—',
      getIhlrDisplayStatus(r.status, r)
    ];

    const displayStatus = getIhlrDisplayStatus(r.status, r);
    const row = worksheet.addRow(rowData);
    row.height = imgObj ? 56 : (hasReassignments && count > 1 ? Math.max(36, count * 18) : 24);

    row.eachCell((cell) => {
      cell.font = regularFont;
      cell.border = thinBorder;
      cell.alignment = { vertical: 'middle', wrapText: true };
    });

    // Center align specific columns
    row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };  // SL NO
    row.getCell(2).alignment = { vertical: 'middle', horizontal: 'center' };  // REQ NO
    row.getCell(3).alignment = { vertical: 'middle', horizontal: 'center' };  // INCIDENT DATE
    row.getCell(4).alignment = { vertical: 'middle', horizontal: 'center' };  // SHIFT
    row.getCell(10).alignment = { vertical: 'middle', horizontal: 'center' }; // ACTUAL REJECTED QTY
    row.getCell(11).alignment = { vertical: 'middle', horizontal: 'center' }; // 4M CATEGORY
    row.getCell(14).alignment = { vertical: 'middle', horizontal: 'center' }; // DEFECT EVIDENCE
    row.getCell(21).alignment = { vertical: 'middle', horizontal: 'center' }; // CREATED AT
    row.getCell(28).alignment = { vertical: 'middle', horizontal: 'center' }; // TEMPORARY TARGET DATE
    row.getCell(29).alignment = { vertical: 'middle', horizontal: 'center' }; // TEM CLOSED BY
    row.getCell(32).alignment = { vertical: 'middle', horizontal: 'center' }; // PERMANENT TARGET DATE
    row.getCell(33).alignment = { vertical: 'middle', horizontal: 'center' }; // PERM CLOSED BY
    row.getCell(35).alignment = { vertical: 'middle', horizontal: 'center' }; // REASSIGNED STATUS
    row.getCell(38).alignment = { vertical: 'middle', horizontal: 'center' }; // REVIEWED BY
    row.getCell(39).alignment = { vertical: 'middle', horizontal: 'center' }; // STATUS

    // Apply UI-matched status styling in Excel
    const statusCell = row.getCell(39);
    if (displayStatus === 'CLOSED') {
      statusCell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF15803D' } }; // emerald-700
      statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } }; // emerald-100
    } else if (displayStatus === 'AWAITING REVIEW' || displayStatus === 'APPROVAL PENDING') {
      statusCell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFB45309' } }; // amber-700
      statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } }; // amber-100
    } else {
      statusCell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFE11D48' } }; // rose-600
      statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE4E6' } }; // rose-100
    }

    // Embed image thumbnail into Column 14 (DEFECT EVIDENCE / ATTACHMENT - 0-indexed col 13.12)
    if (imgObj && imgObj.base64) {
      try {
        const imgId = workbook.addImage({
          base64: imgObj.base64,
          extension: imgObj.extension === 'png' ? 'png' : 'jpeg'
        });
        worksheet.addImage(imgId, {
          tl: { col: 13.12, row: rowNum - 0.88 },
          ext: { width: 85, height: 48 },
          editAs: 'oneCell'
        });
      } catch (e) {
        console.warn('Could not add image to Excel:', e);
      }
    }
  });

  const today = new Date().toISOString().slice(0, 10);
  const targetFileName = fileName || `IHLR_Analysis_Report_${today}.xlsx`;
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
 * Common PDF Export function for IHLR tabular reports (Dashboard, AllRequests, Approvals)
 * Generates official landscape document with company logo, table formatting, and page numbers.
 */
export const exportIhlrToPdf = async ({
  requests,
  fileName,
  title = 'IHLR Analysis Log & Rejection Reports',
  filterText = ''
}) => {
  const reqList = Array.isArray(requests) ? requests : [requests].filter(Boolean);
  if (reqList.length === 0) {
    throw new Error('No data available to export.');
  }

  // Preload image thumbnails for rows that contain an image
  const rowImages = await Promise.all(
    reqList.map(async (r) => {
      const defectFiles = parseAttachments(r.defect_image);
      const firstImg = defectFiles.find(isImageAttachment);
      if (!firstImg) return null;
      return await fetchAttachmentImageBase64(firstImg, 'ihlr');
    })
  );

  // Preload official company logo
  const logoData = await loadLogoBase64();

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'pt',
    format: 'a4'
  });

  const today = new Date().toISOString().slice(0, 10);

  // Top Title and Company Branding with Logo
  let textStartX = 24;
  if (logoData) {
    try {
      doc.addImage(logoData, 'PNG', 24, 16, 42, 42);
      textStartX = 74;
    } catch (imgErr) {
      console.warn('Could not add logo to PDF:', imgErr);
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
  doc.text('QUALITY ASSURANCE REJECTION LOG', doc.internal.pageSize.width - 24, 30, { align: 'right' });

  // Super Headings & Full Detailed Column Headers (14 columns covering ALL fields)
  const tableHeaders = [
    [
      {
        content: 'REQUESTOR (DEFECT INVESTIGATION & QA 5-WHY)',
        colSpan: 10,
        styles: {
          fillColor: [254, 243, 199], // amber-100
          textColor: [120, 53, 15],  // amber-900
          halign: 'center',
          fontStyle: 'bold',
          fontSize: 8
        }
      },
      {
        content: 'CLOSER (PRODUCTION CONTAINMENT)',
        colSpan: 3,
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
        colSpan: 1,
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
      'REQ NO',
      'DATE / SHIFT',
      'PROBLEM',
      'MODEL / QTY',
      'DETECTED AT',
      'RECEIVED FROM',
      'ANALYSIS BY',
      'DEFECT FILE',
      '4M / RESP',
      'OCCURRENCE CAUSE',
      'ACTION TAKEN',
      'TARGET DATE',
      'STATUS'
    ]
  ];

  const tableRows = reqList.map((r, idx) => {
    const defectFiles = parseAttachments(r.defect_image);
    const imgObj = rowImages[idx];
    const fileCellText = imgObj?.dataUrl
      ? ''
      : (defectFiles.map((a) => a.name).join(', ') || '—');

    let respStr = r.four_m || '—';
    if (r.resp) respStr += `\n${r.resp}`;
    if (r.resp_person) respStr += `\n(${r.resp_person})`;

    const occCause = r.occurrence_cause || r.detailed_observation || r.prod_why_why?.[0] || '—';

    const displayStatus = getIhlrDisplayStatus(r.status, r);
    let statusStr = displayStatus;
    if (r.reviewed_by && r.reviewed_by.trim()) {
      statusStr += `\nReviewed: ${r.reviewed_by.trim()}`;
    }
    if (r.remarks && r.remarks.trim()) {
      statusStr += `\n[${r.remarks.trim()}]`;
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

    return [
      idx + 1,
      String(r.req_no).startsWith('IHLR-') ? r.req_no : `#${r.req_no}`,
      `${formatDateDDMMYYYY(r.batch_date)}\n${formatIhlrShiftDisplay(r.shift, true)}`,
      r.problem || '—',
      `${r.model || '—'}\n(${r.actual_qty ? `${r.actual_qty} Nos` : '1 Nos'})`,
      r.problem_detected_at || '—',
      r.received_from || '—',
      r.analysis_done_by || '—',
      fileCellText,
      respStr,
      occCause,
      actionStr,
      targetDateStr,
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
      0: { cellWidth: 22, halign: 'center' },
      1: { cellWidth: 46, fontStyle: 'bold', halign: 'center' },
      2: { cellWidth: 56, halign: 'center' },
      3: { cellWidth: 76 },
      4: { cellWidth: 54 },
      5: { cellWidth: 50 },
      6: { cellWidth: 50 },
      7: { cellWidth: 50 },
      8: { cellWidth: 62, minCellHeight: 36, halign: 'center', valign: 'middle' },
      9: { cellWidth: 56, halign: 'center' },
      10: { cellWidth: 68 },
      11: { cellWidth: 78 },
      12: { cellWidth: 56, halign: 'center' },
      13: { cellWidth: 62, halign: 'center', fontStyle: 'bold' }
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252] // slate-50
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 13) {
        const text = String(data.cell.raw || '');
        if (text.startsWith('CLOSED')) {
          data.cell.styles.textColor = [22, 101, 52]; // emerald-700
          data.cell.styles.fontStyle = 'bold';
        } else if (text.startsWith('AWAITING REVIEW') || text.startsWith('APPROVAL PENDING')) {
          data.cell.styles.textColor = [180, 83, 9]; // amber-700
          data.cell.styles.fontStyle = 'bold';
        } else {
          data.cell.styles.textColor = [225, 29, 72]; // rose-600
          data.cell.styles.fontStyle = 'bold';
        }
      }
    },
    didDrawCell: (data) => {
      if (data.section === 'body' && data.column.index === 8) {
        const imgObj = rowImages[data.row.index];
        if (imgObj && imgObj.dataUrl) {
          try {
            const padding = 2;
            const cellW = data.cell.width - padding * 2;
            const cellH = data.cell.height - padding * 2;
            const imgW = Math.min(cellW, 56);
            const imgH = Math.min(cellH, 30);
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

  const targetFileName = fileName || `IHLR_Analysis_Report_${today}.pdf`;
  doc.save(targetFileName.endsWith('.pdf') ? targetFileName : `${targetFileName}.pdf`);
};
