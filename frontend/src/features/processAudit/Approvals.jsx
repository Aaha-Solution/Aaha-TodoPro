import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  ClipboardCheck,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Eye,
  X,
  RefreshCw,
  AlertCircle,
  FileText,
  Paperclip,
  Download,
  FileSpreadsheet,
  Presentation,
  File as FileIcon,
  Image as ImageIcon,
  UploadCloud,
  Calendar,
  Check,
  Trash2,
  AlertTriangle,
  CheckCheck,
  RotateCcw
} from 'lucide-react';
import { processAuditService } from '../../services/processAuditService';
import { useAuth } from '../../hooks/useAuth';

const ProcessAuditApprovals = () => {
  const { user } = useAuth();
  const isAdmin = (user?.role || '').toUpperCase() === 'ADMIN';

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [activeModalRequest, setActiveModalRequest] = useState(null);
  const [previewAttachment, setPreviewAttachment] = useState(null);

  // 5 Executor Response Inputs
  const [rootCause, setRootCause] = useState('');
  const [correctiveAction, setCorrectiveAction] = useState('');
  const [standardizationDetails, setStandardizationDetails] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [actionAttachments, setActionAttachments] = useState([]);
  const [newActionFiles, setNewActionFiles] = useState([]);
  const [formErrors, setFormErrors] = useState({});
  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectReasonInput, setRejectReasonInput] = useState('');
  const fileInputRef = useRef(null);

  const loadRequests = async () => {
    setLoading(true);
    try {
      const params = {};
      if (!isAdmin && user?.name) {
        params.executor = user.name;
        params.role = user?.role;
      }
      const data = await processAuditService.getRequests(params);
      setRequests(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load approval requests from DB:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  const formatDate = (dateVal) => {
    if (!dateVal) return '-';
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return String(dateVal);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const openReviewModal = (request) => {
    setActiveModalRequest(request);
    setRootCause(request.root_cause || '');
    setCorrectiveAction(request.corrective_action || '');
    setStandardizationDetails(request.standardization_details || '');
    setTargetDate(request.target_date || '');
    setActionAttachments(getAttachmentsList(request.action_attachments));
    setNewActionFiles([]);
    setFormErrors({});
    setIsRejecting(false);
    setRejectReasonInput('');
  };

  const handleActionFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setNewActionFiles((prev) => [...prev, ...files]);

    const newMeta = files.map((file) => {
      const ext = file.name.split('.').pop().toUpperCase();
      return {
        name: file.name,
        size: `${(file.size / (1024 * 1024)).toFixed(2)} MB`,
        type: ext,
        date: new Date().toLocaleDateString('en-GB'),
        isNew: true,
        rawFile: file,
        url: URL.createObjectURL(file),
      };
    });

    setActionAttachments((prev) => [...prev, ...newMeta]);
  };

  const removeActionAttachment = (indexToRemove) => {
    const target = actionAttachments[indexToRemove];
    if (target?.isNew && target?.rawFile) {
      setNewActionFiles((prev) => prev.filter((f) => f !== target.rawFile));
    }
    setActionAttachments((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleApprove = async (id) => {
    // Validate the required executor inputs
    const errors = {};
    if (!rootCause || !rootCause.trim()) {
      errors.rootCause = 'Please enter the Root cause before approving.';
    }
    if (!correctiveAction || !correctiveAction.trim()) {
      errors.correctiveAction = 'Please enter the Corrective Action (by Resp. Team) before approving.';
    }
    if (!targetDate || !targetDate.trim()) {
      errors.targetDate = 'Please select a Target Date before approving.';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    try {
      setActionLoading(id);

      // Upload new physical action files if any
      let uploadedFilesMeta = [];
      if (newActionFiles.length > 0) {
        try {
          uploadedFilesMeta = await processAuditService.uploadAttachments(newActionFiles);
        } catch (uploadErr) {
          console.warn('Action attachments upload warning:', uploadErr);
        }
      }

      const finalActionAttachments = [
        ...actionAttachments.filter((a) => !a.isNew),
        ...uploadedFilesMeta,
      ];

      const details = {
        root_cause: rootCause.trim(),
        corrective_action: correctiveAction.trim(),
        action_attachments: finalActionAttachments,
        standardization_details: standardizationDetails.trim(),
        target_date: targetDate,
        action_taken_by: user?.name || user?.email || 'Assigned Executor',
        approved_by: user?.name || user?.email || 'Assigned Executor',
        approved_by_id: user?.id || null,
        approved_by_email: user?.email || null,
        approved_by_role: user?.role || null,
      };

      const updated = await processAuditService.updateRequestStatus(id, 'Approved', details);
      window.dispatchEvent(new Event('refreshNotifications'));

      setRequests((prev) =>
        prev.map((r) => ((r.id === id || r.issue_no === id) ? { ...r, ...updated, status: 'Approved' } : r))
      );
      if (activeModalRequest && (activeModalRequest.id === id || activeModalRequest.issue_no === id)) {
        setActiveModalRequest((prev) => ({ ...prev, ...updated, status: 'Approved' }));
      }
      alert(`Audit Request ${updated?.issue_no || id} successfully Approved with complete corrective actions!`);
      setActiveModalRequest(null);
    } catch (err) {
      console.error('Failed to approve request:', err);
      alert('Failed to update status in database: ' + (err.response?.data?.message || err.message));
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectConfirm = async (id) => {
    if (!rejectReasonInput || !rejectReasonInput.trim()) {
      alert('Please provide a specific reason for rejection / re-audit.');
      return;
    }

    try {
      setActionLoading(id);

      let uploadedFilesMeta = [];
      if (newActionFiles.length > 0) {
        try {
          uploadedFilesMeta = await processAuditService.uploadAttachments(newActionFiles);
        } catch (uploadErr) {
          console.warn('Action attachments upload warning:', uploadErr);
        }
      }

      const finalActionAttachments = [
        ...actionAttachments.filter((a) => !a.isNew),
        ...uploadedFilesMeta,
      ];

      const details = {
        rejectionReason: rejectReasonInput.trim(),
        root_cause: rootCause.trim() || null,
        corrective_action: correctiveAction.trim() || null,
        action_attachments: finalActionAttachments,
        standardization_details: standardizationDetails.trim() || null,
        target_date: targetDate || null,
        action_taken_by: user?.name || 'Assigned Executor',
      };

      const updated = await processAuditService.updateRequestStatus(id, 'Rejected', details);
      window.dispatchEvent(new Event('refreshNotifications'));

      setRequests((prev) =>
        prev.map((r) =>
          (r.id === id || r.issue_no === id)
            ? { ...r, ...updated, status: 'Rejected', rejection_reason: rejectReasonInput.trim() }
            : r
        )
      );
      if (activeModalRequest && (activeModalRequest.id === id || activeModalRequest.issue_no === id)) {
        setActiveModalRequest((prev) => ({
          ...prev,
          ...updated,
          status: 'Rejected',
          rejection_reason: rejectReasonInput.trim(),
        }));
      }
      alert(`Audit Request ${updated?.issue_no || id} has been marked as Rejected.`);
      setActiveModalRequest(null);
    } catch (err) {
      console.error('Failed to reject request:', err);
      alert('Failed to update status in database: ' + (err.response?.data?.message || err.message));
    } finally {
      setActionLoading(null);
      setIsRejecting(false);
    }
  };

  const matchesExecutorUser = (execStr, uName, uEmail) => {
    if (!execStr) return false;
    const e = execStr.trim().toLowerCase();
    const name = (uName || '').trim().toLowerCase();
    const email = (uEmail || '').trim().toLowerCase();

    if (name && e === name) return true;
    if (email && e === email) return true;

    // For labels like "Mr. Ramesh (Material Planning)", match exact word tokens
    const tokens = e.replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter(Boolean);
    if (name && tokens.includes(name)) return true;
    return false;
  };

  const filtered = requests.filter((r) => {
    // Only show requests assigned to this user unless Admin
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
    const q = search.trim().toLowerCase();

    const matchesSearch =
      !q ||
      reqId.includes(q) ||
      stage.includes(q) ||
      line.includes(q) ||
      executor.includes(q) ||
      creator.includes(q) ||
      prod.includes(q);

    const s = (r.status || 'Pending Execution').toLowerCase();
    let matchesStatus = true;
    if (selectedStatus === 'Pending Approval') {
      matchesStatus = s.includes('pending') || (!s.includes('approved') && !s.includes('close') && !s.includes('open') && !s.includes('reject'));
    } else if (selectedStatus === 'Approved') {
      matchesStatus = s.includes('approved') && !s.includes('partially') && !s.includes('close');
    } else if (selectedStatus === 'Closed') {
      matchesStatus = s.includes('close');
    } else if (selectedStatus === 'Open') {
      matchesStatus = s === 'open' || s.includes('open') || s.includes('reopen');
    } else if (selectedStatus === 'Rejected') {
      matchesStatus = s.includes('reject');
    }

    return matchesSearch && matchesStatus;
  });

  const myAssignedRequests = isAdmin
    ? requests
    : requests.filter((r) => matchesExecutorUser(r.executor, user?.name, user?.email));

  const pendingCount = myAssignedRequests.filter((r) => (r.status || '').toLowerCase().includes('pending')).length;
  const approvedCount = myAssignedRequests.filter((r) => (r.status || '').toLowerCase().includes('approved') && !(r.status || '').toLowerCase().includes('partially')).length;
  const rejectedCount = myAssignedRequests.filter((r) => (r.status || '').toLowerCase().includes('reject')).length;

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
      if (typeof item === 'string') {
        const rawName = item.split('/').pop().split('\\').pop();
        return {
          name: rawName || 'Attachment',
          path: item.startsWith('uploads/') ? item : `uploads/attachments/${item}`,
          url: `/api/process-audit/${item.startsWith('uploads/') ? item : `uploads/attachments/${item}`}`,
        };
      }
      return {
        ...item,
        name: item.name || item.filename || (item.path ? item.path.split('/').pop().split('\\').pop() : 'Attachment'),
      };
    });
  };

  const getFullAttachmentUrl = (att) => {
    if (!att) return '';
    let url = '';
    if (typeof att === 'string') {
      url = att;
    } else {
      url = att.url || (att.path ? `/api/process-audit/${att.path}` : '');
    }
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:')) {
      return url;
    }
    const apiBase = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '');
    const cleanUrl = url.startsWith('/') ? url : `/${url}`;
    if (cleanUrl.startsWith('/uploads/')) {
      return `${apiBase}/api/process-audit${cleanUrl}`;
    }
    return `${apiBase}${cleanUrl}`;
  };

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

  const modalAttachments = activeModalRequest ? getAttachmentsList(activeModalRequest.attachments) : [];

  return (
    <div className="space-y-6 w-full pb-16">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
            <span className="text-blue-600 font-bold uppercase tracking-wider font-mono">PROCESS AUDIT</span>
            <span>/</span>
            <span>Sign-off Portal</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Audit Approvals &amp; Sign-offs
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Review production floor audits, verify quality compliance, and issue management sign-offs.
          </p>
        </div>

        <button
          onClick={loadRequests}
          disabled={loading}
          className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold border border-slate-200 shadow-2xs flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-60 self-start sm:self-auto"
          title="Refresh database records"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Pending Review</span>
            <div className="text-2xl font-black text-amber-600 mt-1">{pendingCount}</div>
            <p className="text-[11px] text-slate-500 mt-0.5">Awaiting manager sign-off</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Approved</span>
            <div className="text-2xl font-black text-emerald-600 mt-1">{approvedCount}</div>
            <p className="text-[11px] text-slate-500 mt-0.5">Sign-off completed</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Rejected / Re-audit</span>
            <div className="text-2xl font-black text-rose-600 mt-1">{rejectedCount}</div>
            <p className="text-[11px] text-slate-500 mt-0.5">Corrective action requested</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
            <XCircle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-2xs space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="sm:col-span-2 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by Request ID, Line, Stage, or Executor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none font-medium"
            />
          </div>

          <div>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-semibold focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none cursor-pointer"
            >
              <option value="All">All Statuses</option>
              <option value="Pending Approval">Pending Approval / Execution</option>
              <option value="Approved">Approved</option>
              <option value="Closed">Closed</option>
              <option value="Open">Open</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>
        </div>
      </div>

      {/* Approvals Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-extrabold uppercase tracking-widest text-slate-600 font-mono">
              AUDIT APPROVAL QUEUE
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 font-mono">
              {filtered.length} Records
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="py-16 text-center text-slate-400 text-xs">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
              Loading audit approval records from database...
            </div>
          ) : (
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="bg-[#f8fafc] border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4">REQ ID</th>
                  <th className="py-3 px-4">DATE / SHIFT</th>
                  <th className="py-3 px-4">STAGE &amp; LINE</th>
                  <th className="py-3 px-4">EXECUTOR</th>
                  <th className="py-3 px-4">PRODUCTION</th>
                  <th className="py-3 px-4">STATUS</th>
                  <th className="py-3 px-4 text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <ClipboardCheck className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                      <p className="font-semibold text-slate-600">No requests matching approval criteria in database</p>
                    </td>
                  </tr>
                ) : (
                  filtered.map((r) => {
                    const reqId = r.issue_no || (r.id ? `PA-${r.id}` : 'PA-1');
                    const dateStr = formatDate(r.escalation_date || r.created_at);
                    const shiftStr = r.shift || '-';
                    const stageStr = r.model || r.stage || '-';
                    const lineStr = r.process_operation || r.line || '-';
                    const executorStr = r.executor || '-';
                    const productionStr = r.product || r.production || '-';
                    const statusStr = r.status || 'Pending Execution';
                    const isPending =
                      statusStr.toLowerCase().includes('pending') ||
                      (!statusStr.toLowerCase().includes('approved') && !statusStr.toLowerCase().includes('close') && !statusStr.toLowerCase().includes('open') && !statusStr.toLowerCase().includes('reject'));
                    const isApproved =
                      statusStr.toLowerCase().includes('approved') && !statusStr.toLowerCase().includes('partially') && !statusStr.toLowerCase().includes('close');
                    const isClosed = statusStr.toLowerCase().includes('close');
                    const isOpen = statusStr.toLowerCase() === 'open' || statusStr.toLowerCase().includes('reopen');
                    const isRejected = statusStr.toLowerCase().includes('reject');

                    return (
                      <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-blue-600 whitespace-nowrap">
                          #{reqId}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="font-semibold text-slate-900">{dateStr}</div>
                          <div className="text-[11px] text-slate-400">{shiftStr}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-900">{stageStr}</div>
                          <div className="text-[11px] text-slate-400">{lineStr}</div>
                        </td>
                        <td className="py-3.5 px-4 font-medium text-slate-800">
                          {executorStr}
                        </td>
                        <td className="py-3.5 px-4 font-mono font-semibold text-slate-700">
                          {productionStr}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {isPending && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                              {statusStr}
                            </span>
                          )}
                          {isClosed && (
                            <div>
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                <CheckCheck className="w-3.5 h-3.5 text-emerald-700" />
                                Closed
                              </span>
                              {r.closed_by && (
                                <div className="text-[10px] text-slate-500 mt-0.5">
                                  by <strong className="text-slate-700">{r.closed_by}</strong>
                                </div>
                              )}
                            </div>
                          )}
                          {isApproved && (
                            <div>
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Approved
                              </span>
                              {(r.approved_by || r.action_taken_by) && (
                                <div className="text-[10px] text-slate-500 mt-0.5">
                                  by <strong className="text-slate-700">{r.approved_by || r.action_taken_by}</strong>
                                </div>
                              )}
                            </div>
                          )}
                          {isOpen && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-sky-50 text-sky-700 border border-sky-200">
                              <RotateCcw className="w-3.5 h-3.5 text-sky-600" />
                              Open
                            </span>
                          )}
                          {isRejected && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                              <XCircle className="w-3.5 h-3.5" />
                              Rejected
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2">
                            {isPending ? (
                              <button
                                onClick={() => openReviewModal(r)}
                                className="px-3.5 py-1.5 rounded-xl bg-[#2563eb] hover:bg-blue-700 text-white font-bold text-xs transition shadow-xs cursor-pointer flex items-center gap-1.5"
                                title="Review request information and submit resolution"
                              >
                                <ClipboardCheck className="w-3.5 h-3.5" />
                                <span>Review &amp; Sign-off</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => openReviewModal(r)}
                                className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-semibold text-xs transition shadow-2xs cursor-pointer flex items-center gap-1.5"
                                title="View Details"
                              >
                                <Eye className="w-3.5 h-3.5 text-slate-500" />
                                <span>View Details</span>
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
          )}
        </div>
      </div>

      {/* Comprehensive Sign-off Review Modal */}
      {activeModalRequest && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-5xl lg:max-w-6xl w-full p-6 sm:p-8 shadow-2xl border border-slate-100 max-h-[92vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <ClipboardCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                    <span>Audit Sign-off Review: #{activeModalRequest.issue_no || (activeModalRequest.id ? `PA-${activeModalRequest.id}` : 'PA-1')}</span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    {activeModalRequest.model || activeModalRequest.stage || 'Stage'} • {activeModalRequest.process_operation || activeModalRequest.line || 'Line'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                  (activeModalRequest.status || '').toLowerCase().includes('approved')
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : (activeModalRequest.status || '').toLowerCase().includes('reject')
                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                    : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}>
                  {activeModalRequest.status || 'Pending Execution'}
                </span>
                <button
                  onClick={() => setActiveModalRequest(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Scrollable Content */}
            <div className="my-5 overflow-y-auto pr-1.5 space-y-5 text-xs flex-1">
              {/* Request Overview 6-Card Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-slate-400 block font-semibold text-[10px] uppercase">Incident Date &amp; Shift</span>
                  <span className="font-bold text-slate-800 truncate block">
                    {formatDate(activeModalRequest.escalation_date || activeModalRequest.created_at)} ({activeModalRequest.shift})
                  </span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-slate-400 block font-semibold text-[10px] uppercase">Product</span>
                  <span className="font-bold text-slate-800 font-mono truncate block">{activeModalRequest.product || '-'}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-slate-400 block font-semibold text-[10px] uppercase">Department</span>
                  <span className="font-bold text-slate-800 truncate block">{activeModalRequest.department || '-'}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-slate-400 block font-semibold text-[10px] uppercase">Created By (Quality Auditor)</span>
                  <span className="font-bold text-blue-700 truncate block">{activeModalRequest.created_by || '-'}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-slate-400 block font-semibold text-[10px] uppercase">Assigned Executor</span>
                  <span className="font-bold text-slate-800 truncate block">{activeModalRequest.executor || '-'}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-slate-400 block font-semibold text-[10px] uppercase">Priority &amp; Issue Type</span>
                  <span className="font-bold text-amber-700 truncate block">
                    {activeModalRequest.priority || 'Normal'} {activeModalRequest.issue_type ? `• ${activeModalRequest.issue_type}` : ''}
                  </span>
                </div>
              </div>

              {/* Observation & Findings Box */}
              <div className={`grid gap-4 ${activeModalRequest.comments ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
                <div>
                  <span className="text-slate-500 block font-bold mb-1.5 uppercase text-[10px] tracking-wider">
                    Audit Observation &amp; Findings
                  </span>
                  <p className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl text-slate-800 leading-relaxed whitespace-pre-wrap text-xs font-normal min-h-[64px]">
                    {activeModalRequest.issue_observation || activeModalRequest.notes || 'No observation recorded.'}
                  </p>
                </div>

                {/* Comments if any */}
                {activeModalRequest.comments && (
                  <div>
                    <span className="text-slate-500 block font-bold mb-1.5 uppercase text-[10px] tracking-wider">
                      Auditor Notes &amp; Comments
                    </span>
                    <p className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl text-slate-800 leading-relaxed whitespace-pre-wrap text-xs font-normal min-h-[64px]">
                      {activeModalRequest.comments}
                    </p>
                  </div>
                )}
              </div>

              {/* Creator Attachments & Incident Evidence (Always Visible) */}
              <div className="p-4 sm:p-5 bg-gradient-to-r from-blue-50/60 via-slate-50 to-indigo-50/40 rounded-2xl border border-blue-200/80 shadow-2xs space-y-3">
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-1">
                    {modalAttachments.map((rawAtt, i) => {
                      const fullUrl = getFullAttachmentUrl(rawAtt);
                      const meta = getFileMeta(rawAtt);
                      const IconComponent = meta.icon;
                      return (
                        <div
                          key={i}
                          className="flex flex-col justify-between p-3 bg-white rounded-xl border border-slate-200 shadow-2xs hover:border-blue-400 hover:shadow-xs transition group"
                        >
                          <div className="flex items-start gap-2.5 min-w-0 mb-2">
                            {meta.isImage && fullUrl ? (
                              <div
                                onClick={() => setPreviewAttachment({ ...rawAtt, url: fullUrl, isImage: true, type: 'Image' })}
                                className="w-12 h-12 rounded-lg border border-slate-200 overflow-hidden shrink-0 bg-slate-100 cursor-pointer relative group/thumb"
                                title="Click to preview image"
                              >
                                <img
                                  src={fullUrl}
                                  alt={rawAtt.name}
                                  className="w-full h-full object-cover group-hover/thumb:scale-105 transition"
                                  onError={(e) => {
                                    e.target.style.display = 'none';
                                    if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
                                  }}
                                />
                                <div className="hidden w-full h-full items-center justify-center bg-blue-50 text-blue-600">
                                  <ImageIcon className="w-5 h-5" />
                                </div>
                              </div>
                            ) : (
                              <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border ${meta.badgeBg}`}>
                                <IconComponent className="w-5 h-5" />
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="font-bold text-slate-800 truncate text-xs group-hover:text-blue-600 transition" title={rawAtt.name}>
                                {rawAtt.name}
                              </p>
                              <span className="text-[10px] text-slate-400 block mt-0.5">
                                {rawAtt.size || meta.typeName}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-slate-100">
                            {fullUrl && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => setPreviewAttachment({
                                    ...rawAtt,
                                    url: fullUrl,
                                    isImage: meta.isImage,
                                    isPdf: meta.isPdf,
                                    isExcel: meta.isExcel,
                                    isPpt: meta.isPpt,
                                    type: rawAtt.type || meta.typeName,
                                  })}
                                  className="px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-blue-50 text-slate-600 hover:text-blue-700 text-[11px] font-semibold flex items-center gap-1 transition cursor-pointer"
                                  title="Preview file"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>Preview</span>
                                </button>
                                <a
                                  href={fullUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  download={rawAtt.name}
                                  className="px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-blue-50 text-slate-600 hover:text-blue-700 text-[11px] font-semibold flex items-center gap-1 transition cursor-pointer"
                                  title="Download attachment"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                  <span>Download</span>
                                </a>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-3.5 bg-white/80 rounded-xl border border-dashed border-slate-200 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-400 flex items-center justify-center shrink-0">
                      <Paperclip className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-700">
                        No technical drawings or evidence files were attached by creator ({activeModalRequest.created_by || 'Quality Auditor'})
                      </p>
                      <p className="text-[10px] text-slate-400">
                        Any incident photos, CAD drawings, or documents uploaded during observation creation will appear here for review.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Existing Rejection Reason Alert if any */}
              {(activeModalRequest.rejection_reason || activeModalRequest.rejectionReason) && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl">
                  <span className="text-rose-700 block font-bold mb-1 uppercase text-[10px]">
                    Rejection / Re-audit Reason
                  </span>
                  <p className="text-rose-800 text-xs leading-relaxed">
                    {activeModalRequest.rejection_reason || activeModalRequest.rejectionReason}
                  </p>
                </div>
              )}

              {/* ======================================================== */}
              {/* SECTION: 5 EXECUTOR RESOLUTION INPUTS                   */}
              {/* ======================================================== */}
              {(activeModalRequest.status || '').toLowerCase().includes('pending') ||
              (!(activeModalRequest.status || '').toLowerCase().includes('approved') &&
               !(activeModalRequest.status || '').toLowerCase().includes('reject')) ? (
                <div className="p-5 sm:p-6 bg-gradient-to-b from-blue-50/60 to-white rounded-3xl border-2 border-blue-200/80 shadow-xs space-y-5">
                  <div className="flex items-center justify-between pb-3 border-b border-blue-200/70">
                    <div className="flex items-center gap-2.5">
                      <span className="w-3 h-3 rounded-full bg-blue-600 animate-ping" />
                      <div>
                        <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 uppercase tracking-wide">
                          Executor Resolution &amp; Corrective Action Sign-off
                        </h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Carefully fill the 5 inputs below before finalizing your approval or rejection.
                        </p>
                      </div>
                    </div>
                    <span className="hidden sm:inline-flex px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-blue-100 text-blue-800 uppercase tracking-wider">
                      Required Before Sign-off
                    </span>
                  </div>

                  {/* Row 1: Root Cause (Input 1) & Corrective Action (Input 2) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* 1. Root cause */}
                    <div className="space-y-1.5 flex flex-col">
                      <label className="block text-xs font-bold text-slate-800 flex items-center justify-between">
                        <span className="text-[#003366] font-extrabold flex items-center gap-1">
                          Root cause <span className="text-rose-500">*</span>
                        </span>
                        {formErrors.rootCause && (
                          <span className="text-[11px] text-rose-600 font-semibold">{formErrors.rootCause}</span>
                        )}
                      </label>
                      <textarea
                        rows={3}
                        value={rootCause}
                        onChange={(e) => {
                          setRootCause(e.target.value);
                          if (formErrors.rootCause) setFormErrors((prev) => ({ ...prev, rootCause: null }));
                        }}
                        placeholder="Identify and explain the underlying root cause of the deviation/defect..."
                        className={`w-full p-3 rounded-xl bg-white border text-xs text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500/20 transition flex-1 ${
                          formErrors.rootCause ? 'border-rose-400 bg-rose-50/20 ring-1 ring-rose-400' : 'border-slate-300 focus:border-blue-500'
                        }`}
                      />
                    </div>

                    {/* 2. Corrective Action (by Resp. Team) */}
                    <div className="space-y-1.5 flex flex-col">
                      <label className="block text-xs font-bold text-slate-800 flex items-center justify-between">
                        <span className="text-[#003366] font-extrabold flex items-center gap-1">
                          Corrective Action (by Resp. Team) <span className="text-rose-500">*</span>
                        </span>
                        {formErrors.correctiveAction && (
                          <span className="text-[11px] text-rose-600 font-semibold">{formErrors.correctiveAction}</span>
                        )}
                      </label>
                      <textarea
                        rows={3}
                        value={correctiveAction}
                        onChange={(e) => {
                          setCorrectiveAction(e.target.value);
                          if (formErrors.correctiveAction) setFormErrors((prev) => ({ ...prev, correctiveAction: null }));
                        }}
                        placeholder="Detail specific containment and permanent corrective actions executed by the responsible team..."
                        className={`w-full p-3 rounded-xl bg-white border text-xs text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500/20 transition flex-1 ${
                          formErrors.correctiveAction ? 'border-rose-400 bg-rose-50/20 ring-1 ring-rose-400' : 'border-slate-300 focus:border-blue-500'
                        }`}
                      />
                    </div>
                  </div>

                  {/* Row 2: 3. Action Attachments */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-[#003366] font-extrabold flex items-center justify-between">
                      <span>Action Attachments</span>
                      <span className="text-[10px] text-slate-500 font-normal">Evidence photos, revised SOPs, inspection sheets</span>
                    </label>

                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-blue-300 hover:border-blue-500 bg-white/90 hover:bg-blue-50/40 p-4 rounded-2xl text-center cursor-pointer transition flex flex-col items-center justify-center gap-1.5 shadow-2xs"
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        onChange={handleActionFileChange}
                        className="hidden"
                        accept=".pdf,.png,.jpg,.jpeg,.xlsx,.xls,.doc,.docx,.ppt,.pptx"
                      />
                      <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                        <UploadCloud className="w-5 h-5" />
                      </div>
                      <p className="text-xs font-bold text-slate-700">
                        Click or drag &amp; drop to upload Action Attachments
                      </p>
                      <p className="text-[10px] text-slate-400">
                        Images (PNG, JPG), PDF, Excel or Documents
                      </p>
                    </div>

                    {/* Action Attachments List */}
                    {actionAttachments.length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 pt-1">
                        {actionAttachments.map((att, idx) => {
                          const meta = getFileMeta(att);
                          const IconComponent = meta.icon;
                          const fullUrl = getFullAttachmentUrl(att);
                          return (
                            <div
                              key={idx}
                              className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-slate-200 shadow-2xs"
                            >
                              <div className="flex items-center gap-2.5 min-w-0 pr-2">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${meta.badgeBg}`}>
                                  <IconComponent className="w-4 h-4" />
                                </div>
                                <div className="min-w-0">
                                  <p className="font-semibold text-slate-800 truncate text-xs" title={att.name}>
                                    {att.name}
                                  </p>
                                  <span className="text-[10px] text-slate-400">{att.size || meta.typeName}</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                {fullUrl && (
                                  <a
                                    href={fullUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    download={att.name}
                                    className="p-1.5 text-slate-500 hover:text-blue-600 rounded-lg hover:bg-slate-100 transition"
                                    title="Download"
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                  </a>
                                )}
                                <button
                                  type="button"
                                  onClick={() => removeActionAttachment(idx)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                                  title="Remove attachment"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Row 3: Standardization details (Input 4) & Target Date (Input 5) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* 4. Standardization details */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-[#003366] font-extrabold">
                        Standardization details
                      </label>
                      <textarea
                        rows={2}
                        value={standardizationDetails}
                        onChange={(e) => setStandardizationDetails(e.target.value)}
                        placeholder="Detail standardization across lines, Work Instruction revisions, SOP updates, or poka-yoke implemented..."
                        className="w-full p-3 rounded-xl bg-white border border-slate-300 text-xs text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
                      />
                    </div>

                    {/* 5. Target Date */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-800 flex items-center justify-between">
                        <span className="text-[#003366] font-extrabold flex items-center gap-1">
                          Target Date <span className="text-rose-500">*</span>
                        </span>
                        {formErrors.targetDate && (
                          <span className="text-[11px] text-rose-600 font-semibold">{formErrors.targetDate}</span>
                        )}
                      </label>
                      <div className="relative">
                        <input
                          type="date"
                          value={targetDate}
                          onChange={(e) => {
                            setTargetDate(e.target.value);
                            if (formErrors.targetDate) setFormErrors((prev) => ({ ...prev, targetDate: null }));
                          }}
                          className={`w-full p-2.5 rounded-xl bg-white border text-xs text-slate-800 font-semibold focus:ring-2 focus:ring-blue-500/20 transition cursor-pointer ${
                            formErrors.targetDate ? 'border-rose-400 bg-rose-50/20 ring-1 ring-rose-400' : 'border-slate-300 focus:border-blue-500'
                          }`}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Rejection Prompt Box if Reject clicked */}
                  {isRejecting && (
                    <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl space-y-2 animate-in fade-in duration-150">
                      <label className="block text-xs font-bold text-rose-800">
                        Reason for Rejection / Re-audit Request <span className="text-rose-500">*</span>
                      </label>
                      <textarea
                        rows={2}
                        value={rejectReasonInput}
                        onChange={(e) => setRejectReasonInput(e.target.value)}
                        placeholder="Please specify why this observation is rejected or returned for revision..."
                        className="w-full p-2.5 rounded-xl bg-white border border-rose-300 text-xs text-slate-800 focus:ring-2 focus:ring-rose-400/20"
                      />
                      <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setIsRejecting(false)}
                          className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 text-xs font-semibold hover:bg-slate-50 cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRejectConfirm(activeModalRequest.id)}
                          disabled={actionLoading === activeModalRequest.id}
                          className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs cursor-pointer disabled:opacity-60"
                        >
                          Confirm Rejection
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Read-Only Report for Already Approved or Rejected Requests */
                <div className="p-5 sm:p-6 bg-slate-50 rounded-3xl border border-slate-200 space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <h4 className="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-wide">
                        Executor Corrective Action &amp; Resolution Report
                      </h4>
                    </div>
                    {(activeModalRequest.approved_by || activeModalRequest.action_taken_by) && (
                      <span className="text-[11px] text-slate-500">
                        Approved by: <strong className="text-emerald-700 font-bold">{activeModalRequest.approved_by || activeModalRequest.action_taken_by}</strong>
                        {activeModalRequest.approved_at && (
                          <span className="ml-1 text-slate-400 font-mono text-[10px]">
                            ({formatDate(activeModalRequest.approved_at)})
                          </span>
                        )}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {activeModalRequest.root_cause && (
                      <div>
                        <span className="text-[#003366] block font-bold text-[10px] uppercase mb-1">Root cause</span>
                        <p className="p-3 bg-white rounded-xl border border-slate-200 text-slate-800 leading-relaxed whitespace-pre-wrap">
                          {activeModalRequest.root_cause}
                        </p>
                      </div>
                    )}

                    {activeModalRequest.corrective_action && (
                      <div>
                        <span className="text-[#003366] block font-bold text-[10px] uppercase mb-1">Corrective Action (by Resp. Team)</span>
                        <p className="p-3 bg-white rounded-xl border border-slate-200 text-slate-800 leading-relaxed whitespace-pre-wrap">
                          {activeModalRequest.corrective_action}
                        </p>
                      </div>
                    )}
                  </div>

                  {getAttachmentsList(activeModalRequest.action_attachments).length > 0 && (
                    <div>
                      <span className="text-[#003366] block font-bold text-[10px] uppercase mb-1.5">Action Attachments</span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                        {getAttachmentsList(activeModalRequest.action_attachments).map((att, i) => {
                          const meta = getFileMeta(att);
                          const IconComponent = meta.icon;
                          const fullUrl = getFullAttachmentUrl(att);
                          return (
                            <div key={i} className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-slate-200">
                              <div className="flex items-center gap-2 min-w-0 pr-2">
                                <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 border ${meta.badgeBg}`}>
                                  <IconComponent className="w-3.5 h-3.5" />
                                </div>
                                <span className="font-semibold text-slate-800 truncate text-[11px]" title={att.name}>{att.name}</span>
                              </div>
                              {fullUrl && (
                                <a href={fullUrl} target="_blank" rel="noreferrer" download={att.name} className="p-1 text-slate-500 hover:text-blue-600">
                                  <Download className="w-3.5 h-3.5" />
                                </a>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {activeModalRequest.standardization_details && (
                      <div>
                        <span className="text-[#003366] block font-bold text-[10px] uppercase mb-1">Standardization details</span>
                        <p className="p-3 bg-white rounded-xl border border-slate-200 text-slate-800 leading-relaxed whitespace-pre-wrap">
                          {activeModalRequest.standardization_details}
                        </p>
                      </div>
                    )}

                    {activeModalRequest.target_date && (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-[#003366] font-bold">Target Date:</span>
                        <span className="font-semibold text-slate-800 font-mono">{formatDate(activeModalRequest.target_date)}</span>
                      </div>
                    )}
                  </div>

                  {/* Auditor Verification Remark if present */}
                  {(activeModalRequest.creator_remark || (activeModalRequest.status || '').toLowerCase().includes('close')) && (
                    <div className="p-4 bg-emerald-50/60 rounded-2xl border border-emerald-200/80 space-y-2 mt-3">
                      <div className="flex items-center justify-between pb-1.5 border-b border-emerald-200/60">
                        <div className="flex items-center gap-2">
                          <CheckCheck className="w-4 h-4 text-emerald-700" />
                          <h4 className="text-xs font-bold text-emerald-950 uppercase tracking-wide">
                            Auditor Verification &amp; Final Sign-off
                          </h4>
                        </div>
                        <span className="text-[11px] font-bold text-emerald-800">
                          Status: {activeModalRequest.status}
                          {activeModalRequest.closed_by && ` (Verified by ${activeModalRequest.closed_by})`}
                        </span>
                      </div>
                      {activeModalRequest.creator_remark && (
                        <div>
                          <span className="text-[10px] font-bold uppercase text-emerald-900/70 block mb-0.5">Auditor Remark:</span>
                          <p className="p-2.5 bg-white/90 rounded-xl border border-emerald-200/60 text-slate-800 text-xs whitespace-pre-wrap leading-relaxed">
                            {activeModalRequest.creator_remark}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Action Buttons Footer */}
            <div className="flex items-center justify-between gap-3 pt-4 border-t border-slate-100 shrink-0">
              <div className="text-[11px] text-slate-400">
                {((activeModalRequest.status || '').toLowerCase().includes('pending') ||
                 (!(activeModalRequest.status || '').toLowerCase().includes('approved') &&
                  !(activeModalRequest.status || '').toLowerCase().includes('reject'))) ? (
                  <span>* Complete Root Cause, Corrective Action and Target Date to enable approval.</span>
                ) : (
                  <span>Audit Sign-off review completed.</span>
                )}
              </div>

              <div className="flex items-center gap-2.5">
                {((activeModalRequest.status || '').toLowerCase().includes('pending') ||
                  (!(activeModalRequest.status || '').toLowerCase().includes('approved') &&
                   !(activeModalRequest.status || '').toLowerCase().includes('reject'))) && (
                  <>
                    <button
                      type="button"
                      onClick={() => setIsRejecting(true)}
                      disabled={actionLoading === activeModalRequest.id}
                      className="px-4 py-2.5 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 font-bold text-xs hover:bg-rose-100 transition cursor-pointer flex items-center gap-1.5 disabled:opacity-60"
                    >
                      <XCircle className="w-4 h-4" />
                      <span>Reject</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApprove(activeModalRequest.id)}
                      disabled={actionLoading === activeModalRequest.id}
                      className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition cursor-pointer flex items-center gap-1.5 disabled:opacity-60"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Approve Sign-off</span>
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => setActiveModalRequest(null)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-semibold text-xs hover:bg-slate-50 transition cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Full Attachment Preview Lightbox Modal */}
      {previewAttachment && (
        <div
          onClick={() => setPreviewAttachment(null)}
          className="fixed inset-0 z-[60] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl max-w-4xl w-full p-5 shadow-2xl border border-slate-200 flex flex-col max-h-[90vh]"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <span className="font-bold text-sm text-slate-800 truncate" title={previewAttachment.name}>
                {previewAttachment.name}
              </span>
              <div className="flex items-center gap-2">
                {previewAttachment.url && (
                  <a
                    href={previewAttachment.url}
                    download={previewAttachment.name}
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition"
                    title="Download"
                  >
                    <Download className="w-4 h-4" />
                  </a>
                )}
                <button
                  onClick={() => setPreviewAttachment(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center min-h-[350px] bg-slate-50 rounded-2xl my-2">
              {previewAttachment.isImage && previewAttachment.url ? (
                <img
                  src={previewAttachment.url}
                  alt={previewAttachment.name}
                  className="max-h-[65vh] w-auto max-w-full object-contain rounded-xl shadow-xs"
                />
              ) : previewAttachment.isPdf && previewAttachment.url ? (
                <iframe
                  src={previewAttachment.url}
                  title={previewAttachment.name}
                  className="w-full h-[65vh] rounded-xl border border-slate-200"
                />
              ) : (
                <div className="text-center py-10">
                  <FileText className="w-12 h-12 text-slate-400 mx-auto mb-2" />
                  <p className="font-bold text-sm text-slate-700">{previewAttachment.name}</p>
                  <p className="text-xs text-slate-400 mt-1">This document format can be downloaded or opened directly.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProcessAuditApprovals;
