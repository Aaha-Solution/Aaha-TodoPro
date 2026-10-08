import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Search,
  Check,
  CheckCheck,
  Clock,
  Activity,
  Layers,
  AlertCircle,
  Mail,
  RefreshCw,
  X,
  ClipboardCheck,
  CheckCircle2
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useDispatch } from 'react-redux';
import {
  setNotifications as setReduxNotifications,
  markAllAsRead as setReduxMarkAllAsRead
} from '../../redux/slices/notificationSlice';
import {
  fetchNotificationsForTab,
  markNotificationReadForTab,
  markAllNotificationsReadForTab
} from '../../services/notificationFeedService';

const UnifiedNotificationCenter = ({ tab: forcedTab }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const { user } = useAuth();

  const tabMode = forcedTab || (location.pathname.startsWith('/ihlr') ? 'ihlr' : 'process-audit');
  const isIhlr = tabMode === 'ihlr';

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilterTab, setActiveFilterTab] = useState('ALL'); // 'ALL' | 'UNREAD'

  // Load feed for this specific tab
  const loadFeed = async () => {
    setLoading(true);
    try {
      const streamList = await fetchNotificationsForTab(tabMode, user);
      setNotifications(streamList);
      dispatch(setReduxNotifications(streamList));
    } catch (err) {
      console.error(`Failed to load ${tabMode} notifications:`, err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFeed();
    const handleRefresh = () => loadFeed();
    window.addEventListener('refreshNotifications', handleRefresh);
    window.addEventListener('focus', handleRefresh);
    return () => {
      window.removeEventListener('refreshNotifications', handleRefresh);
      window.removeEventListener('focus', handleRefresh);
    };
  }, [user?.name, user?.id, user?.role, tabMode]);

  // Mark all read for this tab
  const handleMarkAllRead = async () => {
    if (unreadCount === 0) return;
    const updated = notifications.map((n) => ({ ...n, read: true }));
    setNotifications(updated);
    dispatch(setReduxMarkAllAsRead());
    await markAllNotificationsReadForTab(tabMode, user?.name, user, notifications.map(n => n.id));
    window.dispatchEvent(new Event('refreshNotifications'));
  };

  // Toggle individual read / unread for this tab
  const toggleRead = async (targetId) => {
    const item = notifications.find((n) => n.id === targetId);
    if (!item) return;
    const nextRead = !item.read;

    const updated = notifications.map((n) => (n.id === targetId ? { ...n, read: nextRead } : n));
    setNotifications(updated);
    dispatch(setReduxNotifications(updated));

    await markNotificationReadForTab(tabMode, item.notifId, item.rawId, nextRead, user, item.id);
    window.dispatchEvent(new Event('refreshNotifications'));
  };

  // Handle Card Click: Mark as read if unread and navigate
  const handleCardClick = async (item) => {
    if (!item.read) {
      const updated = notifications.map((n) => (n.id === item.id ? { ...n, read: true } : n));
      setNotifications(updated);
      dispatch(setReduxNotifications(updated));
      await markNotificationReadForTab(tabMode, item.notifId, item.rawId, true, user, item.id);
      window.dispatchEvent(new Event('refreshNotifications'));
    }

    if (isIhlr) {
      // In IHLR, navigate directly to "All Requests" (MyRequests.jsx) with request search
      const cleanReqNo = item.reqNo ? item.reqNo.replace(/^#/, '').trim() : '';
      navigate('/ihlr/my-requests', {
        state: {
          search: cleanReqNo,
          highlightReq: cleanReqNo
        }
      });
    } else {
      navigate(item.link || '/process-audit/approvals');
    }
  };

  // Counts
  const totalCount = notifications.length;
  const unreadCount = notifications.filter((n) => !n.read).length;

  // Filtered List
  const filteredNotifications = useMemo(() => {
    return notifications.filter((item) => {
      if (activeFilterTab === 'UNREAD' && item.read) return false;

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
  }, [notifications, activeFilterTab, searchTerm]);

  return (
    <div className="space-y-5 w-full pb-16">
      {/* 1. Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
            <span
              className={`font-bold uppercase tracking-wider font-mono px-2 py-0.5 rounded text-[10px] ${
                isIhlr
                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                  : 'bg-blue-50 text-blue-700 border border-blue-200'
              }`}
            >
              {isIhlr ? 'IN-HOUSE LINE REJECTION' : 'PROCESS AUDIT OBSERVATION'}
            </span>
            <span>/</span>
            <span>Alerts &amp; Dispatch</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Notifications Centre
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            {isIhlr
              ? 'Real-time line defect alerts, containment tracking, and 5-Why root-cause notifications.'
              : 'Automated task assignments, approval sign-off requests, and audit lifecycle alerts.'}
          </p>
        </div>


      </div>

      {/* 2. Unified Toolbar (Search & Mark All Read) */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Left Side: Search */}
        <div className="flex flex-1 items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={
                isIhlr
                  ? 'Search by ID, title, department, defect...'
                  : 'Search by issue ID, title, auditor, department...'
              }
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
        </div>

        {/* Right Side: Mark All Read */}
        <div className="flex items-center shrink-0 self-end md:self-auto">
          <button
            type="button"
            disabled={unreadCount === 0}
            onClick={handleMarkAllRead}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-bold transition shadow-2xs ${
              unreadCount === 0
                ? 'bg-slate-100/70 border-slate-200 text-slate-400 cursor-not-allowed opacity-60 select-none'
                : 'border-slate-200/90 bg-white hover:bg-slate-50 text-slate-800 hover:border-slate-300 cursor-pointer'
            }`}
            title={unreadCount === 0 ? 'No unread notifications to mark as read' : 'Mark all notifications as read'}
          >
            <CheckCheck className={`w-4 h-4 ${unreadCount === 0 ? 'text-slate-400' : 'text-slate-600'}`} />
            <span>Mark All Read</span>
          </button>
        </div>
      </div>

      {/* 3. Filter Pills */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => setActiveFilterTab('ALL')}
          className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
            activeFilterTab === 'ALL'
              ? 'bg-[#2563eb] text-white shadow-xs'
              : 'bg-white hover:bg-slate-50 text-slate-600 border border-slate-200'
          }`}
        >
          <span>All Alerts</span>
          <span
            className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
              activeFilterTab === 'ALL' ? 'bg-white/20 text-white font-bold' : 'bg-slate-100 text-slate-700 font-bold'
            }`}
          >
            {totalCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveFilterTab('UNREAD')}
          className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
            activeFilterTab === 'UNREAD'
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
            {activeFilterTab === 'UNREAD' ? (
              <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-500" />
            ) : (
              <Mail className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            )}
            <p className="font-semibold text-slate-700 mb-1">
              {activeFilterTab === 'UNREAD'
                ? 'All caught up! No unread notifications'
                : notifications.length === 0
                ? 'No notifications found in database'
                : 'No alerts matching your criteria'}
            </p>
            <p className="text-slate-400 text-[11px]">
              {activeFilterTab === 'UNREAD'
                ? 'All incident and defect reports have been reviewed.'
                : notifications.length === 0
                ? isIhlr
                  ? 'When line rejection reports or containment actions are recorded, they will appear here in real time.'
                  : 'When audit observations or sign-off requests are assigned, they will appear here in real time.'
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
                ? ClipboardCheck
                : item.accentColor === 'rose'
                ? AlertCircle
                : Layers;

            const defaultLink = isIhlr ? '/ihlr/my-requests' : '/process-audit/approvals';

            return (
              <div
                key={item.id}
                onClick={() => handleCardClick(item)}
                className={`bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs hover:shadow-md hover:border-slate-300 transition-all duration-150 cursor-pointer flex flex-col gap-3.5 border-l-4 ${borderAccent} ${
                  !item.read ? 'ring-1 ring-blue-500/10' : ''
                }`}
              >
                {/* Top Row: Icon + Badge + ReqNo + Dept + Title + Timestamp & Subcategory */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}>
                      <IconComponent className="w-4 h-4" />
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider text-white shadow-2xs ${badgeBg}`}
                    >
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

                  {/* Right side: Time + Subcategory Tag */}
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
                    {item.footerFlag === 'CASE_CLOSED' || item.footerFlag === 'CLOSED' || item.badgeLabel === 'CASE CLOSED' ? (
                      <span className="inline-flex items-center gap-1.5 text-emerald-600 font-bold">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        Incident Closed &amp; Signed Off
                      </span>
                    ) : item.footerFlag === 'ACTION_REQUIRED' ? (
                      <span className="inline-flex items-center gap-1.5 text-amber-600 font-bold">
                        <AlertCircle className="w-3.5 h-3.5" />
                        Action Required
                      </span>
                    ) : item.footerFlag === 'SYSTEM_LOGS' ? (
                      <span className="inline-flex items-center gap-1.5 text-blue-600">
                        <Check className="w-3.5 h-3.5" />
                        Logged in Quality Records
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-indigo-600">
                        <Activity className="w-3.5 h-3.5" />
                        Operational Update
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleRead(item.id);
                      }}
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

export default UnifiedNotificationCenter;
