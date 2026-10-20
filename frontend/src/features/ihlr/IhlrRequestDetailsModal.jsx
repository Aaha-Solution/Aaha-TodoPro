import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  Eye, 
  X, 
  Folder, 
  FileText, 
  Paperclip, 
  Download, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  ShieldCheck,
  ShieldAlert,
  Calendar,
  Layers,
  Wrench,
  UserCheck,
  FileSpreadsheet,
  Check,
  Edit2,
  Trash2,
  UploadCloud,
  Plus,
  Search,
  Users,
  ChevronDown,
  ArrowRightLeft
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { parseAttachments, getFileMeta } from './IhlrAttachmentView';
import IhlrAttachmentPreviewModal from './IhlrAttachmentPreviewModal';
import ExportSelectionModal from '../../components/common/ExportSelectionModal';
import { exportIhlrToExcel, loadLogoBase64, isImageAttachment, formatReassignmentHistory, getIhlrDisplayStatus } from './ihlrExportUtils';
import AttachmentChipList from '../../components/common/AttachmentChipList';
import { resolveAttachmentUrl } from '../../components/common/attachmentUtils';
import { useModal } from '../../context/ModalContext';
import { formatDateDDMMYYYY } from '../../utils/dateUtils';
import { formatIhlrShiftDisplay, getIhlrShiftDetails, IHLR_RECEIVED_FROM_OPTIONS } from '../../utils/constants';
import { useAuth } from '../../hooks/useAuth';
import { ihlrService } from '../../services/ihlrService';

/**
 * Meaningful IHLR (In-House Line Rejection) Inspection & Analysis Report Modal:
 * - Direct, single-scroll layout without confusing CMS/L1/L2/L3 terms
 * - Separate Tabs:
 *   1. Requester Details (Incident info, defect description, defect attachments, QA 5-Why)
 *   2. Closer Details (Production 5-Why, containment actions, closer evidence, target date, remarks, sign-off)
 */
const IhlrRequestDetailsModal = ({ isOpen, request, onClose, onEditMode, initialEditMode = false, onUpdated }) => {
  const { error: modalError, success: modalSuccess } = useModal();
  const { user } = useAuth();

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

  const [localRequest, setLocalRequest] = useState(request);
  const [activeTab, setActiveTab] = useState('requester'); // 'requester' | 'closer'
  const [previewAttachment, setPreviewAttachment] = useState(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFormat, setExportFormat] = useState('excel'); // 'excel' | 'pdf'

  // Requester Edit Mode States
  const [isEditMode, setIsEditMode] = useState(Boolean(initialEditMode));
  const [isSavingRequester, setIsSavingRequester] = useState(false);
  const [editFormData, setEditFormData] = useState({
    batch_date: '',
    shift: 'Shift 1',
    model: '',
    four_m: 'MAN',
    resp: 'PRODUCTION',
    resp_person: '',
    actual_qty: 1,
    problem_detected_at: '',
    received_from: '',
    analysis_done_by: '',
    problem: '',
    occurrence_cause: ''
  });
  const [editAttachments, setEditAttachments] = useState([]);
  const [newFiles, setNewFiles] = useState([]);
  const [editQaWhyWhy, setEditQaWhyWhy] = useState(['', '', '', '', '']);
  const [editErrors, setEditErrors] = useState({});
  const [dbUsers, setDbUsers] = useState([]);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const userDropdownRef = useRef(null);

  const req = localRequest || request;
  const {
    hasReassignments,
    reassignedStatus,
    reassignmentDetails,
    count: reassignCount,
    list: reassignList
  } = formatReassignmentHistory(req?.reassignment_history);

  const isRequester = Boolean(
    req && (
      (req.created_by_id && user?.id && String(req.created_by_id) === String(user.id)) ||
      (req.created_by && user?.name && req.created_by.trim().toLowerCase() === user.name.trim().toLowerCase()) ||
      (req.created_by_email && user?.email && req.created_by_email.trim().toLowerCase() === user.email.trim().toLowerCase()) ||
      (!req.created_by && !req.created_by_email)
    )
  );

  const isClosed =
    (req?.status || '').toUpperCase() === 'CLOSED' ||
    (req?.status || '').toUpperCase() === 'APPROVED';

  const canEditRequester = Boolean(req && (isAdmin || isRequester) && (!isClosed || isAdmin));

  const initEditState = (targetReq = req) => {
    if (!targetReq) return;
    let bDate = '';
    if (targetReq.batch_date) {
      try {
        bDate = String(targetReq.batch_date).split('T')[0];
      } catch {
        bDate = '';
      }
    }
    setEditFormData({
      batch_date: bDate || new Date().toISOString().split('T')[0],
      shift: targetReq.shift || 'Shift 1',
      model: targetReq.model || '',
      four_m: targetReq.four_m || 'MAN',
      resp: targetReq.resp || 'PRODUCTION',
      resp_person: targetReq.resp_person || '',
      actual_qty: targetReq.actual_qty || 1,
      problem_detected_at: targetReq.problem_detected_at || '',
      received_from: targetReq.received_from || '',
      analysis_done_by: targetReq.analysis_done_by || '',
      problem: targetReq.problem || '',
      occurrence_cause: targetReq.occurrence_cause || targetReq.detailed_observation || targetReq.problem || ''
    });
    setEditAttachments(parseAttachments(targetReq.defect_image));
    setNewFiles([]);
    setEditQaWhyWhy(
      Array.isArray(targetReq.qa_why_why) && targetReq.qa_why_why.length > 0
        ? [...targetReq.qa_why_why, '', '', '', ''].slice(0, 5)
        : ['', '', '', '', '']
    );
    setEditErrors({});
  };

  useEffect(() => {
    setLocalRequest(request);
    if (isOpen && request) {
      initEditState(request);
      if (initialEditMode) {
        setIsEditMode(true);
        setActiveTab('requester');
      } else {
        setIsEditMode(false);
      }
    }
  }, [request?.id, isOpen, initialEditMode]);

  useEffect(() => {
    if (isOpen) {
      ihlrService.getUsers().then(users => {
        if (Array.isArray(users)) setDbUsers(users);
      }).catch(() => {});
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (userDropdownRef.current && !userDropdownRef.current.contains(e.target)) {
        setIsUserDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isUserActive = (u) => {
    if (!u) return false;
    if (u.is_active === false || u.is_active === 0 || u.is_active === '0') return false;
    const s = String(u.status || 'ACTIVE').trim().toUpperCase();
    return s !== 'INACTIVE';
  };

  const getDepartmentUsers = (dept) => {
    if (!dept) return [];
    const targetDept = dept.trim().toUpperCase();
    return dbUsers.filter((u) => {
      const uDept = (u.department || '').trim().toUpperCase();
      return uDept === targetDept && isUserActive(u);
    });
  };

  const getSelectedUsers = () => {
    if (!editFormData.resp_person) return [];
    return editFormData.resp_person
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  };

  const handleToggleUser = (userName) => {
    const current = getSelectedUsers();
    let updated;
    if (current.includes(userName)) {
      updated = current.filter((u) => u !== userName);
    } else {
      updated = [...current, userName];
    }
    setEditFormData(prev => ({ ...prev, resp_person: updated.join(', ') }));
    if (updated.length > 0) {
      setEditErrors(prev => ({ ...prev, resp_person: '' }));
    }
  };

  const handleRemoveExistingAttachment = (indexToRemove) => {
    setEditAttachments(prev => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleRemoveNewFile = (indexToRemove) => {
    setNewFiles(prev => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleNewFilesSelect = (e) => {
    const selected = Array.from(e.target.files || []);
    if (selected.length > 0) {
      setNewFiles(prev => [...prev, ...selected]);
      setEditErrors(prev => ({ ...prev, attachments: '' }));
    }
    e.target.value = '';
  };

  const handleSaveRequesterDetails = async () => {
    const newErrors = {};

    if (!editFormData.batch_date || !editFormData.batch_date.trim()) {
      newErrors.batch_date = 'Incident Date is required';
    }
    if (!editFormData.shift || !editFormData.shift.trim()) {
      newErrors.shift = 'Shift is required';
    }
    if (!editFormData.four_m || !editFormData.four_m.trim()) {
      newErrors.four_m = '4M Category is required';
    }
    if (!editFormData.resp || !editFormData.resp.trim()) {
      newErrors.resp = 'Responsibility department is required';
    }
    if (!editFormData.resp_person || getSelectedUsers().length === 0) {
      newErrors.resp_person = 'Responsibility Person is required';
    }
    if (!editFormData.model || !editFormData.model.trim()) {
      newErrors.model = 'Model Name / Part is required';
    }
    if (
      editFormData.actual_qty === '' ||
      editFormData.actual_qty === null ||
      editFormData.actual_qty === undefined ||
      Number(editFormData.actual_qty) <= 0
    ) {
      newErrors.actual_qty = 'Actual Rejected Qty is required (min 1)';
    }
    if (!editFormData.problem_detected_at || !editFormData.problem_detected_at.trim()) {
      newErrors.problem_detected_at = 'Problem Detected At is required';
    }
    if (!editFormData.received_from || !editFormData.received_from.trim()) {
      newErrors.received_from = 'Received From (Line/Cell) is required';
    }
    if (!editFormData.analysis_done_by || !editFormData.analysis_done_by.trim()) {
      newErrors.analysis_done_by = 'Analysis Done By is required';
    } else if (/\d/.test(editFormData.analysis_done_by)) {
      newErrors.analysis_done_by = 'Analysis Done By must contain text only, numbers are not allowed';
    }
    if (!editFormData.problem || !editFormData.problem.trim()) {
      newErrors.problem = 'Problem / Defect Description is required';
    }
    if (editAttachments.length + newFiles.length === 0) {
      newErrors.attachments = 'Defect evidence attachment is mandatory. Please upload at least one file.';
    }
    if (!editQaWhyWhy[0] || !editQaWhyWhy[0].trim()) {
      newErrors.w1 = 'Why 1 (W1) is mandatory. Please enter root cause.';
    }

    if (Object.keys(newErrors).length > 0) {
      setEditErrors(newErrors);
      modalError('Please fill in all mandatory fields indicated in red.');
      return;
    }

    setEditErrors({});

    setIsSavingRequester(true);
    try {
      let newlyUploaded = [];
      if (newFiles.length > 0) {
        newlyUploaded = await ihlrService.uploadAttachments(newFiles);
      }

      const finalAttachments = [...editAttachments, ...newlyUploaded];

      const requesterUpdates = {
        batch_date: editFormData.batch_date,
        shift: editFormData.shift,
        model: editFormData.model.trim(),
        four_m: editFormData.four_m,
        resp: editFormData.resp,
        resp_person: editFormData.resp_person,
        actual_qty: Number(editFormData.actual_qty) || 1,
        problem_detected_at: editFormData.problem_detected_at?.trim() || '',
        received_from: editFormData.received_from?.trim() || '',
        analysis_done_by: editFormData.analysis_done_by?.trim() || '',
        problem: editFormData.problem.trim(),
        occurrence_cause: editFormData.occurrence_cause?.trim() || '',
        defect_image: finalAttachments.length > 0 ? JSON.stringify(finalAttachments) : '',
        qa_why_why: editQaWhyWhy
      };

      const result = await ihlrService.updateRequest(req.id, requesterUpdates);
      const mergedUpdated = {
        ...req,
        ...requesterUpdates,
        ...(result || {})
      };

      setLocalRequest(mergedUpdated);
      setIsEditMode(false);
      setNewFiles([]);
      onUpdated?.(mergedUpdated);
      modalSuccess('Requester details updated successfully!');
    } catch (err) {
      console.error('Failed to update requester details:', err);
      const errMsg = err.response?.data?.message || err.message || 'Failed to update requester details. Please try again.';
      modalError(errMsg);
    } finally {
      setIsSavingRequester(false);
    }
  };

  useEffect(() => {
    setActiveTab('requester');
  }, [request?.id]);

  if (!isOpen || !request) return null;

  const attachments = parseAttachments(req.defect_image);
  const evidenceAttachments = parseAttachments(req.evidence_attachment);

  const formatDate = (dateStr) => {
    return formatDateDDMMYYYY(dateStr);
  };

  const formatShift = (shift) => {
    return formatIhlrShiftDisplay(shift, true);
  };

  const isReqOpen = (request?.status || '').toUpperCase() === 'OPEN';
  const isCompleted = Boolean(
    !isReqOpen && (
      (request?.status || '').toUpperCase() === 'IN_PROGRESS' ||
      (request?.status || '').toUpperCase() === 'APPROVAL_PENDING' ||
      (request?.status || '').toUpperCase() === 'AWAITING_REVIEW' ||
      (request?.status || '').toUpperCase() === 'AWAITING REVIEW' ||
      (request?.status || '').toUpperCase() === 'UNDER_REVIEW' ||
      (request && (
        Boolean(request.action && String(request.action).trim()) &&
        Boolean(request.target_date) &&
        Boolean(request.prod_why_why?.[0] && String(request.prod_why_why[0]).trim())
      ))
    )
  );

  const getStatusBadge = (status, reqItem) => {
    const target = reqItem || request;
    const disp = getIhlrDisplayStatus(status || target?.status, target);
    if (disp === 'CLOSED') {
      return (
        <span className="px-3 py-0.5 rounded-full text-xs font-semibold border border-emerald-500 text-emerald-700 bg-emerald-50/70 inline-flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
          <span>Closed</span>
        </span>
      );
    }
    if (disp === 'AWAITING REVIEW' || disp === 'APPROVAL PENDING') {
      return (
        <span className="px-3 py-0.5 rounded-full text-xs font-semibold border border-amber-400 text-amber-800 bg-amber-50/70 inline-flex items-center gap-1">
          <Clock className="w-3 h-3 text-amber-600" />
          <span>Awaiting Review</span>
        </span>
      );
    }
    return (
      <span className="px-3 py-0.5 rounded-full text-xs font-semibold border border-rose-400 text-rose-800 bg-rose-50/70 inline-flex items-center gap-1">
        <AlertCircle className="w-3 h-3 text-rose-600" />
        <span>Pending</span>
      </span>
    );
  };

  // Helper to fetch an image attachment as base64 for embedding in Excel and PDF
  const fetchAttachmentImageBase64 = async (att) => {
    if (!att) return null;
    const name = att.name || att.filename || (typeof att === 'string' ? att : 'image.png');

    // Case 1: In-memory File/Blob
    if (att.file && att.file instanceof Blob) {
      try {
        return await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const dataUrl = reader.result;
            if (typeof dataUrl !== 'string') return resolve(null);
            const parts = dataUrl.split(',');
            const ext = parts[0]?.includes('png') ? 'png' : 'jpeg';
            resolve({ base64: parts[1], dataUrl, extension: ext, name });
          };
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(att.file);
        });
      } catch {
        return null;
      }
    }

    // Case 2: Data URL string
    const rawUrl = att.url || (typeof att === 'string' ? att : '') || att.path;
    if (typeof rawUrl === 'string' && rawUrl.startsWith('data:image')) {
      const parts = rawUrl.split(',');
      const ext = parts[0]?.includes('png') ? 'png' : 'jpeg';
      return { base64: parts[1], dataUrl: rawUrl, extension: ext, name };
    }

    // Case 3: Stream from resolved gateway URL
    const streamUrl = resolveAttachmentUrl(att, 'ihlr');
    if (!streamUrl) return null;

    try {
      const res = await fetch(streamUrl);
      if (!res.ok) return null;
      const blob = await res.blob();
      return await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const dataUrl = reader.result;
          if (typeof dataUrl !== 'string') return resolve(null);
          const parts = dataUrl.split(',');
          const ext = blob.type?.includes('png') ? 'png' : 'jpeg';
          resolve({ base64: parts[1], dataUrl, extension: ext, name });
        };
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch (err) {
      console.warn('Could not fetch attachment image for export:', err);
      return null;
    }
  };

  // Collect all image attachments from defect and evidence lists
  const getExportImages = async () => {
    const isImg = (a) => {
      if (!a) return false;
      if (a.isImage) return true;
      const n = a.name || a.filename || (typeof a === 'string' ? a : '');
      const ext = (n.split('.').pop() || '').toUpperCase();
      return ['PNG', 'JPG', 'JPEG', 'WEBP', 'GIF', 'BMP', 'SVG', 'JFIF'].includes(ext);
    };

    const items = [
      ...attachments.filter(isImg).map((a) => ({ ...a, label: 'Defect Image' })),
      ...evidenceAttachments.filter(isImg).map((a) => ({ ...a, label: 'Closer Evidence Image' }))
    ];

    const results = await Promise.all(
      items.map(async (item) => {
        const data = await fetchAttachmentImageBase64(item);
        if (!data) return null;
        return { ...data, label: item.label };
      })
    );
    return results.filter(Boolean);
  };

  // Export this single report to Excel (.xlsx) using common IHLR export utility
  const handleExportExcel = async () => {
    try {
      const targetReq = req || request;
      if (!targetReq) {
        modalWarning('No request data available to export.', 'No Data Available');
        setShowExportModal(false);
        return;
      }

      const reqNo = String(targetReq.req_no || '').startsWith('IHLR-') ? targetReq.req_no : `#${targetReq.req_no}`;
      const safeReqNo = String(targetReq.req_no || 'Report').replace(/[^a-zA-Z0-9_-]/g, '_');
      const today = new Date().toISOString().slice(0, 10);

      await exportIhlrToExcel({
        requests: [targetReq],
        fileName: `IHLR_Report_${safeReqNo}_${today}.xlsx`,
        sheetName: 'IHLR Analysis Log'
      });

      setShowExportModal(false);
      modalSuccess(`Exported report #${reqNo} to Excel successfully.`);
    } catch (err) {
      console.error('Failed to export report to Excel:', err);
      modalError('Failed to export report to Excel: ' + err.message);
    }
  };

  // Export this single report to PDF (.pdf) with embedded images and all fields
  const handleExportPdf = async () => {
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'pt',
        format: 'a4'
      });

      const reqNo = String(request.req_no || '').startsWith('IHLR-') ? request.req_no : `#${request.req_no}`;
      const batchDate = formatDate(request.batch_date);
      const shiftStr = formatShift(request.shift);
      const safeReqNo = String(request.req_no).replace(/[^a-zA-Z0-9_-]/g, '_');

      // Fetch images for embedding in PDF
      const exportImages = await getExportImages();
      const logoData = await loadLogoBase64();

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
      doc.text(`IN-HOUSE LINE REJECTION (IHLR) ANALYSIS REPORT  |  ${reqNo}`, bannerTextX, 66);

      // Section 1: Basic Information
      autoTable(doc, {
        startY: 88,
        theme: 'plain',
        styles: { fontSize: 8.5, cellPadding: 3 },
        body: [
          [
            { content: 'Report No:', styles: { fontStyle: 'bold', textColor: [71, 85, 105] } },
            { content: reqNo, styles: { fontStyle: 'bold', textColor: [37, 99, 235] } },
            { content: 'Status:', styles: { fontStyle: 'bold', textColor: [71, 85, 105] } },
            {
              content: getIhlrDisplayStatus(request.status, request),
              styles: {
                fontStyle: 'bold',
                textColor: getIhlrDisplayStatus(request.status, request) === 'CLOSED'
                  ? [22, 101, 52]
                  : (getIhlrDisplayStatus(request.status, request) === 'AWAITING REVIEW' || getIhlrDisplayStatus(request.status, request) === 'APPROVAL PENDING')
                  ? [180, 83, 9]
                  : [225, 29, 72]
              }
            }
          ],
          [
            { content: 'Date:', styles: { fontStyle: 'bold', textColor: [71, 85, 105] } },
            batchDate,
            { content: 'Shift:', styles: { fontStyle: 'bold', textColor: [71, 85, 105] } },
            shiftStr
          ],
          [
            { content: 'Model / Part:', styles: { fontStyle: 'bold', textColor: [71, 85, 105] } },
            request.model || '—',
            { content: 'Actual Qty:', styles: { fontStyle: 'bold', textColor: [71, 85, 105] } },
            request.actual_qty ? `${request.actual_qty} Nos` : '1 Nos'
          ],
          [
            { content: 'Detected At:', styles: { fontStyle: 'bold', textColor: [71, 85, 105] } },
            request.problem_detected_at || '—',
            { content: 'Received From:', styles: { fontStyle: 'bold', textColor: [71, 85, 105] } },
            request.received_from || '—'
          ],
          [
            { content: 'Analysis By:', styles: { fontStyle: 'bold', textColor: [71, 85, 105] } },
            request.analysis_done_by || '—',
            { content: '4M Category:', styles: { fontStyle: 'bold', textColor: [71, 85, 105] } },
            request.four_m || '—'
          ],
          [
            { content: 'Responsibility:', styles: { fontStyle: 'bold', textColor: [71, 85, 105] } },
            `${request.resp || '—'} ${request.resp_person ? `(${request.resp_person})` : ''}`,
            { content: 'Raised By:', styles: { fontStyle: 'bold', textColor: [71, 85, 105] } },
            request.created_by || '—'
          ],
          [
            { content: 'Created At:', styles: { fontStyle: 'bold', textColor: [71, 85, 105] } },
            request.created_at ? formatDate(request.created_at) : '—',
            { content: '', styles: {} },
            ''
          ]
        ]
      });

      // Section 2: Defect Problem Description
      const lastY = doc.lastAutoTable.finalY + 8;
      autoTable(doc, {
        startY: lastY,
        head: [['DEFECT PROBLEM & OBSERVATION DESCRIPTION']],
        body: [
          [`Problem: ${request.problem || '—'}`],
          [`Detailed Occurrence: ${request.problem_description || request.detailed_observation || '—'}`],
          ...(request.occurrence_cause ? [[`Initial Occurrence Cause: ${request.occurrence_cause}`]] : [])
        ],
        theme: 'grid',
        headStyles: { fillColor: [59, 130, 246], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
        styles: { fontSize: 8.5, cellPadding: 4 }
      });

      // Section 3: 5-Why Analysis
      const whyY = doc.lastAutoTable.finalY + 8;
      const whyRows = [];
      for (let i = 0; i < 5; i++) {
        const qa = request.why_why?.[i] || request.qa_why_why?.[i];
        const prod = request.prod_why_why?.[i];
        if (qa || prod || i === 0) {
          whyRows.push([`Why ${i + 1}`, qa || '—', prod || '—']);
        }
      }

      autoTable(doc, {
        startY: whyY,
        head: [['LEVEL', 'QA PROBLEM CAUSE (5-WHY)', 'PRODUCTION OCCURRENCE CAUSE (5-WHY)']],
        body: whyRows,
        theme: 'grid',
        headStyles: { fillColor: [245, 158, 11], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
        columnStyles: {
          0: { cellWidth: 45, fontStyle: 'bold', halign: 'center' },
          1: { cellWidth: 235 },
          2: { cellWidth: 235 }
        },
        styles: { fontSize: 8, cellPadding: 3.5 }
      });

      // Section 4: Containment Action & Closure
      const { hasReassignments, reassignmentDetails } = formatReassignmentHistory(request.reassignment_history);
      const actionY = doc.lastAutoTable.finalY + 8;
      autoTable(doc, {
        startY: actionY,
        head: [['CONTAINMENT COUNTERMEASURE & CLOSURE SIGN-OFF']],
        body: [
          [`Corrective Action: ${request.action || 'Containment action pending review.'}`],
          [`Target Date: ${formatDate(request.target_date)}  |  Responsible Person: ${request.resp_person || request.resp || 'Quality Team'}`],
          ...(hasReassignments ? [[`Reassignment History: ${reassignmentDetails}`]] : []),
          ...(request.remarks ? [[`Remarks: ${request.remarks}`]] : []),
          [`Closure Sign-off: ${request.status === 'CLOSED' ? `Closed by ${request.closed_by || request.resp_person || 'Quality Admin'} on ${formatDate(request.closed_at || request.target_date)}` : 'Pending Closer Sign-off'}`],
          ...(attachments.length > 0 ? [[`Defect Attachments (${attachments.length}): ${attachments.map((a) => a.name).join(', ')}`]] : []),
          ...(evidenceAttachments.length > 0 ? [[`Closer Evidence Attachments (${evidenceAttachments.length}): ${evidenceAttachments.map((a) => a.name).join(', ')}`]] : [])
        ],
        theme: 'grid',
        headStyles: { fillColor: [16, 185, 129], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
        styles: { fontSize: 8.5, cellPadding: 4 }
      });

      // Section 5: EMBEDDED IMAGES IN PDF
      if (exportImages.length > 0) {
        let currentY = doc.lastAutoTable.finalY + 15;

        for (const img of exportImages) {
          if (currentY + 230 > doc.internal.pageSize.height - 40) {
            doc.addPage();
            currentY = 40;
          }

          doc.setFillColor(241, 245, 249);
          doc.rect(40, currentY, 515, 20, 'F');
          doc.setDrawColor(203, 213, 225);
          doc.rect(40, currentY, 515, 20, 'S');

          doc.setFontSize(8.5);
          doc.setFont(undefined, 'bold');
          doc.setTextColor(30, 41, 59);
          doc.text(`${img.label}: ${img.name}`, 50, currentY + 14);

          try {
            doc.addImage(img.dataUrl, img.extension.toUpperCase(), 40, currentY + 24, 340, 190);
          } catch (imgErr) {
            console.warn('Failed to embed image in PDF:', imgErr);
          }

          currentY += 225;
        }
      }

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

      doc.save(`IHLR_Report_${safeReqNo}_${batchDate}.pdf`);
      setShowExportModal(false);
      modalSuccess(`Exported report #${reqNo} to PDF with all fields and embedded images.`);
    } catch (err) {
      console.error('Failed to export report to PDF:', err);
      modalError('Failed to export report to PDF: ' + err.message);
    }
  };

  const handleDownload = async () => {
    if (exportFormat === 'excel') {
      await handleExportExcel();
    } else {
      await handleExportPdf();
    }
  };

  if (!isOpen || !req) return null;

  return createPortal(
    <>
      <div 
        className="fixed inset-0 !m-0 !mt-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-150"
        style={{ zIndex: 99990 }}
        onClick={onClose}
      >
        <div 
          className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
                <Eye className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 truncate">
                    IHLR Rejection Analysis Report
                  </h3>
                  {canEditRequester && activeTab === 'requester' && (
                    isEditMode ? (
                      <div className="flex items-center gap-2">
                        <span className="px-3 py-1 bg-amber-500 text-white text-[10px] font-black rounded-full uppercase tracking-wider animate-pulse">
                          EDITING REQUESTER DETAILS
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            initEditState(req);
                            setIsEditMode(false);
                          }}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold rounded-full uppercase tracking-wider transition cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          initEditState(req);
                          setIsEditMode(true);
                          setActiveTab('requester');
                        }}
                        className="px-3 py-1 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-[11px] font-bold rounded-full uppercase tracking-wider transition shadow-2xs cursor-pointer flex items-center gap-1.5"
                        title="Edit Requester Details"
                      >
                        <Edit2 className="w-3 h-3" />
                        <span>EDIT MODE</span>
                      </button>
                    )
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                  <span>
                    Tracking details for:{' '}
                    <strong className="text-slate-900 font-mono">
                      {req?.req_no || `IHLR-${req?.id}`}
                    </strong>
                  </span>
                  {hasReassignments && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                      <ArrowRightLeft className="w-2.5 h-2.5 text-purple-600" />
                      <span>Reassigned ({reassignCount})</span>
                    </span>
                  )}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition cursor-pointer shrink-0"
              title="Close Details"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Tab Navigation: Cleanly separate Requester Details vs Closer Details */}
          <div className="flex items-center gap-2 sm:gap-4 px-6 pt-2 border-b border-slate-200 bg-slate-50/80 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('requester')}
              className={`pb-3 px-3 text-xs font-bold transition border-b-2 flex items-center gap-2 cursor-pointer ${
                activeTab === 'requester'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Folder className="w-4 h-4" />
              <span>Requester Details</span>
            </button>
            <button
              type="button"
              onClick={() => {
                if (isEditMode) {
                  setIsEditMode(false);
                }
                setActiveTab('closer');
              }}
              className={`pb-3 px-3 text-xs font-bold transition border-b-2 flex items-center gap-2 cursor-pointer ${
                activeTab === 'closer'
                  ? isClosed
                    ? 'border-emerald-600 text-emerald-700'
                    : 'border-amber-600 text-amber-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <CheckCircle2 className={`w-4 h-4 ${isClosed ? 'text-emerald-600' : 'text-amber-600'}`} />
              <span>Closer Details</span>
              {isClosed ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300">
                  Closed
                </span>
              ) : isCompleted ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-300">
                  Awaiting Review
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-300">
                  Pending
                </span>
              )}
            </button>
          </div>

          {/* Modal Body: Scrollable Tab Content */}
          <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-white">
            {activeTab === 'closer' ? (
              /* TAB 2: CLOSER DETAILS */
              <div className="space-y-6 animate-in fade-in duration-150">
                {/* 1. Quick Summary Bar */}
                <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-50 via-teal-50 to-slate-50 border border-emerald-200/90 flex flex-wrap items-center justify-between gap-4 text-xs">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold shadow-2xs">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-900 text-sm">
                          {request.req_no || `IHLR-${request.id}`}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          INCIDENT CLOSED
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Model: <strong className="text-slate-800">{request.model || '—'}</strong> | Detected At:{' '}
                        <strong className="text-slate-800">{request.problem_detected_at || '—'}</strong>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-[11px] font-medium text-slate-600">
                    <div>
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Target Date</span>
                      <span className="font-mono font-bold text-slate-800">{formatDate(request.target_date) || '—'}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Responsibility</span>
                      <span className="font-bold text-slate-800">
                        {request.resp || 'Production'}{request.resp_person ? ` (${request.resp_person})` : ''}
                      </span>
                    </div>
                    {hasReassignments && (
                      <div>
                        <span className="block text-[10px] font-bold uppercase tracking-wider text-purple-500">Reassigned</span>
                        <span className="font-bold text-purple-700 font-mono">
                          Yes ({reassignCount})
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. Occurrence Cause (Production Team - 5-Why) */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-rose-600 text-xs font-bold uppercase tracking-wider">
                      <ShieldAlert className="w-4 h-4" />
                      <span>Occurrence Cause (Production Team - 5-Why Analysis)</span>
                    </div>
                    <span className="text-[11px] text-slate-400 font-mono">W1 to W5 Breakdown</span>
                  </div>

                  <div className="grid grid-cols-1 gap-2.5 text-xs">
                    {(() => {
                      const validWhys = (Array.isArray(request.prod_why_why) ? request.prod_why_why : [])
                        .map((w, idx) => ({
                          label: `W${idx + 1}`,
                          val: typeof w === 'string' ? w.trim() : (w ? String(w).trim() : '')
                        }))
                        .filter((item) => item.val.length > 0);

                      if (validWhys.length > 0) {
                        return validWhys.map((item, idx) => (
                          <div key={idx} className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/80">
                            <span className="px-2.5 py-1 rounded-lg font-mono font-black text-[11px] bg-rose-50 text-rose-700 border border-rose-200 shrink-0">
                              {item.label}:{item.label === 'W1' && <span className="text-red-500 font-bold ml-0.5">*</span>}
                            </span>
                            <span className="text-slate-800 font-medium leading-relaxed pt-0.5">
                              {item.val}
                            </span>
                          </div>
                        ));
                      }

                      // If no data recorded, show only one clean box with W1
                      return (
                        <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/80">
                          <span className="px-2.5 py-1 rounded-lg font-mono font-black text-[11px] bg-rose-50 text-rose-700 border border-rose-200 shrink-0">
                            W1:<span className="text-red-500 font-bold ml-0.5">*</span>
                          </span>
                          <span className="text-slate-800 font-medium leading-relaxed pt-0.5">
                            <span className="text-slate-400 italic">No entry recorded</span>
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* 3. Action (Words) */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-blue-600 text-xs font-bold uppercase tracking-wider">
                    <Wrench className="w-4 h-4" />
                    <span>Action Taken / Containment Action</span>
                  </div>
                  <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs text-xs text-slate-800 leading-relaxed font-medium">
                    {request.action || <span className="text-slate-400 italic">No corrective action recorded.</span>}
                  </div>
                </div>

                {/* 4. Evidence Attachment (Format: PPT, JPEG, EXCEL & PDF) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-purple-600 text-xs font-bold uppercase tracking-wider">
                      <Paperclip className="w-4 h-4" />
                      <span>Evidence Attachments</span>
                    </div>
                    <span className="text-[11px] text-slate-400 font-mono">Format: PPT, JPEG, EXCEL &amp; PDF</span>
                  </div>

                  {evidenceAttachments && evidenceAttachments.length > 0 ? (
                    <div className="p-4 rounded-2xl bg-slate-50/60 border border-slate-200/80">
                      <AttachmentChipList
                        attachments={evidenceAttachments}
                        onPreview={(att) => setPreviewAttachment(att)}
                        readonly={true}
                      />
                    </div>
                  ) : (
                    <div className="p-4 rounded-2xl bg-slate-50/60 border border-dashed border-slate-200 text-xs text-slate-400 italic text-center">
                      No closer evidence attachments uploaded.
                    </div>
                  )}
                </div>

                {/* 5. Target Date & Remarks (Image 1: REMARKS Word) */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                  <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-1">
                    <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      TARGET DATE
                    </span>
                    <span className="font-mono font-bold text-slate-900 text-sm">
                      {formatDate(request.target_date) || '—'}
                    </span>
                  </div>

                  <div className="sm:col-span-2 p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-1">
                    <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      REMARKS
                    </span>
                    <div className="text-slate-800 leading-relaxed font-medium">
                      {request.remarks || <span className="text-slate-400 italic">No remarks provided.</span>}
                    </div>
                  </div>
                </div>

                {/* 6. Reassignment Tracking History (Only shown in case of reassign status) */}
                {hasReassignments && (
                  <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-50/70 via-indigo-50/40 to-slate-50 border border-purple-200/90 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-purple-800 text-xs font-bold uppercase tracking-wider">
                        <ArrowRightLeft className="w-4 h-4 text-purple-600" />
                        <span>REASSIGNMENT TRACKING HISTORY ({reassignCount})</span>
                      </div>
                      <span className="text-[10px] font-bold px-2.5 py-0.5 bg-purple-100 text-purple-800 rounded-full border border-purple-200 font-mono">
                        Reassigned: Yes
                      </span>
                    </div>

                    <div className="space-y-2">
                      {reassignList.map((entry, idx) => (
                        <div key={idx} className="p-3 bg-white rounded-xl border border-purple-100 shadow-2xs space-y-1.5 text-xs">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 font-mono font-bold text-[10px]">
                                #{idx + 1}
                              </span>
                              <span className="text-slate-600 font-medium">
                                From: <strong className="text-slate-900">{entry.prev_resp_person || '—'}</strong> ({entry.prev_resp || '—'})
                              </span>
                              <ArrowRightLeft className="w-3 h-3 text-purple-400 inline" />
                              <span className="text-purple-700 font-medium">
                                To: <strong className="text-purple-900">{entry.new_resp_person || '—'}</strong> ({entry.new_resp || '—'})
                              </span>
                            </div>
                            <span className="text-[11px] text-slate-500 font-mono">
                              {[entry.reassigned_by ? `by ${entry.reassigned_by}` : '', entry.reassigned_at ? formatDate(entry.reassigned_at) : ''].filter(Boolean).join(' • ')}
                            </span>
                          </div>
                          {entry.remarks && (
                            <div className="text-[11px] text-slate-700 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100 italic">
                              <span className="font-semibold text-slate-500 not-italic">Remarks: </span>
                              {entry.remarks}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 7. Closer Status & Sign-off Details */}
                <div className={`p-4 rounded-2xl border flex flex-wrap items-center justify-between gap-3 text-xs ${
                  isClosed
                    ? 'bg-emerald-50/70 border-emerald-200/90'
                    : 'bg-amber-50/70 border-amber-200/90'
                }`}>
                  <div className="flex items-center gap-2">
                    {isClosed ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span className="font-bold text-emerald-900">Incident Fully Validated &amp; Closed</span>
                      </>
                    ) : (
                      <>
                        <Clock className="w-4 h-4 text-amber-600" />
                        <span className="font-bold text-amber-900">Containment Countermeasure in Progress</span>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-[11px] text-slate-600 font-medium">
                    <span>4M: <strong className="text-amber-800 font-mono">{request.four_m || 'MAN'}</strong></span>
                    <span>Resp: <strong className="text-blue-700 font-mono">{request.resp || 'PRODUCTION'}{request.resp_person ? ` (${request.resp_person})` : ''}</strong></span>
                  </div>
                </div>
              </div>
            ) : isEditMode ? (
              /* TAB 1: REQUESTER DETAILS - EDIT MODE */
              <div className="space-y-6 animate-in fade-in duration-150">
                {/* 📁 1. GENERAL INFORMATION & DEFECT PARAMETERS (EDITABLE) */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-blue-600 text-xs font-bold uppercase tracking-wider">
                      <Folder className="w-4 h-4" />
                      <span>1. INCIDENT &amp; LINE DEFECT DETAILS</span>
                    </div>
                    <span className="text-[11px] font-bold text-amber-600 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200 uppercase tracking-wider">
                      Requester Edit Active
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs p-4 rounded-2xl bg-slate-50/90 border border-slate-200">
                    <div>
                      <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                        REQ NO
                      </span>
                      <div className="px-3 py-2 bg-slate-200/80 rounded-xl font-bold font-mono text-slate-700 border border-slate-300/80 text-xs">
                        {req.req_no || `IHLR-${req.id}`}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                        INCIDENT DATE <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="date"
                        value={editFormData.batch_date}
                        onChange={(e) => {
                          setEditFormData(prev => ({ ...prev, batch_date: e.target.value }));
                          if (editErrors.batch_date && e.target.value) {
                            setEditErrors(prev => ({ ...prev, batch_date: '' }));
                          }
                        }}
                        className={`w-full px-3 py-2 rounded-xl text-xs font-medium text-slate-900 outline-none transition ${
                          editErrors.batch_date
                            ? 'border border-rose-400 focus:ring-2 focus:ring-rose-400/20 focus:border-rose-500 bg-rose-50/20'
                            : 'bg-white border border-slate-300 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600'
                        }`}
                      />
                      {editErrors.batch_date && (
                        <p className="text-[11px] text-rose-500 font-semibold mt-1 flex items-center gap-1">
                          <span>* {editErrors.batch_date}</span>
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                        SHIFT <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={editFormData.shift}
                        onChange={(e) => {
                          setEditFormData(prev => ({ ...prev, shift: e.target.value }));
                          if (editErrors.shift && e.target.value) {
                            setEditErrors(prev => ({ ...prev, shift: '' }));
                          }
                        }}
                        className={`w-full px-3 py-2 rounded-xl text-xs font-medium text-slate-900 outline-none transition ${
                          editErrors.shift
                            ? 'border border-rose-400 focus:ring-2 focus:ring-rose-400/20 focus:border-rose-500 bg-rose-50/20'
                            : 'bg-white border border-slate-300 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600'
                        }`}
                      >
                        <option value="Shift 1">Shift 1 (06:30 AM - 03:00 PM)</option>
                        <option value="Shift 2">Shift 2 (03:00 PM - 11:30 PM)</option>
                        <option value="Shift 3">Shift 3 (11:30 PM - 06:30 AM)</option>
                        <option value="General">General (08:30 AM - 05:00 PM)</option>
                      </select>
                      {editErrors.shift && (
                        <p className="text-[11px] text-rose-500 font-semibold mt-1 flex items-center gap-1">
                          <span>* {editErrors.shift}</span>
                        </p>
                      )}
                    </div>

                    <div>
                      <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                        STATUS (PRESERVED)
                      </span>
                      <div className="pt-1">
                        {getStatusBadge(req.status)}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                        4M CATEGORY <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={editFormData.four_m}
                        onChange={(e) => {
                          setEditFormData(prev => ({ ...prev, four_m: e.target.value }));
                          if (editErrors.four_m && e.target.value) {
                            setEditErrors(prev => ({ ...prev, four_m: '' }));
                          }
                        }}
                        className={`w-full px-3 py-2 rounded-xl text-xs font-bold outline-none transition ${
                          editErrors.four_m
                            ? 'border border-rose-400 focus:ring-2 focus:ring-rose-400/20 focus:border-rose-500 bg-rose-50/20 text-rose-800'
                            : 'bg-white border border-slate-300 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-amber-800'
                        }`}
                      >
                        <option value="MAN">MAN</option>
                        <option value="MACHINE">MACHINE</option>
                        <option value="METHOD">METHOD</option>
                        <option value="MATERIAL">MATERIAL</option>
                      </select>
                      {editErrors.four_m && (
                        <p className="text-[11px] text-rose-500 font-semibold mt-1 flex items-center gap-1">
                          <span>* {editErrors.four_m}</span>
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                        RESPONSIBILITY (DEPT) <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={editFormData.resp}
                        onChange={(e) => {
                          const nextDept = e.target.value;
                          setEditFormData(prev => ({ ...prev, resp: nextDept, resp_person: '' }));
                          if (editErrors.resp && nextDept) {
                            setEditErrors(prev => ({ ...prev, resp: '' }));
                          }
                        }}
                        className={`w-full px-3 py-2 rounded-xl text-xs font-bold text-slate-900 outline-none transition ${
                          editErrors.resp
                            ? 'border border-rose-400 focus:ring-2 focus:ring-rose-400/20 focus:border-rose-500 bg-rose-50/20'
                            : 'bg-white border border-slate-300 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600'
                        }`}
                      >
                        <option value="PRODUCTION">PRODUCTION</option>
                        <option value="QUALITY">QUALITY</option>
                        <option value="MAINTENANCE">MAINTENANCE</option>
                        <option value="SCM">SCM</option>
                        <option value="LOGISTICS">LOGISTICS</option>
                        <option value="HR">HR</option>
                      </select>
                      {editErrors.resp && (
                        <p className="text-[11px] text-rose-500 font-semibold mt-1 flex items-center gap-1">
                          <span>* {editErrors.resp}</span>
                        </p>
                      )}
                    </div>

                    {/* RESPONSIBILITY (PERSON) MULTI-SELECT DROPDOWN */}
                    <div className="relative sm:col-span-2" ref={userDropdownRef}>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                        RESPONSIBILITY PERSON(S) <span className="text-rose-500">*</span>
                      </label>
                      <div
                        onClick={() => setIsUserDropdownOpen(prev => !prev)}
                        className={`w-full min-h-[38px] px-3 py-1.5 rounded-xl text-xs cursor-pointer flex items-center justify-between gap-2 transition ${
                          editErrors.resp_person
                            ? 'border border-rose-400 bg-rose-50/20 ring-2 ring-rose-400/20'
                            : 'bg-white border border-slate-300 hover:border-slate-400 focus:ring-2 focus:ring-blue-500/20'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 flex-wrap min-w-0 py-0.5">
                          {getSelectedUsers().length > 0 ? (
                            getSelectedUsers().map((uName) => (
                              <span
                                key={uName}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-50 text-blue-800 text-[11px] font-semibold border border-blue-200"
                              >
                                <span>{uName}</span>
                                <span
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleToggleUser(uName);
                                  }}
                                  className="text-blue-500 hover:text-blue-800 cursor-pointer ml-0.5"
                                >
                                  ×
                                </span>
                              </span>
                            ))
                          ) : (
                            <span className="text-slate-400 text-xs">Select assigned person(s)...</span>
                          )}
                        </div>
                        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isUserDropdownOpen ? 'rotate-180' : ''}`} />
                      </div>
                      {editErrors.resp_person && (
                        <p className="text-[11px] text-rose-500 font-semibold mt-1 flex items-center gap-1">
                          <span>* {editErrors.resp_person}</span>
                        </p>
                      )}

                      {/* Dropdown Menu */}
                      {isUserDropdownOpen && (
                        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                          <div className="p-2 border-b border-slate-100 bg-slate-50/80">
                            <div className="relative">
                              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                              <input
                                type="text"
                                value={userSearchTerm}
                                onChange={(e) => setUserSearchTerm(e.target.value)}
                                placeholder="Search by name..."
                                className="w-full pl-8 pr-3 py-1 bg-white border border-slate-200 rounded-lg text-xs outline-none"
                                onClick={(e) => e.stopPropagation()}
                              />
                            </div>
                          </div>
                          <div className="max-h-48 overflow-y-auto p-1 divide-y divide-slate-50 text-xs">
                            {getDepartmentUsers(editFormData.resp)
                              .filter((u) => {
                                const q = userSearchTerm.toLowerCase();
                                return (u.name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q);
                              })
                              .map((u) => {
                                const isChecked = getSelectedUsers().includes(u.name);
                                return (
                                  <div
                                    key={u.id || u.name}
                                    onClick={() => handleToggleUser(u.name)}
                                    className={`flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer transition select-none ${
                                      isChecked ? 'bg-blue-50 text-blue-900 font-semibold' : 'hover:bg-slate-50 text-slate-700'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2">
                                      <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${isChecked ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300'}`}>
                                        {isChecked && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                                      </div>
                                      <span>{u.name}</span>
                                    </div>
                                    {u.department && <span className="text-[10px] text-slate-400">{u.department}</span>}
                                  </div>
                                );
                              })}
                            {getDepartmentUsers(editFormData.resp).length === 0 && (
                              <div className="p-3 text-center text-slate-400 italic text-[11px]">
                                No registered users found for {editFormData.resp}.
                              </div>
                            )}
                          </div>
                          <div className="p-2 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-[11px]">
                            <span className="text-slate-500">{getSelectedUsers().length} selected</span>
                            <button
                              type="button"
                              onClick={() => setIsUserDropdownOpen(false)}
                              className="px-2.5 py-0.5 bg-blue-600 text-white rounded-lg font-bold"
                            >
                              Done
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                        MODEL NAME / PART <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={editFormData.model}
                        onChange={(e) => {
                          setEditFormData(prev => ({ ...prev, model: e.target.value }));
                          if (editErrors.model && e.target.value.trim()) {
                            setEditErrors(prev => ({ ...prev, model: '' }));
                          }
                        }}
                        placeholder="Model name / Part description"
                        className={`w-full px-3 py-2 rounded-xl text-xs font-semibold text-slate-900 outline-none transition ${
                          editErrors.model
                            ? 'border border-rose-400 focus:ring-2 focus:ring-rose-400/20 focus:border-rose-500 bg-rose-50/20'
                            : 'bg-white border border-slate-300 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600'
                        }`}
                      />
                      {editErrors.model && (
                        <p className="text-[11px] text-rose-500 font-semibold mt-1 flex items-center gap-1">
                          <span>* {editErrors.model}</span>
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                        REJECTED QTY <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={editFormData.actual_qty}
                        onChange={(e) => {
                          setEditFormData(prev => ({ ...prev, actual_qty: e.target.value }));
                          if (editErrors.actual_qty && e.target.value && Number(e.target.value) > 0) {
                            setEditErrors(prev => ({ ...prev, actual_qty: '' }));
                          }
                        }}
                        className={`w-full px-3 py-2 rounded-xl text-xs font-mono font-bold text-slate-900 outline-none transition ${
                          editErrors.actual_qty
                            ? 'border border-rose-400 focus:ring-2 focus:ring-rose-400/20 focus:border-rose-500 bg-rose-50/20'
                            : 'bg-white border border-slate-300 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600'
                        }`}
                      />
                      {editErrors.actual_qty && (
                        <p className="text-[11px] text-rose-500 font-semibold mt-1 flex items-center gap-1">
                          <span>* {editErrors.actual_qty}</span>
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                        DETECTED AT <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={editFormData.problem_detected_at}
                        onChange={(e) => {
                          setEditFormData(prev => ({ ...prev, problem_detected_at: e.target.value }));
                          if (editErrors.problem_detected_at && e.target.value.trim()) {
                            setEditErrors(prev => ({ ...prev, problem_detected_at: '' }));
                          }
                        }}
                        placeholder="e.g. Line 2 Assembly"
                        className={`w-full px-3 py-2 rounded-xl text-xs text-slate-900 outline-none transition ${
                          editErrors.problem_detected_at
                            ? 'border border-rose-400 focus:ring-2 focus:ring-rose-400/20 focus:border-rose-500 bg-rose-50/20'
                            : 'bg-white border border-slate-300 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600'
                        }`}
                      />
                      {editErrors.problem_detected_at && (
                        <p className="text-[11px] text-rose-500 font-semibold mt-1 flex items-center gap-1">
                          <span>* {editErrors.problem_detected_at}</span>
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                        RECEIVED FROM (LINE/CELL) <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={editFormData.received_from}
                        onChange={(e) => {
                          setEditFormData(prev => ({ ...prev, received_from: e.target.value }));
                          if (editErrors.received_from && e.target.value) {
                            setEditErrors(prev => ({ ...prev, received_from: '' }));
                          }
                        }}
                        className={`w-full px-3 py-2 rounded-xl text-xs text-slate-900 outline-none transition cursor-pointer font-medium ${
                          editErrors.received_from
                            ? 'border border-rose-400 focus:ring-2 focus:ring-rose-400/20 focus:border-rose-500 bg-rose-50/20'
                            : 'bg-white border border-slate-300 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600'
                        }`}
                      >
                        <option value="">Select Line / Cell</option>
                        {IHLR_RECEIVED_FROM_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                        {editFormData.received_from && !IHLR_RECEIVED_FROM_OPTIONS.includes(editFormData.received_from) && (
                          <option value={editFormData.received_from}>{editFormData.received_from}</option>
                        )}
                      </select>
                      {editErrors.received_from && (
                        <p className="text-[11px] text-rose-500 font-semibold mt-1 flex items-center gap-1">
                          <span>* {editErrors.received_from}</span>
                        </p>
                      )}
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                        ANALYSIS DONE BY <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={editFormData.analysis_done_by}
                        onKeyDown={(e) => {
                          if (/[0-9]/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
                            e.preventDefault();
                            setEditErrors(prev => ({ ...prev, analysis_done_by: 'Only text / letters allowed, numbers are not allowed' }));
                          }
                        }}
                        onChange={(e) => {
                          const raw = e.target.value;
                          const cleaned = raw.replace(/[0-9]/g, '');
                          setEditFormData(prev => ({ ...prev, analysis_done_by: cleaned }));
                          if (/\d/.test(raw)) {
                            setEditErrors(prev => ({ ...prev, analysis_done_by: 'Only text / letters allowed, numbers are not allowed' }));
                          } else if (editErrors.analysis_done_by) {
                            setEditErrors(prev => ({ ...prev, analysis_done_by: '' }));
                          }
                        }}
                        placeholder="e.g. GURU"
                        className={`w-full px-3 py-2 rounded-xl text-xs font-semibold text-slate-900 outline-none transition ${
                          editErrors.analysis_done_by
                            ? 'border border-rose-400 focus:ring-2 focus:ring-rose-400/20 focus:border-rose-500 bg-rose-50/20'
                            : 'bg-white border border-slate-300 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600'
                        }`}
                      />
                      {editErrors.analysis_done_by && (
                        <p className="text-[11px] text-rose-500 font-semibold mt-1 flex items-center gap-1">
                          <span>* {editErrors.analysis_done_by}</span>
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* 📄 2. DEFECT PROBLEM DESCRIPTION (EDITABLE) */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-blue-600 text-xs font-bold uppercase tracking-wider">
                    <FileText className="w-4 h-4" />
                    <span>2. DEFECT PROBLEM DESCRIPTION</span>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                        PROBLEM / DEFECT PHENOMENON <span className="text-rose-500">*</span>
                      </label>
                      <textarea
                        rows={3}
                        value={editFormData.problem}
                        onChange={(e) => {
                          setEditFormData(prev => ({ ...prev, problem: e.target.value }));
                          if (editErrors.problem && e.target.value.trim()) {
                            setEditErrors(prev => ({ ...prev, problem: '' }));
                          }
                        }}
                        placeholder="Describe the defect phenomenon in detail..."
                        className={`w-full p-3 rounded-2xl text-xs text-slate-900 outline-none transition leading-relaxed ${
                          editErrors.problem
                            ? 'border border-rose-400 focus:ring-2 focus:ring-rose-400/20 focus:border-rose-500 bg-rose-50/20'
                            : 'bg-white border border-slate-300 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600'
                        }`}
                      />
                      {editErrors.problem && (
                        <p className="text-[11px] text-rose-500 font-semibold mt-1 flex items-center gap-1">
                          <span>* {editErrors.problem}</span>
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                        DETAILED DEFECT OCCURRENCE &amp; OBSERVATION
                      </label>
                      <textarea
                        rows={3}
                        value={editFormData.occurrence_cause}
                        onChange={(e) => setEditFormData(prev => ({ ...prev, occurrence_cause: e.target.value }))}
                        placeholder="Additional notes on defect occurrence, root observations, or line conditions..."
                        className="w-full p-3 bg-white border border-slate-300 rounded-2xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition leading-relaxed"
                      />
                    </div>
                  </div>
                </div>

                {/* 📎 3. ATTACHMENTS & EVIDENCE MANAGEMENT (EDITABLE) */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-blue-600 text-xs font-bold uppercase tracking-wider">
                      <Paperclip className="w-4 h-4" />
                      <span>3. DEFECT EVIDENCE &amp; ATTACHMENTS</span>
                      <span className="text-rose-500 font-bold">*</span>
                    </div>
                    <span className="text-[11px] text-slate-500 font-medium">
                      {editAttachments.length + newFiles.length} file(s) attached
                    </span>
                  </div>

                  {/* Existing Attachments with Delete Action */}
                  {editAttachments.length > 0 && (
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                        Current Files (Click eye to preview, trash to remove)
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {editAttachments.map((att, idx) => (
                          <div
                            key={idx}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-medium text-slate-800 shadow-2xs group"
                          >
                            <span className="truncate max-w-[200px]">{att.name || att.filename || `File-${idx + 1}`}</span>
                            <button
                              type="button"
                              onClick={() => setPreviewAttachment(att)}
                              className="p-1 text-blue-600 hover:bg-blue-50 rounded-md transition cursor-pointer"
                              title="Preview File"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveExistingAttachment(idx)}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition cursor-pointer"
                              title="Remove File"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Newly Added Files */}
                  {newFiles.length > 0 && (
                    <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-200 space-y-2">
                      <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider block mb-1">
                        Newly Selected Files (To be uploaded on save)
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {newFiles.map((file, idx) => (
                          <div
                            key={idx}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-blue-200 text-xs font-medium text-blue-900 shadow-2xs"
                          >
                            <span className="truncate max-w-[200px]">{file.name}</span>
                            <span className="text-[10px] text-slate-400">({(file.size / 1024).toFixed(1)} KB)</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveNewFile(idx)}
                              className="p-1 text-rose-500 hover:bg-rose-50 rounded-md transition cursor-pointer"
                              title="Remove"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* File Upload Trigger */}
                  <label className={`flex items-center justify-center gap-2.5 p-4 rounded-2xl border-2 border-dashed transition cursor-pointer text-xs font-semibold ${
                    editErrors.attachments
                      ? 'border-rose-400 bg-rose-50/30 hover:border-rose-500 text-rose-700'
                      : 'border-slate-300 hover:border-blue-500 bg-slate-50/60 hover:bg-blue-50/40 text-slate-700'
                  }`}>
                    <UploadCloud className={`w-4 h-4 ${editErrors.attachments ? 'text-rose-500' : 'text-blue-600'}`} />
                    <span>Upload Additional Evidence (Images, PDF, Excel, Word, PPT)</span>
                    <input
                      type="file"
                      multiple
                      onChange={handleNewFilesSelect}
                      className="hidden"
                      accept=".jpg,.jpeg,.jfif,.png,.webp,.bmp,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,image/jpeg,image/png,image/jfif,image/pjpeg,image/*"
                    />
                  </label>
                  {editErrors.attachments && (
                    <p className="text-[11px] text-rose-500 font-semibold mt-1 flex items-center gap-1">
                      <span>* {editErrors.attachments}</span>
                    </p>
                  )}
                </div>

                {/* 🔬 4. QA 5-WHY ROOT CAUSE ANALYSIS (EDITABLE) */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-amber-600 text-xs font-bold uppercase tracking-wider">
                      <ShieldCheck className="w-4 h-4" />
                      <span>4. QA PROBLEM CAUSE (5-WHY ROOT CAUSE ANALYSIS)</span>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-full flex items-center gap-1">
                      <span>W1 Mandatory</span>
                      <span className="text-red-500 font-bold">*</span>
                    </span>
                  </div>

                  <div className="p-4 rounded-2xl bg-amber-50/40 border border-amber-200 space-y-3 text-xs">
                    <div className="flex items-center gap-2 pb-2 border-b border-amber-200/60">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                        QA Problem Cause (5-Why Breakdown)
                      </h4>
                    </div>
                    <div className="space-y-2.5">
                      {['W1', 'W2', 'W3', 'W4', 'W5'].map((wLabel, idx) => {
                        const isW1 = idx === 0;
                        const hasW1Error = isW1 && Boolean(editErrors.w1);
                        return (
                          <div key={idx} className="space-y-1">
                            <div className="flex items-center gap-2.5">
                              <span className={`px-2.5 py-1.5 rounded-lg font-mono font-black text-[11px] border shrink-0 transition ${
                                isW1
                                  ? hasW1Error
                                    ? 'bg-rose-50 border-rose-300 text-rose-700'
                                    : 'bg-amber-100 text-amber-800 border-amber-200'
                                  : 'bg-amber-100 text-amber-800 border-amber-200'
                              }`}>
                                {wLabel}:{isW1 && <span className="text-rose-500 ml-0.5 font-bold">*</span>}
                              </span>
                              <input
                                type="text"
                                value={editQaWhyWhy[idx] || ''}
                                onChange={(e) => {
                                  const copy = [...editQaWhyWhy];
                                  copy[idx] = e.target.value;
                                  setEditQaWhyWhy(copy);
                                  if (isW1 && editErrors.w1 && e.target.value.trim()) {
                                    setEditErrors(prev => ({ ...prev, w1: '' }));
                                  }
                                }}
                                placeholder={`QA Root Cause Level ${idx + 1}...${isW1 ? ' (Mandatory)' : ''}`}
                                className={`flex-1 px-3 py-1.5 rounded-xl text-xs text-slate-800 outline-none transition ${
                                  hasW1Error
                                    ? 'border border-rose-400 focus:ring-2 focus:ring-rose-400/20 focus:border-rose-500 bg-rose-50/20'
                                    : 'bg-white border border-amber-200/80 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500'
                                }`}
                              />
                            </div>
                            {hasW1Error && (
                              <p className="text-[11px] text-rose-500 font-semibold mt-1 flex items-center gap-1 pl-10">
                                <span>* {editErrors.w1}</span>
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* TAB 1: REQUESTER DETAILS - VIEW MODE */
              <div className="space-y-6 animate-in fade-in duration-150">
                {/* 📁 1. GENERAL INFORMATION & DEFECT PARAMETERS */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-blue-600 text-xs font-bold uppercase tracking-wider">
                    <Folder className="w-4 h-4" />
                    <span>1. INCIDENT &amp; LINE DEFECT DETAILS</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-y-4 gap-x-6 text-xs p-4 rounded-2xl bg-slate-50/70 border border-slate-200/80">
                    <div>
                      <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        REQ NO
                      </span>
                      <span className="font-bold text-slate-900 font-mono text-sm">
                        {req.req_no || `IHLR-${req.id}`}
                      </span>
                    </div>

                    <div>
                      <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        INCIDENT DATE
                      </span>
                      <span className="font-medium text-slate-800">
                        {formatDate(req.batch_date)}
                      </span>
                    </div>

                    <div>
                      <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        SHIFT
                      </span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="font-semibold text-slate-800">
                          {formatIhlrShiftDisplay(req.shift)}
                        </span>
                        {getIhlrShiftDetails(req.shift)?.timeDisplay && (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-mono font-medium border border-blue-100">
                            {getIhlrShiftDetails(req.shift).timeDisplay}
                          </span>
                        )}
                      </div>
                    </div>

                    <div>
                      <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                        STATUS
                      </span>
                      {getStatusBadge(req.status)}
                    </div>

                    <div>
                      <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        4M CATEGORY
                      </span>
                      <span className="font-bold text-amber-700 font-mono">
                        {req.four_m || 'N/A'}
                      </span>
                    </div>

                    <div>
                      <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        RESPONSIBILITY (DEPT)
                      </span>
                      <span className="font-bold text-slate-900 font-mono">
                        {req.resp || 'N/A'}
                      </span>
                      {req.resp_person && (
                        <span className="block text-[11px] text-blue-600 font-semibold mt-0.5">
                          {req.resp_person}
                        </span>
                      )}
                    </div>

                    {/* Show Reassigned Status field strictly in case of reassign status */}
                    {hasReassignments && (
                      <div>
                        <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                          REASSIGNED STATUS
                        </span>
                        <span className="inline-flex items-center gap-1 font-bold text-purple-700 font-mono text-xs mt-0.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                          Yes ({reassignCount} {reassignCount === 1 ? 'time' : 'times'})
                        </span>
                      </div>
                    )}

                    <div>
                      <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        MODEL NAME / PART
                      </span>
                      <span className="font-bold text-slate-900">
                        {req.model || 'N/A'}
                      </span>
                    </div>

                    <div>
                      <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        REJECTED QTY
                      </span>
                      <span className="font-bold text-slate-900 font-mono">
                        {req.actual_qty || '1'}
                      </span>
                    </div>

                    <div>
                      <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        DETECTED AT
                      </span>
                      <span className="font-medium text-slate-800">
                        {req.problem_detected_at || 'Line Inspection'}
                      </span>
                    </div>

                    <div>
                      <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        RECEIVED FROM (LINE/CELL)
                      </span>
                      <span className="font-medium text-slate-800 font-mono">
                        {req.received_from || 'Assembly Line'}
                      </span>
                    </div>

                    <div className="sm:col-span-2">
                      <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        ANALYSIS DONE BY
                      </span>
                      <span className="font-bold text-slate-900 block">
                        {req.analysis_done_by || 'Admin'}
                      </span>
                    </div>
                  </div>

                  {/* Reassignment Tracking History Audit Trail (Only shown in case of reassign status) */}
                  {hasReassignments && (
                    <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-50/70 via-indigo-50/40 to-slate-50 border border-purple-200/90 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-purple-800 text-xs font-bold uppercase tracking-wider">
                          <ArrowRightLeft className="w-4 h-4 text-purple-600" />
                          <span>REASSIGNMENT TRACKING HISTORY ({reassignCount})</span>
                        </div>
                        <span className="text-[10px] font-bold px-2.5 py-0.5 bg-purple-100 text-purple-800 rounded-full border border-purple-200 font-mono">
                          Reassigned: Yes
                        </span>
                      </div>

                      <div className="space-y-2">
                        {reassignList.map((entry, idx) => (
                          <div key={idx} className="p-3 bg-white rounded-xl border border-purple-100 shadow-2xs space-y-1.5 text-xs">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 font-mono font-bold text-[10px]">
                                  #{idx + 1}
                                </span>
                                <span className="text-slate-600 font-medium">
                                  From: <strong className="text-slate-900">{entry.prev_resp_person || '—'}</strong> ({entry.prev_resp || '—'})
                                </span>
                                <ArrowRightLeft className="w-3 h-3 text-purple-400 inline" />
                                <span className="text-purple-700 font-medium">
                                  To: <strong className="text-purple-900">{entry.new_resp_person || '—'}</strong> ({entry.new_resp || '—'})
                                </span>
                              </div>
                              <span className="text-[11px] text-slate-500 font-mono">
                                {[entry.reassigned_by ? `by ${entry.reassigned_by}` : '', entry.reassigned_at ? formatDate(entry.reassigned_at) : ''].filter(Boolean).join(' • ')}
                              </span>
                            </div>
                            {entry.remarks && (
                              <div className="text-[11px] text-slate-700 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100 italic">
                                <span className="font-semibold text-slate-500 not-italic">Remarks: </span>
                                {entry.remarks}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* 📄 2. DEFECT PROBLEM DESCRIPTION */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-blue-600 text-xs font-bold uppercase tracking-wider">
                    <FileText className="w-4 h-4" />
                    <span>2. DEFECT PROBLEM DESCRIPTION</span>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        PROBLEM / DEFECT PHENOMENON
                      </span>
                      <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl text-xs text-slate-700 leading-relaxed font-normal min-h-[50px]">
                        {req.problem || 'No defect description logged.'}
                      </div>
                    </div>

                    <div>
                      <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        DETAILED DEFECT OCCURRENCE &amp; OBSERVATION
                      </span>
                      <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl text-xs text-slate-700 leading-relaxed font-normal min-h-[60px]">
                        {req.occurrence_cause || req.problem || 'No detailed occurrence observations recorded.'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 📎 3. ATTACHMENTS & TECHNICAL EVIDENCE */}
                {attachments.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-blue-600 text-xs font-bold uppercase tracking-wider">
                        <Paperclip className="w-4 h-4" />
                        <span>3. DEFECT EVIDENCE &amp; ATTACHMENTS ({attachments.length})</span>
                      </div>
                      <span className="text-[11px] text-slate-400 font-medium">Click any file to preview or inspect</span>
                    </div>

                    <AttachmentChipList
                      attachments={attachments}
                      onPreview={(att) => setPreviewAttachment(att)}
                      readonly={true}
                    />
                  </div>
                )}

                {/* 🔬 4. QA 5-WHY ROOT CAUSE ANALYSIS */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-amber-600 text-xs font-bold uppercase tracking-wider">
                      <ShieldCheck className="w-4 h-4" />
                      <span>4. QA PROBLEM CAUSE (5-WHY ROOT CAUSE ANALYSIS)</span>
                    </div>
                    <span className="text-[11px] text-slate-400 font-mono">Logged by Requester / QA</span>
                  </div>

                  <div className="p-4 rounded-2xl bg-amber-50/40 border border-amber-200/80 space-y-3 text-xs">
                    <div className="flex items-center gap-2 pb-2 border-b border-amber-200/60">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                        QA Problem Cause (5-Why Breakdown)
                      </h4>
                    </div>
                    <div className="space-y-2">
                      {(() => {
                        const validWhys = (Array.isArray(req.qa_why_why) ? req.qa_why_why : [])
                          .map((w, idx) => ({
                            label: `W${idx + 1}`,
                            val: typeof w === 'string' ? w.trim() : (w ? String(w).trim() : '')
                          }))
                          .filter((item) => item.val.length > 0);

                        if (validWhys.length > 0) {
                          return validWhys.map((item, idx) => (
                            <div key={idx} className="flex items-start gap-2">
                              <span className="font-mono font-bold text-amber-700 shrink-0">
                                {item.label}:{item.label === 'W1' && <span className="text-red-500 font-bold ml-0.5">*</span>}
                              </span>
                              <span className="text-slate-800 leading-relaxed font-medium">{item.val}</span>
                            </div>
                          ));
                        }

                        return (
                          <div className="flex items-start gap-2">
                            <span className="font-mono font-bold text-amber-700 shrink-0">
                              W1:<span className="text-red-500 font-bold ml-0.5">*</span>
                            </span>
                            <span className="text-slate-400 italic">No entry recorded</span>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>

                {/* Quick Switch Banner to Closer Details */}
                <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50/60 border border-blue-200/80 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2.5 text-slate-700">
                    <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                      <Wrench className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="font-bold text-slate-900 block">Occurrence Analysis &amp; Closer Details</span>
                      <span className="text-[11px] text-slate-500">
                        Production 5-Why, containment action countermeasure, and closer evidence are in the Closer tab.
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (isEditMode) {
                        setIsEditMode(false);
                      }
                      setActiveTab('closer');
                    }}
                    className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
                  >
                    <span>View Closer Details</span>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="p-4 sm:p-5 border-t border-slate-100 bg-white flex items-center justify-between shrink-0">
            {isEditMode && activeTab === 'requester' ? (
              <>
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
                  <span className="font-semibold text-slate-800">Updating Requester Details only.</span>
                  <span className="hidden sm:inline text-slate-400">Closer details and status are preserved.</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      initEditState(req);
                      setIsEditMode(false);
                    }}
                    disabled={isSavingRequester}
                    className="px-4 py-2 bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 font-semibold text-xs rounded-xl border border-slate-300 transition cursor-pointer"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveRequesterDetails}
                    disabled={isSavingRequester}
                    className="flex items-center gap-1.5 px-5 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50"
                  >
                    {isSavingRequester ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Saving Changes...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4 stroke-[2.5]" />
                        <span>Save Requester Details</span>
                      </>
                    )}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div>
                  {isClosed && activeTab === 'closer' ? (
                    evidenceAttachments.length > 0 && (
                      <span className="text-xs text-slate-400 font-medium">
                        {evidenceAttachments.length} closer evidence attachment{evidenceAttachments.length > 1 ? 's' : ''} available
                      </span>
                    )
                  ) : (
                    attachments.length > 0 && (
                      <span className="text-xs text-slate-400 font-medium">
                        {attachments.length} attachment{attachments.length > 1 ? 's' : ''} available
                      </span>
                    )
                  )}
                </div>

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowExportModal(true);
                    }}
                    className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-xs rounded-xl shadow-xs transition cursor-pointer"
                    id="modal-export-btn"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export Report</span>
                  </button>

                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 font-semibold text-xs rounded-xl border border-slate-300 transition cursor-pointer"
                  >
                    Close Details
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Attachment Preview Modal (Works for Excel, PDF, Images, Word) */}
      <IhlrAttachmentPreviewModal
        isOpen={Boolean(previewAttachment)}
        attachment={previewAttachment}
        onClose={() => setPreviewAttachment(null)}
      />

      {/* Universal Export Format Selection Modal */}
      <ExportSelectionModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        title={`Export Report ${String(req?.req_no || '').startsWith('IHLR-') ? req?.req_no : `#${req?.req_no}`}`}
        subtitle="Choose whether to download as Excel or PDF document"
        scopeText="Single Inspection Report"
        onExportExcel={handleExportExcel}
        onExportPdf={handleExportPdf}
      />
    </>,
    document.body
  );
};

export default IhlrRequestDetailsModal;
