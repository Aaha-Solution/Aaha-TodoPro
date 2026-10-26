import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ClipboardCheck,
  CheckCircle2,
  Search,
  Eye,
  ShieldAlert,
  Download,
  Check,
  Save,
  Loader2,
  ChevronLeft,
  ChevronRight,
  FileCheck,
  AlertCircle,
  UserCheck,
  X,
  ChevronDown,
  PenTool,
  Lock,
  Pencil
} from 'lucide-react';
import { ihlrService } from '../../services/ihlrService';
import { IhlrAttachmentThumbnail, parseAttachments } from './IhlrAttachmentView';
import IhlrRequestDetailsModal from './IhlrRequestDetailsModal';
import IhlrAttachmentPreviewModal from './IhlrAttachmentPreviewModal';
import ImageAnnotationModal from '../../components/common/ImageAnnotationModal';
import ExportSelectionModal from '../../components/common/ExportSelectionModal';
import { exportIhlrToExcel, exportIhlrToPdf, formatReassignmentHistory } from './ihlrExportUtils';
import AttachmentChipList from '../../components/common/AttachmentChipList';
import DateInput from '../../components/common/DateInput';
import { useModal } from '../../context/ModalContext';
import { useAuth } from '../../hooks/useAuth';
import { formatDateDDMMYYYY } from '../../utils/dateUtils';
import { isIhlrRequestVisibleToUser } from '../../utils/ihlrAuthUtils';
import { formatIhlrShiftDisplay } from '../../utils/constants';

const IhlrApprovals = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { success: modalSuccess, error: modalError, warning: modalWarning } = useModal();

  const userDept = (user?.department || (() => {
    try {
      const u = sessionStorage.getItem('todo_user') || localStorage.getItem('todo_user');
      return u ? JSON.parse(u)?.department : '';
    } catch {
      return '';
    }
  })() || '').trim().toUpperCase();

  const userRole = (user?.role || '').trim().toUpperCase();
  const isAdmin = userRole === 'ADMIN' || userDept === 'QAD';

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(() => location.state?.search || '');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [activeModalRequest, setActiveModalRequest] = useState(null);
  const [modalInitialEdit, setModalInitialEdit] = useState(false);
  const [selectedPreviewAttachment, setSelectedPreviewAttachment] = useState(null);
  const [selectedRequest, setSelectedRequest] = useState(null);

  const cleanStr = (val) => (val || '').trim().toLowerCase().replace(/^(mr\.|mrs\.|ms\.)\s+/i, '');
  const uName = cleanStr(user?.name);
  const uEmail = cleanStr(user?.email);
  const uDept = cleanStr(userDept || user?.department);
  const uId = String(user?.id || '');

  const rRespPerson = cleanStr(selectedRequest?.resp_person);
  const rRespPersonList = rRespPerson.split(',').map((s) => cleanStr(s)).filter(Boolean);
  const rRespEmail = cleanStr(selectedRequest?.resp_person_email);
  const rRespEmailList = rRespEmail.split(',').map((s) => cleanStr(s)).filter(Boolean);
  const rRespDept = (selectedRequest?.resp || '').trim().toUpperCase();

  const isDeptMatch = Boolean(!rRespDept || (uDept && uDept.toUpperCase() === rRespDept));
  const isNameOrEmailMatch = Boolean(
    (rRespPerson && (uName === rRespPerson || rRespPersonList.includes(uName))) ||
    (rRespEmail && (uEmail === rRespEmail || rRespEmailList.includes(uEmail)))
  );
  const isCloser = Boolean(
    (isDeptMatch && (isNameOrEmailMatch || !rRespPerson)) ||
    isNameOrEmailMatch
  );

  const rCreatedBy = cleanStr(selectedRequest?.created_by);
  const rCreatedEmail = cleanStr(selectedRequest?.created_by_email);
  const rCreatedId = String(selectedRequest?.created_by_id || '');
  const isRequester = Boolean(
    (rCreatedId && uId && rCreatedId === uId) ||
    (rCreatedBy && uName === rCreatedBy) ||
    (rCreatedEmail && uEmail && uEmail === rCreatedEmail)
  );

  const isSelectedClosed = String(selectedRequest?.status || '').toUpperCase() === 'CLOSED';
  const isSelectedOpen = String(selectedRequest?.status || '').toUpperCase() === 'OPEN';

  // Check if closer details have already been submitted once
  // When status is 'OPEN' (new request or reassigned), closer can view/edit values and submit once.
  // When status is 'IN_PROGRESS' or 'CLOSED' or 'APPROVAL_PENDING', closer updates are locked for non-admins.
  const hasCloserSubmitted = Boolean(
    selectedRequest && !isSelectedOpen && (
      String(selectedRequest.status || '').toUpperCase() === 'IN_PROGRESS' ||
      String(selectedRequest.status || '').toUpperCase() === 'CLOSED' ||
      String(selectedRequest.status || '').toUpperCase() === 'APPROVAL_PENDING' ||
      String(selectedRequest.status || '').toUpperCase() === 'AWAITING_REVIEW' ||
      String(selectedRequest.status || '').toUpperCase() === 'AWAITING REVIEW'
    )
  );

  // Closer fields data is still to be updated for the selected request
  const isCloserDataToBeUpdated = Boolean(selectedRequest && (isSelectedOpen || !hasCloserSubmitted));

  // Admin Edit Mode for Closer Fields: Toggled via Pencil Icon
  const [adminEditCloser, setAdminEditCloser] = useState(false);

  // 1. Closer Fields (Occurrence Cause 5-Why: W1-W5, Action, Evidence Attachment, Target Date):
  //    - Assigned closer person can submit once while request is open/in-progress.
  //    - Quality Admin can click the Pencil icon to unlock, edit, and update closer fields anytime.
  const canUpdateCloserFields = Boolean(
    selectedRequest && (
      (isAdmin && adminEditCloser) ||
      (!isAdmin && isCloser && !hasCloserSubmitted && !isSelectedClosed)
    )
  );

  // 2. Admin Only Fields (Remarks, Status):
  //    Strictly for Admins only. Hidden for regular users.
  const canUpdateAdminFields = Boolean(
    selectedRequest && isAdmin
  );

  const isLockedForCloserUser = !isAdmin && (isSelectedClosed || hasCloserSubmitted);

  // Reassign Closer is disabled when no request is selected, or closed, or editing
  const isReassignDisabled = Boolean(
    !selectedRequest || isSelectedClosed || adminEditCloser
  );

  // Form State for Closer Fields
  const [closerWhyWhy, setCloserWhyWhy] = useState(['', '', '', '', '']);
  const [closerWhyErrors, setCloserWhyErrors] = useState({ w1: false, w2: false, w3: false });
  const closerW1Error = closerWhyErrors.w1;
  const [closerAction, setCloserAction] = useState('');
  const [closerActionError, setCloserActionError] = useState(false);
  const [closerTargetDate, setCloserTargetDate] = useState('');
  const [closerTargetDateError, setCloserTargetDateError] = useState(false);
  const [closerTemporaryClosedBy, setCloserTemporaryClosedBy] = useState('');
  const [closerTemporaryClosedByError, setCloserTemporaryClosedByError] = useState(false);
  const [closerPermanentFix, setCloserPermanentFix] = useState('');
  const [closerPermanentFixError, setCloserPermanentFixError] = useState(false);
  const [existingPermanentEvidence, setExistingPermanentEvidence] = useState([]);
  const [newPermanentEvidenceFiles, setNewPermanentEvidenceFiles] = useState([]);
  const [closerPermanentEvidenceError, setCloserPermanentEvidenceError] = useState(false);
  const [closerPermanentTargetDate, setCloserPermanentTargetDate] = useState('');
  const [closerPermanentTargetDateError, setCloserPermanentTargetDateError] = useState(false);
  const [closerPermanentClosedBy, setCloserPermanentClosedBy] = useState('');
  const [closerPermanentClosedByError, setCloserPermanentClosedByError] = useState(false);
  const fileInputPermanentRef = useRef(null);
  const todayStr = (() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  })();
  const [closerRemarks, setCloserRemarks] = useState('');
  const [remarksError, setRemarksError] = useState(false);
  const [reviewedBy, setReviewedBy] = useState('');
  const [reviewedByError, setReviewedByError] = useState(false);
  const [closerStatus, setCloserStatus] = useState('');
  const [statusError, setStatusError] = useState(false);
  const [isReassignOpen, setIsReassignOpen] = useState(false);
  const [reassignedDept, setReassignedDept] = useState('');
  const [reassignDeptError, setReassignDeptError] = useState(false);
  const [reassignedPerson, setReassignedPerson] = useState('');
  const [reassignPersonError, setReassignPersonError] = useState(false);
  const [isReassignUserDropdownOpen, setIsReassignUserDropdownOpen] = useState(false);
  const [reassignUserSearch, setReassignUserSearch] = useState('');
  const reassignUserDropdownRef = useRef(null);
  const [dbUsers, setDbUsers] = useState([]);
  const [existingEvidence, setExistingEvidence] = useState([]);
  const [newEvidenceFiles, setNewEvidenceFiles] = useState([]);
  const [closerEvidenceError, setCloserEvidenceError] = useState(false);
  const [annotatingItem, setAnnotatingItem] = useState(null);
  const [isSavingCloser, setIsSavingCloser] = useState(false);
  const [isSavingAdmin, setIsSavingAdmin] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Pagination State (matching Image 2)
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  // Export State
  const [showExportModal, setShowExportModal] = useState(false);

  const fileInputRef = useRef(null);

  // Fetch users for department-based reassignment
  useEffect(() => {
    let isMounted = true;
    ihlrService.getUsers()
      .then((users) => {
        if (isMounted && Array.isArray(users)) {
          setDbUsers(users);
        }
      })
      .catch((err) => console.warn('Could not fetch DB users in Approvals:', err));

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

  const getLoggedInUserName = () => {
    return (
      user?.name ||
      (() => {
        try {
          const u = sessionStorage.getItem('todo_user') || localStorage.getItem('todo_user');
          return u ? JSON.parse(u)?.name : '';
        } catch {
          return '';
        }
      })() ||
      user?.email ||
      'Quality Admin'
    );
  };

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

  const handleSelectAllReassignUsers = () => {
    const deptUsers = getDepartmentUsers(reassignedDept).map((u) => u.name);
    setReassignedPerson(deptUsers.join(', '));
    if (deptUsers.length > 0) {
      setReassignPersonError(false);
    }
  };

  const handleClearAllReassignUsers = () => {
    setReassignedPerson('');
  };

  const handleDeptChange = (newDept) => {
    setReassignedDept(newDept);
    if (newDept) {
      setReassignDeptError(false);
    }
    // Keep selected users who belong to the new department
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

  // Reset and clear all Closer and Admin form fields
  const clearForm = () => {
    setSelectedRequest(null);
    setAdminEditCloser(false);
    setCloserWhyWhy(['', '', '', '', '']);
    setCloserWhyErrors({ w1: false, w2: false, w3: false });
    setCloserAction('');
    setCloserActionError(false);
    setCloserTargetDate('');
    setCloserTargetDateError(false);
    setCloserTemporaryClosedBy('');
    setCloserTemporaryClosedByError(false);
    setCloserPermanentFix('');
    setCloserPermanentFixError(false);
    setExistingPermanentEvidence([]);
    setNewPermanentEvidenceFiles([]);
    setCloserPermanentEvidenceError(false);
    setCloserPermanentTargetDate('');
    setCloserPermanentTargetDateError(false);
    setCloserPermanentClosedBy('');
    setCloserPermanentClosedByError(false);
    setCloserRemarks('');
    setRemarksError(false);
    setReviewedBy('');
    setReviewedByError(false);
    setCloserStatus('');
    setStatusError(false);
    setReassignedDept('');
    setReassignedPerson('');
    setReassignDeptError(false);
    setReassignPersonError(false);
    setIsReassignOpen(false);
    setIsReassignUserDropdownOpen(false);
    setReassignUserSearch('');
    setExistingEvidence([]);
    setNewEvidenceFiles([]);
    setCloserEvidenceError(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (fileInputPermanentRef.current) fileInputPermanentRef.current.value = '';
  };

  // Populate Closer form fields when a row is clicked
  const populateForm = (req, keepEditMode = false) => {
    if (!req) {
      clearForm();
      return;
    }
    setSelectedRequest(req);
    if (!keepEditMode) {
      setAdminEditCloser(false);
    }
    setSuccessMessage('');
    setErrorMessage('');

    // 5-Why Occurrence Cause
    const whyArray = Array.isArray(req.prod_why_why) ? req.prod_why_why : [];
    const paddedWhys = [
      whyArray[0] || '',
      whyArray[1] || '',
      whyArray[2] || '',
      whyArray[3] || '',
      whyArray[4] || ''
    ];
    setCloserWhyWhy(paddedWhys);
    setCloserWhyErrors({ w1: false, w2: false, w3: false });

    setCloserAction(req.temporary_action || '');
    setCloserActionError(false);
    setCloserTargetDate(req.temporary_target_date ? req.temporary_target_date.split('T')[0] : '');
    setCloserTargetDateError(false);
    setCloserTemporaryClosedBy(req.temporary_closed_by || '');
    setCloserTemporaryClosedByError(false);
    setCloserPermanentFix(req.permanent_fix || '');
    setCloserPermanentFixError(false);
    setCloserPermanentTargetDate(req.permanent_target_date ? req.permanent_target_date.split('T')[0] : '');
    setCloserPermanentTargetDateError(false);
    setCloserPermanentClosedBy(req.permanent_closed_by || '');
    setCloserPermanentClosedByError(false);
    const historyInfo = formatReassignmentHistory(req.reassignment_history);
    const latestReassign = historyInfo.list && historyInfo.list.length > 0 ? historyInfo.list[historyInfo.list.length - 1] : null;

    setCloserRemarks(req.remarks || latestReassign?.remarks || '');
    setRemarksError(false);
    setReviewedBy(req.reviewed_by || latestReassign?.reassigned_by || '');
    setReviewedByError(false);
    setCloserStatus(req.status === 'CLOSED' ? 'CLOSED' : '');
    setStatusError(false);
    setReassignedDept(req.resp || '');
    setReassignedPerson(req.resp_person || '');
    setIsReassignOpen(false);
    setIsReassignUserDropdownOpen(false);
    setReassignUserSearch('');

    // Evidence attachments
    const existing = parseAttachments(req.temporary_evidence_attachment);
    setExistingEvidence(existing);
    setNewEvidenceFiles([]);
    setCloserEvidenceError(false);

    // Permanent Fix Evidence attachments
    const existingPerm = parseAttachments(req.permanent_evidence_attachment);
    setExistingPermanentEvidence(existingPerm);
    setNewPermanentEvidenceFiles([]);
    setCloserPermanentEvidenceError(false);
  };

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const data = await ihlrService.getRequests();
      // Filter out CLOSED requests: once closed they should not be shown in the approvals tab
      const nonClosedData = (Array.isArray(data) ? data : []).filter(
        (r) => String(r.status || '').toUpperCase() !== 'CLOSED'
      );
      // Enforce that closer non-admins only see requests where they are the selected person (resp_person) or creator
      const visibleData = isAdmin ? nonClosedData : nonClosedData.filter((r) => isIhlrRequestVisibleToUser(r, user));
      setRequests(visibleData);

      // Check if a specific request was targeted via navigation (e.g. from Notifications Centre)
      const targetReqNo = location.state?.highlightReq || location.state?.search;
      let matchedTarget = null;
      if (targetReqNo) {
        const cleanTarget = String(targetReqNo).trim().toLowerCase().replace(/^#/, '');
        matchedTarget = visibleData.find((r) => {
          const cleanReq = String(r.req_no || '').trim().toLowerCase().replace(/^#/, '');
          return cleanReq === cleanTarget || cleanReq === `ihlr-${cleanTarget}` || String(r.id) === cleanTarget;
        });
      }

      // If a targeted request was found, populate it immediately
      if (matchedTarget) {
        populateForm(matchedTarget);
      } else if (selectedRequest) {
        const fresh = visibleData.find((r) => r.id === selectedRequest.id);
        if (fresh) {
          populateForm(fresh, adminEditCloser);
        } else {
          clearForm();
        }
      } else {
        clearForm();
      }
    } catch (err) {
      console.error('Failed to load IHLR requests for approval:', err);
    } finally {
      setLoading(false);
    }
  };

  // Ensure that whenever there is no selected request, all form fields are reset
  useEffect(() => {
    if (!selectedRequest) {
      clearForm();
    }
  }, [selectedRequest]);

  useEffect(() => {
    if (location.state?.search) {
      setSearch(location.state.search);
    }
  }, [location.state?.search]);

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
  }, [user?.name, user?.email, user?.role, user?.department]);

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

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const added = Array.from(e.target.files);
      setNewEvidenceFiles((prev) => [...prev, ...added]);
      setCloserEvidenceError(false);
      e.target.value = '';
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
      e.target.value = '';
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
      setCloserEvidenceError(false);
    }
    setAnnotatingItem(null);
    const shortName = annotatedFile?.name && annotatedFile.name.length > 28
      ? `${annotatedFile.name.slice(0, 24)}...png`
      : (annotatedFile?.name || 'drawing');
    modalSuccess(`Annotated drawing "${shortName}" updated! Remember to click "Submit Closer Log" to save.`);
  };

  // 1. Submit Closer Updates (5-Why causes, Action, Evidence, Target Date)
  const handleSaveCloser = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!selectedRequest) return;

    if (isLockedForCloserUser) {
      if (isSelectedClosed) {
        modalError('This incident is closed. Only Admin can update closed reports.');
      } else {
        modalWarning('Closer details have already been submitted once for this report. Only Quality Admin has permission to make multiple updates.');
      }
      return;
    }

    if (!canUpdateCloserFields && !isAdmin) {
      modalError('You do not have permission to update fields on this request.');
      return;
    }

    // Closer Field Validations (Occurrence Causes W1, W2, and W3 are mandatory for both Admin and User)
    let hasCloserErrors = false;
    const whyErrors = {
      w1: !closerWhyWhy[0] || !closerWhyWhy[0].trim(),
      w2: !closerWhyWhy[1] || !closerWhyWhy[1].trim(),
      w3: !closerWhyWhy[2] || !closerWhyWhy[2].trim()
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
      setCloserEvidenceError('Temporary Evidence Attachment is required. Please attach at least one file.');
      hasCloserErrors = true;
    } else {
      setCloserEvidenceError(false);
    }

    const todayStr = (() => {
      const d = new Date();
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    })();

    // 3. Temporary Target Date is mandatory (allows past, present, and future dates)
    if (!closerTargetDate || !closerTargetDate.trim()) {
      setCloserTargetDateError('Temporary Target Date is required.');
      hasCloserErrors = true;
    } else {
      setCloserTargetDateError(false);
    }

    // 4. Temporary Closed By is mandatory (text-only)
    if (!closerTemporaryClosedBy || !closerTemporaryClosedBy.trim()) {
      setCloserTemporaryClosedByError('Temporary Closed By is required. Please enter person name.');
      hasCloserErrors = true;
    } else if (/\d/.test(closerTemporaryClosedBy)) {
      setCloserTemporaryClosedByError('Temporary Closed By must contain text only, numbers are not allowed');
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

    // 7. Permanent Target Date is mandatory (allows past, present, and future dates >= Temporary Target Date)
    if (!closerPermanentTargetDate || !closerPermanentTargetDate.trim()) {
      setCloserPermanentTargetDateError('Permanent Target Date is required.');
      hasCloserErrors = true;
    } else if (closerTargetDate && closerPermanentTargetDate < closerTargetDate) {
      setCloserPermanentTargetDateError(`Permanent Target Date cannot be before Temporary Target Date (${formatDateDDMMYYYY(closerTargetDate)}).`);
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
      return; // DO NOT TRIGGER BACKEND!
    }

    setIsSavingCloser(true);
    setSuccessMessage('');
    setErrorMessage('');

    try {
      let uploadedList = [];
      if (newEvidenceFiles.length > 0) {
        uploadedList = await ihlrService.uploadAttachments(newEvidenceFiles);
      }
      const combinedEvidence = [...existingEvidence, ...uploadedList];

      let uploadedPermList = [];
      if (newPermanentEvidenceFiles.length > 0) {
        uploadedPermList = await ihlrService.uploadAttachments(newPermanentEvidenceFiles);
      }
      const combinedPermEvidence = [...existingPermanentEvidence, ...uploadedPermList];

      const effectiveTempClosedBy = (closerTemporaryClosedBy && closerTemporaryClosedBy.trim())
        ? closerTemporaryClosedBy.trim()
        : '';

      const effectivePermClosedBy = (closerPermanentClosedBy && closerPermanentClosedBy.trim())
        ? closerPermanentClosedBy.trim()
        : '';

      const payload = {
        prod_why_why: closerWhyWhy,
        temporary_action: closerAction || '',
        temporary_evidence_attachment: JSON.stringify(combinedEvidence),
        temporary_target_date: closerTargetDate || null,
        temporary_closed_by: effectiveTempClosedBy || null,
        permanent_fix: closerPermanentFix || '',
        permanent_evidence_attachment: JSON.stringify(combinedPermEvidence),
        permanent_target_date: closerPermanentTargetDate || null,
        permanent_closed_by: effectivePermClosedBy || null,
        closer_updated_by: user?.name || effectiveTempClosedBy || effectivePermClosedBy,
        closer_updated_by_id: user?.id || null,
        closer_updated_by_email: user?.email || null
      };

      // When closer (non-admin) updates their fields, automatically set status to IN_PROGRESS unless already CLOSED
      if (!isAdmin && (selectedRequest.status || '').toUpperCase() !== 'CLOSED') {
        payload.status = 'IN_PROGRESS';
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

      const updated = await ihlrService.updateRequest(selectedRequest.id, payload);

      if (!updated) {
        throw new Error(`Failed to update closer fields: No response from server for #${selectedRequest.req_no || selectedRequest.id}`);
      }

      const msg = isAdmin
        ? `Closer 5-Why analysis & corrective action updated successfully for ${selectedRequest.req_no}!`
        : `Closer details submitted successfully for ${selectedRequest.req_no}! Quality Admin will review and sign off status.`;

      setSuccessMessage(msg);
      setNewEvidenceFiles([]);
      if (updated) {
        populateForm(updated, false);
      }
      setAdminEditCloser(false);
      await fetchRequests();
      window.dispatchEvent(new Event('refreshNotifications'));
      modalSuccess(msg);

      setTimeout(() => {
        setSuccessMessage('');
      }, 4000);
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

    if (adminEditCloser) {
      modalWarning('Admin Sign-Off is disabled while editing closer fields. Please save or cancel closer log updates first.');
      return;
    }

    if (!isAdmin) {
      modalError('Only Quality Admin has permission to update Admin Review and sign off status.');
      return;
    }

    if (!isReassignOpen && (!closerRemarks || !closerRemarks.trim())) {
      setRemarksError(true);
      return; // DO NOT TRIGGER BACKEND!
    }
    setRemarksError(false);

    if (reviewedBy && /\d/.test(reviewedBy)) {
      setReviewedByError('Reviewed By must contain text only, numbers are not allowed');
      return; // DO NOT TRIGGER BACKEND!
    }
    setReviewedByError(false);

    if (!isReassignOpen && !closerStatus) {
      setStatusError(true);
      return; // DO NOT TRIGGER BACKEND!
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
      if (reassignHasErr) return; // DO NOT TRIGGER BACKEND!
    }

    setIsSavingAdmin(true);
    setSuccessMessage('');
    setErrorMessage('');

    try {
      const effectiveReviewer = (reviewedBy && reviewedBy.trim())
        ? reviewedBy.trim()
        : getLoggedInUserName();

      const effectiveRemarks = (closerRemarks && closerRemarks.trim())
        ? closerRemarks.trim()
        : isReassignOpen
        ? `Reassigned to ${reassignedPerson} (${reassignedDept}) for analysis by ${effectiveReviewer}.`
        : '';

      const payload = {
        remarks: effectiveRemarks,
        reviewed_by: effectiveReviewer,
        reviewed_by_id: user?.id || null,
        reviewed_by_email: user?.email || null,
        status: isReassignOpen ? 'OPEN' : (closerStatus || 'CLOSED')
      };

      if (isReassignOpen) {
        payload.is_reassign = true;
        payload.reassigned_by = effectiveReviewer;
        payload.reassign_remarks = effectiveRemarks;

        if (reassignedDept) {
          payload.resp = reassignedDept;
        }
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

      const updated = await ihlrService.updateRequest(selectedRequest.id, payload);

      if (!updated) {
        throw new Error(`Failed to update request: No response from server for #${selectedRequest.req_no || selectedRequest.id}`);
      }

      const isReassigned = isReassignOpen && (
        (reassignedPerson && reassignedPerson !== selectedRequest.resp_person) ||
        (reassignedDept && reassignedDept !== selectedRequest.resp)
      );

      const msg = isReassigned
        ? `Report status updated & reassigned to ${reassignedPerson} (${reassignedDept}) successfully for ${selectedRequest.req_no}!`
        : `Admin remarks & status sign-off updated successfully for ${selectedRequest.req_no}!`;

      setSuccessMessage(msg);
      setIsReassignOpen(false);
      setIsReassignUserDropdownOpen(false);
      setReassignUserSearch('');
      if (updated && String(updated.status || '').toUpperCase() !== 'CLOSED') {
        populateForm(updated);
      } else {
        clearForm();
        const normalizeReq = (str) => String(str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const normClosed = normalizeReq(selectedRequest?.req_no);
        const normSearch = normalizeReq(search);
        const normId = String(selectedRequest?.id || '');
        const isSearchTargetingClosed = Boolean(
          normSearch && (
            normSearch === normClosed ||
            normSearch === normId ||
            normSearch === `ihlr${normId}` ||
            (normClosed && (normClosed.includes(normSearch) || normSearch.includes(normClosed)))
          )
        );
        if (isSearchTargetingClosed) {
          setSearch('');
          navigate(location.pathname, { replace: true, state: {} });
        }
      }
      setAdminEditCloser(false);
      await fetchRequests();
      modalSuccess(msg);

      setTimeout(() => {
        setSuccessMessage('');
      }, 4000);
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
    // Restrict visibility for closer non-admins strictly to their assigned requests (or created)
    if (!isAdmin && !isIhlrRequestVisibleToUser(r, user)) return false;

    // Never show CLOSED requests in approvals tab
    if (String(r.status || '').toUpperCase() === 'CLOSED') return false;

    const isReqOpen = String(r.status || '').toUpperCase() === 'OPEN';
    const isCompleted = !isReqOpen && (
      String(r.status || '').toUpperCase() === 'IN_PROGRESS' ||
      String(r.status || '').toUpperCase() === 'APPROVAL_PENDING' ||
      String(r.status || '').toUpperCase() === 'AWAITING_REVIEW' ||
      String(r.status || '').toUpperCase() === 'AWAITING REVIEW' || (
        Boolean((r.temporary_action || r.permanent_fix) && String(r.temporary_action || r.permanent_fix).trim()) &&
        Boolean(r.temporary_target_date || r.permanent_target_date) &&
        (Array.isArray(r.prod_why_why) && r.prod_why_why.some(w => Boolean(w && String(w).trim())))
      )
    );

    const matchesSearch =
      (r.req_no || '').toLowerCase().includes(search.toLowerCase()) ||
      (r.problem || '').toLowerCase().includes(search.toLowerCase()) ||
      (r.model || '').toLowerCase().includes(search.toLowerCase()) ||
      (r.received_from || '').toLowerCase().includes(search.toLowerCase()) ||
      (r.remarks || '').toLowerCase().includes(search.toLowerCase()) ||
      (r.analysis_done_by || '').toLowerCase().includes(search.toLowerCase()) ||
      (r.resp_person || '').toLowerCase().includes(search.toLowerCase());

    const matchesStatus =
      selectedStatus === 'All' ||
      (selectedStatus === 'IN_PROGRESS' && isCompleted) ||
      (selectedStatus === 'OPEN' && !isCompleted);
    return matchesSearch && matchesStatus;
  });

  // Auto-synchronize selection with filtered requests
  useEffect(() => {
    if (loading) return;
    if (filtered.length === 0) {
      clearForm();
    } else if (selectedRequest) {
      const stillInFiltered = filtered.find((r) => r.id === selectedRequest.id);
      if (stillInFiltered) {
        if (
          stillInFiltered.status !== selectedRequest.status ||
          stillInFiltered.resp_person !== selectedRequest.resp_person ||
          stillInFiltered.remarks !== selectedRequest.remarks ||
          stillInFiltered.temporary_action !== selectedRequest.temporary_action ||
          stillInFiltered.permanent_fix !== selectedRequest.permanent_fix
        ) {
          populateForm(stillInFiltered, adminEditCloser);
        }
      } else {
        populateForm(filtered[0]);
      }
    } else {
      populateForm(filtered[0]);
    }
  }, [requests, search, selectedStatus, loading]);

  // Pagination calculation
  const totalRecords = filtered.length;
  const totalPages = Math.ceil(totalRecords / rowsPerPage) || 1;
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = Math.min(startIndex + rowsPerPage, totalRecords);
  const paginatedRequests = filtered.slice(startIndex, endIndex);

  // Open Export Modal with validation check
  const handleOpenExportModal = () => {
    if (!filtered || filtered.length === 0) {
      modalWarning('No data available to export. Please adjust your search or status filter.', 'No Data Available');
      return;
    }
    setShowExportModal(true);
  };

  // Export to Excel (.xlsx) using common IHLR export utility
  const handleExportExcel = async () => {
    try {
      if (!filtered || filtered.length === 0) {
        modalWarning('No data available to export. Cannot download an empty file.', 'No Data Available');
        setShowExportModal(false);
        return;
      }
      const today = new Date().toISOString().slice(0, 10);
      await exportIhlrToExcel({
        requests: filtered,
        fileName: `IHLR_Approvals_Queue_${today}.xlsx`,
        sheetName: 'IHLR Approvals Queue'
      });
      setShowExportModal(false);
    } catch (err) {
      console.error('Failed to export to Excel:', err);
      modalError('Failed to export to Excel: ' + err.message);
    }
  };

  // Export to PDF (.pdf) using common IHLR export utility
  const handleExportPdf = async () => {
    try {
      if (!filtered || filtered.length === 0) {
        modalWarning('No data available to export. Cannot download an empty file.', 'No Data Available');
        setShowExportModal(false);
        return;
      }
      const today = new Date().toISOString().slice(0, 10);
      await exportIhlrToPdf({
        requests: filtered,
        fileName: `IHLR_Approvals_Queue_${today}.pdf`,
        title: 'IHLR Sign-off & Closer Approvals Queue',
        filterText: `Status Filter: ${selectedStatus}`
      });
      setShowExportModal(false);
    } catch (err) {
      console.error('Failed to export approvals to PDF:', err);
      modalError('Failed to export to PDF: ' + err.message);
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
      file: f
    };
  });

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
      file: f
    };
  });

  return (
    <div className="space-y-6 w-full pb-16">
      {/* Top Header & Breadcrumbs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
            <span className="text-blue-600 font-bold uppercase tracking-wider font-mono">IHLR REPOSITORY</span>
            <span>/</span>
            <span>Approvals &amp; Closer Management</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {isAdmin ? 'IHLR Approvals & Closer Log' : 'My Approvals & Closer Log'}
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
              ? 'Update 5-Why occurrence causes, corrective actions, evidence attachments, and sign off incident closures.'
              : `Review and submit 5-Why root cause and corrective actions for requests assigned to you (${user?.name || user?.email}).`}
          </p>
        </div>
      </div>

      {/* Main Two-Column Split Layout (Matching Reference Image 2) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* ============================================================== */}
        {/* LEFT COLUMN: Update Closer Log Form (Fields from Image 1)       */}
        {/* ============================================================== */}
        <div className="lg:col-span-5 xl:col-span-4 bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 sm:p-6 space-y-5 sticky top-4">
          
          {/* Card Title */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-2xs">
                <FileCheck className="w-4 h-4" />
              </div>
              <h2 className="text-sm font-bold text-slate-900">
                Update Closer Log
              </h2>
            </div>
            {selectedRequest && (
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md font-mono text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                  {String(selectedRequest.req_no).startsWith('IHLR-') ? selectedRequest.req_no : `#${selectedRequest.req_no}`}
                </span>
              </div>
            )}
          </div>

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
            
            {/* 1. Request Reference Fields (Disabled grey boxes, as in Image 2) */}
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  IHLR REQ NO <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  readOnly
                  disabled
                  value={selectedRequest ? (String(selectedRequest.req_no).startsWith('IHLR-') ? selectedRequest.req_no : `#${selectedRequest.req_no}`) : ''}
                  placeholder="Click a row on the right to select"
                  className="w-full px-3.5 py-2.5 bg-slate-100/80 border border-slate-200 rounded-xl text-slate-700 font-semibold cursor-not-allowed select-none outline-none"
                />
              </div>
            </div>

            {/* Separator */}
            <div className="pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-black uppercase tracking-wider text-amber-700 flex items-center gap-1.5">
                    <span>Occurrence Cause (Production Team - 5 Why)</span>
                    {selectedRequest && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-200">
                        Closer
                      </span>
                    )}
                  </span>
                </div>
              </div>

              {/* Admin Edit Mode Alert Banner */}
              {isAdmin && selectedRequest && adminEditCloser && (
                <div className="mb-2.5 p-2 px-3 rounded-lg bg-amber-50/90 border border-amber-200/90 text-amber-900 text-xs flex items-center justify-between animate-in fade-in">
                  <div className="flex items-center gap-1.5">
                    <Pencil className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span className="text-[11px] font-semibold">Admin Edit Active: Closer fields unlocked for editing.</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAdminEditCloser(false)}
                    className="text-[10px] font-bold text-amber-700 hover:text-amber-900 underline cursor-pointer shrink-0 ml-2"
                  >
                    Lock
                  </button>
                </div>
              )}

              {/* 5-Whys Stacked Inputs (Image 1: W1 to W5) */}
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
                              : 'Read-only (Closer only)'
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
                          <span>* Why ${idx + 1} (${label}) is mandatory. Please enter occurrence cause.</span>
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Temporary Action Field (Image 1: Action Words) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <span>TEMPORARY ACTION</span>
                  <span className="text-rose-500 font-bold">*</span>
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
                    : 'Read-only (Closer only)'
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

            {/* Temporary Evidence Attachment (Image 1: Format PPT, JPEG, EXCEL & PDF) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <span>TEMPORARY EVIDENCE ATTACHMENT</span>
                  <span className="text-rose-500 font-bold">*</span>
                  {selectedRequest && (
                    canUpdateCloserFields ? (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-200">
                        {isAdmin ? 'Admin Edit' : 'Closer'}
                      </span>
                    ) : (
                      <span className="text-[9px] font-medium px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded border border-slate-200">
                        {isAdmin ? 'Locked (Click Pencil to Edit)' : 'Closer Only (Read-Only)'}
                      </span>
                    )
                  )}
                </label>
                <span className="text-[10px] text-slate-400 font-mono">PPT, JPEG, EXCEL &amp; PDF</span>
              </div>

              {/* Styled File Input Button (matching Image 2) */}
              <div className={`flex items-center gap-2 p-1 rounded-xl transition ${
                closerEvidenceError ? 'border border-rose-400 bg-rose-50/20 ring-1 ring-rose-400/30' : ''
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
              {closerEvidenceError && (
                <p className="text-[11px] text-rose-500 font-semibold mt-1 flex items-center gap-1">
                  <span>* {closerEvidenceError}</span>
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
                  />
                )}
                {previewableNewFiles.length > 0 && (
                  <AttachmentChipList
                    attachments={previewableNewFiles}
                    onPreview={(att) => setSelectedPreviewAttachment(att)}
                    onAnnotate={canUpdateCloserFields ? (file, idx) => setAnnotatingItem({ attachment: file, index: idx, isExisting: false, isPermanent: false }) : undefined}
                    onRemove={canUpdateCloserFields ? (idx) => handleRemoveNewEvidence(idx) : undefined}
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
                  {selectedRequest && (
                    canUpdateCloserFields ? (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-200">
                        {isAdmin ? 'Admin Edit' : 'Closer'}
                      </span>
                    ) : (
                      <span className="text-[9px] font-medium px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded border border-slate-200">
                        {isAdmin ? 'Locked (Click Pencil to Edit)' : 'Closer Only (Read-Only)'}
                      </span>
                    )
                  )}
                </label>
              </div>
              <DateInput
                disabled={!canUpdateCloserFields}
                value={closerTargetDate}
                onChange={(e) => {
                  const val = e.target.value;
                  setCloserTargetDate(val);
                  if (!val || !val.trim()) {
                    setCloserTargetDateError('Temporary Target Date is required.');
                  } else {
                    setCloserTargetDateError(false);
                  }

                  if (val && closerPermanentTargetDate && closerPermanentTargetDate < val) {
                    setCloserPermanentTargetDateError(`Permanent Target Date cannot be before Temporary Target Date (${formatDateDDMMYYYY(val)}).`);
                  } else if (closerPermanentTargetDate) {
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

            {/* Temporary Closed By (TEM CLOSED BY) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <span>TEMPORARY CLOSED BY</span>
                  <span className="text-rose-500 font-bold">*</span>
                  {selectedRequest && (
                    canUpdateCloserFields ? (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-200">
                        {isAdmin ? 'Admin Edit' : 'Closer'}
                      </span>
                    ) : (
                      <span className="text-[9px] font-medium px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded border border-slate-200">
                        {isAdmin ? 'Locked (Click Pencil to Edit)' : 'Closer Only (Read-Only)'}
                      </span>
                    )
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
                    : 'Read-only (Closer only)'
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
                    setCloserTemporaryClosedByError('Temporary Closed By is required. Please enter person name.');
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

            {/* 1. Permanent Action */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <span>PERMANENT ACTION</span>
                  <span className="text-rose-500 font-bold">*</span>
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
                    : 'Read-only (Closer only)'
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

            {/* 2. Permanent Fix Evidence Attachment */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <span>PERMANENT EVIDENCE ATTACHMENT</span>
                  <span className="text-rose-500 font-bold">*</span>
                  {selectedRequest && (
                    canUpdateCloserFields ? (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-200">
                        {isAdmin ? 'Admin Edit' : 'Closer'}
                      </span>
                    ) : (
                      <span className="text-[9px] font-medium px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded border border-slate-200">
                        {isAdmin ? 'Locked (Click Pencil to Edit)' : 'Closer Only (Read-Only)'}
                      </span>
                    )
                  )}
                </label>
                <span className="text-[10px] text-slate-400 font-mono">PPT, JPEG, EXCEL &amp; PDF</span>
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
                  />
                )}
                {previewableNewPermanentFiles.length > 0 && (
                  <AttachmentChipList
                    attachments={previewableNewPermanentFiles}
                    onPreview={(att) => setSelectedPreviewAttachment(att)}
                    onAnnotate={canUpdateCloserFields ? (file, idx) => setAnnotatingItem({ attachment: file, index: idx, isExisting: false, isPermanent: true }) : undefined}
                    onRemove={canUpdateCloserFields ? (idx) => handleRemoveNewPermanentEvidence(idx) : undefined}
                  />
                )}
              </div>
            </div>

            {/* 3. Permanent Fix Target Date */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <span>PERMANENT TARGET DATE</span>
                  <span className="text-rose-500 font-bold">*</span>
                  {selectedRequest && (
                    canUpdateCloserFields ? (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-200">
                        {isAdmin ? 'Admin Edit' : 'Closer'}
                      </span>
                    ) : (
                      <span className="text-[9px] font-medium px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded border border-slate-200">
                        {isAdmin ? 'Locked (Click Pencil to Edit)' : 'Closer Only (Read-Only)'}
                      </span>
                    )
                  )}
                </label>
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
                    setCloserPermanentTargetDateError(`Permanent Target Date cannot be before Temporary Target Date (${formatDateDDMMYYYY(closerTargetDate)}).`);
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
                  <span>* {typeof closerPermanentTargetDateError === 'string' ? closerPermanentTargetDateError : 'Permanent Target Date cannot be before Temporary Target Date.'}</span>
                </p>
              )}
            </div>

            {/* Permanent Closed By (PERM CLOSED BY) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <span>PERMANENT CLOSED BY</span>
                  <span className="text-rose-500 font-bold">*</span>
                  {selectedRequest && (
                    canUpdateCloserFields ? (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-200">
                        {isAdmin ? 'Admin Edit' : 'Closer'}
                      </span>
                    ) : (
                      <span className="text-[9px] font-medium px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded border border-slate-200">
                        {isAdmin ? 'Locked (Click Pencil to Edit)' : 'Closer Only (Read-Only)'}
                      </span>
                    )
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
                    : 'Read-only (Closer only)'
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
                  Person executing permanent corrective action countermeasure.
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
                  <span>Read Only Access — Assigned Closer or Admin Only</span>
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
                      <span>Submit Closer Log (5-Why &amp; Temporary Action)</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Remarks, Status & Reassign - ONLY FOR ADMINS */}
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
                      <span className="font-bold">Closer Submission: </span>
                      <span className="text-amber-800">
                        {isSelectedOpen ? 'Closer submission pending. Admin can review, edit, or sign off status.' : 'Closer details submitted.'}
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
                              {selectedRequest ? (selectedRequest.resp_person || 'Not Assigned') : 'No Request Selected'}
                            </strong> ({selectedRequest?.resp || 'N/A'})
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
                          setReassignedDept(selectedRequest?.resp || '');
                          setReassignedPerson(selectedRequest?.resp_person || '');
                          setCloserStatus('OPEN');
                        }}
                        title={
                          !selectedRequest
                            ? 'Select a request first to reassign closer'
                            : isSelectedClosed
                            ? 'Incident closed — closer cannot be reassigned'
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
                            setReassignedDept(selectedRequest?.resp || '');
                            setReassignedPerson(selectedRequest?.resp_person || '');
                            setCloserStatus('');
                            setStatusError(false);
                          }}
                          className="text-[11px] text-slate-500 hover:text-rose-600 font-semibold cursor-pointer underline flex items-center gap-1"
                        >
                          Cancel
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {/* Department (Resp) */}
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                            Department (Resp) *
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
                              User Name (Dep Based) *
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
                                <span className="text-slate-400 font-normal">Select User Name(s)...</span>
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
                              * Please select at least one responsible user to reassign.
                            </p>
                          )}

                          {/* Dropdown Menu */}
                          {isReassignUserDropdownOpen && reassignedDept && getDepartmentUsers(reassignedDept).length > 0 && (
                            <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                              {/* Search Box */}
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
                        Selecting a new department and person will transfer the 5-Why root cause and countermeasure responsibility to them.
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
                    value={closerRemarks || selectedRequest?.remarks || (formatReassignmentHistory(selectedRequest?.reassignment_history)?.list?.slice(-1)[0]?.remarks) || ''}
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
                        ? (closerRemarks || selectedRequest?.remarks ? '' : 'Awaiting closer Temporary Action & Target Date...')
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
                      Closer Temporary Action &amp; Target Date required first.
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

                {/* Reviewed By (Manual entry by admin / quality - Text only, references CreateRequest Created By) */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <span>REVIEWED BY</span>
                      <span className="text-slate-400 font-normal lowercase text-[10px]">(optional)</span>
                      {selectedRequest && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 bg-purple-50 text-purple-700 rounded border border-purple-200">
                          Admin
                        </span>
                      )}
                    </label>
                    <span className="text-[10px] text-slate-400 font-normal truncate max-w-[200px]" title={`Defaults to: ${getLoggedInUserName()}`}>
                      Defaults to: <strong className="text-slate-600 font-semibold">{getLoggedInUserName()}</strong>
                    </span>
                  </div>
                  <input
                    type="text"
                    disabled={!selectedRequest || adminEditCloser || (isCloserDataToBeUpdated && !isReassignOpen)}
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
                      Admin / Quality Engineer reviewing this incident (defaults to logged-in user).
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
                          <span>{isReassignOpen ? 'Reassigning Incident...' : 'Saving Admin Sign-Off...'}</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          <span>{isReassignOpen ? 'Confirm & Reassign Closer' : 'Save Admin Review & Status Sign-Off'}</span>
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
        {/* RIGHT COLUMN: Filter Bar & Table (Matching Reference Image 2)   */}
        {/* ============================================================== */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-4">
          
          {/* Top Filter and Search Bar (Image 2 Top Row) */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
              <input
                type="text"
                placeholder="Search by req no, problem, or remarks..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none font-medium transition"
              />
            </div>

            <div className="w-full sm:w-44">
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-semibold focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
              >
                <option value="All">All Decisions</option>
                <option value="OPEN">Pending</option>
                <option value="IN_PROGRESS">Awaiting Review</option>
              </select>
            </div>

            <button
              onClick={handleOpenExportModal}
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
                  {/* Top Phase Header Row */}
                  <tr className="text-[10px] font-black uppercase tracking-wider text-center border-b border-slate-200">
                    <th colSpan={4} className="py-2 px-3 bg-amber-100 text-amber-900 border-r border-amber-200">
                      REQUESTOR (Defect Investigation &amp; QA 5-Why)
                    </th>
                    <th colSpan={1} className="py-2 px-3 bg-orange-100 text-orange-900 border-r border-orange-200">
                      CLOSER (Production Containment)
                    </th>
                    <th colSpan={3} className="py-2 px-3 bg-slate-100 text-slate-700">
                      REMARKS &amp; STATUS
                    </th>
                  </tr>
                  <tr className="bg-[#f8fafc] border-b border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-500">
                    <th className="py-3 px-3 text-center w-12">SL NO</th>
                    <th className="py-3 px-3">IHLR REQ NO</th>
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
                        <p className="font-semibold text-slate-600">
                          {isAdmin ? 'No requests found matching criteria' : 'No IHLR requests assigned to you found matching criteria'}
                        </p>
                        <p className="text-[11px] text-slate-400 mt-1">
                          {isAdmin ? 'Try clearing filters or search parameters.' : `When a requester assigns a request to ${user?.name || 'you'}, it will appear here.`}
                        </p>
                      </td>
                    </tr>
                  ) : (
                    paginatedRequests.map((r, idx) => {
                      const isSelected = selectedRequest?.id === r.id;
                      return (
                        <tr
                          key={r.id}
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
                            {String(r.req_no).startsWith('IHLR-') ? r.req_no : `#${r.req_no}`}
                          </td>
                          <td className="py-3.5 px-3 whitespace-nowrap text-slate-600 font-mono text-[11px]">
                            {formatDateDDMMYYYY(r.batch_date)}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-slate-900 truncate max-w-[180px]" title={r.problem}>
                              {r.problem}
                            </div>
                            <div className="text-[11px] text-slate-500 truncate max-w-[180px]" title={r.model}>
                              {r.model}
                            </div>
                            {r.resp_person && (
                              <div className="text-[10px] text-slate-500 mt-0.5 truncate max-w-[180px]" title={`Assigned: ${r.resp_person}`}>
                                <span className="font-medium text-slate-400">Assigned: </span>
                                <span className="font-semibold text-slate-700">{r.resp_person}</span>
                              </div>
                            )}
                            {(r.closer_updated_by || r.temporary_closed_by) && (
                              <div className="text-[10px] text-emerald-700 mt-0.5 truncate max-w-[180px]" title={`Updated by: ${r.closer_updated_by || r.temporary_closed_by}`}>
                                <span className="font-medium text-emerald-600">Updated by: </span>
                                <span className="font-bold text-emerald-800">{r.closer_updated_by || r.temporary_closed_by}</span>
                              </div>
                            )}
                          </td>
                          <td className="py-3.5 px-3">
                            <IhlrAttachmentThumbnail
                              rawAttachment={r.temporary_evidence_attachment || r.permanent_evidence_attachment || r.defect_image}
                            />
                          </td>
                          <td className="py-3.5 px-3 text-center whitespace-nowrap">
                            {String(r.status || '').toUpperCase() === 'CLOSED' ? (
                              <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                CLOSED
                              </span>
                            ) : (String(r.status || '').toUpperCase() !== 'OPEN' && (
                              String(r.status || '').toUpperCase() === 'IN_PROGRESS' ||
                              String(r.status || '').toUpperCase() === 'APPROVAL_PENDING' ||
                              String(r.status || '').toUpperCase() === 'AWAITING_REVIEW' ||
                              String(r.status || '').toUpperCase() === 'AWAITING REVIEW' || (
                                Boolean((r.temporary_action || r.permanent_fix) && String(r.temporary_action || r.permanent_fix).trim()) &&
                                Boolean(r.temporary_target_date || r.permanent_target_date) &&
                                (Array.isArray(r.prod_why_why) && r.prod_why_why.some(w => Boolean(w && String(w).trim())))
                              )
                            )) ? (
                              <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                AWAITING REVIEW
                              </span>
                            ) : (
                              <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                PENDING
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-3 text-slate-600 truncate max-w-[150px]" title={r.remarks || '—'}>
                            {r.remarks || '—'}
                          </td>
                          <td className="py-3.5 px-3 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveModalRequest(r);
                                  setModalInitialEdit(false);
                                }}
                                className="p-1 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition cursor-pointer"
                                title="View Full Report"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              {isAdmin && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    populateForm(r, true);
                                    setAdminEditCloser(true);
                                    window.scrollTo({ top: 0, behavior: 'smooth' });
                                  }}
                                  className={`p-1 rounded-md transition cursor-pointer ${
                                    isSelected && adminEditCloser
                                      ? 'text-amber-600 bg-amber-50 ring-1 ring-amber-300'
                                      : 'text-slate-400 hover:text-amber-600 hover:bg-amber-50'
                                  }`}
                                  title="Admin: Edit Closer Fields"
                                >
                                  <Pencil className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls (Matching Reference Image 2 Bottom Row) */}
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

      {/* Comprehensive Report Modal */}
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
          setActiveModalRequest(null);
          setModalInitialEdit(false);
        }}
      />

      {/* Standalone Attachment Preview Modal */}
      <IhlrAttachmentPreviewModal
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

      {/* Technical Drawing & Defect Image Annotation Modal */}
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
        title="Export Approval Queue"
        subtitle="Choose download format for approvals view"
        recordCount={filtered.length}
        excelDescription="Full structured workbook with separate columns for incident details, 5-Why occurrence causes, containment actions, and target dates."
        pdfDescription="Official landscape document formatted with India Nippon Electricals Limited branding, tables, and page numbers."
      />
    </div>
  );
};

export default IhlrApprovals;
