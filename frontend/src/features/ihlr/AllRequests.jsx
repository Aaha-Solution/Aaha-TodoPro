import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Download,
  Search,
  Filter,
  Eye,
  X,
  AlertCircle,
  CheckCircle2,
  Hourglass,
  Layers,
  Plus,
  ExternalLink,
  ChevronDown,
  Paperclip,
  FileSpreadsheet,
  FileText,
  Clock,
  Check,
  Calendar,
  RotateCcw,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Building2
} from 'lucide-react';
import { ihlrService } from '../../services/ihlrService';
import { IhlrAttachmentThumbnail } from './IhlrAttachmentView';
import IhlrRequestDetailsModal from './IhlrRequestDetailsModal';
import IhlrAttachmentPreviewModal from './IhlrAttachmentPreviewModal';
import ExportSelectionModal from '../../components/common/ExportSelectionModal';
import { exportIhlrToExcel, exportIhlrToPdf, getIhlrDisplayStatus, formatReassignmentHistory } from './ihlrExportUtils';
import DateInput from '../../components/common/DateInput';
import { useAuth } from '../../hooks/useAuth';
import { useModal } from '../../context/ModalContext';
import { formatDateDDMMYYYY } from '../../utils/dateUtils';
import { isIhlrRequestVisibleToUser } from '../../utils/ihlrAuthUtils';
import { DEPARTMENTS, IHLR_SHIFTS, formatIhlrShiftDisplay, getIhlrShiftDetails } from '../../utils/constants';

const IhlrAllRequests = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { confirm: modalConfirm, error: modalError, warning: modalWarning } = useModal();

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
  const canEdit = isAdmin;

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters (defaults to Last 12 Months)
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

  // Detect if current page load is a browser reload / refresh
  const isReload = (() => {
    try {
      const navEntries = performance.getEntriesByType('navigation');
      if (navEntries.length > 0) return navEntries[0].type === 'reload';
      return performance.navigation.type === 1;
    } catch {
      return false;
    }
  })();

  const [search, setSearch] = useState(() => (isReload ? '' : (location.state?.search || '')));
  const [selectedDepartment, setSelectedDepartment] = useState(() => (isReload ? 'All' : (location.state?.filterDept || 'All')));
  const [selectedShift, setSelectedShift] = useState('All');
  const [selected4M, setSelected4M] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState(() => (isReload ? 'All' : (location.state?.filterStatus || 'All')));
  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState(defaultEndDate);
  const [showFilters, setShowFilters] = useState(
    !isReload && Boolean(location.state?.search || location.state?.filterDept || (location.state?.filterStatus && location.state.filterStatus !== 'All'))
  );

  const isDefaultRange = startDate === defaultStartDate && endDate === defaultEndDate;
  const isDefaultYear = isDefaultRange;
  const carryoverCount = requests.filter(r => {
    if (!r.batch_date) return false;
    const itemDateStr = String(r.batch_date).slice(0, 10);
    return itemDateStr < defaultStartDate && (r.status || '').toUpperCase() !== 'CLOSED';
  }).length;
  const hasActiveFilters =
    selectedDepartment !== 'All' ||
    selectedShift !== 'All' ||
    selected4M !== 'All' ||
    selectedStatus !== 'All' ||
    !isDefaultRange ||
    Boolean((search || '').trim());

  const departmentOptions = Array.from(
    new Set([
      ...DEPARTMENTS,
      ...requests.map((r) => (r.resp || '').trim().toUpperCase()).filter(Boolean)
    ])
  ).sort();

  const handleResetFilters = () => {
    setSearch('');
    setSelectedDepartment('All');
    setSelectedShift('All');
    setSelected4M('All');
    setSelectedStatus('All');
    setStartDate(defaultStartDate);
    setEndDate(defaultEndDate);
    try {
      window.history.replaceState({}, document.title, window.location.pathname);
    } catch (_) {}
  };

  useEffect(() => {
    if (isReload) {
      setSearch('');
      setSelectedDepartment('All');
      setSelectedStatus('All');
      try {
        window.history.replaceState({}, document.title, window.location.pathname);
      } catch (_) {}
      return;
    }

    if (location.state?.filterDept) {
      setSelectedDepartment(location.state.filterDept);
    }
    if (location.state?.filterStatus) {
      setSelectedStatus(location.state.filterStatus);
    }
    if (location.state?.search) {
      setSearch(location.state.search);
    }
    if (location.state) {
      try {
        window.history.replaceState({}, document.title, window.location.pathname);
      } catch (_) {}
    }
  }, [location.state]);

  // Modal State
  const [activeModalRequest, setActiveModalRequest] = useState(null);
  const [modalInitialEdit, setModalInitialEdit] = useState(false);
  const [editingCloser, setEditingCloser] = useState(null);
  const [selectedPreviewAttachment, setSelectedPreviewAttachment] = useState(null);

  // Export State
  const [showExportModal, setShowExportModal] = useState(false);

  // Pagination State (matching Approvals tab with max 10)
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  // Reset to page 1 on filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search, selectedDepartment, selectedShift, selected4M, selectedStatus, startDate, endDate]);

  const totalRecords = requests.length;
  const totalPages = Math.ceil(totalRecords / rowsPerPage) || 1;
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = Math.min(startIndex + rowsPerPage, totalRecords);
  const paginatedRequests = requests.slice(startIndex, endIndex);

  // Open Export Modal with empty check
  const handleOpenExportModal = () => {
    if (!requests || requests.length === 0) {
      modalWarning('No data available to export. Please adjust your filters or search criteria.', 'No Data Available');
      return;
    }
    setShowExportModal(true);
  };

  // Export to Excel (.xlsx) using common IHLR export utility
  const handleExportExcel = async () => {
    try {
      if (!requests || requests.length === 0) {
        modalWarning('No data available to export. Cannot download an empty file.', 'No Data Available');
        setShowExportModal(false);
        return;
      }
      const today = new Date().toISOString().slice(0, 10);
      await exportIhlrToExcel({
        requests,
        fileName: `IHLR_Analysis_Report_${today}.xlsx`,
        sheetName: 'IHLR Analysis Log'
      });
      setShowExportModal(false);
    } catch (err) {
      console.error('Failed to export to Excel:', err);
      modalError('Failed to export to Excel: ' + err.message);
    }
  };

  // Export to PDF (.pdf) using common IHLR export utility
  const handleExportPdf = async () => {
    try {
      if (!requests || requests.length === 0) {
        modalWarning('No data available to export. Cannot download an empty file.', 'No Data Available');
        setShowExportModal(false);
        return;
      }
      const today = new Date().toISOString().slice(0, 10);
      await exportIhlrToPdf({
        requests,
        fileName: `IHLR_Analysis_Report_${today}.pdf`,
        title: 'IHLR Analysis Log & Rejection Reports',
        filterText: `Dept: ${selectedDepartment} | Shift: ${selectedShift} | 4M: ${selected4M} | Status: ${selectedStatus} | Range: ${startDate ? formatDateDDMMYYYY(startDate) : 'All'} to ${endDate ? formatDateDDMMYYYY(endDate) : 'All'}`
      });
      setShowExportModal(false);
    } catch (err) {
      console.error('Failed to export to PDF:', err);
      modalError('Failed to export to PDF: ' + err.message);
    }
  };

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const filters = {};
      if (search && search.trim()) filters.search = search.trim();
      if (selectedDepartment && selectedDepartment !== 'All') {
        filters.resp = selectedDepartment;
        filters.filter_dept = selectedDepartment;
      }
      if (selectedShift !== 'All') filters.shift = selectedShift;
      if (selected4M !== 'All') filters.fourM = selected4M;
      if (selectedStatus !== 'All') filters.status = selectedStatus;
      if (startDate) filters.startDate = startDate;
      if (endDate) filters.endDate = endDate;

      const data = await ihlrService.getRequests(filters);
      setRequests(data);
    } catch (err) {
      console.error('Failed to fetch IHLR requests:', err);
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

    window.addEventListener('ihlrLiveUpdate', handleLiveUpdate);

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      window.removeEventListener('ihlrLiveUpdate', handleLiveUpdate);
    };
  }, [search, selectedDepartment, selectedShift, selected4M, selectedStatus, startDate, endDate, user?.name, user?.email, user?.role, user?.department]);

  const handleUpdateStatus = async (id, newStatus, actionUpdate) => {
    try {
      const target = requests.find((r) => r.id === id);
      if (!isAdmin && target && target.status === 'CLOSED') {
        modalError('This incident is closed. Only Admin can update closed reports.');
        return;
      }
      await ihlrService.updateRequest(id, {
        status: newStatus,
        temporary_action: actionUpdate !== undefined ? actionUpdate : undefined,
        user: user ? {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          department: user.department
        } : undefined
      });
      fetchRequests();
      if (activeModalRequest && activeModalRequest.id === id) {
        setActiveModalRequest(prev => ({ ...prev, status: newStatus, temporary_action: actionUpdate || prev.temporary_action }));
      }
      setEditingCloser(null);
    } catch (err) {
      const errMsg = err.response?.data?.message || err.message || 'Failed to update status';
      modalError('Failed to update status: ' + errMsg);
    }
  };

  const handleDelete = async (id, reqNo) => {
    const isConfirmed = await modalConfirm(`Are you sure you want to delete IHLR report #${reqNo}?`);
    if (isConfirmed) {
      try {
        await ihlrService.deleteRequest(id);
        fetchRequests();
        if (activeModalRequest?.id === id) setActiveModalRequest(null);
      } catch (err) {
        modalError('Failed to delete report: ' + err.message);
      }
    }
  };

  const getStatusBadge = (status, req) => {
    const disp = getIhlrDisplayStatus(status, req);
    if (disp === 'CLOSED') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          CLOSED
        </span>
      );
    }
    if (disp === 'AWAITING REVIEW' || disp === 'APPROVAL PENDING') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 whitespace-nowrap">
          <Clock className="w-2.5 h-2.5 text-amber-600" />
          AWAITING REVIEW
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 whitespace-nowrap">
        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
        PENDING
      </span>
    );
  };

  return (
    <div className="space-y-6 w-full pb-16">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
            <span className="text-blue-600 font-bold uppercase tracking-wider font-mono">IHLR REPOSITORY</span>
            <span>/</span>
            <span>Analysis Reports</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              All Requests
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>Plant-Wide Repository</span>
            </span>
            {!canEdit && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                <Eye className="w-3.5 h-3.5 text-slate-500" />
                <span>View Only</span>
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Master repository of in-house line rejections, 5-Why root-causes, and containment actions across all departments.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {canCreate && (
            <button
              onClick={() => navigate('/ihlr/create-request')}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/20 transition transform active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create IHLR Issue</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar (matching Dashboard filter styling) */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-2xs space-y-3.5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-xs font-black uppercase tracking-tight text-slate-800 flex items-center gap-1.5">
              <SlidersHorizontal className="w-3.5 h-3.5 text-blue-600" />
              <span>Filter Analysis Reports</span>
            </span>
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

          {hasActiveFilters && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100/90 border border-rose-200/90 rounded-xl transition-all active:scale-95 cursor-pointer shadow-2xs"
                title="Clear all active filters"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Filters</span>
              </button>
            </div>
          )}
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 text-xs items-center animate-in fade-in slide-in-from-top-1 duration-200">
            {/* Search */}
            <div className="lg:col-span-3 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5 pointer-events-none" />
              <input
                type="text"
                placeholder="Search problem, model, line, inspector, or Req#..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none font-medium"
              />
            </div>

            {/* Department Filter (RESP) */}
            <div className="lg:col-span-2">
              <select
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-semibold focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none cursor-pointer"
              >
                <option value="All">All Departments</option>
                {departmentOptions.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            </div>

            {/* Shift Filter */}
            <div className="lg:col-span-2">
              <select
                value={selectedShift}
                onChange={(e) => setSelectedShift(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-semibold focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none cursor-pointer"
              >
                <option value="All">All Shifts</option>
                {IHLR_SHIFTS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            {/* 4M Filter */}
            <div className="lg:col-span-1">
              <select
                value={selected4M}
                onChange={(e) => setSelected4M(e.target.value)}
                className="w-full px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-semibold focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none cursor-pointer"
              >
                <option value="All">All 4M</option>
                <option value="MAN">MAN</option>
                <option value="MACHINE">MACHINE</option>
                <option value="METHOD">METHOD</option>
                <option value="MATERIAL">MATERIAL</option>
              </select>
            </div>

            {/* Status Filter */}
            <div className="lg:col-span-1">
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-semibold focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none cursor-pointer"
              >
                <option value="All">All Statuses</option>
                <option value="OPEN">Pending</option>
                <option value="IN_PROGRESS">Awaiting Review</option>
                <option value="CLOSED">Closed</option>
              </select>
            </div>

            {/* Date Range Cluster (Timeline Range like Dashboard) */}
            <div className="lg:col-span-3">
              <div className="flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100/70 focus-within:bg-white border border-slate-200/90 focus-within:border-blue-500 rounded-xl p-1 shadow-2xs focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
                <Calendar className="w-3.5 h-3.5 text-indigo-600 ml-1 shrink-0" />
                <div className="min-w-0 flex-1">
                  <DateInput
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    placeholder="From Date"
                    className="w-full px-1.5 py-1 text-xs font-semibold text-slate-800 bg-transparent border-0 focus:ring-0 outline-none placeholder:text-slate-400"
                  />
                </div>
                <span className="text-slate-400 text-xs font-bold px-0.5 select-none shrink-0">→</span>
                <div className="min-w-0 flex-1">
                  <DateInput
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    placeholder="To Date"
                    className="w-full px-1.5 py-1 text-xs font-semibold text-slate-800 bg-transparent border-0 focus:ring-0 outline-none placeholder:text-slate-400"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* IHLR Analysis Report Master Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-extrabold uppercase tracking-widest text-slate-600 font-mono">
              IHLR ANALYSIS REPORT
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 font-mono">
              {requests.length} Records
            </span>
            {carryoverCount > 0 && isDefaultRange && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-300 shadow-2xs">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                <span>{carryoverCount} unclosed from prior year rolled over</span>
              </span>
            )}
          </div>
          <button
            onClick={handleOpenExportModal}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs hover:shadow transition transform active:scale-95 cursor-pointer"
            id="export-view-btn"
          >
            <Download className="w-4 h-4" />
            <span>Export View</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              {/* Top Phase Header Row */}
              <tr className="text-[10px] font-black uppercase tracking-wider text-center border-b border-slate-200">
                <th colSpan={10} className="py-2 px-3 bg-amber-100 text-amber-900 border-r border-amber-200">
                  REQUESTOR (Defect Investigation &amp; QA 5-Why)
                </th>
                <th colSpan={3} className="py-2 px-3 bg-orange-100 text-orange-900 border-r border-orange-200">
                  CLOSER (Production Containment)
                </th>
                <th colSpan={3} className="py-2 px-3 bg-slate-100 text-slate-700">
                  REMARKS &amp; STATUS
                </th>
              </tr>
              {/* Detailed Column Header Row - Wrapped cleanly across 2 lines */}
              <tr className="bg-[#f8fafc] border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                <th className="py-2.5 px-1.5 text-center align-middle whitespace-nowrap">
                  <span className="block">SL</span>
                  <span className="block text-slate-400 font-medium">NO</span>
                </th>
                <th className="py-2.5 px-2 text-left align-middle whitespace-nowrap">
                  <span className="block">REQ</span>
                  <span className="block text-slate-400 font-medium">NO</span>
                </th>
                <th className="py-2.5 px-2 text-left align-middle whitespace-nowrap">
                  <span className="block">INCIDENT DATE</span>
                  <span className="block text-slate-400 font-medium">/ SHIFT</span>
                </th>
                <th className="py-2.5 px-2.5 text-left align-middle min-w-[120px]">
                  <span className="block">PROBLEM / DEFECT</span>
                  <span className="block text-slate-400 font-medium">DESCRIPTION</span>
                </th>
                <th className="py-2.5 px-2 text-left align-middle whitespace-nowrap">
                  <span className="block">MODEL NAME</span>
                  <span className="block text-slate-400 font-medium">/ PART</span>
                </th>
                <th className="py-2.5 px-2 text-left align-middle whitespace-nowrap">
                  <span className="block">PROBLEM</span>
                  <span className="block text-slate-400 font-medium">DETECTED AT</span>
                </th>
                <th className="py-2.5 px-2 text-left align-middle whitespace-nowrap">
                  <span className="block">RECEIVED FROM</span>
                  <span className="block text-slate-400 font-medium">(LINE/CELL)</span>
                </th>
                <th className="py-2.5 px-2 text-left align-middle whitespace-nowrap">
                  <span className="block">ANALYSIS</span>
                  <span className="block text-slate-400 font-medium">DONE BY</span>
                </th>
                <th className="py-2.5 px-1.5 text-center align-middle whitespace-nowrap">
                  <span className="block">DEFECT</span>
                  <span className="block text-slate-400 font-medium">EVIDENCE</span>
                </th>
                <th className="py-2.5 px-2 text-center align-middle whitespace-nowrap">
                  <span className="block">4M CATEGORY</span>
                  <span className="block text-slate-400 font-medium">/ RESPONSIBILITY</span>
                </th>
                <th className="py-2.5 px-2 text-left align-middle min-w-[110px]">
                  <span className="block">OCCURRENCE CAUSE</span>
                  <span className="block text-slate-400 font-medium">(5-WHY)</span>
                </th>
                <th className="py-2.5 px-2 text-left align-middle min-w-[110px]">
                  <span className="block">TEMPORARY</span>
                  <span className="block text-slate-400 font-medium">ACTION TAKEN</span>
                </th>
                <th className="py-2.5 px-1.5 text-center align-middle whitespace-nowrap">
                  <span className="block">TARGET</span>
                  <span className="block text-slate-400 font-medium">DATE</span>
                </th>
                <th className="py-2.5 px-2 text-left align-middle min-w-[90px]">
                  <span className="block">ADMIN</span>
                  <span className="block text-slate-400 font-medium">REMARKS</span>
                </th>
                <th className="py-2.5 px-2 text-center align-middle whitespace-nowrap">
                  <span className="block">STATUS</span>
                  <span className="invisible block">.</span>
                </th>
                <th className="py-2.5 px-2 text-right align-middle whitespace-nowrap">
                  <span className="block">ACTIONS</span>
                  <span className="invisible block">.</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {paginatedRequests.length === 0 ? (
                <tr>
                  <td colSpan={16} className="py-12 text-center text-slate-400">
                    <AlertCircle className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="font-semibold text-slate-600">
                      No IHLR Reports match your filter
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Try resetting search parameters or check other filters.
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedRequests.map((r, index) => (
                  <tr key={r.id} className="hover:bg-slate-50/80 transition-colors align-middle">
                    {/* SL NO */}
                    <td className="py-2.5 px-1.5 text-center font-mono font-semibold text-slate-400 align-middle">
                      {startIndex + index + 1}
                    </td>

                    {/* Req NO */}
                    <td className="py-2.5 px-2 font-mono font-bold text-blue-600 whitespace-nowrap align-middle">
                      {String(r.req_no).startsWith('IHLR-') ? r.req_no : `#${r.req_no}`}
                    </td>

                    {/* Incident Date / Shift */}
                    <td className="py-2.5 px-2 whitespace-nowrap align-middle">
                      <div className="font-semibold text-slate-900 leading-tight">
                        {formatDateDDMMYYYY(r.batch_date)}
                      </div>
                      {Boolean(
                        r.batch_date &&
                        (String(r.batch_date).slice(0, 10) < defaultStartDate || new Date(r.batch_date).getFullYear() < currentYear) &&
                        (r.status || '').toUpperCase() !== 'CLOSED'
                      ) && (
                        <div className="mt-0.5">
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-50 text-amber-800 border border-amber-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                            {new Date(r.batch_date).getFullYear()} Carryover
                          </span>
                        </div>
                      )}
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="text-[10px] font-bold text-slate-600 font-mono">
                          {formatIhlrShiftDisplay(r.shift)}
                        </span>
                        {getIhlrShiftDetails(r.shift)?.timing && (
                          <span className="text-[9px] px-1 py-0.2 rounded bg-slate-100 text-slate-500 font-mono border border-slate-200">
                            {getIhlrShiftDetails(r.shift).timing}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Problem / Defect Description */}
                    <td className="py-2.5 px-2.5 font-semibold text-slate-900 text-xs leading-snug align-middle" title={r.problem}>
                      <div className="line-clamp-2 max-w-[150px]">
                        {r.problem}
                      </div>
                    </td>

                    {/* Model Name / Part */}
                    <td className="py-2.5 px-2 font-bold text-blue-700 whitespace-nowrap text-xs align-middle" title={r.model}>
                      <div className="truncate max-w-[85px]">{r.model}</div>
                    </td>

                    {/* Problem Detected At */}
                    <td className="py-2.5 px-2 text-slate-700 whitespace-nowrap text-xs align-middle" title={r.problem_detected_at}>
                      <div className="truncate max-w-[85px]">{r.problem_detected_at}</div>
                    </td>

                    {/* Received From (Line/Cell) */}
                    <td className="py-2.5 px-2 font-mono text-slate-600 whitespace-nowrap text-xs align-middle" title={r.received_from}>
                      <div className="truncate max-w-[85px]">{r.received_from}</div>
                    </td>

                    {/* Analysis Done By & Created By */}
                    <td className="py-2.5 px-2 font-medium text-slate-800 text-xs align-middle">
                      <div className="truncate max-w-[95px]" title={r.analysis_done_by}>{r.analysis_done_by}</div>
                      {r.created_by && (
                        <div className="text-[9px] text-slate-400 font-normal mt-0.5 truncate max-w-[95px]" title={`Created by ${r.created_by}`}>
                          by {r.created_by}
                        </div>
                      )}
                    </td>

                    {/* Defect Attachment Thumbnail */}
                    <td className="py-2.5 px-1.5 text-center align-middle">
                      <div className="flex items-center justify-center">
                        <IhlrAttachmentThumbnail
                          rawAttachment={r.defect_image}
                        />
                      </div>
                    </td>

                    {/* 4M Category / Responsibility */}
                    <td className="py-2.5 px-2 text-center whitespace-nowrap align-middle">
                      <div className="flex flex-col items-center justify-center">
                        <div className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold font-mono bg-amber-50 text-amber-800 border border-amber-200 mb-0.5">
                          {r.four_m || 'MAN'}
                        </div>
                        <div className="text-[9px] font-bold text-slate-600 font-mono leading-none">
                          {r.resp || '-'}
                        </div>
                        {r.resp_person && (() => {
                          const isReassigned = Boolean(formatReassignmentHistory(r.reassignment_history)?.hasReassignments);
                          return (
                            <div 
                              className={`text-[9px] font-semibold truncate max-w-[100px] mx-auto text-center mt-0.5 ${isReassigned ? 'text-purple-700' : 'text-blue-600'}`} 
                              title={`${isReassigned ? 'Reassigned' : 'Assigned'}: ${r.resp_person}`}
                            >
                              {isReassigned ? `Reassigned: ${r.resp_person}` : r.resp_person}
                            </div>
                          );
                        })()}
                        {(r.temporary_closed_by || r.permanent_closed_by || r.closer_updated_by) && (
                          <div className="text-[9px] text-emerald-700 font-bold truncate max-w-[100px] mx-auto text-center" title={`Closed by: ${r.temporary_closed_by || r.permanent_closed_by || r.closer_updated_by}`}>
                            ✓ {r.temporary_closed_by || r.permanent_closed_by || r.closer_updated_by}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Occurrence Cause (First Why) */}
                    <td className="py-2.5 px-2 text-slate-600 text-xs leading-snug align-middle" title={Array.isArray(r.prod_why_why) ? (r.prod_why_why[0] || '') : (r.prod_why_why || r.occurrence_cause || '')}>
                      <div className="line-clamp-2 max-w-[140px]">
                        {(Array.isArray(r.prod_why_why) ? r.prod_why_why[0] : (r.prod_why_why || r.occurrence_cause)) || '—'}
                      </div>
                    </td>

                    {/* Action Taken */}
                    <td className="py-2.5 px-2 text-slate-800 font-medium text-xs leading-snug align-middle" title={r.temporary_action || r.permanent_fix || r.action || ''}>
                      <div className="line-clamp-2 max-w-[140px]">
                        {r.temporary_action || r.permanent_fix || r.action || '—'}
                      </div>
                    </td>

                    {/* Target Date */}
                    <td className="py-2.5 px-1.5 text-center text-slate-600 font-mono text-[10px] whitespace-nowrap align-middle">
                      {(r.temporary_target_date || r.permanent_target_date)
                        ? formatDateDDMMYYYY(r.temporary_target_date || r.permanent_target_date)
                        : '—'}
                    </td>

                    {/* Admin Remarks */}
                    <td className="py-2.5 px-2 text-slate-600 text-xs leading-snug align-middle" title={r.remarks || ''}>
                      <div className="line-clamp-2 max-w-[120px]">
                        {r.remarks || '—'}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="py-2.5 px-2 text-center whitespace-nowrap align-middle">
                      <div className="flex items-center justify-center">
                        {getStatusBadge(r.status, r)}
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="py-2.5 px-2 text-right whitespace-nowrap align-middle">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => {
                            setActiveModalRequest(r);
                            setModalInitialEdit(false);
                          }}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                          title="View Complete Report"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {isAdmin && (
                          <button
                            onClick={() => {
                              setActiveModalRequest(r);
                              setModalInitialEdit(true);
                            }}
                            className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition cursor-pointer"
                            title="Edit Request (Admin Only)"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="p-3.5 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-end gap-4 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <span>Rows per page:</span>
            <select
              value={rowsPerPage}
              onChange={(e) => {
                setRowsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold outline-none cursor-pointer"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
            </select>
          </div>

          <div className="font-mono text-[11px] text-slate-500">
            {totalRecords === 0
              ? '0–0 of 0'
              : `${startIndex + 1}–${endIndex} of ${totalRecords}`}
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
              title="Previous Page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
              title="Next Page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Complete Inspection & Edit Modal */}
      <IhlrRequestDetailsModal
        isOpen={Boolean(activeModalRequest)}
        request={activeModalRequest}
        initialEditMode={modalInitialEdit}
        onClose={() => {
          setActiveModalRequest(null);
          setModalInitialEdit(false);
        }}
        onUpdated={() => {
          fetchRequests();
        }}
      />

      {/* Standalone Attachment Preview Modal (when clicking table thumbnail directly) */}
      <IhlrAttachmentPreviewModal
        isOpen={Boolean(selectedPreviewAttachment)}
        attachment={selectedPreviewAttachment}
        onClose={() => setSelectedPreviewAttachment(null)}
      />

      {/* Edit Closer & Status Modal */}
      {editingCloser && createPortal(
        <div 
          className="fixed inset-0 !m-0 !mt-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          style={{ zIndex: 99990 }}
          onClick={() => setEditingCloser(null)}
        >
          <div 
            className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-slate-200 p-6 space-y-4 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                Update Report {String(editingCloser.req_no).startsWith('IHLR-') ? editingCloser.req_no : `#${editingCloser.req_no}`}
              </h3>
              <button
                onClick={() => setEditingCloser(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1 text-[11px]">
                  Status
                </label>
                <select
                  disabled={!isAdmin && editingCloser.status === 'CLOSED'}
                  defaultValue={editingCloser.status}
                  id="modal-status-select"
                  className={`w-full px-3 py-2 border rounded-xl font-bold text-slate-900 outline-none ${!isAdmin && editingCloser.status === 'CLOSED'
                      ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed select-none'
                      : 'bg-slate-50 border-slate-200'
                    }`}
                >
                  {isAdmin ? (
                    <>
                      <option value="OPEN">PENDING</option>
                      <option value="IN_PROGRESS">IN PROGRESS</option>
                      <option value="CLOSED">CLOSED</option>
                    </>
                  ) : editingCloser.status === 'CLOSED' ? (
                    <option value="CLOSED">CLOSED (FINALIZED)</option>
                  ) : (
                    <>
                      <option value="IN_PROGRESS">IN PROGRESS</option>
                      <option value="CLOSED">CLOSED</option>
                    </>
                  )}
                </select>
                {!isAdmin && editingCloser.status === 'CLOSED' && (
                  <p className="text-[10px] text-emerald-600 font-semibold mt-1">
                    This incident is closed. Only Admin can update status again.
                  </p>
                )}
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1 text-[11px]">
                  Action Countermeasure
                </label>
                <textarea
                  rows={3}
                  disabled={!isAdmin && editingCloser.status === 'CLOSED'}
                  defaultValue={editingCloser.temporary_action || editingCloser.permanent_fix}
                  id="modal-action-text"
                  placeholder="Describe corrective actions performed..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 outline-none disabled:bg-slate-100 disabled:text-slate-400"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingCloser(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
              >
                Cancel
              </button>
              {!isAdmin && editingCloser.status === 'CLOSED' ? (
                <span className="text-xs text-slate-400 italic py-2">
                  Updates locked for closed records (Admin only)
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    const s = document.getElementById('modal-status-select').value;
                    const a = document.getElementById('modal-action-text').value;
                    handleUpdateStatus(editingCloser.id, s, a);
                  }}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-sm cursor-pointer"
                >
                  Save Changes
                </button>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Export Format Selection Modal */}
      {/* Export Selection Modal */}
      <ExportSelectionModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        onExportExcel={handleExportExcel}
        onExportPdf={handleExportPdf}
        title="Export Analysis Report"
        subtitle="Choose download format for current view"
        recordCount={requests.length}
        excelDescription="Full structured workbook with separate columns for 5-Why root-causes, containment actions, and target dates."
        pdfDescription="Official landscape document formatted with India Nippon Electricals Limited branding, tables, and page numbers."
      />
    </div>
  );
};

export default IhlrAllRequests;
