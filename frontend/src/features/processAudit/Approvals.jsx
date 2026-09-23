import React, { useState, useEffect } from 'react';
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
  Image as ImageIcon
} from 'lucide-react';
import { processAuditService } from '../../services/processAuditService';
import { useAuth } from '../../hooks/useAuth';

const ProcessAuditApprovals = () => {
  const { user } = useAuth();
  const isAdmin = (user?.role || '').toUpperCase() === 'ADMIN' || (user?.role || '').toUpperCase() === 'SUPER_ADMIN';

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [activeModalRequest, setActiveModalRequest] = useState(null);
  const [previewAttachment, setPreviewAttachment] = useState(null);

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

  const handleApprove = async (id) => {
    try {
      setActionLoading(id);
      await processAuditService.updateRequestStatus(id, 'Approved');
      setRequests((prev) =>
        prev.map((r) => ((r.id === id || r.issue_no === id) ? { ...r, status: 'Approved' } : r))
      );
      if (activeModalRequest && (activeModalRequest.id === id || activeModalRequest.issue_no === id)) {
        setActiveModalRequest((prev) => ({ ...prev, status: 'Approved' }));
      }
    } catch (err) {
      console.error('Failed to approve request:', err);
      alert('Failed to update status in database: ' + (err.response?.data?.message || err.message));
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (id) => {
    const reason = prompt('Please provide reason for rejection / re-audit:');
    if (reason && reason.trim()) {
      try {
        setActionLoading(id);
        await processAuditService.updateRequestStatus(id, 'Rejected', reason.trim());
        setRequests((prev) =>
          prev.map((r) =>
            (r.id === id || r.issue_no === id)
              ? { ...r, status: 'Rejected', rejection_reason: reason.trim() }
              : r
          )
        );
        if (activeModalRequest && (activeModalRequest.id === id || activeModalRequest.issue_no === id)) {
          setActiveModalRequest((prev) => ({
            ...prev,
            status: 'Rejected',
            rejection_reason: reason.trim(),
            rejectionReason: reason.trim()
          }));
        }
      } catch (err) {
        console.error('Failed to reject request:', err);
        alert('Failed to update status in database: ' + (err.response?.data?.message || err.message));
      } finally {
        setActionLoading(null);
      }
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
      matchesStatus = s.includes('pending');
    } else if (selectedStatus === 'Approved') {
      matchesStatus = s.includes('approved') && !s.includes('partially');
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
                      (!statusStr.toLowerCase().includes('approved') && !statusStr.toLowerCase().includes('reject'));
                    const isApproved =
                      statusStr.toLowerCase().includes('approved') && !statusStr.toLowerCase().includes('partially');
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
                          {isApproved && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Approved
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
                            <button
                              onClick={() => setActiveModalRequest(r)}
                              className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                              title="View Details"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            {isPending && (
                              <>
                                <button
                                  onClick={() => handleApprove(r.id)}
                                  disabled={actionLoading === r.id}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] transition shadow-xs cursor-pointer flex items-center gap-1 disabled:opacity-60"
                                >
                                  <CheckCircle2 className="w-3 h-3" />
                                  Approve
                                </button>
                                <button
                                  onClick={() => handleReject(r.id)}
                                  disabled={actionLoading === r.id}
                                  className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 font-bold text-[11px] transition cursor-pointer flex items-center gap-1 disabled:opacity-60"
                                >
                                  <XCircle className="w-3 h-3" />
                                  Reject
                                </button>
                              </>
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

      {/* Details Modal */}
      {activeModalRequest && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Audit Sign-off Review: #{activeModalRequest.issue_no || (activeModalRequest.id ? `PA-${activeModalRequest.id}` : 'PA-1')}
                </h3>
                <p className="text-xs text-slate-500">
                  {activeModalRequest.model || activeModalRequest.stage || 'Stage'} - {activeModalRequest.process_operation || activeModalRequest.line || 'Line'}
                </p>
              </div>
              <button
                onClick={() => setActiveModalRequest(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div>
                  <span className="text-slate-400 block font-semibold text-[10px] uppercase">Incident Date</span>
                  <span className="font-bold text-slate-800">
                    {formatDate(activeModalRequest.escalation_date || activeModalRequest.created_at)} ({activeModalRequest.shift})
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-semibold text-[10px] uppercase">Production Volume</span>
                  <span className="font-bold text-slate-800 font-mono">{activeModalRequest.product || activeModalRequest.production || '-'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-semibold text-[10px] uppercase">Executor</span>
                  <span className="font-bold text-slate-800">{activeModalRequest.executor || '-'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-semibold text-[10px] uppercase">Department</span>
                  <span className="font-bold text-slate-800">{activeModalRequest.department || '-'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-semibold text-[10px] uppercase">Creator</span>
                  <span className="font-bold text-blue-700">{activeModalRequest.created_by || '-'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-semibold text-[10px] uppercase">Current Status</span>
                  <span className="font-bold text-slate-800">{activeModalRequest.status || 'Pending Execution'}</span>
                </div>
              </div>

              <div>
                <span className="text-slate-500 block font-bold mb-1 uppercase text-[10px]">Audit Observation &amp; Findings</span>
                <p className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-slate-700 leading-relaxed whitespace-pre-wrap">
                  {activeModalRequest.issue_observation || activeModalRequest.notes || 'No specific observation recorded.'}
                </p>
              </div>

              {activeModalRequest.comments && (
                <div>
                  <span className="text-slate-500 block font-bold mb-1 uppercase text-[10px]">Comments</span>
                  <p className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-slate-700 leading-relaxed whitespace-pre-wrap">
                    {activeModalRequest.comments}
                  </p>
                </div>
              )}

              {(activeModalRequest.rejection_reason || activeModalRequest.rejectionReason) && (
                <div>
                  <span className="text-rose-600 block font-bold mb-1 uppercase text-[10px]">Rejection Reason</span>
                  <p className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-800">
                    {activeModalRequest.rejection_reason || activeModalRequest.rejectionReason}
                  </p>
                </div>
              )}

              {/* Attachments */}
              {modalAttachments.length > 0 && (
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">
                      Attached Technical Drawings &amp; Documents ({modalAttachments.length})
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {modalAttachments.map((rawAtt, i) => {
                      const fullUrl = getFullAttachmentUrl(rawAtt);
                      const meta = getFileMeta(rawAtt);
                      const IconComponent = meta.icon;
                      return (
                        <div
                          key={i}
                          className="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-200"
                        >
                          <div className="flex items-center gap-2 min-w-0 pr-2">
                            <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 border ${meta.badgeBg}`}>
                              <IconComponent className="w-3.5 h-3.5" />
                            </div>
                            <span className="font-semibold text-slate-800 truncate text-[11px]" title={rawAtt.name}>
                              {rawAtt.name}
                            </span>
                          </div>
                          {fullUrl && (
                            <a
                              href={fullUrl}
                              target="_blank"
                              rel="noreferrer"
                              download={rawAtt.name}
                              className="p-1 text-slate-500 hover:text-blue-600 transition"
                              title="Download / View"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              {((activeModalRequest.status || '').toLowerCase().includes('pending') ||
                (!(activeModalRequest.status || '').toLowerCase().includes('approved') &&
                 !(activeModalRequest.status || '').toLowerCase().includes('reject'))) && (
                <>
                  <button
                    onClick={() => handleReject(activeModalRequest.id)}
                    disabled={actionLoading === activeModalRequest.id}
                    className="px-4 py-2 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 font-bold text-xs hover:bg-rose-100 transition cursor-pointer"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => handleApprove(activeModalRequest.id)}
                    disabled={actionLoading === activeModalRequest.id}
                    className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 shadow-md shadow-emerald-600/20 transition cursor-pointer"
                  >
                    Approve Sign-off
                  </button>
                </>
              )}
              <button
                onClick={() => setActiveModalRequest(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-semibold text-xs hover:bg-slate-50 transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProcessAuditApprovals;
