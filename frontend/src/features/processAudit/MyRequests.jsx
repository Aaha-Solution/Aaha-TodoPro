import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
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
  ShieldAlert
} from 'lucide-react';
import { processAuditService } from '../../services/processAuditService';
import { useAuth } from '../../hooks/useAuth';

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
  const isAdmin = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN' || userRole === 'SUPER ADMIN';
  const isIncomingQuality = currentDept.toUpperCase() === 'INCOMING QUALITY';
  const canTrack = isIncomingQuality || isAdmin;

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedShift, setSelectedShift] = useState('All Shifts');
  const [selectedStage, setSelectedStage] = useState('All Stages');
  const [selectedExecutor, setSelectedExecutor] = useState('All Executors');
  const [selectedStatus, setSelectedStatus] = useState('All Statuses');
  const [activeModalRequest, setActiveModalRequest] = useState(null);
  const [previewAttachment, setPreviewAttachment] = useState(null);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const data = await processAuditService.getRequests();
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

  const formatDate = (dateVal) => {
    if (!dateVal) return '-';
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return String(dateVal);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const getStatusMeta = (status) => {
    const s = (status || '').toLowerCase();
    if (s.includes('approved') && !s.includes('partially') && !s.includes('pending')) {
      return {
        statusColor: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
        dotColor: 'bg-emerald-500',
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
    const url = att.url || (att.path ? `/api/process-audit/${att.path}` : '');
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:')) {
      return url;
    }
    const apiBase = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '');
    return `${apiBase}${url.startsWith('/') ? '' : '/'}${url}`;
  };

  const getFileMeta = (file) => {
    const ext = ((file?.type || file?.name?.split('.').pop()) || '').toUpperCase();
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

  const filteredRequests = requests.filter((req) => {
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

    const matchesStatus =
      selectedStatus === 'All Statuses' ||
      String(req.status || '').toLowerCase() === selectedStatus.toLowerCase();

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
    if (Array.isArray(attData)) return attData;
    if (typeof attData === 'string') {
      try {
        const parsed = JSON.parse(attData);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
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
            Request Tracking
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Live database records with dynamic search, stage, executor, and shift filtering.
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
              <option>All Statuses</option>
              <option>Pending Execution</option>
              <option>Pending Approval</option>
              <option>Partially Approved</option>
              <option>Approved</option>
              <option>Rejected</option>
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
                      <td className="py-4 px-4 text-center align-middle whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${meta.statusColor}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${meta.dotColor}`}></span>
                          <span>{statusStr}</span>
                        </span>
                      </td>
                      <td className="py-4 px-6 text-center align-middle whitespace-nowrap">
                        <button
                          onClick={() => setActiveModalRequest(req)}
                          className="px-3 py-1 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 transition shadow-2xs cursor-pointer"
                        >
                          View Details
                        </button>
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
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-7 shadow-2xl border border-slate-100 max-h-[90vh] flex flex-col">
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

              {/* Attachments Section with Click-to-Preview */}
              {modalAttachments.length > 0 && (
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80">
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">
                      Attached Technical Drawings & Documents ({modalAttachments.length})
                    </span>
                    <span className="text-[10px] text-blue-600 font-medium">Click any file to preview</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
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
                </div>
              )}
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

      {/* Full File Preview Modal */}
      {previewAttachment && (() => {
        const meta = getFileMeta(previewAttachment);
        const IconComponent = meta.icon;
        return createPortal(
          <div
            className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/75 backdrop-blur-xs p-4 animate-in fade-in duration-150"
            onClick={() => setPreviewAttachment(null)}
          >
            <div
              className="bg-white rounded-3xl max-w-3xl w-full p-5 sm:p-6 shadow-2xl border border-slate-100 flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 shrink-0">
                <div className="flex items-center gap-3 min-w-0 pr-4">
                  <span className={`px-2.5 py-1 text-xs font-bold rounded-lg border shrink-0 flex items-center gap-1.5 ${meta.badgeBg}`}>
                    <IconComponent className="w-3.5 h-3.5" />
                    {previewAttachment.type}
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-slate-900 truncate" title={previewAttachment.name}>
                      {previewAttachment.name}
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      {meta.typeName} {previewAttachment.size ? `• ${previewAttachment.size}` : ''}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {previewAttachment.url && (
                    <a
                      href={previewAttachment.url}
                      download={previewAttachment.name}
                      className="p-2 rounded-xl text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition cursor-pointer"
                      title="Download file"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => setPreviewAttachment(null)}
                    className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                    title="Close preview"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Modal Content Preview */}
              <div className="flex-1 overflow-auto p-4 my-2 flex items-center justify-center min-h-[300px] bg-slate-50/70 rounded-2xl border border-slate-100">
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
                  <div className="text-center py-10 px-4 max-w-md">
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-3 text-lg font-bold border shadow-xs ${meta.badgeBg}`}>
                      <IconComponent className="w-8 h-8" />
                    </div>
                    <h4 className="text-sm font-bold text-slate-800 mb-1">
                      {previewAttachment.name}
                    </h4>
                    <p className="text-xs text-slate-500 mb-4">
                      {previewAttachment.isExcel
                        ? 'This Microsoft Excel spreadsheet can be opened in browser tab or downloaded.'
                        : previewAttachment.isPpt
                          ? 'This Microsoft PowerPoint presentation can be opened in browser tab or downloaded.'
                          : `This file format (${previewAttachment.type}) can be opened in browser tab or downloaded.`}
                    </p>
                    {previewAttachment.url && (
                      <div className="flex flex-wrap items-center justify-center gap-3">
                        <a
                          href={previewAttachment.url}
                          download={previewAttachment.name}
                          className={`inline-flex items-center gap-2 px-4 py-2.5 text-white text-xs font-semibold rounded-xl shadow-xs transition ${previewAttachment.isExcel
                            ? 'bg-emerald-600 hover:bg-emerald-700'
                            : previewAttachment.isPpt
                              ? 'bg-orange-600 hover:bg-orange-700'
                              : 'bg-blue-600 hover:bg-blue-700'
                            }`}
                        >
                          <Download className="w-4 h-4" />
                          Download {previewAttachment.type} File
                        </a>
                        <a
                          href={previewAttachment.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl shadow-xs transition"
                        >
                          <Eye className="w-4 h-4" />
                          Open in Browser Tab
                        </a>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>,
          document.body
        );
      })()}
    </div>
  );
};

export default MyRequests;
