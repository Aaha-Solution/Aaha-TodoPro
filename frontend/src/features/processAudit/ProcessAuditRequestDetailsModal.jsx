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
  History,
  Tag,
  AlertTriangle,
  ArrowRight,
  ArrowRightLeft,
  Loader2,
  Lock,
  Mail
} from 'lucide-react';
import AttachmentChipList from '../../components/common/AttachmentChipList';
import AttachmentPreviewModal from '../../components/common/AttachmentPreviewModal';
import ExportSelectionModal from '../../components/common/ExportSelectionModal';
import { parseAttachments, resolveAttachmentUrl } from '../../components/common/attachmentUtils';
import { exportProcessAuditToExcel, exportProcessAuditToPdf, formatReassignmentHistory, resolveAuditorEmail } from './processAuditExportUtils';
import { useModal } from '../../context/ModalContext';
import { formatDateDDMMYYYY, parseDateToYYYYMMDD } from '../../utils/dateUtils';
import { useAuth } from '../../hooks/useAuth';
import { useScrollLock } from '../../hooks/useScrollLock';
import { processAuditService } from '../../services/processAuditService';

/**
 * Process Audit Request Details & Admin Edit Modal
 * Matches the comprehensive IHLR Rejection Analysis Report modal design:
 * - Direct single-scroll card layout
 * - Separate Tabs:
 *   1. Requester Details (Audit Observation, Process parameters, Creator attachments)
 *   2. Closer Details (Root cause, Corrective actions, Standardization, Evidence,  Sign-off)
 * - Full Admin/Requester EDIT MODE:
 *   Allows modifying both Requester parameters & Closer execution details directly!
 * - Universal Export to Excel (.xlsx) & PDF (.pdf) with company branding & attachments
 */
const DEFAULT_DEPARTMENTS = [
  'QAD',
  'PRODUCTION',
  'MAINTENANCE',
  'PED',
  'MATERIALS',
  'MARKETING',
  'INCOMING QUALITY',
];

const DEFAULT_PRODUCTS = [
  'SMT',
  'RR',
  'Converter',
  'Sensor',
  'FWM',
  'IU/IG',
  'Display Unit',
  'ISG',
  'TCI/CDI',
];

const ProcessAuditRequestDetailsModal = ({
  isOpen,
  request,
  onClose,
  initialEditMode = false,
  initialTab = 'requester',
  onUpdated
}) => {
  const { error: modalError, success: modalSuccess } = useModal();
  useScrollLock(isOpen);
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
  const [activeTab, setActiveTab] = useState(initialTab || 'requester'); // 'requester' | 'closer' | 'sign_tracks'
  const [previewAttachment, setPreviewAttachment] = useState(null);
  const [showExportModal, setShowExportModal] = useState(false);

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

  // Edit Mode States
  const [isEditMode, setIsEditMode] = useState(Boolean(initialEditMode));
  const [isSaving, setIsSaving] = useState(false);

  // Form Data
  const [editFormData, setEditFormData] = useState({
    escalation_date: '',
    shift: 'Shift 1',
    product: '',
    model: '',
    process_operation: '',
    issue_type: 'Process',
    priority: 'Medium',
    department: '',
    executor: '',
    notify_emails: '',
    issue_observation: '',
    comments: '',
    // Closer fields (editable by admin)
    root_cause: '',
    corrective_action: '',
    standardization_details: '',
    target_date: '',
    action_taken_by: '',
    status: 'Pending',
    creator_remark: ''
  });

  const [editAttachments, setEditAttachments] = useState([]);
  const [newFiles, setNewFiles] = useState([]);

  const [editActionAttachments, setEditActionAttachments] = useState([]);
  const [newActionFiles, setNewActionFiles] = useState([]);

  const [editErrors, setEditErrors] = useState({});
  const [dbUsers, setDbUsers] = useState([]);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const userDropdownRef = useRef(null);

  const departmentList = Array.from(
    new Set([
      ...DEFAULT_DEPARTMENTS,
      ...(editFormData.department ? [editFormData.department.trim().toUpperCase()] : []),
      ...dbUsers.map((u) => (u.department || u.dept || '').trim().toUpperCase()).filter(Boolean),
    ])
  )
    .filter(Boolean)
    .sort();

  const req = localRequest || request;

  const isRequester = Boolean(
    req && (
      (req.created_by_id && user?.id && String(req.created_by_id) === String(user.id)) ||
      (req.created_by && user?.name && req.created_by.trim().toLowerCase() === user.name.trim().toLowerCase()) ||
      (req.created_by_email && user?.email && req.created_by_email.trim().toLowerCase() === user.email.trim().toLowerCase()) ||
      (!req.created_by && !req.created_by_email)
    )
  );

  const isClosed = (req?.status || '').toUpperCase() === 'CLOSED' || (req?.status || '').toUpperCase().includes('CLOSE');
  const canEdit = Boolean(req && isAdmin && !isClosed);

  const initEditState = (targetReq = req) => {
    if (!targetReq) return;
    const escDate = targetReq.escalation_date
      ? parseDateToYYYYMMDD(targetReq.escalation_date)
      : (targetReq.created_at ? parseDateToYYYYMMDD(targetReq.created_at) : '');

    const tgtDate = targetReq.target_date
      ? parseDateToYYYYMMDD(targetReq.target_date)
      : '';

    setEditFormData({
      escalation_date: escDate || new Date().toISOString().split('T')[0],
      shift: targetReq.shift || 'Shift 1',
      product: targetReq.product || '',
      model: targetReq.model || targetReq.stage || '',
      process_operation: targetReq.process_operation || targetReq.line || '',
      issue_type: targetReq.issue_type || 'Process',
      priority: targetReq.priority || 'Medium',
      department: targetReq.department || '',
      executor: targetReq.executor || '',
      notify_emails: targetReq.notify_emails || '',
      issue_observation: targetReq.issue_observation || targetReq.problem || '',
      comments: targetReq.comments || '',
      root_cause: targetReq.root_cause || '',
      corrective_action: targetReq.corrective_action || '',
      standardization_details: targetReq.standardization_details || '',
      target_date: tgtDate || '',
      action_taken_by: targetReq.action_taken_by || targetReq.approved_by || targetReq.executor || '',
      status: targetReq.status || 'Pending',
      creator_remark: targetReq.creator_remark || targetReq.remarks || '',
      reviewed_by: targetReq.reviewed_by || targetReq.approved_by || ''
    });

    setEditAttachments(parseAttachments(targetReq.attachments));
    setNewFiles([]);
    setEditActionAttachments(parseAttachments(targetReq.action_attachments));
    setNewActionFiles([]);
    setEditErrors({});
  };

  const initAdminState = (targetReq = req) => {
    if (!targetReq) return;
    setAdminRemarks(targetReq.creator_remark || targetReq.remarks || '');
    setAdminReviewedBy(targetReq.reviewed_by || targetReq.approved_by || '');
    setAdminStatus(String(targetReq.status || '').toLowerCase() === 'closed' ? 'Closed' : '');
    setIsReassignOpen(false);
    setIsReassignUserDropdownOpen(false);
    setReassignedDept(targetReq.department || '');
    setReassignedPerson(targetReq.executor || '');
    setReassignRemarks('');
    setReassignUserSearch('');
    setAdminErrors({});
  };

  useEffect(() => {
    setLocalRequest(request);
    if (isOpen && request) {
      initEditState(request);
      initAdminState(request);
      if (initialEditMode && !isClosed) {
        setIsEditMode(true);
        setActiveTab('requester');
      } else {
        setIsEditMode(false);
        if (initialTab) {
          setActiveTab(initialTab);
        }
      }
    }
  }, [request?.id, isOpen, initialEditMode, initialTab]);

  useEffect(() => {
    if (isOpen) {
      processAuditService.getUsers().then(users => {
        if (Array.isArray(users)) setDbUsers(users);
      }).catch(() => {});
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && editFormData.department) {
      processAuditService.getUsers(editFormData.department).then(deptUsers => {
        if (Array.isArray(deptUsers) && deptUsers.length > 0) {
          setDbUsers(prev => {
            const map = new Map();
            prev.forEach(u => map.set(u.id || u.name, u));
            deptUsers.forEach(u => map.set(u.id || u.name, u));
            return Array.from(map.values());
          });
        }
      }).catch(() => {});
    }
  }, [isOpen, editFormData.department]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (userDropdownRef.current && !userDropdownRef.current.contains(e.target)) {
        setIsUserDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const handleClickOutsideReassign = (e) => {
      if (reassignDropdownRef.current && !reassignDropdownRef.current.contains(e.target)) {
        setIsReassignUserDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutsideReassign);
    return () => document.removeEventListener('mousedown', handleClickOutsideReassign);
  }, []);

  useEffect(() => {
    if (isOpen && reassignedDept) {
      processAuditService.getUsers(reassignedDept).then((deptUsers) => {
        if (Array.isArray(deptUsers) && deptUsers.length > 0) {
          setDbUsers((prev) => {
            const map = new Map();
            prev.forEach((u) => map.set(u.id || u.name, u));
            deptUsers.forEach((u) => map.set(u.id || u.name, u));
            return Array.from(map.values());
          });
        }
      }).catch(() => {});
    }
  }, [isOpen, reassignedDept]);

  const isUserActive = (u) => {
    if (!u) return false;
    if (u.is_active === false || u.is_active === 0 || u.is_active === '0') return false;
    const s = String(u.status || 'ACTIVE').trim().toUpperCase();
    return s !== 'INACTIVE';
  };

  const getDepartmentUsers = (dept) => {
    if (!dept) return dbUsers.filter(isUserActive);
    const targetDept = dept.trim().toUpperCase();
    return dbUsers.filter((u) => {
      const uDept = (u.department || u.dept || '').trim().toUpperCase();
      return uDept === targetDept && isUserActive(u);
    });
  };

  const getSelectedUsers = () => {
    if (!editFormData.executor) return [];
    return editFormData.executor
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  };

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
      setAdminErrors((prev) => ({ ...prev, reassignPerson: '' }));
    }
  };

  const handleClearAllReassignUsers = () => {
    setReassignedPerson('');
  };

  const handleToggleUser = (userName) => {
    const current = getSelectedUsers();
    let updated;
    if (current.includes(userName)) {
      updated = current.filter((u) => u !== userName);
    } else {
      updated = [...current, userName];
    }
    setEditFormData(prev => ({ ...prev, executor: updated.join(', ') }));
    if (updated.length > 0) {
      setEditErrors(prev => ({ ...prev, executor: '' }));
    }
  };

  const handleRemoveExistingAttachment = (idxToRemove) => {
    setEditAttachments(prev => prev.filter((_, idx) => idx !== idxToRemove));
  };

  const handleRemoveNewFile = (idxToRemove) => {
    setNewFiles(prev => prev.filter((_, idx) => idx !== idxToRemove));
  };

  const handleNewFilesSelect = (e) => {
    const selected = Array.from(e.target.files || []);
    if (selected.length > 0) {
      setNewFiles(prev => [...prev, ...selected]);
      setEditErrors(prev => ({ ...prev, attachments: '' }));
    }
    e.target.value = '';
  };

  const handleRemoveExistingActionAttachment = (idxToRemove) => {
    setEditActionAttachments(prev => prev.filter((_, idx) => idx !== idxToRemove));
  };

  const handleRemoveNewActionFile = (idxToRemove) => {
    setNewActionFiles(prev => prev.filter((_, idx) => idx !== idxToRemove));
  };

  const handleNewActionFilesSelect = (e) => {
    const selected = Array.from(e.target.files || []);
    if (selected.length > 0) {
      setNewActionFiles(prev => [...prev, ...selected]);
    }
    e.target.value = '';
  };

  const handleSaveChanges = async () => {
    if (isClosed) {
      modalError('This request is closed and cannot be modified.');
      return;
    }

    const newErrors = {};

    const todayDateStr = new Date().toISOString().split('T')[0];
    if (!editFormData.escalation_date || !editFormData.escalation_date.trim()) {
      newErrors.escalation_date = 'Escalation Date is required';
    } else if (editFormData.escalation_date > todayDateStr) {
      newErrors.escalation_date = 'Escalation Date cannot be a future date. Please select today or a past date.';
    }
    if (!editFormData.shift || !editFormData.shift.trim()) {
      newErrors.shift = 'Shift is required';
    }
    if (!editFormData.process_operation || !editFormData.process_operation.trim()) {
      newErrors.process_operation = 'Process / Operation is required';
    }
    if (!editFormData.department || !editFormData.department.trim()) {
      newErrors.department = 'Assigned Department is required';
    }
    if (!editFormData.executor || getSelectedUsers().length === 0) {
      newErrors.executor = 'Assigned Executor is required';
    }
    if (!editFormData.issue_observation || !editFormData.issue_observation.trim()) {
      newErrors.issue_observation = 'Observation & findings description is required';
    }

    if (Object.keys(newErrors).length > 0) {
      setEditErrors(newErrors);
      modalError('Please fill in all mandatory fields indicated in red.');
      return;
    }

    setEditErrors({});
    setIsSaving(true);

    try {
      let newlyUploadedCreator = [];
      if (newFiles.length > 0) {
        newlyUploadedCreator = await processAuditService.uploadAttachments(newFiles);
      }
      const finalAttachments = [...editAttachments, ...newlyUploadedCreator];

      let newlyUploadedAction = [];
      if (newActionFiles.length > 0) {
        newlyUploadedAction = await processAuditService.uploadAttachments(newActionFiles);
      }
      const finalActionAttachments = [...editActionAttachments, ...newlyUploadedAction];

      const updates = {
        escalation_date: editFormData.escalation_date,
        shift: editFormData.shift,
        product: editFormData.product.trim(),
        model: editFormData.model.trim(),
        process_operation: editFormData.process_operation.trim(),
        issue_type: editFormData.issue_type,
        priority: editFormData.priority,
        department: editFormData.department.trim(),
        executor: editFormData.executor.trim(),
        issue_observation: editFormData.issue_observation.trim(),
        comments: editFormData.comments.trim(),
        attachments: finalAttachments,
        root_cause: editFormData.root_cause.trim(),
        corrective_action: editFormData.corrective_action.trim(),
        standardization_details: editFormData.standardization_details.trim(),
        target_date: editFormData.target_date || null,
        action_taken_by: editFormData.action_taken_by.trim() || null,
        action_attachments: finalActionAttachments,
        status: editFormData.status,
        creator_remark: editFormData.creator_remark.trim(),
        reviewed_by: editFormData.reviewed_by !== undefined ? editFormData.reviewed_by.trim() : (req.reviewed_by || null)
      };

      const result = await processAuditService.updateRequest(req.id, updates);
      const mergedUpdated = {
        ...req,
        ...updates,
        ...(result || {})
      };

      setLocalRequest(mergedUpdated);
      setIsEditMode(false);
      setNewFiles([]);
      setNewActionFiles([]);
      onUpdated?.(mergedUpdated);
      modalSuccess('Audit Request details updated successfully!');
    } catch (err) {
      console.error('Failed to update process audit request:', err);
      modalError(err.message || 'Failed to update request. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAdminSignOff = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!req) return;

    if (isClosed) {
      modalError('This request is closed and cannot be modified.');
      return;
    }

    if (!isAdmin) {
      modalError('Only Quality Auditor or Admin has permission to update Admin Review and sign off status.');
      return;
    }

    const errors = {};

    if (isReassignOpen) {
      if (!reassignedDept) errors.reassignDept = 'Department is required for reassignment.';
      if (!reassignedPerson || !reassignedPerson.trim()) errors.reassignPerson = 'Responsible executor is required for reassignment.';
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
      const loggedInPersonName = (
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
        'Quality Auditor'
      );

      const effectiveReviewer = (adminReviewedBy && adminReviewedBy.trim())
        ? adminReviewedBy.trim()
        : loggedInPersonName;

      const effectiveRemarks = isReassignOpen
        ? ((reassignRemarks && reassignRemarks.trim()) ||
           (adminRemarks && adminRemarks.trim()) ||
           `Reassigned to ${reassignedPerson} (${reassignedDept}) for root cause analysis by ${effectiveReviewer}.`)
        : adminRemarks.trim();

      const reqId = req.id || req.issue_no;
      let reviewerId = user?.id || null;
      let reviewerEmail = user?.email || null;

      if (isReassignOpen) {
        const reassignRes = await processAuditService.reassignRequest(reqId, {
          new_department: reassignedDept,
          new_executor: reassignedPerson,
          reason: effectiveRemarks,
          reassigned_by: effectiveReviewer,
          reassigned_by_id: reviewerId,
          reassigned_by_email: reviewerEmail,
          role: user?.role || 'ADMIN',
          user_department: userDept || 'QAD'
        });

        const merged = {
          ...req,
          department: reassignedDept,
          executor: reassignedPerson,
          status: 'Pending',
          creator_remark: effectiveRemarks,
          remarks: effectiveRemarks,
          reviewed_by: effectiveReviewer,
          reviewed_by_id: reviewerId,
          reviewed_by_email: reviewerEmail,
          ...(reassignRes || {})
        };

        setLocalRequest(merged);
        initAdminState(merged);
        setIsReassignOpen(false);
        setIsReassignUserDropdownOpen(false);
        setReassignUserSearch('');
        onUpdated?.(merged);
        try {
          window.dispatchEvent(new Event('refreshNotifications'));
        } catch (_) {}
        modalSuccess(`Request #${reqNo} status updated & reassigned to ${reassignedPerson} (${reassignedDept}) successfully!`);
      } else {
        const targetStatus = adminStatus || 'Closed';
        const statusRes = await processAuditService.updateRequestStatus(reqId, targetStatus, {
          creator_remark: effectiveRemarks,
          remark: effectiveRemarks,
          remarks: effectiveRemarks,
          reviewed_by: effectiveReviewer,
          reviewed_by_id: reviewerId,
          reviewed_by_email: reviewerEmail,
          closed_by: targetStatus.toLowerCase() === 'closed' ? effectiveReviewer : null
        });

        const merged = {
          ...req,
          status: targetStatus,
          creator_remark: effectiveRemarks,
          remarks: effectiveRemarks,
          reviewed_by: effectiveReviewer,
          ...(statusRes || {})
        };

        setLocalRequest(merged);
        initAdminState(merged);
        onUpdated?.(merged);
        try {
          window.dispatchEvent(new Event('refreshNotifications'));
        } catch (_) {}
        modalSuccess(`Admin remarks & status sign-off (${targetStatus}) updated successfully for #${reqNo}!`);
      }
    } catch (err) {
      console.error('Failed to save admin sign-off in modal:', err);
      modalError(err.response?.data?.message || err.message || 'Failed to update admin review & sign-off.');
    } finally {
      setIsSavingAdmin(false);
    }
  };

  const handleExportExcel = async () => {
    try {
      const targetReq = req || request;
      const reqNo = targetReq.issue_no || (targetReq.id ? `PA-${targetReq.id}` : '#1');
      const safeReqNo = String(reqNo).replace(/[^a-zA-Z0-9_-]/g, '_');
      const today = new Date().toISOString().slice(0, 10);

      await exportProcessAuditToExcel({
        requests: [targetReq],
        fileName: `ProcessAudit_Inspection_Report_${safeReqNo}_${today}.xlsx`,
        sheetName: 'Inspection Report'
      });

      setShowExportModal(false);
      modalSuccess(`Exported inspection report #${reqNo} to Excel with all details.`);
    } catch (err) {
      console.error('Failed to export to Excel:', err);
      modalError('Failed to export to Excel: ' + err.message);
    }
  };

  const handleExportPdf = async () => {
    try {
      const targetReq = req || request;
      const reqNo = targetReq.issue_no || (targetReq.id ? `PA-${targetReq.id}` : '#1');
      const safeReqNo = String(reqNo).replace(/[^a-zA-Z0-9_-]/g, '_');
      const today = new Date().toISOString().slice(0, 10);

      await exportProcessAuditToPdf({
        requests: [targetReq],
        fileName: `ProcessAudit_Inspection_Report_${safeReqNo}_${today}.pdf`,
        title: `Process Audit Inspection Report #${reqNo}`
      });

      setShowExportModal(false);
      modalSuccess(`Exported inspection report #${reqNo} to PDF with all details & embedded images.`);
    } catch (err) {
      console.error('Failed to export to PDF:', err);
      modalError('Failed to export to PDF: ' + err.message);
    }
  };

  if (!isOpen || !request) return null;

  const creatorAttachments = parseAttachments(req.attachments);
  const actionAttachments = parseAttachments(req.action_attachments);
  const temporaryEvidenceAttachments = parseAttachments(req.temporary_evidence_attachment || req.action_attachments);
  const permanentEvidenceAttachments = parseAttachments(req.permanent_evidence_attachment);

  const reqNo = req.issue_no || (req.id ? `PA-${req.id}` : 'PA-1');
  const escDate = req.escalation_date ? formatDateDDMMYYYY(req.escalation_date) : (req.created_at ? formatDateDDMMYYYY(req.created_at) : '—');
  const targetDate = (req.temporary_target_date ? formatDateDDMMYYYY(req.temporary_target_date) : '') || (req.target_date ? formatDateDDMMYYYY(req.target_date) : '—');
  const permanentTargetDate = req.permanent_target_date ? formatDateDDMMYYYY(req.permanent_target_date) : '—';

  let whyList = [];
  if (Array.isArray(req.prod_why_why)) {
    whyList = req.prod_why_why;
  } else if (typeof req.prod_why_why === 'string') {
    try {
      whyList = JSON.parse(req.prod_why_why);
    } catch {
      whyList = req.prod_why_why ? [req.prod_why_why] : [];
    }
  } else if (req.root_cause) {
    whyList = [req.root_cause];
  }

  const has5WhyOrCountermeasures = Boolean(
    (Array.isArray(whyList) && whyList.some((w) => w && String(w).trim())) ||
    (req.temporary_action && String(req.temporary_action).trim()) ||
    (req.permanent_fix && String(req.permanent_fix).trim()) ||
    (req.temporary_evidence_attachment && parseAttachments(req.temporary_evidence_attachment).length > 0) ||
    (req.permanent_evidence_attachment && parseAttachments(req.permanent_evidence_attachment).length > 0)
  );

  const sLower = String(req.status || 'Pending').trim().toLowerCase();
  const isReqClosed = sLower.includes('close');
  const isReqRejected = sLower.includes('reject');
  const isReqOpen = sLower === 'open' || sLower.includes('reopen');
  const isReqSignedOff = (sLower.includes('signed off') || sLower.includes('signed')) && !isReqClosed;
  const isReqPending = sLower.includes('pending');

  const isCloserCompleted = !isReqPending && !isReqOpen && !isReqRejected && !isReqClosed && Boolean(
    sLower.includes('approval') ||
    sLower.includes('progress') ||
    sLower.includes('review') ||
    (req.temporary_action && String(req.temporary_action).trim()) ||
    (req.permanent_fix && String(req.permanent_fix).trim()) ||
    (req.corrective_action && String(req.corrective_action).trim()) ||
    (req.action && String(req.action).trim()) ||
    (req.root_cause && String(req.root_cause).trim()) ||
    (Array.isArray(whyList) && whyList.some((w) => w && String(w).trim())) ||
    (req.standardization_details && String(req.standardization_details).trim()) ||
    Boolean(req.temporary_target_date || req.permanent_target_date || req.target_date) ||
    Boolean(req.action_taken_by) ||
    (temporaryEvidenceAttachments.length > 0) ||
    (permanentEvidenceAttachments.length > 0) ||
    (actionAttachments.length > 0)
  );

  let statusBadgeLabel = 'Pending';
  let statusBadgeClass = 'bg-rose-50 text-rose-700 border-rose-200';
  if (isReqClosed) {
    statusBadgeLabel = 'Closed';
    statusBadgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
  } else if (isReqRejected) {
    statusBadgeLabel = 'Rejected';
    statusBadgeClass = 'bg-rose-50 text-rose-700 border-rose-200';
  } else if (isReqOpen) {
    statusBadgeLabel = 'Open';
    statusBadgeClass = 'bg-sky-50 text-sky-700 border-sky-200';
  } else if (isReqPending) {
    statusBadgeLabel = 'Pending';
    statusBadgeClass = 'bg-rose-50 text-rose-700 border-rose-200';
  } else if (isReqSignedOff) {
    statusBadgeLabel = 'Signed off';
    statusBadgeClass = 'bg-indigo-50 text-indigo-700 border-indigo-200';
  } else if (isCloserCompleted) {
    statusBadgeLabel = 'Awaiting Review';
    statusBadgeClass = 'bg-amber-50 text-amber-700 border-amber-200';
  }

  const {
    hasReassignments,
    reassignedStatus,
    reassignmentDetails,
    count: reassignCount,
    list: reassignList
  } = formatReassignmentHistory(req?.reassignment_history);

  const isSelectedPending = isReqPending || isReqOpen;

  const hasCloserSubmitted = Boolean(
    req && !isSelectedPending && (
      sLower.includes('progress') ||
      sLower.includes('review') ||
      sLower.includes('signed') ||
      sLower.includes('close') ||
      Boolean(
        (req.corrective_action || req.temporary_action || req.permanent_fix || req.root_cause) &&
        (req.target_date || req.temporary_target_date || req.permanent_target_date)
      )
    )
  );

  const isCloserDataToBeUpdated = Boolean(req && (isSelectedPending && !hasCloserSubmitted));

  const closerSubmitter = (() => {
    // 1. Logged-in user who submitted/updated closer action
    const closerUser = req?.closer_updated_by;
    if (closerUser && typeof closerUser === 'string' && !closerUser.toUpperCase().includes('CLOSED BY') && closerUser !== 'Assigned Executor') {
      return closerUser.trim();
    }
    // 2. Logged-in user captured in approved_by upon closer submission
    const approvedUser = req?.approved_by;
    if (approvedUser && typeof approvedUser === 'string' && !approvedUser.toUpperCase().includes('CLOSED BY') && approvedUser !== 'Assigned Executor') {
      return approvedUser.trim();
    }
    // 3. Logged-in user who closed the request if closed
    const closedUser = req?.closed_by;
    if (closedUser && typeof closedUser === 'string' && !closedUser.toUpperCase().includes('CLOSED BY') && closedUser !== 'Assigned Executor') {
      return closedUser.trim();
    }
    // 4. Action taken by field
    const val = req?.action_taken_by || req?.temporary_closed_by;
    if (val && typeof val === 'string' && !val.toUpperCase().includes('CLOSED BY') && val !== 'Assigned Executor') {
      return val.trim();
    }
    // 5. Fallback to assigned executor
    if (req?.executor && typeof req.executor === 'string' && !req.executor.toUpperCase().includes('CLOSED BY')) {
      return req.executor.trim();
    }
    return null;
  })();

  return createPortal(
    <div
      className="fixed inset-0 !m-0 !mt-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150 overscroll-contain"
      style={{ zIndex: 99990 }}
      onClick={() => {
        if (!isEditMode) {
          onClose();
        }
      }}
    >
      <div
        className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200 overscroll-contain"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header (Matching IHLR exact styling) */}
        <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
              <Eye className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 truncate">
                  Process Audit Inspection Report
                </h3>
                {canEdit && activeTab === 'requester' && (
                  isEditMode ? (
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 bg-amber-500 text-white text-[10px] font-black rounded-full uppercase tracking-wider animate-pulse">
                        EDITING AUDIT DETAILS
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
                      title="Edit Audit Details"
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
                    {reqNo}
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

        {/* Tab Navigation: Requester Details vs Closer Details vs Sign Fields & Tracks */}
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
                ? isReqClosed
                  ? 'border-emerald-600 text-emerald-700'
                  : isCloserCompleted
                  ? 'border-amber-600 text-amber-700'
                  : 'border-rose-600 text-rose-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <CheckCircle2 className={`w-4 h-4 ${isReqClosed ? 'text-emerald-600' : isCloserCompleted ? 'text-amber-600' : 'text-rose-600'}`} />
            <span>Closer Details</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${statusBadgeClass}`}>
              {statusBadgeLabel}
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              if (isEditMode) {
                setIsEditMode(false);
              }
              setActiveTab('sign_tracks');
            }}
            className={`pb-3 px-3 text-xs font-bold transition border-b-2 flex items-center gap-2 cursor-pointer ${
              activeTab === 'sign_tracks'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <ShieldCheck className={`w-4 h-4 ${isReqClosed ? 'text-emerald-600' : 'text-indigo-600'}`} />
            <span>Sign Fields &amp; Tracks</span>
            {isReqClosed ? (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300">
                Signed Off
              </span>
            ) : hasReassignments ? (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-purple-100 text-purple-800 border border-purple-300">
                Tracks ({reassignCount})
              </span>
            ) : isCloserCompleted ? (
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
        <div className="p-6 overflow-y-auto overscroll-contain space-y-6 flex-1 bg-white">
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
                          {reqNo}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${statusBadgeClass}`}>
                          {statusBadgeLabel}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-300 mt-0.5">
                        Logged: <span className="text-white font-medium">{escDate}</span> | Assigned Dept: <span className="text-amber-300 font-semibold">{req.department || '—'}</span>
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
                        <span> Assignment</span>
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
                      <span>1. Finding Raised</span>
                    </div>
                    <div className="text-slate-200 font-semibold truncate text-[11px]">
                      {req.created_by || 'Requester'}
                    </div>
                    {resolveAuditorEmail(req) !== '—' && (
                      <div className="text-[10px] text-emerald-300/80 truncate font-mono">
                        {resolveAuditorEmail(req)}
                      </div>
                    )}
                    <div className="text-[10px] text-slate-400 font-mono">
                      {escDate || '—'} ({req.shift || 'Shift 1'})
                    </div>
                  </div>

                  {/* Step 2: Assigned Closer */}
                  <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 space-y-1">
                    <div className="flex items-center gap-1.5 text-blue-400 font-bold text-[10px] uppercase tracking-wider">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span>2. Assigned Closer</span>
                    </div>
                    <div className="text-slate-200 font-semibold truncate text-[11px]">
                      {req.executor || 'Not Assigned'}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      Dept: {req.department || '—'}
                    </div>
                  </div>

                  {/* Step 3: Closer Action */}
                  <div className={`p-2.5 rounded-xl border space-y-1 ${
                    hasCloserSubmitted
                      ? 'bg-white/5 border-white/10'
                      : 'bg-amber-500/10 border-amber-400/30'
                  }`}>
                    <div className={`flex items-center gap-1.5 font-bold text-[10px] uppercase tracking-wider ${
                      hasCloserSubmitted ? 'text-teal-400' : 'text-amber-300'
                    }`}>
                      {hasCloserSubmitted ? (
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      ) : (
                        <Clock className="w-3.5 h-3.5 shrink-0" />
                      )}
                      <span>3. Closer Action</span>
                    </div>
                    <div className="text-slate-200 font-semibold truncate text-[11px]" title={hasCloserSubmitted ? (closerSubmitter || 'Submitted') : 'Pending Submission'}>
                      {hasCloserSubmitted ? (closerSubmitter || 'Submitted') : 'Pending Submission'}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono truncate">
                      {hasCloserSubmitted
                        ? (isReqClosed ? 'Status: Closed' : 'Status: Awaiting Review')
                        : (targetDate ? `Target: ${targetDate}` : 'Awaiting Closer')}
                    </div>
                  </div>

                  {/* Step 4: Admin Sign-Off */}
                  <div className={`p-2.5 rounded-xl border space-y-1 ${
                    isReqClosed
                      ? 'bg-emerald-500/15 border-emerald-400/30'
                      : 'bg-white/5 border-white/10'
                  }`}>
                    <div className={`flex items-center gap-1.5 font-bold text-[10px] uppercase tracking-wider ${
                      isReqClosed ? 'text-emerald-400' : 'text-slate-400'
                    }`}>
                      {isReqClosed ? (
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      ) : (
                        <Lock className="w-3.5 h-3.5 shrink-0" />
                      )}
                      <span>4. Sign-Off</span>
                    </div>
                    <div className="text-slate-200 font-semibold truncate text-[11px]">
                      {isReqClosed ? (req.reviewed_by || req.approved_by || 'Signed Off') : 'Awaiting Sign-Off'}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      Status: {statusBadgeLabel}
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. Admin Review & Sign-Off Section */}
              <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-indigo-600" />
                    <span>Admin Review &amp; Sign-Off</span>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 bg-purple-50 text-purple-700 rounded border border-purple-200">
                      ADMIN ONLY
                    </span>
                    {isReqClosed && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded border border-emerald-200 flex items-center gap-1">
                        <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                        <span>CLOSED &amp; SIGNED</span>
                      </span>
                    )}
                  </label>
                  <span className="text-[10px] text-slate-400 font-medium">Independent Update</span>
                </div>

                {/* Status Notice Banner */}
                {isReqClosed ? (
                  <div className="p-3 rounded-xl border border-emerald-200 bg-emerald-50/80 text-emerald-900 text-xs flex items-center gap-2.5 animate-in fade-in">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <div className="leading-tight">
                      <span className="font-bold">Audit Finding Signed-Off &amp; Closed: </span>
                      <span className="text-emerald-800">
                        Verified by <strong className="text-emerald-950">{req.reviewed_by || req.approved_by || 'Quality Auditor'}</strong>. Status finalized to CLOSED.
                      </span>
                    </div>
                  </div>
                ) : isCloserDataToBeUpdated ? (
                  <div className="p-3 rounded-xl border border-amber-200 bg-amber-50/80 text-amber-900 text-xs flex items-center gap-2.5 animate-in fade-in">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    <div className="leading-tight">
                      <span className="font-bold">Closer Submission: </span>
                      <span className="text-amber-800">
                        Closer actions pending. Admin can review, edit, or sign off status.
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded-xl border border-blue-200 bg-blue-50/70 text-blue-900 text-xs flex items-center gap-2.5 animate-in fade-in">
                    <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                    <div className="leading-tight">
                      <span className="font-bold">Ready for Review: </span>
                      <span className="text-blue-800">
                        Closer actions submitted. Quality Auditor can review remarks and finalize status.
                      </span>
                    </div>
                  </div>
                )}

                {/* Reassign Closer Block */}
                <div className="space-y-2">
                  {!isReassignOpen ? (
                    <div className={`flex items-center justify-between p-3 rounded-xl border transition ${
                      isReqClosed ? 'bg-slate-50 border-slate-200 text-slate-500' : 'bg-slate-50 border-slate-200/90'
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
                            Current: <strong className="text-slate-800">{req.executor || 'Not Assigned'}</strong> ({req.department || '—'})
                          </div>
                        </div>
                      </div>
                      {isAdmin && !isReqClosed && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsReassignOpen(true);
                            setIsReassignUserDropdownOpen(false);
                            setReassignUserSearch('');
                            setReassignedDept(req.department || '');
                            setReassignedPerson(req.executor || '');
                            setAdminStatus('Pending');
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
                            setReassignedDept(req.department || '');
                            setReassignedPerson(req.executor || '');
                            setAdminStatus(isReqClosed ? 'Closed' : '');
                            setAdminErrors(prev => ({ ...prev, reassignDept: '', reassignPerson: '', status: '' }));
                          }}
                          className="text-[11px] text-slate-500 hover:text-rose-600 font-semibold cursor-pointer underline flex items-center gap-1"
                        >
                          Cancel
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* Department */}
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                            Department *
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
                            className={`w-full px-2.5 py-2 bg-white border rounded-xl font-semibold text-slate-800 text-xs outline-none cursor-pointer ${
                              adminErrors.reassignDept
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
                              Executor User Name (Dept Based) *
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
                            className={`min-h-[38px] p-1.5 px-2.5 bg-white border rounded-xl flex items-center justify-between gap-2 cursor-pointer transition ${
                              !reassignedDept
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
                                        className={`p-2 rounded-lg text-xs flex items-center justify-between cursor-pointer transition ${
                                          isSel ? 'bg-blue-50 text-blue-700 font-bold' : 'hover:bg-slate-50 text-slate-700'
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
                          placeholder="e.g. Reassigned to shift supervisor for root cause analysis..."
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* REMARKS * [ADMIN] */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                      <span>REMARKS</span>
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
                    disabled={!isAdmin || (isCloserDataToBeUpdated && !isReassignOpen) || isReqClosed}
                    placeholder={
                      isCloserDataToBeUpdated && !isReassignOpen
                        ? (adminRemarks || req.creator_remark || req.remarks || (reassignList?.[reassignList.length - 1]?.remarks) ? '' : 'Awaiting closer Corrective Action & Target Date...')
                        : 'Enter auditor review and sign-off remarks...'
                    }
                    value={adminRemarks || ''}
                    onChange={(e) => {
                      setAdminRemarks(e.target.value);
                      if (e.target.value.trim()) {
                        setAdminErrors(prev => ({ ...prev, remarks: '' }));
                      }
                    }}
                    className={`w-full px-3.5 py-2.5 border rounded-xl text-xs outline-none transition font-medium leading-relaxed resize-none ${
                      !isAdmin || (isCloserDataToBeUpdated && !isReassignOpen) || isReqClosed
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
                      Closer Action &amp; Target Date required before Admin Sign-Off.
                    </p>
                  ) : (
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Comprehensive Quality Auditor verification remarks and final closure statement.
                    </p>
                  )}
                </div>

                {/* REVIEWED BY (optional) [ADMIN] */}
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
                      DEFAULTS TO: <strong className="text-slate-700">{user?.name || 'ADMIN'}</strong>
                    </span>
                  </div>

                  <input
                    type="text"
                    disabled={!isAdmin || (isCloserDataToBeUpdated && !isReassignOpen) || isReqClosed}
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
                    className={`w-full px-3.5 py-2 border rounded-xl text-xs font-semibold outline-none transition ${
                      !isAdmin || (isCloserDataToBeUpdated && !isReassignOpen) || isReqClosed
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
                      Quality Auditor reviewing this finding (defaults to logged-in user).
                    </p>
                  )}
                </div>

                {/* STATUS * [ADMIN] */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                    <span>STATUS</span>
                    <span className="text-rose-500 font-bold">*</span>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 bg-purple-50 text-purple-700 rounded border border-purple-200">
                      ADMIN
                    </span>
                  </label>

                  <select
                    disabled={!isAdmin || (isCloserDataToBeUpdated && !isReassignOpen) || isReqClosed}
                    value={isReassignOpen ? 'Pending' : adminStatus}
                    onChange={(e) => {
                      setAdminStatus(e.target.value);
                      if (e.target.value) {
                        setAdminErrors(prev => ({ ...prev, status: '' }));
                      }
                    }}
                    className={`w-full px-3.5 py-2 border rounded-xl font-bold text-xs outline-none transition cursor-pointer ${
                      !isAdmin || (isCloserDataToBeUpdated && !isReassignOpen) || isReqClosed
                        ? 'bg-slate-100/70 border-slate-200 text-slate-500 cursor-not-allowed select-none'
                        : adminErrors.status
                        ? 'border-rose-400 bg-rose-50/20'
                        : 'bg-white border-slate-300 text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500'
                    }`}
                  >
                    {isReassignOpen ? (
                      <option value="Pending">PENDING (Awaiting Closer)</option>
                    ) : (
                      <>
                        <option value="">Select Status...</option>
                        <option value="Closed">CLOSED</option>
                        <option value="Pending">PENDING</option>
                      </>
                    )}
                  </select>

                  {adminErrors.status ? (
                    <p className="text-[11px] text-rose-500 font-semibold mt-0.5">
                      * {adminErrors.status}
                    </p>
                  ) : isCloserDataToBeUpdated && !isReassignOpen ? (
                    <p className="text-[11px] text-amber-700 font-semibold mt-0.5">
                      Status unlocks after closer actions submission.
                    </p>
                  ) : isReassignOpen ? (
                    <p className="text-[10px] text-purple-700 font-semibold mt-0.5">
                      Status locked to PENDING for new assignee.
                    </p>
                  ) : adminStatus === 'Closed' ? (
                    <p className="text-[10px] text-emerald-600 font-semibold mt-0.5">
                      Status will be finalized to CLOSED.
                    </p>
                  ) : (
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Select CLOSED to finalize  sign-off.
                    </p>
                  )}
                </div>

                {/* Sign-Off Action Button */}
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
                  ) : isAdmin && !isReqClosed ? (
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
                  ) : isReqClosed ? (
                    <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center justify-center gap-2 text-emerald-800 font-bold text-xs">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Audit Finding Fully Validated &amp; Closed</span>
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
                  <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border font-mono ${
                    hasReassignments
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
                              From: <strong className="text-slate-900">{entry.prev_resp_person || entry.previous_executor || '—'}</strong> ({entry.prev_resp || entry.previous_department || '—'})
                            </span>
                            <ArrowRightLeft className="w-3 h-3 text-purple-400 inline" />
                            <span className="text-purple-700 font-medium">
                              To: <strong className="text-purple-900">{entry.new_resp_person || entry.new_executor || '—'}</strong> ({entry.new_resp || entry.new_department || '—'})
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-500 font-mono">
                            {[
                              entry.reassigned_by ? `by ${entry.reassigned_by}` : '',
                              entry.reassigned_at ? formatDateDDMMYYYY(entry.reassigned_at) : ''
                            ].filter(Boolean).join(' • ')}
                          </span>
                        </div>
                        {(entry.remarks || entry.reason) && (
                          <div className="text-[11px] text-slate-700 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100 italic">
                            <span className="font-semibold text-slate-500 not-italic">Remarks: </span>
                            {entry.remarks || entry.reason}
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
                        Assigned to <strong className="text-slate-700">{req.executor || 'Not Assigned'}</strong> ({req.department || '—'}). No reassignments have occurred for this audit finding.
                      </div>
                    </div>
                  </div>
                )}
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
                        {reqNo}
                      </span>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${statusBadgeClass}`}>
                        {statusBadgeLabel.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Model: <strong className="text-slate-800">{req.model || req.stage || '—'}</strong> | Operation:{' '}
                      <strong className="text-slate-800">{req.process_operation || req.line || '—'}</strong>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-[11px] font-medium text-slate-600">
                 
                  <div>
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Responsibility</span>
                    <span className="font-bold text-slate-800">
                      {req.department || 'Production'}{req.executor ? ` (${req.executor})` : ''}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-emerald-600">Closer Filled By</span>
                    <span className="font-bold text-emerald-800">
                      {hasCloserSubmitted ? (closerSubmitter || req.approved_by || 'Submitted') : 'Pending Closer'}
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

              {/* 2. Occurrence Cause (Production Team - 5-Why Analysis) */}
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
                    const validWhys = (Array.isArray(whyList) ? whyList : [])
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

              {/* 3. Action (Words) - Temporary Action */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-blue-600 text-xs font-bold uppercase tracking-wider">
                  <Wrench className="w-4 h-4" />
                  <span>Temporary Action</span>
                </div>
                <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs text-xs text-slate-800 leading-relaxed font-medium">
                  {req.temporary_action || req.corrective_action || req.action || <span className="text-slate-400 italic">No temporary action recorded.</span>}
                </div>
              </div>

              {/* 4. Evidence Attachment (Format: PPT, JPEG, EXCEL & PDF) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-purple-600 text-xs font-bold uppercase tracking-wider">
                    <Paperclip className="w-4 h-4" />
                    <span>Temporary Evidence Attachments</span>
                  </div>
                </div>

                {temporaryEvidenceAttachments && temporaryEvidenceAttachments.length > 0 ? (
                  <div className="p-4 rounded-2xl bg-slate-50/60 border border-slate-200/80">
                    <AttachmentChipList
                      attachments={temporaryEvidenceAttachments}
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

              {/* 5. Target Date & Remarks (4-Column Grid: TEMPORARY TARGET DATE, TEMPORARY CLOSED BY, REMARKS, REVIEWED BY) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-1">
                  <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    TEMPORARY TARGET DATE
                  </span>
                  <span className="font-mono font-bold text-slate-900 text-sm">
                    {targetDate || '—'}
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-1">
                  <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    TEMPORARY CLOSED BY
                  </span>
                  <span className="font-bold text-slate-900 block text-xs">
                    {req.temporary_closed_by || req.action_taken_by || '—'}
                  </span>
                </div>

      

               
              </div>

              {/* Permanent Section */}
              <div className="pt-3 border-t border-slate-200/90 space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                  <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Permanent
                  </span>
                </div>

                {/* 1. Permanent Action (Words) */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-emerald-600 text-xs font-bold uppercase tracking-wider">
                    <Wrench className="w-4 h-4" />
                    <span>Permanent Action</span>
                  </div>
                  <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs text-xs text-slate-800 leading-relaxed font-medium">
                    {req.permanent_fix || <span className="text-slate-400 italic">No permanent action recorded.</span>}
                  </div>
                </div>

                {/* 2. Permanent Action Evidence Attachment */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-purple-600 text-xs font-bold uppercase tracking-wider">
                      <Paperclip className="w-4 h-4" />
                      <span>Permanent Evidence Attachments</span>
                    </div>
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

                {/* 3. Permanent Fix Target Date & Permanent Closed By */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-1">
                    <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      PERMANENT TARGET DATE
                    </span>
                    <span className="font-mono font-bold text-slate-900 text-sm">
                      {permanentTargetDate || '—'}
                    </span>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-1">
                    <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      PERMANENT CLOSED BY
                    </span>
                    <span className="font-bold text-slate-900 block text-xs">
                      {req.permanent_closed_by || req.closed_by || '—'}
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
                              From: <strong className="text-slate-900">{entry.prev_resp_person || entry.previous_executor || '—'}</strong> ({entry.prev_resp || entry.previous_department || '—'})
                            </span>
                            <ArrowRightLeft className="w-3 h-3 text-purple-400 inline" />
                            <span className="text-purple-700 font-medium">
                              To: <strong className="text-purple-900">{entry.new_resp_person || entry.new_executor || '—'}</strong> ({entry.new_resp || entry.new_department || '—'})
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-500 font-mono">
                            {[entry.reassigned_by ? `by ${entry.reassigned_by}` : '', entry.reassigned_at ? formatDateDDMMYYYY(entry.reassigned_at) : ''].filter(Boolean).join(' • ')}
                          </span>
                        </div>
                        {(entry.remarks || entry.reason) && (
                          <div className="text-[11px] text-slate-700 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100 italic">
                            <span className="font-semibold text-slate-500 not-italic">Remarks: </span>
                            {entry.remarks || entry.reason}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 7. Closer Status & Sign-off Details */}
              <div className={`p-4 rounded-2xl border flex flex-wrap items-center justify-between gap-3 text-xs ${
                isReqClosed
                  ? 'bg-emerald-50/70 border-emerald-200/90'
                  : 'bg-amber-50/70 border-amber-200/90'
              }`}>
                <div className="flex items-center gap-2">
                  {isReqClosed ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span className="font-bold text-emerald-900">Incident Fully Validated &amp; Closed</span>
                    </>
                  ) : (
                    <>
                      <Clock className="w-4 h-4 text-amber-600" />
                      <span className="font-bold text-amber-900">Action in Progress</span>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-4 text-[11px] text-slate-600 font-medium">
                  <span>Priority: <strong className="text-amber-800 font-mono">{req.priority || 'Medium'}</strong></span>
                  <span>Resp: <strong className="text-blue-700 font-mono">{req.department || 'Production'}{req.executor ? ` (${req.executor})` : ''}</strong></span>
                </div>
              </div>

            
             
            </div>
          ) : isEditMode ? (
            /* TAB 1: REQUESTER DETAILS - EDIT MODE */
            <div className="space-y-6 animate-in fade-in duration-150">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-blue-600 text-xs font-bold uppercase tracking-wider">
                    <Folder className="w-4 h-4" />
                    <span>1. AUDIT &amp; LINE OBSERVATION PARAMETERS</span>
                  </div>
                  <span className="text-[11px] font-bold text-amber-600 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200 uppercase tracking-wider">
                    Requester Edit Active
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs p-4 rounded-2xl bg-slate-50/90 border border-slate-200">
                  <div>
                    <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                      AUDIT REQ NO
                    </span>
                    <div className="px-3 py-2 bg-slate-200/80 rounded-xl font-bold font-mono text-slate-700 border border-slate-300/80 text-xs">
                      {reqNo}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      ESCALATION DATE <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      max={new Date().toISOString().split('T')[0]}
                      value={editFormData.escalation_date}
                      onChange={(e) => {
                        const val = e.target.value;
                        const today = new Date().toISOString().split('T')[0];
                        setEditFormData(prev => ({ ...prev, escalation_date: val }));
                        if (val && val > today) {
                          setEditErrors(prev => ({ ...prev, escalation_date: 'Escalation Date cannot be a future date. Please select today or a past date.' }));
                        } else if (editErrors.escalation_date && val) {
                          setEditErrors(prev => ({ ...prev, escalation_date: '' }));
                        }
                      }}
                      className={`w-full px-3 py-2 rounded-xl text-xs font-medium text-slate-900 outline-none transition ${
                        editErrors.escalation_date
                          ? 'border border-rose-400 focus:ring-2 focus:ring-rose-400/20 bg-rose-50/20'
                          : 'bg-white border border-slate-300 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600'
                      }`}
                    />
                    {editErrors.escalation_date && (
                      <p className="text-[11px] text-rose-500 font-semibold mt-1">* {editErrors.escalation_date}</p>
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
                      className="w-full px-3 py-2 rounded-xl text-xs font-medium text-slate-900 bg-white border border-slate-300 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none transition"
                    >
                      <option value="Morning (06:30 - 03:00)">Morning (06:30 - 03:00)</option>
                      <option value="Evening (03:00 - 11:30)">Evening (03:00 - 11:30)</option>
                      <option value="Night (11:30 - 06:00)">Night (11:30 - 06:00)</option>
                      <option value="General (08:30 - 05:00)">General (08:30 - 05:00)</option>
                      <option value="Shift 1">Shift 1 (06:30 AM - 03:00 PM)</option>
                      <option value="Shift 2">Shift 2 (03:00 PM - 11:30 PM)</option>
                      <option value="Shift 3">Shift 3 (11:30 PM - 06:30 AM)</option>
                      {editFormData.shift && !['Shift 1', 'Shift 2', 'Shift 3', 'Morning (06:30 - 03:00)', 'Evening (03:00 - 11:30)', 'Night (11:30 - 06:00)', 'General (08:30 - 05:00)'].includes(editFormData.shift) && (
                        <option value={editFormData.shift}>{editFormData.shift}</option>
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      PRODUCT
                    </label>
                    <select
                      value={editFormData.product}
                      onChange={(e) => setEditFormData(prev => ({ ...prev, product: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl text-xs font-medium text-slate-900 bg-white border border-slate-300 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none transition cursor-pointer"
                    >
                      <option value="">Select Product</option>
                      {DEFAULT_PRODUCTS.map((prod) => (
                        <option key={prod} value={prod}>{prod}</option>
                      ))}
                      {editFormData.product && !DEFAULT_PRODUCTS.includes(editFormData.product) && (
                        <option value={editFormData.product}>{editFormData.product}</option>
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      MODEL
                    </label>
                    <input
                      type="text"
                      value={editFormData.model}
                      onChange={(e) => setEditFormData(prev => ({ ...prev, model: e.target.value }))}
                      placeholder="e.g. Model 123"
                      className="w-full px-3 py-2 rounded-xl text-xs font-medium text-slate-900 bg-white border border-slate-300 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none transition"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      PROCESS / OPERATION <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={editFormData.process_operation}
                      onChange={(e) => {
                        setEditFormData(prev => ({ ...prev, process_operation: e.target.value }));
                        if (editErrors.process_operation && e.target.value) {
                          setEditErrors(prev => ({ ...prev, process_operation: '' }));
                        }
                      }}
                      placeholder="e.g. Assembly Line 2"
                      className={`w-full px-3 py-2 rounded-xl text-xs font-medium text-slate-900 outline-none transition ${
                        editErrors.process_operation
                          ? 'border border-rose-400 focus:ring-2 focus:ring-rose-400/20 bg-rose-50/20'
                          : 'bg-white border border-slate-300 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600'
                      }`}
                    />
                    {editErrors.process_operation && (
                      <p className="text-[11px] text-rose-500 font-semibold mt-1">* {editErrors.process_operation}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      ISSUE TYPE
                    </label>
                    <select
                      value={editFormData.issue_type}
                      onChange={(e) => setEditFormData(prev => ({ ...prev, issue_type: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl text-xs font-medium text-slate-900 bg-white border border-slate-300 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none transition"
                    >
                      <option value="Process">Process</option>
                      <option value="Quality">Quality</option>
                      <option value="Safety">Safety</option>
                      <option value="5S">5S</option>
                      <option value="Machine">Machine</option>
                      <option value="Standard">Standard</option>
                      <option value="Kaizen">Kaizen</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      PRIORITY
                    </label>
                    <select
                      value={editFormData.priority}
                      onChange={(e) => setEditFormData(prev => ({ ...prev, priority: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl text-xs font-medium text-slate-900 bg-white border border-slate-300 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none transition"
                    >
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                      <option value="Critical">Critical</option>
                    </select>
                  </div>

                  {/* Department & Searchable Multi-User Select */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      ASSIGN DEPARTMENT <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={editFormData.department || ''}
                      onChange={(e) => {
                        const newDept = e.target.value;
                        setEditFormData(prev => ({
                          ...prev,
                          department: newDept,
                          executor: prev.department === newDept ? prev.executor : ''
                        }));
                        if (editErrors.department && newDept) {
                          setEditErrors(prev => ({ ...prev, department: '' }));
                        }
                      }}
                      className={`w-full px-3 py-2 rounded-xl text-xs font-medium text-slate-900 bg-white border outline-none transition cursor-pointer ${
                        editErrors.department
                          ? 'border-rose-400 focus:ring-2 focus:ring-rose-400/20 bg-rose-50/20'
                          : 'border-slate-300 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600'
                      }`}
                    >
                      <option value="">-- Select Department --</option>
                      {departmentList.map((dept) => (
                        <option key={dept} value={dept}>
                          {dept}
                        </option>
                      ))}
                    </select>
                    {editErrors.department && (
                      <p className="text-[11px] text-rose-500 font-semibold mt-1">* {editErrors.department}</p>
                    )}
                  </div>

                  <div className="relative" ref={userDropdownRef}>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      ASSIGNED EXECUTOR <span className="text-rose-500">*</span>
                    </label>
                    <div
                      onClick={() => {
                        if (!editFormData.department) {
                          setEditErrors(prev => ({ ...prev, department: 'Please select a department first' }));
                        }
                        setIsUserDropdownOpen(!isUserDropdownOpen);
                      }}
                      className={`w-full min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-medium bg-white border flex items-center justify-between cursor-pointer transition ${
                        editErrors.executor
                          ? 'border-rose-400 focus:ring-2 focus:ring-rose-400/20 bg-rose-50/20'
                          : 'border-slate-300 hover:border-slate-400'
                      }`}
                    >
                      <div className="flex flex-wrap gap-1 max-w-[220px]">
                        {!editFormData.department ? (
                          <span className="text-slate-400 italic">Select department first...</span>
                        ) : getSelectedUsers().length > 0 ? (
                          getSelectedUsers().map((u, i) => (
                            <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md text-[10px] font-bold border border-blue-200">
                              <span>{u}</span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleUser(u);
                                }}
                                className="hover:text-rose-600 transition cursor-pointer"
                                title="Remove user"
                              >
                                <X className="w-2.5 h-2.5" />
                              </button>
                            </span>
                          ))
                        ) : (
                          <span className="text-slate-400 italic">Select executor(s)...</span>
                        )}
                      </div>
                      <ChevronDown className={`w-3.5 h-3.5 text-slate-400 shrink-0 ml-1 transition-transform ${isUserDropdownOpen ? 'rotate-180' : ''}`} />
                    </div>

                    {isUserDropdownOpen && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-2 max-h-56 overflow-y-auto space-y-1">
                        {!editFormData.department ? (
                          <div className="text-center py-4 px-2 text-xs text-amber-600 font-medium bg-amber-50 rounded-lg">
                            Please select a Department from the dropdown above to view available executors
                          </div>
                        ) : (
                          <>
                            <div className="relative mb-2">
                              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                              <input
                                type="text"
                                value={userSearchTerm}
                                onChange={(e) => setUserSearchTerm(e.target.value)}
                                placeholder={`Search ${editFormData.department} users...`}
                                className="w-full pl-8 pr-2 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:bg-white focus:border-blue-500"
                                onClick={(e) => e.stopPropagation()}
                              />
                            </div>

                            {getDepartmentUsers(editFormData.department)
                              .filter(u => (u.name || '').toLowerCase().includes(userSearchTerm.toLowerCase()))
                              .map((u) => {
                                const isSelected = getSelectedUsers().includes(u.name);
                                return (
                                  <div
                                    key={u.id || u.name}
                                    onClick={() => handleToggleUser(u.name)}
                                    className={`px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between cursor-pointer transition ${
                                      isSelected ? 'bg-blue-50 text-blue-700 font-bold' : 'hover:bg-slate-50 text-slate-700'
                                    }`}
                                  >
                                    <span>{u.name} ({u.department || editFormData.department})</span>
                                    {isSelected && <Check className="w-3.5 h-3.5 text-blue-600" />}
                                  </div>
                                );
                              })}

                            {getDepartmentUsers(editFormData.department).filter(u => (u.name || '').toLowerCase().includes(userSearchTerm.toLowerCase())).length === 0 && (
                              <div className="text-center py-3 text-xs text-slate-400 italic">
                                No active users found in {editFormData.department}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                    {editErrors.executor && (
                      <p className="text-[11px] text-rose-500 font-semibold mt-1">* {editErrors.executor}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* 2. OBSERVATION & COMMENTS (EDITABLE) */}
              <div className="space-y-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    AUDIT OBSERVATION &amp; FINDINGS <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    value={editFormData.issue_observation}
                    onChange={(e) => {
                      setEditFormData(prev => ({ ...prev, issue_observation: e.target.value }));
                      if (editErrors.issue_observation && e.target.value) {
                        setEditErrors(prev => ({ ...prev, issue_observation: '' }));
                      }
                    }}
                    placeholder="Enter process deviation, finding or defect phenomenon..."
                    className="w-full px-3.5 py-2.5 rounded-xl text-xs font-medium text-slate-900 bg-white border border-slate-300 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none transition"
                  />
                  {editErrors.issue_observation && (
                    <p className="text-[11px] text-rose-500 font-semibold mt-1">* {editErrors.issue_observation}</p>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    ADDITIONAL COMMENTS / NOTES
                  </label>
                  <textarea
                    rows={2}
                    value={editFormData.comments}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, comments: e.target.value }))}
                    placeholder="Additional context or notes for the observation..."
                    className="w-full px-3.5 py-2.5 rounded-xl text-xs font-medium text-slate-900 bg-white border border-slate-300 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none transition"
                  />
                </div>
              </div>

              {/* 3. ATTACHMENTS (EDITABLE) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                    AUDIT EVIDENCE ATTACHMENTS
                  </label>
                  <span className="text-[10px] text-slate-400 font-medium">Click any attachment to preview or download</span>
                </div>

                {editAttachments.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="text-[10px] font-bold text-blue-700 uppercase tracking-wider flex items-center gap-1.5">
                      <Paperclip className="w-3.5 h-3.5 text-blue-600" />
                      <span>Existing Evidence Files ({editAttachments.length})</span>
                    </div>
                    <AttachmentChipList
                      attachments={editAttachments}
                      onPreview={(att) => setPreviewAttachment(att)}
                      onRemove={(idx) => handleRemoveExistingAttachment(idx)}
                    />
                  </div>
                )}

                {newFiles.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider flex items-center gap-1.5">
                      <Plus className="w-3.5 h-3.5 text-emerald-600" />
                      <span>New Files To Upload ({newFiles.length})</span>
                    </div>
                    <AttachmentChipList
                      attachments={newFiles.map(f => ({
                        name: f.name,
                        file: f,
                        type: f.name.split('.').pop() || '',
                        size: f.size
                      }))}
                      onPreview={(att) => setPreviewAttachment(att)}
                      onRemove={(idx) => handleRemoveNewFile(idx)}
                    />
                  </div>
                )}

                {editAttachments.length === 0 && newFiles.length === 0 && (
                  <div className="p-3 rounded-xl bg-slate-50 border border-dashed border-slate-200 text-xs text-slate-400 italic text-center">
                    No audit evidence attachments uploaded yet
                  </div>
                )}

                <label className="flex items-center justify-center gap-2 p-3.5 rounded-xl border border-dashed border-slate-300 bg-slate-50/50 hover:bg-slate-50 cursor-pointer text-xs text-slate-600 hover:text-blue-600 transition">
                  <UploadCloud className="w-4 h-4 text-slate-400" />
                  <span>Upload Audit Evidence Files (Images, PDF, Excel)</span>
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    accept="image/*,.pdf,.xlsx,.xls,.csv,.doc,.docx"
                    onChange={handleNewFilesSelect}
                  />
                </label>
              </div>
            </div>
          ) : (
            /* TAB 1: REQUESTER DETAILS - VIEW MODE (Matching IHLR exact structure) */
            <div className="space-y-6 animate-in fade-in duration-150">
              {/* 📁 1. INCIDENT & LINE DEFECT DETAILS */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-blue-600 text-xs font-bold uppercase tracking-wider">
                  <Folder className="w-4 h-4" />
                  <span>1. INCIDENT &amp; LINE DEFECT DETAILS</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs p-4 rounded-2xl bg-slate-50/90 border border-slate-200/90">
                  <div>
                    <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                     ISSUE NO
                    </span>
                    <strong className="text-slate-900 font-mono text-sm block mt-0.5 font-bold">
                      {reqNo}
                    </strong>
                  </div>

                  <div>
                    <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    ESCALATION DATE 

                    </span>
                    <strong className="text-slate-800 block mt-0.5 font-semibold">
                      {escDate}
                    </strong>
                  </div>

                  <div>
                    <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      SHIFT
                    </span>
                    <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                      <strong className="text-slate-800 font-semibold">{req.shift || 'Shift 1'}</strong>
                    </div>
                  </div>

                  <div>
                    <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      STATUS
                    </span>
                    <div className="mt-0.5">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${statusBadgeClass}`}>
                        {statusBadgeLabel}
                      </span>
                    </div>
                  </div>

                  <div>
                    <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      PRODUCT
                    </span>
                    <strong className="text-slate-800 block mt-0.5 font-semibold">
                      {req.product || '—'}
                    </strong>
                  </div>

                  <div>
                    <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      RESPONSIBILITY (DEPT)
                    </span>
                    <strong className="text-slate-800 block mt-0.5 font-bold">
                      {req.department || '—'}
                    </strong>
                    {req.executor && (
                      <span className="text-[11px] text-blue-600 font-medium block truncate">
                        {req.executor}
                      </span>
                    )}
                  </div>

                  <div>
                    <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      MODEL
                    </span>
                    <strong className="text-slate-800 block mt-0.5 font-bold">
                      {req.model || req.stage || '—'}
                    </strong>
                  </div>

                  <div>
                    <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      PROCESS / OPERATION
                    </span>
                    <strong className="text-slate-800 block mt-0.5 font-semibold">
                      {req.process_operation || req.line || '—'}
                    </strong>
                  </div>

                  <div>
                    <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      ISSUE TYPE
                    </span>
                    <strong className="text-slate-800 block mt-0.5 font-semibold">
                      {req.issue_type || 'Process'}
                    </strong>
                  </div>

                  {hasReassignments && (
                    <div>
                      <span className="block text-[11px] font-bold text-purple-600 uppercase tracking-wider">
                        REASSIGNED STATUS
                      </span>
                      <strong className="text-purple-700 font-mono text-sm block mt-0.5 font-bold">
                        Yes ({reassignCount} {reassignCount === 1 ? 'time' : 'times'})
                      </strong>
                    </div>
                  )}

                  <div>
                    <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      PRIORITY
                    </span>
                    <strong className="text-amber-700 block mt-0.5 font-bold">
                      {req.priority || 'Medium'}
                    </strong>
                  </div>

                  <div>
                    <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                       CREATED BY
                    </span>
                    <strong className="text-blue-700 block mt-0.5 font-semibold">
                      {req.created_by || 'Quality Auditor'}
                    </strong>
                    {resolveAuditorEmail(req) !== '—' && (
                      <span className="text-[11px] text-slate-500 font-medium block truncate">
                        {resolveAuditorEmail(req)}
                      </span>
                    )}
                  </div>

                  {req.notify_emails && (
                    <div className="col-span-full pt-2.5 mt-1 border-t border-slate-100">
                      <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5 text-blue-600" />
                        <span>NOTIFY / CC EMAILS</span>
                      </span>
                      <div className="flex flex-wrap gap-1.5 mt-0.5">
                        {req.notify_emails.split(',').map((s) => s.trim()).filter(Boolean).map((email) => (
                          <span
                            key={email}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-50 text-blue-700 text-[11px] font-semibold border border-blue-200"
                          >
                            <Mail className="w-3 h-3 text-blue-500 shrink-0" />
                            <span>{email}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
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
                    Issue / Observation
                    </span>
                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs text-slate-800 leading-relaxed font-medium">
                      {req.issue_observation || req.problem || 'No observation recorded.'}
                    </div>
                  </div>

                  {req.comments && (
                    <div>
                      <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Comments
                      </span>
                      <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs text-slate-800 leading-relaxed font-medium">
                        {req.comments}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 📎 3. DEFECT EVIDENCE & ATTACHMENTS */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-blue-600 text-xs font-bold uppercase tracking-wider">
                    <Paperclip className="w-4 h-4" />
                    <span>3. DEFECT EVIDENCE &amp; ATTACHMENTS ({creatorAttachments.length})</span>
                  </div>
                  <span className="text-[11px] text-slate-400">Click any file to preview or inspect</span>
                </div>

                {creatorAttachments.length > 0 ? (
                  <AttachmentChipList
                    attachments={creatorAttachments}
                    onPreview={(att) => setPreviewAttachment(att)}
                    readonly={true}
                  />
                ) : (
                  <div className="p-4 rounded-2xl bg-slate-50 border border-dashed border-slate-200 text-xs text-slate-400 italic text-center">
                    No defect evidence attachments provided for this audit finding.
                  </div>
                )}
              </div>

              {/* 4. REASSIGNMENT TRACKING HISTORY (Only shown in case of reassign status) */}
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
                              From: <strong className="text-slate-900">{entry.prev_resp_person || entry.previous_executor || '—'}</strong> ({entry.prev_resp || entry.previous_department || '—'})
                            </span>
                            <ArrowRightLeft className="w-3 h-3 text-purple-400 inline" />
                            <span className="text-purple-700 font-medium">
                              To: <strong className="text-purple-900">{entry.new_resp_person || entry.new_executor || '—'}</strong> ({entry.new_resp || entry.new_department || '—'})
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-500 font-mono">
                            {[entry.reassigned_by ? `by ${entry.reassigned_by}` : '', entry.reassigned_at ? formatDateDDMMYYYY(entry.reassigned_at) : ''].filter(Boolean).join(' • ')}
                          </span>
                        </div>
                        {(entry.remarks || entry.reason) && (
                          <div className="text-[11px] text-slate-700 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100 italic">
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
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-100 bg-white flex items-center justify-between shrink-0">
          {isEditMode ? (
            <>
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
                <span className="font-semibold text-slate-800">Updating audit details in Admin/Edit Mode.</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    initEditState(req);
                    setIsEditMode(false);
                  }}
                  disabled={isSaving}
                  className="px-4 py-2 bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 font-semibold text-xs rounded-xl border border-slate-300 transition cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleSaveChanges}
                  disabled={isSaving}
                  className="flex items-center gap-1.5 px-5 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Saving Changes...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 stroke-[2.5]" />
                      <span>Save All Changes</span>
                    </>
                  )}
                </button>
              </div>
            </>
          ) : (
            <>
              <div>
                {activeTab === 'closer' ? (
                  (temporaryEvidenceAttachments.length > 0 || permanentEvidenceAttachments.length > 0) && (
                    <span className="text-xs text-slate-400 font-medium">
                      {temporaryEvidenceAttachments.length + permanentEvidenceAttachments.length} closer evidence attachment{temporaryEvidenceAttachments.length + permanentEvidenceAttachments.length > 1 ? 's' : ''} available
                    </span>
                  )
                ) : activeTab === 'sign_tracks' ? (
                  <span className="text-xs text-slate-500 font-medium">
                    {hasReassignments
                      ? `${reassignCount} reassignment track${reassignCount > 1 ? 's' : ''} recorded`
                      : 'Original assignee tracking record'}
                  </span>
                ) : (
                  creatorAttachments.length > 0 && (
                    <span className="text-xs text-slate-400 font-medium">
                      {creatorAttachments.length} attachment{creatorAttachments.length > 1 ? 's' : ''} available
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

      {/* Universal Attachment Preview Modal (Interactive Excel spreadsheet, PDF, Image) */}
      <AttachmentPreviewModal
        isOpen={Boolean(previewAttachment)}
        attachment={previewAttachment}
        onClose={() => setPreviewAttachment(null)}
      />

      {/* Universal Export Format Selection Modal */}
      <ExportSelectionModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        title={`Export Report ${reqNo}`}
        subtitle="Choose whether to download as Excel (.xlsx) or PDF (.pdf) document"
        onExportExcel={handleExportExcel}
        onExportPdf={handleExportPdf}
      />
    </div>,
    document.body
  );
};

export default ProcessAuditRequestDetailsModal;
