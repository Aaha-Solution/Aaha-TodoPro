import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  BarChart3,
  Hourglass,
  Clock,
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
  Image as ImageIcon,
  Filter,
  Calendar,
  Building2,
  RotateCcw,
  ChevronDown,
  SlidersHorizontal,
  Layers
} from 'lucide-react';
import { processAuditService } from '../../services/processAuditService';
import { useAuth } from '../../hooks/useAuth';
import AttachmentThumbnail from '../../components/common/AttachmentThumbnail';
import AttachmentPreviewModal from '../../components/common/AttachmentPreviewModal';
import { triggerDirectDownload, resolveAttachmentUrl } from '../../components/common/attachmentUtils';
import { DEPARTMENTS } from '../../utils/constants';
import DateInput from '../../components/common/DateInput';
import { formatDateDDMMYYYY, parseDateToYYYYMMDD } from '../../utils/dateUtils';
import { storage } from '../../utils/storage';
import ProcessAuditRequestDetailsModal from './ProcessAuditRequestDetailsModal';
import { getProcessAuditDisplayStatus } from './processAuditExportUtils';
import ProcessAuditBarChart from './ProcessAuditBarChart';

const ProcessAuditDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const savedUser = storage.getUser();
  const currentUser = user || savedUser;

  const userDept = (currentUser?.department || (() => {
    try {
      const u = sessionStorage.getItem('todo_user') || localStorage.getItem('todo_user');
      return u ? JSON.parse(u)?.department : '';
    } catch {
      return '';
    }
  })() || '').trim().toUpperCase();

  const userRole = (currentUser?.role || (() => {
    try {
      const u = sessionStorage.getItem('todo_user') || localStorage.getItem('todo_user');
      return u ? JSON.parse(u)?.role : '';
    } catch {
      return '';
    }
  })() || '').trim().toUpperCase();

  const isQad = userDept === 'QAD';
  const isAdmin = userRole === 'ADMIN' || isQad;
  const canCreate = isQad || isAdmin;

  const [requests, setRequests] = useState([]);
  const [metrics, setMetrics] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [previewAttachment, setPreviewAttachment] = useState(null);

  // Department & Date Filters State (Defaults to Current Year)
  const currentYear = new Date().getFullYear();
  const defaultStartDate = `${currentYear}-01-01`;
  const defaultEndDate = `${currentYear}-12-31`;

  const [selectedDept, setSelectedDept] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState(defaultEndDate);
  const [showFilters, setShowFilters] = useState(false);

  const isDefaultYear = startDate === defaultStartDate && endDate === defaultEndDate;
  const isDefaultDept = selectedDept === 'All';
  const hasActiveFilters = !isDefaultDept || selectedStatus !== 'All' || !isDefaultYear;

  const loadDashboardData = async (overrides = {}) => {
    setLoading(true);
    try {
      const activeDept = overrides.selectedDept !== undefined 
        ? overrides.selectedDept 
        : selectedDept;
      const activeStart = overrides.startDate !== undefined ? overrides.startDate : startDate;
      const activeEnd = overrides.endDate !== undefined ? overrides.endDate : endDate;

      const filters = { scope: 'dashboard', all: true };
      if (activeDept && activeDept !== 'All') {
        filters.department = activeDept;
        filters.filter_dept = activeDept;
      }
      if (activeStart) {
        filters.startDate = activeStart;
      }
      if (activeEnd) {
        filters.endDate = activeEnd;
      }

      const reqFilters = { scope: 'dashboard', all: true };
      if (activeDept && activeDept !== 'All') {
        reqFilters.department = activeDept;
        reqFilters.filter_dept = activeDept;
      }

      const [reqsData, statsData] = await Promise.allSettled([
        processAuditService.getRequests(reqFilters),
        processAuditService.getDashboardStats(filters)
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
  }, [selectedDept, startDate, endDate]);

  useEffect(() => {
    let debounceTimer = null;
    const handleLiveUpdate = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        loadDashboardData();
      }, 150);
    };

    window.addEventListener('processAuditLiveUpdate', handleLiveUpdate);

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      window.removeEventListener('processAuditLiveUpdate', handleLiveUpdate);
    };
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
    if (s.includes('approval') || s.includes('progress') || s.includes('review')) {
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

  const getStatusBadge = (status) => {
    const meta = getStatusMeta(status);
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${meta.statusColor}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${meta.dotColor}`} />
        <span>{status}</span>
      </span>
    );
  };


  const getFullAttachmentUrl = (att) => resolveAttachmentUrl(att, 'process-audit');

  const getFileMeta = (file) => {
    const ext = ((file?.type || file?.name?.split('.').pop()) || '').toUpperCase();
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

  const handleResetFilters = () => {
    setSelectedDept('All');
    setSelectedStatus('All');
    setStartDate(defaultStartDate);
    setEndDate(defaultEndDate);
  };

  // Build department options from constants and loaded requests
  const departmentOptions = React.useMemo(() => {
    return Array.from(
      new Set([
        ...DEPARTMENTS,
        ...requests.map((r) => (r.department || '').trim().toUpperCase()).filter(Boolean)
      ])
    ).sort();
  }, [requests]);

  // Base requests filtered by department and timeline range (for KPI metrics calculation)
  const baseFilteredRequests = React.useMemo(() => {
    return requests.filter((r) => {
      // Department filter
      if (selectedDept !== 'All') {
        const dept = (r.department || '').trim().toUpperCase();
        if (dept !== selectedDept.toUpperCase()) return false;
      }

      // Date range filter
      if (startDate || endDate) {
        const dateVal = r.escalation_date || r.created_at || r.createdAt;
        if (!dateVal) return false;
        const itemDateStr = parseDateToYYYYMMDD(dateVal);
        if (!itemDateStr) return false;
        if (startDate && itemDateStr < startDate) return false;
        if (endDate && itemDateStr > endDate) return false;
      }

      return true;
    });
  }, [requests, selectedDept, startDate, endDate]);

  const isRequestClosed = (r) => {
    const s = (r?.status || '').toLowerCase();
    return s.includes('close');
  };

  const isRequestPending = (r) => {
    if (isRequestClosed(r)) return false;
    const s = (r?.status || '').toLowerCase();
    if (s.includes('pending')) return true;
    return !s.includes('review') && !s.includes('progress') && !s.includes('signed') && !s.includes('approval') && !s.includes('approved') && !s.includes('open') && !s.includes('reject');
  };

  const isRequestAwaitingReview = (r) => {
    if (isRequestClosed(r) || isRequestPending(r)) return false;
    const s = (r?.status || '').toLowerCase();
    return (
      s.includes('review') ||
      s.includes('progress') ||
      s.includes('signed') ||
      s.includes('approval') ||
      s.includes('approved')
    );
  };

  const total = baseFilteredRequests.length;
  const pendingExec = baseFilteredRequests.filter(isRequestPending).length;
  const inProgress = baseFilteredRequests.filter(isRequestAwaitingReview).length;
  const closed = baseFilteredRequests.filter(isRequestClosed).length;

  // Filter requests based on selected status (for display table and recent logs)
  const filteredRequests = React.useMemo(() => {
    if (selectedStatus === 'All') return baseFilteredRequests;

    return baseFilteredRequests.filter((r) => {
      if (selectedStatus === 'PENDING') {
        return isRequestPending(r);
      }
      if (selectedStatus === 'IN_PROGRESS' || selectedStatus === 'AWAITING_REVIEW' || selectedStatus === 'Awaiting Review') {
        return isRequestAwaitingReview(r);
      }
      if (selectedStatus === 'CLOSED') {
        return isRequestClosed(r);
      }
      return true;
    });
  }, [baseFilteredRequests, selectedStatus]);

  const kpis = [
    {
      title: 'Total Issues',
      value: String(total),
      subtitle: hasActiveFilters ? 'Filtered audit issues' : (isDefaultYear ? `Current Year ${currentYear}` : 'Recorded audit issues'),
      icon: Layers,
      iconBg: 'bg-blue-50 text-blue-600',
      subtitleColor: 'text-blue-600',
    },
    {
      title: 'Pending',
      value: String(pendingExec),
      subtitle: hasActiveFilters ? 'Filtered pending' : (isDefaultYear ? `Current Year ${currentYear}` : 'Awaiting root cause closer actions'),
      icon: AlertCircle,
      iconBg: 'bg-rose-50 text-rose-600',
      subtitleColor: 'text-rose-600',
    },
    {
      title: 'Awaiting Review',
      value: String(inProgress),
      subtitle: hasActiveFilters ? 'Filtered awaiting review' : (isDefaultYear ? `Current Year ${currentYear}` : 'Awaiting Admin Sign-off & Closure'),
      icon: Clock,
      iconBg: 'bg-amber-50 text-amber-600',
      subtitleColor: 'text-amber-600',
    },
    {
      title: 'Closed',
      value: String(closed),
      subtitle: hasActiveFilters ? 'Filtered verified closures' : (isDefaultYear ? `Current Year ${currentYear}` : 'Verified & closed'),
      icon: CheckCircle2,
      iconBg: 'bg-emerald-50 text-emerald-600',
      subtitleColor: 'text-emerald-600',
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

  // Sort and display the most recent filtered requests
  const displayRequests = React.useMemo(() => {
    return [...filteredRequests]
      .sort((a, b) => {
        const timeA = new Date(a.created_at || a.createdAt || a.escalation_date || 0).getTime();
        const timeB = new Date(b.created_at || b.createdAt || b.escalation_date || 0).getTime();
        if (timeB !== timeA) return timeB - timeA;
        const idA = typeof a.id === 'number' ? a.id : parseInt(String(a.id || a.issue_no || '').replace(/\D/g, ''), 10) || 0;
        const idB = typeof b.id === 'number' ? b.id : parseInt(String(b.id || b.issue_no || '').replace(/\D/g, ''), 10) || 0;
        return idB - idA;
      })
      .slice(0, 15);
  }, [filteredRequests]);

  return (
    <div className="space-y-6 w-full pb-12">
      {/* Page Title & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
            <span className="text-blue-600 font-bold uppercase tracking-wider font-mono">PROCESS AUDIT PORTAL</span>
            <span>/</span>
            <span>Overview Dashboard</span>
            <span>/</span>
            <span className="font-bold text-slate-700">Data on Current Year ({currentYear})</span>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Process Audit Dashboard
            </h1>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
              <Building2 className="w-3.5 h-3.5 text-blue-500" />
              <span>Plant-Wide Audit Overview</span>
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Real-time plant-wide shopfloor process audit observations monitoring, corrective actions tracking, and verification across all departments.
          </p>
        </div>

        {canCreate && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/process-audit/create-request')}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/20 transition transform active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create Process Issue</span>
            </button>
          </div>
        )}
      </div>

      {/* Ultra-Modern Filter Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-sm transition-all duration-300 relative overflow-hidden">
        {/* Subtle accent highlight at top edge */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-500 via-indigo-500 to-sky-400" />

        <div className="p-4 sm:p-5 space-y-3.5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Header with gradient badge */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20 ring-4 ring-blue-50 shrink-0">
                <SlidersHorizontal className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-sm font-black uppercase tracking-tight text-slate-800">
                    Filter Observations
                  </h2>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs">
                    <Calendar className="w-3 h-3 text-blue-600" />
                    <span>{isDefaultYear ? `Data on Current Year (${currentYear})` : hasActiveFilters ? 'Active Custom Filter' : 'All Data'}</span>
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
                <p className="text-xs text-slate-500 mt-0.5">
                  Filter KPI metrics and recent audit observation logs
                </p>
              </div>
            </div>

            {/* Filter Controls Row */}
            {showFilters && (
              <div className="flex flex-wrap items-center gap-3 animate-in fade-in slide-in-from-top-1 duration-200">
                {/* Department Dropdown */}
                <div className="min-w-[190px] flex-1 sm:flex-initial">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-blue-600" />
                    <span>Department</span>
                  </label>
                  <div className="relative">
                    <select
                      value={selectedDept}
                      onChange={(e) => setSelectedDept(e.target.value)}
                      className="w-full appearance-none pl-3.5 pr-8 py-2 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200/90 hover:border-slate-300 focus:border-blue-500 rounded-xl text-xs font-semibold text-slate-800 shadow-2xs focus:ring-4 focus:ring-blue-500/10 outline-none transition-all cursor-pointer"
                    >
                      <option value="All">All Departments</option>
                      {departmentOptions.map((dept) => (
                        <option key={dept} value={dept}>
                          {dept}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>

                {/* Status Dropdown */}
                <div className="min-w-[170px] flex-1 sm:flex-initial">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Status</span>
                  </label>
                  <div className="relative">
                    <select
                      value={selectedStatus}
                      onChange={(e) => setSelectedStatus(e.target.value)}
                      className="w-full appearance-none pl-3.5 pr-8 py-2 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200/90 hover:border-slate-300 focus:border-blue-500 rounded-xl text-xs font-semibold text-slate-800 shadow-2xs focus:ring-4 focus:ring-blue-500/10 outline-none transition-all cursor-pointer"
                    >
                      <option value="All">All Statuses</option>
                      <option value="PENDING">Pending</option>
                      <option value="IN_PROGRESS">Awaiting Review</option>
                      <option value="CLOSED">Closed</option>
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>

                {/* Date Range Cluster */}
                <div className="flex-1 sm:flex-initial">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Timeline Range</span>
                    </span>
                    {isDefaultYear && (
                      <span className="text-[10px] font-bold text-blue-600">
                        Current Year {currentYear}
                      </span>
                    )}
                  </label>
                  <div className="flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100/70 focus-within:bg-white border border-slate-200/90 focus-within:border-blue-500 rounded-xl p-1 shadow-2xs focus-within:ring-4 focus-within:ring-blue-500/10 transition-all">
                    <div className="w-[125px]">
                      <DateInput
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        placeholder="From Date"
                        className="w-full px-2 py-1 text-xs font-semibold text-slate-800 bg-transparent border-0 focus:ring-0 outline-none placeholder:text-slate-400"
                      />
                    </div>
                    <span className="text-slate-400 text-xs font-bold px-0.5 select-none">→</span>
                    <div className="w-[125px]">
                      <DateInput
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        placeholder="To Date"
                        className="w-full px-2 py-1 text-xs font-semibold text-slate-800 bg-transparent border-0 focus:ring-0 outline-none placeholder:text-slate-400"
                      />
                    </div>
                  </div>
                </div>

                {/* Reset Button */}
                {hasActiveFilters && (
                  <div className="self-end pb-0.5">
                    <button
                      type="button"
                      onClick={handleResetFilters}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100/90 border border-rose-200/90 rounded-xl transition-all active:scale-95 cursor-pointer shadow-2xs"
                      title="Clear all active filters"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Reset</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Active Badges Row (Only shown when custom filter applied) */}
          {hasActiveFilters && (
            <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-slate-100 text-xs">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Active:</span>

                {isAdmin && selectedDept !== 'All' && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs">
                    <span>Dept: <strong>{selectedDept}</strong></span>
                    <button
                      type="button"
                      onClick={() => setSelectedDept('All')}
                      className="hover:text-blue-900 cursor-pointer p-0.5 rounded hover:bg-blue-100/60 transition-colors"
                      title="Clear department filter"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                )}

                {selectedStatus !== 'All' && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
                    <span>
                      Status: <strong>{selectedStatus === 'PENDING' ? 'Pending' : selectedStatus === 'IN_PROGRESS' ? 'Awaiting Review' : 'Closed'}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedStatus('All')}
                      className="hover:text-emerald-900 cursor-pointer p-0.5 rounded hover:bg-emerald-100/60 transition-colors"
                      title="Clear status filter"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                )}

                {!isDefaultYear && (Boolean(startDate) || Boolean(endDate)) && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-2xs">
                    <span>
                      {startDate ? formatDateDDMMYYYY(startDate) : 'Start'} → {endDate ? formatDateDDMMYYYY(endDate) : 'End'}
                    </span>
                    <button
                      type="button"
                      onClick={() => { setStartDate(defaultStartDate); setEndDate(defaultEndDate); }}
                      className="hover:text-indigo-900 cursor-pointer p-0.5 rounded hover:bg-indigo-100/60 transition-colors"
                      title="Reset to current year"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                )}

                {!isDefaultYear && !startDate && !endDate && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200 shadow-2xs">
                    <span>All Time (All Years)</span>
                  </span>
                )}

                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="text-[11px] font-bold text-slate-500 hover:text-rose-600 underline cursor-pointer ml-1"
                >
                  Reset to default
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* KPI Cards Row (Static Overview Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, index) => {
          const Icon = kpi.icon;
          return (
            <div
              key={index}
              className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/90 shadow-2xs select-none"
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">{kpi.title}</span>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${kpi.iconBg}`}>
                  <Icon className="w-5 h-5" />
                </div>
              </div>
              <div>
                <span className="text-3xl font-black text-slate-900 font-mono tracking-tight">{kpi.value}</span>
                <p className={`text-[11px] mt-1 font-semibold ${kpi.subtitleColor || 'text-slate-400'}`}>{kpi.subtitle}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Interactive Process Audit Bar Chart Section */}
      <ProcessAuditBarChart
        stats={metrics}
        requests={baseFilteredRequests}
        onSelectDepartment={(dept) => {
          if (isAdmin) {
            setSelectedDept(dept);
            setShowFilters(true);
          }
        }}
        onSelectStatus={(status) => setSelectedStatus(status)}
        currentYear={currentYear}
      />

      {/* Recent Production Requests Card */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
        {/* Card Header */}
        <div className="p-5 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900">Recent 5 Issues</h2>
              {hasActiveFilters && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                  Filtered
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {hasActiveFilters
                ? 'Displaying recent audit observation issues matching your active filter criteria.'
                : 'Live shopfloor audit observations with corrective actions & verification.'}
            </p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            {hasActiveFilters && (
              <button
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Clear Filters</span>
              </button>
            )}
            <button
              onClick={() => navigate('/process-audit/all-requests')}
              className="px-3.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 shadow-2xs transition cursor-pointer"
            >
              View All Tracking
            </button>
          </div>
        </div>

        {/* Requests Table */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="py-16 text-center text-slate-400 text-xs">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
              Loading production requests from database...
            </div>
          ) : displayRequests.length === 0 ? (
            hasActiveFilters ? (
              <div className="py-12 text-center text-slate-400">
                <AlertCircle className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                <p className="font-semibold text-slate-600">No Issues match the selected filter criteria</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Try adjusting or clearing the department or date filter criteria.</p>
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset All Filters</span>
                </button>
              </div>
            ) : (
              <div className="py-12 text-center text-slate-400">
                <AlertCircle className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                <p className="font-semibold text-slate-600">No Issues recorded yet</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {canCreate ? 'Click "Create Process Issue" to file your first audit observation.' : 'Audit observations will appear here once recorded.'}
                </p>
              </div>
            )
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#f8fafc] border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3.5 px-4 text-center w-14">SL NO</th>
                  <th className="py-3.5 px-4">ISSUE NO</th>
                  <th className="py-3.5 px-4">DATE / SHIFT</th>
                  <th className="py-3.5 px-6">OBSERVATION &amp; MODEL</th>
                  <th className="py-3.5 px-4">STAGE &amp; LINE</th>
                  <th className="py-3.5 px-2 text-center w-14">EVIDENCE</th>
                  <th className="py-3.5 px-4">DEPARTMENT</th>
                  <th className="py-3.5 px-4">EXECUTOR</th>
                  <th className="py-3.5 px-4">STATUS</th>
                  <th className="py-3.5 px-6 text-right">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {displayRequests.slice(0, 5).map((req, index) => {
                  const reqId = req.issue_no || (req.id ? `PA-${req.id}` : 'PA-1');
                  const dateStr = formatDate(req.escalation_date || req.created_at);
                  const prodStr = req.product || '-';
                  const stageStr = req.model || req.stage || 'Standard';
                  const lineStr = req.process_operation || req.line || '-';
                  const deptStr = req.department || '-';
                  const statusStr = getProcessAuditDisplayStatus(req);

                  return (
                    <tr key={req.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* SL NO */}
                      <td className="py-4 px-4 text-center font-mono font-semibold text-slate-500">
                        {index + 1}
                      </td>

                      {/* Issue NO */}
                      <td className="py-4 px-4 font-mono font-bold text-blue-600 whitespace-nowrap">
                        {reqId}
                      </td>

                      {/* Date / Shift */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        <div className="font-semibold text-slate-900">{dateStr}</div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] font-bold text-slate-600 font-mono">
                            {req.shift || 'General'}
                          </span>
                        </div>
                      </td>

                      {/* Problem & Model */}
                      <td className="py-4 px-6">
                        <div className="font-bold text-slate-900 truncate max-w-[200px]" title={req.issue_observation || prodStr}>
                          {req.issue_observation || prodStr}
                        </div>
                        <div className="text-[11px] text-blue-600 font-medium">
                          {stageStr} • {prodStr}
                        </div>
                      </td>

                      {/* Stage & Line */}
                      <td className="py-4 px-4">
                        <div className="font-semibold text-slate-800">{lineStr}</div>
                        <span className="text-[10px] text-slate-500 font-mono">{stageStr}</span>
                      </td>

                      {/* Defect Attachment Thumbnail */}
                      <td className="py-4 px-2 text-center">
                        <div className="flex items-center justify-center">
                          <AttachmentThumbnail
                            rawAttachment={req.action_attachments || req.attachments}
                            onClick={(e) => {
                              e?.stopPropagation?.();
                              setSelectedRequest(req);
                            }}
                          />
                        </div>
                      </td>

                      {/* Department */}
                      <td className="py-4 px-4 font-mono">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 text-xs font-semibold">
                          <Building2 className="w-3 h-3 text-slate-500" />
                          {deptStr}
                        </span>
                      </td>

                      {/* Executor */}
                      <td className="py-4 px-4 font-mono">
                        <div className="font-bold text-slate-800 text-xs truncate max-w-[120px]" title={req.executor || 'Assigned Lead'}>
                          {req.executor || 'Assigned Lead'}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate max-w-[120px]" title={req.created_by}>
                          by {req.created_by || '-'}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        {getStatusBadge(statusStr)}
                      </td>

                      {/* View Action */}
                      <td className="py-4 px-6 text-right whitespace-nowrap">
                        <button
                          onClick={() => setSelectedRequest(req)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold text-blue-600 hover:text-blue-700 bg-blue-50/60 hover:bg-blue-100/80 border border-blue-200/60 rounded-lg transition cursor-pointer"
                          title="View Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View</span>
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

      {/* Complete Inspection & Admin Edit Modal */}
      <ProcessAuditRequestDetailsModal
        isOpen={Boolean(selectedRequest)}
        request={selectedRequest}
        onClose={() => setSelectedRequest(null)}
        onUpdated={() => {
          loadData();
        }}
      />

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
