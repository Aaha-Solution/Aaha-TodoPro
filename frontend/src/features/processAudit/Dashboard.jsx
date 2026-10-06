import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  BarChart3,
  Hourglass,
  CheckCircle2,
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
import { useAuth } from '../../hooks/useAuth';
import AttachmentPreviewModal from '../../components/common/AttachmentPreviewModal';
import { triggerDirectDownload, resolveAttachmentUrl } from '../../components/common/attachmentUtils';

const ProcessAuditDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userDept = (user?.department || (() => {
    try {
      const u = localStorage.getItem('todo_user');
      return u ? JSON.parse(u)?.department : '';
    } catch {
      return '';
    }
  })() || '').trim().toUpperCase();

  const isAdmin = user?.role?.toUpperCase() === 'ADMIN';
  const isIncomingQuality = userDept === 'INCOMING QUALITY';
  const canCreate = isIncomingQuality || isAdmin;

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
    if (s.includes('close')) {
      return {
        statusColor: 'bg-teal-50 text-teal-700 border-teal-200/80',
        dotColor: 'bg-teal-500',
      };
    }
    if (s.includes('approved') && !s.includes('partially') && !s.includes('pending')) {
      return {
        statusColor: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
        dotColor: 'bg-emerald-500',
      };
    }
    if (s === 'open' || s.includes('open') || s.includes('reopen')) {
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
  const pendingExec = metrics.pendingExecution !== undefined ? metrics.pendingExecution : requests.filter(r => {
    const s = (r.status || '').toLowerCase();
    return s.includes('pending') || (!s.includes('approved') && !s.includes('close') && !s.includes('open') && !s.includes('reject'));
  }).length;
  const closed = metrics.closed !== undefined ? metrics.closed : requests.filter(r => (r.status || '').toLowerCase().includes('close')).length;

  const kpis = [
    {
      title: 'Total Issues',
      value: String(total),
      icon: BarChart3,
      iconBg: 'bg-blue-50 text-blue-600',
    },
    {
      title: 'Pending',
      value: String(pendingExec),
      icon: Hourglass,
      iconBg: 'bg-amber-50 text-amber-600',
    },
    {
      title: 'Closed',
      value: String(closed),
      icon: CheckCircle2,
      iconBg: 'bg-teal-50 text-teal-600',
    },
  ];

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

  const modalAttachments = selectedRequest ? getAttachmentsList(selectedRequest.attachments) : [];

  const matchExactToken = (fieldVal, userName) => {
    if (!fieldVal || !userName) return false;
    const f = fieldVal.trim().toLowerCase();
    const u = userName.trim().toLowerCase();
    if (f === u) return true;
    const tokens = f.replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter(Boolean);
    return tokens.includes(u);
  };

  // Show only the 10 most recently created requests (newest creation date & ID first)
  const recentRequests = [...requests]
    .sort((a, b) => {
      const timeA = new Date(a.created_at || a.createdAt || a.escalation_date || 0).getTime();
      const timeB = new Date(b.created_at || b.createdAt || b.escalation_date || 0).getTime();
      if (timeB !== timeA) return timeB - timeA;
      const idA = typeof a.id === 'number' ? a.id : parseInt(String(a.id || a.issue_no || '').replace(/\D/g, ''), 10) || 0;
      const idB = typeof b.id === 'number' ? b.id : parseInt(String(b.id || b.issue_no || '').replace(/\D/g, ''), 10) || 0;
      return idB - idA;
    })
    .slice(0, 10);

  return (
    <div className="space-y-7 pb-12">
      {/* Top Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Dashboard
          </h1>
       
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

          {canCreate && (
            <button
              onClick={() => navigate('/process-audit/create-request')}
              className="px-5 py-2.5 bg-[#2563eb] hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/20 flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create Issue</span>
            </button>
          )}
        </div>
      </div>

      {/* Top Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        {kpis.map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <div
              key={idx}
              className="bg-white rounded-2xl p-4 sm:p-4.5 border border-slate-200/90 shadow-2xs hover:shadow-xs transition flex flex-col justify-between"
            >
              <div className="flex items-center justify-between gap-1.5">
                <span className="text-xs font-semibold text-slate-700 truncate">{kpi.title}</span>
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${kpi.iconBg}`}>
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
           
          </div>
          {canCreate && (
            <button
              onClick={() => navigate('/process-audit/my-requests')}
              className="px-3.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 shadow-2xs transition cursor-pointer"
            >
              View All Tracking
            </button>
          )}
        </div>

        {/* Requests Table */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="py-16 text-center text-slate-400 text-xs">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
              Loading production requests from database...
            </div>
          ) : recentRequests.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-xs">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              <p className="font-semibold text-slate-600 mb-1">No Issues recorded yet</p>
              {canCreate && (
                <>
                  <p className="text-slate-400 mb-4">Click below to create your first production audit Issues.</p>
                  <button
                    onClick={() => navigate('/process-audit/create-request')}
                    className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition"
                  >
                    Create First Issue
                  </button>
                </>
              )}
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#f8fafc] border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3.5 px-6 whitespace-nowrap align-middle">REQUEST ID</th>
                  <th className="py-3.5 px-6 whitespace-nowrap align-middle">Escalation Date </th>
                  <th className="py-3.5 px-6 whitespace-nowrap align-middle">SHIFT</th>
                  <th className="py-3.5 px-6 whitespace-nowrap align-middle">PRODUCT</th>
                  <th className="py-3.5 px-6 whitespace-nowrap align-middle">MODEL</th>
                  <th className="py-3.5 px-6 whitespace-nowrap align-middle text-center">STATUS</th>
                  <th className="py-3.5 px-6 whitespace-nowrap align-middle">CREATED DATE</th>
                  <th className="py-3.5 px-6 whitespace-nowrap align-middle text-center">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {recentRequests.map((req) => {
                  const reqId = req.issue_no || (req.id ? `PA-${req.id}` : 'PA-1');
                  const dateStr = formatDate(req.escalation_date || req.created_at);
                  const prodStr = req.product || '-';
                  const stageStr = req.model || req.stage || 'Standard';
                  const statusStr = req.status || 'Pending Execution';
                  const meta = getStatusMeta(statusStr);
                  const createdDateStr = formatDate(req.created_at);

                  return (
                    <tr key={req.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-4 px-6 font-bold text-blue-600 align-middle whitespace-nowrap">{reqId}</td>
                      <td className="py-4 px-6 text-slate-600 font-medium align-middle whitespace-nowrap">{dateStr}</td>
                      <td className="py-4 px-6 text-slate-600 font-medium align-middle whitespace-nowrap">{req.shift}</td>
                      <td className="py-4 px-6 text-slate-800 font-semibold align-middle whitespace-nowrap">{prodStr}</td>
                      <td className="py-4 px-6 text-slate-600 align-middle whitespace-nowrap">{stageStr}</td>
                      <td className="py-4 px-6 text-center align-middle whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${meta.statusColor}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${meta.dotColor}`}></span>
                          <span>{statusStr}</span>
                        </span>
                      </td>
                      <td className="py-4 px-6 text-slate-600 font-medium align-middle whitespace-nowrap">{createdDateStr}</td>
                      <td className="py-4 px-6 text-center align-middle whitespace-nowrap">
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
                </div>
              )}

              {/* Executor Resolution & Action Report if present */}
              {(selectedRequest.root_cause ||
                selectedRequest.corrective_action ||
                selectedRequest.standardization_details ||
                selectedRequest.target_date ||
                (selectedRequest.action_attachments && selectedRequest.action_attachments !== '[]')) && (
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/90 space-y-3.5">
                    <div className="flex items-center justify-between pb-2.5 border-b border-slate-200">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                        <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                          Executor Corrective Action &amp; Standardization Report
                        </h4>
                      </div>
                      {selectedRequest.action_taken_by && (
                        <span className="text-[10px] text-slate-500">
                          Signed-off by: <strong className="text-slate-800">{selectedRequest.action_taken_by}</strong>
                        </span>
                      )}
                    </div>

                    {selectedRequest.root_cause && (
                      <div>
                        <span className="text-[#003366] block font-bold text-[10px] uppercase mb-1">Root cause</span>
                        <p className="p-3 bg-white rounded-xl border border-slate-200 text-slate-800 leading-relaxed whitespace-pre-wrap text-xs">
                          {selectedRequest.root_cause}
                        </p>
                      </div>
                    )}

                    {selectedRequest.corrective_action && (
                      <div>
                        <span className="text-[#003366] block font-bold text-[10px] uppercase mb-1">Corrective Action (by Resp. Team)</span>
                        <p className="p-3 bg-white rounded-xl border border-slate-200 text-slate-800 leading-relaxed whitespace-pre-wrap text-xs">
                          {selectedRequest.corrective_action}
                        </p>
                      </div>
                    )}

                    {(() => {
                      const actionAtts = getAttachmentsList(selectedRequest.action_attachments);
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
                                        className="p-1 text-slate-500 hover:text-blue-600 rounded-lg hover:bg-slate-100 cursor-pointer"
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

                    {selectedRequest.standardization_details && (
                      <div>
                        <span className="text-[#003366] block font-bold text-[10px] uppercase mb-1">Standardization details</span>
                        <p className="p-3 bg-white rounded-xl border border-slate-200 text-slate-800 leading-relaxed whitespace-pre-wrap text-xs">
                          {selectedRequest.standardization_details}
                        </p>
                      </div>
                    )}

                    {selectedRequest.target_date && (
                      <div className="flex items-center gap-2 text-xs pt-1">
                        <span className="text-[#003366] font-bold">Target Date:</span>
                        <span className="font-semibold text-slate-800 font-mono">{formatDate(selectedRequest.target_date)}</span>
                      </div>
                    )}
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

      {/* Universal Interactive Attachment Preview Modal (Interactive Excel Spreadsheet, PDF, Image) */}
      <AttachmentPreviewModal
        isOpen={Boolean(previewAttachment)}
        attachment={previewAttachment}
        onClose={() => setPreviewAttachment(null)}
      />
    </div>
  );
};

export default ProcessAuditDashboard;
