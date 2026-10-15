import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Download,
  Search,
  Eye,
  X,
  FileText,
  Paperclip,
  RefreshCw,
  AlertCircle,
  FileSpreadsheet,
  Presentation,
  File as FileIcon,
  Image as ImageIcon,
  ShieldAlert,
  CheckCircle2,
  CheckCheck,
  RotateCcw,
  MessageSquare,
  ChevronDown,
  ArrowRightLeft,
  History,
  Filter,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  Folder,
  Clock
} from 'lucide-react';
import { processAuditService } from '../../services/processAuditService';
import { useAuth } from '../../hooks/useAuth';
import AttachmentThumbnail from '../../components/common/AttachmentThumbnail';
import AttachmentPreviewModal from '../../components/common/AttachmentPreviewModal';
import { triggerDirectDownload, resolveAttachmentUrl } from '../../components/common/attachmentUtils';
import { storage } from '../../utils/storage';
import ProcessAuditRequestDetailsModal from './ProcessAuditRequestDetailsModal';
import { getProcessAuditDisplayStatus } from './processAuditExportUtils';

const AllRequests = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const savedUser = storage.getUser();
  const currentUser = user || savedUser;

  const currentDept = (currentUser?.department || (() => {
    try {
      const u = sessionStorage.getItem('todo_user') || localStorage.getItem('todo_user');
      return u ? JSON.parse(u)?.department : '';
    } catch {
      return '';
    }
  })() || '').trim();

  const userRole = (currentUser?.role || (() => {
    try {
      const u = sessionStorage.getItem('todo_user') || localStorage.getItem('todo_user');
      return u ? JSON.parse(u)?.role : '';
    } catch {
      return '';
    }
  })() || '').trim().toUpperCase();

  const isIncomingQuality = currentDept.toUpperCase() === 'INCOMING QUALITY';
  const isAdmin = userRole === 'ADMIN' || isIncomingQuality;
  const canEdit = isIncomingQuality || isAdmin;

  const [searchParams] = useSearchParams();
  const queryRequestId = searchParams.get('requestId') || searchParams.get('id');

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedShift, setSelectedShift] = useState('All Shifts');
  const [selectedStage, setSelectedStage] = useState('All Stages');
  const [selectedExecutor, setSelectedExecutor] = useState('All Executors');
  const [selectedStatus, setSelectedStatus] = useState('All Statuses');
  const [showFilters, setShowFilters] = useState(Boolean(queryRequestId));
  const hasActiveFilters =
    Boolean((search || '').trim()) ||
    selectedShift !== 'All Shifts' ||
    selectedStage !== 'All Stages' ||
    selectedExecutor !== 'All Executors' ||
    selectedStatus !== 'All Statuses';
  const [activeModalRequest, setActiveModalRequest] = useState(null);
  const [modalTab, setModalTab] = useState('requester'); // 'requester' | 'closer'
  const [previewAttachment, setPreviewAttachment] = useState(null);
  const [previewImageError, setPreviewImageError] = useState(false);

  // Pagination State (matching Approvals tab with max 10)
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  // Reset to page 1 on filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search, selectedShift, selectedStage, selectedExecutor, selectedStatus]);

  const [creatorRemark, setCreatorRemark] = useState('');
  const [selectedClosureStatus, setSelectedClosureStatus] = useState('Closed');
  const [actionLoading, setActionLoading] = useState(false);

  // Reassignment State
  const [dbUsers, setDbUsers] = useState([]);
  const [deptUsers, setDeptUsers] = useState([]);
  const [loadingDeptUsers, setLoadingDeptUsers] = useState(false);
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [reassigningRequest, setReassigningRequest] = useState(null);
  const [reassignDept, setReassignDept] = useState('');
  const [reassignExecutor, setReassignExecutor] = useState('');
  const [reassignReason, setReassignReason] = useState('');
  const [reassignLoading, setReassignLoading] = useState(false);

  const departmentList = Array.from(
    new Set([
      'PRODUCTION',
      'MAINTENANCE',
      'PED',
      'MATERIALS',
      'MARKETING',
      'INCOMING QUALITY',
      ...dbUsers.map((u) => (u.department || u.dept || '').trim()).filter(Boolean),
    ])
  );

  const distinctExecutors = React.useMemo(() => {
    const set = new Set();
    dbUsers.forEach((u) => {
      if (u.name) set.add(u.name);
    });
    requests.forEach((r) => {
      if (r.executor) {
        r.executor.split(',').forEach((e) => {
          const trimmed = e.trim();
          if (trimmed && trimmed !== '—') set.add(trimmed);
        });
      }
    });
    return Array.from(set).sort();
  }, [dbUsers, requests]);

  useEffect(() => {
    let isMounted = true;
    processAuditService.getUsers()
      .then((users) => {
        if (isMounted && Array.isArray(users)) setDbUsers(users);
      })
      .catch((err) => console.error('Failed to load users:', err));
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    if (!reassignDept) {
      setDeptUsers([]);
      return;
    }
    let isMounted = true;
    setLoadingDeptUsers(true);
    const isUserActive = (u) => {
      if (!u) return false;
      if (u.is_active === false || u.is_active === 0 || u.is_active === '0') return false;
      const s = String(u.status || 'ACTIVE').trim().toUpperCase();
      return s !== 'INACTIVE';
    };

    processAuditService.getUsers(reassignDept)
      .then((users) => {
        if (!isMounted) return;
        if (Array.isArray(users) && users.length > 0) {
          setDeptUsers(users.filter(isUserActive));
        } else {
          const matched = dbUsers.filter(
            (u) => (u.department || u.dept || '').trim().toLowerCase() === reassignDept.trim().toLowerCase() && isUserActive(u)
          );
          setDeptUsers(matched);
        }
      })
      .catch((err) => {
        console.error('Failed to fetch executors for department:', err);
        if (isMounted) {
          const matched = dbUsers.filter(
            (u) => (u.department || u.dept || '').trim().toLowerCase() === reassignDept.trim().toLowerCase() && isUserActive(u)
          );
          setDeptUsers(matched);
        }
      })
      .finally(() => {
        if (isMounted) setLoadingDeptUsers(false);
      });

    return () => { isMounted = false; };
  }, [reassignDept, dbUsers]);

  const parseReassignmentHistory = (hist) => {
    if (!hist) return [];
    if (Array.isArray(hist)) return hist;
    if (typeof hist === 'string') {
      try {
        const parsed = JSON.parse(hist);
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        return [];
      }
    }
    return [];
  };

  const handleOpenReassignModal = (reqItem) => {
    const target = reqItem || activeModalRequest;
    if (!target) return;
    setReassigningRequest(target);
    const targetDept = target.department || 'PRODUCTION';
    setReassignDept(targetDept);
    setReassignExecutor(target.executor || '');
    setReassignReason('');
    setShowReassignModal(true);
  };

  const handleConfirmReassign = async () => {
    if (!reassigningRequest) return;
    if (!reassignDept || !reassignExecutor) {
      alert('Please choose a department and a person to reassign to.');
      return;
    }
    if (!reassignReason.trim()) {
      alert('Please enter a reason for reassigning this request.');
      return;
    }

    setReassignLoading(true);
    try {
      const payload = {
        new_department: reassignDept.trim(),
        new_executor: reassignExecutor.trim(),
        reason: reassignReason.trim(),
        reassigned_by: user?.name || user?.email || 'Quality Auditor',
        reassigned_by_id: user?.id || null,
        role: user?.role,
        user_department: currentDept
      };

      const updated = await processAuditService.reassignRequest(reassigningRequest.id, payload);

      const merged = {
        ...reassigningRequest,
        ...updated,
        department: reassignDept.trim(),
        executor: reassignExecutor.trim(),
        reassignment_history: updated.reassignment_history || [
          ...parseReassignmentHistory(reassigningRequest.reassignment_history),
          {
            id: parseReassignmentHistory(reassigningRequest.reassignment_history).length + 1,
            reassigned_at: new Date().toISOString(),
            reassigned_by: user?.name || user?.email || 'Quality Auditor',
            reassigned_by_id: user?.id || null,
            previous_department: reassigningRequest.department,
            previous_executor: reassigningRequest.executor,
            new_department: reassignDept.trim(),
            new_executor: reassignExecutor.trim(),
            reason: reassignReason.trim()
          }
        ]
      };

      setRequests((prev) =>
        prev.map((r) => (r.id === reassigningRequest.id || r.issue_no === reassigningRequest.issue_no ? merged : r))
      );

      if (activeModalRequest && (activeModalRequest.id === reassigningRequest.id || activeModalRequest.issue_no === reassigningRequest.issue_no)) {
        setActiveModalRequest(merged);
      }

      alert(`Request ${merged.issue_no || reassigningRequest.id} has been reassigned to ${reassignExecutor} (${reassignDept}).`);
      setShowReassignModal(false);
      setReassigningRequest(null);
    } catch (err) {
      console.error('Failed to reassign request:', err);
      alert('Could not reassign the request. Please try again.');
    } finally {
      setReassignLoading(false);
    }
  };

  useEffect(() => {
    if (activeModalRequest) {
      const s = (activeModalRequest.status || '').toLowerCase();
      const isAlreadyClosed = s.includes('close');
      const isAlreadyOpen = s === 'open' || s.includes('open') || s.includes('reopen');

      // Only populate existing remark if the auditor has previously closed or opened it,
      // and ensure it does not mistakenly carry over the initial creation comments
      const existingRemark = (activeModalRequest.creator_remark || '').trim();
      const initialComments = (activeModalRequest.comments || '').trim();

      if ((isAlreadyClosed || isAlreadyOpen) && existingRemark && existingRemark !== initialComments) {
        setCreatorRemark(existingRemark);
      } else {
        setCreatorRemark('');
      }

      setSelectedClosureStatus(isAlreadyOpen ? 'Open' : 'Closed');
      setModalTab('requester');
    }
  }, [activeModalRequest?.id]);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const params = {};
      if (!isAdmin && (currentUser?.name || currentUser?.email || currentUser?.id)) {
        params.user = currentUser?.name || currentUser?.email;
        params.user_id = currentUser?.id;
        params.role = currentUser?.role;
      }
      const data = await processAuditService.getRequests(params);
      setRequests(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load requests from DB:', err);
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

    window.addEventListener('processAuditLiveUpdate', handleLiveUpdate);

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      window.removeEventListener('processAuditLiveUpdate', handleLiveUpdate);
    };
  }, []);

  // Deep-linking from notification or URL query (?requestId=14)
  useEffect(() => {
    if (queryRequestId && requests.length > 0) {
      const match = requests.find(
        (r) =>
          String(r.id) === String(queryRequestId) ||
          String(r.issue_no || '').toLowerCase() === String(queryRequestId).toLowerCase()
      );
      if (match) {
        setActiveModalRequest(match);
      }
    }
  }, [queryRequestId, requests]);

  const handleUpdateClosureStatus = async (targetStatus) => {
    if (!activeModalRequest) return;
    const reqId = activeModalRequest.id;
    const newStatus = targetStatus || selectedClosureStatus || 'Closed';

    try {
      setActionLoading(true);
      const payload = {
        creator_remark: creatorRemark.trim(),
        closed_by: user?.name || user?.email || 'Request Creator',
        closed_by_id: user?.id || null,
      };

      const updated = await processAuditService.updateRequestStatus(reqId, newStatus, payload);

      const merged = {
        ...activeModalRequest,
        ...updated,
        status: newStatus,
        creator_remark: creatorRemark.trim(),
        closed_by: newStatus.toLowerCase().includes('close') ? (user?.name || 'Request Creator') : activeModalRequest.closed_by,
        closed_at: newStatus.toLowerCase().includes('close') ? new Date().toISOString() : activeModalRequest.closed_at,
      };

      setRequests((prev) =>
        prev.map((r) => (r.id === reqId || r.issue_no === reqId ? merged : r))
      );
      setActiveModalRequest(merged);

      alert(`Request ${merged.issue_no || reqId} has been updated to ${newStatus}.`);
    } catch (err) {
      console.error('Failed to update closure status:', err);
      alert('Could not update the status. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (dateVal) => {
    if (!dateVal) return '-';
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return String(dateVal);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const getStatusMeta = (status) => {
    const s = (status || '').toLowerCase();
    if (s.includes('close')) {
      return {
        statusColor: 'bg-red-50 text-red-700 border-red-200',
        dotColor: 'bg-red-500',
      };
    }
    if (s.includes('signed off') || s.includes('signed')) {
      return {
        statusColor: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
        dotColor: 'bg-emerald-500',
      };
    }
    if (s.includes('progress')) {
      return {
        statusColor: 'bg-indigo-50 text-indigo-700 border-indigo-200/80',
        dotColor: 'bg-indigo-500',
      };
    }
    if (s.includes('approved') && !s.includes('partially') && !s.includes('pending')) {
      return {
        statusColor: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
        dotColor: 'bg-emerald-500',
      };
    }
    if (s === 'open' || s.includes('reopen') || s.includes('further')) {
      return {
        statusColor: 'bg-sky-50 text-sky-700 border-sky-200/80',
        dotColor: 'bg-sky-500',
      };
    }
    if (s.includes('reject')) {
      return {
        statusColor: 'bg-rose-50 text-rose-700 border-rose-200/80',
        dotColor: 'bg-rose-500',
      };
    }
    if (s.includes('partially')) {
      return {
        statusColor: 'bg-teal-50 text-teal-700 border-teal-200/80',
        dotColor: 'bg-teal-500',
      };
    }
    if (s.includes('approval')) {
      return {
        statusColor: 'bg-amber-50 text-amber-700 border-amber-200/80',
        dotColor: 'bg-amber-500',
      };
    }
    return {
      statusColor: 'bg-rose-50 text-rose-700 border-rose-200/80',
      dotColor: 'bg-rose-500',
    };
  };

  const getFullAttachmentUrl = (att) => resolveAttachmentUrl(att, 'process-audit');

  const getFileMeta = (file) => {
    const fileName = typeof file === 'string' ? file : (file?.name || file?.filename || file?.path || '');
    const ext = (file?.type || fileName.split('.').pop() || '').toUpperCase();
    const isImage = ['PNG', 'JPG', 'JPEG', 'GIF', 'WEBP', 'SVG', 'JFIF', 'BMP'].includes(ext);
    const isPdf = ext === 'PDF';
    const isExcel = ['XLS', 'XLSX', 'CSV', 'XLSM'].includes(ext);
    const isPpt = ['PPT', 'PPTX', 'PPSX'].includes(ext);

    if (isImage) {
      return {
        badgeBg: 'bg-blue-50 text-blue-600 border-blue-200',
        icon: ImageIcon,
        typeName: 'Image',
        isImage: true,
      };
    }
    if (isPdf) {
      return {
        badgeBg: 'bg-red-50 text-red-600 border-red-200',
        icon: FileText,
        typeName: 'PDF Document',
        isPdf: true,
      };
    }
    if (isExcel) {
      return {
        badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        icon: FileSpreadsheet,
        typeName: 'Excel Spreadsheet',
        isExcel: true,
      };
    }
    if (isPpt) {
      return {
        badgeBg: 'bg-orange-50 text-orange-700 border-orange-200',
        icon: Presentation,
        typeName: 'PowerPoint Presentation',
        isPpt: true,
      };
    }
    return {
      badgeBg: 'bg-slate-50 text-slate-700 border-slate-200',
      icon: FileIcon,
      typeName: 'Document',
      isOther: true,
    };
  };

  const handleReset = () => {
    setSearch('');
    setSelectedShift('All Shifts');
    setSelectedStage('All Stages');
    setSelectedExecutor('All Executors');
    setSelectedStatus('All Statuses');
    setCurrentPage(1);
  };

  const canUserAccessRequest = (req, u, adminFlag) => {
    if (adminFlag) return true;
    if (!u || !req) return false;

    const uId = u.id ? Number(u.id) : null;
    const uName = (u.name || '').trim().toLowerCase();
    const uEmail = (u.email || '').trim().toLowerCase();

    // 1. Creator check
    const reqCreatorId = req.created_by_id ? Number(req.created_by_id) : null;
    if (uId && reqCreatorId && uId === reqCreatorId) return true;

    const creatorName = (req.created_by || req.creator || '').trim().toLowerCase();
    if (uName && (creatorName === uName || creatorName.includes(uName))) return true;
    if (uEmail && (creatorName === uEmail || creatorName.includes(uEmail))) return true;

    // 2. Assigned Executor check
    const execStr = (req.executor || '').trim().toLowerCase();
    if (execStr) {
      if (uName && (execStr === uName || execStr.includes(uName))) return true;
      if (uEmail && (execStr === uEmail || execStr.includes(uEmail))) return true;
      const tokens = execStr.replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter(Boolean);
      if (uName && tokens.includes(uName)) return true;
    }

    return false;
  };

  const filteredRequests = requests.filter((req) => {
    // Only show requests to Admin, the Creator who raised it, or the Assigned Executor
    if (!isAdmin) {
      const canAccess = canUserAccessRequest(req, currentUser, isAdmin);
      if (!canAccess) return false;
    }

    const reqId = String(req.issue_no || (req.id ? `PA-${req.id}` : '')).toLowerCase();
    const line = String(req.process_operation || req.line || '').toLowerCase();
    const executor = String(req.executor || '').toLowerCase();
    const creator = String(req.created_by || req.creator || '').toLowerCase();
    const stage = String(req.model || req.stage || '').toLowerCase();
    const product = String(req.product || '').toLowerCase();
    const dept = String(req.department || '').toLowerCase();
    const comments = String(req.comments || '').toLowerCase();
    const observation = String(req.issue_observation || '').toLowerCase();
    const q = search.toLowerCase();

    const matchesSearch =
      !q ||
      reqId.includes(q) ||
      line.includes(q) ||
      executor.includes(q) ||
      creator.includes(q) ||
      stage.includes(q) ||
      product.includes(q) ||
      dept.includes(q) ||
      comments.includes(q) ||
      observation.includes(q);

    const matchesShift =
      selectedShift === 'All Shifts' ||
      String(req.shift || '').toLowerCase().includes(selectedShift.toLowerCase());

    const matchesStage =
      selectedStage === 'All Stages' ||
      String(req.model || req.stage || '').toLowerCase() === selectedStage.toLowerCase();

    const matchesExecutor =
      selectedExecutor === 'All Executors' ||
      String(req.executor || '').toLowerCase().includes(selectedExecutor.toLowerCase());

    const displayStatus = getProcessAuditDisplayStatus(req);
    const matchesStatus =
      selectedStatus === 'All Statuses' ||
      selectedStatus === displayStatus ||
      (selectedStatus === 'Signed off' && (displayStatus === 'Signed off' || displayStatus === 'In Progress')) ||
      (selectedStatus === 'In Progress' && (displayStatus === 'In Progress' || displayStatus === 'Approval Pending'));

    return matchesSearch && matchesShift && matchesStage && matchesExecutor && matchesStatus;
  });

  const totalRecords = filteredRequests.length;
  const totalPages = Math.ceil(totalRecords / rowsPerPage) || 1;
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = Math.min(startIndex + rowsPerPage, totalRecords);
  const paginatedRequests = filteredRequests.slice(startIndex, endIndex);

  const handleExportCSV = () => {
    const headers = 'REQUEST ID,DATE,SHIFT,PRODUCTION,STAGE,LINE,CREATOR,EXECUTOR,STATUS\n';
    const rows = filteredRequests
      .map((r) => {
        const id = r.issue_no || `PA-${r.id}`;
        const date = formatDate(r.escalation_date || r.created_at);
        const shift = r.shift || '';
        const prod = r.product || '';
        const stage = r.model || r.stage || '';
        const line = r.process_operation || r.line || '';
        const creator = r.created_by || r.creator || '-';
        const executor = r.executor || '';
        const status = getProcessAuditDisplayStatus(r);
        return `${id},${date},${shift},"${prod}",${stage},"${line}","${creator}","${executor}",${status}`;
      })
      .join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `INEL_Production_Requests_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  // Parse attachments safely for modal
  const getAttachmentsList = (attData) => {
    if (!attData) return [];
    let list = [];
    if (Array.isArray(attData)) {
      list = attData;
    } else if (typeof attData === 'string') {
      const trimmed = attData.trim();
      if (!trimmed || trimmed === '[]' || trimmed === 'null' || trimmed === '""') {
        return [];
      }
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        try {
          const parsed = JSON.parse(trimmed);
          list = Array.isArray(parsed) ? parsed : [parsed];
        } catch {
          list = [];
        }
      } else if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        try {
          const parsed = JSON.parse(trimmed);
          list = [parsed];
        } catch {
          list = [];
        }
      } else {
        list = trimmed.split(',').map((s) => s.trim()).filter(Boolean);
      }
    } else if (typeof attData === 'object') {
      list = [attData];
    }

    return list.map((item) => {
      if (typeof item === 'number' || (typeof item === 'string' && /^\d+$/.test(item.trim()))) {
        const id = String(item).trim();
        return {
          id,
          name: `Attachment #${id}`,
          url: `/api/process-audit/attachments/${id}`,
          path: `/api/process-audit/attachments/${id}`,
        };
      }
      if (typeof item === 'string') {
        const trimmed = item.trim();
        const rawName = trimmed.split('/').pop().split('\\').pop();
        if (trimmed.startsWith('/api/process-audit/attachments/') || trimmed.startsWith('attachments/')) {
          const id = trimmed.split('/').pop();
          return {
            id,
            name: rawName || `Attachment #${id}`,
            url: `/api/process-audit/attachments/${id}`,
            path: `/api/process-audit/attachments/${id}`,
          };
        }
        return {
          name: rawName || 'Attachment',
          path: trimmed.startsWith('uploads/') ? trimmed : `uploads/attachments/${trimmed}`,
          url: trimmed.startsWith('/api/') ? trimmed : `/api/process-audit/${trimmed.startsWith('uploads/') ? trimmed : `uploads/attachments/${trimmed}`}`,
        };
      }
      const itemUrl = item.url || (item.id ? `/api/process-audit/attachments/${item.id}` : (item.path ? (item.path.startsWith('/api/') ? item.path : `/api/process-audit/${item.path}`) : ''));
      return {
        ...item,
        name: item.name || item.filename || (item.path ? item.path.split('/').pop().split('\\').pop() : 'Attachment'),
        url: itemUrl,
      };
    });
  };

  const modalAttachments = activeModalRequest ? getAttachmentsList(activeModalRequest.attachments) : [];

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              All Requests
            </h1>
            {!canEdit && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                <Eye className="w-3.5 h-3.5 text-slate-500" />
                <span>View Only</span>
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            {canEdit
              ? 'Track, monitor, reassign, and verify auditor sign-off for shopfloor audit observations.'
              : 'View and track all shopfloor process audit requests in read-only mode.'}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleExportCSV}
            className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold border border-slate-200 shadow-2xs flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Filter Box */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-2xs space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-xs font-black uppercase tracking-tight text-slate-800 flex items-center gap-1.5">
              <SlidersHorizontal className="w-3.5 h-3.5 text-blue-600" />
              <span>Filter Observations</span>
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
            <button
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100/90 border border-rose-200/90 rounded-xl transition-all active:scale-95 cursor-pointer shadow-2xs"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Filters</span>
            </button>
          )}
        </div>

        {showFilters && (
          <div className="space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
            {/* Search Bar */}
            <div className="relative w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search Request ID (e.g. PA-1), Line, Model, Executor, Comments..."
                className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>

            {/* 4 Filter Dropdowns */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Shift
                </label>
                <select
                  value={selectedShift}
                  onChange={(e) => setSelectedShift(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
                >
                  <option>All Shifts</option>
                  <option>Morning</option>
                  <option>Evening</option>
                  <option>Night</option>
                  <option>General</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Stage / Model
                </label>
                <select
                  value={selectedStage}
                  onChange={(e) => setSelectedStage(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
                >
                  <option>All Stages</option>
                  <option value="Assembly">Assembly</option>
                  <option value="Inspection">Inspection</option>
                  <option value="Packaging">Packaging</option>
                  <option value="Raw Material">Raw Material</option>
                  <option value="Production">Production</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Executor
                </label>
                <select
                  value={selectedExecutor}
                  onChange={(e) => setSelectedExecutor(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
                >
                  <option value="All Executors">All Executors</option>
                  {distinctExecutors.map((exec) => (
                    <option key={exec} value={exec}>{exec}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Status
                </label>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
                >
                  <option value="All Statuses">All Statuses</option>
                  <option value="Pending">Pending</option>
                  <option value="Approval Pending">Approval Pending</option>
                  <option value={isAdmin ? "In Progress" : "Signed off"}>
                    {isAdmin ? "In Progress" : "Signed off"}
                  </option>
                  <option value="Closed">Closed</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Requests Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-400 text-xs">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
            Loading production requests from database...
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-xs">
            <AlertCircle className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            No matching requests found in database.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#f8fafc] border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3.5 px-4 text-center w-12 whitespace-nowrap align-middle">SL NO</th>
                  <th className="py-3.5 px-6 whitespace-nowrap align-middle">REQUEST ID</th>
                  <th className="py-3.5 px-4 whitespace-nowrap align-middle">Escalation Date </th>
                  <th className="py-3.5 px-4 whitespace-nowrap align-middle">SHIFT</th>
                  <th className="py-3.5 px-4 whitespace-nowrap align-middle">PRODUCT</th>
                  <th className="py-3.5 px-4 whitespace-nowrap align-middle">MODEL</th>
                  <th className="py-3.5 px-4 whitespace-nowrap align-middle">PROCESS/OPERATION</th>
                  <th className="py-3.5 px-4 whitespace-nowrap align-middle">CREATOR</th>
                  <th className="py-3.5 px-4 whitespace-nowrap align-middle">EXECUTOR</th>
                  <th className="py-3.5 px-3 whitespace-nowrap align-middle text-center">EVIDENCE</th>
                  <th className="py-3.5 px-4 whitespace-nowrap align-middle text-center">STATUS</th>
                  <th className="py-3.5 px-6 whitespace-nowrap align-middle text-center">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {paginatedRequests.map((req, idx) => {
                  const reqId = req.issue_no || (req.id ? `PA-${req.id}` : 'PA-1');
                  const dateStr = formatDate(req.escalation_date || req.created_at);
                  const prodStr = req.product || '-';
                  const stageStr = req.model || req.stage || 'Standard';
                  const lineStr = req.process_operation || req.line || 'General';
                  const creatorStr = req.created_by || req.creator || '-';
                  const executorStr = req.executor || 'Assigned Lead';
                  const statusStr = getProcessAuditDisplayStatus(req);
                  const meta = getStatusMeta(statusStr);

                  return (
                    <tr key={req.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-4 px-4 text-center font-mono font-semibold text-slate-400 align-middle whitespace-nowrap">
                        {startIndex + idx + 1}
                      </td>
                      <td className="py-4 px-6 font-bold text-blue-600 align-middle whitespace-nowrap">{reqId}</td>
                      <td className="py-4 px-4 text-slate-600 font-medium align-middle whitespace-nowrap">{dateStr}</td>
                      <td className="py-4 px-4 text-slate-600 font-medium align-middle whitespace-nowrap">{req.shift}</td>
                      <td className="py-4 px-4 text-slate-800 font-semibold align-middle whitespace-nowrap">{prodStr}</td>
                      <td className="py-4 px-4 text-slate-600 align-middle whitespace-nowrap">{stageStr}</td>
                      <td className="py-4 px-4 text-slate-700 font-medium align-middle whitespace-nowrap">{lineStr}</td>
                      <td className="py-4 px-4 text-slate-700 font-medium align-middle whitespace-nowrap">{creatorStr}</td>
                      <td className="py-4 px-4 text-slate-800 font-semibold align-middle whitespace-nowrap">{executorStr}</td>
                      <td className="py-4 px-3 text-center align-middle whitespace-nowrap">
                        <div className="flex items-center justify-center">
                          <AttachmentThumbnail
                            rawAttachment={req.action_attachments || req.attachments}
                            onClick={(e) => {
                              e?.stopPropagation?.();
                              setActiveModalRequest(req);
                            }}
                          />
                        </div>
                      </td>
                      <td className="py-4 px-4 text-center align-middle whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${meta.statusColor}`}>
                          {statusStr.toLowerCase().includes('close') ? (
                            <CheckCheck className="w-3.5 h-3.5 text-red-600" />
                          ) : (statusStr.toLowerCase().includes('signed') || statusStr.toLowerCase().includes('approved')) ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <span className={`w-1.5 h-1.5 rounded-full ${meta.dotColor}`}></span>
                          )}
                          <span>{statusStr}</span>
                        </span>
                        {statusStr.toLowerCase().includes('close') && req.closed_by && (
                          <div className="text-[10px] text-slate-500 mt-0.5">by <strong className="text-slate-700">{req.closed_by}</strong></div>
                        )}
                        {(statusStr.toLowerCase().includes('signed') || statusStr.toLowerCase().includes('progress') || statusStr.toLowerCase().includes('approved')) && !statusStr.toLowerCase().includes('close') && (req.approved_by || req.action_taken_by) && (
                          <div className="text-[10px] text-slate-500 mt-0.5">by <strong className="text-slate-700">{req.approved_by || req.action_taken_by}</strong></div>
                        )}
                      </td>
                      <td className="py-4 px-6 text-center align-middle whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          {canEdit && isSignedOff && !statusStr.toLowerCase().includes('close') ? (
                            <button
                              onClick={() => setActiveModalRequest(req)}
                              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition shadow-xs cursor-pointer flex items-center gap-1.5"
                              title="Review resolution and complete auditor sign-off"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Review &amp; Close</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => setActiveModalRequest(req)}
                              className="px-3 py-1 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 transition shadow-2xs cursor-pointer flex items-center gap-1"
                              title="View details"
                            >
                              <Eye className="w-3.5 h-3.5 text-slate-500" />
                              <span>View</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Controls */}
        {!loading && (
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
        )}
      </div>

      {/* Complete Inspection & Admin Edit Modal */}
      <ProcessAuditRequestDetailsModal
        isOpen={Boolean(activeModalRequest)}
        request={activeModalRequest}
        onClose={() => setActiveModalRequest(null)}
        onUpdated={() => {
          fetchRequests();
        }}
      />

      {/* Universal Interactive Attachment Preview Modal (Interactive Excel Spreadsheet, PDF, Image) */}
      <AttachmentPreviewModal
        isOpen={Boolean(previewAttachment)}
        attachment={previewAttachment}
        onClose={() => setPreviewAttachment(null)}
      />

      {/* Reassign Department & Executor Modal */}
      {showReassignModal && reassigningRequest && createPortal(
        <div 
          className="fixed inset-0 !m-0 !mt-0 z-[10001] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in"
          style={{ zIndex: 10001 }}
        >
          <div 
            className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200/80 space-y-5 animate-in zoom-in-95 relative"
            style={{ zIndex: 10002 }}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <ArrowRightLeft className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Reassign Audit Observation
                  </h3>
                  <p className="text-[11px] text-slate-500 font-mono">
                    {reassigningRequest.issue_no || `PA-${reassigningRequest.id}`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowReassignModal(false);
                  setReassigningRequest(null);
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Current Assignment banner */}
            <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-2xl text-xs space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Current Assignment
              </span>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-600">Department: <strong className="text-slate-800">{reassigningRequest.department}</strong></span>
                <span className="text-slate-600">Executor: <strong className="text-slate-800">{reassigningRequest.executor}</strong></span>
              </div>
            </div>

            {/* Form Fields */}
            <div className="space-y-3.5 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  New Department <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <select
                    value={reassignDept}
                    onChange={(e) => {
                      setReassignDept(e.target.value);
                      setReassignExecutor('');
                    }}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none cursor-pointer appearance-none pr-8"
                  >
                    {departmentList.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                    New Executor / Lead <span className="text-rose-500">*</span>
                  </label>
                  {loadingDeptUsers && (
                    <span className="text-[10px] text-blue-600 flex items-center gap-1">
                      <RefreshCw className="w-3 h-3 animate-spin" /> Loading team...
                    </span>
                  )}
                </div>
                <div className="relative">
                  <select
                    value={reassignExecutor}
                    onChange={(e) => setReassignExecutor(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none cursor-pointer appearance-none pr-8"
                  >
                    <option value="">-- Select Executor for {reassignDept} --</option>
                    {deptUsers.length === 0 ? (
                      <option value="" disabled>There is no users in the selected department</option>
                    ) : (
                      deptUsers.map((u) => (
                        <option key={u.id || u.name} value={u.name || u.email}>
                          {u.name || u.email} {u.role ? `(${u.role})` : ''}
                        </option>
                      ))
                    )}
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
                </div>
                {reassignDept && !loadingDeptUsers && deptUsers.length === 0 && (
                  <span className="text-[11px] text-amber-600 font-medium mt-1 flex items-center gap-1">
                    <ShieldAlert className="w-3.5 h-3.5 inline shrink-0" />
                    There is no users in the selected department
                  </span>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Reassignment Reason &amp; Note <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={reassignReason}
                  onChange={(e) => setReassignReason(e.target.value)}
                  placeholder="Explain why this request is being reassigned (e.g. wrong department selected at creation, transferred to responsible team, etc.)..."
                  className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none resize-none"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setShowReassignModal(false);
                  setReassigningRequest(null);
                }}
                disabled={reassignLoading}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReassign}
                disabled={reassignLoading}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/20 flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition"
              >
                {reassignLoading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Reassigning...</span>
                  </>
                ) : (
                  <>
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                    <span>Confirm Reassignment</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default AllRequests;
