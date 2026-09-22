import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, 
  BarChart3, 
  Hourglass, 
  Cpu, 
  ShieldCheck, 
  Check, 
  X, 
  Eye,
  FileText,
  RefreshCw,
  AlertCircle,
  Paperclip,
  Download,
  FileSpreadsheet,
  Presentation,
  File as FileIcon,
  Image as ImageIcon
} from 'lucide-react';
import { processAuditService } from '../../services/processAuditService';

const ProcessAuditDashboard = () => {
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [metrics, setMetrics] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [previewAttachment, setPreviewAttachment] = useState(null);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const [reqsData, statsData] = await Promise.allSettled([
        processAuditService.getRequests(),
        processAuditService.getDashboardStats()
      ]);

      if (reqsData.status === 'fulfilled' && Array.isArray(reqsData.value)) {
        setRequests(reqsData.value);
      }
      if (statsData.status === 'fulfilled' && statsData.value) {
        setMetrics(statsData.value);
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const formatDate = (dateVal) => {
    if (!dateVal) return '-';
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return String(dateVal);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const formatDateTime = (dateVal) => {
    if (!dateVal) return '-';
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return String(dateVal);
    return d.toLocaleDateString('en-GB', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
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

  const total = metrics.totalRequests !== undefined ? metrics.totalRequests : requests.length;
  const pendingExec = metrics.pendingExecution !== undefined ? metrics.pendingExecution : requests.filter(r => (r.status || '').toLowerCase().includes('pending execution')).length;
  const inExec = metrics.inExecution !== undefined ? metrics.inExecution : requests.filter(r => (r.status || '').toLowerCase().includes('in execution')).length;
  const pendingApp = metrics.pendingApproval !== undefined ? metrics.pendingApproval : requests.filter(r => (r.status || '').toLowerCase().includes('pending approval')).length;
  const approved = metrics.approved !== undefined ? metrics.approved : requests.filter(r => (r.status || '').toLowerCase() === 'approved').length;
  const rejected = metrics.rejected !== undefined ? metrics.rejected : requests.filter(r => (r.status || '').toLowerCase().includes('reject')).length;

  const kpis = [
    {
      title: 'Total Requests',
      value: String(total),
      subtitle: 'Across all production lines',
      icon: BarChart3,
      iconBg: 'bg-blue-50 text-blue-600',
    },
    {
      title: 'Pending Execution',
      value: String(pendingExec),
      subtitle: 'Awaiting floor commencement',
      icon: Hourglass,
      iconBg: 'bg-amber-50 text-amber-600',
    },
    {
      title: 'In Execution',
      value: String(inExec),
      subtitle: 'Floor machining & assembly',
      icon: Cpu,
      iconBg: 'bg-purple-50 text-purple-600',
    },
    {
      title: 'Pending Approval',
      value: String(pendingApp),
      subtitle: 'Level 1 & Level 2 reviews',
      icon: ShieldCheck,
      iconBg: 'bg-sky-50 text-sky-600',
    },
    {
      title: 'Approved',
      value: String(approved),
      subtitle: 'Released to Inventory',
      icon: Check,
      iconBg: 'bg-emerald-50 text-emerald-600',
    },
    {
      title: 'Rejected',
      value: String(rejected),
      subtitle: 'Actionable rework needed',
      icon: X,
      iconBg: 'bg-rose-50 text-rose-600',
    },
  ];

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

  const modalAttachments = selectedRequest ? getAttachmentsList(selectedRequest.attachments) : [];

  return (
    <div className="space-y-7 pb-12">
      {/* Top Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Dashboard
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Real-time manufacturing KPIs and production audit telemetry.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadDashboardData}
            disabled={loading}
            className="px-3.5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold border border-slate-200 shadow-2xs flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-60"
            title="Refresh dashboard metrics"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={() => navigate('/process-audit/create-request')}
            className="px-5 py-2.5 bg-[#2563eb] hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/20 flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create Production Request</span>
          </button>
        </div>
      </div>

      {/* 6 Top Metric Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {kpis.map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <div
              key={idx}
              className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-2xs hover:shadow-xs transition flex flex-col justify-between"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-600 truncate">{kpi.title}</span>
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${kpi.iconBg}`}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
              </div>

              <div className="mt-3">
                <div className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                  {kpi.value}
                </div>
                <p className="text-[10px] text-slate-400 mt-1 truncate">
                  {kpi.subtitle}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Recent Production Requests Card */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
        {/* Card Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900">
              Recent Production Requests
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Live records from database with latest sequential audit history.
            </p>
          </div>
          <button
            onClick={() => navigate('/process-audit/my-requests')}
            className="px-3.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 shadow-2xs transition cursor-pointer"
          >
            View All Tracking
          </button>
        </div>

        {/* Requests Table */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="py-16 text-center text-slate-400 text-xs">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
              Loading production requests from database...
            </div>
          ) : requests.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-xs">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              <p className="font-semibold text-slate-600 mb-1">No production requests found in database</p>
              <p className="text-slate-400 mb-4">Click below to create your first production audit request.</p>
              <button
                onClick={() => navigate('/process-audit/create-request')}
                className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition"
              >
                Create First Request
              </button>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#f8fafc] border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3.5 px-6">REQUEST ID</th>
                  <th className="py-3.5 px-6">DATE</th>
                  <th className="py-3.5 px-6">SHIFT</th>
                  <th className="py-3.5 px-6">PRODUCTION</th>
                  <th className="py-3.5 px-6">STAGE</th>
                  <th className="py-3.5 px-6">STATUS</th>
                  <th className="py-3.5 px-6">CREATED DATE</th>
                  <th className="py-3.5 px-6 text-center">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {requests.slice(0, 10).map((req) => {
                  const reqId = req.issue_no || (req.id ? `PA-${req.id}` : 'PA-1');
                  const dateStr = formatDate(req.escalation_date || req.created_at);
                  const prodStr = `${req.product || 'Standard'} ${req.model ? `(${req.model})` : ''}`.trim();
                  const stageStr = req.model || req.stage || 'Standard';
                  const statusStr = req.status || 'Pending Execution';
                  const meta = getStatusMeta(statusStr);
                  const createdDateStr = formatDateTime(req.created_at);

                  return (
                    <tr key={req.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-4 px-6 font-bold text-blue-600">{reqId}</td>
                      <td className="py-4 px-6 text-slate-600 font-medium">{dateStr}</td>
                      <td className="py-4 px-6 text-slate-600 font-medium">{req.shift}</td>
                      <td className="py-4 px-6 text-slate-800 font-semibold">{prodStr}</td>
                      <td className="py-4 px-6 text-slate-600">{stageStr}</td>
                      <td className="py-4 px-6">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${meta.statusColor}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${meta.dotColor}`}></span>
                          <span>{statusStr}</span>
                        </span>
                      </td>
                      <td className="py-4 px-6 text-slate-500 text-[11px] font-mono">{createdDateStr}</td>
                      <td className="py-4 px-6 text-center">
                        <button
                          onClick={() => setSelectedRequest(req)}
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
          )}
        </div>
      </div>

      {/* View Details Modal */}
      {selectedRequest && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-7 shadow-2xl border border-slate-100 max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {selectedRequest.issue_no || `PA-${selectedRequest.id}`} Production Details
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Created on {formatDateTime(selectedRequest.created_at)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedRequest(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="my-5 overflow-y-auto space-y-3.5 pr-1 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 rounded-xl">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Line / Operation</span>
                  <span className="font-bold text-slate-800">{selectedRequest.process_operation || selectedRequest.line || '-'}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Assigned Executor</span>
                  <span className="font-bold text-slate-800">{selectedRequest.executor || '-'}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Production Volume</span>
                  <span className="font-bold text-slate-800">{selectedRequest.product}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Current Stage / Model</span>
                  <span className="font-bold text-slate-800">{selectedRequest.model || selectedRequest.stage}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 rounded-xl">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Created By</span>
                  <span className="font-bold text-blue-700">{selectedRequest.created_by || '-'}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Department</span>
                  <span className="font-bold text-slate-800">{selectedRequest.department || '-'}</span>
                </div>
              </div>

              {selectedRequest.issue_observation && (
                <div className="p-3 bg-slate-50 rounded-xl">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold mb-1">Issue Observation</span>
                  <p className="text-slate-700 whitespace-pre-wrap">{selectedRequest.issue_observation}</p>
                </div>
              )}

              {selectedRequest.comments && (
                <div className="p-3 bg-slate-50 rounded-xl">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold mb-1">Comments</span>
                  <p className="text-slate-700 whitespace-pre-wrap">{selectedRequest.comments}</p>
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
                onClick={() => setSelectedRequest(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
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

export default ProcessAuditDashboard;
