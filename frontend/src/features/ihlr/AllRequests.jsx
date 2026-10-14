import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Download,
  Search,
  Filter,
  Eye,
  X,
  AlertCircle,
  CheckCircle2,
  Hourglass,
  Layers,
  Plus,
  ExternalLink,
  ChevronDown,
  Paperclip,
  FileSpreadsheet,
  FileText,
  Clock,
  Check,
  Calendar,
  RotateCcw,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ihlrService } from '../../services/ihlrService';
import { IhlrAttachmentThumbnail, parseAttachments } from './IhlrAttachmentView';
import { fetchAttachmentImageBase64 } from '../../components/common/attachmentUtils';
import IhlrRequestDetailsModal from './IhlrRequestDetailsModal';
import IhlrAttachmentPreviewModal from './IhlrAttachmentPreviewModal';
import ExportSelectionModal from '../../components/common/ExportSelectionModal';
import DateInput from '../../components/common/DateInput';
import { useAuth } from '../../hooks/useAuth';
import { useModal } from '../../context/ModalContext';
import { formatDateDDMMYYYY } from '../../utils/dateUtils';
import { isIhlrRequestVisibleToUser } from '../../utils/ihlrAuthUtils';
import { IHLR_SHIFTS, formatIhlrShiftDisplay, getIhlrShiftDetails } from '../../utils/constants';
import nipponLogo from '../../assets/Nippon Logo.png';

// Helper to convert company logo to Base64 for jsPDF embedding
const loadLogoBase64 = async () => {
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

const IhlrAllRequests = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { confirm: modalConfirm, error: modalError, warning: modalWarning } = useModal();

  const userDept = (user?.department || (() => {
    try {
      const u = sessionStorage.getItem('todo_user') || localStorage.getItem('todo_user');
      return u ? JSON.parse(u)?.department : '';
    } catch {
      return '';
    }
  })() || '').trim().toUpperCase();

  const userRole = (user?.role || '').trim().toUpperCase();
  const isIncomingQuality = userDept === 'INCOMING QUALITY';
  const isAdmin = userRole === 'ADMIN' || isIncomingQuality;
  const canCreate = isIncomingQuality || isAdmin;

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters (including date range filter like dashboard)
  const currentYear = new Date().getFullYear();
  const defaultStartDate = `${currentYear}-01-01`;
  const defaultEndDate = `${currentYear}-12-31`;

  const [search, setSearch] = useState(location.state?.search || '');
  const [selectedShift, setSelectedShift] = useState('All');
  const [selected4M, setSelected4M] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState(location.state?.filterStatus || 'All');
  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState(defaultEndDate);
  const [showFilters, setShowFilters] = useState(
    Boolean(location.state?.search || (location.state?.filterStatus && location.state.filterStatus !== 'All'))
  );

  const isDefaultYear = startDate === defaultStartDate && endDate === defaultEndDate;
  const hasActiveFilters =
    selectedShift !== 'All' ||
    selected4M !== 'All' ||
    selectedStatus !== 'All' ||
    !isDefaultYear ||
    Boolean((search || '').trim());

  const handleResetFilters = () => {
    setSearch('');
    setSelectedShift('All');
    setSelected4M('All');
    setSelectedStatus('All');
    setStartDate(defaultStartDate);
    setEndDate(defaultEndDate);
  };

  useEffect(() => {
    if (location.state?.filterStatus) {
      setSelectedStatus(location.state.filterStatus);
    }
    if (location.state?.search) {
      setSearch(location.state.search);
    }
  }, [location.state]);

  // Modal State
  const [activeModalRequest, setActiveModalRequest] = useState(null);
  const [modalInitialEdit, setModalInitialEdit] = useState(false);
  const [editingCloser, setEditingCloser] = useState(null);
  const [selectedPreviewAttachment, setSelectedPreviewAttachment] = useState(null);

  // Export State
  const [showExportModal, setShowExportModal] = useState(false);

  // Pagination State (matching Approvals tab with max 10)
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  // Reset to page 1 on filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search, selectedShift, selected4M, selectedStatus, startDate, endDate]);

  const totalRecords = requests.length;
  const totalPages = Math.ceil(totalRecords / rowsPerPage) || 1;
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = Math.min(startIndex + rowsPerPage, totalRecords);
  const paginatedRequests = requests.slice(startIndex, endIndex);

  // Open Export Modal with empty check
  const handleOpenExportModal = () => {
    if (!requests || requests.length === 0) {
      modalWarning('No data available to export. Please adjust your filters or search criteria.', 'No Data Available');
      return;
    }
    setShowExportModal(true);
  };

  const isImageAttachment = (att) => {
    if (!att) return false;
    if (att.isImage) return true;
    const n = att.name || att.filename || (typeof att === 'string' ? att : '');
    const ext = (n.split('.').pop() || '').toLowerCase();
    return ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg'].includes(ext);
  };

  // Export to Excel (.xlsx)
  const handleExportExcel = async () => {
    try {
      if (!requests || requests.length === 0) {
        modalWarning('No data available to export. Cannot download an empty file.', 'No Data Available');
        setShowExportModal(false);
        return;
      }

      // Preload image thumbnails for rows that contain an image
      const rowImages = await Promise.all(
        requests.map(async (r) => {
          const defectFiles = parseAttachments(r.defect_image);
          const firstImg = defectFiles.find(isImageAttachment);
          if (!firstImg) return null;
          return await fetchAttachmentImageBase64(firstImg, 'ihlr');
        })
      );

      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'India Nippon Electricals Limited';
      workbook.created = new Date();

      const worksheet = workbook.addWorksheet('IHLR Analysis Log', {
        views: [{ showGridLines: true }]
      });

      // 31 Columns configuration
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
        // 22-29: CLOSER (Production Containment)
        20, // 22: PROD WHY 1
        20, // 23: PROD WHY 2
        20, // 24: PROD WHY 3
        20, // 25: PROD WHY 4
        20, // 26: PROD WHY 5
        32, // 27: CONTAINMENT ACTION
        14, // 28: TARGET DATE
        28, // 29: CLOSER EVIDENCE / ATTACHMENTS
        // 30-31: REMARKS & STATUS
        24, // 30: REMARKS
        14  // 31: STATUS
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

      worksheet.mergeCells('V1:AC1');
      const superCloser = worksheet.getCell('V1');
      superCloser.value = 'CLOSER (PRODUCTION CONTAINMENT)';
      superCloser.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FF7C2D12' } }; // orange-900
      superCloser.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEDD5' } }; // orange-100
      superCloser.alignment = { vertical: 'middle', horizontal: 'center' };

      worksheet.mergeCells('AD1:AE1');
      const superStatus = worksheet.getCell('AD1');
      superStatus.value = 'REMARKS & STATUS';
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
        // 22-29 Closer
        'PROD WHY 1', 'PROD WHY 2', 'PROD WHY 3', 'PROD WHY 4', 'PROD WHY 5',
        'CONTAINMENT ACTION', 'TARGET DATE', 'CLOSER EVIDENCE / ATTACHMENTS',
        // 30-31 Remarks & Status
        'REMARKS', 'STATUS'
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
          // Requestor Sub-Header
          cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF78350F' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDE68A' } }; // amber-200
        } else if (colNum <= 29) {
          // Closer Sub-Header
          cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF7C2D12' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFED7AA' } }; // orange-200
        } else {
          // Remarks & Status Sub-Header
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

      requests.forEach((r, idx) => {
        const defectFiles = parseAttachments(r.defect_image);
        const evidenceFiles = parseAttachments(r.evidence_attachment);
        const imgObj = rowImages[idx];
        const rowNum = idx + 3;

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

          // 22-29 Closer
          r.prod_why_why?.[0] || '—',
          r.prod_why_why?.[1] || '—',
          r.prod_why_why?.[2] || '—',
          r.prod_why_why?.[3] || '—',
          r.prod_why_why?.[4] || '—',
          r.action || '—',
          formatDateDDMMYYYY(r.target_date),
          evidenceFiles.map((a) => a.name).join(', ') || 'None',

          // 30-31 Remarks & Status
          r.remarks || '—',
          r.status || 'OPEN'
        ];

        const row = worksheet.addRow(rowData);
        row.height = imgObj ? 56 : 24;

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
        row.getCell(28).alignment = { vertical: 'middle', horizontal: 'center' }; // TARGET DATE
        row.getCell(31).alignment = { vertical: 'middle', horizontal: 'center' }; // STATUS

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
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `IHLR_Analysis_Report_${today}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);

      setShowExportModal(false);
    } catch (err) {
      console.error('Failed to export to Excel:', err);
      modalError('Failed to export to Excel: ' + err.message);
    }
  };

  // Export to PDF (.pdf) with Company Logo, Super Headings, and ALL Data Columns
  const handleExportPdf = async () => {
    try {
      if (!requests || requests.length === 0) {
        modalWarning('No data available to export. Cannot download an empty file.', 'No Data Available');
        setShowExportModal(false);
        return;
      }

      // Preload image thumbnails for rows that contain an image
      const rowImages = await Promise.all(
        requests.map(async (r) => {
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
          // Embed official INEL circular logo (42x42 pt)
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
      doc.text('IHLR Analysis Log & Rejection Reports', textStartX, 44);

      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139); // slate-500
      doc.text(
        `Generated: ${today} | Range: ${startDate || 'All'} to ${endDate || 'All'} | Total Records: ${requests.length} | Shift: ${selectedShift} | 4M: ${selected4M} | Status: ${selectedStatus}`,
        textStartX,
        56
      );

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

      const tableRows = requests.map((r, idx) => {
        const defectFiles = parseAttachments(r.defect_image);
        const imgObj = rowImages[idx];
        const fileCellText = imgObj?.dataUrl
          ? ''
          : (defectFiles.map((a) => a.name).join(', ') || '—');

        let respStr = r.four_m || '—';
        if (r.resp) respStr += `\n${r.resp}`;
        if (r.resp_person) respStr += `\n(${r.resp_person})`;

        const occCause = r.occurrence_cause || r.detailed_observation || r.prod_why_why?.[0] || '—';

        let statusStr = (r.status || 'OPEN').replace(/_/g, ' ');
        if (r.remarks && r.remarks.trim()) {
          statusStr += `\n[${r.remarks.trim()}]`;
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
          r.action || '—',
          formatDateDDMMYYYY(r.target_date) || '—',
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
          13: { cellWidth: 58, halign: 'center', fontStyle: 'bold' }
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252] // slate-50
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

      doc.save(`IHLR_Analysis_Report_${today}.pdf`);
      setShowExportModal(false);
    } catch (err) {
      console.error('Failed to export to PDF:', err);
      modalError('Failed to export to PDF: ' + err.message);
    }
  };

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const filters = {};
      if (search && search.trim()) filters.search = search.trim();
      if (selectedShift !== 'All') filters.shift = selectedShift;
      if (selected4M !== 'All') filters.fourM = selected4M;
      if (selectedStatus !== 'All') filters.status = selectedStatus;
      if (startDate) filters.startDate = startDate;
      if (endDate) filters.endDate = endDate;

      const data = await ihlrService.getRequests(filters);
      setRequests(data);
    } catch (err) {
      console.error('Failed to fetch IHLR requests:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();

    let debounceTimer = null;
    const handleLiveUpdate = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        fetchRequests();
      }, 150);
    };

    window.addEventListener('ihlrLiveUpdate', handleLiveUpdate);

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      window.removeEventListener('ihlrLiveUpdate', handleLiveUpdate);
    };
  }, [search, selectedShift, selected4M, selectedStatus, startDate, endDate, user?.name, user?.email, user?.role, user?.department]);

  const handleUpdateStatus = async (id, newStatus, actionUpdate) => {
    try {
      const target = requests.find((r) => r.id === id);
      if (!isAdmin && target && target.status === 'CLOSED') {
        modalError('This incident is closed. Only Admin can update closed reports.');
        return;
      }
      await ihlrService.updateRequest(id, {
        status: newStatus,
        action: actionUpdate !== undefined ? actionUpdate : undefined,
        user: user ? {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          department: user.department
        } : undefined
      });
      fetchRequests();
      if (activeModalRequest && activeModalRequest.id === id) {
        setActiveModalRequest(prev => ({ ...prev, status: newStatus, action: actionUpdate || prev.action }));
      }
      setEditingCloser(null);
    } catch (err) {
      modalError('Failed to update status: ' + err.message);
    }
  };

  const handleDelete = async (id, reqNo) => {
    const isConfirmed = await modalConfirm(`Are you sure you want to delete IHLR report #${reqNo}?`);
    if (isConfirmed) {
      try {
        await ihlrService.deleteRequest(id);
        fetchRequests();
        if (activeModalRequest?.id === id) setActiveModalRequest(null);
      } catch (err) {
        modalError('Failed to delete report: ' + err.message);
      }
    }
  };

  const getStatusBadge = (status, req) => {
    const s = (status || '').toUpperCase();
    if (s === 'CLOSED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          CLOSED
        </span>
      );
    }
    const isCompleted = s === 'IN_PROGRESS' || s === 'IN-PROGRESS' || s === 'APPROVAL_PENDING' || s === 'APPROVAL PENDING' || (req && (
      Boolean(req.action && String(req.action).trim()) ||
      Boolean(req.target_date) ||
      (Array.isArray(req.prod_why_why) && req.prod_why_why.some(w => Boolean(w && String(w).trim())))
    ));

    if (isCompleted) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200 whitespace-nowrap">
          <Clock className="w-3 h-3 text-amber-600" />
          APPROVAL PENDING
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200 whitespace-nowrap">
        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
        PENDING
      </span>
    );
  };

  return (
    <div className="space-y-6 w-full pb-16">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
            <span className="text-blue-600 font-bold uppercase tracking-wider font-mono">IHLR REPOSITORY</span>
            <span>/</span>
            <span>Analysis Reports</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              All Requests
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Comprehensive spreadsheet view of in-house line rejections, 5-Why root-causes, and containment actions.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {canCreate && (
            <button
              onClick={() => navigate('/ihlr/create-request')}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/20 transition transform active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create New Report</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar (matching Dashboard filter styling) */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-2xs space-y-3.5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-xs font-black uppercase tracking-tight text-slate-800 flex items-center gap-1.5">
              <SlidersHorizontal className="w-3.5 h-3.5 text-blue-600" />
              <span>Filter Analysis Reports</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs">
              <Calendar className="w-3 h-3 text-blue-600" />
              <span>{isDefaultYear ? `Data on Current Year (${currentYear})` : hasActiveFilters ? 'Active Custom Filter' : 'All Data'}</span>
            </span>
            <button
              type="button"
              onClick={() => setShowFilters((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs border ${
                showFilters
                  ? 'bg-blue-600 text-white border-blue-600 shadow-blue-500/25 ring-2 ring-blue-500/20'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200/90 hover:border-slate-300'
              }`}
              title={showFilters ? 'Hide filter controls' : 'Show filter controls'}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>{showFilters ? 'Hide Filters' : 'Filter'}</span>
              {hasActiveFilters && !showFilters && (
                <span className="w-2 h-2 rounded-full bg-blue-500 ring-2 ring-white" />
              )}
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${showFilters ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {hasActiveFilters && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100/90 border border-rose-200/90 rounded-xl transition-all active:scale-95 cursor-pointer shadow-2xs"
                title="Clear all active filters"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Filters</span>
              </button>
            </div>
          )}
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 text-xs items-center animate-in fade-in slide-in-from-top-1 duration-200">
            {/* Search */}
            <div className="lg:col-span-3 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5 pointer-events-none" />
              <input
                type="text"
                placeholder="Search problem, model, line, inspector, or Req#..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none font-medium"
              />
            </div>

            {/* Shift Filter */}
            <div className="lg:col-span-2">
              <select
                value={selectedShift}
                onChange={(e) => setSelectedShift(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-semibold focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none cursor-pointer"
              >
                <option value="All">All Shifts</option>
                {IHLR_SHIFTS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            {/* 4M Filter */}
            <div className="lg:col-span-2">
              <select
                value={selected4M}
                onChange={(e) => setSelected4M(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-semibold focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none cursor-pointer"
              >
                <option value="All">All 4M Categories</option>
                <option value="MAN">MAN</option>
                <option value="MACHINE">MACHINE</option>
                <option value="METHOD">METHOD</option>
                <option value="MATERIAL">MATERIAL</option>
              </select>
            </div>

            {/* Status Filter */}
            <div className="lg:col-span-2">
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-semibold focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none cursor-pointer"
              >
                <option value="All">All Statuses</option>
                <option value="OPEN">Pending</option>
                <option value="IN_PROGRESS">Approval Pending</option>
                <option value="CLOSED">Closed</option>
              </select>
            </div>

            {/* Date Range Cluster (Timeline Range like Dashboard) */}
            <div className="lg:col-span-3">
              <div className="flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100/70 focus-within:bg-white border border-slate-200/90 focus-within:border-blue-500 rounded-xl p-1 shadow-2xs focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
                <Calendar className="w-3.5 h-3.5 text-indigo-600 ml-1 shrink-0" />
                <div className="min-w-0 flex-1">
                  <DateInput
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    placeholder="From Date"
                    className="w-full px-1.5 py-1 text-xs font-semibold text-slate-800 bg-transparent border-0 focus:ring-0 outline-none placeholder:text-slate-400"
                  />
                </div>
                <span className="text-slate-400 text-xs font-bold px-0.5 select-none shrink-0">→</span>
                <div className="min-w-0 flex-1">
                  <DateInput
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    placeholder="To Date"
                    className="w-full px-1.5 py-1 text-xs font-semibold text-slate-800 bg-transparent border-0 focus:ring-0 outline-none placeholder:text-slate-400"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* IHLR Analysis Report Master Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-extrabold uppercase tracking-widest text-slate-600 font-mono">
              SEP'26 IHLR- ANALYSIS REPORT
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 font-mono">
              {requests.length} Records
            </span>
          </div>
          <button
            onClick={handleOpenExportModal}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs hover:shadow transition transform active:scale-95 cursor-pointer"
            id="export-view-btn"
          >
            <Download className="w-4 h-4" />
            <span>Export View</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1100px]">
            <thead>
              {/* Top Phase Header Row */}
              <tr className="text-[10px] font-black uppercase tracking-wider text-center border-b border-slate-200">
                <th colSpan={10} className="py-2 px-4 bg-amber-100 text-amber-900 border-r border-amber-200">
                  REQUESTOR (Defect Investigation &amp; QA 5-Why)
                </th>
                <th colSpan={3} className="py-2 px-4 bg-orange-100 text-orange-900 border-r border-orange-200">
                  CLOSER (Production Containment)
                </th>
                <th colSpan={2} className="py-2 px-4 bg-slate-100 text-slate-700">
                  REMARKS &amp; STATUS
                </th>
              </tr>
              {/* Detailed Column Header Row */}
              <tr className="bg-[#f8fafc] border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3 px-3 text-center w-12">SL NO</th>
                <th className="py-3 px-3">REQ NO</th>
                <th className="py-3 px-3">DATE / SHIFT</th>
                <th className="py-3 px-4">PROBLEM</th>
                <th className="py-3 px-3">MODEL</th>
                <th className="py-3 px-3">DETECTED AT</th>
                <th className="py-3 px-3">RECEIVED FROM</th>
                <th className="py-3 px-3">ANALYSIS BY</th>
                <th className="py-3 px-2 text-center w-12">DEFECT</th>
                <th className="py-3 px-2 text-center">4M / RESP</th>
                <th className="py-3 px-4">OCCURRENCE CAUSE</th>
                <th className="py-3 px-4">ACTION TAKEN</th>
                <th className="py-3 px-3">TARGET DATE</th>
                <th className="py-3 px-3">STATUS</th>
                <th className="py-3 px-3 text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {paginatedRequests.length === 0 ? (
                <tr>
                  <td colSpan={15} className="py-12 text-center text-slate-400">
                    <AlertCircle className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="font-semibold text-slate-600">
                      No IHLR Reports match your filter
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Try resetting search parameters or check other filters.
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedRequests.map((r, index) => (
                  <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* SL NO */}
                    <td className="py-3.5 px-3 text-center font-mono font-semibold text-slate-400">
                      {startIndex + index + 1}
                    </td>

                    {/* Req NO */}
                    <td className="py-3.5 px-3 font-mono font-bold text-blue-600 whitespace-nowrap">
                      {String(r.req_no).startsWith('IHLR-') ? r.req_no : `#${r.req_no}`}
                    </td>

                    {/* Date / Shift */}
                    <td className="py-3.5 px-3 whitespace-nowrap">
                      <div className="font-semibold text-slate-900">
                        {formatDateDDMMYYYY(r.batch_date)}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] font-bold text-slate-600 font-mono">
                          {formatIhlrShiftDisplay(r.shift)}
                        </span>
                        {getIhlrShiftDetails(r.shift)?.timing && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-500 font-mono border border-slate-200">
                            {getIhlrShiftDetails(r.shift).timing}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Problem */}
                    <td className="py-3.5 px-4 font-semibold text-slate-900 min-w-[150px]">
                      {r.problem}
                    </td>

                    {/* Model */}
                    <td className="py-3.5 px-3 font-bold text-blue-700 whitespace-nowrap">
                      {r.model}
                    </td>

                    {/* Problem Detected At */}
                    <td className="py-3.5 px-3 text-slate-700">
                      {r.problem_detected_at}
                    </td>

                    {/* Received From */}
                    <td className="py-3.5 px-3 font-mono text-slate-600">
                      {r.received_from}
                    </td>

                    {/* Analysis Done By */}
                    <td className="py-3.5 px-3 font-medium text-slate-800">
                      {r.analysis_done_by}
                    </td>

                    {/* Defect Attachment Thumbnail (Display only - No modal on click) */}
                    <td className="py-3.5 px-2 text-center">
                      <div className="flex items-center justify-center">
                        <IhlrAttachmentThumbnail
                          rawAttachment={r.defect_image}
                        />
                      </div>
                    </td>

                    {/* 4M & Resp */}
                    <td className="py-3.5 px-2 text-center whitespace-nowrap">
                      <div className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold font-mono bg-amber-50 text-amber-800 border border-amber-200 mb-0.5">
                        {r.four_m || 'MAN'}
                      </div>
                      <div className="text-[10px] font-bold text-slate-600 font-mono">
                        {r.resp || '-'}
                      </div>
                      {r.resp_person && (
                        <div className="text-[9px] text-blue-600 font-semibold truncate max-w-[110px]" title={r.resp_person}>
                          {r.resp_person}
                        </div>
                      )}
                    </td>

                    {/* Occurrence Cause (First Why) */}
                    <td className="py-3.5 px-4 text-slate-600 max-w-[160px] truncate" title={r.prod_why_why?.[0]}>
                      {r.prod_why_why?.[0] || '—'}
                    </td>

                    {/* Action Taken */}
                    <td className="py-3.5 px-4 text-slate-800 font-medium max-w-[180px] truncate" title={r.action}>
                      {r.action || '—'}
                    </td>

                    {/* Target Date */}
                    <td className="py-3.5 px-3 text-slate-600 font-mono text-[11px] whitespace-nowrap">
                      {r.target_date || '—'}
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-3">
                      {getStatusBadge(r.status, r)}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => {
                            setActiveModalRequest(r);
                            setModalInitialEdit(false);
                          }}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                          title="View Complete Report"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="p-3.5 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-end gap-4 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <span>Rows per page:</span>
            <select
              value={rowsPerPage}
              onChange={(e) => {
                setRowsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold outline-none cursor-pointer"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
            </select>
          </div>

          <div className="font-mono text-[11px] text-slate-500">
            {totalRecords === 0
              ? '0–0 of 0'
              : `${startIndex + 1}–${endIndex} of ${totalRecords}`}
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
              title="Previous Page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
              title="Next Page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Complete Inspection & Edit Modal */}
      <IhlrRequestDetailsModal
        isOpen={Boolean(activeModalRequest)}
        request={activeModalRequest}
        initialEditMode={modalInitialEdit}
        onClose={() => {
          setActiveModalRequest(null);
          setModalInitialEdit(false);
        }}
        onUpdated={() => {
          fetchRequests();
        }}
      />

      {/* Standalone Attachment Preview Modal (when clicking table thumbnail directly) */}
      <IhlrAttachmentPreviewModal
        isOpen={Boolean(selectedPreviewAttachment)}
        attachment={selectedPreviewAttachment}
        onClose={() => setSelectedPreviewAttachment(null)}
      />

      {/* Edit Closer & Status Modal */}
      {editingCloser && createPortal(
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          style={{ zIndex: 99990 }}
          onClick={() => setEditingCloser(null)}
        >
          <div 
            className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-slate-200 p-6 space-y-4 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                Update Report {String(editingCloser.req_no).startsWith('IHLR-') ? editingCloser.req_no : `#${editingCloser.req_no}`}
              </h3>
              <button
                onClick={() => setEditingCloser(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1 text-[11px]">
                  Status
                </label>
                <select
                  disabled={!isAdmin && editingCloser.status === 'CLOSED'}
                  defaultValue={editingCloser.status}
                  id="modal-status-select"
                  className={`w-full px-3 py-2 border rounded-xl font-bold text-slate-900 outline-none ${!isAdmin && editingCloser.status === 'CLOSED'
                      ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed select-none'
                      : 'bg-slate-50 border-slate-200'
                    }`}
                >
                  {isAdmin ? (
                    <>
                      <option value="OPEN">OPEN</option>
                      <option value="IN_PROGRESS">IN PROGRESS</option>
                      <option value="CLOSED">CLOSED</option>
                    </>
                  ) : editingCloser.status === 'CLOSED' ? (
                    <option value="CLOSED">CLOSED (FINALIZED)</option>
                  ) : (
                    <>
                      <option value="IN_PROGRESS">IN PROGRESS</option>
                      <option value="CLOSED">CLOSED</option>
                    </>
                  )}
                </select>
                {!isAdmin && editingCloser.status === 'CLOSED' && (
                  <p className="text-[10px] text-emerald-600 font-semibold mt-1">
                    This incident is closed. Only Admin can update status again.
                  </p>
                )}
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1 text-[11px]">
                  Action Countermeasure
                </label>
                <textarea
                  rows={3}
                  disabled={!isAdmin && editingCloser.status === 'CLOSED'}
                  defaultValue={editingCloser.action}
                  id="modal-action-text"
                  placeholder="Describe corrective actions performed..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 outline-none disabled:bg-slate-100 disabled:text-slate-400"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingCloser(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
              >
                Cancel
              </button>
              {!isAdmin && editingCloser.status === 'CLOSED' ? (
                <span className="text-xs text-slate-400 italic py-2">
                  Updates locked for closed records (Admin only)
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    const s = document.getElementById('modal-status-select').value;
                    const a = document.getElementById('modal-action-text').value;
                    handleUpdateStatus(editingCloser.id, s, a);
                  }}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-sm cursor-pointer"
                >
                  Save Changes
                </button>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Export Format Selection Modal */}
      {/* Export Selection Modal */}
      <ExportSelectionModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        onExportExcel={handleExportExcel}
        onExportPdf={handleExportPdf}
        title="Export Analysis Report"
        subtitle="Choose download format for current view"
        recordCount={requests.length}
        excelDescription="Full structured workbook with separate columns for 5-Why root-causes, containment actions, and target dates."
        pdfDescription="Official landscape document formatted with India Nippon Electricals Limited branding, tables, and page numbers."
      />
    </div>
  );
};

export default IhlrAllRequests;
