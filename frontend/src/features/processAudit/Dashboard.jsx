import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  AlertCircle,
  CheckCircle2,
  Layers,
  Eye,
  Filter,
  Calendar,
  Building2,
  RotateCcw,
  X,
  Clock,
  SlidersHorizontal,
  ChevronDown,
  Download
} from 'lucide-react';
import { processAuditService } from '../../services/processAuditService';
import AttachmentThumbnail from '../../components/common/AttachmentThumbnail';
import AttachmentPreviewModal from '../../components/common/AttachmentPreviewModal';
import ExportSelectionModal from '../../components/common/ExportSelectionModal';
import ProcessAuditBarChart from './ProcessAuditBarChart';
import { exportProcessAuditToExcel, exportProcessAuditToPdf, getProcessAuditDisplayStatus } from './processAuditExportUtils';
import DateInput from '../../components/common/DateInput';
import { useAuth } from '../../hooks/useAuth';
import { useModal } from '../../context/ModalContext';
import { formatDateDDMMYYYY, parseDateToYYYYMMDD } from '../../utils/dateUtils';
import { DEPARTMENTS, formatIhlrShiftDisplay, getIhlrShiftDetails } from '../../utils/constants';
import ProcessAuditRequestDetailsModal from './ProcessAuditRequestDetailsModal';

const ProcessAuditDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { warning: modalWarning, error: modalError } = useModal();

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
  const isProduction = userDept === 'PRODUCTION';
  const canCreate = isQad || isAdmin || isProduction;

  const [requests, setRequests] = useState([]);
  const [metrics, setMetrics] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [previewAttachment, setPreviewAttachment] = useState(null);

  // Department & Date Filters State (Defaults to Last 12 Months)
  const getDefault12MonthsRange = () => {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const startD = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    const endD = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return {
      defaultStartDate: `${startD.getFullYear()}-${pad(startD.getMonth() + 1)}-01`,
      defaultEndDate: `${endD.getFullYear()}-${pad(endD.getMonth() + 1)}-${pad(endD.getDate())}`
    };
  };

  const { defaultStartDate, defaultEndDate } = getDefault12MonthsRange();
  const currentYear = new Date().getFullYear();

  const [selectedDept, setSelectedDept] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState(defaultEndDate);
  const [showFilters, setShowFilters] = useState(false);

  const isDefaultRange = startDate === defaultStartDate && endDate === defaultEndDate;
  const isDefaultDept = selectedDept === 'All';
  const hasActiveFilters = !isDefaultDept || selectedStatus !== 'All' || !isDefaultRange;

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

  const handleResetFilters = () => {
    setSelectedDept('All');
    setSelectedStatus('All');
    setStartDate(defaultStartDate);
    setEndDate(defaultEndDate);
  };

  // Build department options from constants and loaded requests
  const departmentOptions = useMemo(() => {
    return Array.from(
      new Set([
        ...DEPARTMENTS,
        ...requests.map((r) => (r.department || '').trim().toUpperCase()).filter(Boolean)
      ])
    ).sort();
  }, [requests]);

  const isRequestClosed = (r) => {
    return getProcessAuditDisplayStatus(r) === 'Closed';
  };

  const isRequestAwaitingReview = (r) => {
    return getProcessAuditDisplayStatus(r) === 'Awaiting Review';
  };

  const isRequestPending = (r) => {
    return getProcessAuditDisplayStatus(r) === 'Pending';
  };

  // Calculate carryover count: unclosed issues prior to defaultStartDate or prior year
  const carryoverCount = useMemo(() => {
    return requests.filter((r) => {
      if (isRequestClosed(r)) return false;
      const dateVal = r.escalation_date || r.created_at || r.createdAt;
      if (!dateVal) return false;
      const itemDateStr = parseDateToYYYYMMDD(dateVal);
      if (!itemDateStr) return false;
      return itemDateStr < defaultStartDate || new Date(dateVal).getFullYear() < currentYear;
    }).length;
  }, [requests, defaultStartDate, currentYear]);

  // Base requests filtered by department and timeline range (for KPI metrics & bar chart)
  const baseFilteredRequests = useMemo(() => {
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

  const total = baseFilteredRequests.length;
  const pendingExec = baseFilteredRequests.filter(isRequestPending).length;
  const inProgress = baseFilteredRequests.filter(isRequestAwaitingReview).length;
  const closed = baseFilteredRequests.filter(isRequestClosed).length;

  // Filter requests based on selected status (for display table and recent logs)
  const filteredRequests = useMemo(() => {
    let list = baseFilteredRequests;
    if (selectedStatus !== 'All') {
      list = baseFilteredRequests.filter((r) => {
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
    }

    return [...list].sort((a, b) => {
      const timeA = new Date(a.escalation_date || a.created_at || a.createdAt || 0).getTime();
      const timeB = new Date(b.escalation_date || b.created_at || b.createdAt || 0).getTime();
      if (timeB !== timeA) return timeB - timeA;
      const idA = typeof a.id === 'number' ? a.id : parseInt(String(a.id || a.issue_no || '').replace(/\D/g, ''), 10) || 0;
      const idB = typeof b.id === 'number' ? b.id : parseInt(String(b.id || b.issue_no || '').replace(/\D/g, ''), 10) || 0;
      return idB - idA;
    });
  }, [baseFilteredRequests, selectedStatus]);

  // Export State & Handlers (Matching IHLR Dashboard)
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  const fetchDashboardExportData = async () => {
    if (filteredRequests && filteredRequests.length > 0) {
      return filteredRequests;
    }
    const filters = { scope: 'dashboard', all: true };
    if (selectedDept && selectedDept !== 'All') {
      filters.department = selectedDept;
      filters.filter_dept = selectedDept;
    }
    if (startDate) {
      filters.startDate = startDate;
    }
    if (endDate) {
      filters.endDate = endDate;
    }
    try {
      const data = await processAuditService.getRequests(filters);
      if (Array.isArray(data) && data.length > 0) {
        return data;
      }
    } catch (err) {
      console.warn('Failed to fetch filtered requests for export, falling back to loaded dashboard requests:', err);
    }
    return requests || [];
  };

  const handleOpenExportModal = () => {
    if (filteredRequests.length === 0 && requests.length === 0) {
      modalWarning('No data available to export. Please adjust your filters or create an issue.', 'No Data Available');
      return;
    }
    setShowExportModal(true);
  };

  // Export to Excel (.xlsx) using common Process Audit export utility
  const handleExportExcel = async () => {
    try {
      setExportLoading(true);
      const dataToExport = await fetchDashboardExportData();
      if (!dataToExport || dataToExport.length === 0) {
        modalWarning('No data available to export. Cannot download an empty file.', 'No Data Available');
        setShowExportModal(false);
        return;
      }
      const today = new Date().toISOString().slice(0, 10);
      await exportProcessAuditToExcel({
        requests: dataToExport,
        fileName: `ProcessAudit_Dashboard_Report_${today}.xlsx`,
        sheetName: 'Audit Dashboard'
      });
      setShowExportModal(false);
    } catch (err) {
      console.error('Failed to export to Excel:', err);
      modalError('Failed to export to Excel: ' + err.message);
    } finally {
      setExportLoading(false);
    }
  };

  // Export to PDF (.pdf) using common Process Audit export utility
  const handleExportPdf = async () => {
    try {
      setExportLoading(true);
      const dataToExport = await fetchDashboardExportData();
      if (!dataToExport || dataToExport.length === 0) {
        modalWarning('No data available to export. Cannot download an empty file.', 'No Data Available');
        setShowExportModal(false);
        return;
      }
      const today = new Date().toISOString().slice(0, 10);
      await exportProcessAuditToPdf({
        requests: dataToExport,
        fileName: `ProcessAudit_Dashboard_Report_${today}.pdf`,
        title: 'Process Audit Dashboard Summary & Observation Reports',
        filterText: `Dept: ${selectedDept} | Status: ${selectedStatus} | Range: ${startDate ? formatDateDDMMYYYY(startDate) : 'All'} to ${endDate ? formatDateDDMMYYYY(endDate) : 'All'}`
      });
      setShowExportModal(false);
    } catch (err) {
      console.error('Failed to export to PDF:', err);
      modalError('Failed to export to PDF: ' + err.message);
    } finally {
      setExportLoading(false);
    }
  };

  const kpis = [
    {
      title: 'Total Issues',
      value: total,
      subtitle: carryoverCount > 0
        ? `${carryoverCount} rolled over from previous year`
        : hasActiveFilters ? 'Filtered audit issues' : (isDefaultRange ? 'Default: Last 12 Months' : 'Recorded audit issues'),
      icon: Layers,
      iconBg: 'bg-blue-50 text-blue-600',
      subtitleColor: carryoverCount > 0 ? 'text-amber-600' : 'text-blue-600',
    },
    {
      title: 'Pending',
      value: pendingExec,
      subtitle: carryoverCount > 0
        ? `Includes ${carryoverCount} unclosed carryover`
        : hasActiveFilters ? 'Filtered pending' : 'Awaiting root cause closer actions',
      icon: AlertCircle,
      iconBg: 'bg-rose-50 text-rose-600',
      subtitleColor: 'text-rose-600',
    },
    {
      title: 'Awaiting Review',
      value: inProgress,
      subtitle: hasActiveFilters ? 'Filtered awaiting review' : 'Awaiting Admin Sign-off & Closure',
      icon: Clock,
      iconBg: 'bg-amber-50 text-amber-600',
      subtitleColor: 'text-amber-600',
    },
    {
      title: 'Closed',
      value: closed,
      subtitle: hasActiveFilters ? 'Filtered verified closures' : 'Verified by QAD',
      icon: CheckCircle2,
      iconBg: 'bg-emerald-50 text-emerald-600',
      subtitleColor: 'text-emerald-600',
    },
  ];

  const getStatusBadge = (status, req) => {
    const disp = getProcessAuditDisplayStatus(status, req);
    if (disp === 'Closed') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          CLOSED
        </span>
      );
    }
    if (disp === 'Awaiting Review' || disp === 'Signed off') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
          <Clock className="w-3 h-3 text-amber-600" />
          AWAITING REVIEW
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
        PENDING
      </span>
    );
  };

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
            <span className="font-bold text-slate-700">
              {isDefaultRange
                ? 'Last 12 Months Data'
                : `Timeline Data (${startDate ? formatDateDDMMYYYY(startDate) : 'Start'} → ${endDate ? formatDateDDMMYYYY(endDate) : 'End'})`}
            </span>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Process Audit Analysis Dashboard
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleOpenExportModal}
            className="flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/90 hover:border-slate-300 rounded-xl text-xs font-bold shadow-2xs hover:shadow-xs transition transform active:scale-95 cursor-pointer"
            id="dashboard-export-btn"
            title="Export filtered Process Audit reports to Excel or PDF"
          >
            <Download className="w-4 h-4 text-blue-600" />
            <span>Export View</span>
          </button>

          {canCreate && (
            <button
              onClick={() => navigate('/process-audit/create-request')}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/20 transition transform active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create Process Issue</span>
            </button>
          )}
        </div>
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
                    <span>{isDefaultRange ? 'Last 12 Months Data' : hasActiveFilters ? 'Active Custom Filter' : 'All Data'}</span>
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
              </div>
            </div>

            {/* Filter Controls Row */}
            {showFilters && (
              <div className="flex flex-wrap items-center gap-3 animate-in fade-in slide-in-from-top-1 duration-200">
                {/* Department Dropdown */}
                <div className="min-w-[190px] flex-1 sm:flex-initial">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-blue-600" />
                      <span>Department</span>
                    </span>
                    {!isAdmin && userDept && (
                      <span className="text-[9px] font-extrabold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                        My Dept
                      </span>
                    )}
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
                    {isDefaultRange && (
                      <span className="text-[10px] font-bold text-blue-600">
                        Default: Last 12 Months
                      </span>
                    )}
                  </label>
                  <div className="flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100/70 focus-within:bg-white border border-slate-200/90 focus-within:border-blue-500 rounded-xl p-1 shadow-2xs focus-within:ring-4 focus-within:ring-blue-500/10 transition-all">
                    <div className="w-[135px]">
                      <DateInput
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        placeholder="From Date"
                        className="w-full px-2 py-1 text-xs font-semibold text-slate-800 bg-transparent border-0 focus:ring-0 outline-none placeholder:text-slate-400"
                      />
                    </div>
                    <span className="text-slate-400 text-xs font-bold px-0.5 select-none">→</span>
                    <div className="w-[135px]">
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
        startDate={startDate}
        endDate={endDate}
        defaultStartDate={defaultStartDate}
        defaultEndDate={defaultEndDate}
        onDateRangeChange={(newStart, newEnd) => {
          setStartDate(newStart);
          setEndDate(newEnd);
        }}
        onSelectDepartment={(dept) => {
          setSelectedDept(dept);
          setShowFilters(true);
        }}
        onSelectStatus={(status) => setSelectedStatus(status)}
        currentYear={currentYear}
      />

      {/* Complete Inspection & Admin Edit Modal */}
      <ProcessAuditRequestDetailsModal
        isOpen={Boolean(selectedRequest)}
        request={selectedRequest}
        onClose={() => setSelectedRequest(null)}
        onUpdated={() => {
          loadDashboardData();
        }}
      />

      {/* Universal Interactive Attachment Preview Modal (Interactive Excel Spreadsheet, PDF, Image) */}
      <AttachmentPreviewModal
        isOpen={Boolean(previewAttachment)}
        attachment={previewAttachment}
        onClose={() => setPreviewAttachment(null)}
      />

      {/* Export Format Selection Modal */}
      <ExportSelectionModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        onExportExcel={handleExportExcel}
        onExportPdf={handleExportPdf}
        title="Export Analysis Report"
        subtitle="Choose download format for current dashboard view"
        recordCount={filteredRequests.length || requests.length}
        excelDescription="Full structured workbook with separate columns for 5-Why root-causes, temporary & permanent actions, reassignment tracking, and target dates."
        pdfDescription="Official landscape document formatted with India Nippon Electricals Limited branding, tables, and page numbers."
      />
    </div>
  );
};

export default ProcessAuditDashboard;
