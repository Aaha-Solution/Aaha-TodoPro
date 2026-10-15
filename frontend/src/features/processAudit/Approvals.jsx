import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import {
  ClipboardCheck,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Eye,
  X,
  AlertCircle,
  FileText,
  Paperclip,
  Download,
  FileSpreadsheet,
  Presentation,
  File as FileIcon,
  Image as ImageIcon,
  UploadCloud,
  Check,
  Trash2,
  AlertTriangle,
  CheckCheck,
  RotateCcw,
  FileCheck,
  Save,
  Loader2,
  ChevronLeft,
  ChevronRight,
  History,
  Folder,
  ShieldAlert,
  Pencil,
  Lock,
  UserCheck,
  ChevronDown
} from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { processAuditService } from '../../services/processAuditService';
import { useAuth } from '../../hooks/useAuth';
import ExportSelectionModal from '../../components/common/ExportSelectionModal';
import AttachmentChipList from '../../components/common/AttachmentChipList';
import AttachmentThumbnail from '../../components/common/AttachmentThumbnail';
import AttachmentPreviewModal from '../../components/common/AttachmentPreviewModal';
import ImageAnnotationModal from '../../components/common/ImageAnnotationModal';
import DateInput from '../../components/common/DateInput';
import { resolveAttachmentUrl, triggerDirectDownload } from '../../components/common/attachmentUtils';
import { formatDateDDMMYYYY } from '../../utils/dateUtils';
import { storage } from '../../utils/storage';
import ProcessAuditRequestDetailsModal from './ProcessAuditRequestDetailsModal';

const ProcessAuditApprovals = () => {
  const { user } = useAuth();
  const savedUser = storage.getUser();
  const currentUser = user || savedUser;

  const userDept = (currentUser?.department || (() => {
    try {
      const u = sessionStorage.getItem('todo_user') || localStorage.getItem('todo_user');
      return u ? JSON.parse(u)?.department : '';
    } catch {
      return '';
    }
  })() || '').trim().toUpperCase();

  const userRole = (currentUser?.role || (() => {
    try {
      const u = sessionStorage.getItem('todo_user') || localStorage.getItem('todo_user');
      return u ? JSON.parse(u)?.role : '';
    } catch {
      return '';
    }
  })() || '').trim().toUpperCase();

  const isIncomingQuality = userDept === 'INCOMING QUALITY';
  const isAdmin = userRole === 'ADMIN' || isIncomingQuality;

  const [searchParams] = useSearchParams();
  const queryRequestId = searchParams.get('requestId') || searchParams.get('id');

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [activeModalRequest, setActiveModalRequest] = useState(null);
  const [modalTab, setModalTab] = useState('requester');
  const [selectedPreviewAttachment, setSelectedPreviewAttachment] = useState(null);

  // Selected row for Closer Log form (left panel)
  const [selectedRequest, setSelectedRequest] = useState(null);

  // Form State for Process Audit Sign-off Fields
  const [rootCause, setRootCause] = useState('');
  const [closerAction, setCloserAction] = useState('');
  const [standardizationDetails, setStandardizationDetails] = useState('');
  const [closerTargetDate, setCloserTargetDate] = useState('');
  const [closerRemarks, setCloserRemarks] = useState('');
  const [closerStatus, setCloserStatus] = useState('Closed');
  const [existingEvidence, setExistingEvidence] = useState([]);
  const [newEvidenceFiles, setNewEvidenceFiles] = useState([]);
  const [annotatingItem, setAnnotatingItem] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingCloser, setIsSavingCloser] = useState(false);
  const [isSavingAdmin, setIsSavingAdmin] = useState(false);
  const [adminEditCloser, setAdminEditCloser] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Field Validation Errors State (to show errors below inputs)
  const [rootCauseError, setRootCauseError] = useState(false);
  const [closerActionError, setCloserActionError] = useState(false);
  const [evidenceError, setEvidenceError] = useState(false);
  const [closerTargetDateError, setCloserTargetDateError] = useState(false);
  const [remarksError, setRemarksError] = useState(false);
  const [statusError, setStatusError] = useState(false);

  // Reassignment State
  const [isReassignOpen, setIsReassignOpen] = useState(false);
  const [reassignedDept, setReassignedDept] = useState('');
  const [reassignedPerson, setReassignedPerson] = useState('');
  const [reassignReason, setReassignReason] = useState('');
  const [reassignDeptError, setReassignDeptError] = useState(false);
  const [reassignPersonError, setReassignPersonError] = useState(false);
  const [isReassignUserDropdownOpen, setIsReassignUserDropdownOpen] = useState(false);
  const [reassignUserSearch, setReassignUserSearch] = useState('');
  const reassignUserDropdownRef = useRef(null);
  const [dbUsers, setDbUsers] = useState([]);

  // Pagination State
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  // Export State
  const [showExportModal, setShowExportModal] = useState(false);

  const fileInputRef = useRef(null);

  // Universal attachment URL resolver
  const getFullAttachmentUrl = (att) => resolveAttachmentUrl(att, 'process-audit');

  // Convert raw attachment data into uniform objects
  const normalizeAttachment = (item) => {
    if (!item) return null;
    const url = getFullAttachmentUrl(item);
    const name =
      typeof item === 'string'
        ? item.split('/').pop().split('\\').pop() || 'Attachment'
        : item.name || item.filename || (url ? url.split('/').pop() : 'Attachment');
    const ext = (item.type || name.split('.').pop() || 'FILE').toUpperCase();
    const isImage = ['PNG', 'JPG', 'JPEG', 'WEBP', 'GIF', 'SVG', 'JFIF', 'BMP'].includes(ext);
    const isPdf = ext === 'PDF';
    const isExcel = ['XLS', 'XLSX', 'CSV', 'XLSM'].includes(ext);
    const isWord = ['DOC', 'DOCX'].includes(ext);
    const isPpt = ['PPT', 'PPTX'].includes(ext);

    return {
      ...(typeof item === 'object' ? item : {}),
      name,
      url,
      type: ext,
      isImage,
      isPdf,
      isExcel,
      isWord,
      isPpt
    };
  };

  const parseAttachments = (attData) => {
    if (!attData) return [];
    let list = [];
    if (Array.isArray(attData)) {
      list = attData;
    } else if (typeof attData === 'string') {
      const trimmed = attData.trim();
      if (!trimmed || trimmed === '[]' || trimmed === 'null' || trimmed === '""') return [];
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        try {
          const parsed = JSON.parse(trimmed);
          list = Array.isArray(parsed) ? parsed : [parsed];
        } catch {
          list = [];
        }
      } else if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        try {
          list = [JSON.parse(trimmed)];
        } catch {
          list = [];
        }
      } else {
        list = trimmed.split(',').map((s) => s.trim()).filter(Boolean);
      }
    } else if (typeof attData === 'object') {
      list = [attData];
    }
    return list.map(normalizeAttachment).filter(Boolean);
  };

  const renderPriorityBadge = (priority) => {
    if (!priority) return <span className="text-slate-400 font-normal">—</span>;
    const p = String(priority).toLowerCase();
    if (p === 'critical') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
          Critical
        </span>
      );
    }
    if (p === 'high') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
          High
        </span>
      );
    }
    if (p === 'medium') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
          Medium
        </span>
      );
    }
    if (p === 'low') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          Low
        </span>
      );
    }
    return <span className="text-slate-700 font-medium">{priority}</span>;
  };

  const renderIssueTypeBadge = (issueType) => {
    if (!issueType) return <span className="text-slate-400 font-normal">—</span>;
    const it = String(issueType).toLowerCase();
    if (it === 'repeated') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-orange-50 text-orange-700 border border-orange-200">
          Repeated
        </span>
      );
    }
    if (it === 'new') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
          New
        </span>
      );
    }
    return <span className="text-slate-700 font-medium">{issueType}</span>;
  };

  const matchesExecutorUser = (execStr, uName, uEmail) => {
    if (!execStr) return false;
    const e = execStr.trim().toLowerCase();
    const name = (uName || '').trim().toLowerCase();
    const email = (uEmail || '').trim().toLowerCase();

    if (name && (e === name || e.includes(name))) return true;
    if (email && (e === email || e.includes(email))) return true;

    const tokens = e.replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter(Boolean);
    if (name && tokens.includes(name)) return true;
    return false;
  };

  // Operational permissions:
  // 1. Closer Fields (Root Cause, Action, Standardization, Evidence, Target Date):
  //    - Assigned Executor can edit and submit closer log.
  //    - Quality Admin can click "Edit Closer Fields" to unlock, edit, and update closer fields anytime.
  const isSelectedClosed = Boolean(
    selectedRequest && String(selectedRequest.status || '').toUpperCase().includes('CLOSE')
  );

  const hasCloserSubmitted = Boolean(
    selectedRequest && (
      Boolean(selectedRequest.action && String(selectedRequest.action).trim()) ||
      Boolean(selectedRequest.corrective_action && String(selectedRequest.corrective_action).trim()) ||
      Boolean(selectedRequest.root_cause && String(selectedRequest.root_cause).trim()) ||
      Boolean(selectedRequest.target_date) ||
      (selectedRequest.action_attachments && parseAttachments(selectedRequest.action_attachments).length > 0)
    )
  );

  const isCloserCompleted = (r) => {
    if (!r) return false;
    const s = String(r.status || '').toLowerCase();
    if (s.includes('approval') || s.includes('progress') || s.includes('signed')) return true;
    return Boolean(
      (r.corrective_action && String(r.corrective_action).trim()) ||
      (r.action && String(r.action).trim()) ||
      (r.root_cause && String(r.root_cause).trim()) ||
      (r.standardization_details && String(r.standardization_details).trim()) ||
      Boolean(r.target_date) ||
      Boolean(r.action_taken_by) ||
      (r.action_attachments && parseAttachments(r.action_attachments).length > 0)
    );
  };

  const isCloser = Boolean(
    selectedRequest && matchesExecutorUser(selectedRequest.executor, currentUser?.name, currentUser?.email)
  );

  const isCloserDataToBeUpdated = Boolean(
    !closerAction || !closerAction.trim() || !closerTargetDate
  );

  const canUpdateCloserFields = Boolean(
    selectedRequest && (
      (isAdmin && adminEditCloser) ||
      (!isAdmin && isCloser && !hasCloserSubmitted && !isSelectedClosed)
    )
  );

  const canUpdateAdminFields = Boolean(
    selectedRequest && isAdmin
  );

  const isLockedForCloserUser = !isAdmin && (isSelectedClosed || hasCloserSubmitted);

  // Reassign Closer is disabled when no request is selected, or when review fields are disabled/pending closer submission, or closed
  const isReassignDisabled = Boolean(
    !selectedRequest || isCloserDataToBeUpdated || isSelectedClosed || adminEditCloser
  );

  // Fetch users for department-based reassignment
  useEffect(() => {
    let isMounted = true;
    processAuditService.getUsers()
      .then((users) => {
        if (isMounted && Array.isArray(users)) {
          setDbUsers(users);
        }
      })
      .catch((err) => console.warn('Could not fetch DB users in Process Audit Approvals:', err));

    return () => {
      isMounted = false;
    };
  }, []);

  const STANDARD_DEPTS = [
    'PRODUCTION',
    'MAINTENANCE',
    'PED',
    'MATERIALS',
    'MARKETING',
    'INCOMING QUALITY'
  ];

  const isUserActive = (u) => {
    if (!u) return false;
    if (u.is_active === false || u.is_active === 0 || u.is_active === '0') return false;
    const s = String(u.status || 'ACTIVE').trim().toUpperCase();
    return s !== 'INACTIVE';
  };

  const departmentList = Array.from(
    new Set([
      ...STANDARD_DEPTS,
      ...dbUsers.filter(isUserActive).map((u) => (u.department || '').trim().toUpperCase()).filter(Boolean)
    ])
  ).sort();

  const getDepartmentUsers = (dept) => {
    if (!dept) return [];
    const targetDept = dept.trim().toUpperCase();
    return dbUsers.filter((u) => {
      const uDept = (u.department || '').trim().toUpperCase();
      return uDept === targetDept && isUserActive(u);
    });
  };

  // Close Reassign User Dropdown on Outside Click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (reassignUserDropdownRef.current && !reassignUserDropdownRef.current.contains(e.target)) {
        setIsReassignUserDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reset reassign form when no request is selected or when reassign is disabled
  useEffect(() => {
    if (isReassignDisabled) {
      setIsReassignOpen(false);
      setIsReassignUserDropdownOpen(false);
      setReassignedDept('');
      setReassignedPerson('');
      setReassignUserSearch('');
    }
  }, [isReassignDisabled]);

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
      setReassignPersonError(false);
    }
  };

  const handleRemoveReassignUser = (userName, e) => {
    if (e) e.stopPropagation();
    const current = getSelectedReassignedUsers();
    const updated = current.filter((u) => u !== userName);
    setReassignedPerson(updated.join(', '));
  };

  const handleClearAllReassignUsers = () => {
    setReassignedPerson('');
  };

  const handleDeptChange = (newDept) => {
    setReassignedDept(newDept);
    if (newDept) {
      setReassignDeptError(false);
    }
    const usersInDept = getDepartmentUsers(newDept).map((u) => u.name);
    const current = getSelectedReassignedUsers();
    const valid = current.filter((u) => usersInDept.includes(u));
    setReassignedPerson(valid.join(', '));
    if (valid.length > 0) {
      setReassignPersonError(false);
    }
    setIsReassignUserDropdownOpen(false);
    setReassignUserSearch('');
  };

  const loadRequests = async () => {
    setLoading(true);
    try {
      const params = {};
      if (!isAdmin && (currentUser?.name || currentUser?.email || currentUser?.id)) {
        params.executor = currentUser?.name || currentUser?.email;
        params.user = currentUser?.name || currentUser?.email;
        params.user_id = currentUser?.id;
        params.role = currentUser?.role;
      }
      const data = await processAuditService.getRequests(params);
      const list = Array.isArray(data) ? data : [];
      setRequests(list);

      // Deep linking or re-selecting active request
      if (selectedRequest) {
        const fresh = list.find((r) => r.id === selectedRequest.id || r.issue_no === selectedRequest.issue_no);
        if (fresh) populateForm(fresh);
      } else if (queryRequestId && list.length > 0) {
        const match = list.find(
          (r) =>
            String(r.id) === String(queryRequestId) ||
            String(r.issue_no || '').toLowerCase() === String(queryRequestId).toLowerCase()
        );
        if (match) populateForm(match);
      } else if (list.length > 0) {
        populateForm(list[0]);
      }
    } catch (err) {
      console.error('Failed to load approval requests from DB:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();

    let debounceTimer = null;
    const handleLiveUpdate = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        loadRequests();
      }, 150);
    };

    window.addEventListener('processAuditLiveUpdate', handleLiveUpdate);

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      window.removeEventListener('processAuditLiveUpdate', handleLiveUpdate);
    };
  }, [user?.name, user?.role]);

  // Populate form fields when a row is clicked
  const populateForm = (req, keepEditMode = false) => {
    setSelectedRequest(req);
    if (!keepEditMode) {
      setAdminEditCloser(false);
    }
    setSuccessMessage('');
    setErrorMessage('');
    setRootCauseError(false);
    setCloserActionError(false);
    setEvidenceError(false);
    setCloserTargetDateError(false);
    setRemarksError(false);
    setStatusError(false);

    setRootCause(req.root_cause || '');
    setCloserAction(req.corrective_action || req.action || '');
    setStandardizationDetails(req.standardization_details || '');
    setCloserTargetDate(
      req.target_date
        ? req.target_date.includes('T')
          ? req.target_date.split('T')[0]
          : req.target_date
        : ''
    );
    setCloserRemarks(req.creator_remark || req.comments || req.remarks || '');
    setCloserStatus('');
    setReassignedDept(req.department || '');
    setReassignedPerson(req.executor || '');
    setIsReassignOpen(false);
    setIsReassignUserDropdownOpen(false);
    setReassignUserSearch('');

    // Evidence attachments
    const existing = req.action_attachments ? parseAttachments(req.action_attachments) : [];
    setExistingEvidence(existing);
    setNewEvidenceFiles([]);
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const added = Array.from(e.target.files);
      setNewEvidenceFiles((prev) => [...prev, ...added]);
      setEvidenceError(false);
    }
  };

  const handleRemoveExistingEvidence = (index) => {
    setExistingEvidence((prev) => prev.filter((_, i) => i !== index));
  };

  const handleRemoveNewEvidence = (index) => {
    setNewEvidenceFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveAnnotation = (annotatedFile) => {
    if (!annotatingItem) return;
    setNewEvidenceFiles((prev) => [...prev, annotatedFile]);
    setEvidenceError(false);
    setAnnotatingItem(null);
    setSuccessMessage(`Annotated drawing "${annotatedFile.name}" added to evidence files! Remember to click "Save Closer Changes" or "Submit Closer Log" to save.`);
  };

  // 1. Submit Closer Updates (Root Cause, Action, Standardization, Evidence, Target Date)
  const handleSaveCloser = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!selectedRequest) return;

    if (isLockedForCloserUser) {
      if (isSelectedClosed) {
        setErrorMessage('This request is closed. Only Admin can update closed requests.');
      } else {
        setErrorMessage('Closer details have already been submitted once for this request. Only Quality Admin has permission to make multiple updates.');
      }
      return;
    }

    if (!canUpdateCloserFields && !isAdmin) {
      setErrorMessage('You do not have permission to update fields on this request.');
      return;
    }

    // Mandatory Closer Field Validations
    let hasCloserErrors = false;

    if (!rootCause || !rootCause.trim()) {
      setRootCauseError(true);
      hasCloserErrors = true;
    } else {
      setRootCauseError(false);
    }

    if (!closerAction || !closerAction.trim()) {
      setCloserActionError(true);
      hasCloserErrors = true;
    } else {
      setCloserActionError(false);
    }

    const totalEvidenceCount = (existingEvidence ? existingEvidence.length : 0) + (newEvidenceFiles ? newEvidenceFiles.length : 0);
    if (totalEvidenceCount === 0) {
      setEvidenceError(true);
      hasCloserErrors = true;
    } else {
      setEvidenceError(false);
    }

    if (!closerTargetDate || !closerTargetDate.trim()) {
      setCloserTargetDateError(true);
      hasCloserErrors = true;
    } else {
      setCloserTargetDateError(false);
    }

    if (hasCloserErrors) {
      setErrorMessage('Please fill in all mandatory closer fields before submitting.');
      return;
    }

    setIsSavingCloser(true);
    setSuccessMessage('');
    setErrorMessage('');

    try {
      let uploadedList = [];
      if (newEvidenceFiles.length > 0) {
        uploadedList = await processAuditService.uploadAttachments(newEvidenceFiles);
      }
      const combinedEvidence = [...existingEvidence, ...uploadedList];
      const reqId = selectedRequest.id || selectedRequest.issue_no;
      const displayId = selectedRequest.issue_no || (selectedRequest.id ? `PA-${selectedRequest.id}` : `#${selectedRequest.id}`);

      const targetStatus = (selectedRequest.status || '').toLowerCase() === 'closed'
        ? 'Closed'
        : 'Approval Pending';

      const payload = {
        status: targetStatus,
        root_cause: rootCause.trim(),
        corrective_action: closerAction.trim(),
        standardization_details: standardizationDetails.trim(),
        action_attachments: combinedEvidence,
        target_date: closerTargetDate || null,
        action_taken_by: currentUser?.name || currentUser?.email || 'Assigned Executor',
        approved_by: currentUser?.name || currentUser?.email || 'Assigned Executor',
        approved_by_id: currentUser?.id || null,
        approved_by_email: currentUser?.email || null,
        approved_by_role: currentUser?.role || null
      };

      const updated = await processAuditService.updateRequestStatus(reqId, targetStatus, payload);

      const msg = isAdmin
        ? `Closer root cause & corrective action updated successfully for ${displayId}!`
        : `Closer details submitted successfully for ${displayId}! Quality Admin will review and sign off status.`;

      setSuccessMessage(msg);
      setNewEvidenceFiles([]);
      setAdminEditCloser(false);

      const mergedUpdated = { ...selectedRequest, ...payload, ...updated, status: targetStatus };
      setSelectedRequest(mergedUpdated);
      populateForm(mergedUpdated, false);
      await loadRequests();

      setTimeout(() => {
        setSuccessMessage('');
      }, 4000);
    } catch (err) {
      console.error('Failed to update closer fields:', err);
      setErrorMessage(err.response?.data?.message || err.message || 'Failed to update closer log');
    } finally {
      setIsSavingCloser(false);
    }
  };

  // 2. Submit Admin Sign-Off Updates (Remarks, Status, Reassignment) - Independent
  const handleSaveAdmin = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!selectedRequest) return;

    if (adminEditCloser) {
      setErrorMessage('Admin Sign-Off is disabled while editing closer fields. Please save or cancel closer log updates first.');
      return;
    }

    if (!isAdmin) {
      setErrorMessage('Only Quality Admin has permission to update Admin Review and sign off status.');
      return;
    }

    if (!isReassignOpen && isCloserDataToBeUpdated) {
      setErrorMessage('Corrective Action & Target Date must be completed before Admin Sign-Off.');
      return;
    }

    if (!closerRemarks || !closerRemarks.trim()) {
      setRemarksError(true);
      return;
    }
    setRemarksError(false);

    if (!isReassignOpen && !closerStatus) {
      setStatusError(true);
      return;
    }
    setStatusError(false);

    if (isReassignOpen) {
      let reassignHasErr = false;
      if (!reassignedDept) {
        setReassignDeptError(true);
        reassignHasErr = true;
      } else {
        setReassignDeptError(false);
      }
      if (!reassignedPerson || reassignedPerson.trim() === '') {
        setReassignPersonError(true);
        reassignHasErr = true;
      } else {
        setReassignPersonError(false);
      }
      if (reassignHasErr) return;
    }

    setIsSavingAdmin(true);
    setSuccessMessage('');
    setErrorMessage('');

    const reqId = selectedRequest.id || selectedRequest.issue_no;
    const displayId = selectedRequest.issue_no || (selectedRequest.id ? `PA-${selectedRequest.id}` : `#${selectedRequest.id}`);

    try {
      if (isReassignOpen) {
        await processAuditService.reassignRequest(reqId, {
          new_department: reassignedDept,
          new_executor: reassignedPerson,
          reason: closerRemarks.trim(),
          reassigned_by: currentUser?.name || 'Quality Admin',
          reassigned_by_id: currentUser?.id || null,
          role: currentUser?.role || 'ADMIN',
          user_department: userDept || 'INCOMING QUALITY'
        });

        await processAuditService.updateRequestStatus(reqId, 'Open', {
          creator_remark: closerRemarks.trim(),
          remark: closerRemarks.trim(),
          closed_by: currentUser?.name || null
        });

        const msg = `Request #${displayId} status updated & reassigned to ${reassignedPerson} (${reassignedDept}) successfully!`;
        setSuccessMessage(msg);
        setIsReassignOpen(false);
        setIsReassignUserDropdownOpen(false);
        setReassignUserSearch('');
        await loadRequests();
      } else {
        const targetStatus = closerStatus === 'CLOSED' ? 'Closed' : (closerStatus === 'OPEN' ? 'Open' : closerStatus);

        const payload = {
          creator_remark: closerRemarks.trim(),
          remark: closerRemarks.trim(),
          closed_by: currentUser?.name || 'Quality Admin',
          closed_by_id: currentUser?.id || null,
          approved_by: currentUser?.name || 'Quality Admin',
          approved_by_id: currentUser?.id || null,
          approved_by_email: currentUser?.email || null,
          approved_by_role: currentUser?.role || 'ADMIN'
        };

        const updated = await processAuditService.updateRequestStatus(reqId, targetStatus, payload);
        const msg = `Admin review remarks & status sign-off (${targetStatus}) updated successfully for ${displayId}!`;
        setSuccessMessage(msg);

        if (targetStatus === 'Closed') {
          const merged = { ...selectedRequest, ...payload, ...updated, status: 'Closed' };
          setSelectedRequest(merged);
          populateForm(merged);
        } else if (updated) {
          const merged = { ...selectedRequest, ...payload, ...updated, status: targetStatus };
          setSelectedRequest(merged);
          populateForm(merged);
        }
        await loadRequests();
      }

      setTimeout(() => {
        setSuccessMessage('');
      }, 4000);
    } catch (err) {
      console.error('Failed to update admin fields:', err);
      setErrorMessage(err.response?.data?.message || err.message || 'Failed to update admin review & status');
    } finally {
      setIsSavingAdmin(false);
    }
  };

  // Filter requests
  const filtered = requests.filter((r) => {
    if (!isAdmin) {
      const isAssignedToMe = matchesExecutorUser(r.executor, user?.name, user?.email);
      if (!isAssignedToMe) return false;
    }

    const reqId = String(r.issue_no || (r.id ? `PA-${r.id}` : '')).toLowerCase();
    const stage = String(r.model || r.stage || '').toLowerCase();
    const line = String(r.process_operation || r.line || '').toLowerCase();
    const executor = String(r.executor || '').toLowerCase();
    const creator = String(r.created_by || r.creator || '').toLowerCase();
    const prod = String(r.product || r.production || '').toLowerCase();
    const obs = String(r.issue_observation || r.problem || '').toLowerCase();
    const remarks = String(r.creator_remark || r.comments || r.remarks || '').toLowerCase();
    const q = search.trim().toLowerCase();

    const matchesSearch =
      !q ||
      reqId.includes(q) ||
      stage.includes(q) ||
      line.includes(q) ||
      executor.includes(q) ||
      creator.includes(q) ||
      prod.includes(q) ||
      obs.includes(q) ||
      remarks.includes(q);

    const s = (r.status || 'Pending').toLowerCase();
    const isClosed = s.includes('close');
    const isRejected = s.includes('reject');
    const isOpen = s === 'open' || s.includes('open') || s.includes('reopen');
    const closerDone = isCloserCompleted(r);

    let matchesStatus = true;
    if (selectedStatus === 'Pending' || selectedStatus === 'PENDING') {
      matchesStatus = !closerDone && !isClosed && !isRejected && !isOpen;
    } else if (
      selectedStatus === 'Approval Pending' ||
      selectedStatus === 'APPROVAL PENDING' ||
      selectedStatus === 'In Progress' ||
      selectedStatus === 'Signed off' ||
      selectedStatus === 'IN_PROGRESS'
    ) {
      matchesStatus = closerDone && !isClosed && !isRejected;
    } else if (selectedStatus === 'Closed' || selectedStatus === 'CLOSED') {
      matchesStatus = isClosed;
    } else if (selectedStatus === 'Open' || selectedStatus === 'OPEN') {
      matchesStatus = isOpen;
    } else if (selectedStatus === 'Rejected' || selectedStatus === 'REJECTED') {
      matchesStatus = isRejected;
    }

    return matchesSearch && matchesStatus;
  });

  // Pagination calculation
  const totalRecords = filtered.length;
  const totalPages = Math.ceil(totalRecords / rowsPerPage) || 1;
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = Math.min(startIndex + rowsPerPage, totalRecords);
  const paginatedRequests = filtered.slice(startIndex, endIndex);

  const formatDate = (dateVal) => {
    if (!dateVal) return '—';
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return String(dateVal).split('T')[0];
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  // Export to Excel (.xlsx)
  const handleExportExcel = () => {
    try {
      const exportData = filtered.map((r, index) => {
        return {
          'SL NO': index + 1,
          'AUDIT REQ NO': r.issue_no || (r.id ? `PA-${r.id}` : `#${r.id}`),
          'DATE': r.escalation_date || r.created_at ? formatDateDDMMYYYY(r.escalation_date || r.created_at) : '—',
          'SHIFT': r.shift || '—',
          'PRODUCT': r.product || '—',
          'STAGE / MODEL': r.model || r.stage || '—',
          'LINE / OPERATION': r.process_operation || r.line || '—',
          'AUDIT OBSERVATION': r.issue_observation || r.problem || '—',
          'EXECUTOR': r.executor || '—',
          'ROOT CAUSE': r.root_cause || '—',
          'ACTION': r.corrective_action || r.action || '—',
          'STANDARDIZATION': r.standardization_details || '—',
          'TARGET DATE': r.target_date ? formatDateDDMMYYYY(r.target_date) : '—',
          'REMARKS': r.creator_remark || r.comments || r.remarks || '—',
          'STATUS': (() => {
            const s = (r.status || '').toLowerCase();
            if (s.includes('progress') || s.includes('approved') || s.includes('signed')) {
              return isAdmin ? 'In Progress' : 'Signed off';
            }
            if (s.includes('close')) return 'Closed';
            if (s.includes('reject')) return 'Rejected';
            if (s.includes('open')) return 'Open';
            return 'Pending';
          })()
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      worksheet['!cols'] = [
        { wch: 8 }, { wch: 14 }, { wch: 14 }, { wch: 10 },
        { wch: 16 }, { wch: 18 }, { wch: 20 }, { wch: 30 },
        { wch: 18 }, { wch: 25 }, { wch: 25 }, { wch: 25 },
        { wch: 14 }, { wch: 25 }, { wch: 15 }
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Audit Approvals Queue');
      const today = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(workbook, `Process_Audit_Approvals_Queue_${today}.xlsx`);
      setShowExportModal(false);
    } catch (err) {
      console.error('Failed to export approvals to Excel:', err);
      alert('Failed to export to Excel: ' + err.message);
    }
  };

  // Export to PDF (.pdf)
  const handleExportPdf = () => {
    try {
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'pt',
        format: 'a4'
      });

      const today = new Date().toISOString().slice(0, 10);

      // Top Title and Company Branding
      doc.setFontSize(16);
      doc.setTextColor(30, 41, 59);
      doc.text('INDIA NIPPON ELECTRICALS LIMITED', 40, 36);

      doc.setFontSize(11);
      doc.setTextColor(217, 119, 6);
      doc.text('Process Audit Sign-off & Closer Approvals Queue', 40, 52);

      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text(`Generated: ${today} | Total Records: ${filtered.length} | Status Filter: ${selectedStatus}`, 40, 68);

      const tableHeaders = [
        ['SL', 'REQ NO', 'DATE', 'OBSERVATION & STAGE', 'EXECUTOR', 'ROOT CAUSE', 'ACTION', 'TARGET DATE', 'STATUS']
      ];

      const tableRows = filtered.map((r, idx) => [
        idx + 1,
        r.issue_no || (r.id ? `PA-${r.id}` : `#${r.id}`),
        r.escalation_date || r.created_at ? formatDateDDMMYYYY(r.escalation_date || r.created_at) : '—',
        `${r.issue_observation || r.problem || '—'}\n(${r.model || r.stage || '—'} - ${r.process_operation || r.line || '—'})`,
        r.executor || '—',
        r.root_cause || '—',
        r.corrective_action || r.action || '—',
        r.target_date ? formatDateDDMMYYYY(r.target_date) : '—',
        r.status || 'Pending'
      ]);

      autoTable(doc, {
        head: tableHeaders,
        body: tableRows,
        startY: 80,
        theme: 'grid',
        styles: { fontSize: 8.5, cellPadding: 4, valign: 'middle', overflow: 'linebreak' },
        headStyles: { fillColor: [30, 58, 138], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
        columnStyles: {
          0: { cellWidth: 28, halign: 'center' },
          1: { cellWidth: 65, fontStyle: 'bold', halign: 'center' },
          2: { cellWidth: 65 },
          3: { cellWidth: 150 },
          4: { cellWidth: 80 },
          5: { cellWidth: 120 },
          6: { cellWidth: 120 },
          7: { cellWidth: 65 },
          8: { cellWidth: 65, halign: 'center', fontStyle: 'bold' }
        },
        alternateRowStyles: { fillColor: [248, 250, 252] }
      });

      doc.save(`Process_Audit_Approvals_Queue_${today}.pdf`);
      setShowExportModal(false);
    } catch (err) {
      console.error('Failed to export approvals to PDF:', err);
      alert('Failed to export to PDF: ' + err.message);
    }
  };

  // Convert new files to previewable objects
  const previewableNewFiles = newEvidenceFiles.map((f) => {
    const ext = f.name.split('.').pop()?.toUpperCase() || 'FILE';
    const isImage = ['PNG', 'JPG', 'JPEG', 'WEBP', 'GIF', 'SVG', 'JFIF', 'BMP'].includes(ext);
    const isPdf = ext === 'PDF';
    const isExcel = ['XLS', 'XLSX', 'CSV', 'XLSM'].includes(ext);
    const isWord = ['DOC', 'DOCX'].includes(ext);
    const isPpt = ['PPT', 'PPTX'].includes(ext);
    return {
      name: f.name,
      url: URL.createObjectURL(f),
      type: ext,
      isImage,
      isPdf,
      isExcel,
      isWord,
      isPpt,
      rawFile: f
    };
  });

  const isRequestApproved = (req) => {
    if (!req || !req.status) return false;
    const s = String(req.status).trim().toLowerCase();
    return s.includes('approved') || s.includes('close') || s.includes('progress') || s.includes('signed');
  };

  const isSelectedApproved = Boolean(selectedRequest && isRequestApproved(selectedRequest));

  return (
    <div className="space-y-6 w-full pb-16">
      {/* Top Header & Breadcrumbs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
            <span className="text-blue-600 font-bold uppercase tracking-wider font-mono">PROCESS AUDIT REPOSITORY</span>
            <span>/</span>
            <span>Approvals &amp; Sign-off Management</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Process Audit Approvals &amp; Sign-off Log
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Update root causes, corrective actions, standardization details, evidence attachments, and sign off audit closures.
          </p>
        </div>
      </div>

      {/* Main Two-Column Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

        {/* ============================================================== */}
        {/* LEFT COLUMN: Update Closer / Sign-off Log Form (Matching IHLR)  */}
        {/* ============================================================== */}
        <div className="lg:col-span-5 xl:col-span-4 bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 sm:p-6 space-y-5 sticky top-4">

          {/* Card Title */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-2xs">
                <FileCheck className="w-4 h-4" />
              </div>
              <h2 className="text-sm font-bold text-slate-900">
                Update Sign-off Log
              </h2>
            </div>
            {selectedRequest && (
              <div className="flex items-center gap-1.5">
                <span className="px-2 py-0.5 rounded-md font-mono text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                  {selectedRequest.issue_no || (selectedRequest.id ? `PA-${selectedRequest.id}` : `#${selectedRequest.id}`)}
                </span>
                {adminEditCloser && (
                  <span className="px-2 py-0.5 rounded-md font-mono text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                    ADMIN EDIT ACTIVE
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Admin Edit Mode Active Banner */}
          {adminEditCloser && (
            <div className="p-2.5 px-3 rounded-xl border border-amber-300 bg-amber-50/90 text-amber-900 text-xs flex items-center justify-between gap-2 animate-in fade-in">
              <div className="flex items-center gap-2">
                <Pencil className="w-4 h-4 text-amber-600 shrink-0" />
                <span className="font-bold">Admin Edit Mode Active: Update closer fields below</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setAdminEditCloser(false);
                  if (selectedRequest) populateForm(selectedRequest, false);
                }}
                className="text-[11px] font-bold text-amber-800 hover:text-amber-950 underline cursor-pointer"
              >
                Cancel
              </button>
            </div>
          )}

          {/* Success / Error Alerts */}
          {successMessage && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 animate-in fade-in">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Form Fields */}
          <form onSubmit={handleSaveCloser} className="space-y-4 text-xs">

            {/* 1. Request Reference Fields (Disabled grey boxes matching IHLR) */}
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  AUDIT REQ NO <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  readOnly
                  disabled
                  value={selectedRequest ? (selectedRequest.issue_no || (selectedRequest.id ? `PA-${selectedRequest.id}` : `#${selectedRequest.id}`)) : ''}
                  placeholder="Click a row on the right to select"
                  className="w-full px-3.5 py-2.5 bg-slate-100/80 border border-slate-200 rounded-xl text-slate-700 font-semibold cursor-not-allowed select-none outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  REQUESTED DATE <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  readOnly
                  disabled
                  value={selectedRequest ? (selectedRequest.escalation_date || selectedRequest.created_at ? formatDateDDMMYYYY(selectedRequest.escalation_date || selectedRequest.created_at) : '') : ''}
                  placeholder="Click a row on the right to select"
                  className="w-full px-3.5 py-2.5 bg-slate-100/80 border border-slate-200 rounded-xl text-slate-700 font-semibold cursor-not-allowed select-none outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  PROBLEM / OPERATION <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  readOnly
                  disabled
                  value={selectedRequest ? `${selectedRequest.issue_observation || selectedRequest.problem || ''} (${selectedRequest.process_operation || selectedRequest.model || 'N/A'})` : ''}
                  placeholder="Click a row on the right to select"
                  className="w-full px-3.5 py-2.5 bg-slate-100/80 border border-slate-200 rounded-xl text-slate-700 font-semibold cursor-not-allowed select-none outline-none truncate"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  CURRENT ASSIGNED EXECUTOR <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  readOnly
                  disabled
                  value={selectedRequest ? `${selectedRequest.executor || 'Not Assigned'} (${selectedRequest.department || 'N/A'})` : ''}
                  placeholder="Click a row on the right to select"
                  className="w-full px-3.5 py-2.5 bg-slate-100/80 border border-slate-200 rounded-xl text-slate-700 font-semibold cursor-not-allowed select-none outline-none truncate"
                />
              </div>
            </div>

            {/* Separator */}
            <div className="pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-black uppercase tracking-wider text-amber-700 flex items-center gap-1.5">
                    <span>Occurrence Cause &amp; Action (Executor Sign-Off)</span>
                    {selectedRequest && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-200">
                        Closer
                      </span>
                    )}
                  </span>
                </div>
              </div>
            </div>

            {/* Root Cause Field */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <span>ROOT CAUSE</span>
                  <span className="text-rose-500">*</span>
                  {selectedRequest && (
                    canUpdateCloserFields ? (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-200">
                        {isAdmin ? 'Admin Edit' : 'Closer'}
                      </span>
                    ) : (
                      <span className="text-[9px] font-medium px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded border border-slate-200">
                        {isAdmin ? 'Locked (Click Edit Below)' : 'Closer Only (Read-Only)'}
                      </span>
                    )
                  )}
                </label>
              </div>
              <textarea
                rows={2}
                disabled={!canUpdateCloserFields}
                value={rootCause}
                onChange={(e) => {
                  setRootCause(e.target.value);
                  if (rootCauseError && e.target.value.trim()) setRootCauseError(false);
                }}
                placeholder={!selectedRequest ? 'Click a row on the right to select' : !canUpdateCloserFields ? 'Locked - Read only' : 'Identify underlying root cause of deviation/defect...'}
                className={`w-full px-3.5 py-2 bg-white border rounded-xl text-slate-800 outline-none disabled:bg-slate-100/70 disabled:text-slate-500 disabled:cursor-not-allowed transition resize-none ${
                  rootCauseError
                    ? 'border-rose-400 focus:ring-2 focus:ring-rose-400/20 focus:border-rose-500 bg-rose-50/20'
                    : 'border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500'
                }`}
              />
              {rootCauseError && (
                <p className="text-[11px] text-rose-500 font-semibold mt-1 flex items-center gap-1">
                  <span>* Root Cause is mandatory. Please enter root cause.</span>
                </p>
              )}
            </div>

            {/* Corrective Action Field */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <span>CORRECTIVE ACTION</span>
                  <span className="text-rose-500">*</span>
                  {selectedRequest && (
                    canUpdateCloserFields ? (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-200">
                        {isAdmin ? 'Admin Edit' : 'Closer'}
                      </span>
                    ) : (
                      <span className="text-[9px] font-medium px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded border border-slate-200">
                        {isAdmin ? 'Locked (Click Edit Below)' : 'Closer Only (Read-Only)'}
                      </span>
                    )
                  )}
                </label>
              </div>
              <textarea
                rows={2}
                disabled={!canUpdateCloserFields}
                value={closerAction}
                onChange={(e) => {
                  setCloserAction(e.target.value);
                  if (closerActionError && e.target.value.trim()) setCloserActionError(false);
                }}
                placeholder={!selectedRequest ? 'Click a row on the right to select' : !canUpdateCloserFields ? 'Locked - Read only' : 'Describe corrective actions taken / countermeasures...'}
                className={`w-full px-3.5 py-2 bg-white border rounded-xl text-slate-800 outline-none disabled:bg-slate-100/70 disabled:text-slate-500 disabled:cursor-not-allowed transition resize-none ${
                  closerActionError
                    ? 'border-rose-400 focus:ring-2 focus:ring-rose-400/20 focus:border-rose-500 bg-rose-50/20'
                    : 'border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500'
                }`}
              />
              {closerActionError && (
                <p className="text-[11px] text-rose-500 font-semibold mt-1 flex items-center gap-1">
                  <span>* Corrective Action is mandatory. Please describe corrective actions taken.</span>
                </p>
              )}
            </div>

            {/* Standardization Details Field */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                  STANDARDIZATION DETAILS
                </label>
              </div>
              <textarea
                rows={2}
                disabled={!canUpdateCloserFields}
                value={standardizationDetails}
                onChange={(e) => setStandardizationDetails(e.target.value)}
                placeholder={!selectedRequest ? 'Click a row on the right to select' : !canUpdateCloserFields ? 'Locked - Read only' : 'Detail SOP revisions, Work Instructions, poka-yoke, or line standards...'}
                className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none disabled:bg-slate-100/70 disabled:text-slate-500 disabled:cursor-not-allowed transition resize-none"
              />
            </div>

            {/* Evidence Attachment */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <span>EVIDENCE ATTACHMENT</span>
                  <span className="text-rose-500">*</span>
                  {selectedRequest && (
                    canUpdateCloserFields ? (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-200">
                        {isAdmin ? 'Admin Edit' : 'Closer'}
                      </span>
                    ) : (
                      <span className="text-[9px] font-medium px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded border border-slate-200">
                        {isAdmin ? 'Locked (Click Edit Below)' : 'Closer Only (Read-Only)'}
                      </span>
                    )
                  )}
                </label>
                <span className="text-[10px] text-slate-400 font-mono">PPT, JPEG, EXCEL &amp; PDF</span>
              </div>

              {/* Styled File Input Button */}
              <div className={`flex items-center gap-2 p-1 rounded-xl transition ${
                evidenceError ? 'border border-rose-300 bg-rose-50/20 ring-2 ring-rose-300/30' : ''
              }`}>
                <button
                  type="button"
                  disabled={!canUpdateCloserFields}
                  onClick={() => fileInputRef.current && fileInputRef.current.click()}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                >
                  Choose files
                </button>
                <span className="text-[11px] text-slate-500 truncate">
                  {newEvidenceFiles.length > 0
                    ? `${newEvidenceFiles.length} file(s) selected`
                    : existingEvidence.length > 0
                    ? `${existingEvidence.length} existing attachment(s)`
                    : 'No file chosen'}
                </span>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".ppt,.pptx,.pdf,.doc,.docx,.xls,.xlsx,.csv,.png,.jpg,.jpeg,.jfif,.webp,.bmp,image/jpeg,image/png,image/jfif,image/pjpeg,image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>
              {evidenceError && (
                <p className="text-[11px] text-rose-500 font-semibold mt-1 flex items-center gap-1">
                  <span>* Evidence Attachment is mandatory. Please choose and upload at least one evidence document.</span>
                </p>
              )}

              {/* Existing (saved in DB) and newly selected chips */}
              <div className="mt-2 space-y-1">
                {existingEvidence.length > 0 && (
                  <AttachmentChipList
                    attachments={existingEvidence}
                    onPreview={(att) => setSelectedPreviewAttachment(att)}
                    onAnnotate={canUpdateCloserFields ? (file) => setAnnotatingItem({ attachment: file }) : undefined}
                    onRemove={canUpdateCloserFields ? (idx) => handleRemoveExistingEvidence(idx) : undefined}
                    readonly={!canUpdateCloserFields}
                  />
                )}
                {previewableNewFiles.length > 0 && (
                  <AttachmentChipList
                    attachments={previewableNewFiles}
                    onPreview={(att) => setSelectedPreviewAttachment(att)}
                    onAnnotate={canUpdateCloserFields ? (file) => setAnnotatingItem({ attachment: file }) : undefined}
                    onRemove={canUpdateCloserFields ? (idx) => handleRemoveNewEvidence(idx) : undefined}
                    readonly={!canUpdateCloserFields}
                  />
                )}
              </div>
            </div>

            {/* Target Date */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <span>TARGET DATE</span>
                  <span className="text-rose-500">*</span>
                  {selectedRequest && (
                    canUpdateCloserFields ? (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-200">
                        {isAdmin ? 'Admin Edit' : 'Closer'}
                      </span>
                    ) : (
                      <span className="text-[9px] font-medium px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded border border-slate-200">
                        {isAdmin ? 'Locked (Click Edit Below)' : 'Closer Only (Read-Only)'}
                      </span>
                    )
                  )}
                </label>
              </div>
              <DateInput
                disabled={!canUpdateCloserFields}
                value={closerTargetDate}
                onChange={(e) => {
                  setCloserTargetDate(e.target.value);
                  if (closerTargetDateError && e.target.value) setCloserTargetDateError(false);
                }}
                className={`w-full px-3.5 py-2 bg-white border rounded-xl text-xs text-slate-800 outline-none disabled:bg-slate-100/70 disabled:text-slate-500 disabled:cursor-not-allowed transition ${
                  closerTargetDateError
                    ? 'border-rose-400 focus:ring-2 focus:ring-rose-400/20 focus:border-rose-500 bg-rose-50/20'
                    : 'border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500'
                }`}
              />
              {closerTargetDateError && (
                <p className="text-[11px] text-rose-500 font-semibold mt-1 flex items-center gap-1">
                  <span>* Target Date is mandatory. Please select a completion target date.</span>
                </p>
              )}
            </div>

            {/* Dedicated Closer Submit Button */}
            <div className="pt-1">
              {!selectedRequest ? (
                <button
                  type="button"
                  disabled
                  className="w-full py-2.5 px-4 rounded-xl border border-blue-200/80 bg-blue-50/50 text-blue-400 font-bold text-xs cursor-not-allowed select-none text-center shadow-2xs"
                >
                  Select a Request to Update
                </button>
              ) : isAdmin ? (
                adminEditCloser ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSaveCloser}
                      disabled={isSavingCloser || isSavingAdmin}
                      className="flex-1 py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-bold text-xs shadow-md hover:shadow-lg transition transform active:scale-98 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {isSavingCloser ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Saving Closer Log...</span>
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4" />
                          <span>Save Closer Changes</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAdminEditCloser(false);
                        if (selectedRequest) populateForm(selectedRequest, false);
                      }}
                      className="px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-600 font-bold text-xs transition cursor-pointer"
                      title="Cancel Editing"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setAdminEditCloser(true);
                      setIsReassignOpen(false);
                    }}
                    className="w-full py-2.5 px-4 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 active:bg-amber-200 text-amber-900 font-bold text-xs shadow-2xs hover:shadow-xs transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Pencil className="w-3.5 h-3.5 text-amber-600" />
                    <span>Edit Closer Fields</span>
                  </button>
                )
              ) : isSelectedClosed ? (
                <div className="w-full py-2.5 px-4 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 font-bold text-xs select-none text-center shadow-2xs flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Incident Closed — Updates Locked (Admin Only)</span>
                </div>
              ) : hasCloserSubmitted ? (
                <div className="w-full py-2.5 px-4 rounded-xl border border-blue-200 bg-blue-50/90 text-blue-900 font-bold text-xs select-none text-center shadow-2xs flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-blue-600" />
                  <span>Closer Details Submitted</span>
                </div>
              ) : !canUpdateCloserFields ? (
                <div className="w-full py-2.5 px-4 rounded-xl border border-slate-200 bg-slate-100 text-slate-600 font-bold text-xs select-none text-center shadow-2xs flex items-center justify-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-slate-500" />
                  <span>Read Only Access — Assigned Executor or Admin Only</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleSaveCloser}
                  disabled={isSavingCloser || isSavingAdmin}
                  className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs shadow-md hover:shadow-lg transition transform active:scale-98 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSavingCloser ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving Closer Log...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Submit Closer Log (Root Cause &amp; Action)</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Remarks, Status & Reassign - STRICTLY FOR QUALITY ADMIN */}
            {isAdmin && (
              <div className="pt-4 mt-2 border-t border-slate-200/90 space-y-3.5">
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Admin Review &amp; Sign-Off</span>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 bg-purple-50 text-purple-700 rounded border border-purple-200">
                      Admin Only
                    </span>
                    {adminEditCloser && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded border border-slate-300 flex items-center gap-1">
                        <Lock className="w-2.5 h-2.5" />
                        <span>Disabled</span>
                      </span>
                    )}
                  </label>
                  <span className="text-[10px] text-slate-400 font-medium">Independent Update</span>
                </div>

                {/* Pending Sign-Off Alert Banner or Disabled Notice Banner */}
                {adminEditCloser ? (
                  <div className="p-2.5 px-3 rounded-xl border border-amber-300 bg-amber-50/90 text-amber-900 text-[11px] flex items-center gap-2 animate-in fade-in">
                    <Lock className="w-4 h-4 text-amber-600 shrink-0" />
                    <div className="leading-tight">
                      <span className="font-bold">Review Paused: </span>
                      <span className="text-amber-800">
                        Finish closer editing above to resume Admin Sign-Off.
                      </span>
                    </div>
                  </div>
                ) : isCloserDataToBeUpdated ? (
                  <div className="p-2.5 px-3 rounded-xl border border-amber-200 bg-amber-50/80 text-amber-900 text-[11px] flex items-center gap-2 animate-in fade-in">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    <div className="leading-tight">
                      <span className="font-bold">Closer Pending: </span>
                      <span className="text-amber-800">
                        Action &amp; Target Date required before Admin Sign-Off.
                      </span>
                    </div>
                  </div>
                ) : (
                  selectedRequest && !isSelectedClosed && (
                    <div className="p-2.5 px-3 rounded-xl border border-amber-200 bg-amber-50/70 text-amber-900 text-[11px] flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                      <div className="leading-tight">
                        <span className="font-bold">Ready for Review: </span>
                        <span className="text-amber-800">
                          Add remarks and finalize status below.
                        </span>
                      </div>
                    </div>
                  )
                )}

                {/* Reassign Closer (Optional - Button trigger to expand) */}
                <div className="space-y-2">
                  {!isReassignOpen || !selectedRequest ? (
                    <div className={`flex items-center justify-between p-2.5 rounded-xl border transition ${
                      isReassignDisabled
                        ? 'bg-slate-100/70 border-slate-200 text-slate-400 select-none'
                        : 'bg-slate-50 border-slate-200/90'
                    }`}>
                      <div className="flex items-center gap-2">
                        <UserCheck className={`w-4 h-4 ${isReassignDisabled ? 'text-slate-400' : 'text-blue-600'}`} />
                        <div className="text-left">
                          <div className={`text-[11px] font-bold flex items-center gap-1.5 ${isReassignDisabled ? 'text-slate-500' : 'text-slate-800'}`}>
                            <span>Reassign Closer</span>
                            <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${
                              isReassignDisabled
                                ? 'bg-slate-200/60 text-slate-500 border-slate-300/80'
                                : 'bg-purple-50 text-purple-700 border-purple-200'
                            }`}>
                              Admin
                            </span>
                            <span className="text-[10px] text-slate-400 font-normal">(Optional)</span>
                          </div>
                          <div className="text-[10px] text-slate-500">
                            Current: <strong className={isReassignDisabled ? 'text-slate-600' : 'text-slate-700'}>
                              {selectedRequest ? (selectedRequest.executor || 'Not Assigned') : 'No Request Selected'}
                            </strong> ({selectedRequest?.department || 'N/A'})
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={isReassignDisabled}
                        onClick={() => {
                          if (isReassignDisabled) return;
                          setIsReassignOpen(true);
                          setIsReassignUserDropdownOpen(false);
                          setReassignUserSearch('');
                          setReassignedDept(selectedRequest?.department || '');
                          setReassignedPerson(selectedRequest?.executor || '');
                          setCloserStatus('OPEN');
                        }}
                        title={
                          !selectedRequest
                            ? 'Select a request first to reassign closer'
                            : isSelectedClosed
                            ? 'Request closed — executor cannot be reassigned'
                            : isCloserDataToBeUpdated
                            ? 'Disabled while closer submission is pending'
                            : adminEditCloser
                            ? 'Disabled while editing closer fields'
                            : 'Reassign Closer'
                        }
                        className={`px-2.5 py-1.5 rounded-lg font-bold text-xs border shadow-2xs transition flex items-center gap-1.5 shrink-0 ${
                          isReassignDisabled
                            ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed select-none'
                            : 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200 cursor-pointer'
                        }`}
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>Reassign</span>
                      </button>
                    </div>
                  ) : (
                    <div className="p-3 bg-gradient-to-r from-blue-50/70 via-indigo-50/50 to-slate-50 rounded-xl border border-blue-200/90 space-y-2.5 animate-in fade-in">
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
                            setReassignedDept(selectedRequest?.department || '');
                            setReassignedPerson(selectedRequest?.executor || '');
                            setCloserStatus('');
                            setStatusError(false);
                          }}
                          className="text-[11px] text-slate-500 hover:text-rose-600 font-semibold cursor-pointer underline flex items-center gap-1"
                        >
                          Cancel
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {/* Department */}
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                            Department *
                          </label>
                          <select
                            value={reassignedDept}
                            onChange={(e) => handleDeptChange(e.target.value)}
                            className={`w-full px-2.5 py-2 bg-white border rounded-xl font-semibold text-slate-800 text-xs outline-none cursor-pointer ${
                              reassignDeptError
                                ? 'border-rose-400 focus:ring-2 focus:ring-rose-400/20 focus:border-rose-500 bg-rose-50/20'
                                : 'border-slate-300 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500'
                            }`}
                          >
                            <option value="">Select Department</option>
                            {departmentList.map((dept) => (
                              <option key={dept} value={dept}>
                                {dept}
                              </option>
                            ))}
                          </select>
                          {reassignDeptError && (
                            <p className="text-[10px] text-rose-500 font-semibold mt-1">
                              * Department is required for reassignment.
                            </p>
                          )}
                        </div>

                        {/* Department-based User Name (Multi-Select) */}
                        <div className="relative" ref={reassignUserDropdownRef}>
                          <div className="flex items-center justify-between mb-1">
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600">
                              Executor Name *
                            </label>
                            {reassignedDept && getDepartmentUsers(reassignedDept).length > 0 && getSelectedReassignedUsers().length > 0 && (
                              <div className="flex items-center gap-2 text-[10px]">
                                <button
                                  type="button"
                                  onClick={handleClearAllReassignUsers}
                                  className="text-rose-600 hover:text-rose-700 font-semibold hover:underline cursor-pointer"
                                >
                                  Clear
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Trigger Box */}
                          <div
                            onClick={() => {
                              if (reassignedDept && getDepartmentUsers(reassignedDept).length > 0) {
                                setIsReassignUserDropdownOpen((prev) => !prev);
                              }
                            }}
                            className={`w-full min-h-[38px] px-2.5 py-1.5 border rounded-xl text-xs font-semibold transition flex items-center justify-between gap-1.5 ${
                              reassignPersonError
                                ? 'border-rose-400 bg-rose-50/20 ring-2 ring-rose-400/20 cursor-pointer'
                                : !reassignedDept
                                ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                                : getDepartmentUsers(reassignedDept).length === 0
                                ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                                : isReassignUserDropdownOpen
                                ? 'bg-white border-blue-500 ring-2 ring-blue-500/20 cursor-pointer shadow-xs'
                                : 'bg-white border-slate-300 hover:border-slate-400 text-slate-800 cursor-pointer'
                            }`}
                          >
                            <div className="flex-1 flex flex-wrap items-center gap-1 min-w-0">
                              {!reassignedDept ? (
                                <span className="text-slate-400 font-normal">Select Dept First</span>
                              ) : getDepartmentUsers(reassignedDept).length === 0 ? (
                                <span className="text-slate-400 font-normal">No users in this dept</span>
                              ) : getSelectedReassignedUsers().length === 0 ? (
                                <span className="text-slate-400 font-normal">Select Executor(s)...</span>
                              ) : (
                                getSelectedReassignedUsers().map((userName) => (
                                  <span
                                    key={userName}
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 text-[11px] font-semibold"
                                  >
                                    <span className="truncate max-w-[130px]">{userName}</span>
                                    <button
                                      type="button"
                                      onClick={(e) => handleRemoveReassignUser(userName, e)}
                                      className="p-0.5 hover:bg-blue-200/60 rounded text-blue-600 hover:text-blue-900 transition cursor-pointer"
                                      title={`Remove ${userName}`}
                                    >
                                      <X className="w-2.5 h-2.5" />
                                    </button>
                                  </span>
                                ))
                              )}
                            </div>

                            <div className="flex items-center gap-1 shrink-0 text-slate-400">
                              {getSelectedReassignedUsers().length > 0 && (
                                <span className="px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded-md text-[10px] font-bold">
                                  {getSelectedReassignedUsers().length}
                                </span>
                              )}
                              <ChevronDown
                                className={`w-3.5 h-3.5 transition-transform duration-200 ${
                                  isReassignUserDropdownOpen ? 'rotate-180 text-blue-600' : ''
                                }`}
                              />
                            </div>
                          </div>
                          {reassignPersonError && (
                            <p className="text-[10px] text-rose-500 font-semibold mt-1">
                              * Please select at least one responsible executor to reassign.
                            </p>
                          )}

                          {/* Dropdown Menu */}
                          {isReassignUserDropdownOpen && reassignedDept && getDepartmentUsers(reassignedDept).length > 0 && (
                            <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                              {getDepartmentUsers(reassignedDept).length > 2 && (
                                <div className="p-1.5 border-b border-slate-100 bg-slate-50/70">
                                  <div className="relative">
                                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
                                    <input
                                      type="text"
                                      value={reassignUserSearch}
                                      onChange={(e) => setReassignUserSearch(e.target.value)}
                                      placeholder="Search user..."
                                      className="w-full pl-6 pr-2 py-1 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                  </div>
                                </div>
                              )}

                              <div className="max-h-52 overflow-y-auto p-1 divide-y divide-slate-50">
                                {getDepartmentUsers(reassignedDept)
                                  .filter((u) => {
                                    const q = reassignUserSearch.toLowerCase();
                                    return (u.name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q);
                                  })
                                  .map((u) => {
                                    const isChecked = getSelectedReassignedUsers().includes(u.name);
                                    return (
                                      <div
                                        key={u.id || u.name}
                                        onClick={() => handleToggleReassignUser(u.name)}
                                        className={`flex items-center justify-between px-2.5 py-2 rounded-lg cursor-pointer transition select-none text-xs ${
                                          isChecked
                                            ? 'bg-blue-50/80 text-blue-900 font-semibold'
                                            : 'hover:bg-slate-50 text-slate-700'
                                        }`}
                                      >
                                        <div className="flex items-center gap-2 min-w-0 pr-2">
                                          <div
                                            className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition shrink-0 ${
                                              isChecked
                                                ? 'bg-blue-600 border-blue-600 text-white'
                                                : 'border-slate-300 bg-white'
                                            }`}
                                          >
                                            {isChecked && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                                          </div>
                                          <div className="min-w-0">
                                            <div className="truncate font-semibold">{u.name}</div>
                                            {u.email && (
                                              <div className="text-[10px] text-slate-400 truncate">
                                                {u.email}
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                        {isChecked && (
                                          <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider shrink-0">
                                            Selected
                                          </span>
                                        )}
                                      </div>
                                    );
                                  })}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      <p className="text-[10px] text-slate-500 leading-tight">
                        Selecting a new department and executor will transfer the root cause and countermeasure responsibility to them.
                      </p>
                    </div>
                  )}
                </div>

                {/* Remarks */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <span>REMARKS</span>
                      <span className="text-rose-500">*</span>
                      {selectedRequest && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 bg-purple-50 text-purple-700 rounded border border-purple-200">
                          Admin
                        </span>
                      )}
                    </label>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {1000 - closerRemarks.length} chars left
                    </span>
                  </div>
                  <textarea
                    rows={2}
                    maxLength={1000}
                    disabled={!selectedRequest || adminEditCloser || (isCloserDataToBeUpdated && !isReassignOpen)}
                    value={closerRemarks}
                    onChange={(e) => {
                      if (adminEditCloser || (isCloserDataToBeUpdated && !isReassignOpen)) return;
                      setCloserRemarks(e.target.value);
                      if (remarksError && e.target.value.trim()) {
                        setRemarksError(false);
                      }
                    }}
                    placeholder={
                      !selectedRequest
                        ? 'Click a row on the right to select'
                        : adminEditCloser
                        ? 'Disabled while editing closer fields...'
                        : isCloserDataToBeUpdated && !isReassignOpen
                        ? 'Awaiting closer Action & Target Date...'
                        : 'Enter remarks and validation summary...'
                    }
                    className={`w-full px-3.5 py-2 border rounded-xl text-slate-800 outline-none transition resize-none ${
                      adminEditCloser || (isCloserDataToBeUpdated && !isReassignOpen)
                        ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed select-none'
                        : remarksError
                        ? 'border-rose-400 focus:ring-2 focus:ring-rose-400/20 focus:border-rose-500 bg-rose-50/20'
                        : 'border-slate-200 bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500'
                    }`}
                  />
                  {adminEditCloser ? (
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Disabled while editing closer fields.
                    </p>
                  ) : isCloserDataToBeUpdated && !isReassignOpen ? (
                    <p className="text-[10px] text-amber-700 mt-0.5 font-medium">
                      Closer Action &amp; Target Date required first.
                    </p>
                  ) : remarksError ? (
                    <p className="text-[11px] text-rose-500 font-semibold mt-0.5 flex items-center gap-1">
                      <span>* Remarks is required to save Admin Review and Status Sign-Off.</span>
                    </p>
                  ) : (
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Provide admin sign-off or review remarks.
                    </p>
                  )}
                </div>

                {/* Status */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <span>STATUS</span>
                      <span className="text-rose-500">*</span>
                      {selectedRequest && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 bg-purple-50 text-purple-700 rounded border border-purple-200">
                          Admin
                        </span>
                      )}
                      {isSelectedClosed && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded border border-emerald-200">
                          Closed
                        </span>
                      )}
                    </label>
                  </div>
                  <select
                    value={isReassignOpen ? 'OPEN' : closerStatus}
                    onChange={(e) => {
                      if (adminEditCloser || isReassignOpen || isCloserDataToBeUpdated) return;
                      setCloserStatus(e.target.value);
                      if (e.target.value) setStatusError(false);
                    }}
                    disabled={adminEditCloser || !selectedRequest || isReassignOpen || isCloserDataToBeUpdated}
                    className={`w-full px-3.5 py-2.5 border rounded-xl font-bold outline-none transition ${
                      adminEditCloser || isCloserDataToBeUpdated
                        ? 'cursor-not-allowed bg-slate-100 border-slate-200 text-slate-400 select-none'
                        : isReassignOpen
                        ? 'cursor-not-allowed bg-slate-50 border-slate-200 text-slate-700'
                        : statusError
                        ? 'border-rose-400 bg-rose-50/20 ring-2 ring-rose-400/20 text-rose-700'
                        : closerStatus === 'CLOSED'
                        ? 'bg-white border-slate-200 text-emerald-700 cursor-pointer focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500'
                        : 'bg-white border-slate-200 text-slate-600 cursor-pointer focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500'
                    }`}
                  >
                    {isReassignOpen ? (
                      <option value="OPEN">PENDING (Awaiting Closer)</option>
                    ) : (
                      <>
                        <option value="">Select Status...</option>
                        <option value="CLOSED">CLOSED</option>
                        <option value="OPEN">OPEN</option>
                      </>
                    )}
                  </select>
                  {statusError ? (
                    <p className="text-[10px] text-rose-500 font-semibold mt-0.5">
                      * Please select status to finalize admin sign-off.
                    </p>
                  ) : (
                    <p className="text-[10px] mt-0.5">
                      {adminEditCloser ? (
                        <span className="text-slate-400">
                          Disabled while editing closer fields.
                        </span>
                      ) : isCloserDataToBeUpdated ? (
                        <span className="text-amber-700 font-medium">
                          Status unlocks after closer submission.
                        </span>
                      ) : isReassignOpen ? (
                        <span className="text-amber-700 font-medium">
                          Status locked to PENDING for new assignee.
                        </span>
                      ) : closerStatus === 'CLOSED' ? (
                        <span className="text-emerald-600 font-semibold">
                          Status will be finalized to CLOSED.
                        </span>
                      ) : (
                        <span className="text-slate-400">
                          Select CLOSED to finalize admin sign-off.
                        </span>
                      )}
                    </p>
                  )}
                </div>

                {/* Dedicated Admin Actions Submit Button */}
                <div className="pt-1">
                  {!selectedRequest ? (
                    <button
                      type="button"
                      disabled
                      className="w-full py-2.5 px-4 rounded-xl border border-indigo-200/80 bg-indigo-50/50 text-indigo-400 font-bold text-xs cursor-not-allowed select-none text-center shadow-2xs"
                    >
                      Select a Request to Review
                    </button>
                  ) : adminEditCloser ? (
                    <button
                      type="button"
                      disabled
                      className="w-full py-2.5 px-4 rounded-xl border border-slate-200 bg-slate-100 text-slate-400 font-bold text-xs cursor-not-allowed select-none text-center shadow-2xs flex items-center justify-center gap-2"
                      title="Admin Sign-Off disabled while editing closer fields"
                    >
                      <Lock className="w-4 h-4 text-slate-400" />
                      <span>Sign-Off Locked (Closer Edit Active)</span>
                    </button>
                  ) : isCloserDataToBeUpdated && !isReassignOpen ? (
                    <button
                      type="button"
                      disabled
                      className="w-full py-2.5 px-4 rounded-xl border border-amber-200 bg-amber-50 text-amber-700 font-bold text-xs cursor-not-allowed select-none text-center shadow-2xs flex items-center justify-center gap-2"
                      title="Action & Target Date required before Admin Sign-Off"
                    >
                      <Lock className="w-4 h-4 text-amber-600" />
                      <span>Sign-Off Locked (Closer Pending)</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSaveAdmin}
                      disabled={isSavingAdmin || isSavingCloser}
                      className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-xs shadow-md hover:shadow-lg transition transform active:scale-98 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSavingAdmin ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Saving Admin Sign-Off...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Save Admin Review &amp; Status Sign-Off</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            )}

          </form>
        </div>

        {/* ============================================================== */}
        {/* RIGHT COLUMN: Filter Bar & Table                              */}
        {/* ============================================================== */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-4">

          {/* Top Filter and Search Bar */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
              <input
                type="text"
                placeholder="Search by req no, problem, or remarks..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none font-medium transition"
              />
            </div>

            <div className="w-full sm:w-48">
              <select
                value={selectedStatus}
                onChange={(e) => {
                  setSelectedStatus(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-semibold focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none cursor-pointer"
              >
                <option value="All">All Decisions</option>
                <option value="Pending">Pending</option>
                <option value="Approval Pending">Approval Pending</option>
                <option value="Signed off">Signed off</option>
                <option value="Closed">Closed</option>
                <option value="Open">Open</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>

            <button
              onClick={() => setShowExportModal(true)}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs hover:shadow transition transform active:scale-95 cursor-pointer shrink-0"
              id="approvals-export-view-btn"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export View</span>
            </button>
          </div>

          {/* Table Container */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  {/* Top Phase Header Row matching IHLR */}
                  <tr className="text-[10px] font-black uppercase tracking-wider text-center border-b border-slate-200">
                    <th colSpan={4} className="py-2 px-3 bg-amber-100 text-amber-900 border-r border-amber-200">
                      AUDIT REQUEST (Observation &amp; Parameters)
                    </th>
                    <th colSpan={1} className="py-2 px-3 bg-orange-100 text-orange-900 border-r border-orange-200">
                      CLOSER (Root Cause &amp; Action)
                    </th>
                    <th colSpan={3} className="py-2 px-3 bg-slate-100 text-slate-700">
                      REMARKS &amp; STATUS
                    </th>
                  </tr>
                  <tr className="bg-[#f8fafc] border-b border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-500">
                    <th className="py-3 px-3 text-center w-12">SL NO</th>
                    <th className="py-3 px-3">AUDIT REQ NO</th>
                    <th className="py-3 px-3">REQUESTED DATE</th>
                    <th className="py-3 px-4">PROBLEM &amp; MODEL</th>
                    <th className="py-3 px-3">EVIDENCE</th>
                    <th className="py-3 px-3 text-center">STATUS</th>
                    <th className="py-3 px-3">REMARKS</th>
                    <th className="py-3 px-3 text-center w-14">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                        <span>Loading approval queue...</span>
                      </td>
                    </tr>
                  ) : paginatedRequests.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        <ClipboardCheck className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                        <p className="font-semibold text-slate-600">No requests found matching criteria</p>
                      </td>
                    </tr>
                  ) : (
                    paginatedRequests.map((r, idx) => {
                      const isSelected =
                        selectedRequest &&
                        (selectedRequest.id === r.id || selectedRequest.issue_no === r.issue_no);
                      const displayId = r.issue_no || (r.id ? `PA-${r.id}` : `#${r.id}`);
                      const problemText = r.issue_observation || r.problem || '—';
                      const modelText = `${r.model || r.stage || ''} • ${r.process_operation || r.line || ''}`.trim().replace(/^•\s*|\s*•$/g, '');
                      const statusLower = (r.status || 'Pending').toLowerCase();
                      const isClosed = statusLower.includes('close');
                      const isOpen = statusLower === 'open' || statusLower.includes('reopen');
                      const isRejected = statusLower.includes('reject');
                      const isSignedOff = (statusLower.includes('approved') || statusLower.includes('signed')) && !isClosed;
                      const isPending = !isSignedOff && !isClosed && !isOpen && !isRejected;

                      const remarksText = r.creator_remark || r.corrective_action || r.comments || r.remarks || r.rejection_reason || '—';
                      const attachmentsRaw = r.action_attachments || r.attachments || r.evidence_attachment;

                      return (
                        <tr
                          key={r.id || idx}
                          onClick={() => populateForm(r)}
                          className={`transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-blue-50/80 border-l-4 border-l-blue-600 font-medium'
                              : 'hover:bg-slate-50/80'
                          }`}
                        >
                          <td className="py-3.5 px-3 text-center font-mono text-[11px] text-slate-500">
                            {startIndex + idx + 1}
                          </td>
                          <td className="py-3.5 px-3 font-mono font-bold text-blue-600 whitespace-nowrap">
                            {displayId}
                          </td>
                          <td className="py-3.5 px-3 whitespace-nowrap text-slate-600 font-mono text-[11px]">
                            {r.escalation_date || r.created_at
                              ? formatDateDDMMYYYY(r.escalation_date || r.created_at)
                              : '—'}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-slate-900 truncate max-w-[180px]" title={problemText}>
                              {problemText}
                            </div>
                            <div className="text-[11px] text-slate-500 truncate max-w-[180px]" title={modelText}>
                              {modelText}
                            </div>
                          </td>
                          <td className="py-3.5 px-3">
                            <AttachmentThumbnail
                              rawAttachment={attachmentsRaw}
                              onClick={(e) => {
                                e?.stopPropagation?.();
                                const parsed = parseAttachments(attachmentsRaw);
                                if (parsed.length > 0) setSelectedPreviewAttachment(parsed[0]);
                              }}
                            />
                          </td>
                          <td className="py-3.5 px-3 text-center whitespace-nowrap">
                            {isClosed ? (
                              <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                CLOSED
                              </span>
                            ) : isRejected ? (
                              <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                REJECTED
                              </span>
                            ) : isOpen ? (
                              <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200">
                                OPEN
                              </span>
                            ) : isCloserCompleted(r) ? (
                              <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                APPROVAL PENDING
                              </span>
                            ) : (
                              <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                PENDING
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-3 text-slate-600 truncate max-w-[150px]" title={remarksText}>
                            {remarksText}
                          </td>
                          <td className="py-3.5 px-3 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => {
                                setActiveModalRequest(r);
                                setModalTab('requester');
                              }}
                              className="p-1 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition cursor-pointer"
                              title="View Full Report"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
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
        </div>

      </div>

      {/* Comprehensive Report & Admin Edit Modal */}
      <ProcessAuditRequestDetailsModal
        isOpen={Boolean(activeModalRequest)}
        request={activeModalRequest}
        onClose={() => setActiveModalRequest(null)}
        onUpdated={() => {
          loadRequests();
        }}
      />

      {/* Universal Attachment Preview Modal */}
      <AttachmentPreviewModal
        isOpen={Boolean(selectedPreviewAttachment)}
        attachment={selectedPreviewAttachment}
        onClose={() => setSelectedPreviewAttachment(null)}
        onAnnotate={!isSelectedApproved ? (att) => setAnnotatingItem({ attachment: att }) : undefined}
      />

      {/* Technical Drawing & Defect Image Annotation Modal (Circle, Arrow, Line, Sketches) */}
      <ImageAnnotationModal
        isOpen={Boolean(annotatingItem)}
        imageAttachment={annotatingItem?.attachment}
        onClose={() => setAnnotatingItem(null)}
        onSave={handleSaveAnnotation}
      />

      {/* Universal Export Format Selection Modal */}
      <ExportSelectionModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        onExportExcel={handleExportExcel}
        onExportPdf={handleExportPdf}
        title="Export Audit Approval Queue"
        subtitle="Choose download format for process audit approvals view"
        recordCount={filtered.length}
        excelDescription="Full structured workbook with separate columns for observation details, root causes, corrective actions, and target dates."
        pdfDescription="Official landscape document formatted with India Nippon Electricals Limited branding, tables, and page numbers."
      />
    </div>
  );
};

export default ProcessAuditApprovals;
