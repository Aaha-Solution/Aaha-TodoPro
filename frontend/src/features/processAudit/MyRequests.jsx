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
  History
} from 'lucide-react';
import { processAuditService } from '../../services/processAuditService';
import { useAuth } from '../../hooks/useAuth';
import AttachmentThumbnail from '../../components/common/AttachmentThumbnail';
import AttachmentPreviewModal from '../../components/common/AttachmentPreviewModal';
import { triggerDirectDownload, resolveAttachmentUrl } from '../../components/common/attachmentUtils';
import { storage } from '../../utils/storage';

const MyRequests = () => {
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
  const [activeModalRequest, setActiveModalRequest] = useState(null);
  const [previewAttachment, setPreviewAttachment] = useState(null);
  const [previewImageError, setPreviewImageError] = useState(false);

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
    processAuditService.getUsers(reassignDept)
      .then((users) => {
        if (!isMounted) return;
        if (Array.isArray(users) && users.length > 0) {
          setDeptUsers(users);
        } else {
          const matched = dbUsers.filter(
            (u) => (u.department || u.dept || '').trim().toLowerCase() === reassignDept.trim().toLowerCase()
          );
          setDeptUsers(matched);
        }
      })
      .catch((err) => {
        console.error('Failed to fetch executors for department:', err);
        if (isMounted) {
          const matched = dbUsers.filter(
            (u) => (u.department || u.dept || '').trim().toLowerCase() === reassignDept.trim().toLowerCase()
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
        statusColor: 'bg-purple-50 text-purple-700 border-purple-200/80',
        dotColor: 'bg-purple-500',
      };
    }
    return {
      statusColor: 'bg-amber-50 text-amber-700 border-amber-200/80',
      dotColor: 'bg-amber-500',
    };
  };

  const getFullAttachmentUrl = (att) => resolveAttachmentUrl(att, 'process-audit');

  const getFileMeta = (file) => {
    const fileName = typeof file === 'string' ? file : (file?.name || file?.filename || file?.path || '');
    const ext = (file?.type || fileName.split('.').pop() || '').toUpperCase();
    const isImage = ['PNG', 'JPG', 'JPEG', 'GIF', 'WEBP', 'SVG'].includes(ext);
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

    const s = String(req.status || '').toLowerCase();
    const isSignedOff = (s.includes('approved') || s.includes('progress') || s.includes('signed')) && !s.includes('close');
    const matchesStatus =
      selectedStatus === 'All Statuses' ||
      (selectedStatus === 'Closed' && s.includes('close')) ||
      (selectedStatus === 'Open' && (s === 'open' || s.includes('open') || s.includes('reopen'))) ||
      ((selectedStatus === 'In Progress' || selectedStatus === 'Signed off' || selectedStatus === 'Approved') && isSignedOff) ||
      ((selectedStatus === 'Pending' || selectedStatus === 'Pending Execution') && (s.includes('pending') || (!isSignedOff && !s.includes('close') && !s.includes('open') && !s.includes('reject')))) ||
      (selectedStatus === 'Rejected' && s.includes('reject')) ||
      s === selectedStatus.toLowerCase();

    return matchesSearch && matchesShift && matchesStage && matchesExecutor && matchesStatus;
  });

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
        const rawStatus = r.status || 'Pending';
        const sLower = rawStatus.toLowerCase();
        const isSignedOff = (sLower.includes('progress') || sLower.includes('approved') || sLower.includes('signed')) && !sLower.includes('close');
        let status = rawStatus;
        if (isSignedOff) {
          status = isAdmin ? 'In Progress' : 'Signed off';
        } else if (sLower.includes('pending')) {
          status = 'Pending';
        }
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
              {isAdmin ? 'All Requests' : 'My Requests'}
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
            onClick={fetchRequests}
            disabled={loading}
            className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold border border-slate-200 shadow-2xs flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-60"
            title="Refresh database records"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

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
      <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs space-y-4">
        {/* Search Bar + Reset Button */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Request ID (e.g. PA-1), Line, Model, Executor, Comments..."
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          <button
            onClick={handleReset}
            className="w-full sm:w-auto px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-medium border border-slate-200 shadow-2xs transition whitespace-nowrap cursor-pointer"
          >
            Reset Filters
          </button>
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
              <option value={isAdmin ? "In Progress" : "Signed off"}>
                {isAdmin ? "In Progress" : "Signed off"}
              </option>
              <option value="Closed">Closed</option>
            </select>
          </div>
        </div>
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
                {filteredRequests.map((req) => {
                  const reqId = req.issue_no || (req.id ? `PA-${req.id}` : 'PA-1');
                  const dateStr = formatDate(req.escalation_date || req.created_at);
                  const prodStr = req.product || '-';
                  const stageStr = req.model || req.stage || 'Standard';
                  const lineStr = req.process_operation || req.line || 'General';
                  const creatorStr = req.created_by || req.creator || '-';
                  const executorStr = req.executor || 'Assigned Lead';
                  const rawStatus = req.status || 'Pending';
                  const sLower = rawStatus.toLowerCase();
                  const isSignedOff = (sLower.includes('progress') || sLower.includes('approved') || sLower.includes('signed')) && !sLower.includes('close');
                  let statusStr = rawStatus;
                  if (isSignedOff) {
                    statusStr = isAdmin ? 'In Progress' : 'Signed off';
                  } else if (sLower.includes('pending')) {
                    statusStr = 'Pending';
                  }
                  const meta = getStatusMeta(statusStr);

                  return (
                    <tr key={req.id} className="hover:bg-slate-50/70 transition">
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

                          {canEdit && !statusStr.toLowerCase().includes('close') && (
                            <button
                              type="button"
                              onClick={() => handleOpenReassignModal(req)}
                              className="p-1.5 bg-white hover:bg-blue-50 text-slate-500 hover:text-blue-600 rounded-lg border border-slate-200 transition shadow-2xs cursor-pointer"
                              title="Reassign Department or Executor"
                            >
                              <ArrowRightLeft className="w-3.5 h-3.5" />
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
      </div>

      {/* Details Modal */}
      {activeModalRequest && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl max-w-4xl lg:max-w-5xl w-full p-6 sm:p-7 shadow-2xl border border-slate-100 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {activeModalRequest.issue_no || `PA-${activeModalRequest.id}`} — Full Audit & Production Profile
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {(() => {
                      const rawModalStatus = activeModalRequest.status || 'Pending';
                      const sLower = rawModalStatus.toLowerCase();
                      const isSignedOff = (sLower.includes('progress') || sLower.includes('approved') || sLower.includes('signed')) && !sLower.includes('close');
                      let modalStatus = rawModalStatus;
                      if (isSignedOff) {
                        modalStatus = isAdmin ? 'In Progress' : 'Signed off';
                      } else if (sLower.includes('pending')) {
                        modalStatus = 'Pending';
                      }
                      return (
                        <>Status: <span className="font-semibold text-slate-800">{modalStatus}</span></>
                      );
                    })()}
                    {activeModalRequest.priority && (
                      <span className="ml-2 font-medium text-amber-600">({activeModalRequest.priority} Priority)</span>
                    )}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveModalRequest(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="my-5 overflow-y-auto pr-1 space-y-4 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-50 rounded-xl">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Escalation Date</span>
                  <span className="font-bold text-slate-800">{formatDate(activeModalRequest.escalation_date || activeModalRequest.created_at)}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Shift</span>
                  <span className="font-bold text-slate-800">{activeModalRequest.shift}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Product</span>
                  <span className="font-bold text-slate-800">{activeModalRequest.product}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Model / Stage</span>
                  <span className="font-bold text-slate-800">{activeModalRequest.model || activeModalRequest.stage}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 bg-slate-50 rounded-xl">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Created By</span>
                  <span className="font-bold text-blue-700">{activeModalRequest.created_by || '-'}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Process / Operation</span>
                  <span className="font-bold text-slate-800">{activeModalRequest.process_operation || activeModalRequest.line}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl">
                  <div className="flex items-center justify-between pb-1">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Department</span>
                   
                  </div>
                  <span className="font-bold text-slate-800">{activeModalRequest.department}</span>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Assigned Executor</span>
                  <span className="font-bold text-slate-800">{activeModalRequest.executor}</span>
                </div>
                {canEdit && !activeModalRequest.status?.toLowerCase().includes('close') && (
                  <button
                    type="button"
                    onClick={() => handleOpenReassignModal(activeModalRequest)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
                    title="Change department or executor assignment"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                    <span>Reassign Request</span>
                  </button>
                )}
              </div>

              {/* Reassignment History Audit Trail (when reassignments occurred) */}
              {(() => {
                const history = parseReassignmentHistory(activeModalRequest.reassignment_history);
                if (history.length === 0) return null;
                return (
                  <div className="p-4 bg-amber-50/50 rounded-2xl border border-amber-200/80 space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-amber-200/60">
                      <div className="flex items-center gap-2">
                        <History className="w-4 h-4 text-amber-700" />
                        <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider">
                          Reassignment History &amp; Audit Log
                        </h4>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-200/70 text-amber-900 border border-amber-300">
                        {history.length} {history.length === 1 ? 'Reassignment' : 'Reassignments'}
                      </span>
                    </div>

                    <div className="space-y-2.5">
                      {history.map((item, idx) => (
                        <div key={idx} className="p-3 bg-white rounded-xl border border-amber-100 shadow-2xs space-y-1.5">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between text-[11px] gap-1">
                            <span className="font-bold text-slate-800 flex items-center gap-1.5">
                              <span className="w-4 h-4 rounded-full bg-amber-100 text-amber-800 text-[10px] font-mono flex items-center justify-center font-bold">
                                {idx + 1}
                              </span>
                              <span>Reassigned by <strong className="text-blue-700">{item.reassigned_by || 'Quality Auditor'}</strong></span>
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {item.reassigned_at ? new Date(item.reassigned_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 text-xs flex-wrap py-1">
                            <div className="px-2.5 py-1 bg-slate-100 rounded-lg text-slate-600 line-through text-[11px]">
                              {item.previous_department} ({item.previous_executor})
                            </div>
                            <span className="text-amber-600 font-bold">➔</span>
                            <div className="px-2.5 py-1 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg font-bold text-[11px]">
                              {item.new_department} ({item.new_executor})
                            </div>
                          </div>

                          {item.reason && (
                            <p className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100 italic">
                              &ldquo;{item.reason}&rdquo;
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {activeModalRequest.issue_observation && (
                <div className="p-3 bg-slate-50 rounded-xl">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold mb-1">Issue Observation</span>
                  <p className="text-slate-700 whitespace-pre-wrap">{activeModalRequest.issue_observation}</p>
                </div>
              )}

              {activeModalRequest.comments && (
                <div className="p-3 bg-slate-50 rounded-xl">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold mb-1">Comments</span>
                  <p className="text-slate-700 whitespace-pre-wrap">{activeModalRequest.comments}</p>
                </div>
              )}

              {/* Creator Attachments Section (Always Visible) */}
              <div className="p-4 bg-gradient-to-r from-blue-50/60 via-slate-50 to-indigo-50/40 rounded-2xl border border-blue-200/80 shadow-2xs space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                  <div className="flex items-center gap-2">
                    <Paperclip className="w-4 h-4 text-blue-600" />
                    <span className="text-slate-900 font-extrabold uppercase text-[11px] tracking-wider">
                      Creator Attachments &amp; Incident Evidence
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      modalAttachments.length > 0
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-200 text-slate-600'
                    }`}>
                      {modalAttachments.length > 0 ? `${modalAttachments.length} file${modalAttachments.length > 1 ? 's' : ''}` : '0 files attached'}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500 font-medium">
                    Audit Creator: <strong className="text-blue-700">{activeModalRequest.created_by || 'Quality Auditor'}</strong>
                  </span>
                </div>

                {modalAttachments.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 pt-1">
                    {modalAttachments.map((rawAtt, i) => {
                      const fullUrl = getFullAttachmentUrl(rawAtt);
                      const meta = getFileMeta(rawAtt);
                      const IconComponent = meta.icon;
                      const att = {
                        ...rawAtt,
                        url: fullUrl,
                        isImage: meta.isImage,
                        isPdf: meta.isPdf,
                        isExcel: meta.isExcel,
                        isPpt: meta.isPpt,
                        type: rawAtt.type || rawAtt.name?.split('.').pop()?.toUpperCase() || 'FILE',
                      };

                      return (
                        <div
                          key={i}
                          onClick={() => setPreviewAttachment(att)}
                          className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-slate-200 shadow-2xs hover:border-blue-400 hover:shadow-xs transition cursor-pointer group"
                        >
                          <div className="flex items-center gap-2.5 min-w-0 pr-2">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${meta.badgeBg}`}>
                              <IconComponent className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-800 truncate group-hover:text-blue-600 transition text-xs" title={att.name}>
                                {att.name}
                              </p>
                              <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-0.5">
                                <span>{meta.typeName}</span>
                                {att.size && (
                                  <>
                                    <span>•</span>
                                    <span>{att.size}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => setPreviewAttachment(att)}
                              className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                              title="Preview file"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>

                            {att.url && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  triggerDirectDownload(att.url, att.name);
                                }}
                                className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition cursor-pointer"
                                title="Download file directly"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-3 bg-white/80 rounded-xl border border-dashed border-slate-200 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-400 flex items-center justify-center shrink-0">
                      <Paperclip className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-600">
                        No technical drawings or evidence files were attached by creator ({activeModalRequest.created_by || 'Quality Auditor'})
                      </p>
                      <p className="text-[10px] text-slate-400">
                        Any incident photos or documents uploaded during observation creation will appear here for review.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Executor Resolution & Action Report if present */}
              {(activeModalRequest.root_cause ||
                activeModalRequest.corrective_action ||
                activeModalRequest.standardization_details ||
                activeModalRequest.target_date ||
                (activeModalRequest.action_attachments && activeModalRequest.action_attachments !== '[]')) && (
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/90 space-y-3.5">
                  <div className="flex items-center justify-between pb-2.5 border-b border-slate-200">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                        Executor Corrective Action &amp; Standardization Report
                      </h4>
                    </div>
                    {(activeModalRequest.approved_by || activeModalRequest.action_taken_by) && (
                      <span className="text-[10px] text-slate-500">
                        Approved by: <strong className="text-emerald-700 font-bold">{activeModalRequest.approved_by || activeModalRequest.action_taken_by}</strong>
                        {activeModalRequest.approved_at && (
                          <span className="ml-1 text-slate-400 font-mono text-[9px]">
                            ({formatDate(activeModalRequest.approved_at)})
                          </span>
                        )}
                      </span>
                    )}
                  </div>

                  {activeModalRequest.root_cause && (
                    <div>
                      <span className="text-[#003366] block font-bold text-[10px] uppercase mb-1">Root cause</span>
                      <p className="p-3 bg-white rounded-xl border border-slate-200 text-slate-800 leading-relaxed whitespace-pre-wrap text-xs">
                        {activeModalRequest.root_cause}
                      </p>
                    </div>
                  )}

                  {activeModalRequest.corrective_action && (
                    <div>
                      <span className="text-[#003366] block font-bold text-[10px] uppercase mb-1">Corrective Action (by Resp. Team)</span>
                      <p className="p-3 bg-white rounded-xl border border-slate-200 text-slate-800 leading-relaxed whitespace-pre-wrap text-xs">
                        {activeModalRequest.corrective_action}
                      </p>
                    </div>
                  )}

                  {(() => {
                    const actionAtts = getAttachmentsList(activeModalRequest.action_attachments);
                    if (actionAtts.length === 0) return null;
                    return (
                      <div>
                        <span className="text-[#003366] block font-bold text-[10px] uppercase mb-1.5">Action Attachments ({actionAtts.length})</span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {actionAtts.map((att, i) => {
                            const meta = getFileMeta(att);
                            const IconComponent = meta.icon;
                            const fullUrl = getFullAttachmentUrl(att);
                            return (
                              <div key={i} className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
                                <div className="flex items-center gap-2 min-w-0 pr-2">
                                  <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 border ${meta.badgeBg}`}>
                                    <IconComponent className="w-3.5 h-3.5" />
                                  </div>
                                  <span className="font-semibold text-slate-800 truncate text-[11px]" title={att.name}>{att.name}</span>
                                </div>
                                {fullUrl && (
                                  <div className="flex items-center gap-1 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => setPreviewAttachment({ ...att, url: fullUrl, isImage: meta.isImage, isPdf: meta.isPdf, isExcel: meta.isExcel, isPpt: meta.isPpt, type: att.type || meta.typeName })}
                                      className="p-1 text-slate-500 hover:text-blue-600 rounded-lg hover:bg-slate-100"
                                      title="Preview"
                                    >
                                      <Eye className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        triggerDirectDownload(fullUrl, att.name);
                                      }}
                                      className="p-1 text-slate-500 hover:text-blue-600 rounded-lg hover:bg-slate-100 cursor-pointer"
                                      title="Download file directly"
                                    >
                                      <Download className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                  {activeModalRequest.standardization_details && (
                    <div>
                      <span className="text-[#003366] block font-bold text-[10px] uppercase mb-1">Standardization details</span>
                      <p className="p-3 bg-white rounded-xl border border-slate-200 text-slate-800 leading-relaxed whitespace-pre-wrap text-xs">
                        {activeModalRequest.standardization_details}
                      </p>
                    </div>
                  )}

                  {activeModalRequest.target_date && (
                    <div className="flex items-center gap-2 text-xs pt-1">
                      <span className="text-[#003366] font-bold">Target Date:</span>
                      <span className="font-semibold text-slate-800 font-mono">{formatDate(activeModalRequest.target_date)}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Creator Sign-off & Closure Review Section */}
              <div className="p-5 bg-gradient-to-br from-slate-50 to-blue-50/20 rounded-2xl border border-slate-200/90 space-y-3.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2.5 border-b border-slate-200 gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
                      <MessageSquare className="w-4 h-4 text-blue-600" />
                      <span>Auditor Verification &amp; Final Sign-off</span>
                    </h4>
                  </div>
                  {activeModalRequest.status && (() => {
                    const rawModalStatus = activeModalRequest.status || 'Pending';
                    const sLower = rawModalStatus.toLowerCase();
                    const isSignedOff = (sLower.includes('progress') || sLower.includes('approved') || sLower.includes('signed')) && !sLower.includes('close');
                    let modalStatus = rawModalStatus;
                    if (isSignedOff) {
                      modalStatus = isAdmin ? 'In Progress' : 'Signed off';
                    } else if (sLower.includes('pending')) {
                      modalStatus = 'Pending';
                    }
                    return (
                      <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border self-start sm:self-auto ${getStatusMeta(modalStatus).statusColor}`}>
                        Current Status: {modalStatus}
                      </span>
                    );
                  })()}
                </div>

                {/* If already closed */}
                {activeModalRequest.status && activeModalRequest.status.toLowerCase().includes('close') ? (
                  <div className="space-y-3">
                    <div className="flex items-start gap-2.5 text-xs text-red-800 bg-red-50 border border-red-200 p-3.5 rounded-xl">
                      <CheckCheck className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold text-red-900 text-xs">
                          This observation has been verified and marked as CLOSED
                        </p>
                        <p className="text-[11px] text-red-700 mt-0.5">
                          {activeModalRequest.closed_by && `Closed by ${activeModalRequest.closed_by}`}
                          {activeModalRequest.closed_at && ` on ${formatDate(activeModalRequest.closed_at)}`}.
                        </p>
                      </div>
                    </div>

                    {activeModalRequest.creator_remark && (
                      <div className="p-3 bg-white rounded-xl border border-slate-200">
                        <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Auditor Closure Remark</span>
                        <p className="text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">
                          {activeModalRequest.creator_remark}
                        </p>
                      </div>
                    )}

                    {canEdit && (
                      <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-end justify-between gap-3 border-t border-slate-200/80">
                        <div className="w-full sm:w-60">
                          <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                            Change Status
                          </label>
                          <div className="relative">
                            <select
                              value={selectedClosureStatus}
                              onChange={(e) => setSelectedClosureStatus(e.target.value)}
                              className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none cursor-pointer shadow-2xs appearance-none pr-8"
                            >
                              <option value="Closed">Close</option>
                              <option value="Open">Open</option>
                            </select>
                            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleUpdateClosureStatus(selectedClosureStatus)}
                          disabled={actionLoading}
                          className={`px-5 py-2.5 rounded-xl font-bold text-xs shadow-md transition cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-60 ${
                            selectedClosureStatus === 'Open'
                              ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/20'
                              : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
                          }`}
                          title="Update status"
                        >
                          {actionLoading ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : selectedClosureStatus === 'Open' ? (
                            <RotateCcw className="w-3.5 h-3.5" />
                          ) : (
                            <CheckCheck className="w-3.5 h-3.5" />
                          )}
                          <span>{selectedClosureStatus === 'Open' ? 'Reopen Request' : 'Save Status'}</span>
                        </button>
                      </div>
                    )}
                  </div>
                ) : canEdit ? (
                  /* Form for adding remark and selecting Open / Close */
                  <div className="space-y-3">
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      Review the executor&apos;s corrective action report above. Enter your verification remarks and choose whether to <strong>Close</strong> the observation or keep it <strong>Open</strong> for monitoring.
                    </p>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Auditor Verification Remark
                      </label>
                      <textarea
                        value={creatorRemark}
                        onChange={(e) => setCreatorRemark(e.target.value)}
                        placeholder="Enter your verification observations, shopfloor checks, or reasons for closure / keeping open..."
                        rows={3}
                        className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none leading-relaxed"
                      />
                    </div>

                    <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-end justify-between gap-3">
                      <div className="w-full sm:w-60">
                        <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                          Status
                        </label>
                        <div className="relative">
                          <select
                            value={selectedClosureStatus}
                            onChange={(e) => setSelectedClosureStatus(e.target.value)}
                            className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none cursor-pointer shadow-2xs appearance-none pr-8"
                          >
                            <option value="Closed">Close</option>
                            <option value="Open">Open</option>
                          </select>
                          <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleUpdateClosureStatus(selectedClosureStatus)}
                        disabled={actionLoading}
                        className={`px-6 py-2.5 rounded-xl font-bold text-xs shadow-md transition cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-60 ${
                          selectedClosureStatus === 'Closed'
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
                            : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/20'
                        }`}
                      >
                        {actionLoading ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : selectedClosureStatus === 'Closed' ? (
                          <CheckCheck className="w-4 h-4" />
                        ) : (
                          <RotateCcw className="w-4 h-4" />
                        )}
                        <span>{selectedClosureStatus === 'Closed' ? 'Save as Closed' : 'Save as Open'}</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Read-only note for user roles */
                  <div className="space-y-3">
                    {activeModalRequest.creator_remark ? (
                      <div className="p-3 bg-white rounded-xl border border-slate-200">
                        <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Auditor Remark</span>
                        <p className="text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">{activeModalRequest.creator_remark}</p>
                      </div>
                    ) : (
                      <div className="p-3.5 bg-slate-100/80 rounded-xl border border-slate-200 text-xs text-slate-500 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-slate-400 shrink-0" />
                        <span>Awaiting auditor verification and final sign-off from Incoming Quality.</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end pt-4 border-t border-slate-100">
              <button
                onClick={() => setActiveModalRequest(null)}
                className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Universal Interactive Attachment Preview Modal (Interactive Excel Spreadsheet, PDF, Image) */}
      <AttachmentPreviewModal
        isOpen={Boolean(previewAttachment)}
        attachment={previewAttachment}
        onClose={() => setPreviewAttachment(null)}
      />

      {/* Reassign Department & Executor Modal */}
      {showReassignModal && reassigningRequest && createPortal(
        <div 
          className="fixed inset-0 z-[10001] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in"
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

export default MyRequests;
