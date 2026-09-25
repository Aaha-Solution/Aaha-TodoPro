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
  ChevronDown
} from 'lucide-react';
import { processAuditService } from '../../services/processAuditService';
import { useAuth } from '../../hooks/useAuth';
import AttachmentThumbnail from '../../components/common/AttachmentThumbnail';
import AttachmentPreviewModal from '../../components/common/AttachmentPreviewModal';

const MyRequests = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const currentDept = (user?.department || (() => {
    try {
      const u = localStorage.getItem('todo_user');
      return u ? JSON.parse(u)?.department : '';
    } catch {
      return '';
    }
  })() || '').trim();

  const userRole = (user?.role || '').trim().toUpperCase();
  const isAdmin = userRole === 'ADMIN';
  const isIncomingQuality = currentDept.toUpperCase() === 'INCOMING QUALITY';
  const canTrack = isIncomingQuality || isAdmin;

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

  useEffect(() => {
    if (activeModalRequest) {
      setCreatorRemark(activeModalRequest.creator_remark || '');
      const s = (activeModalRequest.status || '').toLowerCase();
      setSelectedClosureStatus(s.includes('open') ? 'Open' : 'Closed');
    }
  }, [activeModalRequest?.id]);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const params = {};
      if (!isAdmin) {
        if (user?.name) params.created_by = user.name;
        if (user?.id) params.created_by_id = user.id;
        params.role = user?.role;
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
      window.dispatchEvent(new Event('refreshNotifications'));

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

      alert(`Audit Request ${merged.issue_no || reqId} has been successfully marked as ${newStatus}!`);
    } catch (err) {
      console.error('Failed to update closure status:', err);
      alert('Failed to update status in database: ' + (err.response?.data?.message || err.message));
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
        statusColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
        dotColor: 'bg-emerald-600',
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

  const getFullAttachmentUrl = (att) => {
    if (!att) return '';
    const apiBase = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '');

    // Numeric ID lookup directly
    if (typeof att === 'number' || (typeof att === 'string' && /^\d+$/.test(att.trim()))) {
      return `${apiBase}/api/process-audit/attachments/${String(att).trim()}`;
    }

    if (typeof att === 'object' && att.id) {
      return `${apiBase}/api/process-audit/attachments/${att.id}`;
    }

    let url = '';
    if (typeof att === 'string') {
      url = att;
    } else {
      // Prioritize persistent backend URLs over stale browser blob URLs
      if (att.url && !att.url.startsWith('blob:')) {
        url = att.url;
      } else if (att.path && !att.path.startsWith('blob:')) {
        url = att.path;
      } else if (att.filename) {
        url = `/api/process-audit/attachments/${encodeURIComponent(att.filename)}`;
      } else if (att.name) {
        url = `/api/process-audit/attachments/${encodeURIComponent(att.name)}`;
      }
    }

    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }

    // If still a dead blob: URL, resolve through database endpoint using filename/name
    if (url.startsWith('blob:')) {
      const fallbackName = typeof att === 'object' ? (att.filename || att.name) : '';
      if (fallbackName) {
        return `${apiBase}/api/process-audit/attachments/${encodeURIComponent(fallbackName)}`;
      }
      return url;
    }

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

  const handleReset = () => {
    setSearch('');
    setSelectedShift('All Shifts');
    setSelectedStage('All Stages');
    setSelectedExecutor('All Executors');
    setSelectedStatus('All Statuses');
  };

  const matchesCreatorUser = (creatorName, creatorId, uId, uName, uEmail) => {
    if (uId && creatorId && Number(uId) === Number(creatorId)) return true;
    if (!creatorName) return false;
    const c = creatorName.trim().toLowerCase();
    const name = (uName || '').trim().toLowerCase();
    const email = (uEmail || '').trim().toLowerCase();

    if (name && c === name) return true;
    if (email && c === email) return true;

    const tokens = c.replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter(Boolean);
    if (name && tokens.includes(name)) return true;
    return false;
  };

  const filteredRequests = requests.filter((req) => {
    // Only show requests created by this user unless Admin
    if (!isAdmin) {
      const isMine = matchesCreatorUser(
        req.created_by || req.creator,
        req.created_by_id,
        user?.id,
        user?.name,
        user?.email
      );
      if (!isMine) return false;
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
    const matchesStatus =
      selectedStatus === 'All Statuses' ||
      (selectedStatus === 'Closed' && s.includes('close')) ||
      (selectedStatus === 'Open' && (s === 'open' || s.includes('open') || s.includes('reopen'))) ||
      (selectedStatus === 'Approved' && s.includes('approved') && !s.includes('partially') && !s.includes('pending')) ||
      (selectedStatus === 'Pending Execution' && (s.includes('pending') || (!s.includes('approved') && !s.includes('close') && !s.includes('open') && !s.includes('reject')))) ||
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
        const status = r.status || 'Pending Execution';
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

  if (!canTrack) {
    return (
      <div className="space-y-6 w-full pb-12">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Request Tracking
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Process Audit Observation • Departmental Access Control
            </p>
          </div>
        </div>

        <div className="max-w-2xl mx-auto my-8 bg-white rounded-3xl p-8 sm:p-10 border border-slate-200/90 shadow-sm text-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">
            Department Authorization Required
          </h2>
          <p className="text-sm text-slate-600 mb-6 leading-relaxed">
            In <strong>Process Audit Observation</strong>, Request Tracking is reserved for the{' '}
            <span className="font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200 inline-block my-1">
              INCOMING QUALITY
            </span>{' '}
            department. Personnel from <strong>{currentDept || 'other departments'}</strong> can review and execute their assigned audits in <strong>Approvals</strong>.
          </p>
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/70 text-xs text-slate-600 mb-6 max-w-md mx-auto text-left space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Logged-in User:</span>
              <strong className="text-slate-800">{user?.name || user?.email || 'Unknown'}</strong>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Your Department:</span>
              <strong className="text-rose-600 font-semibold">{currentDept || 'Not Assigned / Other Department'}</strong>
            </div>
          </div>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => navigate('/process-audit/dashboard')}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer"
            >
              Go to Dashboard
            </button>
            <button
              onClick={() => navigate('/process-audit/approvals')}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs transition cursor-pointer"
            >
              Go to Approvals
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {isAdmin ? 'All Requests' : 'My Requests'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            {isAdmin
              ? 'Complete organization-wide audit observation records across all departments.'
              : 'Live database records with dynamic search, stage, executor, and shift filtering.'}
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
              <option>All Executors</option>
              <option value="Karthik">Mr. Karthik (Maintenance)</option>
              <option value="Kumar">Mr. Kumar (Assembly)</option>
              <option value="Deepa">Ms. Deepa (Quality)</option>
              <option value="Prakash">Mr. Prakash (QC)</option>
              <option value="Ravi">Mr. Ravi (Inspection)</option>
              <option value="Arjun">Mr. Arjun (Packaging)</option>
              <option value="Suresh">Mr. Suresh (Floor)</option>
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
              <option value="Pending Execution">Pending Execution</option>
              <option value="Approved">Approved</option>
              <option value="Closed">Closed</option>
              <option value="Open">Open</option>
              <option value="Rejected">Rejected</option>
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
                  const statusStr = req.status || 'Pending Execution';
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
                            <CheckCheck className="w-3.5 h-3.5 text-emerald-700" />
                          ) : statusStr.toLowerCase().includes('approved') ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <span className={`w-1.5 h-1.5 rounded-full ${meta.dotColor}`}></span>
                          )}
                          <span>{statusStr}</span>
                        </span>
                        {statusStr.toLowerCase().includes('close') && req.closed_by && (
                          <div className="text-[10px] text-slate-500 mt-0.5">by <strong className="text-slate-700">{req.closed_by}</strong></div>
                        )}
                        {statusStr.toLowerCase().includes('approved') && !statusStr.toLowerCase().includes('close') && (req.approved_by || req.action_taken_by) && (
                          <div className="text-[10px] text-slate-500 mt-0.5">by <strong className="text-slate-700">{req.approved_by || req.action_taken_by}</strong></div>
                        )}
                      </td>
                      <td className="py-4 px-6 text-center align-middle whitespace-nowrap">
                        {statusStr.toLowerCase().includes('approved') && !statusStr.toLowerCase().includes('close') ? (
                          <button
                            onClick={() => setActiveModalRequest(req)}
                            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition shadow-xs cursor-pointer flex items-center gap-1.5 mx-auto"
                            title="Review resolution and complete auditor sign-off"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Review &amp; Close</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => setActiveModalRequest(req)}
                            className="px-3 py-1 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 transition shadow-2xs cursor-pointer"
                          >
                            View Details
                          </button>
                        )}
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
                    Status: <span className="font-semibold text-slate-800">{activeModalRequest.status || 'Pending Execution'}</span>
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
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Department</span>
                  <span className="font-bold text-slate-800">{activeModalRequest.department}</span>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Assigned Executor</span>
                <span className="font-bold text-slate-800">{activeModalRequest.executor}</span>
              </div>

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
                              <a
                                href={att.url}
                                target="_blank"
                                rel="noreferrer"
                                download={att.name}
                                className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition cursor-pointer"
                                title="Download file"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </a>
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
                                    <a href={fullUrl} target="_blank" rel="noreferrer" download={att.name} className="p-1 text-slate-500 hover:text-blue-600 rounded-lg hover:bg-slate-100" title="Download">
                                      <Download className="w-3.5 h-3.5" />
                                    </a>
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
                  {activeModalRequest.status && (
                    <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border self-start sm:self-auto ${getStatusMeta(activeModalRequest.status).statusColor}`}>
                      Current Status: {activeModalRequest.status}
                    </span>
                  )}
                </div>

                {/* If already closed */}
                {activeModalRequest.status && activeModalRequest.status.toLowerCase().includes('close') ? (
                  <div className="space-y-3">
                    <div className="flex items-start gap-2.5 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 p-3.5 rounded-xl">
                      <CheckCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold text-emerald-900 text-xs">
                          This observation has been verified and marked as CLOSED
                        </p>
                        <p className="text-[11px] text-emerald-700 mt-0.5">
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
                  </div>
                ) : (
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

      {/* Universal In-Page Attachment Preview Modal (Rich viewer identical to IHLR) */}
      <AttachmentPreviewModal
        isOpen={Boolean(previewAttachment)}
        attachment={previewAttachment}
        onClose={() => setPreviewAttachment(null)}
      />
    </div>
  );
};

export default MyRequests;
