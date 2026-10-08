import React, { useState, useEffect } from 'react';
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
  Sparkles
} from 'lucide-react';
import { ihlrService } from '../../services/ihlrService';
import { IhlrAttachmentThumbnail } from './IhlrAttachmentView';
import IhlrAttachmentPreviewModal from './IhlrAttachmentPreviewModal';
import IhlrRequestDetailsModal from './IhlrRequestDetailsModal';
import DateInput from '../../components/common/DateInput';
import { useAuth } from '../../hooks/useAuth';
import { formatDateDDMMYYYY } from '../../utils/dateUtils';
import { DEPARTMENTS } from '../../utils/constants';

const IhlrDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const userDept = (user?.department || (() => {
    try {
      const u = sessionStorage.getItem('todo_user') || localStorage.getItem('todo_user');
      return u ? JSON.parse(u)?.department : '';
    } catch {
      return '';
    }
  })() || '').trim().toUpperCase();

  const userRole = (user?.role || '').trim().toUpperCase();
  const isIncomingQuality = userDept === 'INCOMING QUALITY';
  const isAdmin = userRole === 'ADMIN' || isIncomingQuality;
  const canCreate = isIncomingQuality || isAdmin;

  const [stats, setStats] = useState({
    total: 0,
    open: 0,
    inProgress: 0,
    closed: 0,
    fourMBreakdown: { MAN: 0, MACHINE: 0, METHOD: 0, MATERIAL: 0 },
    recentRequests: []
  });
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [selectedPreviewAttachment, setSelectedPreviewAttachment] = useState(null);

  // Department & Date Filters State (Defaults to Current Year)
  const currentYear = new Date().getFullYear();
  const defaultStartDate = `${currentYear}-01-01`;
  const defaultEndDate = `${currentYear}-12-31`;

  const [selectedDept, setSelectedDept] = useState('All');
  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState(defaultEndDate);

  const isDefaultYear = startDate === defaultStartDate && endDate === defaultEndDate;
  const hasActiveFilters = selectedDept !== 'All' || !isDefaultYear;

  const loadData = async (overrides = {}) => {
    setLoading(true);
    try {
      const activeDept = overrides.selectedDept !== undefined ? overrides.selectedDept : selectedDept;
      const activeStart = overrides.startDate !== undefined ? overrides.startDate : startDate;
      const activeEnd = overrides.endDate !== undefined ? overrides.endDate : endDate;

      const filters = {};
      if (activeDept && activeDept !== 'All') {
        filters.resp = activeDept;
      }
      if (activeStart) {
        filters.startDate = activeStart;
      }
      if (activeEnd) {
        filters.endDate = activeEnd;
      }

      const data = await ihlrService.getDashboardStats(filters);
      setStats(data);
    } catch (err) {
      console.error('Failed to load IHLR dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    let debounceTimer = null;
    const handleLiveUpdate = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        loadData();
      }, 150);
    };

    window.addEventListener('ihlrLiveUpdate', handleLiveUpdate);

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      window.removeEventListener('ihlrLiveUpdate', handleLiveUpdate);
    };
  }, [user?.name, user?.email, user?.role, user?.department, selectedDept, startDate, endDate]);

  const handleResetFilters = () => {
    setSelectedDept('All');
    setStartDate(defaultStartDate);
    setEndDate(defaultEndDate);
  };

  const departmentOptions = Array.from(
    new Set([
      ...DEPARTMENTS,
      ...(stats?.recentRequests || []).map(r => (r.resp || '').trim().toUpperCase()).filter(Boolean)
    ])
  ).sort();

  const kpis = [
    {
      title: 'Total Issues',
      value: stats.total || 0,
      subtitle: hasActiveFilters ? 'Filtered line rejections' : 'Recorded line rejections',
      icon: Layers,
      iconBg: 'bg-blue-50 text-blue-600',
      filterStatus: 'All',
    },
    {
      title: 'Pending',
      value: stats.open !== undefined ? stats.open : (stats.pending || 0),
      subtitle: hasActiveFilters ? 'Filtered pending' : 'Awaiting root cause closer actions',
      icon: AlertCircle,
      iconBg: 'bg-rose-50 text-rose-600',
      filterStatus: 'OPEN',
    },
    {
      title: 'Approval Pending',
      value: stats.inProgress || 0,
      subtitle: hasActiveFilters ? 'Filtered approval pending' : 'Awaiting Admin Sign-off & Closure',
      icon: Clock,
      iconBg: 'bg-amber-50 text-amber-600',
      filterStatus: 'IN_PROGRESS',
    },
    {
      title: 'Closed',
      value: stats.closed || 0,
      subtitle: hasActiveFilters ? 'Filtered verified closures' : 'Verified by Quality',
      icon: CheckCircle2,
      iconBg: 'bg-emerald-50 text-emerald-600',
      filterStatus: 'CLOSED',
    },
  ];

  const getStatusBadge = (status, req) => {
    const s = (status || '').toUpperCase();
    if (s === 'CLOSED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          CLOSED
        </span>
      );
    }
    const isCompleted = s === 'IN_PROGRESS' || s === 'IN-PROGRESS' || s === 'APPROVAL_PENDING' || s === 'APPROVAL PENDING' || (req && (
      Boolean(req.action && String(req.action).trim()) ||
      Boolean(req.target_date) ||
      (Array.isArray(req.prod_why_why) && req.prod_why_why.some(w => Boolean(w && String(w).trim())))
    ));

    if (isCompleted) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
          <Clock className="w-3 h-3 text-amber-600" />
          APPROVAL PENDING
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
            <span className="text-blue-600 font-bold uppercase tracking-wider font-mono">IHLR PORTAL</span>
            <span>/</span>
            <span>Overview Dashboard</span>
            <span>/</span>
            <span className="font-bold text-slate-700">Data on Current Year ({currentYear})</span>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              IHLR Analysis Dashboard
            </h1>
            {!isAdmin && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                Assigned to: <strong>{user?.name || user?.email}</strong>
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            {isAdmin
              ? 'In-House Line Rejection monitoring, 4M root-cause Why-Why tracking, and corrective action containment.'
              : `Overview of IHLR issues assigned to you (${user?.name || user?.email}).`}
          </p>
        </div>

        {canCreate && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/ihlr/create-request')}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/20 transition transform active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create IHLR Issue</span>
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
                    Filter Issues
                  </h2>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs">
                    <Calendar className="w-3 h-3 text-blue-600" />
                    <span>{isDefaultYear ? `Data on Current Year (${currentYear})` : hasActiveFilters ? 'Active Custom Filter' : 'All Data'}</span>
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Filter KPI metrics, 4M breakdown, and recent rejection logs
                </p>
              </div>
            </div>

            {/* Filter Controls Row */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Department Dropdown */}
              <div className="min-w-[200px] flex-1 sm:flex-initial">
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
          </div>

          {/* Active Badges Row (Only shown when custom filter applied) */}
          {hasActiveFilters && (
            <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-slate-100 text-xs">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Active:</span>

                {selectedDept !== 'All' && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs">
                    <span>Dept: <strong>{selectedDept}</strong></span>
                    <button
                      type="button"
                      onClick={() => setSelectedDept('All')}
                      className="hover:text-blue-900 cursor-pointer p-0.5 rounded hover:bg-blue-100/60 transition-colors"
                      title="Clear department filter"
                    >
                      <X className="w-3 h-3" />
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
                      <X className="w-3 h-3" />
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

      {/* KPI Cards Row (Display only - No navigation) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, index) => {
          const Icon = kpi.icon;
          return (
            <div
              key={index}
              className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/90 shadow-2xs flex flex-col justify-between select-none"
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">{kpi.title}</span>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${kpi.iconBg}`}>
                  <Icon className="w-5 h-5" />
                </div>
              </div>
              <div>
                <span className="text-3xl font-black text-slate-900 font-mono tracking-tight">{kpi.value}</span>
                <p className="text-[11px] text-slate-400 mt-1 font-medium">{kpi.subtitle}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* 4M Distribution Breakdown Banner */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-extrabold uppercase tracking-widest text-slate-400 font-mono">
            4M CLASSIFICATION DISTRIBUTION
          </span>
          <p className="text-xs text-slate-600 mt-0.5">
            Breakdown of root causes by Man, Machine, Method, and Material.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-200 text-xs font-bold text-blue-700">
            <span>MAN:</span>
            <span className="font-mono text-sm">{stats.fourMBreakdown?.MAN || 0}</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-purple-50 border border-purple-200 text-xs font-bold text-purple-700">
            <span>MACHINE:</span>
            <span className="font-mono text-sm">{stats.fourMBreakdown?.MACHINE || 0}</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-xs font-bold text-amber-700">
            <span>METHOD:</span>
            <span className="font-mono text-sm">{stats.fourMBreakdown?.METHOD || 0}</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-700">
            <span>MATERIAL:</span>
            <span className="font-mono text-sm">{stats.fourMBreakdown?.MATERIAL || 0}</span>
          </div>
        </div>
      </div>

      {/* Recent IHLR Analysis Reports Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
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
                ? 'Displaying recent line rejection issues matching your active filter criteria.'
                : 'Live manufacturing rejection cases with Why-Why analysis & closure actions.'}
            </p>
          </div>
          {hasActiveFilters && (
            <button
              onClick={handleResetFilters}
              className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Clear Filters</span>
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#f8fafc] border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3.5 px-4 text-center w-14">SL NO</th>
                <th className="py-3.5 px-4">ISSUE NO</th>
                <th className="py-3.5 px-4">DATE / SHIFT</th>
                <th className="py-3.5 px-6">PROBLEM &amp; MODEL</th>
                <th className="py-3.5 px-4">STAGE &amp; LINE</th>
                <th className="py-3.5 px-2 text-center w-14">DEFECT</th>
                <th className="py-3.5 px-4 text-center">4M</th>
                <th className="py-3.5 px-4">RESP</th>
                <th className="py-3.5 px-4">STATUS</th>
                <th className="py-3.5 px-6 text-right">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {(stats.recentRequests || []).length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    <AlertCircle className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="font-semibold text-slate-600">
                      {hasActiveFilters
                        ? 'No IHLR Issues match the selected filter criteria'
                        : 'No IHLR Reports recorded yet'}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {hasActiveFilters
                        ? 'Try adjusting or clearing the department or date filter criteria.'
                        : canCreate
                        ? 'Click "Create IHLR Issue" to file your first rejection report.'
                        : 'Rejection reports will appear here once recorded.'}
                    </p>
                    {hasActiveFilters && (
                      <button
                        type="button"
                        onClick={handleResetFilters}
                        className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Reset All Filters</span>
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                (stats.recentRequests || []).slice(0, 5).map((req, index) => (
                  <tr key={req.id} className="hover:bg-slate-50/70 transition-colors">
                    {/* SL NO */}
                    <td className="py-4 px-4 text-center font-mono font-semibold text-slate-500">
                      {index + 1}
                    </td>

                    {/* Issue NO */}
                    <td className="py-4 px-4 font-mono font-bold text-blue-600">
                      {String(req.req_no).startsWith('IHLR-') ? req.req_no : `#${req.req_no}`}
                    </td>

                    {/* Date / Shift */}
                    <td className="py-4 px-4">
                      <div className="font-semibold text-slate-900">
                        {formatDateDDMMYYYY(req.batch_date)}
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 font-mono">
                        {String(req.shift || '').toLowerCase().includes('gen') ? req.shift : String(req.shift || '').startsWith('Shift') ? req.shift : `Shift ${req.shift}`}
                      </span>
                    </td>

                    {/* Problem & Model */}
                    <td className="py-4 px-6">
                      <div className="font-bold text-slate-900">{req.problem}</div>
                      <div className="text-[11px] text-blue-600 font-medium">{req.model}</div>
                    </td>

                    {/* Detected At & Line */}
                    <td className="py-4 px-4">
                      <div className="font-semibold text-slate-800">{req.problem_detected_at}</div>
                      <span className="text-[10px] text-slate-500 font-mono">{req.received_from}</span>
                    </td>

                    {/* Defect Attachment Thumbnail (Display only - No modal on click) */}
                    <td className="py-4 px-2 text-center">
                      <div className="flex items-center justify-center">
                        <IhlrAttachmentThumbnail
                          rawAttachment={req.defect_image}
                        />
                      </div>
                    </td>

                    {/* 4M */}
                    <td className="py-4 px-4 text-center">
                      <span className="px-2 py-0.5 rounded-md font-mono text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                        {req.four_m || 'MAN'}
                      </span>
                    </td>

                    {/* Responsibility */}
                    <td className="py-4 px-4 font-mono">
                      <div className="font-bold text-slate-800 text-xs">{req.resp || '-'}</div>
                      {req.resp_person && (
                        <div className="text-[10px] text-blue-600 font-semibold truncate max-w-[120px]" title={req.resp_person}>{req.resp_person}</div>
                      )}
                    </td>

                    {/* Status */}
                    <td className="py-4 px-4">
                      {getStatusBadge(req.status, req)}
                    </td>

                    {/* View Action */}
                    <td className="py-4 px-6 text-right">
                      <button
                        onClick={() => setSelectedRequest(req)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold text-blue-600 hover:text-blue-700 bg-blue-50/60 hover:bg-blue-100/80 border border-blue-200/60 rounded-lg transition cursor-pointer"
                        title="View Detailed Why-Why Analysis"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inspection Modal (Matching Screenshots 1 & 2) */}
      <IhlrRequestDetailsModal
        isOpen={Boolean(selectedRequest)}
        request={selectedRequest}
        onClose={() => setSelectedRequest(null)}
        onEditMode={() => {
          setSelectedRequest(null);
          navigate('/ihlr/my-requests');
        }}
      />

      {/* Standalone Attachment Preview Modal (Works for Excel, PDF, Word, Images) */}
      <IhlrAttachmentPreviewModal
        isOpen={Boolean(selectedPreviewAttachment)}
        attachment={selectedPreviewAttachment}
        onClose={() => setSelectedPreviewAttachment(null)}
      />
    </div>
  );
};

export default IhlrDashboard;
