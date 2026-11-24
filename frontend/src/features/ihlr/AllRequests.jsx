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

  // Responsive screen width handling for mobile, tablet, and desktop
  const [screenWidth, setScreenWidth] = useState(
    typeof window !== 'undefined' ? window.innerWidth : 1200
  );

  useEffect(() => {
    const handleResize = () => setScreenWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isMobile = screenWidth < 768;
  const isTablet = screenWidth >= 768 && screenWidth < 1024;
  const isDesktop = screenWidth >= 1024;

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
      const today = formatDateDDMMYYYY(new Date()).replace(/\//g, '-');
      await exportIhlrToExcel({
        requests,
        fileName: `IHLR_Analysis_Report_${today}.xlsx`,
        sheetName: 'IHLR Analysis Log'
      });
      setShowExportModal(false);
    } catch (err) {
      console.error('Failed to export to Excel:', err);
      setShowExportModal(false);
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
      const today = formatDateDDMMYYYY(new Date()).replace(/\//g, '-');
      await exportIhlrToPdf({
        requests,
        fileName: `IHLR_Analysis_Report_${today}.pdf`,
        title: 'IHLR Analysis Log & Rejection Reports',
        filterText: `Dept: ${selectedDepartment} | Shift: ${selectedShift} | 4M: ${selected4M} | Status: ${selectedStatus} | Range: ${startDate ? formatDateDDMMYYYY(startDate) : 'All'} to ${endDate ? formatDateDDMMYYYY(endDate) : 'All'}`
      });
      setShowExportModal(false);
    } catch (err) {
      console.error('Failed to export to PDF:', err);
      setShowExportModal(false);
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
    <div
      className="space-y-6 w-full pb-16"
      style={{
        width: '100%',
        paddingBottom: isMobile ? '32px' : '64px',
        boxSizing: 'border-box'
      }}
    >
      {/* Top Header */}
      <div
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        style={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          alignItems: isMobile ? 'flex-start' : 'center',
          justifyContent: 'space-between',
          gap: isMobile ? '12px' : '16px',
          marginBottom: isMobile ? '14px' : '20px'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h1
              className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight"
              style={{
                fontSize: isMobile ? '22px' : isTablet ? '26px' : '30px',
                lineHeight: isMobile ? '28px' : isTablet ? '32px' : '36px',
                fontWeight: 800,
                color: '#0f172a',
                letterSpacing: '-0.025em',
                margin: 0
              }}
            >
              All Requests
            </h1>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: isMobile ? '100%' : 'auto' }}>
          {canCreate && (
            <button
              onClick={() => navigate('/ihlr/create-request')}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/20 transition transform active:scale-95 cursor-pointer"
              style={{
                width: isMobile ? '100%' : 'auto',
                height: '38px',
                padding: '0 16px',
                borderRadius: '10px',
                backgroundColor: '#2563eb',
                color: '#ffffff',
                fontSize: isMobile ? '13px' : '12px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                border: 'none',
                cursor: 'pointer',
                boxSizing: 'border-box'
              }}
            >
              <Plus className="w-4 h-4" style={{ width: '16px', height: '16px' }} />
              <span>Create IHLR Issue</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar (matching Dashboard filter styling) */}
      <div
        className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-2xs space-y-3.5"
        style={{
          backgroundColor: '#ffffff',
          borderRadius: isMobile ? '14px' : '16px',
          padding: isMobile ? '14px 16px' : '20px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
          display: 'flex',
          flexDirection: 'column',
          gap: isMobile ? '10px' : '14px',
          marginBottom: isMobile ? '14px' : '20px',
          boxSizing: 'border-box'
        }}
      >
        <div
          className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-2 border-b border-slate-100"
          style={{
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            alignItems: isMobile ? 'flex-start' : 'center',
            justifyContent: 'space-between',
            gap: isMobile ? '10px' : '12px',
            paddingBottom: '8px',
            borderBottom: '1px solid #f1f5f9'
          }}
        >
          <div className="flex items-center gap-2.5 flex-wrap" style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span className="text-xs font-black uppercase tracking-tight text-slate-800 flex items-center gap-1.5" style={{ fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <SlidersHorizontal className="w-3.5 h-3.5 text-blue-600" style={{ width: '14px', height: '14px', color: '#2563eb' }} />
              <span>Filter Analysis Reports</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '2px 10px', borderRadius: '9999px', fontSize: '10px', fontWeight: 800, backgroundColor: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}>
              <Calendar className="w-3 h-3 text-blue-600" style={{ width: '12px', height: '12px', color: '#2563eb' }} />
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
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '10px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
              title={showFilters ? 'Hide filter controls' : 'Show filter controls'}
            >
              <Filter className="w-3.5 h-3.5" style={{ width: '14px', height: '14px' }} />
              <span>{showFilters ? 'Hide Filters' : 'Filter'}</span>
              {hasActiveFilters && !showFilters && (
                <span className="w-2 h-2 rounded-full bg-blue-500 ring-2 ring-white" style={{ width: '8px', height: '8px', borderRadius: '9999px', backgroundColor: '#3b82f6' }} />
              )}
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${showFilters ? 'rotate-180' : ''}`} style={{ width: '14px', height: '14px' }} />
            </button>
          </div>

          {hasActiveFilters && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100/90 border border-rose-200/90 rounded-xl transition-all active:scale-95 cursor-pointer shadow-2xs"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  fontSize: '11px',
                  fontWeight: 700,
                  borderRadius: '10px',
                  cursor: 'pointer'
                }}
                title="Clear all active filters"
              >
                <RotateCcw className="w-3.5 h-3.5" style={{ width: '14px', height: '14px' }} />
                <span>Reset Filters</span>
              </button>
            </div>
          )}
        </div>

        {showFilters && (
          <div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 text-xs items-center animate-in fade-in slide-in-from-top-1 duration-200"
            style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : isTablet ? 'repeat(2, minmax(0, 1fr))' : 'repeat(12, minmax(0, 1fr))',
              gap: isMobile ? '10px' : '12px',
              alignItems: 'center'
            }}
          >
            {/* Search */}
            <div
              className="lg:col-span-3 relative"
              style={{
                gridColumn: isDesktop ? 'span 3 / span 3' : 'auto',
                position: 'relative',
                width: '100%'
              }}
            >
              <Search
                className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5 pointer-events-none"
                style={{ width: '16px', height: '16px', position: 'absolute', left: '12px', top: '11px', color: '#94a3b8', pointerEvents: 'none' }}
              />
              <input
                type="text"
                placeholder="Search problem, model, line, inspector, or Req#..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none font-medium"
                style={{
                  width: '100%',
                  height: '38px',
                  paddingLeft: '36px',
                  paddingRight: '12px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  fontSize: isMobile ? '13px' : '12px',
                  color: '#0f172a',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Department Filter (RESP) */}
            <div
              className="lg:col-span-2"
              style={{
                gridColumn: isDesktop ? 'span 2 / span 2' : 'auto',
                width: '100%'
              }}
            >
              <select
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-semibold focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none cursor-pointer"
                style={{
                  width: '100%',
                  height: '38px',
                  padding: '0 12px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  fontSize: isMobile ? '13px' : '12px',
                  fontWeight: 600,
                  color: '#1e293b',
                  outline: 'none',
                  cursor: 'pointer',
                  boxSizing: 'border-box'
                }}
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
            <div
              className="lg:col-span-2"
              style={{
                gridColumn: isDesktop ? 'span 2 / span 2' : 'auto',
                width: '100%'
              }}
            >
              <select
                value={selectedShift}
                onChange={(e) => setSelectedShift(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-semibold focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none cursor-pointer"
                style={{
                  width: '100%',
                  height: '38px',
                  padding: '0 12px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  fontSize: isMobile ? '13px' : '12px',
                  fontWeight: 600,
                  color: '#1e293b',
                  outline: 'none',
                  cursor: 'pointer',
                  boxSizing: 'border-box'
                }}
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
            <div
              className="lg:col-span-1"
              style={{
                gridColumn: isDesktop ? 'span 1 / span 1' : 'auto',
                width: '100%'
              }}
            >
              <select
                value={selected4M}
                onChange={(e) => setSelected4M(e.target.value)}
                className="w-full px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-semibold focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none cursor-pointer"
                style={{
                  width: '100%',
                  height: '38px',
                  padding: '0 8px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  fontSize: isMobile ? '13px' : '12px',
                  fontWeight: 600,
                  color: '#1e293b',
                  outline: 'none',
                  cursor: 'pointer',
                  boxSizing: 'border-box'
                }}
              >
                <option value="All">All 4M</option>
                <option value="MAN">MAN</option>
                <option value="MACHINE">MACHINE</option>
                <option value="METHOD">METHOD</option>
                <option value="MATERIAL">MATERIAL</option>
              </select>
            </div>

            {/* Status Filter */}
            <div
              className="lg:col-span-1"
              style={{
                gridColumn: isDesktop ? 'span 1 / span 1' : 'auto',
                width: '100%'
              }}
            >
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-semibold focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none cursor-pointer"
                style={{
                  width: '100%',
                  height: '38px',
                  padding: '0 8px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  fontSize: isMobile ? '13px' : '12px',
                  fontWeight: 600,
                  color: '#1e293b',
                  outline: 'none',
                  cursor: 'pointer',
                  boxSizing: 'border-box'
                }}
              >
                <option value="All">All Statuses</option>
                <option value="PENDING">Pending</option>
                <option value="AWAITING REVIEW">Awaiting Review</option>
                <option value="CLOSED">Closed</option>
              </select>
            </div>

            {/* Date Range Cluster (Timeline Range like Dashboard) */}
            <div
              className="lg:col-span-3"
              style={{
                gridColumn: isDesktop ? 'span 3 / span 3' : (isTablet ? 'span 2 / span 2' : 'auto'),
                width: '100%'
              }}
            >
              <div
                className="flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100/70 focus-within:bg-white border border-slate-200/90 focus-within:border-blue-500 rounded-xl p-1 shadow-2xs focus-within:ring-2 focus-within:ring-blue-500/20 transition-all"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  height: '38px',
                  padding: '0 8px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  boxSizing: 'border-box'
                }}
              >
                <Calendar className="w-3.5 h-3.5 text-indigo-600 ml-1 shrink-0" style={{ width: '14px', height: '14px', color: '#4f46e5', marginLeft: '4px', flexShrink: 0 }} />
                <div className="min-w-0 flex-1">
                  <DateInput
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    placeholder="From Date"
                    className="w-full px-1.5 py-1 text-xs font-semibold text-slate-800 bg-transparent border-0 focus:ring-0 outline-none placeholder:text-slate-400"
                    style={{ fontSize: '11px', height: '28px' }}
                  />
                </div>
                <span className="text-slate-400 text-xs font-bold px-0.5 select-none shrink-0" style={{ fontSize: '12px', color: '#94a3b8' }}>→</span>
                <div className="min-w-0 flex-1">
                  <DateInput
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    placeholder="To Date"
                    className="w-full px-1.5 py-1 text-xs font-semibold text-slate-800 bg-transparent border-0 focus:ring-0 outline-none placeholder:text-slate-400"
                    style={{ fontSize: '11px', height: '28px' }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* IHLR Analysis Report Master Table */}
      <div
        className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden"
        style={{
          backgroundColor: '#ffffff',
          borderRadius: isMobile ? '14px' : '16px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
          overflow: 'hidden',
          width: '100%'
        }}
      >
        <div
          className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between"
          style={{
            padding: isMobile ? '12px 14px' : '16px 20px',
            borderBottom: '1px solid #f1f5f9',
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            alignItems: isMobile ? 'flex-start' : 'center',
            justifyContent: 'space-between',
            gap: isMobile ? '10px' : '12px'
          }}
        >
          <div className="flex items-center gap-2 flex-wrap" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span className="text-xs font-extrabold uppercase tracking-widest text-slate-600 font-mono" style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#475569', fontFamily: 'monospace' }}>
              IHLR ANALYSIS AND ACTION REPORT
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 font-mono" style={{ padding: '2px 8px', borderRadius: '9999px', fontSize: '10px', fontWeight: 700, backgroundColor: '#eff6ff', color: '#1d4ed8', fontFamily: 'monospace' }}>
              {requests.length} Records
            </span>
            {carryoverCount > 0 && isDefaultRange && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-300 shadow-2xs" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '2px 10px', borderRadius: '9999px', fontSize: '10px', fontWeight: 700, backgroundColor: '#fffbeb', color: '#92400e', border: '1px solid #fcd34d' }}>
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" style={{ width: '6px', height: '6px', borderRadius: '9999px', backgroundColor: '#f59e0b' }} />
                <span>{carryoverCount} unclosed from prior year rolled over</span>
              </span>
            )}
          </div>
          <button
            onClick={handleOpenExportModal}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs hover:shadow transition transform active:scale-95 cursor-pointer"
            id="export-view-btn"
            style={{
              width: isMobile ? '100%' : 'auto',
              height: '38px',
              padding: '0 16px',
              borderRadius: '10px',
              backgroundColor: '#2563eb',
              color: '#ffffff',
              fontSize: isMobile ? '13px' : '12px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              border: 'none',
              cursor: 'pointer',
              flexShrink: 0,
              boxSizing: 'border-box'
            }}
          >
            <Download className="w-4 h-4" style={{ width: '16px', height: '16px' }} />
            <span>Export View</span>
          </button>
        </div>

        <div 
          className="overflow-x-auto"
          style={{
            width: '100%',
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch'
          }}
        >
          <table 
            className="w-full text-left border-collapse"
            style={{
              width: '100%',
              minWidth: isMobile ? '1000px' : isTablet ? '1100px' : '100%',
              borderCollapse: 'collapse',
              textAlign: 'left'
            }}
          >
            <thead>
              {/* Detailed Column Header Row - Wrapped cleanly across 2 lines */}
              <tr 
                className="bg-[#f8fafc] border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-600"
                style={{
                  backgroundColor: '#f8fafc',
                  borderBottom: '1px solid #e2e8f0',
                  fontSize: '10px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: '#475569'
                }}
              >
                <th 
                  className="py-2.5 px-1.5 text-center align-middle whitespace-nowrap"
                  style={{
                    padding: isMobile ? '8px 6px' : '10px 6px',
                    textAlign: 'center',
                    verticalAlign: 'middle',
                    whiteSpace: 'nowrap'
                  }}
                >
                  <span className="block">SL</span>
                  <span className="block text-slate-400 font-medium" style={{ color: '#94a3b8', fontWeight: 500 }}>NO</span>
                </th>
                <th 
                  className="py-2.5 px-2 text-left align-middle whitespace-nowrap"
                  style={{
                    padding: isMobile ? '8px 8px' : '10px 8px',
                    textAlign: 'left',
                    verticalAlign: 'middle',
                    whiteSpace: 'nowrap'
                  }}
                >
                  <span className="block">REQ</span>
                  <span className="block text-slate-400 font-medium" style={{ color: '#94a3b8', fontWeight: 500 }}>NO</span>
                </th>
                <th 
                  className="py-2.5 px-2 text-left align-middle whitespace-nowrap"
                  style={{
                    padding: isMobile ? '8px 8px' : '10px 8px',
                    textAlign: 'left',
                    verticalAlign: 'middle',
                    whiteSpace: 'nowrap'
                  }}
                >
                  <span className="block">INCIDENT</span>
                  <span className="block text-slate-400 font-medium" style={{ color: '#94a3b8', fontWeight: 500 }}>DATE</span>
                </th>
                <th 
                  className="py-2.5 px-2 text-center align-middle whitespace-nowrap"
                  style={{
                    padding: isMobile ? '8px 8px' : '10px 8px',
                    textAlign: 'center',
                    verticalAlign: 'middle',
                    whiteSpace: 'nowrap'
                  }}
                >
                  <span className="block">SHIFT</span>
                  <span className="invisible block">.</span>
                </th>
                <th 
                  className="py-2.5 px-2 text-left align-middle whitespace-nowrap"
                  style={{
                    padding: isMobile ? '8px 8px' : '10px 8px',
                    textAlign: 'left',
                    verticalAlign: 'middle',
                    whiteSpace: 'nowrap'
                  }}
                >
                  <span className="block">PROBLEM</span>
                  <span className="block text-slate-400 font-medium" style={{ color: '#94a3b8', fontWeight: 500 }}>DETECTED AT</span>
                </th>
                <th 
                  className="py-2.5 px-2 text-left align-middle whitespace-nowrap"
                  style={{
                    padding: isMobile ? '8px 8px' : '10px 8px',
                    textAlign: 'left',
                    verticalAlign: 'middle',
                    whiteSpace: 'nowrap'
                  }}
                >
                  <span className="block">RECEIVED FROM</span>
                  <span className="block text-slate-400 font-medium" style={{ color: '#94a3b8', fontWeight: 500 }}>(LINE/D3)</span>
                </th>
                <th 
                  className="py-2.5 px-2 text-left align-middle whitespace-nowrap"
                  style={{
                    padding: isMobile ? '8px 8px' : '10px 8px',
                    textAlign: 'left',
                    verticalAlign: 'middle',
                    whiteSpace: 'nowrap'
                  }}
                >
                  <span className="block">ANALYSIS</span>
                  <span className="block text-slate-400 font-medium" style={{ color: '#94a3b8', fontWeight: 500 }}>DONE BY</span>
                </th>
                <th 
                  className="py-2.5 px-1.5 text-center align-middle whitespace-nowrap"
                  style={{
                    padding: isMobile ? '8px 6px' : '10px 6px',
                    textAlign: 'center',
                    verticalAlign: 'middle',
                    whiteSpace: 'nowrap'
                  }}
                >
                  <span className="block">DEFECT</span>
                  <span className="block text-slate-400 font-medium" style={{ color: '#94a3b8', fontWeight: 500 }}>EVIDENCE</span>
                </th>
                <th 
                  className="py-2.5 px-2 text-left min-w-[110px]"
                  style={{
                    padding: isMobile ? '8px 8px' : '10px 8px',
                    textAlign: 'left',
                    verticalAlign: 'middle',
                    minWidth: '110px'
                  }}
                >
                  <span className="block">TEMPORARY</span>
                  <span className="block text-slate-400 font-medium" style={{ color: '#94a3b8', fontWeight: 500 }}>ACTION TAKEN</span>
                </th>
                <th 
                  className="py-2.5 px-1.5 text-center align-middle whitespace-nowrap"
                  style={{
                    padding: isMobile ? '8px 6px' : '10px 6px',
                    textAlign: 'center',
                    verticalAlign: 'middle',
                    whiteSpace: 'nowrap'
                  }}
                >
                  <span className="block">TARGET</span>
                  <span className="block text-slate-400 font-medium" style={{ color: '#94a3b8', fontWeight: 500 }}>DATE</span>
                </th>
                <th 
                  className="py-2.5 px-2 text-left min-w-[90px]"
                  style={{
                    padding: isMobile ? '8px 8px' : '10px 8px',
                    textAlign: 'left',
                    verticalAlign: 'middle',
                    minWidth: '90px'
                  }}
                >
                  <span className="block">ADMIN</span>
                  <span className="block text-slate-400 font-medium" style={{ color: '#94a3b8', fontWeight: 500 }}>REMARKS</span>
                </th>
                <th 
                  className="py-2.5 px-2 text-center align-middle whitespace-nowrap"
                  style={{
                    padding: isMobile ? '8px 8px' : '10px 8px',
                    textAlign: 'center',
                    verticalAlign: 'middle',
                    whiteSpace: 'nowrap'
                  }}
                >
                  <span className="block">STATUS</span>
                  <span className="invisible block">.</span>
                </th>
                <th 
                  className="py-2.5 px-2 text-right align-middle whitespace-nowrap"
                  style={{
                    padding: isMobile ? '8px 8px' : '10px 8px',
                    textAlign: 'right',
                    verticalAlign: 'middle',
                    whiteSpace: 'nowrap'
                  }}
                >
                  <span className="block"></span>
                  <span className="invisible block">.</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {paginatedRequests.length === 0 ? (
                <tr>
                  <td 
                    colSpan={13} 
                    className="py-12 text-center text-slate-400"
                    style={{
                      padding: isMobile ? '36px 16px' : '48px 20px',
                      textAlign: 'center',
                      color: '#94a3b8'
                    }}
                  >
                    <AlertCircle className="w-8 h-8 mx-auto mb-2 text-slate-300" style={{ width: '32px', height: '32px', margin: '0 auto 8px auto', color: '#cbd5e1' }} />
                    <p className="font-semibold text-slate-600" style={{ fontSize: '13px', fontWeight: 600, color: '#475569', margin: '0 0 4px 0' }}>
                      No IHLR Reports match your filter
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5" style={{ fontSize: '11px', color: '#94a3b8', margin: 0 }}>
                      Try resetting search parameters or check other filters.
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedRequests.map((r, index) => (
                  <tr 
                    key={r.id} 
                    className="hover:bg-slate-50/80 transition-colors align-middle"
                    style={{
                      borderBottom: '1px solid #f1f5f9',
                      verticalAlign: 'middle'
                    }}
                  >
                    {/* SL NO */}
                    <td 
                      className="py-2.5 px-1.5 text-center font-mono font-semibold text-slate-400 align-middle"
                      style={{
                        padding: isMobile ? '10px 6px' : '10px 6px',
                        textAlign: 'center',
                        fontFamily: 'monospace',
                        fontWeight: 600,
                        fontSize: '11px',
                        color: '#94a3b8',
                        verticalAlign: 'middle'
                      }}
                    >
                      {startIndex + index + 1}
                    </td>

                    {/* Req NO */}
                    <td 
                      className="py-2.5 px-2 font-mono font-bold text-blue-600 whitespace-nowrap align-middle"
                      style={{
                        padding: isMobile ? '10px 8px' : '10px 8px',
                        fontFamily: 'monospace',
                        fontWeight: 700,
                        fontSize: '12px',
                        color: '#2563eb',
                        whiteSpace: 'nowrap',
                        verticalAlign: 'middle'
                      }}
                    >
                      {String(r.req_no).startsWith('IHLR-') ? r.req_no : `#${r.req_no}`}
                    </td>

                    {/* Incident Date */}
                    <td 
                      className="py-2.5 px-2 whitespace-nowrap align-middle"
                      style={{
                        padding: isMobile ? '10px 8px' : '10px 8px',
                        whiteSpace: 'nowrap',
                        verticalAlign: 'middle'
                      }}
                    >
                      <div className="font-semibold text-slate-900 leading-tight" style={{ fontSize: '12px', fontWeight: 600, color: '#0f172a', lineHeight: '16px' }}>
                        {formatDateDDMMYYYY(r.batch_date)}
                      </div>
                      {Boolean(
                        r.batch_date &&
                        (String(r.batch_date).slice(0, 10) < defaultStartDate || new Date(r.batch_date).getFullYear() < currentYear) &&
                        (r.status || '').toUpperCase() !== 'CLOSED'
                      ) && (
                        <div className="mt-0.5" style={{ marginTop: '2px' }}>
                          <span 
                            className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-50 text-amber-800 border border-amber-300"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '1px 6px',
                              borderRadius: '4px',
                              fontSize: '9px',
                              fontWeight: 700,
                              backgroundColor: '#fffbeb',
                              color: '#92400e',
                              border: '1px solid #fcd34d'
                            }}
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" style={{ width: '6px', height: '6px', borderRadius: '9999px', backgroundColor: '#f59e0b' }} />
                            {new Date(r.batch_date).getFullYear()} Carryover
                          </span>
                        </div>
                      )}
                    </td>

                    {/* Shift */}
                    <td 
                      className="py-2.5 px-2 text-center whitespace-nowrap align-middle"
                      style={{
                        padding: isMobile ? '10px 8px' : '10px 8px',
                        textAlign: 'center',
                        whiteSpace: 'nowrap',
                        verticalAlign: 'middle'
                      }}
                    >
                      <span 
                        className="text-[10px] font-bold text-slate-700 font-mono" 
                        style={{ fontSize: '10px', fontWeight: 700, color: '#334155', fontFamily: 'monospace' }}
                        title={getIhlrShiftDetails(r.shift)?.timeDisplay || ''}
                      >
                        {formatIhlrShiftDisplay(r.shift)}
                      </span>
                    </td>

                    {/* Problem Detected At */}
                    <td 
                      className="py-2.5 px-2 text-slate-700 whitespace-nowrap text-xs align-middle" 
                      style={{
                        padding: isMobile ? '10px 8px' : '10px 8px',
                        color: '#334155',
                        whiteSpace: 'nowrap',
                        fontSize: '12px',
                        verticalAlign: 'middle'
                      }}
                      title={r.problem_detected_at}
                    >
                      <div className="truncate max-w-[85px]" style={{ maxWidth: '85px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.problem_detected_at}</div>
                    </td>

                    {/* Received From (Line/D3) */}
                    <td 
                      className="py-2.5 px-2 font-mono text-slate-600 whitespace-nowrap text-xs align-middle" 
                      style={{
                        padding: isMobile ? '10px 8px' : '10px 8px',
                        fontFamily: 'monospace',
                        color: '#475569',
                        whiteSpace: 'nowrap',
                        fontSize: '12px',
                        verticalAlign: 'middle'
                      }}
                      title={r.received_from}
                    >
                      <div className="truncate max-w-[85px]" style={{ maxWidth: '85px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.received_from}</div>
                    </td>

                    {/* Analysis Done By */}
                    <td 
                      className="py-2.5 px-2 font-medium text-slate-800 text-xs align-middle"
                      style={{
                        padding: isMobile ? '10px 8px' : '10px 8px',
                        fontWeight: 500,
                        color: '#1e293b',
                        fontSize: '12px',
                        verticalAlign: 'middle'
                      }}
                    >
                      <div className="truncate max-w-[95px]" style={{ maxWidth: '95px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.analysis_done_by}>{r.analysis_done_by}</div>
                    </td>

                    {/* Defect Attachment Thumbnail */}
                    <td 
                      className="py-2.5 px-1.5 text-center align-middle"
                      style={{
                        padding: isMobile ? '10px 6px' : '10px 6px',
                        textAlign: 'center',
                        verticalAlign: 'middle'
                      }}
                    >
                      <div className="flex items-center justify-center" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <IhlrAttachmentThumbnail
                          rawAttachment={r.defect_image}
                        />
                      </div>
                    </td>


                    {/* Action Taken */}
                    <td 
                      className="py-2.5 px-2 text-slate-800 font-medium text-xs leading-snug align-middle" 
                      style={{
                        padding: isMobile ? '10px 8px' : '10px 8px',
                        color: '#1e293b',
                        fontWeight: 500,
                        fontSize: '12px',
                        lineHeight: '16px',
                        verticalAlign: 'middle'
                      }}
                      title={r.temporary_action || r.permanent_fix || r.action || ''}
                    >
                      <div className="line-clamp-2 max-w-[140px]" style={{ maxWidth: '140px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                        {r.temporary_action || r.permanent_fix || r.action || '—'}
                      </div>
                    </td>

                    {/* Target Date */}
                    <td 
                      className="py-2.5 px-1.5 text-center text-slate-600 font-mono text-[10px] whitespace-nowrap align-middle"
                      style={{
                        padding: isMobile ? '10px 6px' : '10px 6px',
                        textAlign: 'center',
                        color: '#475569',
                        fontFamily: 'monospace',
                        fontSize: '10px',
                        whiteSpace: 'nowrap',
                        verticalAlign: 'middle'
                      }}
                    >
                      {(r.temporary_target_date || r.permanent_target_date)
                        ? formatDateDDMMYYYY(r.temporary_target_date || r.permanent_target_date)
                        : '—'}
                    </td>

                    {/* Admin Remarks */}
                    <td 
                      className="py-2.5 px-2 text-slate-600 text-xs leading-snug align-middle" 
                      style={{
                        padding: isMobile ? '10px 8px' : '10px 8px',
                        color: '#475569',
                        fontSize: '12px',
                        lineHeight: '16px',
                        verticalAlign: 'middle'
                      }}
                      title={r.remarks || ''}
                    >
                      <div className="line-clamp-2 max-w-[120px]" style={{ maxWidth: '120px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                        {r.remarks || '—'}
                      </div>
                    </td>

                    {/* Status */}
                    <td 
                      className="py-2.5 px-2 text-center whitespace-nowrap align-middle"
                      style={{
                        padding: isMobile ? '10px 8px' : '10px 8px',
                        textAlign: 'center',
                        whiteSpace: 'nowrap',
                        verticalAlign: 'middle'
                      }}
                    >
                      <div className="flex items-center justify-center" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {getStatusBadge(r.status, r)}
                      </div>
                    </td>

                    {/* Actions */}
                    <td 
                      className="py-2.5 px-2 text-right whitespace-nowrap align-middle"
                      style={{
                        padding: isMobile ? '10px 8px' : '10px 8px',
                        textAlign: 'right',
                        whiteSpace: 'nowrap',
                        verticalAlign: 'middle'
                      }}
                    >
                      <div className="flex items-center justify-end gap-1" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                        <button
                          onClick={() => {
                            setActiveModalRequest(r);
                            setModalInitialEdit(false);
                          }}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                          style={{
                            width: '30px',
                            height: '30px',
                            padding: '0',
                            borderRadius: '8px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: 'none',
                            backgroundColor: 'transparent',
                            color: '#2563eb',
                            cursor: 'pointer'
                          }}
                          title="View Complete Report"
                        >
                          <Eye className="w-3.5 h-3.5" style={{ width: '15px', height: '15px' }} />
                        </button>
                        {isAdmin && (() => {
                          const isRowClosed = (r.status || '').toUpperCase() === 'CLOSED' || (r.status || '').toUpperCase() === 'APPROVED';
                          return (
                            <button
                              disabled={isRowClosed}
                              onClick={() => {
                                if (isRowClosed) return;
                                setActiveModalRequest(r);
                                setModalInitialEdit(true);
                              }}
                              className={`p-1.5 rounded-lg transition ${
                                isRowClosed
                                  ? 'text-slate-300 hover:bg-transparent cursor-not-allowed select-none opacity-50'
                                  : 'text-amber-600 hover:bg-amber-50 cursor-pointer'
                              }`}
                              style={{
                                width: '30px',
                                height: '30px',
                                padding: '0',
                                borderRadius: '8px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                border: 'none',
                                backgroundColor: 'transparent',
                                color: isRowClosed ? '#cbd5e1' : '#d97706',
                                cursor: isRowClosed ? 'not-allowed' : 'pointer',
                                opacity: isRowClosed ? 0.5 : 1
                              }}
                              title={isRowClosed ? "Issue is closed. Editing is disabled." : "Edit Request (Admin Only)"}
                            >
                              <Pencil className="w-3.5 h-3.5" style={{ width: '15px', height: '15px' }} />
                            </button>
                          );
                        })()}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div 
          className="p-3.5 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-end gap-4 text-xs text-slate-600"
          style={{
            padding: isMobile ? '12px 14px' : '14px 20px',
            borderTop: '1px solid #f1f5f9',
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            alignItems: isMobile ? 'stretch' : 'center',
            justifyContent: isMobile ? 'center' : 'flex-end',
            gap: isMobile ? '10px' : '16px',
            fontSize: '12px',
            color: '#475569',
            boxSizing: 'border-box'
          }}
        >
          <div 
            className="flex items-center gap-2"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: isMobile ? 'space-between' : 'flex-start',
              gap: '8px'
            }}
          >
            <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>Rows per page:</span>
            <select
              value={rowsPerPage}
              onChange={(e) => {
                setRowsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold outline-none cursor-pointer"
              style={{
                height: '28px',
                padding: '0 8px',
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 600,
                color: '#1e293b',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
            </select>
          </div>

          <div 
            className="font-mono text-[11px] text-slate-500"
            style={{
              fontFamily: 'monospace',
              fontSize: '11px',
              color: '#64748b',
              textAlign: isMobile ? 'center' : 'left'
            }}
          >
            {totalRecords === 0
              ? '0–0 of 0'
              : `${startIndex + 1}–${endIndex} of ${totalRecords}`}
          </div>

          <div 
            className="flex items-center gap-1"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: isMobile ? 'center' : 'flex-end',
              gap: '6px'
            }}
          >
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
              style={{
                width: '28px',
                height: '28px',
                padding: 0,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: 'transparent',
                color: currentPage <= 1 ? '#cbd5e1' : '#475569',
                cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
                opacity: currentPage <= 1 ? 0.35 : 1
              }}
              title="Previous Page"
            >
              <ChevronLeft className="w-4 h-4" style={{ width: '16px', height: '16px' }} />
            </button>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
              style={{
                width: '28px',
                height: '28px',
                padding: 0,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: 'transparent',
                color: currentPage >= totalPages ? '#cbd5e1' : '#475569',
                cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
                opacity: currentPage >= totalPages ? 0.35 : 1
              }}
              title="Next Page"
            >
              <ChevronRight className="w-4 h-4" style={{ width: '16px', height: '16px' }} />
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
        onUpdated={(updatedReq) => {
          if (updatedReq && activeModalRequest) {
            setActiveModalRequest(updatedReq);
          }
          fetchRequests();
          setModalInitialEdit(false);
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
          style={{
            zIndex: 99990,
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: isMobile ? '12px' : '16px'
          }}
          onClick={() => setEditingCloser(null)}
        >
          <div 
            className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-slate-200 p-6 space-y-4 animate-in zoom-in-95 duration-200"
            style={{
              backgroundColor: '#ffffff',
              borderRadius: isMobile ? '16px' : '24px',
              width: '100%',
              maxWidth: isMobile ? '100%' : '512px',
              padding: isMobile ? '16px' : '24px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              display: 'flex',
              flexDirection: 'column',
              gap: isMobile ? '12px' : '16px',
              boxSizing: 'border-box'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div 
              className="flex items-center justify-between pb-3 border-b border-slate-100"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingBottom: '12px',
                borderBottom: '1px solid #f1f5f9'
              }}
            >
              <h3 
                className="text-base font-bold text-slate-900"
                style={{
                  fontSize: isMobile ? '15px' : '16px',
                  fontWeight: 700,
                  color: '#0f172a',
                  margin: 0
                }}
              >
                Update Report {String(editingCloser.req_no).startsWith('IHLR-') ? editingCloser.req_no : `#${editingCloser.req_no}`}
              </h3>
              <button
                onClick={() => setEditingCloser(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                style={{
                  width: '32px',
                  height: '32px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: 'transparent',
                  color: '#94a3b8',
                  cursor: 'pointer'
                }}
              >
                <X className="w-4 h-4" style={{ width: '16px', height: '16px' }} />
              </button>
            </div>

            <div 
              className="space-y-3 text-xs"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                fontSize: '12px'
              }}
            >
              <div>
                <label 
                  className="block font-bold text-slate-700 uppercase tracking-wider mb-1 text-[11px]"
                  style={{
                    display: 'block',
                    fontSize: '11px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: '#334155',
                    marginBottom: '4px'
                  }}
                >
                  Status
                </label>
                <select
                  disabled={!isAdmin && editingCloser.status === 'CLOSED'}
                  defaultValue={getIhlrDisplayStatus(editingCloser.status, editingCloser)}
                  id="modal-status-select"
                  className={`w-full px-3 py-2 border rounded-xl font-bold text-slate-900 outline-none ${!isAdmin && editingCloser.status === 'CLOSED'
                      ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed select-none'
                      : 'bg-slate-50 border-slate-200'
                    }`}
                  style={{
                    width: '100%',
                    height: '38px',
                    padding: '0 12px',
                    borderRadius: '10px',
                    border: '1px solid #e2e8f0',
                    backgroundColor: (!isAdmin && editingCloser.status === 'CLOSED') ? '#f1f5f9' : '#f8fafc',
                    color: (!isAdmin && editingCloser.status === 'CLOSED') ? '#94a3b8' : '#0f172a',
                    fontSize: '12px',
                    fontWeight: 700,
                    outline: 'none',
                    cursor: (!isAdmin && editingCloser.status === 'CLOSED') ? 'not-allowed' : 'pointer',
                    boxSizing: 'border-box'
                  }}
                >
                  {isAdmin ? (
                    <>
                      <option value="PENDING">PENDING</option>
                      <option value="AWAITING REVIEW">AWAITING REVIEW</option>
                      <option value="CLOSED">CLOSED</option>
                    </>
                  ) : editingCloser.status === 'CLOSED' ? (
                    <option value="CLOSED">CLOSED (FINALIZED)</option>
                  ) : (
                    <>
                      <option value="AWAITING REVIEW">AWAITING REVIEW</option>
                      <option value="CLOSED">CLOSED</option>
                    </>
                  )}
                </select>
                {!isAdmin && editingCloser.status === 'CLOSED' && (
                  <p 
                    className="text-[10px] text-emerald-600 font-semibold mt-1"
                    style={{ fontSize: '10px', color: '#059669', fontWeight: 600, marginTop: '4px', margin: 0 }}
                  >
                    This incident is closed. Only Admin can update status again.
                  </p>
                )}
              </div>

              <div>
                <label 
                  className="block font-bold text-slate-700 uppercase tracking-wider mb-1 text-[11px]"
                  style={{
                    display: 'block',
                    fontSize: '11px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: '#334155',
                    marginBottom: '4px'
                  }}
                >
                  Action Countermeasure
                </label>
                <textarea
                  rows={3}
                  disabled={!isAdmin && editingCloser.status === 'CLOSED'}
                  defaultValue={(editingCloser.temporary_action || editingCloser.permanent_fix || '').trim()}
                  id="modal-action-text"
                  onKeyDown={(e) => {
                    if (e.key === ' ' && (!e.target.value || e.target.selectionStart === 0)) {
                      e.preventDefault();
                    }
                  }}
                  onChange={(e) => {
                    e.target.value = e.target.value.replace(/^\s+/, '');
                  }}
                  onBlur={(e) => {
                    e.target.value = e.target.value.trim();
                  }}
                  placeholder="Describe corrective actions performed..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 outline-none disabled:bg-slate-100 disabled:text-slate-400"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '10px',
                    border: '1px solid #e2e8f0',
                    backgroundColor: (!isAdmin && editingCloser.status === 'CLOSED') ? '#f1f5f9' : '#f8fafc',
                    color: (!isAdmin && editingCloser.status === 'CLOSED') ? '#94a3b8' : '#0f172a',
                    fontSize: '12px',
                    outline: 'none',
                    boxSizing: 'border-box',
                    resize: 'vertical',
                    minHeight: '76px'
                  }}
                />
              </div>
            </div>

            <div 
              className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: '8px',
                paddingTop: '12px',
                borderTop: '1px solid #f1f5f9'
              }}
            >
              <button
                type="button"
                onClick={() => setEditingCloser(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                style={{
                  height: '36px',
                  padding: '0 16px',
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0',
                  backgroundColor: '#ffffff',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#334155',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              {!isAdmin && editingCloser.status === 'CLOSED' ? (
                <span 
                  className="text-xs text-slate-400 italic py-2"
                  style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic', padding: '8px 0' }}
                >
                  Updates locked for closed records (Admin only)
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    const s = document.getElementById('modal-status-select').value;
                    const a = (document.getElementById('modal-action-text')?.value || '').trim();
                    handleUpdateStatus(editingCloser.id, s, a);
                  }}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-sm cursor-pointer"
                  style={{
                    height: '36px',
                    padding: '0 16px',
                    borderRadius: '10px',
                    border: 'none',
                    backgroundColor: '#2563eb',
                    fontSize: '12px',
                    fontWeight: 700,
                    color: '#ffffff',
                    cursor: 'pointer'
                  }}
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
