import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, 
  AlertCircle, 
  CheckCircle2, 
  Layers, 
  Eye,
  Filter,
  Calendar,
  Building2,
  RotateCcw,
  X,
  Clock,
  SlidersHorizontal,
  ChevronDown,
  Sparkles,
  Download
} from 'lucide-react';
import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ihlrService } from '../../services/ihlrService';
import { IhlrAttachmentThumbnail, parseAttachments } from './IhlrAttachmentView';
import { fetchAttachmentImageBase64 } from '../../components/common/attachmentUtils';
import IhlrAttachmentPreviewModal from './IhlrAttachmentPreviewModal';
import IhlrRequestDetailsModal from './IhlrRequestDetailsModal';
import ExportSelectionModal from '../../components/common/ExportSelectionModal';
import DateInput from '../../components/common/DateInput';
import { useAuth } from '../../hooks/useAuth';
import { useModal } from '../../context/ModalContext';
import { formatDateDDMMYYYY } from '../../utils/dateUtils';
import { DEPARTMENTS, formatIhlrShiftDisplay, getIhlrShiftDetails } from '../../utils/constants';
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

const IhlrDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { warning: modalWarning, error: modalError } = useModal();

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

  const [stats, setStats] = useState({
    total: 0,
    open: 0,
    inProgress: 0,
    closed: 0,
    fourMBreakdown: { MAN: 0, MACHINE: 0, METHOD: 0, MATERIAL: 0 },
    recentRequests: []
  });
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [selectedPreviewAttachment, setSelectedPreviewAttachment] = useState(null);

  // Department & Date Filters State (Defaults to Current Year)
  const currentYear = new Date().getFullYear();
  const defaultStartDate = `${currentYear}-01-01`;
  const defaultEndDate = `${currentYear}-12-31`;

  const [selectedDept, setSelectedDept] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState(defaultEndDate);
  const [showFilters, setShowFilters] = useState(false);

  const isDefaultYear = startDate === defaultStartDate && endDate === defaultEndDate;
  const hasActiveFilters = selectedDept !== 'All' || selectedStatus !== 'All' || !isDefaultYear;

  const loadData = async (overrides = {}) => {
    setLoading(true);
    try {
      const activeDept = overrides.selectedDept !== undefined ? overrides.selectedDept : selectedDept;
      const activeStatus = overrides.selectedStatus !== undefined ? overrides.selectedStatus : selectedStatus;
      const activeStart = overrides.startDate !== undefined ? overrides.startDate : startDate;
      const activeEnd = overrides.endDate !== undefined ? overrides.endDate : endDate;

      const filters = {};
      if (activeDept && activeDept !== 'All') {
        filters.resp = activeDept;
      }
      if (activeStatus && activeStatus !== 'All') {
        filters.status = activeStatus;
      }
      if (activeStart) {
        filters.startDate = activeStart;
      }
      if (activeEnd) {
        filters.endDate = activeEnd;
      }

      const data = await ihlrService.getDashboardStats(filters);
      setStats(data);
    } catch (err) {
      console.error('Failed to load IHLR dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    let debounceTimer = null;
    const handleLiveUpdate = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        loadData();
      }, 150);
    };

    window.addEventListener('ihlrLiveUpdate', handleLiveUpdate);

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      window.removeEventListener('ihlrLiveUpdate', handleLiveUpdate);
    };
  }, [user?.name, user?.email, user?.role, user?.department, selectedDept, selectedStatus, startDate, endDate]);

  const handleResetFilters = () => {
    setSelectedDept('All');
    setSelectedStatus('All');
    setStartDate(defaultStartDate);
    setEndDate(defaultEndDate);
  };

  // Export State
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  const isImageAttachment = (att) => {
    if (!att) return false;
    if (att.isImage) return true;
    const n = att.name || att.filename || (typeof att === 'string' ? att : '');
    const ext = (n.split('.').pop() || '').toLowerCase();
    return ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg'].includes(ext);
  };

  const fetchDashboardExportData = async () => {
    const filters = {};
    if (selectedDept && selectedDept !== 'All') {
      filters.resp = selectedDept;
    }
    if (selectedStatus && selectedStatus !== 'All') {
      filters.status = selectedStatus;
    }
    if (startDate) {
      filters.startDate = startDate;
    }
    if (endDate) {
      filters.endDate = endDate;
    }
    const data = await ihlrService.getRequests(filters);
    return Array.isArray(data) && data.length > 0 ? data : (stats.recentRequests || []);
  };

  const handleOpenExportModal = () => {
    if ((stats.total || 0) === 0 && (stats.recentRequests || []).length === 0) {
      modalWarning('No data available to export. Please adjust your filters or create an issue.', 'No Data Available');
      return;
    }
    setShowExportModal(true);
  };

  // Export to Excel (.xlsx)
  const handleExportExcel = async () => {
    try {
      setExportLoading(true);
      const requests = await fetchDashboardExportData();
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

      const worksheet = workbook.addWorksheet('IHLR Dashboard Report', {
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
        // 22-29: CLOSER (Production Containment)
        20, // 22: PROD WHY 1
        20, // 23: PROD WHY 2
        20, // 24: PROD WHY 3
        20, // 25: PROD WHY 4
        20, // 26: PROD WHY 5
        32, // 27: CONTAINMENT ACTION
        14, // 28: TARGET DATE
        28, // 29: CLOSER EVIDENCE / ATTACHMENTS
        // 30-31: REASSIGNMENT TRACKING
        16, // 30: REASSIGNED STATUS
        38, // 31: REASSIGNMENT DETAILS
        // 32-33: REMARKS & STATUS
        24, // 32: REMARKS
        14  // 33: STATUS
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
      const superReassign = worksheet.getCell('AD1');
      superReassign.value = 'REASSIGNMENT TRACKING';
      superReassign.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FF4C1D95' } }; // violet-900
      superReassign.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDE9FE' } }; // violet-100
      superReassign.alignment = { vertical: 'middle', horizontal: 'center' };

      worksheet.mergeCells('AF1:AG1');
      const superStatus = worksheet.getCell('AF1');
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
        // 30-31 Reassignment Tracking
        'REASSIGNED STATUS', 'REASSIGNMENT DETAILS',
        // 32-33 Remarks & Status
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
        } else if (colNum <= 31) {
          // Reassignment Tracking Sub-Header
          cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF4C1D95' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDDD6FE' } }; // violet-200
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

        let reassignList = r.reassignment_history;
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

          // 30-31 Reassignment Tracking
          reassignedStatus,
          reassignmentDetails,

          // 32-33 Remarks & Status
          r.remarks || '—',
          r.status || 'OPEN'
        ];

        const row = worksheet.addRow(rowData);
        row.height = imgObj ? 56 : (hasReassignments && reassignList.length > 1 ? Math.max(36, reassignList.length * 18) : 24);

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
        row.getCell(30).alignment = { vertical: 'middle', horizontal: 'center' }; // REASSIGNED STATUS
        row.getCell(33).alignment = { vertical: 'middle', horizontal: 'center' }; // STATUS

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
      link.download = `IHLR_Dashboard_Report_${today}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);

      setShowExportModal(false);
    } catch (err) {
      console.error('Failed to export to Excel:', err);
      modalError('Failed to export to Excel: ' + err.message);
    } finally {
      setExportLoading(false);
    }
  };

  // Export to PDF (.pdf) with Company Logo, Super Headings, and ALL Data Columns
  const handleExportPdf = async () => {
    try {
      setExportLoading(true);
      const requests = await fetchDashboardExportData();
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
      doc.text('IHLR Dashboard Summary & Analysis Reports', textStartX, 44);

      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139); // slate-500
      doc.text(
        `Generated: ${today} | Range: ${startDate || 'All'} to ${endDate || 'All'} | Total Records: ${requests.length} | Dept: ${selectedDept} | Status: ${selectedStatus}`,
        textStartX,
        56
      );

      // Right-aligned Document Label
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(148, 163, 184); // slate-400
      doc.text('IHLR DASHBOARD EXPORT LOG', doc.internal.pageSize.width - 24, 30, { align: 'right' });

      // Super Headings & Full Detailed Column Headers
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

      doc.save(`IHLR_Dashboard_Report_${today}.pdf`);
      setShowExportModal(false);
    } catch (err) {
      console.error('Failed to export to PDF:', err);
      modalError('Failed to export to PDF: ' + err.message);
    } finally {
      setExportLoading(false);
    }
  };

  const departmentOptions = Array.from(
    new Set([
      ...DEPARTMENTS,
      ...(stats?.recentRequests || []).map(r => (r.resp || '').trim().toUpperCase()).filter(Boolean)
    ])
  ).sort();

  const kpis = [
    {
      title: 'Total Issues',
      value: stats.total || 0,
      subtitle: hasActiveFilters ? 'Filtered line rejections' : 'Recorded line rejections',
      icon: Layers,
      iconBg: 'bg-blue-50 text-blue-600',
      subtitleColor: 'text-blue-600',
    },
    {
      title: 'Pending',
      value: stats.open !== undefined ? stats.open : (stats.pending || 0),
      subtitle: hasActiveFilters ? 'Filtered pending' : 'Awaiting root cause closer actions',
      icon: AlertCircle,
      iconBg: 'bg-rose-50 text-rose-600',
      subtitleColor: 'text-rose-600',
    },
    {
      title: 'Approval Pending',
      value: stats.inProgress || 0,
      subtitle: hasActiveFilters ? 'Filtered approval pending' : 'Awaiting Admin Sign-off & Closure',
      icon: Clock,
      iconBg: 'bg-amber-50 text-amber-600',
      subtitleColor: 'text-amber-600',
    },
    {
      title: 'Closed',
      value: stats.closed || 0,
      subtitle: hasActiveFilters ? 'Filtered verified closures' : 'Verified by Quality',
      icon: CheckCircle2,
      iconBg: 'bg-emerald-50 text-emerald-600',
      subtitleColor: 'text-emerald-600',
    },
  ];

  const getStatusBadge = (status, req) => {
    const s = (status || '').toUpperCase();
    if (s === 'CLOSED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
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
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
          <Clock className="w-3 h-3 text-amber-600" />
          APPROVAL PENDING
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
        PENDING
      </span>
    );
  };

  return (
    <div className="space-y-6 w-full pb-12">
      {/* Page Title & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
            <span className="text-blue-600 font-bold uppercase tracking-wider font-mono">IHLR PORTAL</span>
            <span>/</span>
            <span>Overview Dashboard</span>
            <span>/</span>
            <span className="font-bold text-slate-700">Data on Current Year ({currentYear})</span>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              IHLR Analysis Dashboard
            </h1>
            {!isAdmin && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                Assigned to: <strong>{user?.name || user?.email}</strong>
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            {isAdmin
              ? 'In-House Line Rejection monitoring, 4M root-cause Why-Why tracking, and corrective action containment.'
              : `Overview of IHLR issues assigned to you (${user?.name || user?.email}).`}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleOpenExportModal}
            className="flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/90 hover:border-slate-300 rounded-xl text-xs font-bold shadow-2xs hover:shadow-xs transition transform active:scale-95 cursor-pointer"
            id="dashboard-export-btn"
            title="Export filtered IHLR reports to Excel or PDF"
          >
            <Download className="w-4 h-4 text-blue-600" />
            <span>Export View</span>
          </button>

          {canCreate && (
            <button
              onClick={() => navigate('/ihlr/create-request')}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/20 transition transform active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create IHLR Issue</span>
            </button>
          )}
        </div>
      </div>

      {/* Ultra-Modern Filter Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-sm transition-all duration-300 relative overflow-hidden">
        {/* Subtle accent highlight at top edge */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-500 via-indigo-500 to-sky-400" />

        <div className="p-4 sm:p-5 space-y-3.5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Header with gradient badge */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20 ring-4 ring-blue-50 shrink-0">
                <SlidersHorizontal className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-sm font-black uppercase tracking-tight text-slate-800">
                    Filter Analysis Reports
                  </h2>
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
                <p className="text-xs text-slate-500 mt-0.5">
                  Filter KPI metrics, 4M breakdown, and recent rejection logs
                </p>
              </div>
            </div>

            {/* Filter Controls Row */}
            {showFilters && (
              <div className="flex flex-wrap items-center gap-3 animate-in fade-in slide-in-from-top-1 duration-200">
                {/* Department Dropdown */}
                <div className="min-w-[190px] flex-1 sm:flex-initial">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-blue-600" />
                    <span>Department</span>
                  </label>
                  <div className="relative">
                    <select
                      value={selectedDept}
                      onChange={(e) => setSelectedDept(e.target.value)}
                      className="w-full appearance-none pl-3.5 pr-8 py-2 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200/90 hover:border-slate-300 focus:border-blue-500 rounded-xl text-xs font-semibold text-slate-800 shadow-2xs focus:ring-4 focus:ring-blue-500/10 outline-none transition-all cursor-pointer"
                    >
                      <option value="All">All Departments</option>
                      {departmentOptions.map((dept) => (
                        <option key={dept} value={dept}>
                          {dept}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>

                {/* Status Dropdown */}
                <div className="min-w-[170px] flex-1 sm:flex-initial">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Status</span>
                  </label>
                  <div className="relative">
                    <select
                      value={selectedStatus}
                      onChange={(e) => setSelectedStatus(e.target.value)}
                      className="w-full appearance-none pl-3.5 pr-8 py-2 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200/90 hover:border-slate-300 focus:border-blue-500 rounded-xl text-xs font-semibold text-slate-800 shadow-2xs focus:ring-4 focus:ring-blue-500/10 outline-none transition-all cursor-pointer"
                    >
                      <option value="All">All Statuses</option>
                      <option value="OPEN">Pending</option>
                      <option value="IN_PROGRESS">Approval Pending</option>
                      <option value="CLOSED">Closed</option>
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>

                {/* Date Range Cluster */}
                <div className="flex-1 sm:flex-initial">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Timeline Range</span>
                    </span>
                    {isDefaultYear && (
                      <span className="text-[10px] font-bold text-blue-600">
                        Current Year {currentYear}
                      </span>
                    )}
                  </label>
                  <div className="flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100/70 focus-within:bg-white border border-slate-200/90 focus-within:border-blue-500 rounded-xl p-1 shadow-2xs focus-within:ring-4 focus-within:ring-blue-500/10 transition-all">
                    <div className="w-[125px]">
                      <DateInput
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        placeholder="From Date"
                        className="w-full px-2 py-1 text-xs font-semibold text-slate-800 bg-transparent border-0 focus:ring-0 outline-none placeholder:text-slate-400"
                      />
                    </div>
                    <span className="text-slate-400 text-xs font-bold px-0.5 select-none">→</span>
                    <div className="w-[125px]">
                      <DateInput
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        placeholder="To Date"
                        className="w-full px-2 py-1 text-xs font-semibold text-slate-800 bg-transparent border-0 focus:ring-0 outline-none placeholder:text-slate-400"
                      />
                    </div>
                  </div>
                </div>

                {/* Reset Button */}
                {hasActiveFilters && (
                  <div className="self-end pb-0.5">
                    <button
                      type="button"
                      onClick={handleResetFilters}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100/90 border border-rose-200/90 rounded-xl transition-all active:scale-95 cursor-pointer shadow-2xs"
                      title="Clear all active filters"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Reset</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Active Badges Row (Only shown when custom filter applied) */}
          {hasActiveFilters && (
            <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-slate-100 text-xs">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Active:</span>

                {selectedDept !== 'All' && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs">
                    <span>Dept: <strong>{selectedDept}</strong></span>
                    <button
                      type="button"
                      onClick={() => setSelectedDept('All')}
                      className="hover:text-blue-900 cursor-pointer p-0.5 rounded hover:bg-blue-100/60 transition-colors"
                      title="Clear department filter"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}

                {selectedStatus !== 'All' && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
                    <span>
                      Status: <strong>{selectedStatus === 'OPEN' ? 'Pending' : selectedStatus === 'IN_PROGRESS' ? 'Approval Pending' : 'Closed'}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedStatus('All')}
                      className="hover:text-emerald-900 cursor-pointer p-0.5 rounded hover:bg-emerald-100/60 transition-colors"
                      title="Clear status filter"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}

                {!isDefaultYear && (Boolean(startDate) || Boolean(endDate)) && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-2xs">
                    <span>
                      {startDate ? formatDateDDMMYYYY(startDate) : 'Start'} → {endDate ? formatDateDDMMYYYY(endDate) : 'End'}
                    </span>
                    <button
                      type="button"
                      onClick={() => { setStartDate(defaultStartDate); setEndDate(defaultEndDate); }}
                      className="hover:text-indigo-900 cursor-pointer p-0.5 rounded hover:bg-indigo-100/60 transition-colors"
                      title="Reset to current year"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}

                {!isDefaultYear && !startDate && !endDate && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200 shadow-2xs">
                    <span>All Time (All Years)</span>
                  </span>
                )}

                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="text-[11px] font-bold text-slate-500 hover:text-rose-600 underline cursor-pointer ml-1"
                >
                  Reset to default
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* KPI Cards Row (Static Overview Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, index) => {
          const Icon = kpi.icon;
          return (
            <div
              key={index}
              className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/90 shadow-2xs select-none"
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">{kpi.title}</span>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${kpi.iconBg}`}>
                  <Icon className="w-5 h-5" />
                </div>
              </div>
              <div>
                <span className="text-3xl font-black text-slate-900 font-mono tracking-tight">{kpi.value}</span>
                <p className={`text-[11px] mt-1 font-semibold ${kpi.subtitleColor || 'text-slate-400'}`}>{kpi.subtitle}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* 4M Distribution Breakdown Banner */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-extrabold uppercase tracking-widest text-slate-400 font-mono">
            4M CLASSIFICATION DISTRIBUTION
          </span>
          <p className="text-xs text-slate-600 mt-0.5">
            Breakdown of root causes by Man, Machine, Method, and Material.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-200 text-xs font-bold text-blue-700">
            <span>MAN:</span>
            <span className="font-mono text-sm">{stats.fourMBreakdown?.MAN || 0}</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-purple-50 border border-purple-200 text-xs font-bold text-purple-700">
            <span>MACHINE:</span>
            <span className="font-mono text-sm">{stats.fourMBreakdown?.MACHINE || 0}</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-xs font-bold text-amber-700">
            <span>METHOD:</span>
            <span className="font-mono text-sm">{stats.fourMBreakdown?.METHOD || 0}</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-700">
            <span>MATERIAL:</span>
            <span className="font-mono text-sm">{stats.fourMBreakdown?.MATERIAL || 0}</span>
          </div>
        </div>
      </div>

      {/* Recent IHLR Analysis Reports Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900">Recent 5 Issues</h2>
              {hasActiveFilters && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                  Filtered
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {hasActiveFilters
                ? 'Displaying recent line rejection issues matching your active filter criteria.'
                : 'Live manufacturing rejection cases with Why-Why analysis & closure actions.'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenExportModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200/90 hover:border-slate-300 shadow-2xs hover:shadow-xs transition cursor-pointer"
              title="Export filtered reports"
            >
              <Download className="w-3.5 h-3.5 text-blue-600" />
              <span>Export View</span>
            </button>
            {hasActiveFilters && (
              <button
                onClick={handleResetFilters}
                className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Clear Filters</span>
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#f8fafc] border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3.5 px-4 text-center w-14">SL NO</th>
                <th className="py-3.5 px-4">ISSUE NO</th>
                <th className="py-3.5 px-4">DATE / SHIFT</th>
                <th className="py-3.5 px-6">PROBLEM &amp; MODEL</th>
                <th className="py-3.5 px-4">STAGE &amp; LINE</th>
                <th className="py-3.5 px-2 text-center w-14">DEFECT</th>
                <th className="py-3.5 px-4 text-center">4M</th>
                <th className="py-3.5 px-4">RESP</th>
                <th className="py-3.5 px-4">STATUS</th>
                <th className="py-3.5 px-6 text-right">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {(stats.recentRequests || []).length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    <AlertCircle className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="font-semibold text-slate-600">
                      {hasActiveFilters
                        ? 'No IHLR Issues match the selected filter criteria'
                        : 'No IHLR Reports recorded yet'}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {hasActiveFilters
                        ? 'Try adjusting or clearing the department or date filter criteria.'
                        : canCreate
                        ? 'Click "Create IHLR Issue" to file your first rejection report.'
                        : 'Rejection reports will appear here once recorded.'}
                    </p>
                    {hasActiveFilters && (
                      <button
                        type="button"
                        onClick={handleResetFilters}
                        className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Reset All Filters</span>
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                (stats.recentRequests || []).slice(0, 5).map((req, index) => (
                  <tr key={req.id} className="hover:bg-slate-50/70 transition-colors">
                    {/* SL NO */}
                    <td className="py-4 px-4 text-center font-mono font-semibold text-slate-500">
                      {index + 1}
                    </td>

                    {/* Issue NO */}
                    <td className="py-4 px-4 font-mono font-bold text-blue-600">
                      {String(req.req_no).startsWith('IHLR-') ? req.req_no : `#${req.req_no}`}
                    </td>

                    {/* Date / Shift */}
                    <td className="py-4 px-4 whitespace-nowrap">
                      <div className="font-semibold text-slate-900">
                        {formatDateDDMMYYYY(req.batch_date)}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] font-bold text-slate-600 font-mono">
                          {formatIhlrShiftDisplay(req.shift)}
                        </span>
                        {getIhlrShiftDetails(req.shift)?.timing && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-500 font-mono border border-slate-200">
                            {getIhlrShiftDetails(req.shift).timing}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Problem & Model */}
                    <td className="py-4 px-6">
                      <div className="font-bold text-slate-900">{req.problem}</div>
                      <div className="text-[11px] text-blue-600 font-medium">{req.model}</div>
                    </td>

                    {/* Detected At & Line */}
                    <td className="py-4 px-4">
                      <div className="font-semibold text-slate-800">{req.problem_detected_at}</div>
                      <span className="text-[10px] text-slate-500 font-mono">{req.received_from}</span>
                    </td>

                    {/* Defect Attachment Thumbnail (Display only - No modal on click) */}
                    <td className="py-4 px-2 text-center">
                      <div className="flex items-center justify-center">
                        <IhlrAttachmentThumbnail
                          rawAttachment={req.defect_image}
                        />
                      </div>
                    </td>

                    {/* 4M */}
                    <td className="py-4 px-4 text-center">
                      <span className="px-2 py-0.5 rounded-md font-mono text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                        {req.four_m || 'MAN'}
                      </span>
                    </td>

                    {/* Responsibility */}
                    <td className="py-4 px-4 font-mono">
                      <div className="font-bold text-slate-800 text-xs">{req.resp || '-'}</div>
                      {req.resp_person && (
                        <div className="text-[10px] text-blue-600 font-semibold truncate max-w-[120px]" title={req.resp_person}>{req.resp_person}</div>
                      )}
                    </td>

                    {/* Status */}
                    <td className="py-4 px-4">
                      {getStatusBadge(req.status, req)}
                    </td>

                    {/* View Action */}
                    <td className="py-4 px-6 text-right">
                      <button
                        onClick={() => setSelectedRequest(req)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold text-blue-600 hover:text-blue-700 bg-blue-50/60 hover:bg-blue-100/80 border border-blue-200/60 rounded-lg transition cursor-pointer"
                        title="View Detailed Why-Why Analysis"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inspection Modal (Matching Screenshots 1 & 2) */}
      <IhlrRequestDetailsModal
        isOpen={Boolean(selectedRequest)}
        request={selectedRequest}
        onClose={() => setSelectedRequest(null)}
        onUpdated={() => {
          loadData();
        }}
      />

      {/* Standalone Attachment Preview Modal (Works for Excel, PDF, Word, Images) */}
      <IhlrAttachmentPreviewModal
        isOpen={Boolean(selectedPreviewAttachment)}
        attachment={selectedPreviewAttachment}
        onClose={() => setSelectedPreviewAttachment(null)}
      />

      {/* Export Format Selection Modal */}
      <ExportSelectionModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        onExportExcel={handleExportExcel}
        onExportPdf={handleExportPdf}
        title="Export Analysis Report"
        subtitle="Choose download format for current dashboard view"
        recordCount={stats.total || (stats.recentRequests || []).length}
        excelDescription="Full structured workbook with separate columns for 5-Why root-causes, containment actions, reassignment tracking, and target dates."
        pdfDescription="Official landscape document formatted with India Nippon Electricals Limited branding, tables, and page numbers."
      />
    </div>
  );
};

export default IhlrDashboard;
