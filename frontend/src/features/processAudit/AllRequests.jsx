import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import {
  Download,
  Search,
  Eye,
  X,
  Plus,
  Pencil,
  AlertCircle,
  RotateCcw,
  ChevronDown,
  ArrowRightLeft,
  Filter,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  Clock,
  Calendar,
  Building2,
  RefreshCw,
  ShieldAlert
} from 'lucide-react';
import { processAuditService } from '../../services/processAuditService';
import { useAuth } from '../../hooks/useAuth';
import AttachmentThumbnail from '../../components/common/AttachmentThumbnail';
import AttachmentPreviewModal from '../../components/common/AttachmentPreviewModal';
import ExportSelectionModal from '../../components/common/ExportSelectionModal';
import {
  exportProcessAuditToExcel,
  exportProcessAuditToPdf,
  getProcessAuditDisplayStatus,
  formatReassignmentHistory
} from './processAuditExportUtils';
import DateInput from '../../components/common/DateInput';
import { formatDateDDMMYYYY, parseDateToYYYYMMDD } from '../../utils/dateUtils';
import { storage } from '../../utils/storage';
import ProcessAuditRequestDetailsModal from './ProcessAuditRequestDetailsModal';

const AllRequests = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const savedUser = storage.getUser();
  const currentUser = user || savedUser;

  const currentDept = (currentUser?.department || (() => {
    try {
      const u = sessionStorage.getItem('todo_user') || localStorage.getItem('todo_user');
      return u ? JSON.parse(u)?.department : '';
    } catch {
      return '';
    }
  })() || '').trim();

  const userRole = (currentUser?.role || (() => {
    try {
      const u = sessionStorage.getItem('todo_user') || localStorage.getItem('todo_user');
      return u ? JSON.parse(u)?.role : '';
    } catch {
      return '';
    }
  })() || '').trim().toUpperCase();

  const isQad = currentDept.toUpperCase() === 'QAD';
  const isAdmin = userRole === 'ADMIN' || isQad;
  const isProduction = currentDept.toUpperCase() === 'PRODUCTION';
  const canCreate = isQad || isAdmin || isProduction;
  const canEdit = isAdmin;

  const [searchParams] = useSearchParams();
  const queryRequestId = searchParams.get('requestId') || searchParams.get('id');

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters State (defaulting to Current Year)
  const currentYear = new Date().getFullYear();
  const defaultStartDate = `${currentYear}-01-01`;
  const defaultEndDate = `${currentYear}-12-31`;

  const [search, setSearch] = useState(() => location.state?.search || '');

  useEffect(() => {
    if (location.state?.search) {
      setSearch(location.state.search);
    }
  }, [location.state]);
  const [selectedShift, setSelectedShift] = useState('All Shifts');
  const [selectedStage, setSelectedStage] = useState('All Stages');
  const [selectedDepartment, setSelectedDepartment] = useState('All Departments');
  const [selectedExecutor, setSelectedExecutor] = useState('All Executors');
  const [selectedStatus, setSelectedStatus] = useState('All Statuses');
  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState(defaultEndDate);
  const [showFilters, setShowFilters] = useState(Boolean(queryRequestId));

  const isDefaultRange = startDate === defaultStartDate && endDate === defaultEndDate;
  const hasActiveFilters =
    Boolean((search || '').trim()) ||
    selectedShift !== 'All Shifts' ||
    selectedStage !== 'All Stages' ||
    selectedDepartment !== 'All Departments' ||
    selectedExecutor !== 'All Executors' ||
    selectedStatus !== 'All Statuses' ||
    !isDefaultRange;

  const handleResetFilters = () => {
    setSearch('');
    setSelectedShift('All Shifts');
    setSelectedStage('All Stages');
    setSelectedDepartment('All Departments');
    setSelectedExecutor('All Executors');
    setSelectedStatus('All Statuses');
    setStartDate(defaultStartDate);
    setEndDate(defaultEndDate);
  };

  // Modals State
  const [activeModalRequest, setActiveModalRequest] = useState(null);
  const [modalInitialEdit, setModalInitialEdit] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState(null);
  const [showExportModal, setShowExportModal] = useState(false);

  // Pagination State (matching IHLR / Approvals tab with max 10)
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  // Reset page on filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search, selectedShift, selectedStage, selectedDepartment, selectedExecutor, selectedStatus, startDate, endDate]);

  // Reassignment State
  const [dbUsers, setDbUsers] = useState([]);
  const [deptUsers, setDeptUsers] = useState([]);
  const [loadingDeptUsers, setLoadingDeptUsers] = useState(false);
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [reassigningRequest, setReassigningRequest] = useState(null);
  const [reassignDept, setReassignDept] = useState('');
  const [reassignExecutor, setReassignExecutor] = useState('');
  const [reassignReason, setReassignReason] = useState('');
  const [reassignLoading, setReassignLoading] = useState(false);

  const departmentList = Array.from(
    new Set([
      'QAD',
      'PRODUCTION',
      'MAINTENANCE',
      'PED',
      'MATERIALS',
      'MARKETING',
      'INCOMING QUALITY',
      ...dbUsers.map((u) => (u.department || u.dept || '').trim()).filter(Boolean),
      ...requests.map((r) => (r.department || '').trim()).filter(Boolean),
    ])
  ).sort();

  const distinctStages = React.useMemo(() => {
    const set = new Set();
    requests.forEach((r) => {
      const s = r.model || r.stage;
      if (s && s !== '—') set.add(s.trim());
    });
    return Array.from(set).sort();
  }, [requests]);

  const distinctExecutors = React.useMemo(() => {
    const set = new Set();
    dbUsers.forEach((u) => {
      if (u.name) set.add(u.name);
    });
    requests.forEach((r) => {
      if (r.executor) {
        r.executor.split(',').forEach((e) => {
          const trimmed = e.trim();
          if (trimmed && trimmed !== '—') set.add(trimmed);
        });
      }
    });
    return Array.from(set).sort();
  }, [dbUsers, requests]);

  useEffect(() => {
    let isMounted = true;
    processAuditService.getUsers()
      .then((users) => {
        if (isMounted && Array.isArray(users)) setDbUsers(users);
      })
      .catch((err) => console.error('Failed to load users:', err));
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    if (!reassignDept) {
      setDeptUsers([]);
      return;
    }
    let isMounted = true;
    setLoadingDeptUsers(true);
    const isUserActive = (u) => {
      if (!u) return false;
      if (u.is_active === false || u.is_active === 0 || u.is_active === '0') return false;
      const s = String(u.status || 'ACTIVE').trim().toUpperCase();
      return s !== 'INACTIVE';
    };

    processAuditService.getUsers(reassignDept)
      .then((users) => {
        if (!isMounted) return;
        if (Array.isArray(users) && users.length > 0) {
          setDeptUsers(users.filter(isUserActive));
        } else {
          const matched = dbUsers.filter(
            (u) => (u.department || u.dept || '').trim().toLowerCase() === reassignDept.trim().toLowerCase() && isUserActive(u)
          );
          setDeptUsers(matched);
        }
      })
      .catch((err) => {
        console.error('Failed to fetch executors for department:', err);
        if (isMounted) {
          const matched = dbUsers.filter(
            (u) => (u.department || u.dept || '').trim().toLowerCase() === reassignDept.trim().toLowerCase() && isUserActive(u)
          );
          setDeptUsers(matched);
        }
      })
      .finally(() => {
        if (isMounted) setLoadingDeptUsers(false);
      });

    return () => { isMounted = false; };
  }, [reassignDept, dbUsers]);

  const parseReassignmentHistory = (hist) => {
    if (!hist) return [];
    if (Array.isArray(hist)) return hist;
    if (typeof hist === 'string') {
      try {
        const parsed = JSON.parse(hist);
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        return [];
      }
    }
    return [];
  };

  const handleOpenReassignModal = (reqItem) => {
    const target = reqItem || activeModalRequest;
    if (!target) return;
    if (String(target.status || '').toUpperCase().includes('CLOSE')) {
      alert('This request is closed and cannot be modified.');
      return;
    }
    setReassigningRequest(target);
    const targetDept = target.department || 'PRODUCTION';
    setReassignDept(targetDept);
    setReassignExecutor(target.executor || '');
    setReassignReason('');
    setShowReassignModal(true);
  };

  const handleConfirmReassign = async () => {
    if (!reassigningRequest) return;
    if (!reassignDept || !reassignExecutor) {
      alert('Please choose a department and an executor to reassign to.');
      return;
    }
    if (!reassignReason.trim()) {
      alert('Please enter a reason for reassigning this request.');
      return;
    }

    setReassignLoading(true);
    try {
      const payload = {
        new_department: reassignDept.trim(),
        new_executor: reassignExecutor.trim(),
        reason: reassignReason.trim(),
        reassigned_by: currentUser?.name || currentUser?.email || 'Quality Admin',
        reassigned_by_id: currentUser?.id || null,
        role: currentUser?.role,
        user_department: currentDept
      };

      const updated = await processAuditService.reassignRequest(reassigningRequest.id, payload);

      const merged = {
        ...reassigningRequest,
        ...updated,
        department: reassignDept.trim(),
        executor: reassignExecutor.trim(),
        status: 'Pending',
        reassignment_history: updated.reassignment_history || [
          ...parseReassignmentHistory(reassigningRequest.reassignment_history),
          {
            id: parseReassignmentHistory(reassigningRequest.reassignment_history).length + 1,
            reassigned_at: new Date().toISOString(),
            reassigned_by: currentUser?.name || currentUser?.email || 'Quality Admin',
            reassigned_by_id: currentUser?.id || null,
            previous_department: reassigningRequest.department,
            previous_executor: reassigningRequest.executor,
            new_department: reassignDept.trim(),
            new_executor: reassignExecutor.trim(),
            reason: reassignReason.trim()
          }
        ]
      };

      setRequests((prev) =>
        prev.map((r) => (r.id === reassigningRequest.id || r.issue_no === reassigningRequest.issue_no ? merged : r))
      );

      if (activeModalRequest && (activeModalRequest.id === reassigningRequest.id || activeModalRequest.issue_no === reassigningRequest.issue_no)) {
        setActiveModalRequest(merged);
      }

      alert(`Request ${merged.issue_no || reassigningRequest.id} has been reassigned to ${reassignExecutor} (${reassignDept}).`);
      setShowReassignModal(false);
      setReassigningRequest(null);
    } catch (err) {
      console.error('Failed to reassign request:', err);
      alert('Could not reassign the request. Please try again.');
    } finally {
      setReassignLoading(false);
    }
  };

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const data = await processAuditService.getRequests({ all: true });
      setRequests(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load requests from DB:', err);
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

    window.addEventListener('processAuditLiveUpdate', handleLiveUpdate);

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      window.removeEventListener('processAuditLiveUpdate', handleLiveUpdate);
    };
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

  const canUserAccessRequest = (req, user, isAdmin) => {
    if (isAdmin) return true;
    if (!user) return false;

    const uName = (user.name || '').trim().toLowerCase();
    const uEmail = (user.email || '').trim().toLowerCase();
    const uId = user.id ? String(user.id) : null;

    if (req.created_by && req.created_by.trim().toLowerCase() === uName) return true;
    if (req.created_by_email && req.created_by_email.trim().toLowerCase() === uEmail) return true;
    if (uId && req.created_by_id && String(req.created_by_id) === uId) return true;

    if (req.executor) {
      const tokens = req.executor.split(',').map((s) => s.trim().toLowerCase());
      if (uEmail && tokens.includes(uEmail)) return true;
      if (uName && tokens.includes(uName)) return true;
    }

    return false;
  };

  // Filter requests (Plant-wide common for all departments)
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
    const q = search.trim().toLowerCase();

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

    const matchesDepartment =
      selectedDepartment === 'All Departments' ||
      String(req.department || '').toLowerCase() === selectedDepartment.toLowerCase();

    const matchesExecutor =
      selectedExecutor === 'All Executors' ||
      String(req.executor || '').toLowerCase().includes(selectedExecutor.toLowerCase());

    const displayStatus = getProcessAuditDisplayStatus(req);
    const matchesStatus =
      selectedStatus === 'All Statuses' ||
      selectedStatus === displayStatus ||
      ((selectedStatus === 'Awaiting Review' || selectedStatus === 'Approval Pending' || selectedStatus === 'In Progress') &&
        (displayStatus === 'Awaiting Review' || displayStatus === 'Approval Pending' || displayStatus === 'In Progress')) ||
      (selectedStatus === 'Signed off' && (displayStatus === 'Signed off' || displayStatus === 'In Progress'));

    // Timeline Date Filter
    if (startDate || endDate) {
      const dateVal = req.escalation_date || req.created_at || req.createdAt;
      if (!dateVal) return false;
      const itemDateStr = parseDateToYYYYMMDD(dateVal);
      if (!itemDateStr) return false;
      if (startDate && itemDateStr < startDate) return false;
      if (endDate && itemDateStr > endDate) return false;
    }

    return matchesSearch && matchesShift && matchesStage && matchesDepartment && matchesExecutor && matchesStatus;
  });

  const totalRecords = filteredRequests.length;
  const totalPages = Math.ceil(totalRecords / rowsPerPage) || 1;
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = Math.min(startIndex + rowsPerPage, totalRecords);
  const paginatedRequests = filteredRequests.slice(startIndex, endIndex);

  // Open Export Modal with empty check
  const handleOpenExportModal = () => {
    if (!filteredRequests || filteredRequests.length === 0) {
      alert('No data available to export. Please adjust your filters or search criteria.');
      return;
    }
    setShowExportModal(true);
  };

  // Export to Excel (.xlsx) using common process audit export utility
  const handleExportExcel = async () => {
    try {
      if (!filteredRequests || filteredRequests.length === 0) return;
      const today = new Date().toISOString().slice(0, 10);
      await exportProcessAuditToExcel({
        requests: filteredRequests,
        fileName: `Process_Audit_Analysis_Report_${today}.xlsx`,
        sheetName: 'Process Audit Log'
      });
      setShowExportModal(false);
    } catch (err) {
      console.error('Failed to export to Excel:', err);
      alert('Failed to export to Excel: ' + err.message);
    }
  };

  // Export to PDF (.pdf) using common process audit export utility
  const handleExportPdf = async () => {
    try {
      if (!filteredRequests || filteredRequests.length === 0) return;
      const today = new Date().toISOString().slice(0, 10);
      await exportProcessAuditToPdf({
        requests: filteredRequests,
        fileName: `Process_Audit_Analysis_Report_${today}.pdf`,
        title: 'Process Audit Observation & Verification Log',
        filterText: `Shift: ${selectedShift} | Stage: ${selectedStage} | Dept: ${selectedDepartment} | Status: ${selectedStatus}`
      });
      setShowExportModal(false);
    } catch (err) {
      console.error('Failed to export to PDF:', err);
      alert('Failed to export to PDF: ' + err.message);
    }
  };

  // Status Badge matching IHLR / Approvals UI
  const getStatusBadge = (r) => {
    const disp = getProcessAuditDisplayStatus(r);
    if (disp === 'Closed') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          CLOSED
        </span>
      );
    }
    if (disp === 'Awaiting Review' || disp === 'Approval Pending' || disp === 'Signed off' || disp === 'In Progress') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200 whitespace-nowrap">
          <Clock className="w-3 h-3 text-amber-600" />
          AWAITING REVIEW
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200 whitespace-nowrap">
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
            <span className="text-blue-600 font-bold uppercase tracking-wider font-mono">PROCESS AUDIT REPOSITORY</span>
            <span>/</span>
            <span>Analysis Reports</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              All Requests
            </h1>
            {!canEdit && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                <Eye className="w-3.5 h-3.5 text-slate-500" />
                <span>View Only</span>
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Comprehensive spreadsheet view of shopfloor process audit observations, root causes, and containment actions.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {canCreate && (
            <button
              onClick={() => navigate('/process-audit/create-request')}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/20 transition transform active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create Process Issue</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar (matching IHLR & Dashboard layout) */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-2xs space-y-3.5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-xs font-black uppercase tracking-tight text-slate-800 flex items-center gap-1.5">
              <SlidersHorizontal className="w-3.5 h-3.5 text-blue-600" />
              <span>Filter Observations</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs">
              <Calendar className="w-3 h-3 text-blue-600" />
              <span>{isDefaultRange ? `Data on Current Year (${currentYear})` : hasActiveFilters ? 'Active Custom Filter' : 'All Data'}</span>
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
          <div className="space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
            {/* Search Input */}
            <div className="relative w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5 pointer-events-none" />
              <input
                type="text"
                placeholder="Search observation, model, operation, executor, auditor, or Req#..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none font-medium"
              />
            </div>

            {/* Filter Dropdowns Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs items-center">
              {/* Shift Filter */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Shift
                </label>
                <select
                  value={selectedShift}
                  onChange={(e) => setSelectedShift(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-semibold focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none cursor-pointer"
                >
                  <option value="All Shifts">All Shifts</option>
                  <option value="Morning">Morning</option>
                  <option value="Evening">Evening</option>
                  <option value="Night">Night</option>
                  <option value="General">General</option>
                </select>
              </div>

              {/* Stage / Model Filter */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Stage / Model
                </label>
                <select
                  value={selectedStage}
                  onChange={(e) => setSelectedStage(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-semibold focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none cursor-pointer"
                >
                  <option value="All Stages">All Stages</option>
                  {distinctStages.map((stg) => (
                    <option key={stg} value={stg}>{stg}</option>
                  ))}
                </select>
              </div>

              {/* Department Filter */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Department
                </label>
                <select
                  value={selectedDepartment}
                  onChange={(e) => setSelectedDepartment(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-semibold focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none cursor-pointer"
                >
                  <option value="All Departments">All Departments</option>
                  {departmentList.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              {/* Status Filter */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Status
                </label>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-semibold focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none cursor-pointer"
                >
                  <option value="All Statuses">All Statuses</option>
                  <option value="Pending">Pending</option>
                  <option value="Awaiting Review">Awaiting Review</option>
                  <option value="Closed">Closed</option>
                </select>
              </div>

              {/* Date Range Cluster */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Timeline Range
                </label>
                <div className="flex items-center gap-1 bg-slate-50 hover:bg-slate-100/70 focus-within:bg-white border border-slate-200/90 focus-within:border-blue-500 rounded-xl p-1 shadow-2xs focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
                  <Calendar className="w-3.5 h-3.5 text-indigo-600 ml-1 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <DateInput
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      placeholder="From"
                      className="w-full px-1 py-0.5 text-xs font-semibold text-slate-800 bg-transparent border-0 focus:ring-0 outline-none placeholder:text-slate-400"
                    />
                  </div>
                  <span className="text-slate-400 text-xs font-bold px-0.5 select-none shrink-0">→</span>
                  <div className="min-w-0 flex-1">
                    <DateInput
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      placeholder="To"
                      className="w-full px-1 py-0.5 text-xs font-semibold text-slate-800 bg-transparent border-0 focus:ring-0 outline-none placeholder:text-slate-400"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Process Audit Analysis Report Master Table (matching IHLR Analysis Report UI) */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
        {/* Card Header matching IHLR */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-extrabold uppercase tracking-widest text-slate-600 font-mono">
              PROCESS AUDIT ANALYSIS REPORT
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 font-mono">
              {filteredRequests.length} Records
            </span>
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

        {/* Master Table with Grouped Phase Headers */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1250px]">
            <thead>
              {/* Top Phase Header Row (Matching IHLR Analysis Report) */}
              <tr className="text-[10px] font-black uppercase tracking-wider text-center border-b border-slate-200">
                <th colSpan={10} className="py-2.5 px-4 bg-amber-100 text-amber-900 border-r border-amber-200">
                  REQUESTOR (Audit Observation &amp; Defect Details)
                </th>
                <th colSpan={4} className="py-2.5 px-4 bg-orange-100 text-orange-900 border-r border-orange-200">
                  CLOSER (Containment &amp; Corrective Action)
                </th>
                <th colSpan={3} className="py-2.5 px-4 bg-slate-100 text-slate-700">
                  REMARKS &amp; STATUS
                </th>
              </tr>

              {/* Detailed Column Header Row */}
              <tr className="bg-[#f8fafc] border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                {/* Requestor Columns (10) */}
                <th className="py-3 px-3 text-center w-12">SL NO</th>
                <th className="py-3 px-3 whitespace-nowrap">ISSUE NO</th>
                <th className="py-3 px-3 whitespace-nowrap">DATE / SHIFT</th>
                <th className="py-3 px-4 min-w-[150px]">OBSERVATION</th>
                <th className="py-3 px-3 whitespace-nowrap">PRODUCT</th>
                <th className="py-3 px-3 whitespace-nowrap"> MODEL</th>
                <th className="py-3 px-3 whitespace-nowrap">Process / Operation</th>
                <th className="py-3 px-3 whitespace-nowrap">Created BY</th>
                <th className="py-3 px-2 text-center w-12">DEFECT</th>
                <th className="py-3 px-3 whitespace-nowrap text-center">RESP / EXECUTOR</th>

                {/* Closer Columns (4) */}
                <th className="py-3 px-4 min-w-[140px]">ROOT CAUSE</th>
                <th className="py-3 px-4 min-w-[150px]">ACTION TAKEN</th>
                <th className="py-3 px-4 min-w-[140px]">STANDARDIZATION</th>
                <th className="py-3 px-3 whitespace-nowrap">TARGET DATE</th>

                {/* Remarks & Status Columns (3) */}
                <th className="py-3 px-4 min-w-[130px]">REMARKS</th>
                <th className="py-3 px-3 whitespace-nowrap text-center">STATUS</th>
                <th className="py-3 px-3 text-right whitespace-nowrap">ACTIONS</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={17} className="py-16 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                    Loading process audit analysis reports from database...
                  </td>
                </tr>
              ) : paginatedRequests.length === 0 ? (
                <tr>
                  <td colSpan={17} className="py-12 text-center text-slate-400">
                    <AlertCircle className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="font-semibold text-slate-600">
                      No Process Audit Reports match your filter
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Try resetting search parameters or check other filters.
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedRequests.map((r, index) => {
                  const reqId = r.issue_no || (r.id ? `PA-${r.id}` : '#1');
                  const dateStr = formatDateDDMMYYYY(r.escalation_date || r.created_at);
                  const prodStr = r.product || '—';
                  const stageStr = r.model || r.stage || '—';
                  const lineStr = r.process_operation || r.line || '—';
                  const auditorStr = r.created_by || r.creator || '—';
                  const deptStr = r.department || '—';
                  const executorStr = r.executor || 'Assigned Lead';
                  const rootCauseStr = (() => {
                    if (r.prod_why_why) {
                      if (Array.isArray(r.prod_why_why)) {
                        const first = r.prod_why_why.find((w) => w && String(w).trim());
                        if (first) return first;
                      } else if (typeof r.prod_why_why === 'string') {
                        try {
                          const parsed = JSON.parse(r.prod_why_why);
                          if (Array.isArray(parsed)) {
                            const first = parsed.find((w) => w && String(w).trim());
                            if (first) return first;
                          }
                        } catch {}
                      }
                    }
                    return r.root_cause || '—';
                  })();

                  const actionStr = (() => {
                    if (r.temporary_action && r.permanent_fix) {
                      return `Temp: ${r.temporary_action} | Perm: ${r.permanent_fix}`;
                    }
                    return r.temporary_action || r.permanent_fix || r.corrective_action || r.action || '—';
                  })();

                  const standardStr = r.standardization_details || '—';
                  const targetDateStr = (r.temporary_target_date || r.permanent_target_date || r.target_date)
                    ? formatDateDDMMYYYY(r.temporary_target_date || r.permanent_target_date || r.target_date)
                    : '—';
                  const remarksStr = r.creator_remark || r.remarks || '—';

                  return (
                    <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* SL NO */}
                      <td className="py-3.5 px-3 text-center font-mono font-semibold text-slate-400">
                        {startIndex + index + 1}
                      </td>

                      {/* Req NO */}
                      <td className="py-3.5 px-3 font-mono font-bold text-blue-600 whitespace-nowrap">
                        <div>{reqId}</div>
                        {(() => {
                          const { hasReassignments, count } = formatReassignmentHistory(r.reassignment_history);
                          if (!hasReassignments) return null;
                          return (
                            <div className="mt-0.5">
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                                <ArrowRightLeft className="w-2.5 h-2.5 text-purple-600" />
                                <span>Reassigned ({count})</span>
                              </span>
                            </div>
                          );
                        })()}
                      </td>

                      {/* Date / Shift */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <div className="font-semibold text-slate-900">
                          {dateStr}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] font-bold text-slate-600 font-mono">
                            {r.shift || 'General'}
                          </span>
                        </div>
                      </td>

                      {/* Observation */}
                      <td className="py-3.5 px-4 font-semibold text-slate-900 max-w-[200px]" title={r.issue_observation || r.problem}>
                        <div className="truncate">
                          {r.issue_observation || r.problem || '—'}
                        </div>
                      </td>

                      {/* Product */}
                      <td className="py-3.5 px-3 font-medium text-slate-800 whitespace-nowrap">
                        {prodStr}
                      </td>

                      {/* Stage / Model */}
                      <td className="py-3.5 px-3 font-bold text-blue-700 whitespace-nowrap">
                        {stageStr}
                      </td>

                      {/* Line / Operation */}
                      <td className="py-3.5 px-3 font-medium text-slate-700 whitespace-nowrap">
                        {lineStr}
                      </td>

                      {/* Audited By (Creator) */}
                      <td className="py-3.5 px-3 font-medium text-slate-800 whitespace-nowrap">
                        <div>{auditorStr}</div>
                      </td>

                      {/* Defect Attachment Thumbnail */}
                      <td className="py-3.5 px-2 text-center">
                        <div className="flex items-center justify-center">
                          <AttachmentThumbnail
                            rawAttachment={r.attachments}
                            onClick={(e) => {
                              e?.stopPropagation?.();
                              setActiveModalRequest(r);
                            }}
                          />
                        </div>
                      </td>

                      {/* Resp / Executor */}
                      <td className="py-3.5 px-3 text-center whitespace-nowrap">
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-blue-50 text-blue-700 border border-blue-200 mb-0.5">
                          <Building2 className="w-3 h-3 text-blue-600" />
                          <span>{deptStr}</span>
                        </div>
                        <div className="text-[10px] font-bold text-slate-700 truncate max-w-[120px]" title={executorStr}>
                          {executorStr}
                        </div>
                        {(() => {
                          const { hasReassignments, count } = formatReassignmentHistory(r.reassignment_history);
                          if (!hasReassignments) return null;
                          return (
                            <div className="mt-0.5">
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[8px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                                <ArrowRightLeft className="w-2 h-2 text-purple-600" />
                                <span>Reassigned ({count})</span>
                              </span>
                            </div>
                          );
                        })()}
                      </td>

                      {/* Root Cause */}
                      <td className="py-3.5 px-4 text-slate-700 max-w-[160px] truncate" title={rootCauseStr}>
                        {rootCauseStr}
                      </td>

                      {/* Action Taken */}
                      <td className="py-3.5 px-4 text-slate-800 font-medium max-w-[180px] truncate" title={actionStr}>
                        {actionStr}
                      </td>

                      {/* Standardization */}
                      <td className="py-3.5 px-4 text-slate-700 max-w-[160px] truncate" title={standardStr}>
                        {standardStr}
                      </td>

                      {/* Target Date */}
                      <td className="py-3.5 px-3 text-slate-600 font-mono text-[11px] whitespace-nowrap">
                        {targetDateStr}
                      </td>

                      {/* Remarks */}
                      <td className="py-3.5 px-4 text-slate-700 max-w-[160px] truncate" title={remarksStr}>
                        {remarksStr}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-3 text-center whitespace-nowrap">
                        {getStatusBadge(r)}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          {/* View details */}
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

                          {/* Review & Edit (Admin Only for non-closed requests) */}
                          {isAdmin && !String(r.status || '').toUpperCase().includes('CLOSE') && (
                            <button
                              onClick={() => {
                                setActiveModalRequest(r);
                                setModalInitialEdit(true);
                              }}
                              className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition cursor-pointer"
                              title="Edit Observation (Admin Only)"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}

                         
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls matching IHLR */}
        {!loading && (
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
        )}
      </div>

      {/* Export Selection Modal (Excel .xlsx vs PDF .pdf) */}
      <ExportSelectionModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        title="Export Process Audit Analysis Report"
        subtitle={`Select format to download ${filteredRequests.length} filtered audit observation records`}
        recordCount={filteredRequests.length}
        onExportExcel={handleExportExcel}
        onExportPdf={handleExportPdf}
      />

      {/* Complete Inspection & Admin Edit Modal */}
      <ProcessAuditRequestDetailsModal
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

      {/* Universal Interactive Attachment Preview Modal */}
      <AttachmentPreviewModal
        isOpen={Boolean(previewAttachment)}
        attachment={previewAttachment}
        onClose={() => setPreviewAttachment(null)}
      />

      {/* Reassign Department & Executor Modal */}
      {showReassignModal && reassigningRequest && createPortal(
        <div 
          className="fixed inset-0 !m-0 !mt-0 z-[10001] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in"
          style={{ zIndex: 10001 }}
        >
          <div 
            className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200/80 space-y-5 animate-in zoom-in-95 relative"
            style={{ zIndex: 10002 }}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <ArrowRightLeft className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Reassign Audit Observation
                  </h3>
                  <p className="text-[11px] text-slate-500 font-mono">
                    {reassigningRequest.issue_no || `PA-${reassigningRequest.id}`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowReassignModal(false);
                  setReassigningRequest(null);
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Current Assignment banner */}
            <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-2xl text-xs space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Current Assignment
              </span>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-600">Department: <strong className="text-slate-800">{reassigningRequest.department}</strong></span>
                <span className="text-slate-600">Executor: <strong className="text-slate-800">{reassigningRequest.executor}</strong></span>
              </div>
            </div>

            {/* Form Fields */}
            <div className="space-y-3.5 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  New Department <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <select
                    value={reassignDept}
                    onChange={(e) => {
                      setReassignDept(e.target.value);
                      setReassignExecutor('');
                    }}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none cursor-pointer appearance-none pr-8"
                  >
                    {departmentList.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                    New Executor / Lead <span className="text-rose-500">*</span>
                  </label>
                  {loadingDeptUsers && (
                    <span className="text-[10px] text-blue-600 flex items-center gap-1">
                      <RefreshCw className="w-3 h-3 animate-spin" /> Loading team...
                    </span>
                  )}
                </div>
                <div className="relative">
                  <select
                    value={reassignExecutor}
                    onChange={(e) => setReassignExecutor(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none cursor-pointer appearance-none pr-8"
                  >
                    <option value="">-- Select Executor for {reassignDept} --</option>
                    {deptUsers.length === 0 ? (
                      <option value="" disabled>There is no users in the selected department</option>
                    ) : (
                      deptUsers.map((u) => (
                        <option key={u.id || u.name} value={u.name || u.email}>
                          {u.name || u.email} {u.role ? `(${u.role})` : ''}
                        </option>
                      ))
                    )}
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
                </div>
                {reassignDept && !loadingDeptUsers && deptUsers.length === 0 && (
                  <span className="text-[11px] text-amber-600 font-medium mt-1 flex items-center gap-1">
                    <ShieldAlert className="w-3.5 h-3.5 inline shrink-0" />
                    There is no users in the selected department
                  </span>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Reassignment Reason &amp; Note <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={reassignReason}
                  onChange={(e) => setReassignReason(e.target.value)}
                  placeholder="Explain why this request is being reassigned (e.g. wrong department selected at creation, transferred to responsible team, etc.)..."
                  className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none resize-none"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setShowReassignModal(false);
                  setReassigningRequest(null);
                }}
                disabled={reassignLoading}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReassign}
                disabled={reassignLoading}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/20 flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition"
              >
                {reassignLoading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Reassigning...</span>
                  </>
                ) : (
                  <>
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                    <span>Confirm Reassignment</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default AllRequests;
