import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  SlidersHorizontal,
  Check,
  CheckCheck,
  Clock,
  Activity,
  Layers,
  AlertCircle,
  Mail,
  RefreshCw,
  X,
  ExternalLink,
  ShieldAlert
} from 'lucide-react';
import { ihlrService } from '../../services/ihlrService';

const IhlrNotifications = () => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('ALL'); // 'ALL' | 'UNREAD'
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');

  // Load notifications from API & sync with actual IHLR requests
  const loadFeed = async () => {
    setLoading(true);
    try {
      const [apiNotifs, requests] = await Promise.all([
        ihlrService.getNotifications().catch(() => []),
        ihlrService.getRequests().catch(() => []),
      ]);

      const streamList = [];

      // If requests exist in IHLR database, construct authentic IHLR activity stream events
      if (Array.isArray(requests) && requests.length > 0) {
        requests.forEach((r, idx) => {
          const reqNo = String(r.req_no || '').startsWith('IHLR-') ? r.req_no : `IHLR-${r.req_no || idx + 1}`;
          const isClosed = (r.status || '').toUpperCase() === 'CLOSED';
          const isInProgress = (r.status || '').toUpperCase() === 'IN_PROGRESS';
          const dept = (r.resp || r.department || 'PRODUCTION').toUpperCase();
          const fourM = r.four_m ? `4M: ${r.four_m} • ${r.problem_detected_at || 'CELL INSPECTION'}` : '4M: METHOD • PROCESS LINE';
          let formattedDate = 'Recent';
          if (r.created_at) {
            try {
              const d = new Date(r.created_at);
              formattedDate = `${d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} • ${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}`;
            } catch {
              formattedDate = String(r.created_at);
            }
          } else if (r.batch_date) {
            formattedDate = String(r.batch_date);
          }

          if (isClosed) {
            streamList.push({
              id: `req-closed-${r.id || idx}`,
              rawId: r.id,
              reqNo: `#${reqNo}`,
              badgeLabel: 'CONTAINMENT APPROVED',
              accentColor: 'emerald',
              department: dept,
              title: `Defect Containment & Closure Approved – ${reqNo}`,
              message: `Rejection incident ${reqNo} (Model: ${r.model || 'OLS LONG ARM'}, Defect: "${r.problem || 'Quality variance'}") has been verified. 5-Why root cause countermeasure confirmed by ${r.analysis_done_by || 'Quality Assurance'}. Status: Closed.`,
              timeDisplay: formattedDate,
              subCategory: fourM,
              footerFlag: 'SYSTEM_LOGS',
              read: true,
              type: 'closed',
            });
          } else if (isInProgress) {
            streamList.push({
              id: `req-progress-${r.id || idx}`,
              rawId: r.id,
              reqNo: `#${reqNo}`,
              badgeLabel: 'COUNTERMEASURE REQUIRED',
              accentColor: 'amber',
              department: dept,
              title: `Occurrence Countermeasure in Progress – ${reqNo}`,
              message: `Line rejection report ${reqNo} ("${r.problem || 'Defect under investigation'}"). Assigned responsible person ${r.resp_person || 'Supervisor'} (${dept}) is executing containment and 5-Why countermeasure actions. Target Date: ${r.target_date ? String(r.target_date).split('T')[0] : 'TBD'}.`,
              timeDisplay: formattedDate,
              subCategory: fourM,
              footerFlag: 'ACTION_REQUIRED',
              read: false,
              type: 'in_progress',
            });
          } else {
            // OPEN
            streamList.push({
              id: `req-open-${r.id || idx}`,
              rawId: r.id,
              reqNo: `#${reqNo}`,
              badgeLabel: 'NEW LINE REJECTION',
              accentColor: 'blue',
              department: dept,
              title: `New Defect Incident Logged – ${reqNo}`,
              message: `Incident ${reqNo} detected at ${r.problem_detected_at || 'Assembly Line'} for Model ${r.model || 'OLS LONG ARM'} (Rejected Qty: ${r.actual_qty || 1} units). Quality team initiated 5-Why problem root cause isolation. Awaiting containment response.`,
              timeDisplay: formattedDate,
              subCategory: fourM,
              footerFlag: 'ACTION_REQUIRED',
              read: false,
              type: 'open',
            });
          }
        });
      }

      // If backend returned notifications, merge them
      if (Array.isArray(apiNotifs) && apiNotifs.length > 0) {
        apiNotifs.forEach((n, idx) => {
          if (!streamList.some((s) => s.id === n.id || s.rawId === n.id)) {
            const isClosed = n.status === 'CLOSED';
            const isInProgress = n.status === 'IN_PROGRESS';
            streamList.push({
              id: `api-notif-${n.id || idx}`,
              rawId: n.id,
              reqNo: n.requestId ? `#${n.requestId}` : '#IHLR-ALERT',
              badgeLabel: isClosed ? 'CONTAINMENT APPROVED' : isInProgress ? 'COUNTERMEASURE REQUIRED' : 'NEW LINE REJECTION',
              accentColor: isClosed ? 'emerald' : isInProgress ? 'amber' : 'blue',
              department: n.department || 'QUALITY',
              title: n.title || 'IHLR Line Rejection Alert',
              message: n.message,
              timeDisplay: n.date || 'Recent Today',
              subCategory: 'LINE DEFECT REPORT',
              footerFlag: isClosed ? 'SYSTEM_LOGS' : 'ACTION_REQUIRED',
              read: Boolean(n.read),
              type: n.status?.toLowerCase() || 'info',
            });
          }
        });
      }

      // Set the dynamic stream populated ONLY from database records (no static mock data)
      setNotifications(streamList);
    } catch (err) {
      console.error('Failed to load IHLR notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFeed();
  }, []);

  // Mark all read
  const handleMarkAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  // Toggle individual read / unread
  const toggleRead = (id) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: !n.read } : n))
    );
  };

  // Counts
  const totalCount = notifications.length;
  const unreadCount = notifications.filter((n) => !n.read).length;

  // Filtered List
  const filteredNotifications = useMemo(() => {
    return notifications.filter((item) => {
      // Tab filter
      if (activeTab === 'UNREAD' && item.read) return false;

      // Department filter
      if (selectedDept !== 'ALL' && item.department !== selectedDept) return false;

      // Status filter
      if (selectedStatus !== 'ALL') {
        if (selectedStatus === 'CLOSED' && item.accentColor !== 'emerald') return false;
        if (selectedStatus === 'IN_PROGRESS' && item.accentColor !== 'amber') return false;
        if (selectedStatus === 'OPEN' && item.accentColor !== 'blue' && item.accentColor !== 'rose') return false;
      }

      // Search term
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchesId = (item.reqNo || '').toLowerCase().includes(query);
        const matchesTitle = (item.title || '').toLowerCase().includes(query);
        const matchesDept = (item.department || '').toLowerCase().includes(query);
        const matchesMsg = (item.message || '').toLowerCase().includes(query);
        const matchesBadge = (item.badgeLabel || '').toLowerCase().includes(query);
        return matchesId || matchesTitle || matchesDept || matchesMsg || matchesBadge;
      }

      return true;
    });
  }, [notifications, activeTab, selectedDept, selectedStatus, searchTerm]);

  const departmentList = useMemo(() => {
    const set = new Set(notifications.map((n) => n.department).filter(Boolean));
    return Array.from(set);
  }, [notifications]);

  return (
    <div className="space-y-5 w-full pb-16">
      {/* 1. Page Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Notifications Centre
        </h1>
      </div>

      {/* 2. Unified Toolbar (Search, Filters, Mark All Read) */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Left Side: Search + Filter Dropdown */}
        <div className="flex flex-1 items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by ID, title, department, defect..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-slate-50/80 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-200 transition cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => setShowFilterDropdown(!showFilterDropdown)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-semibold shadow-2xs transition cursor-pointer ${
                selectedDept !== 'ALL' || selectedStatus !== 'ALL'
                  ? 'border-blue-300 bg-blue-50 text-blue-700'
                  : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
              <span>Filters</span>
              {(selectedDept !== 'ALL' || selectedStatus !== 'ALL') && (
                <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />
              )}
            </button>

            {/* Filter Dropdown Popover */}
            {showFilterDropdown && (
              <div className="absolute right-0 top-full mt-2 w-64 bg-white border border-slate-200 rounded-2xl p-4 shadow-xl z-30 space-y-3.5 animate-in fade-in zoom-in-95 duration-100">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <span className="text-xs font-bold text-slate-900">Filter Alerts</span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedDept('ALL');
                      setSelectedStatus('ALL');
                    }}
                    className="text-[10px] text-blue-600 hover:underline font-semibold cursor-pointer"
                  >
                    Reset
                  </button>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Department
                  </label>
                  <select
                    value={selectedDept}
                    onChange={(e) => setSelectedDept(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                  >
                    <option value="ALL">All Departments</option>
                    {departmentList.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Status
                  </label>
                  <select
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="OPEN">Open Incidents</option>
                    <option value="IN_PROGRESS">Containment in Progress</option>
                    <option value="CLOSED">Containment Approved / Closed</option>
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => setShowFilterDropdown(false)}
                  className="w-full py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition cursor-pointer"
                >
                  Apply Filters
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Mark All Read */}
        <div className="flex items-center shrink-0 self-end md:self-auto">
          <button
            type="button"
            onClick={handleMarkAllRead}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200/90 bg-white hover:bg-slate-50 text-xs font-bold text-slate-800 shadow-2xs hover:border-slate-300 transition cursor-pointer"
          >
            <CheckCheck className="w-4 h-4 text-slate-600" />
            <span>Mark All Read</span>
          </button>
        </div>
      </div>

      {/* 3. Filter Pills */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => setActiveTab('ALL')}
          className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'ALL'
              ? 'bg-[#2563eb] text-white shadow-xs'
              : 'bg-white hover:bg-slate-50 text-slate-600 border border-slate-200'
          }`}
        >
          <span>All Alerts</span>
          <span
            className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
              activeTab === 'ALL' ? 'bg-white/20 text-white font-bold' : 'bg-slate-100 text-slate-700 font-bold'
            }`}
          >
            {totalCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('UNREAD')}
          className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'UNREAD'
              ? 'bg-[#2563eb] text-white shadow-xs'
              : 'bg-white hover:bg-slate-50 text-slate-600 border border-slate-200'
          }`}
        >
          <span>Unread</span>
          <span
            className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
              unreadCount > 0 ? 'bg-rose-500 text-white' : 'bg-slate-100 text-slate-500'
            }`}
          >
            {unreadCount}
          </span>
        </button>
      </div>

      {/* 4. Section Divider: LIVE ACTIVITY STREAMS */}
      <div className="relative flex items-center justify-center py-2">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-slate-200/90" />
        </div>
        <div className="relative px-4 bg-[#f8fafc] text-[10px] font-bold text-slate-400 tracking-widest uppercase">
          LIVE ACTIVITY STREAMS
        </div>
      </div>

      {/* 5. Notifications Cards List */}
      <div className="space-y-4">
        {loading ? (
          <div className="py-16 text-center text-slate-400 text-xs bg-white rounded-2xl border border-slate-200/90 shadow-2xs">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
            Loading live notification streams...
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-xs bg-white rounded-2xl border border-slate-200/90 shadow-2xs">
            <Mail className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            <p className="font-semibold text-slate-700 mb-1">
              {notifications.length === 0 ? 'No notifications found in database' : 'No alerts matching your criteria'}
            </p>
            <p className="text-slate-400 text-[11px]">
              {notifications.length === 0
                ? 'When line rejection reports or containment actions are recorded, they will appear here in real time.'
                : 'Try clearing search or resetting the filter options.'}
            </p>
          </div>
        ) : (
          filteredNotifications.map((item) => {
            // Accent border style
            const borderAccent =
              item.accentColor === 'emerald'
                ? 'border-l-emerald-500'
                : item.accentColor === 'amber'
                ? 'border-l-amber-500'
                : item.accentColor === 'rose'
                ? 'border-l-rose-500'
                : 'border-l-blue-600';

            // Top pill badge style
            const badgeBg =
              item.accentColor === 'emerald'
                ? 'bg-emerald-600'
                : item.accentColor === 'amber'
                ? 'bg-amber-600'
                : item.accentColor === 'rose'
                ? 'bg-rose-600'
                : 'bg-blue-600';

            // Left icon container
            const iconBg =
              item.accentColor === 'emerald'
                ? 'bg-emerald-50 text-emerald-600'
                : item.accentColor === 'amber'
                ? 'bg-amber-50 text-amber-600'
                : item.accentColor === 'rose'
                ? 'bg-rose-50 text-rose-600'
                : 'bg-blue-50 text-blue-600';

            const IconComponent =
              item.accentColor === 'emerald'
                ? Activity
                : item.accentColor === 'amber'
                ? Layers
                : item.accentColor === 'rose'
                ? AlertCircle
                : Layers;

            return (
              <div
                key={item.id}
                className={`bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs hover:shadow-xs transition flex flex-col gap-3.5 border-l-4 ${borderAccent} ${
                  !item.read ? 'ring-1 ring-blue-500/10' : ''
                }`}
              >
                {/* Top Row: Icon + Badge + ReqNo + Dept + Title + Timestamp & Subcategory */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}>
                      <IconComponent className="w-4 h-4" />
                    </div>

                    <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider text-white shadow-2xs ${badgeBg}`}>
                      {item.badgeLabel}
                    </span>

                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[10px] font-bold">
                      {item.reqNo}
                    </span>

                    {item.department && (
                      <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200/80 text-[10px] font-bold uppercase tracking-wide">
                        {item.department}
                      </span>
                    )}

                    <h3 className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                      {item.title}
                    </h3>
                  </div>

                  {/* Right side: Time + 4M / Subcategory Tag */}
                  <div className="flex flex-col items-start sm:items-end shrink-0">
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>{item.timeDisplay}</span>
                    </div>
                    {item.subCategory && (
                      <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold mt-0.5">
                        {item.subCategory}
                      </span>
                    )}
                  </div>
                </div>

                {/* Inset Message Body */}
                <div className="bg-slate-50/70 border border-slate-100/90 rounded-xl p-3.5 text-xs text-slate-600 leading-relaxed font-normal">
                  {item.message}
                </div>

                {/* Card Footer: Status Flag & Mark Unread Action */}
                <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs">
                  <div className="flex items-center gap-1.5 text-slate-500 font-semibold text-[11px]">
                    {item.footerFlag === 'ACTION_REQUIRED' ? (
                      <span className="inline-flex items-center gap-1.5 text-amber-600">
                        <AlertCircle className="w-3.5 h-3.5" />
                        Action Required
                      </span>
                    ) : item.footerFlag === 'SYSTEM_LOGS' ? (
                      <span className="inline-flex items-center gap-1.5 text-emerald-600">
                        <Check className="w-3.5 h-3.5" />
                        System Logs
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-blue-600">
                        <Activity className="w-3.5 h-3.5" />
                        Operational Update
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => navigate('/ihlr/my-requests')}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-blue-600 transition cursor-pointer"
                    >
                      <span>View Details</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>

                    <button
                      type="button"
                      onClick={() => toggleRead(item.id)}
                      className="inline-flex items-center gap-1.5 text-[10px] font-bold text-slate-400 hover:text-blue-600 uppercase tracking-wider transition cursor-pointer"
                      title={item.read ? 'Mark as Unread' : 'Mark as Read'}
                    >
                      <Mail className="w-3.5 h-3.5" />
                      <span>{item.read ? 'MARK UNREAD' : 'MARK READ'}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default IhlrNotifications;
