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
  ArrowRightLeft,
  Lock,
  Loader2,
  History
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
  const isQad = userDept === 'QAD';
  const isAdmin = userRole === 'ADMIN' || isQad;

  const [localRequest, setLocalRequest] = useState(request);
  const [activeTab, setActiveTab] = useState('requester'); // 'requester' | 'closer' | 'sign_tracks'
  const [previewAttachment, setPreviewAttachment] = useState(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFormat, setExportFormat] = useState('excel'); // 'excel' | 'pdf'

  // Admin Review & Sign-Off States (Tab 3: Sign Fields & Tracks)
  const [adminRemarks, setAdminRemarks] = useState('');
  const [adminReviewedBy, setAdminReviewedBy] = useState('');
  const [adminStatus, setAdminStatus] = useState('');
  const [isSavingAdmin, setIsSavingAdmin] = useState(false);
  const [adminErrors, setAdminErrors] = useState({});

  // Reassignment States (Tab 3: Sign Fields & Tracks)
  const [isReassignOpen, setIsReassignOpen] = useState(false);
  const [reassignedDept, setReassignedDept] = useState('');
  const [reassignedPerson, setReassignedPerson] = useState('');
  const [reassignRemarks, setReassignRemarks] = useState('');
  const [isReassignUserDropdownOpen, setIsReassignUserDropdownOpen] = useState(false);
  const [reassignUserSearch, setReassignUserSearch] = useState('');
  const reassignDropdownRef = useRef(null);

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
    created_by: '',
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

  // Editing feature is restricted to Admin role only
  const canEditRequester = Boolean(req && isAdmin && (!isClosed || isAdmin));

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
      created_by: targetReq.created_by || user?.name || user?.email || 'Admin',
      problem: targetReq.problem || '',
      occurrence_cause: targetReq.occurrence_cause || targetReq.detailed_observation || ''
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

  const initAdminState = (targetReq = req) => {
    if (!targetReq) return;
    const historyInfo = formatReassignmentHistory(targetReq.reassignment_history);
    const latestReassign = historyInfo.list && historyInfo.list.length > 0 ? historyInfo.list[historyInfo.list.length - 1] : null;
    const effRemarks = targetReq.remarks || latestReassign?.remarks || '';
    const effReviewedBy = targetReq.reviewed_by || latestReassign?.reassigned_by || user?.name || '';
    setAdminRemarks(effRemarks);
    setAdminReviewedBy(effReviewedBy);
    setAdminStatus(targetReq.status === 'CLOSED' ? 'CLOSED' : '');
    setIsReassignOpen(false);
    setReassignedDept(targetReq.resp || 'PRODUCTION');
    setReassignedPerson(targetReq.resp_person || '');
    setReassignRemarks('');
    setIsReassignUserDropdownOpen(false);
    setReassignUserSearch('');
    setAdminErrors({});
  };

  useEffect(() => {
    setLocalRequest(request);
    if (isOpen && request) {
      initEditState(request);
      initAdminState(request);
      if (initialEditMode && isAdmin) {
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
      }).catch(() => { });
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (userDropdownRef.current && !userDropdownRef.current.contains(e.target)) {
        setIsUserDropdownOpen(false);
      }
      if (reassignDropdownRef.current && !reassignDropdownRef.current.contains(e.target)) {
        setIsReassignUserDropdownOpen(false);
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

  const STANDARD_DEPTS = [
    'QAD',
    'PRODUCTION',
    'MAINTENANCE',
    'PED',
    'MATERIALS',
    'MARKETING',
    'INCOMING QUALITY'
  ];

  const departmentList = Array.from(
    new Set([
      ...STANDARD_DEPTS,
      ...dbUsers.filter(isUserActive).map((u) => (u.department || '').trim().toUpperCase()).filter(Boolean)
    ])
  ).sort();

  const getSelectedReassignedUsers = () => {
    if (!reassignedPerson) return [];
    return reassignedPerson
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  };

  const handleToggleReassignUser = (userName) => {
    const current = getSelectedReassignedUsers();
    let updated;
    if (current.includes(userName)) {
      updated = current.filter((u) => u !== userName);
    } else {
      updated = [...current, userName];
    }
    setReassignedPerson(updated.join(', '));
    if (updated.length > 0) {
      setAdminErrors(prev => ({ ...prev, reassignPerson: '' }));
    }
  };

  const handleClearAllReassignUsers = () => {
    setReassignedPerson('');
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
    if (!isAdmin) {
      modalError('Editing feature is restricted to Admin role only.');
      return;
    }
    const newErrors = {};

    const todayStr = new Date().toISOString().split('T')[0];
    if (!editFormData.batch_date || !editFormData.batch_date.trim()) {
      newErrors.batch_date = 'Incident Date is required';
    } else if (editFormData.batch_date > todayStr) {
      newErrors.batch_date = 'Incident Date cannot be a future date. Please select today or a past date.';
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
    if (editFormData.created_by && /\d/.test(editFormData.created_by)) {
      newErrors.created_by = 'Created By must contain text only, numbers are not allowed';
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
        created_by: editFormData.created_by?.trim() || req.created_by || user?.name || user?.email || 'Admin',
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

  const isSelectedClosed = String(req?.status || '').toUpperCase() === 'CLOSED';
  const isSelectedOpen = String(req?.status || '').toUpperCase() === 'OPEN';

  const hasCloserSubmitted = Boolean(
    req && !isSelectedOpen && (
      String(req.status || '').toUpperCase() === 'IN_PROGRESS' ||
      String(req.status || '').toUpperCase() === 'CLOSED' ||
      String(req.status || '').toUpperCase() === 'APPROVAL_PENDING' ||
      String(req.status || '').toUpperCase() === 'AWAITING_REVIEW' ||
      String(req.status || '').toUpperCase() === 'AWAITING REVIEW' ||
      Boolean(
        (req.temporary_action || req.permanent_fix) &&
        (req.temporary_target_date || req.permanent_target_date)
      )
    )
  );

  const isCloserDataToBeUpdated = Boolean(req && (isSelectedOpen || !hasCloserSubmitted));

  const handleSaveAdminSignOff = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!req) return;

    if (!isAdmin) {
      modalError('Only Quality Admin has permission to update Admin Review and sign off status.');
      return;
    }

    const errors = {};

    if (isReassignOpen) {
      if (!reassignedDept) errors.reassignDept = 'Department is required for reassignment.';
      if (!reassignedPerson || !reassignedPerson.trim()) errors.reassignPerson = 'Responsible person is required for reassignment.';
    } else {
      if (!adminRemarks || !adminRemarks.trim()) {
        errors.remarks = 'Admin remarks are mandatory for sign-off.';
      }
      if (adminReviewedBy && /\d/.test(adminReviewedBy)) {
        errors.reviewedBy = 'Reviewed By must contain text only, numbers are not allowed.';
      }
      if (!adminStatus) {
        errors.status = 'Please select a status to finalize admin sign-off.';
      }
    }

    if (Object.keys(errors).length > 0) {
      setAdminErrors(errors);
      modalError('Please complete all required fields indicated in red.');
      return;
    }

    setAdminErrors({});
    setIsSavingAdmin(true);

    try {
      const effectiveReviewer = (adminReviewedBy && adminReviewedBy.trim())
        ? adminReviewedBy.trim()
        : (user?.name || 'Admin');

      const effectiveRemarks = isReassignOpen
        ? ((reassignRemarks && reassignRemarks.trim()) ||
          (adminRemarks && adminRemarks.trim()) ||
          `Reassigned to ${reassignedPerson} (${reassignedDept}) for analysis by ${effectiveReviewer}.`)
        : adminRemarks.trim();

      const payload = {
        remarks: effectiveRemarks,
        reviewed_by: effectiveReviewer,
        reviewed_by_id: user?.id || null,
        reviewed_by_email: user?.email || null,
        status: isReassignOpen ? 'OPEN' : (adminStatus || 'CLOSED')
      };

      if (isReassignOpen) {
        payload.is_reassign = true;
        payload.reassigned_by = effectiveReviewer;
        payload.reassign_remarks = effectiveRemarks;
        if (reassignedDept) payload.resp = reassignedDept;
        if (reassignedPerson) {
          payload.resp_person = reassignedPerson;
          const names = reassignedPerson.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
          const matchedEmails = dbUsers
            .filter((u) => names.includes((u.name || '').trim().toLowerCase()))
            .map((u) => u.email)
            .filter(Boolean);
          if (matchedEmails.length > 0) {
            payload.resp_person_email = matchedEmails.join(', ');
          }
        }
      }

      if (user) {
        payload.user = {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          department: user.department
        };
      }

      const updated = await ihlrService.updateRequest(req.id, payload);
      const merged = {
        ...req,
        ...payload,
        ...(updated || {})
      };

      setLocalRequest(merged);
      initAdminState(merged);
      setIsReassignOpen(false);
      setIsReassignUserDropdownOpen(false);
      setReassignUserSearch('');
      onUpdated?.(merged);

      const isReassigned = isReassignOpen && (
        (reassignedPerson && reassignedPerson !== req.resp_person) ||
        (reassignedDept && reassignedDept !== req.resp)
      );

      const msg = isReassigned
        ? `Report status updated & reassigned to ${reassignedPerson} (${reassignedDept}) successfully for ${req.req_no || `IHLR-${req.id}`}!`
        : `Admin remarks & status sign-off updated successfully for ${req.req_no || `IHLR-${req.id}`}!`;

      modalSuccess(msg);
    } catch (err) {
      console.error('Failed to save admin sign-off / reassignment:', err);
      const errMsg = err.response?.data?.message || err.message || 'Failed to save admin sign-off. Please try again.';
      modalError(errMsg);
    } finally {
      setIsSavingAdmin(false);
    }
  };

  useEffect(() => {
    setActiveTab('requester');
  }, [request?.id]);

  if (!isOpen || !request) return null;

  const attachments = parseAttachments(req.defect_image);
  const evidenceAttachments = parseAttachments(req.temporary_evidence_attachment || req.evidence_attachment);
  const permanentEvidenceAttachments = parseAttachments(req.permanent_evidence_attachment);

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
        Boolean((request.temporary_action || request.permanent_fix) && String(request.temporary_action || request.permanent_fix).trim()) &&
        Boolean(request.temporary_target_date || request.permanent_target_date) &&
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
  const getExportImages = async (targetReq) => {
    const isImg = (a) => {
      if (!a) return false;
      if (a.isImage) return true;
      const n = a.name || a.filename || (typeof a === 'string' ? a : '');
      const ext = (n.split('.').pop() || '').toUpperCase();
      return ['PNG', 'JPG', 'JPEG', 'WEBP', 'GIF', 'BMP', 'SVG', 'JFIF'].includes(ext);
    };

    const reqData = targetReq || localRequest || request || {};
    const dFiles = parseAttachments(reqData.defect_image);
    const tFiles = parseAttachments(reqData.temporary_evidence_attachment || reqData.evidence_attachment);
    const pFiles = parseAttachments(reqData.permanent_evidence_attachment);

    const items = [
      ...dFiles.filter(isImg).map((a) => ({ ...a, label: 'Defect Image' })),
      ...tFiles.filter(isImg).map((a) => ({ ...a, label: 'Temporary Evidence Image' })),
      ...pFiles.filter(isImg).map((a) => ({ ...a, label: 'Permanent Evidence Image' }))
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

      const targetReq = localRequest || request;
      const reqNo = String(targetReq.req_no || '').startsWith('IHLR-') ? targetReq.req_no : `#${targetReq.req_no}`;
      const batchDate = formatDate(targetReq.batch_date);
      const shiftStr = formatShift(targetReq.shift);
      const safeReqNo = String(targetReq.req_no || targetReq.id || 'Report').replace(/[^a-zA-Z0-9_-]/g, '_');

      // Fetch images for embedding in PDF
      const exportImages = await getExportImages(targetReq);
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

      const displayStatus = getIhlrDisplayStatus(targetReq.status, targetReq);
      const isClosedStatus = displayStatus === 'CLOSED';

      // Parse and format all attachments
      const parsedDefectFiles = parseAttachments(targetReq.defect_image);
      const parsedTempEvidence = parseAttachments(targetReq.temporary_evidence_attachment || targetReq.evidence_attachment);
      const parsedPermEvidence = parseAttachments(targetReq.permanent_evidence_attachment);

      const defectFilesStr = parsedDefectFiles.length > 0 ? parsedDefectFiles.map((a) => a.name).join(', ') : 'None';
      const tempEvidenceStr = parsedTempEvidence.length > 0 ? parsedTempEvidence.map((a) => a.name).join(', ') : 'None';
      const permEvidenceStr = parsedPermEvidence.length > 0 ? parsedPermEvidence.map((a) => a.name).join(', ') : 'None';

      // Temporary Action & Target Date
      const tempActionVal = targetReq.temporary_action || targetReq.action || '—';
      const tempTargetDateVal = targetReq.temporary_target_date || targetReq.target_date
        ? formatDate(targetReq.temporary_target_date || targetReq.target_date)
        : '—';

      // Permanent Fix & Target Date
      const permFixVal = targetReq.permanent_fix || '—';
      const permTargetDateVal = targetReq.permanent_target_date
        ? formatDate(targetReq.permanent_target_date)
        : '—';

      // Closer & Dept
      const respDept = targetReq.resp || '—';
      const respPerson = targetReq.resp_person || '—';

      // Closure details
      const closedByVal = isClosedStatus
        ? (targetReq.reviewed_by || targetReq.closed_by || targetReq.resp_person || user?.name || 'QAD Admin')
        : (targetReq.reviewed_by ? `Reviewed: ${targetReq.reviewed_by}` : 'Pending Closure Authorization');
      const closedDateVal = isClosedStatus
        ? (formatDate(targetReq.closed_at || targetReq.updated_at || targetReq.temporary_target_date || targetReq.permanent_target_date || targetReq.created_at) || '—')
        : '—';

      // Reassignment History
      const { hasReassignments, reassignmentDetails } = formatReassignmentHistory(targetReq.reassignment_history);
      const reassignVal = hasReassignments ? reassignmentDetails : 'None (Original Assignee)';

      // Section 1: Basic Information (Structured 4-Column Key-Value Grid)
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
              content: '1. INCIDENT & IDENTIFICATION DETAILS',
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
            { content: 'Report No:', styles: { fontStyle: 'bold', textColor: [71, 85, 105], fillColor: [248, 250, 252] } },
            { content: reqNo, styles: { fontStyle: 'bold', textColor: [37, 99, 235] } },
            { content: 'Current Status:', styles: { fontStyle: 'bold', textColor: [71, 85, 105], fillColor: [248, 250, 252] } },
            {
              content: displayStatus,
              styles: {
                fontStyle: 'bold',
                textColor: isClosedStatus
                  ? [22, 101, 52]
                  : (displayStatus === 'AWAITING REVIEW' || displayStatus === 'APPROVAL PENDING')
                    ? [180, 83, 9]
                    : [225, 29, 72]
              }
            }
          ],
          [
            { content: 'Incident Date:', styles: { fontStyle: 'bold', textColor: [71, 85, 105], fillColor: [248, 250, 252] } },
            batchDate,
            { content: 'Work Shift:', styles: { fontStyle: 'bold', textColor: [71, 85, 105], fillColor: [248, 250, 252] } },
            shiftStr
          ],
          [
            { content: 'Model Name / Part:', styles: { fontStyle: 'bold', textColor: [71, 85, 105], fillColor: [248, 250, 252] } },
            targetReq.model || '—',
            { content: 'Actual Rejected Qty:', styles: { fontStyle: 'bold', textColor: [71, 85, 105], fillColor: [248, 250, 252] } },
            targetReq.actual_qty ? `${targetReq.actual_qty} Nos` : '1 Nos'
          ],
          [
            { content: 'Problem Detected At:', styles: { fontStyle: 'bold', textColor: [71, 85, 105], fillColor: [248, 250, 252] } },
            targetReq.problem_detected_at || '—',
            { content: 'Received From (Line/Cell):', styles: { fontStyle: 'bold', textColor: [71, 85, 105], fillColor: [248, 250, 252] } },
            targetReq.received_from || '—'
          ],
          [
            { content: 'Analysis Done By:', styles: { fontStyle: 'bold', textColor: [71, 85, 105], fillColor: [248, 250, 252] } },
            targetReq.analysis_done_by || '—',
            { content: '4M Category:', styles: { fontStyle: 'bold', textColor: [71, 85, 105], fillColor: [248, 250, 252] } },
            targetReq.four_m || '—'
          ],
          [
            { content: 'Responsibility (Resp):', styles: { fontStyle: 'bold', textColor: [71, 85, 105], fillColor: [248, 250, 252] } },
            respDept,
            { content: 'User Name (Based on Dep):', styles: { fontStyle: 'bold', textColor: [71, 85, 105], fillColor: [248, 250, 252] } },
            respPerson
          ],
          [
            { content: 'Raised By (Requester):', styles: { fontStyle: 'bold', textColor: [71, 85, 105], fillColor: [248, 250, 252] } },
            targetReq.created_by || '—',
            { content: 'Requester Email:', styles: { fontStyle: 'bold', textColor: [71, 85, 105], fillColor: [248, 250, 252] } },
            targetReq.created_by_email || '—'
          ],
          [
            { content: 'Issue Created At:', styles: { fontStyle: 'bold', textColor: [71, 85, 105], fillColor: [248, 250, 252] } },
            targetReq.created_at ? formatDate(targetReq.created_at) : '—',
            { content: 'Last Updated At:', styles: { fontStyle: 'bold', textColor: [71, 85, 105], fillColor: [248, 250, 252] } },
            targetReq.updated_at ? formatDate(targetReq.updated_at) : (targetReq.created_at ? formatDate(targetReq.created_at) : '—')
          ]
        ]
      });

      // Section 2: Defect Problem & Observation Description (Structured 2-Column Key-Value Grid)
      const lastY = doc.lastAutoTable.finalY + 8;
      autoTable(doc, {
        startY: lastY,
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
              content: '2. DEFECT PROBLEM & OBSERVATION DESCRIPTION',
              colSpan: 2,
              styles: {
                fillColor: [59, 130, 246], // blue-500
                textColor: [255, 255, 255],
                fontStyle: 'bold',
                fontSize: 8.5
              }
            }
          ]
        ],
        body: [
          [
            { content: 'Problem / Defect Description:', styles: { fontStyle: 'bold', textColor: [71, 85, 105], fillColor: [248, 250, 252] } },
            { content: targetReq.problem || '—' }
          ],
          [
            { content: 'Defect Attachment(s) (Requester):', styles: { fontStyle: 'bold', textColor: [71, 85, 105], fillColor: [248, 250, 252] } },
            { content: defectFilesStr }
          ]
        ],
        styles: { fontSize: 8, cellPadding: 3.5, valign: 'middle' }
      });

      // Section 3: 5-Why Analysis (Structured 3-Column Table for all W1 to W5)
      const whyY = doc.lastAutoTable.finalY + 8;
      const parseWhyList = (val) => {
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

      const qaWhys = parseWhyList(targetReq.qa_why_why || targetReq.why_why);
      const prodWhys = parseWhyList(targetReq.prod_why_why);

      const whyRows = [];
      for (let i = 0; i < 5; i++) {
        const qa = (qaWhys[i] && String(qaWhys[i]).trim()) || '—';
        const prod = (prodWhys[i] && String(prodWhys[i]).trim()) || '—';
        if (i === 0 || qa !== '—' || prod !== '—') {
          whyRows.push([`Why ${i + 1} (W${i + 1})`, qa, prod]);
        }
      }

      autoTable(doc, {
        startY: whyY,
        theme: 'grid',
        margin: { left: 40, right: 40 },
        tableWidth: 515,
        head: [
          [
            {
              content: '3. ROOT CAUSE ANALYSIS (5-WHY)',
              colSpan: 3,
              styles: {
                fillColor: [245, 158, 11], // amber-500
                textColor: [255, 255, 255],
                fontStyle: 'bold',
                fontSize: 8.5
              }
            }
          ],
          [
            { content: 'LEVEL', styles: { halign: 'center', fontStyle: 'bold' } },
            { content: 'QA PROBLEM INVESTIGATION (5-WHY)', styles: { fontStyle: 'bold' } },
            { content: 'PRODUCTION OCCURRENCE CAUSE (5-WHY)', styles: { fontStyle: 'bold' } }
          ]
        ],
        body: whyRows,
        headStyles: { fillColor: [245, 158, 11], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
        columnStyles: {
          0: { cellWidth: 65, fontStyle: 'bold', halign: 'center' },
          1: { cellWidth: 225 },
          2: { cellWidth: 225 }
        },
        styles: { fontSize: 8, cellPadding: 3.5, valign: 'middle' }
      });

      // Section 4: Containment Action & Closure (Structured 2-Column Key-Value Grid)
      const actionY = doc.lastAutoTable.finalY + 8;
      autoTable(doc, {
        startY: actionY,
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
              content: '4. CONTAINMENT COUNTERMEASURE & CLOSURE SIGN-OFF',
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
            { content: 'Temporary Action (Containment):', styles: { fontStyle: 'bold', textColor: [71, 85, 105], fillColor: [248, 250, 252] } },
            { content: tempActionVal }
          ],
          [
            { content: 'Temporary Target Date:', styles: { fontStyle: 'bold', textColor: [71, 85, 105], fillColor: [248, 250, 252] } },
            { content: tempTargetDateVal }
          ],
          [
            { content: 'Temporary Closed By:', styles: { fontStyle: 'bold', textColor: [71, 85, 105], fillColor: [248, 250, 252] } },
            { content: targetReq.temporary_closed_by || '—' }
          ],
          [
            { content: 'Temporary Evidence Attachment(s):', styles: { fontStyle: 'bold', textColor: [71, 85, 105], fillColor: [248, 250, 252] } },
            { content: tempEvidenceStr }
          ],
          [
            { content: 'Permanent Action (Countermeasure):', styles: { fontStyle: 'bold', textColor: [71, 85, 105], fillColor: [248, 250, 252] } },
            { content: permFixVal }
          ],
          [
            { content: 'Permanent Target Date:', styles: { fontStyle: 'bold', textColor: [71, 85, 105], fillColor: [248, 250, 252] } },
            { content: permTargetDateVal }
          ],
          [
            { content: 'Permanent Closed By:', styles: { fontStyle: 'bold', textColor: [71, 85, 105], fillColor: [248, 250, 252] } },
            { content: targetReq.permanent_closed_by || '—' }
          ],
          [
            { content: 'Permanent Evidence Attachment(s):', styles: { fontStyle: 'bold', textColor: [71, 85, 105], fillColor: [248, 250, 252] } },
            { content: permEvidenceStr }
          ],
          [
            { content: 'User Name (Based on Dep):', styles: { fontStyle: 'bold', textColor: [71, 85, 105], fillColor: [248, 250, 252] } },
            { content: respPerson }
          ],
          [
            { content: 'Responsibility (Resp):', styles: { fontStyle: 'bold', textColor: [71, 85, 105], fillColor: [248, 250, 252] } },
            { content: respDept }
          ],
          [
            { content: 'Reassignment History:', styles: { fontStyle: 'bold', textColor: [71, 85, 105], fillColor: [248, 250, 252] } },
            { content: reassignVal }
          ],
          [
            { content: 'Admin / Closer Remarks:', styles: { fontStyle: 'bold', textColor: [71, 85, 105], fillColor: [248, 250, 252] } },
            { content: targetReq.remarks || '—' }
          ],
          [
            { content: 'Closure Sign-off Status:', styles: { fontStyle: 'bold', textColor: [71, 85, 105], fillColor: [248, 250, 252] } },
            {
              content: isClosedStatus ? 'CLOSED (Authorized & Verified)' : displayStatus,
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
                        title="Edit Requester Details (Admin Only)"
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

          {/* Tab Navigation: Cleanly separate Requester Details vs Closer Details vs Sign & Tracks */}
          <div className="flex items-center gap-2 sm:gap-4 px-6 pt-2 border-b border-slate-200 bg-slate-50/80 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('requester')}
              className={`pb-3 px-3 text-xs font-bold transition border-b-2 flex items-center gap-2 cursor-pointer ${activeTab === 'requester'
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
              className={`pb-3 px-3 text-xs font-bold transition border-b-2 flex items-center gap-2 cursor-pointer ${activeTab === 'closer'
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
            <button
              type="button"
              onClick={() => {
                if (isEditMode) {
                  setIsEditMode(false);
                }
                setActiveTab('sign_tracks');
              }}
              className={`pb-3 px-3 text-xs font-bold transition border-b-2 flex items-center gap-2 cursor-pointer ${activeTab === 'sign_tracks'
                  ? 'border-indigo-600 text-indigo-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
            >
              <ShieldCheck className={`w-4 h-4 ${isClosed ? 'text-emerald-600' : 'text-indigo-600'}`} />
              <span>Sign Fields &amp; Tracks</span>
              {isClosed ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300">
                  Signed Off
                </span>
              ) : hasReassignments ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-purple-100 text-purple-800 border border-purple-300">
                  Tracks ({reassignCount})
                </span>
              ) : isCompleted ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-300">
                  Review Ready
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-indigo-100 text-indigo-800 border border-indigo-300">
                  Admin Review
                </span>
              )}
            </button>
          </div>

          {/* Modal Body: Scrollable Tab Content */}
          <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-white">
            {activeTab === 'sign_tracks' ? (
              /* TAB 3: SIGN FIELDS & TRACKS */
              <div className="space-y-6 animate-in fade-in duration-150">
                {/* 1. Incident Lifecycle & Progress Stepper Bar */}
                <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white shadow-sm space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-300 flex items-center justify-center font-bold border border-indigo-400/30">
                        <ShieldCheck className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-sm tracking-wide text-white">
                            {req.req_no || `IHLR-${req.id}`}
                          </span>
                          {getStatusBadge(req.status)}
                        </div>
                        <p className="text-[11px] text-slate-300 mt-0.5">
                          Logged: <span className="text-white font-medium">{formatDate(req.batch_date)}</span> | Responsibility (Resp): <span className="text-amber-300 font-semibold">{req.resp || 'PRODUCTION'}</span>
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      {hasReassignments ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-purple-500/20 text-purple-200 border border-purple-400/30">
                          <ArrowRightLeft className="w-3.5 h-3.5 text-purple-300" />
                          <span>Reassigned ({reassignCount} {reassignCount === 1 ? 'time' : 'times'})</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-white/10 text-slate-300 border border-white/15">
                          <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Original Assignment</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 4-Step Interactive Tracking Pipeline */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs pt-1">
                    {/* Step 1: Raised */}
                    <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 space-y-1">
                      <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-[10px] uppercase tracking-wider">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        <span>1. Incident Raised</span>
                      </div>
                      <div className="text-slate-200 font-semibold truncate text-[11px]">
                        {req.created_by || 'Requester'}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {formatDate(req.batch_date) || '—'} ({req.shift || 'Shift 1'})
                      </div>
                    </div>

                    {/* Step 2: Assigned Closer */}
                    <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 space-y-1">
                      <div className="flex items-center gap-1.5 text-blue-400 font-bold text-[10px] uppercase tracking-wider">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        <span>2. Assigned Closer</span>
                      </div>
                      <div className="text-slate-200 font-semibold truncate text-[11px]">
                        {req.resp_person || 'Not Assigned'}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        Responsibility (Resp): {req.resp || 'PRODUCTION'}
                      </div>
                    </div>

                    {/* Step 3: Containment / Closer Action */}
                    <div className={`p-2.5 rounded-xl border space-y-1 ${hasCloserSubmitted
                        ? 'bg-white/5 border-white/10'
                        : 'bg-amber-500/10 border-amber-400/30'
                      }`}>
                      <div className={`flex items-center gap-1.5 font-bold text-[10px] uppercase tracking-wider ${hasCloserSubmitted ? 'text-teal-400' : 'text-amber-300'
                        }`}>
                        {hasCloserSubmitted ? (
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        ) : (
                          <Clock className="w-3.5 h-3.5 shrink-0" />
                        )}
                        <span>3. Closer Action</span>
                      </div>
                      <div className="text-slate-200 font-semibold truncate text-[11px]">
                        {hasCloserSubmitted ? (req.closer_updated_by || req.temporary_closed_by || 'Submitted') : 'Pending Submission'}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {req.closer_updated_by
                          ? `Filled by: ${req.closer_updated_by}`
                          : req.temporary_closed_by
                            ? `By: ${req.temporary_closed_by}`
                            : (formatDate(req.temporary_target_date || req.permanent_target_date) ? `Target: ${formatDate(req.temporary_target_date || req.permanent_target_date)}` : 'Awaiting Closer')}
                      </div>
                    </div>

                    {/* Step 4: Admin Sign-Off */}
                    <div className={`p-2.5 rounded-xl border space-y-1 ${isClosed
                        ? 'bg-emerald-500/15 border-emerald-400/30'
                        : 'bg-white/5 border-white/10'
                      }`}>
                      <div className={`flex items-center gap-1.5 font-bold text-[10px] uppercase tracking-wider ${isClosed ? 'text-emerald-400' : 'text-slate-400'
                        }`}>
                        {isClosed ? (
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        ) : (
                          <Lock className="w-3.5 h-3.5 shrink-0" />
                        )}
                        <span>4. Admin Sign-Off</span>
                      </div>
                      <div className="text-slate-200 font-semibold truncate text-[11px]">
                        {isClosed ? (req.reviewed_by || 'Signed Off') : 'Awaiting Sign-Off'}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        Status: {getIhlrDisplayStatus(req.status, req)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Admin Review & Sign-Off Section (Faithfully matching Image 2) */}
                <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                      <ShieldAlert className="w-4 h-4 text-indigo-600" />
                      <span>Admin Review &amp; Sign-Off</span>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 bg-purple-50 text-purple-700 rounded border border-purple-200">
                        ADMIN ONLY
                      </span>
                      {isClosed && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded border border-emerald-200 flex items-center gap-1">
                          <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                          <span>CLOSED &amp; SIGNED</span>
                        </span>
                      )}
                    </label>
                    <span className="text-[10px] text-slate-400 font-medium">Independent Update</span>
                  </div>

                  {/* Status Notice Banner matching Image 2 */}
                  {isClosed ? (
                    <div className="p-3 rounded-xl border border-emerald-200 bg-emerald-50/80 text-emerald-900 text-xs flex items-center gap-2.5 animate-in fade-in">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <div className="leading-tight">
                        <span className="font-bold">Incident Signed-Off &amp; Closed: </span>
                        <span className="text-emerald-800">
                          Verified by <strong className="text-emerald-950">{req.reviewed_by || 'QAD Admin'}</strong>. Status finalized to CLOSED.
                        </span>
                      </div>
                    </div>
                  ) : isCloserDataToBeUpdated ? (
                    <div className="p-3 rounded-xl border border-amber-200 bg-amber-50/80 text-amber-900 text-xs flex items-center gap-2.5 animate-in fade-in">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                      <div className="leading-tight">
                        <span className="font-bold">Closer Submission: </span>
                        <span className="text-amber-800">
                          Closer submission pending. Admin can review, edit, or sign off status.
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl border border-blue-200 bg-blue-50/70 text-blue-900 text-xs flex items-center gap-2.5 animate-in fade-in">
                      <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                      <div className="leading-tight">
                        <span className="font-bold">Ready for Review: </span>
                        <span className="text-blue-800">
                          Closer containment countermeasures submitted. QAD Admin can review remarks and finalize status.
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Reassign Closer Block (Matching Image 2) */}
                  <div className="space-y-2">
                    {!isReassignOpen ? (
                      <div className={`flex items-center justify-between p-3 rounded-xl border transition ${isClosed ? 'bg-slate-50 border-slate-200 text-slate-500' : 'bg-slate-50 border-slate-200/90'
                        }`}>
                        <div className="flex items-center gap-2.5">
                          <UserCheck className="w-4 h-4 text-blue-600 shrink-0" />
                          <div className="text-left">
                            <div className="text-[11px] font-bold flex items-center gap-1.5 text-slate-800">
                              <span>Reassign Closer</span>
                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded border bg-purple-50 text-purple-700 border-purple-200">
                                Admin
                              </span>
                              <span className="text-[10px] text-slate-400 font-normal">(Optional)</span>
                            </div>
                            <div className="text-[10px] text-slate-500">
                              Current: <strong className="text-slate-800">{req.resp_person || 'Not Assigned'}</strong> ({req.resp || 'PRODUCTION'})
                            </div>
                          </div>
                        </div>
                        {isAdmin && !isClosed && (
                          <button
                            type="button"
                            onClick={() => {
                              setIsReassignOpen(true);
                              setIsReassignUserDropdownOpen(false);
                              setReassignUserSearch('');
                              setReassignedDept(req.resp || 'PRODUCTION');
                              setReassignedPerson(req.resp_person || '');
                              setAdminStatus('OPEN');
                            }}
                            className="px-3 py-1.5 rounded-lg font-bold text-xs border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 shadow-2xs transition flex items-center gap-1.5 shrink-0 cursor-pointer"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>Reassign</span>
                          </button>
                        )}
                      </div>
                    ) : (
                      /* Expanded Reassign Box */
                      <div className="p-3.5 bg-gradient-to-r from-blue-50/70 via-indigo-50/50 to-slate-50 rounded-xl border border-blue-200/90 space-y-3 animate-in fade-in">
                        <div className="flex items-center justify-between pb-1.5 border-b border-blue-200/60">
                          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                            <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                            <span>REASSIGN CLOSER</span>
                            <span className="text-[9px] font-bold px-1.5 py-0.5 bg-purple-50 text-purple-700 rounded border border-purple-200">
                              Admin
                            </span>
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              setIsReassignOpen(false);
                              setIsReassignUserDropdownOpen(false);
                              setReassignUserSearch('');
                              setReassignedDept(req.resp || 'PRODUCTION');
                              setReassignedPerson(req.resp_person || '');
                              setAdminStatus(req.status === 'CLOSED' ? 'CLOSED' : '');
                              setAdminErrors(prev => ({ ...prev, reassignDept: '', reassignPerson: '', status: '' }));
                            }}
                            className="text-[11px] text-slate-500 hover:text-rose-600 font-semibold cursor-pointer underline flex items-center gap-1"
                          >
                            Cancel
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {/* Department (Resp) */}
                          <div>
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                              Responsibility (Resp) *
                            </label>
                            <select
                              value={reassignedDept}
                              onChange={(e) => {
                                setReassignedDept(e.target.value);
                                setReassignedPerson('');
                                if (e.target.value) {
                                  setAdminErrors(prev => ({ ...prev, reassignDept: '' }));
                                }
                              }}
                              className={`w-full px-2.5 py-2 bg-white border rounded-xl font-semibold text-slate-800 text-xs outline-none cursor-pointer ${adminErrors.reassignDept
                                  ? 'border-rose-400 focus:ring-2 focus:ring-rose-400/20 focus:border-rose-500 bg-rose-50/20'
                                  : 'border-slate-300 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500'
                                }`}
                            >
                              <option value="">Select Responsibility</option>
                              {departmentList.map((dept) => (
                                <option key={dept} value={dept}>
                                  {dept}
                                </option>
                              ))}
                            </select>
                            {adminErrors.reassignDept && (
                              <p className="text-[10px] text-rose-500 font-semibold mt-1">
                                * {adminErrors.reassignDept}
                              </p>
                            )}
                          </div>

                          {/* Multi-Select User dropdown */}
                          <div className="relative" ref={reassignDropdownRef}>
                            <div className="flex items-center justify-between mb-1">
                              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600">
                                User Name (Based on Dep) *
                              </label>
                              {reassignedDept && getDepartmentUsers(reassignedDept).length > 0 && getSelectedReassignedUsers().length > 0 && (
                                <button
                                  type="button"
                                  onClick={handleClearAllReassignUsers}
                                  className="text-[10px] text-rose-600 hover:text-rose-700 font-semibold hover:underline cursor-pointer"
                                >
                                  Clear
                                </button>
                              )}
                            </div>

                            {/* Trigger box */}
                            <div
                              onClick={() => {
                                if (reassignedDept) {
                                  setIsReassignUserDropdownOpen(prev => !prev);
                                }
                              }}
                              className={`min-h-[38px] p-1.5 px-2.5 bg-white border rounded-xl flex items-center justify-between gap-2 cursor-pointer transition ${!reassignedDept
                                  ? 'bg-slate-100/70 border-slate-200 cursor-not-allowed select-none'
                                  : adminErrors.reassignPerson
                                    ? 'border-rose-400 bg-rose-50/20'
                                    : 'border-slate-300 focus-within:ring-2 focus-within:ring-blue-500/20'
                                }`}
                            >
                              <div className="flex items-center gap-1.5 flex-wrap flex-1">
                                {!reassignedDept ? (
                                  <span className="text-slate-400 text-xs italic">Select department first</span>
                                ) : getSelectedReassignedUsers().length === 0 ? (
                                  <span className="text-slate-400 text-xs">Select user(s)...</span>
                                ) : (
                                  getSelectedReassignedUsers().map((uName) => (
                                    <span
                                      key={uName}
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-50 text-blue-700 font-bold text-[11px] border border-blue-200"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleToggleReassignUser(uName);
                                      }}
                                    >
                                      <span>{uName}</span>
                                      <X className="w-3 h-3 hover:text-rose-600 cursor-pointer" />
                                    </span>
                                  ))
                                )}
                              </div>
                              <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                            </div>
                            {adminErrors.reassignPerson && (
                              <p className="text-[10px] text-rose-500 font-semibold mt-1">
                                * {adminErrors.reassignPerson}
                              </p>
                            )}

                            {/* Dropdown Menu */}
                            {isReassignUserDropdownOpen && reassignedDept && (
                              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-2 space-y-1.5 max-h-56 overflow-y-auto">
                                <div className="relative">
                                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                                  <input
                                    type="text"
                                    value={reassignUserSearch}
                                    onChange={(e) => setReassignUserSearch(e.target.value)}
                                    placeholder="Search users..."
                                    className="w-full pl-8 pr-2 py-1.5 text-xs border border-slate-200 rounded-lg outline-none focus:border-blue-500"
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                </div>
                                <div className="space-y-0.5">
                                  {getDepartmentUsers(reassignedDept)
                                    .filter(u => (u.name || '').toLowerCase().includes(reassignUserSearch.toLowerCase()))
                                    .map(u => {
                                      const isSel = getSelectedReassignedUsers().includes(u.name);
                                      return (
                                        <div
                                          key={u.id || u.name}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleToggleReassignUser(u.name);
                                          }}
                                          className={`p-2 rounded-lg text-xs flex items-center justify-between cursor-pointer transition ${isSel ? 'bg-blue-50 text-blue-700 font-bold' : 'hover:bg-slate-50 text-slate-700'
                                            }`}
                                        >
                                          <span>{u.name}</span>
                                          {isSel && <Check className="w-3.5 h-3.5 text-blue-600" />}
                                        </div>
                                      );
                                    })}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Reassignment Remarks */}
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                            Reassignment Reason / Remarks (Optional)
                          </label>
                          <input
                            type="text"
                            value={reassignRemarks}
                            onChange={(e) => setReassignRemarks(e.target.value)}
                            placeholder="e.g. Reassigned to Production shift supervisor for root cause analysis..."
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* REMARKS */}
                  {isClosed ? (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                          <span>ADMIN REMARKS</span>
                          <span className="text-[9px] font-bold px-1.5 py-0.5 bg-purple-50 text-purple-700 rounded border border-purple-200">
                            ADMIN
                          </span>
                          <span className="text-[9px] font-bold px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded border border-emerald-200 flex items-center gap-1">
                            <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                            <span>FINALIZED</span>
                          </span>
                        </label>
                      </div>
                      <div className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 leading-relaxed whitespace-pre-wrap">
                        {req.remarks || adminRemarks || (reassignList?.[reassignList.length - 1]?.remarks) || (
                          <span className="text-slate-400 italic">No admin remarks recorded.</span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        Comprehensive Quality Admin verification remarks and final closure statement.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                          <span>ADMIN REMARKS</span>
                          <span className="text-rose-500 font-bold">*</span>
                          <span className="text-[9px] font-bold px-1.5 py-0.5 bg-purple-50 text-purple-700 rounded border border-purple-200">
                            ADMIN
                          </span>
                        </label>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {Math.max(0, 1000 - (adminRemarks?.length || 0))} chars left
                        </span>
                      </div>

                      <textarea
                        rows={3}
                        disabled={!isAdmin || (isCloserDataToBeUpdated && !isReassignOpen) || isClosed}
                        placeholder={
                          isCloserDataToBeUpdated && !isReassignOpen
                            ? (adminRemarks || req.remarks || (reassignList?.[reassignList.length - 1]?.remarks) ? '' : 'Awaiting closer Temporary Action & Target Date...')
                            : 'Enter admin review and validation remarks...'
                        }
                        value={adminRemarks || req.remarks || (reassignList?.[reassignList.length - 1]?.remarks) || ''}
                        onChange={(e) => {
                          setAdminRemarks(e.target.value);
                          if (e.target.value.trim()) {
                            setAdminErrors(prev => ({ ...prev, remarks: '' }));
                          }
                        }}
                        className={`w-full px-3.5 py-2.5 border rounded-xl text-xs outline-none transition font-medium leading-relaxed resize-none ${!isAdmin || (isCloserDataToBeUpdated && !isReassignOpen) || isClosed
                            ? 'bg-slate-100/70 border-slate-200 text-slate-500 cursor-not-allowed select-none'
                            : adminErrors.remarks
                              ? 'border-rose-400 bg-rose-50/20 focus:ring-2 focus:ring-rose-400/20 focus:border-rose-500'
                              : 'border-slate-300 bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800'
                          }`}
                      />

                      {adminErrors.remarks ? (
                        <p className="text-[11px] text-rose-500 font-semibold mt-0.5">
                          * {adminErrors.remarks}
                        </p>
                      ) : isCloserDataToBeUpdated && !isReassignOpen ? (
                        <p className="text-[11px] text-amber-700 font-semibold mt-0.5">
                          Closer Temporary Action &amp; Target Date required first.
                        </p>
                      ) : (
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          Comprehensive Quality Admin verification remarks and final closure statement.
                        </p>
                      )}
                    </div>
                  )}

                  {/* REVIEWED BY */}
                  {isClosed ? (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                          <span>REVIEWED BY</span>
                          <span className="text-[9px] font-bold px-1.5 py-0.5 bg-purple-50 text-purple-700 rounded border border-purple-200">
                            ADMIN
                          </span>
                        </label>
                      </div>
                      <div className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 flex items-center gap-2">
                        <UserCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>{req.reviewed_by || adminReviewedBy || 'QAD Admin'}</span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        Admin / Quality Engineer who verified and closed this incident.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                          <span>REVIEWED BY</span>
                          <span className="text-slate-400 font-normal text-[10px]">(optional)</span>
                          <span className="text-[9px] font-bold px-1.5 py-0.5 bg-purple-50 text-purple-700 rounded border border-purple-200">
                            ADMIN
                          </span>
                        </label>
                        <span className="text-[10px] text-slate-400">
                          Defaults to: <strong className="text-slate-700">{user?.name || 'Admin'}</strong>
                        </span>
                      </div>

                      <input
                        type="text"
                        disabled={!isAdmin || (isCloserDataToBeUpdated && !isReassignOpen) || isClosed}
                        placeholder={`e.g. Leave empty to attach ${user?.name || 'Admin'}`}
                        value={adminReviewedBy}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[0-9]/g, '');
                          setAdminReviewedBy(val);
                          if (/\d/.test(e.target.value)) {
                            setAdminErrors(prev => ({ ...prev, reviewedBy: 'Reviewed By must contain text only, numbers are not allowed.' }));
                          } else {
                            setAdminErrors(prev => ({ ...prev, reviewedBy: '' }));
                          }
                        }}
                        className={`w-full px-3.5 py-2 border rounded-xl text-xs font-semibold outline-none transition ${!isAdmin || (isCloserDataToBeUpdated && !isReassignOpen) || isClosed
                            ? 'bg-slate-100/70 border-slate-200 text-slate-500 cursor-not-allowed select-none'
                            : adminErrors.reviewedBy
                              ? 'border-rose-400 bg-rose-50/20'
                              : 'border-slate-300 bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800'
                          }`}
                      />

                      {adminErrors.reviewedBy ? (
                        <p className="text-[11px] text-rose-500 font-semibold mt-0.5">
                          * {adminErrors.reviewedBy}
                        </p>
                      ) : (
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          Admin / Quality Engineer reviewing this incident (defaults to logged-in user).
                        </p>
                      )}
                    </div>
                  )}

                  {/* STATUS */}
                  {isClosed ? (
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                        <span>STATUS</span>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 bg-purple-50 text-purple-700 rounded border border-purple-200">
                          ADMIN
                        </span>
                      </label>
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>CLOSED</span>
                        </span>
                      </div>
                      <p className="text-[10px] text-emerald-600 font-semibold mt-0.5">
                        Status finalized to CLOSED.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                        <span>STATUS</span>
                        <span className="text-rose-500 font-bold">*</span>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 bg-purple-50 text-purple-700 rounded border border-purple-200">
                          ADMIN
                        </span>
                      </label>

                      <select
                        disabled={!isAdmin || (isCloserDataToBeUpdated && !isReassignOpen) || isClosed}
                        value={isReassignOpen ? 'OPEN' : adminStatus}
                        onChange={(e) => {
                          setAdminStatus(e.target.value);
                          if (e.target.value) {
                            setAdminErrors(prev => ({ ...prev, status: '' }));
                          }
                        }}
                        className={`w-full px-3.5 py-2 border rounded-xl font-bold text-xs outline-none transition cursor-pointer ${!isAdmin || (isCloserDataToBeUpdated && !isReassignOpen) || isClosed
                            ? 'bg-slate-100/70 border-slate-200 text-slate-500 cursor-not-allowed select-none'
                            : adminErrors.status
                              ? 'border-rose-400 bg-rose-50/20'
                              : 'bg-white border-slate-300 text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500'
                          }`}
                      >
                        {isReassignOpen ? (
                          <option value="OPEN">PENDING (Awaiting Closer)</option>
                        ) : (
                          <>
                            <option value="">Select Status...</option>
                            <option value="CLOSED">CLOSED</option>
                          </>
                        )}
                      </select>

                      {adminErrors.status ? (
                        <p className="text-[11px] text-rose-500 font-semibold mt-0.5">
                          * {adminErrors.status}
                        </p>
                      ) : isCloserDataToBeUpdated && !isReassignOpen ? (
                        <p className="text-[11px] text-amber-700 font-semibold mt-0.5">
                          Status unlocks after closer submission.
                        </p>
                      ) : isReassignOpen ? (
                        <p className="text-[10px] text-purple-700 font-semibold mt-0.5">
                          Status locked to PENDING for new assignee.
                        </p>
                      ) : adminStatus === 'CLOSED' ? (
                        <p className="text-[10px] text-emerald-600 font-semibold mt-0.5">
                          Status will be finalized to CLOSED.
                        </p>
                      ) : (
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          Select CLOSED to finalize admin sign-off.
                        </p>
                      )}
                    </div>
                  )}

                  {/* Sign-Off Action Button (Matching Image 2) */}
                  <div className="pt-2">
                    {isCloserDataToBeUpdated && !isReassignOpen ? (
                      <button
                        type="button"
                        disabled
                        className="w-full py-2.5 px-4 rounded-xl border border-amber-200 bg-amber-50 text-amber-700 font-bold text-xs cursor-not-allowed select-none text-center shadow-2xs flex items-center justify-center gap-2"
                        title="Closer Action & Target Date required before Admin Sign-Off"
                      >
                        <Lock className="w-4 h-4 text-amber-600" />
                        <span>Sign-Off Locked (Closer Pending)</span>
                      </button>
                    ) : isReassignOpen ? (
                      <button
                        type="button"
                        onClick={handleSaveAdminSignOff}
                        disabled={isSavingAdmin}
                        className="w-full py-2.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        {isSavingAdmin ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Reassigning Closer...</span>
                          </>
                        ) : (
                          <>
                            <UserCheck className="w-4 h-4" />
                            <span>Confirm &amp; Reassign Closer</span>
                          </>
                        )}
                      </button>
                    ) : isAdmin && !isClosed ? (
                      <button
                        type="button"
                        onClick={handleSaveAdminSignOff}
                        disabled={isSavingAdmin}
                        className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-xs shadow-md hover:shadow-lg transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        {isSavingAdmin ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Saving Sign-Off...</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Save Admin Review &amp; Status Sign-Off</span>
                          </>
                        )}
                      </button>
                    ) : isClosed ? (
                      <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center justify-center gap-2 text-emerald-800 font-bold text-xs">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>Incident Fully Validated &amp; Closed</span>
                      </div>
                    ) : (
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-500 text-center font-medium text-xs">
                        Admin sign-off fields are view-only for non-admin users.
                      </div>
                    )}
                  </div>
                </div>

                {/* 3. Reassignment Tracking History Section */}
                <div className="p-5 rounded-2xl bg-gradient-to-r from-purple-50/70 via-indigo-50/40 to-slate-50 border border-purple-200/90 space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-purple-200/60">
                    <div className="flex items-center gap-2 text-purple-900 text-xs font-bold uppercase tracking-wider">
                      <ArrowRightLeft className="w-4 h-4 text-purple-600" />
                      <span>REASSIGNMENT TRACKING HISTORY ({reassignCount})</span>
                    </div>
                    <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border font-mono ${hasReassignments
                        ? 'bg-purple-100 text-purple-800 border-purple-300'
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}>
                      Reassigned: {hasReassignments ? 'Yes' : 'No'}
                    </span>
                  </div>

                  {hasReassignments && reassignList.length > 0 ? (
                    <div className="space-y-2.5">
                      {reassignList.map((entry, idx) => (
                        <div
                          key={idx}
                          className="p-3.5 bg-white rounded-xl border border-purple-100 shadow-2xs space-y-2 text-xs"
                        >
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
                              {[
                                entry.reassigned_by ? `by ${entry.reassigned_by}` : '',
                                entry.reassigned_at ? formatDate(entry.reassigned_at) : ''
                              ].filter(Boolean).join(' • ')}
                            </span>
                          </div>
                          {entry.remarks && (
                            <div className="text-[11px] text-slate-700 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100 italic">
                              <span className="font-semibold text-slate-500 not-italic">Remarks: </span>
                              {entry.remarks}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 bg-white/80 rounded-xl border border-dashed border-purple-200 text-xs text-slate-600 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-bold text-slate-800">Original Responsible Owner Assignment</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Assigned to <strong className="text-slate-700">{req.resp_person || 'Not Assigned'}</strong> ({req.resp || 'PRODUCTION'}). No reassignments have occurred for this incident.
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 4. Incident Audit Trail Details */}
                <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/80 space-y-3">
                  <div className="flex items-center gap-2 text-slate-700 text-xs font-bold uppercase tracking-wider">
                    <History className="w-4 h-4 text-slate-500" />
                    <span>Incident Audit Trail Summary</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
                    <div className="p-2.5 bg-white rounded-xl border border-slate-100">
                      <span className="block text-[10px] font-bold uppercase text-slate-400">Created By</span>
                      <span className="font-semibold text-slate-800 block mt-0.5 truncate">{req.created_by || 'Admin'}</span>
                    </div>
                    <div className="p-2.5 bg-white rounded-xl border border-slate-100">
                      <span className="block text-[10px] font-bold uppercase text-slate-400">Analysis Done By</span>
                      <span className="font-semibold text-slate-800 block mt-0.5 truncate">{req.analysis_done_by || 'Admin'}</span>
                    </div>
                    <div className="p-2.5 bg-white rounded-xl border border-emerald-200/80 bg-emerald-50/20">
                      <span className="block text-[10px] font-bold uppercase text-emerald-600">Closer Filled By</span>
                      <span className="font-bold text-emerald-800 block mt-0.5 truncate" title={req.closer_updated_by || req.temporary_closed_by || '—'}>
                        {req.closer_updated_by || req.temporary_closed_by || req.permanent_closed_by || '—'}
                      </span>
                    </div>
                    <div className="p-2.5 bg-white rounded-xl border border-slate-100">
                      <span className="block text-[10px] font-bold uppercase text-slate-400">Temp Closed By</span>
                      <span className="font-semibold text-slate-800 block mt-0.5 truncate">{req.temporary_closed_by || req.closer_updated_by || '—'}</span>
                    </div>
                    <div className="p-2.5 bg-white rounded-xl border border-slate-100">
                      <span className="block text-[10px] font-bold uppercase text-slate-400">Perm Closed By</span>
                      <span className="font-semibold text-slate-800 block mt-0.5 truncate">{req.permanent_closed_by || req.closer_updated_by || '—'}</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : activeTab === 'closer' ? (
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
                        Model Name / Part: <strong className="text-slate-800">{request.model || '—'}</strong> | Problem Detected At:{' '}
                        <strong className="text-slate-800">{request.problem_detected_at || '—'}</strong>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-[11px] font-medium text-slate-600">
                    <div>
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Target Date</span>
                      <span className="font-mono font-bold text-slate-800">{formatDate(request.temporary_target_date || request.permanent_target_date) || '—'}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Responsibility (Resp)</span>
                      <span className="font-bold text-slate-800">
                        {request.resp || 'Production'}{request.resp_person ? ` (${request.resp_person})` : ''}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-emerald-600">Closer Filled By</span>
                      <span className="font-bold text-emerald-800">
                        {request.closer_updated_by || request.temporary_closed_by || (hasCloserSubmitted ? 'Submitted' : 'Pending Closer')}
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
                      <span>Occurrence Cause (Production 5-Why Analysis)</span>
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
                              {item.label}:{['W1', 'W2', 'W3'].includes(item.label) && <span className="text-red-500 font-bold ml-0.5">*</span>}
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
                    <span>Temporary Action Taken</span>
                  </div>
                  <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs text-xs text-slate-800 leading-relaxed font-medium">
                    {request.temporary_action || <span className="text-slate-400 italic">No temporary action recorded.</span>}
                  </div>
                </div>

                {/* 4. Evidence Attachment (Format: PPT, JPEG, EXCEL & PDF) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-purple-600 text-xs font-bold uppercase tracking-wider">
                      <Paperclip className="w-4 h-4" />
                      <span>Temporary Evidence Attachment(s)</span>
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
                      No temporary evidence attachments uploaded.
                    </div>
                  )}
                </div>

                {/* 5. Target Date & Closed By */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-1">
                    <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      TEMPORARY TARGET DATE
                    </span>
                    <span className="font-mono font-bold text-slate-900 text-sm">
                      {formatDate(request.temporary_target_date) || '—'}
                    </span>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-1">
                    <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      TEMPORARY CLOSED BY
                    </span>
                    <span className="font-bold text-slate-900 block text-xs">
                      {request.closer_updated_by || request.temporary_closed_by || '—'}
                    </span>
                    {request.closer_updated_by && request.resp_person && request.resp_person.includes(',') && (
                      <span className="text-[9px] text-emerald-700 font-semibold block">
                        (Updated by: {request.closer_updated_by})
                      </span>
                    )}
                  </div>
                </div>

                {/* Permanent Countermeasures Section */}
                <div className="pt-3 border-t border-slate-200/90 space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                    <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Permanent Countermeasures
                    </span>
                  </div>

                  {/* 1. Permanent Action (Words) */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-emerald-600 text-xs font-bold uppercase tracking-wider">
                      <Wrench className="w-4 h-4" />
                      <span>Permanent Action (Countermeasure)</span>
                    </div>
                    <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs text-xs text-slate-800 leading-relaxed font-medium">
                      {request.permanent_fix || <span className="text-slate-400 italic">No permanent action recorded.</span>}
                    </div>
                  </div>

                  {/* 2. Permanent Action Evidence Attachment */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-purple-600 text-xs font-bold uppercase tracking-wider">
                        <Paperclip className="w-4 h-4" />
                        <span>Permanent Evidence Attachment(s)</span>
                      </div>
                      <span className="text-[11px] text-slate-400 font-mono">Format: PPT, JPEG, EXCEL &amp; PDF</span>
                    </div>

                    {permanentEvidenceAttachments && permanentEvidenceAttachments.length > 0 ? (
                      <div className="p-4 rounded-2xl bg-slate-50/60 border border-slate-200/80">
                        <AttachmentChipList
                          attachments={permanentEvidenceAttachments}
                          onPreview={(att) => setPreviewAttachment(att)}
                          readonly={true}
                        />
                      </div>
                    ) : (
                      <div className="p-4 rounded-2xl bg-slate-50/60 border border-dashed border-slate-200 text-xs text-slate-400 italic text-center">
                        No permanent action evidence attachments uploaded.
                      </div>
                    )}
                  </div>

                  {/* 3. Permanent Fix Target Date */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-1">
                      <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        PERMANENT TARGET DATE
                      </span>
                      <span className="font-mono font-bold text-slate-900 text-sm">
                        {formatDate(request.permanent_target_date) || '—'}
                      </span>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-1">
                      <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        PERMANENT CLOSED BY
                      </span>
                      <span className="font-bold text-slate-900 block text-xs">
                        {request.permanent_closed_by || '—'}
                      </span>
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
                <div className={`p-4 rounded-2xl border flex flex-wrap items-center justify-between gap-3 text-xs ${isClosed
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
                    <span>Responsibility (Resp): <strong className="text-blue-700 font-mono">{request.resp || 'PRODUCTION'}{request.resp_person ? ` (${request.resp_person})` : ''}</strong></span>
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
                        max={new Date().toISOString().split('T')[0]}
                        value={editFormData.batch_date}
                        onChange={(e) => {
                          const val = e.target.value;
                          const today = new Date().toISOString().split('T')[0];
                          setEditFormData(prev => ({ ...prev, batch_date: val }));
                          if (val && val > today) {
                            setEditErrors(prev => ({ ...prev, batch_date: 'Incident Date cannot be a future date. Please select today or a past date.' }));
                          } else if (editErrors.batch_date && val) {
                            setEditErrors(prev => ({ ...prev, batch_date: '' }));
                          }
                        }}
                        className={`w-full px-3 py-2 rounded-xl text-xs font-medium text-slate-900 outline-none transition ${editErrors.batch_date
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
                        className={`w-full px-3 py-2 rounded-xl text-xs font-medium text-slate-900 outline-none transition ${editErrors.shift
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
                        className={`w-full px-3 py-2 rounded-xl text-xs font-bold outline-none transition ${editErrors.four_m
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
                        RESPONSIBILITY (RESP) <span className="text-rose-500">*</span>
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
                        className={`w-full px-3 py-2 rounded-xl text-xs font-bold text-slate-900 outline-none transition ${editErrors.resp
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
                        USER NAME (BASED ON DEP) <span className="text-rose-500">*</span>
                      </label>
                      <div
                        onClick={() => setIsUserDropdownOpen(prev => !prev)}
                        className={`w-full min-h-[38px] px-3 py-1.5 rounded-xl text-xs cursor-pointer flex items-center justify-between gap-2 transition ${editErrors.resp_person
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
                                    className={`flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer transition select-none ${isChecked ? 'bg-blue-50 text-blue-900 font-semibold' : 'hover:bg-slate-50 text-slate-700'
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
                        className={`w-full px-3 py-2 rounded-xl text-xs font-semibold text-slate-900 outline-none transition ${editErrors.model
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
                        ACTUAL REJECTED QTY <span className="text-rose-500">*</span>
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
                        className={`w-full px-3 py-2 rounded-xl text-xs font-mono font-bold text-slate-900 outline-none transition ${editErrors.actual_qty
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
                        PROBLEM DETECTED AT <span className="text-rose-500">*</span>
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
                        className={`w-full px-3 py-2 rounded-xl text-xs text-slate-900 outline-none transition ${editErrors.problem_detected_at
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
                        className={`w-full px-3 py-2 rounded-xl text-xs text-slate-900 outline-none transition cursor-pointer font-medium ${editErrors.received_from
                            ? 'border border-rose-400 focus:ring-2 focus:ring-rose-400/20 focus:border-rose-500 bg-rose-50/20'
                            : 'bg-white border border-slate-300 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600'
                          }`}
                      >
                        <option value="">Select</option>
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

                    <div>
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
                        className={`w-full px-3 py-2 rounded-xl text-xs font-semibold text-slate-900 outline-none transition ${editErrors.analysis_done_by
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

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                        CREATED BY
                      </label>
                      <input
                        type="text"
                        value={editFormData.created_by}
                        onChange={(e) => {
                          setEditFormData(prev => ({ ...prev, created_by: e.target.value }));
                        }}
                        placeholder="e.g. Admin"
                        className="w-full px-3 py-2 rounded-xl text-xs font-semibold text-slate-900 outline-none transition bg-white border border-slate-300 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                      />
                    </div>
                  </div>
                </div>

                {/* 📄 2. DEFECT PROBLEM DESCRIPTION (EDITABLE) */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-blue-600 text-xs font-bold uppercase tracking-wider">
                    <FileText className="w-4 h-4" />
                    <span>2. DEFECT PROBLEM DESCRIPTION</span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      PROBLEM / DEFECT DESCRIPTION <span className="text-rose-500">*</span>
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
                      className={`w-full p-3 rounded-2xl text-xs text-slate-900 outline-none transition leading-relaxed ${editErrors.problem
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
                  <label className={`flex items-center justify-center gap-2.5 p-4 rounded-2xl border-2 border-dashed transition cursor-pointer text-xs font-semibold ${editErrors.attachments
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
                      <span>W1, W2 & W3 Mandatory</span>
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
                        const isMandatory = idx < 3;
                        const errorKey = `w${idx + 1}`;
                        const hasError = isMandatory && Boolean(editErrors[errorKey]);
                        return (
                          <div key={idx} className="space-y-1">
                            <div className="flex items-center gap-2.5">
                              <span className={`px-2.5 py-1.5 rounded-lg font-mono font-black text-[11px] border shrink-0 transition ${isMandatory
                                  ? hasError
                                    ? 'bg-rose-50 border-rose-300 text-rose-700'
                                    : 'bg-amber-100 text-amber-800 border-amber-200'
                                  : 'bg-amber-100 text-amber-800 border-amber-200'
                                }`}>
                                {wLabel}:{isMandatory && <span className="text-rose-500 ml-0.5 font-bold">*</span>}
                              </span>
                              <input
                                type="text"
                                value={editQaWhyWhy[idx] || ''}
                                onChange={(e) => {
                                  const copy = [...editQaWhyWhy];
                                  copy[idx] = e.target.value;
                                  setEditQaWhyWhy(copy);
                                  if (isMandatory && editErrors[errorKey] && e.target.value.trim()) {
                                    setEditErrors(prev => ({ ...prev, [errorKey]: '' }));
                                  }
                                }}
                                placeholder={`QA Root Cause Level ${idx + 1}...${isMandatory ? ' (Mandatory)' : ''}`}
                                className={`flex-1 px-3 py-1.5 rounded-xl text-xs text-slate-800 outline-none transition ${hasError
                                    ? 'border border-rose-400 focus:ring-2 focus:ring-rose-400/20 focus:border-rose-500 bg-rose-50/20'
                                    : 'bg-white border border-amber-200/80 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500'
                                  }`}
                              />
                            </div>
                            {hasError && (
                              <p className="text-[11px] text-rose-500 font-semibold mt-1 flex items-center gap-1 pl-10">
                                <span>* {editErrors[errorKey]}</span>
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
                        RESPONSIBILITY (RESP)
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
                        ACTUAL REJECTED QTY
                      </span>
                      <span className="font-bold text-slate-900 font-mono">
                        {req.actual_qty || '1'}
                      </span>
                    </div>

                    <div>
                      <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        PROBLEM DETECTED AT
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

                    <div>
                      <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        ANALYSIS DONE BY
                      </span>
                      <span className="font-bold text-slate-900 block">
                        {req.analysis_done_by || 'Admin'}
                      </span>
                    </div>

                    <div>
                      <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        CREATED BY
                      </span>
                      <span className="font-bold text-slate-900 block">
                        {req.created_by || 'Admin'}
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

                  <div>
                    <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      PROBLEM / DEFECT DESCRIPTION
                    </span>
                    <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl text-xs text-slate-700 leading-relaxed font-normal min-h-[50px]">
                      {req.problem || 'No defect description logged.'}
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
                                {item.label}:{['W1', 'W2', 'W3'].includes(item.label) && <span className="text-red-500 font-bold ml-0.5">*</span>}
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
                  ) : activeTab === 'sign_tracks' ? (
                    <span className="text-xs text-slate-500 font-medium">
                      {hasReassignments
                        ? `${reassignCount} reassignment track${reassignCount > 1 ? 's' : ''} recorded`
                        : 'Original assignee tracking record'}
                    </span>
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
