import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams, useLocation } from 'react-router-dom';
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
  ShieldCheck,
  Pencil,
  Lock,
  UserCheck,
  ChevronDown,
  ArrowRightLeft
} from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { processAuditService } from '../../services/processAuditService';
import { formatReassignmentHistory } from './processAuditExportUtils';
import { useAuth } from '../../hooks/useAuth';
import ExportSelectionModal from '../../components/common/ExportSelectionModal';
import AttachmentChipList from '../../components/common/AttachmentChipList';
import AttachmentThumbnail from '../../components/common/AttachmentThumbnail';
import AttachmentPreviewModal from '../../components/common/AttachmentPreviewModal';
import ImageAnnotationModal from '../../components/common/ImageAnnotationModal';
import DateInput from '../../components/common/DateInput';
import { resolveAttachmentUrl, triggerDirectDownload } from '../../components/common/attachmentUtils';
import { formatDateDDMMYYYY, parseDateToYYYYMMDD } from '../../utils/dateUtils';
import { storage } from '../../utils/storage';
import ProcessAuditRequestDetailsModal from './ProcessAuditRequestDetailsModal';
import { useModal } from '../../context/ModalContext';

const ProcessAuditApprovals = () => {
  const { user } = useAuth();
  const { success: modalSuccess, error: modalError, warning: modalWarning } = useModal();
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

  const isQad = userDept === 'QAD';
  const isAdmin = userRole === 'ADMIN' || isQad;

  const location = useLocation();
  const [searchParams] = useSearchParams();
  const queryRequestId = searchParams.get('requestId') || searchParams.get('id');

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(() => location.state?.search || '');

  useEffect(() => {
    if (location.state?.search) {
      setSearch(location.state.search);
    }
  }, [location.state]);
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
  const [reviewedBy, setReviewedBy] = useState('');
  const [reviewedByError, setReviewedByError] = useState(false);
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
  const fileInputPermanentRef = useRef(null);

  // 5-Why Occurrence Cause State & Permanent Action States (matching IHLR)
  const [closerWhyWhy, setCloserWhyWhy] = useState(['', '', '', '', '']);
  const [closerWhyErrors, setCloserWhyErrors] = useState({ w1: false, w2: false, w3: false });
  const [closerPermanentFix, setCloserPermanentFix] = useState('');
  const [closerPermanentFixError, setCloserPermanentFixError] = useState(false);
  const [existingPermanentEvidence, setExistingPermanentEvidence] = useState([]);
  const [newPermanentEvidenceFiles, setNewPermanentEvidenceFiles] = useState([]);
  const [closerPermanentEvidenceError, setCloserPermanentEvidenceError] = useState(false);
  const [closerPermanentTargetDate, setCloserPermanentTargetDate] = useState('');
  const [closerPermanentTargetDateError, setCloserPermanentTargetDateError] = useState(false);
  const [closerTemporaryClosedBy, setCloserTemporaryClosedBy] = useState('');
  const [closerTemporaryClosedByError, setCloserTemporaryClosedByError] = useState(false);
  const [closerPermanentClosedBy, setCloserPermanentClosedBy] = useState('');
  const [closerPermanentClosedByError, setCloserPermanentClosedByError] = useState(false);
  const todayStr = (() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  })();

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

  const matchesExecutorUser = (execStr, uName, uEmail, uUsername, uId) => {
    if (!execStr) return false;
    const e = String(execStr).trim().toLowerCase();
    const name = String(uName || '').trim().toLowerCase();
    const email = String(uEmail || '').trim().toLowerCase();
    const username = String(uUsername || '').trim().toLowerCase();

    if (name && (e === name || e.includes(name) || name.includes(e))) return true;
    if (email && (e === email || e.includes(email))) return true;
    if (username && (e === username || e.includes(username) || username.includes(e))) return true;

    // Check individual tokens if comma-separated or space-separated
    const execTokens = e.split(/[,;\/\s]+/).filter(Boolean);
    if (name && execTokens.includes(name)) return true;
    if (username && execTokens.includes(username)) return true;

    const nameTokens = name.split(/\s+/).filter(Boolean);
    if (nameTokens.length > 0 && nameTokens.some((t) => t.length > 2 && execTokens.includes(t))) return true;

    return false;
  };

  // Operational permissions:
  // 1. Closer Fields (Root Cause, Action, Standardization, Evidence, Target Date):
  //    - Assigned Executor can edit and submit closer log whenever status is Pending / Open (including upon reassignment).
  //    - Quality Admin can click "Edit Closer Fields" to unlock, edit, and update closer fields anytime.
  const isSelectedClosed = Boolean(
    selectedRequest && String(selectedRequest.status || '').toUpperCase().includes('CLOSE')
  );

  const isSelectedPending = Boolean(
    selectedRequest && (
      !selectedRequest.status ||
      String(selectedRequest.status).toUpperCase().includes('PENDING') ||
      String(selectedRequest.status).toUpperCase().includes('OPEN')
    )
  );

  const isCloserCompleted = (r) => {
    if (!r) return false;
    const s = String(r.status || '').toLowerCase();
    if (s.includes('pending') || s.includes('open') || s.includes('reject')) return false;
    if (s.includes('approval') || s.includes('progress') || s.includes('signed') || s.includes('review')) return true;
    return Boolean(
      (r.temporary_action && String(r.temporary_action).trim()) ||
      (r.permanent_fix && String(r.permanent_fix).trim()) ||
      (r.corrective_action && String(r.corrective_action).trim()) ||
      (r.action && String(r.action).trim()) ||
      (r.root_cause && String(r.root_cause).trim()) ||
      (r.prod_why_why && (Array.isArray(r.prod_why_why) ? r.prod_why_why.some((w) => w && w.trim()) : Boolean(r.prod_why_why))) ||
      (r.standardization_details && String(r.standardization_details).trim()) ||
      Boolean(r.temporary_target_date || r.permanent_target_date || r.target_date) ||
      Boolean(r.temporary_closed_by || r.permanent_closed_by) ||
      Boolean(r.action_taken_by) ||
      (r.temporary_evidence_attachment && parseAttachments(r.temporary_evidence_attachment).length > 0) ||
      (r.permanent_evidence_attachment && parseAttachments(r.permanent_evidence_attachment).length > 0) ||
      (r.action_attachments && parseAttachments(r.action_attachments).length > 0)
    );
  };

  const isCloser = Boolean(
    selectedRequest && matchesExecutorUser(
      selectedRequest.executor,
      currentUser?.name,
      currentUser?.email,
      currentUser?.username,
      currentUser?.id
    )
  );

  // When a request is Pending/Reassigned, the closer has NOT completed this pending cycle yet,
  // so closer inputs are open to be updated and submitted.
  const hasCloserSubmitted = Boolean(
    selectedRequest &&
    !isSelectedPending &&
    !isSelectedClosed &&
    (
      String(selectedRequest.status || '').toUpperCase().includes('REVIEW') ||
      String(selectedRequest.status || '').toUpperCase().includes('APPROVAL') ||
      String(selectedRequest.status || '').toUpperCase().includes('PROGRESS') ||
      String(selectedRequest.status || '').toUpperCase().includes('SIGNED')
    )
  );

  const isCloserDataToBeUpdated = Boolean(
    selectedRequest && (isSelectedPending || !hasCloserSubmitted)
  );

  const canUpdateCloserFields = Boolean(
    selectedRequest && !isSelectedClosed && (
      (isAdmin && adminEditCloser) ||
      (isCloser && (isSelectedPending || !hasCloserSubmitted)) ||
      (!isAdmin && isCloser && !hasCloserSubmitted)
    )
  );

  const canUpdateAdminFields = Boolean(
    selectedRequest && isAdmin && !isSelectedClosed
  );

  const isLockedForCloserUser = isSelectedClosed || (!isAdmin && hasCloserSubmitted);

  // Reassign Closer is disabled when no request is selected, or when request is closed or editing closer fields
  const isReassignDisabled = Boolean(
    !selectedRequest || isSelectedClosed || adminEditCloser
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
    'QAD',
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

  const getLoggedInUserName = () => {
    return (
      currentUser?.name ||
      (() => {
        try {
          const u = sessionStorage.getItem('todo_user') || localStorage.getItem('todo_user');
          return u ? JSON.parse(u)?.name : '';
        } catch {
          return '';
        }
      })() ||
      currentUser?.email ||
      'Quality Admin'
    );
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

      // Deep linking, notification highlight, or re-selecting active request
      const targetReqNo = location.state?.highlightReq || location.state?.search || queryRequestId;
      let matchedTarget = null;
      if (targetReqNo) {
        const cleanTarget = String(targetReqNo).trim().toLowerCase().replace(/^#/, '');
        matchedTarget = list.find((r) => {
          const cleanReq = String(r.issue_no || '').trim().toLowerCase().replace(/^#/, '');
          return cleanReq === cleanTarget || cleanReq === `pa-${cleanTarget}` || String(r.id) === cleanTarget;
        });
      }

      if (matchedTarget) {
        populateForm(matchedTarget);
      } else if (selectedRequest) {
        const fresh = list.find((r) => r.id === selectedRequest.id || r.issue_no === selectedRequest.issue_no);
        if (fresh) populateForm(fresh);
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

  const handleWhyChange = (index, val) => {
    setCloserWhyWhy((prev) => {
      const updated = [...prev];
      updated[index] = val;
      return updated;
    });
    if (val && val.trim()) {
      if (index === 0) setCloserWhyErrors((prev) => ({ ...prev, w1: false }));
      if (index === 1) setCloserWhyErrors((prev) => ({ ...prev, w2: false }));
      if (index === 2) setCloserWhyErrors((prev) => ({ ...prev, w3: false }));
    }
  };

  // Populate form fields when a row is clicked
  const populateForm = (req, keepEditMode = false) => {
    if (!req) {
      setSelectedRequest(null);
      setAdminEditCloser(false);
      setSuccessMessage('');
      setErrorMessage('');
      setRootCauseError(false);
      setCloserActionError(false);
      setEvidenceError(false);
      setCloserTargetDateError(false);
      setCloserTemporaryClosedByError(false);
      setCloserPermanentFixError(false);
      setCloserPermanentEvidenceError(false);
      setCloserPermanentTargetDateError(false);
      setCloserPermanentClosedByError(false);
      setRemarksError(false);
      setStatusError(false);
      setCloserWhyWhy(['', '', '', '', '']);
      setCloserWhyErrors({ w1: false, w2: false, w3: false });
      setRootCause('');
      setCloserAction('');
      setStandardizationDetails('');
      setCloserTargetDate('');
      setCloserPermanentFix('');
      setCloserPermanentTargetDate('');
      setCloserTemporaryClosedBy('');
      setCloserPermanentClosedBy('');
      setCloserRemarks('');
      setRemarksError(false);
      setReviewedBy('');
      setReviewedByError(false);
      setCloserStatus('');
      setReassignedDept('');
      setReassignedPerson('');
      setIsReassignOpen(false);
      setIsReassignUserDropdownOpen(false);
      setReassignUserSearch('');
      setExistingEvidence([]);
      setNewEvidenceFiles([]);
      setExistingPermanentEvidence([]);
      setNewPermanentEvidenceFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (fileInputPermanentRef.current) fileInputPermanentRef.current.value = '';
      return;
    }
    setSelectedRequest(req);
    if (!keepEditMode || String(req?.status || '').toUpperCase().includes('CLOSE')) {
      setAdminEditCloser(false);
    }
    setSuccessMessage('');
    setErrorMessage('');
    setRootCauseError(false);
    setCloserActionError(false);
    setEvidenceError(false);
    setCloserTargetDateError(false);
    setCloserTemporaryClosedByError(false);
    setCloserPermanentFixError(false);
    setCloserPermanentEvidenceError(false);
    setCloserPermanentTargetDateError(false);
    setCloserPermanentClosedByError(false);
    setRemarksError(false);
    setStatusError(false);

    // 5-Why Occurrence Cause
    let whyArray = [];
    if (Array.isArray(req.prod_why_why)) {
      whyArray = req.prod_why_why;
    } else if (typeof req.prod_why_why === 'string') {
      try {
        whyArray = JSON.parse(req.prod_why_why);
      } catch {
        whyArray = req.prod_why_why ? [req.prod_why_why] : [];
      }
    } else if (req.root_cause) {
      whyArray = [req.root_cause];
    }
    const paddedWhys = [
      whyArray[0] || '',
      whyArray[1] || '',
      whyArray[2] || '',
      whyArray[3] || '',
      whyArray[4] || ''
    ];
    setCloserWhyWhy(paddedWhys);
    setCloserWhyErrors({ w1: false, w2: false, w3: false });

    setRootCause(req.root_cause || '');
    setCloserAction(req.temporary_action || req.corrective_action || req.action || '');
    setCloserActionError(false);
    setStandardizationDetails(req.standardization_details || '');
    setCloserTargetDate(parseDateToYYYYMMDD(req.temporary_target_date || req.target_date));
    setCloserTargetDateError(false);

    setCloserPermanentFix(req.permanent_fix || req.standardization_details || '');
    setCloserPermanentFixError(false);
    setCloserPermanentTargetDate(parseDateToYYYYMMDD(req.permanent_target_date));
    setCloserPermanentTargetDateError(false);
    const existingCloser = req.closer_updated_by || req.temporary_closed_by || req.action_taken_by;
    setCloserTemporaryClosedBy(
      existingCloser && !existingCloser.toUpperCase().includes('CLOSED BY')
        ? existingCloser
        : (currentUser?.name || '')
    );
    setCloserPermanentClosedBy(req.permanent_closed_by || req.closed_by || currentUser?.name || '');

    setCloserRemarks(req.creator_remark || '');
    setRemarksError(false);
    const isClosedReq = String(req.status || '').toUpperCase() === 'CLOSED';
    setReviewedBy(isClosedReq ? (req.reviewed_by || '') : '');
    setReviewedByError(false);
    setCloserStatus('');
    setReassignedDept(req.department || '');
    setReassignedPerson(req.executor || '');
    setIsReassignOpen(false);
    setIsReassignUserDropdownOpen(false);
    setReassignUserSearch('');

    // Temporary Evidence attachments
    const existing = req.temporary_evidence_attachment
      ? parseAttachments(req.temporary_evidence_attachment)
      : (req.action_attachments ? parseAttachments(req.action_attachments) : []);
    setExistingEvidence(existing);
    setNewEvidenceFiles([]);
    setEvidenceError(false);

    // Permanent Evidence attachments
    const existingPerm = req.permanent_evidence_attachment
      ? parseAttachments(req.permanent_evidence_attachment)
      : [];
    setExistingPermanentEvidence(existingPerm);
    setNewPermanentEvidenceFiles([]);
    setCloserPermanentEvidenceError(false);
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

  const handlePermanentFileSelect = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const added = Array.from(e.target.files);
      setNewPermanentEvidenceFiles((prev) => [...prev, ...added]);
      setCloserPermanentEvidenceError(false);
    }
  };

  const handleRemoveExistingPermanentEvidence = (index) => {
    setExistingPermanentEvidence((prev) => prev.filter((_, i) => i !== index));
  };

  const handleRemoveNewPermanentEvidence = (index) => {
    setNewPermanentEvidenceFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveAnnotation = (annotatedFile) => {
    if (!annotatingItem) return;
    const { index, isExisting, isPermanent } = annotatingItem;

    if (isPermanent) {
      if (!isExisting && typeof index === 'number' && index >= 0) {
        // Replace newly added permanent evidence file in place (no duplicate)
        setNewPermanentEvidenceFiles((prev) =>
          prev.map((f, i) => (i === index ? annotatedFile : f))
        );
      } else if (isExisting && typeof index === 'number' && index >= 0) {
        // Replace existing permanent evidence: remove old from existing and add annotated to new
        setExistingPermanentEvidence((prev) => prev.filter((_, i) => i !== index));
        setNewPermanentEvidenceFiles((prev) => [...prev, annotatedFile]);
      } else {
        // Fallback: replace by name or append
        setNewPermanentEvidenceFiles((prev) => {
          const targetName = annotatingItem.attachment?.name;
          const matchIdx = prev.findIndex((f) => f.name === targetName);
          if (matchIdx !== -1) {
            return prev.map((f, i) => (i === matchIdx ? annotatedFile : f));
          }
          return [...prev, annotatedFile];
        });
      }
      setCloserPermanentEvidenceError(false);
    } else {
      if (!isExisting && typeof index === 'number' && index >= 0) {
        // Replace newly added evidence file in place (no duplicate)
        setNewEvidenceFiles((prev) =>
          prev.map((f, i) => (i === index ? annotatedFile : f))
        );
      } else if (isExisting && typeof index === 'number' && index >= 0) {
        // Replace existing evidence: remove old from existing and add annotated to new
        setExistingEvidence((prev) => prev.filter((_, i) => i !== index));
        setNewEvidenceFiles((prev) => [...prev, annotatedFile]);
      } else {
        // Fallback: replace by name or append
        setNewEvidenceFiles((prev) => {
          const targetName = annotatingItem.attachment?.name;
          const matchIdx = prev.findIndex((f) => f.name === targetName);
          if (matchIdx !== -1) {
            return prev.map((f, i) => (i === matchIdx ? annotatedFile : f));
          }
          return [...prev, annotatedFile];
        });
      }
      setEvidenceError(false);
    }
    setAnnotatingItem(null);
  };

  // 1. Submit Closer Updates (5-Why causes, Temporary Action & Evidence, Permanent Action & Evidence)
  const handleSaveCloser = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!selectedRequest) return;

    if (isSelectedClosed) {
      const msg = 'This request is closed and cannot be edited.';
      setErrorMessage(msg);
      modalWarning(msg);
      return;
    }

    if (isLockedForCloserUser) {
      const msg = 'Closer details have already been submitted once for this request. Only Quality Admin has permission to make multiple updates.';
      setErrorMessage(msg);
      modalWarning(msg);
      return;
    }

    if (!canUpdateCloserFields && !isAdmin) {
      const msg = 'You do not have permission to update fields on this request.';
      setErrorMessage(msg);
      modalError(msg);
      return;
    }

    // Mandatory Closer Field Validations (matching IHLR):
    // 5-Why Occurrence Causes W1, W2, and W3 are mandatory for both Admin and User
    let hasCloserErrors = false;
    const whyErrors = {
      w1: !closerWhyWhy[0] || !closerWhyWhy[0].trim(),
      w2: !closerWhyWhy[1] || !closerWhyWhy[1].trim(),
      w3: !closerWhyWhy[2] || !closerWhyWhy[2].trim(),
    };
    setCloserWhyErrors(whyErrors);

    if (whyErrors.w1 || whyErrors.w2 || whyErrors.w3) {
      hasCloserErrors = true;
    }

    // 1. Temporary Action is mandatory
    if (!closerAction || !closerAction.trim()) {
      setCloserActionError('Temporary Action is required. Please describe containment actions taken.');
      hasCloserErrors = true;
    } else {
      setCloserActionError(false);
    }

    // 2. Temporary Evidence Attachment is mandatory
    const hasTempEvidence = (existingEvidence && existingEvidence.length > 0) || (newEvidenceFiles && newEvidenceFiles.length > 0);
    if (!hasTempEvidence) {
      setEvidenceError('Temporary Evidence Attachment is required. Please attach at least one file.');
      hasCloserErrors = true;
    } else {
      setEvidenceError(false);
    }

    // 3. Temporary Target Date is mandatory (must be present or future: today or later)
    if (!closerTargetDate || !closerTargetDate.trim()) {
      setCloserTargetDateError('Temporary Target Date is required.');
      hasCloserErrors = true;
    } else if (closerTargetDate < todayStr) {
      setCloserTargetDateError('Temporary Target Date must be today or a future date.');
      hasCloserErrors = true;
    } else {
      setCloserTargetDateError(false);
    }

    // 4. Action Taken By is mandatory (text-only)
    if (!closerTemporaryClosedBy || !closerTemporaryClosedBy.trim()) {
      setCloserTemporaryClosedByError('Action Taken By is required. Please enter person name.');
      hasCloserErrors = true;
    } else if (/\d/.test(closerTemporaryClosedBy)) {
      setCloserTemporaryClosedByError('Action Taken By must contain text only, numbers are not allowed');
      hasCloserErrors = true;
    } else {
      setCloserTemporaryClosedByError(false);
    }

    // 5. Permanent Action is mandatory
    if (!closerPermanentFix || !closerPermanentFix.trim()) {
      setCloserPermanentFixError('Permanent Action is required. Please describe permanent countermeasure.');
      hasCloserErrors = true;
    } else {
      setCloserPermanentFixError(false);
    }

    // 6. Permanent Evidence Attachment is mandatory
    const hasPermEvidence = (existingPermanentEvidence && existingPermanentEvidence.length > 0) || (newPermanentEvidenceFiles && newPermanentEvidenceFiles.length > 0);
    if (!hasPermEvidence) {
      setCloserPermanentEvidenceError('Permanent Evidence Attachment is required. Please attach at least one file.');
      hasCloserErrors = true;
    } else {
      setCloserPermanentEvidenceError(false);
    }

    // 7. Permanent Target Date is mandatory (must be on or after Temporary Target Date)
    if (!closerPermanentTargetDate || !closerPermanentTargetDate.trim()) {
      setCloserPermanentTargetDateError('Permanent Target Date is required.');
      hasCloserErrors = true;
    } else if (closerTargetDate && closerPermanentTargetDate < closerTargetDate) {
      setCloserPermanentTargetDateError(`Permanent Target Date must be on or after Temporary Target Date (${formatDateDDMMYYYY(closerTargetDate)}).`);
      hasCloserErrors = true;
    } else {
      setCloserPermanentTargetDateError(false);
    }

    // 8. Permanent Closed By is mandatory (text-only)
    if (!closerPermanentClosedBy || !closerPermanentClosedBy.trim()) {
      setCloserPermanentClosedByError('Permanent Closed By is required. Please enter person name.');
      hasCloserErrors = true;
    } else if (/\d/.test(closerPermanentClosedBy)) {
      setCloserPermanentClosedByError('Permanent Closed By must contain text only, numbers are not allowed');
      hasCloserErrors = true;
    } else {
      setCloserPermanentClosedByError(false);
    }

    if (hasCloserErrors) {
      const missing = [];
      if (whyErrors.w1 || whyErrors.w2 || whyErrors.w3) missing.push('5-Why Occurrence Causes (W1-W3)');
      if (!closerAction || !closerAction.trim()) missing.push('Temporary Action');
      if (!hasTempEvidence) missing.push('Temporary Evidence Attachment');
      if (!closerTargetDate || !closerTargetDate.trim() || closerTargetDate < todayStr) missing.push('Temporary Target Date');
      if (!closerTemporaryClosedBy || !closerTemporaryClosedBy.trim() || /\d/.test(closerTemporaryClosedBy)) missing.push('Action Taken By');
      if (!closerPermanentFix || !closerPermanentFix.trim()) missing.push('Permanent Action');
      if (!hasPermEvidence) missing.push('Permanent Evidence Attachment');
      if (!closerPermanentTargetDate || !closerPermanentTargetDate.trim() || (closerTargetDate && closerPermanentTargetDate < closerTargetDate)) missing.push('Permanent Target Date');
      if (!closerPermanentClosedBy || !closerPermanentClosedBy.trim() || /\d/.test(closerPermanentClosedBy)) missing.push('Permanent Closed By');

      const validationMsg = missing.length > 0
        ? `Please fill in all mandatory closer fields: ${missing.join(', ')}`
        : 'Please fill in all mandatory closer fields before submitting.';
      setErrorMessage(validationMsg);
      modalError(validationMsg);
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

      let uploadedPermList = [];
      if (newPermanentEvidenceFiles.length > 0) {
        uploadedPermList = await processAuditService.uploadAttachments(newPermanentEvidenceFiles);
      }
      const combinedPermEvidence = [...existingPermanentEvidence, ...uploadedPermList];

      const reqId = selectedRequest.id || selectedRequest.issue_no;
      const displayId = selectedRequest.issue_no || (selectedRequest.id ? `PA-${selectedRequest.id}` : `#${selectedRequest.id}`);

      const targetStatus = (selectedRequest.status || '').toLowerCase() === 'closed'
        ? 'Closed'
        : 'Awaiting Review';

      const payload = {
        status: targetStatus,
        prod_why_why: closerWhyWhy,
        root_cause: closerWhyWhy[0] || rootCause || '',
        temporary_action: closerAction.trim(),
        temporary_evidence_attachment: combinedEvidence,
        temporary_target_date: closerTargetDate || null,
        temporary_closed_by: closerTemporaryClosedBy.trim() || currentUser?.name || currentUser?.email || 'Assigned Executor',
        permanent_fix: closerPermanentFix.trim(),
        permanent_evidence_attachment: combinedPermEvidence,
        permanent_target_date: closerPermanentTargetDate || null,
        permanent_closed_by: closerPermanentClosedBy.trim() || currentUser?.name || currentUser?.email || 'Assigned Executor',
        corrective_action: closerPermanentFix.trim() || closerAction.trim(),
        standardization_details: standardizationDetails.trim(),
        action_attachments: combinedEvidence,
        target_date: closerPermanentTargetDate || closerTargetDate || null,
        action_taken_by: closerTemporaryClosedBy.trim() || currentUser?.name || currentUser?.email || 'Assigned Executor',
        approved_by: currentUser?.name || currentUser?.email || 'Assigned Executor',
        approved_by_id: currentUser?.id || null,
        approved_by_email: currentUser?.email || null,
        approved_by_role: currentUser?.role || null,
        closer_updated_by: currentUser?.name || currentUser?.email || 'Assigned Executor',
        closer_updated_by_id: currentUser?.id || null,
        closer_updated_by_email: currentUser?.email || null
      };

      const updated = await processAuditService.updateRequestStatus(reqId, targetStatus, payload);

      const msg = isAdmin
        ? `Closer 5-Why root cause & countermeasures updated successfully for ${displayId}!`
        : `Closer details submitted successfully for ${displayId}! Quality Admin will review and sign off status.`;

      setSuccessMessage(msg);
      modalSuccess(msg);
      window.dispatchEvent(new Event('refreshNotifications'));
      setNewEvidenceFiles([]);
      setNewPermanentEvidenceFiles([]);
      setExistingEvidence(combinedEvidence);
      setExistingPermanentEvidence(combinedPermEvidence);
      setAdminEditCloser(false);

      const mergedUpdated = { ...selectedRequest, ...payload, ...updated, status: targetStatus };
      setSelectedRequest(mergedUpdated);
      populateForm(mergedUpdated, false);
      await loadRequests();

      setTimeout(() => {
        setSuccessMessage('');
      }, 5000);
    } catch (err) {
      console.error('Failed to update closer fields:', err);
      const errMsg = err.response?.data?.message || err.message || 'Failed to update closer log';
      setErrorMessage(errMsg);
      modalError(errMsg);
    } finally {
      setIsSavingCloser(false);
    }
  };

  // 2. Submit Admin Sign-Off Updates (Remarks, Status, Reassignment) - Independent
  const handleSaveAdmin = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!selectedRequest) return;

    if (isSelectedClosed) {
      const msg = 'This request is closed and cannot be edited.';
      setErrorMessage(msg);
      modalWarning(msg);
      return;
    }

    if (adminEditCloser) {
      const msg = 'Admin Sign-Off is disabled while editing closer fields. Please save or cancel closer log updates first.';
      setErrorMessage(msg);
      modalWarning(msg);
      return;
    }

    if (!isAdmin) {
      const msg = 'Only Quality Admin has permission to update Admin Review and sign off status.';
      setErrorMessage(msg);
      modalError(msg);
      return;
    }

    if (!isReassignOpen && isCloserDataToBeUpdated) {
      const msg = 'Corrective Action & Target Date must be completed before Admin Sign-Off.';
      setErrorMessage(msg);
      modalWarning(msg);
      return;
    }

    if (!closerRemarks || !closerRemarks.trim()) {
      setRemarksError(true);
      modalError('Admin Review Remarks are required before sign-off or reassignment.');
      return;
    }
    setRemarksError(false);

    if (reviewedBy && /\d/.test(reviewedBy)) {
      setReviewedByError('Reviewed By must contain text only, numbers are not allowed');
      modalError('Reviewed By must contain text only, numbers are not allowed');
      return;
    }
    setReviewedByError(false);

    if (!isReassignOpen && !closerStatus) {
      setStatusError(true);
      modalError('Please select status to finalize admin sign-off.');
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
      if (reassignHasErr) {
        modalError('Please select both department and person for reassignment.');
        return;
      }
    }

    setIsSavingAdmin(true);
    setSuccessMessage('');
    setErrorMessage('');

    const reqId = selectedRequest.id || selectedRequest.issue_no;
    const displayId = selectedRequest.issue_no || (selectedRequest.id ? `PA-${selectedRequest.id}` : `#${selectedRequest.id}`);

    const loggedInPersonName = getLoggedInUserName();
    const effectiveReviewer = (reviewedBy && reviewedBy.trim())
      ? reviewedBy.trim()
      : loggedInPersonName;
    const adminSignerName = currentUser?.name || currentUser?.email || loggedInPersonName || 'Quality Admin';

    let reviewerId = currentUser?.id || null;
    let reviewerEmail = currentUser?.email || null;
    if (reviewedBy && reviewedBy.trim() && reviewedBy.trim().toLowerCase() !== loggedInPersonName.toLowerCase()) {
      const match = dbUsers.find(
        (u) =>
          (u.name && u.name.trim().toLowerCase() === reviewedBy.trim().toLowerCase()) ||
          (u.username && u.username.trim().toLowerCase() === reviewedBy.trim().toLowerCase())
      );
      if (match) {
        reviewerId = match.id || null;
        reviewerEmail = match.email || null;
      } else {
        reviewerId = null;
        reviewerEmail = null;
      }
    }

    try {
      if (isReassignOpen) {
        await processAuditService.reassignRequest(reqId, {
          new_department: reassignedDept,
          new_executor: reassignedPerson,
          reason: closerRemarks.trim(),
          reassigned_by: effectiveReviewer || adminSignerName,
          reassigned_by_id: reviewerId || currentUser?.id || null,
          role: currentUser?.role || 'ADMIN',
          user_department: userDept || 'QAD'
        });

        await processAuditService.updateRequestStatus(reqId, 'Pending', {
          creator_remark: closerRemarks.trim(),
          remark: closerRemarks.trim(),
          remarks: closerRemarks.trim(),
          reviewed_by: effectiveReviewer,
          reviewed_by_id: reviewerId,
          reviewed_by_email: reviewerEmail,
          closed_by: null
        });

        const msg = `Request #${displayId} status updated & reassigned to ${reassignedPerson} (${reassignedDept}) successfully!`;
        setSuccessMessage(msg);
        modalSuccess(msg);
        window.dispatchEvent(new Event('refreshNotifications'));
        setIsReassignOpen(false);
        setIsReassignUserDropdownOpen(false);
        setReassignUserSearch('');
        setSelectedRequest((prev) =>
          prev
            ? {
                ...prev,
                department: reassignedDept,
                executor: reassignedPerson,
                status: 'Pending',
                creator_remark: closerRemarks.trim(),
                reviewed_by: effectiveReviewer,
                reviewed_by_id: reviewerId,
                reviewed_by_email: reviewerEmail
              }
            : prev
        );
        await loadRequests();
      } else {
        const targetStatus = closerStatus === 'CLOSED' ? 'Closed' : (closerStatus === 'PENDING' || closerStatus === 'OPEN' ? 'Pending' : closerStatus);

        const payload = {
          creator_remark: closerRemarks.trim(),
          remark: closerRemarks.trim(),
          remarks: closerRemarks.trim(),
          reviewed_by: effectiveReviewer,
          reviewed_by_id: reviewerId,
          reviewed_by_email: reviewerEmail,
          closed_by: adminSignerName,
          closed_by_id: currentUser?.id || null,
          approved_by: adminSignerName,
          approved_by_id: currentUser?.id || null,
          approved_by_email: currentUser?.email || null,
          approved_by_role: currentUser?.role || 'ADMIN'
        };

        const updated = await processAuditService.updateRequestStatus(reqId, targetStatus, payload);
        const msg = `Admin review remarks & status sign-off (${targetStatus}) updated successfully for ${displayId}!`;
        setSuccessMessage(msg);
        modalSuccess(msg);
        window.dispatchEvent(new Event('refreshNotifications'));

        if (targetStatus === 'Closed') {
          const merged = { ...selectedRequest, ...payload, ...updated, status: 'Closed', reviewed_by: effectiveReviewer, reviewed_by_id: reviewerId, reviewed_by_email: reviewerEmail };
          setSelectedRequest(merged);
          populateForm(merged);
        } else if (updated) {
          const merged = { ...selectedRequest, ...payload, ...updated, status: targetStatus, reviewed_by: effectiveReviewer, reviewed_by_id: reviewerId, reviewed_by_email: reviewerEmail };
          setSelectedRequest(merged);
          populateForm(merged);
        }
        await loadRequests();
      }

      setTimeout(() => {
        setSuccessMessage('');
      }, 5000);
    } catch (err) {
      console.error('Failed to update admin fields:', err);
      const errMsg = err.response?.data?.message || err.message || 'Failed to update admin review & status';
      setErrorMessage(errMsg);
      modalError(errMsg);
    } finally {
      setIsSavingAdmin(false);
    }
  };

  // Filter requests
  const filtered = requests.filter((r) => {
    if (!isAdmin) {
      const isAssignedToMe = matchesExecutorUser(
        r.executor,
        currentUser?.name,
        currentUser?.email,
        currentUser?.username,
        currentUser?.id
      );
      if (!isAssignedToMe) return false;
    }

    const reqId = String(r.issue_no || (r.id ? `PA-${r.id}` : '')).toLowerCase();
    const stage = String(r.model || r.stage || '').toLowerCase();
    const line = String(r.process_operation || r.line || '').toLowerCase();
    const executor = String(r.executor || '').toLowerCase();
    const creator = String(r.created_by || r.creator || '').toLowerCase();
    const prod = String(r.product || r.production || '').toLowerCase();
    const obs = String(r.issue_observation || r.problem || '').toLowerCase();
    const remarks = String(r.creator_remark || r.remarks || '').toLowerCase();
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
      selectedStatus === 'Awaiting Review' ||
      selectedStatus === 'AWAITING REVIEW' ||
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
          'REMARKS': r.creator_remark || r.remarks || '—',
          'STATUS': (() => {
            const s = (r.status || '').toLowerCase();
            if (s.includes('progress') || s.includes('approved') || s.includes('signed') || s.includes('review') || s.includes('approval')) {
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

  // Convert new permanent files to previewable objects
  const previewableNewPermanentFiles = newPermanentEvidenceFiles.map((f) => {
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

  const {
    hasReassignments: selectedHasReassignments,
    count: selectedReassignCount,
    list: selectedReassignList
  } = formatReassignmentHistory(selectedRequest?.reassignment_history);

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

              {/* Reassignment Tracking History Audit Trail (Only shown in case of reassign status) */}
              {selectedHasReassignments && (
                <div className="p-3.5 bg-gradient-to-r from-purple-50/70 via-indigo-50/40 to-slate-50 rounded-xl border border-purple-200/90 space-y-2.5 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-purple-800 text-[11px] font-bold uppercase tracking-wider">
                      <ArrowRightLeft className="w-3.5 h-3.5 text-purple-600" />
                      <span>REASSIGNMENT TRACKING HISTORY ({selectedReassignCount})</span>
                    </div>
                    <span className="text-[9px] font-bold px-2 py-0.5 bg-purple-100 text-purple-800 rounded-full border border-purple-200 font-mono">
                      Reassigned: Yes
                    </span>
                  </div>

                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {selectedReassignList.map((entry, idx) => (
                      <div key={idx} className="p-2.5 bg-white rounded-lg border border-purple-100 shadow-2xs space-y-1 text-xs">
                        <div className="flex items-center justify-between flex-wrap gap-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="px-1.5 py-0.2 rounded bg-purple-100 text-purple-800 font-mono font-bold text-[9px]">
                              #{idx + 1}
                            </span>
                            <span className="text-slate-600 font-medium text-[11px]">
                              From: <strong className="text-slate-900">{entry.prev_resp_person || entry.previous_executor || '—'}</strong> ({entry.prev_resp || entry.previous_department || '—'})
                            </span>
                            <ArrowRightLeft className="w-2.5 h-2.5 text-purple-400 inline" />
                            <span className="text-purple-700 font-medium text-[11px]">
                              To: <strong className="text-purple-900">{entry.new_resp_person || entry.new_executor || '—'}</strong> ({entry.new_resp || entry.new_department || '—'})
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {[entry.reassigned_by ? `by ${entry.reassigned_by}` : '', entry.reassigned_at ? formatDateDDMMYYYY(entry.reassigned_at) : ''].filter(Boolean).join(' • ')}
                          </span>
                        </div>
                        {(entry.remarks || entry.reason) && (
                          <div className="text-[10px] text-slate-700 bg-slate-50 px-2 py-0.5 rounded border border-slate-100 italic">
                            <span className="font-semibold text-slate-500 not-italic">Remarks: </span>
                            {entry.remarks || entry.reason}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Occurrence Cause (Production Team - 5 Why) Header */}
            <div className="pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-black uppercase tracking-wider text-amber-700 flex items-center gap-1.5">
                    <span>Occurrence Cause (Production Team - 5 Why)</span>
                    {selectedRequest && canUpdateCloserFields && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-200">
                        {isAdmin && !isCloser ? 'Admin Edit' : 'Closer'}
                      </span>
                    )}
                  </span>
                </div>
              </div>

              {/* 5-Whys Stacked Inputs (W1 to W5) */}
              <div className="space-y-1.5">
                {['W1', 'W2', 'W3', 'W4', 'W5'].map((label, idx) => {
                  const isMandatory = idx < 3;
                  const errorKey = `w${idx + 1}`;
                  const hasError = isMandatory && Boolean(closerWhyErrors[errorKey]);
                  return (
                    <div key={idx} className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`w-8 shrink-0 text-[11px] font-black font-mono ${hasError ? 'text-rose-700' : 'text-rose-600'}`}>
                          {label}:{isMandatory && <span className="text-red-500 font-bold ml-0.5">*</span>}
                        </span>
                        <input
                          type="text"
                          disabled={!canUpdateCloserFields}
                          value={closerWhyWhy[idx] || ''}
                          onChange={(e) => handleWhyChange(idx, e.target.value)}
                          placeholder={
                            !selectedRequest
                              ? 'Select request on right'
                              : canUpdateCloserFields
                              ? `Enter ${label} cause...${isMandatory ? ' (Mandatory)' : ''}`
                              : isAdmin
                              ? `Click Edit Closer Fields below to edit ${label}...`
                              : `Enter ${label} cause...`
                          }
                          className={`w-full px-3 py-1.5 rounded-lg text-slate-800 outline-none transition disabled:bg-slate-100/70 disabled:text-slate-500 disabled:cursor-not-allowed ${
                            hasError
                              ? 'bg-rose-50/20 border border-rose-400 focus:ring-2 focus:ring-rose-400/20 focus:border-rose-500'
                              : 'bg-white border border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500'
                          }`}
                        />
                      </div>
                      {hasError && (
                        <p className="text-[11px] text-rose-500 font-semibold pl-10 flex items-center gap-1">
                          <span>* Why {idx + 1} ({label}) is mandatory. Please enter occurrence cause.</span>
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Temporary Action Field */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <span>TEMPORARY ACTION</span>
                  <span className="text-rose-500 font-bold">*</span>
                  {selectedRequest && canUpdateCloserFields && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-200">
                      {isAdmin ? 'Admin Edit' : 'Closer'}
                    </span>
                  )}
                </label>
              </div>
              <textarea
                rows={2}
                disabled={!canUpdateCloserFields}
                value={closerAction}
                onChange={(e) => {
                  setCloserAction(e.target.value);
                  if (e.target.value.trim()) {
                    setCloserActionError(false);
                  }
                }}
                placeholder={
                  !selectedRequest
                    ? 'Click a row on the right to select'
                    : canUpdateCloserFields
                    ? 'Describe temporary actions taken / countermeasures...'
                    : isAdmin
                    ? 'Click Edit Closer Fields below to edit...'
                    : 'Describe temporary actions taken / countermeasures...'
                }
                className={`w-full px-3.5 py-2 rounded-xl text-slate-800 outline-none disabled:bg-slate-100/70 disabled:text-slate-500 disabled:cursor-not-allowed transition resize-none ${
                  closerActionError
                    ? 'border border-rose-400 bg-rose-50/20 focus:ring-2 focus:ring-rose-400/20 focus:border-rose-500'
                    : 'border border-slate-200 bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500'
                }`}
              />
              {closerActionError && (
                <p className="text-[11px] text-rose-500 font-semibold mt-1 flex items-center gap-1">
                  <span>* {closerActionError}</span>
                </p>
              )}
            </div>

            {/* Temporary Evidence Attachment */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <span>TEMPORARY EVIDENCE ATTACHMENT</span>
                  <span className="text-rose-500 font-bold">*</span>
                  {selectedRequest && canUpdateCloserFields && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-200">
                      {isAdmin ? 'Admin Edit' : 'Closer'}
                    </span>
                  )}
                </label>
              </div>

              {/* Styled File Input Button */}
              <div className={`flex items-center gap-2 p-1 rounded-xl transition ${
                evidenceError ? 'border border-rose-400 bg-rose-50/20 ring-1 ring-rose-400/30' : ''
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
                  <span>* {evidenceError}</span>
                </p>
              )}

              {/* Existing and newly attached chips */}
              <div className="mt-2 space-y-1">
                {existingEvidence.length > 0 && (
                  <AttachmentChipList
                    attachments={existingEvidence}
                    onPreview={(att) => setSelectedPreviewAttachment(att)}
                    onAnnotate={canUpdateCloserFields ? (file, idx) => setAnnotatingItem({ attachment: file, index: idx, isExisting: true, isPermanent: false }) : undefined}
                    onRemove={canUpdateCloserFields ? (idx) => handleRemoveExistingEvidence(idx) : undefined}
                    readonly={!canUpdateCloserFields}
                  />
                )}
                {previewableNewFiles.length > 0 && (
                  <AttachmentChipList
                    attachments={previewableNewFiles}
                    onPreview={(att) => setSelectedPreviewAttachment(att)}
                    onAnnotate={canUpdateCloserFields ? (file, idx) => setAnnotatingItem({ attachment: file, index: idx, isExisting: false, isPermanent: false }) : undefined}
                    onRemove={canUpdateCloserFields ? (idx) => handleRemoveNewEvidence(idx) : undefined}
                    readonly={!canUpdateCloserFields}
                  />
                )}
              </div>
            </div>

            {/* Temporary Target Date */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <span>TEMPORARY TARGET DATE</span>
                  <span className="text-rose-500 font-bold">*</span>
                  {selectedRequest && canUpdateCloserFields && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-200">
                      {isAdmin ? 'Admin Edit' : 'Closer'}
                    </span>
                  )}
                </label>
                <span className="text-[10px] text-slate-400 font-normal">
                  Min: <strong className="text-slate-600 font-semibold">{formatDateDDMMYYYY(todayStr)}</strong>
                </span>
              </div>
              <DateInput
                disabled={!canUpdateCloserFields}
                min={todayStr}
                value={closerTargetDate}
                onChange={(e) => {
                  const val = e.target.value;
                  setCloserTargetDate(val);
                  if (!val || !val.trim()) {
                    setCloserTargetDateError('Temporary Target Date is required.');
                  } else if (val < todayStr) {
                    setCloserTargetDateError('Temporary Target Date must be today or a future date.');
                  } else {
                    setCloserTargetDateError(false);
                  }
                  if (val && closerPermanentTargetDate && closerPermanentTargetDate < val) {
                    setCloserPermanentTargetDateError(`Permanent Target Date must be on or after Temporary Target Date (${formatDateDDMMYYYY(val)}).`);
                  } else if (closerPermanentTargetDateError && typeof closerPermanentTargetDateError === 'string' && closerPermanentTargetDateError.includes('Temporary Target Date')) {
                    setCloserPermanentTargetDateError(false);
                  }
                }}
                className={`w-full px-3.5 py-2 bg-white border rounded-xl text-slate-800 outline-none disabled:bg-slate-100/70 disabled:text-slate-500 disabled:cursor-not-allowed transition ${
                  closerTargetDateError
                    ? 'border-rose-400 focus:ring-2 focus:ring-rose-400/20 focus:border-rose-500 bg-rose-50/20'
                    : 'border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500'
                }`}
              />
              {closerTargetDateError && (
                <p className="text-[11px] text-rose-500 font-semibold mt-1 flex items-center gap-1">
                  <span>* {typeof closerTargetDateError === 'string' ? closerTargetDateError : 'Temporary Target Date is required.'}</span>
                </p>
              )}
            </div>

            {/* Action Taken By */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <span>ACTION TAKEN BY</span>
                  <span className="text-rose-500 font-bold">*</span>
                  {selectedRequest && canUpdateCloserFields && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-200">
                      {isAdmin ? 'Admin Edit' : 'Closer'}
                    </span>
                  )}
                </label>
              </div>
              <input
                type="text"
                disabled={!canUpdateCloserFields}
                placeholder={
                  !selectedRequest
                    ? 'Click a row on the right to select'
                    : canUpdateCloserFields
                    ? 'Enter person name...'
                    : 'Enter person name...'
                }
                value={closerTemporaryClosedBy || ''}
                onKeyDown={(e) => {
                  if (/[0-9]/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
                    e.preventDefault();
                    setCloserTemporaryClosedByError('Only text / letters allowed, numbers are not allowed');
                  }
                }}
                onChange={(e) => {
                  if (!canUpdateCloserFields) return;
                  const raw = e.target.value;
                  const cleaned = raw.replace(/[0-9]/g, '');
                  setCloserTemporaryClosedBy(cleaned);
                  if (/\d/.test(raw)) {
                    setCloserTemporaryClosedByError('Only text / letters allowed, numbers are not allowed');
                  } else if (!cleaned.trim()) {
                    setCloserTemporaryClosedByError('Action Taken By is required. Please enter person name.');
                  } else {
                    setCloserTemporaryClosedByError(false);
                  }
                }}
                className={`w-full px-3.5 py-2 border rounded-xl text-slate-800 outline-none transition font-semibold ${
                  !canUpdateCloserFields
                    ? 'bg-slate-100/70 border-slate-200 text-slate-500 cursor-not-allowed select-none'
                    : closerTemporaryClosedByError
                    ? 'border-rose-400 focus:ring-2 focus:ring-rose-400/20 focus:border-rose-500 bg-rose-50/20'
                    : 'border-slate-200 bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500'
                }`}
              />
              {closerTemporaryClosedByError ? (
                <p className="text-[11px] text-rose-500 font-semibold mt-0.5 flex items-center gap-1">
                  <span>* {closerTemporaryClosedByError}</span>
                </p>
              ) : (
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Person executing temporary containment countermeasure.
                </p>
              )}
            </div>

            {/* Permanent Fix Section Header */}
            <div className="pt-2 border-t border-slate-200/90">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                Permanent Countermeasures
              </span>
            </div>

            {/* Permanent Action */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <span>PERMANENT ACTION</span>
                  <span className="text-rose-500 font-bold">*</span>
                  {selectedRequest && canUpdateCloserFields && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-200">
                      {isAdmin ? 'Admin Edit' : 'Closer'}
                    </span>
                  )}
                </label>
              </div>
              <textarea
                rows={2}
                disabled={!canUpdateCloserFields}
                value={closerPermanentFix}
                onChange={(e) => {
                  setCloserPermanentFix(e.target.value);
                  if (e.target.value.trim()) {
                    setCloserPermanentFixError(false);
                  }
                }}
                placeholder={
                  !selectedRequest
                    ? 'Click a row on the right to select'
                    : canUpdateCloserFields
                    ? 'Describe permanent corrective action / long-term countermeasure...'
                    : isAdmin
                    ? 'Click Edit Closer Fields below to edit...'
                    : 'Describe permanent corrective action / long-term countermeasure...'
                }
                className={`w-full px-3.5 py-2 rounded-xl text-slate-800 outline-none disabled:bg-slate-100/70 disabled:text-slate-500 disabled:cursor-not-allowed transition resize-none ${
                  closerPermanentFixError
                    ? 'border border-rose-400 bg-rose-50/20 focus:ring-2 focus:ring-rose-400/20 focus:border-rose-500'
                    : 'border border-slate-200 bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500'
                }`}
              />
              {closerPermanentFixError && (
                <p className="text-[11px] text-rose-500 font-semibold mt-1 flex items-center gap-1">
                  <span>* {closerPermanentFixError}</span>
                </p>
              )}
            </div>

            {/* Permanent Evidence Attachment */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <span>PERMANENT EVIDENCE ATTACHMENT</span>
                  <span className="text-rose-500 font-bold">*</span>
                  {selectedRequest && canUpdateCloserFields && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-200">
                      {isAdmin ? 'Admin Edit' : 'Closer'}
                    </span>
                  )}
                </label>
              </div>

              <div className={`flex items-center gap-2 p-1 rounded-xl transition ${
                closerPermanentEvidenceError ? 'border border-rose-400 bg-rose-50/20 ring-1 ring-rose-400/30' : ''
              }`}>
                <button
                  type="button"
                  disabled={!canUpdateCloserFields}
                  onClick={() => fileInputPermanentRef.current && fileInputPermanentRef.current.click()}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                >
                  Choose files
                </button>
                <span className="text-[11px] text-slate-500 truncate">
                  {newPermanentEvidenceFiles.length > 0
                    ? `${newPermanentEvidenceFiles.length} file(s) selected`
                    : existingPermanentEvidence.length > 0
                    ? `${existingPermanentEvidence.length} existing attachment(s)`
                    : 'No file chosen'}
                </span>
                <input
                  ref={fileInputPermanentRef}
                  type="file"
                  multiple
                  accept=".ppt,.pptx,.pdf,.doc,.docx,.xls,.xlsx,.csv,.png,.jpg,.jpeg,.jfif,.webp,.bmp,image/jpeg,image/png,image/jfif,image/pjpeg,image/*"
                  onChange={handlePermanentFileSelect}
                  className="hidden"
                />
              </div>
              {closerPermanentEvidenceError && (
                <p className="text-[11px] text-rose-500 font-semibold mt-1 flex items-center gap-1">
                  <span>* {closerPermanentEvidenceError}</span>
                </p>
              )}

              {/* Existing and newly attached chips for permanent evidence */}
              <div className="mt-2 space-y-1">
                {existingPermanentEvidence.length > 0 && (
                  <AttachmentChipList
                    attachments={existingPermanentEvidence}
                    onPreview={(att) => setSelectedPreviewAttachment(att)}
                    onAnnotate={canUpdateCloserFields ? (file, idx) => setAnnotatingItem({ attachment: file, index: idx, isExisting: true, isPermanent: true }) : undefined}
                    onRemove={canUpdateCloserFields ? (idx) => handleRemoveExistingPermanentEvidence(idx) : undefined}
                    readonly={!canUpdateCloserFields}
                  />
                )}
                {previewableNewPermanentFiles.length > 0 && (
                  <AttachmentChipList
                    attachments={previewableNewPermanentFiles}
                    onPreview={(att) => setSelectedPreviewAttachment(att)}
                    onAnnotate={canUpdateCloserFields ? (file, idx) => setAnnotatingItem({ attachment: file, index: idx, isExisting: false, isPermanent: true }) : undefined}
                    onRemove={canUpdateCloserFields ? (idx) => handleRemoveNewPermanentEvidence(idx) : undefined}
                    readonly={!canUpdateCloserFields}
                  />
                )}
              </div>
            </div>

            {/* Permanent Target Date */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <span>PERMANENT TARGET DATE</span>
                  <span className="text-rose-500 font-bold">*</span>
                  {selectedRequest && canUpdateCloserFields && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-200">
                      {isAdmin ? 'Admin Edit' : 'Closer'}
                    </span>
                  )}
                </label>
                {closerTargetDate && (
                  <span className="text-[10px] text-slate-400 font-normal">
                    Min: <strong className="text-slate-600 font-semibold">{formatDateDDMMYYYY(closerTargetDate)}</strong>
                  </span>
                )}
              </div>
              <DateInput
                disabled={!canUpdateCloserFields}
                min={closerTargetDate || undefined}
                value={closerPermanentTargetDate}
                onChange={(e) => {
                  const val = e.target.value;
                  setCloserPermanentTargetDate(val);
                  if (!val || !val.trim()) {
                    setCloserPermanentTargetDateError('Permanent Target Date is required.');
                  } else if (closerTargetDate && val < closerTargetDate) {
                    setCloserPermanentTargetDateError(`Permanent Target Date must be on or after Temporary Target Date (${formatDateDDMMYYYY(closerTargetDate)}).`);
                  } else {
                    setCloserPermanentTargetDateError(false);
                  }
                }}
                className={`w-full px-3.5 py-2 bg-white border rounded-xl text-slate-800 outline-none disabled:bg-slate-100/70 disabled:text-slate-500 disabled:cursor-not-allowed transition ${
                  closerPermanentTargetDateError
                    ? 'border-rose-400 focus:ring-2 focus:ring-rose-400/20 focus:border-rose-500 bg-rose-50/20'
                    : 'border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500'
                }`}
              />
              {closerPermanentTargetDateError && (
                <p className="text-[11px] text-rose-500 font-semibold mt-1 flex items-center gap-1">
                  <span>* {typeof closerPermanentTargetDateError === 'string' ? closerPermanentTargetDateError : 'Permanent Target Date must be on or after Temporary Target Date.'}</span>
                </p>
              )}
            </div>

            {/* Permanent Closed By */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <span>PERMANENT CLOSED BY</span>
                  <span className="text-rose-500 font-bold">*</span>
                  {selectedRequest && canUpdateCloserFields && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-200">
                      {isAdmin ? 'Admin Edit' : 'Closer'}
                    </span>
                  )}
                </label>
              </div>
              <input
                type="text"
                disabled={!canUpdateCloserFields}
                placeholder={
                  !selectedRequest
                    ? 'Click a row on the right to select'
                    : canUpdateCloserFields
                    ? 'Enter person name...'
                    : 'Enter person name...'
                }
                value={closerPermanentClosedBy || ''}
                onKeyDown={(e) => {
                  if (/[0-9]/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
                    e.preventDefault();
                    setCloserPermanentClosedByError('Only text / letters allowed, numbers are not allowed');
                  }
                }}
                onChange={(e) => {
                  if (!canUpdateCloserFields) return;
                  const raw = e.target.value;
                  const cleaned = raw.replace(/[0-9]/g, '');
                  setCloserPermanentClosedBy(cleaned);
                  if (/\d/.test(raw)) {
                    setCloserPermanentClosedByError('Only text / letters allowed, numbers are not allowed');
                  } else if (!cleaned.trim()) {
                    setCloserPermanentClosedByError('Permanent Closed By is required. Please enter person name.');
                  } else {
                    setCloserPermanentClosedByError(false);
                  }
                }}
                className={`w-full px-3.5 py-2 border rounded-xl text-slate-800 outline-none transition font-semibold ${
                  !canUpdateCloserFields
                    ? 'bg-slate-100/70 border-slate-200 text-slate-500 cursor-not-allowed select-none'
                    : closerPermanentClosedByError
                    ? 'border-rose-400 focus:ring-2 focus:ring-rose-400/20 focus:border-rose-500 bg-rose-50/20'
                    : 'border-slate-200 bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500'
                }`}
              />
              {closerPermanentClosedByError ? (
                <p className="text-[11px] text-rose-500 font-semibold mt-0.5 flex items-center gap-1">
                  <span>* {closerPermanentClosedByError}</span>
                </p>
              ) : (
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Person confirming permanent countermeasure closure.
                </p>
              )}
            </div>

            {/* Dedicated Closer Submit Button */}
            <div className="pt-1">
              {/* In-place Closer Feedback Banner */}
              {errorMessage && (
                <div className="p-3 mb-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}
              {successMessage && (
                <div className="p-3 mb-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 animate-in fade-in">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{successMessage}</span>
                </div>
              )}

              {!selectedRequest ? (
                <button
                  type="button"
                  disabled
                  className="w-full py-2.5 px-4 rounded-xl border border-blue-200/80 bg-blue-50/50 text-blue-400 font-bold text-xs cursor-not-allowed select-none text-center shadow-2xs"
                >
                  Select a Request to Update
                </button>
              ) : isSelectedClosed ? (
                <div className="w-full py-2.5 px-4 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 font-bold text-xs select-none text-center shadow-2xs flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Incident Closed — Updates Locked</span>
                </div>
              ) : (isAdmin && !isCloser) ? (
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
                      <span>Submit Closer Log (5-Why &amp; Actions)</span>
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
                  <div className="flex items-center gap-2">
                    {selectedRequest && (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveModalRequest(selectedRequest);
                          setModalTab('sign_tracks');
                        }}
                        className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 hover:underline cursor-pointer"
                        title="Open Sign Fields & Tracks"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Sign &amp; Tracks</span>
                      </button>
                    )}
                    <span className="text-[10px] text-slate-400 font-medium">Independent Update</span>
                  </div>
                </div>

                {/* Alert Banner / Guidance */}
                {isSelectedClosed ? (
                  <div className="p-2.5 px-3 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-900 text-[11px] flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <div className="leading-tight">
                      <span className="font-bold">Incident Closed: </span>
                      <span className="text-emerald-800">
                        This request is fully closed and locked. All closer and admin sign-off fields cannot be edited.
                      </span>
                    </div>
                  </div>
                ) : adminEditCloser ? (
                  <div className="p-2.5 px-3 rounded-xl border border-amber-300 bg-amber-50/90 text-amber-900 text-[11px] flex items-center gap-2 animate-in fade-in">
                    <Lock className="w-4 h-4 text-amber-600 shrink-0" />
                    <div className="leading-tight">
                      <span className="font-bold">Review Paused: </span>
                      <span className="text-amber-800">
                        Finish closer editing above to resume Admin Sign-Off.
                      </span>
                    </div>
                  </div>
                ) : (
                  selectedRequest && !isSelectedClosed && (
                    <div className="p-2.5 px-3 rounded-xl border border-blue-200 bg-blue-50/70 text-blue-900 text-[11px] flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-blue-600 shrink-0" />
                      <div className="leading-tight">
                        <span className="font-bold">{isReassignOpen ? 'Reassignment: ' : 'Admin Review: '}</span>
                        <span className="text-blue-800">
                          {isReassignOpen
                            ? 'Enter reassignment remarks and select the new executor.'
                            : 'Enter review remarks and select CLOSED to finalize sign-off.'}
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
                          setCloserStatus('PENDING');
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
                    disabled={!selectedRequest || adminEditCloser || isSelectedClosed}
                    value={closerRemarks}
                    onChange={(e) => {
                      if (adminEditCloser) return;
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
                        : isReassignOpen
                        ? 'Enter reason for reassigning to new executor...'
                        : 'Enter admin review remarks and sign-off notes...'
                    }
                    className={`w-full px-3.5 py-2 border rounded-xl text-slate-800 outline-none transition resize-none ${
                      adminEditCloser
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
                  ) : remarksError ? (
                    <p className="text-[11px] text-rose-500 font-semibold mt-0.5 flex items-center gap-1">
                      <span>* Remarks is required before admin sign-off or reassignment.</span>
                    </p>
                  ) : isReassignOpen ? (
                    <p className="text-[10px] text-blue-600 mt-0.5 font-medium">
                      Enter reason for transferring to the new executor.
                    </p>
                  ) : (
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Enter admin review remarks before final closure.
                    </p>
                  )}
                </div>

                {/* Reviewed By (Manual entry by admin / quality - Text only, references CreateRequest Created By) */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <span>REVIEWED BY</span>
                      <span className="text-slate-400 font-normal lowercase text-[10px]">(optional)</span>
                      {selectedRequest && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 bg-purple-50 text-purple-700 rounded border border-purple-200">
                          Admin
                        </span>
                      )}
                    </label>
                    <span
                      className="text-[10px] text-slate-400 font-normal uppercase truncate max-w-[200px]"
                      title={`Defaults to: ${getLoggedInUserName()}`}
                    >
                      DEFAULTS TO: <strong className="text-slate-600 font-bold">{getLoggedInUserName().toUpperCase()}</strong>
                    </span>
                  </div>
                  <input
                    type="text"
                    disabled={!selectedRequest || adminEditCloser || (isCloserDataToBeUpdated && !isReassignOpen) || isSelectedClosed}
                    placeholder={
                      !selectedRequest
                        ? 'Click a row on the right to select'
                        : `e.g. Leave empty to attach ${getLoggedInUserName()}`
                    }
                    value={reviewedBy || ''}
                    onKeyDown={(e) => {
                      if (/[0-9]/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
                        e.preventDefault();
                        setReviewedByError('Only text / letters allowed, numbers are not allowed');
                      }
                    }}
                    onChange={(e) => {
                      if (adminEditCloser || (isCloserDataToBeUpdated && !isReassignOpen)) return;
                      const raw = e.target.value;
                      const cleaned = raw.replace(/[0-9]/g, '');
                      setReviewedBy(cleaned);
                      if (/\d/.test(raw)) {
                        setReviewedByError('Only text / letters allowed, numbers are not allowed');
                      } else if (reviewedByError) {
                        setReviewedByError(false);
                      }
                    }}
                    className={`w-full px-3.5 py-2 border rounded-xl text-slate-800 outline-none transition font-semibold ${
                      adminEditCloser || (isCloserDataToBeUpdated && !isReassignOpen)
                        ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed select-none'
                        : reviewedByError
                        ? 'border-rose-400 focus:ring-2 focus:ring-rose-400/20 focus:border-rose-500 bg-rose-50/20'
                        : 'border-slate-200 bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500'
                    }`}
                  />
                  {reviewedByError ? (
                    <p className="text-[11px] text-rose-500 font-semibold mt-0.5 flex items-center gap-1">
                      <span>* {reviewedByError}</span>
                    </p>
                  ) : (
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Admin / Quality Engineer reviewing this incident (defaults to {getLoggedInUserName()}).
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
                    value={isReassignOpen ? 'PENDING' : closerStatus}
                    onChange={(e) => {
                      if (adminEditCloser || isReassignOpen || isSelectedClosed) return;
                      setCloserStatus(e.target.value);
                      if (e.target.value) setStatusError(false);
                    }}
                    disabled={adminEditCloser || !selectedRequest || isReassignOpen || isSelectedClosed}
                    className={`w-full px-3.5 py-2.5 border rounded-xl font-bold outline-none transition ${
                      adminEditCloser
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
                      <option value="PENDING">PENDING (Awaiting Closer)</option>
                    ) : (
                      <>
                        <option value="">Select Status...</option>
                        <option value="CLOSED">CLOSED</option>
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
                  {errorMessage && (
                    <div className="p-3 mb-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2 animate-in fade-in">
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>{errorMessage}</span>
                    </div>
                  )}
                  {successMessage && (
                    <div className="p-3 mb-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 animate-in fade-in">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{successMessage}</span>
                    </div>
                  )}
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
                  ) : isSelectedClosed ? (
                    <div className="w-full py-2.5 px-4 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 font-bold text-xs select-none text-center shadow-2xs flex items-center justify-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Audit Finding Fully Validated &amp; Closed</span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSaveAdmin}
                      disabled={isSavingAdmin || isSavingCloser || (!isReassignOpen && !closerStatus)}
                      className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-xs shadow-md hover:shadow-lg transition transform active:scale-98 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSavingAdmin ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Saving...</span>
                        </>
                      ) : isReassignOpen ? (
                        <>
                          <UserCheck className="w-4 h-4" />
                          <span>Reassign Closer &amp; Save Remarks</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Save Admin Review &amp; Close Request</span>
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
                <option value="Awaiting Review">Awaiting Review</option>
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

                      const remarksText = r.creator_remark || r.remarks || '—';
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
                            <div>{displayId}</div>
                            {(() => {
                              const { hasReassignments, count } = formatReassignmentHistory(r.reassignment_history);
                              if (!hasReassignments) return null;
                              return (
                                <div className="mt-0.5">
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                                    <ArrowRightLeft className="w-2.5 h-2.5 text-purple-600" />
                                    <span>Reassigned ({count})</span>
                                  </span>
                                </div>
                              );
                            })()}
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
                                AWAITING REVIEW
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
                            <div className="flex items-center justify-center gap-1.5">
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
                             
                            </div>
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
        initialTab={modalTab}
        onClose={() => {
          setActiveModalRequest(null);
          setModalTab('requester');
        }}
        onUpdated={(updatedReq) => {
          loadRequests();
          if (updatedReq && activeModalRequest) {
            setActiveModalRequest(updatedReq);
          }
        }}
      />

      {/* Universal Attachment Preview Modal */}
      <AttachmentPreviewModal
        isOpen={Boolean(selectedPreviewAttachment)}
        attachment={selectedPreviewAttachment}
        onClose={() => setSelectedPreviewAttachment(null)}
        onAnnotate={canUpdateCloserFields ? (att) => {
          const newIdx = newEvidenceFiles.findIndex(f => f.name === att.name || (att.file && att.file === f));
          if (newIdx !== -1) {
            setAnnotatingItem({ attachment: att, index: newIdx, isExisting: false, isPermanent: false });
            return;
          }
          const permIdx = newPermanentEvidenceFiles.findIndex(f => f.name === att.name || (att.file && att.file === f));
          if (permIdx !== -1) {
            setAnnotatingItem({ attachment: att, index: permIdx, isExisting: false, isPermanent: true });
            return;
          }
          const exIdx = existingEvidence.findIndex(f => f.name === att.name || f.url === att.url || f.path === att.path);
          if (exIdx !== -1) {
            setAnnotatingItem({ attachment: att, index: exIdx, isExisting: true, isPermanent: false });
            return;
          }
          const exPermIdx = existingPermanentEvidence.findIndex(f => f.name === att.name || f.url === att.url || f.path === att.path);
          if (exPermIdx !== -1) {
            setAnnotatingItem({ attachment: att, index: exPermIdx, isExisting: true, isPermanent: true });
            return;
          }
          setAnnotatingItem({ attachment: att, isPermanent: false });
        } : undefined}
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
