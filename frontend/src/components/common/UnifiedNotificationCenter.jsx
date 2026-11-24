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
  CheckCircle2,
  ArrowRightLeft
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useDispatch } from 'react-redux';
import {
  setNotifications as setReduxNotifications,
  markAllAsRead as setReduxMarkAllAsRead,
  markAsRead as setReduxMarkAsRead,
  decrementUnreadCount as setReduxDecrementUnreadCount
} from '../../redux/slices/notificationSlice';
import {
  fetchNotificationsForTab,
  markNotificationReadForTab,
  markAllNotificationsReadForTab,
  getNotificationSortTime
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

  // Viewport breakpoint state for responsive layout
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
    return () => {
      window.removeEventListener('refreshNotifications', handleRefresh);
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
    if (nextRead) {
      dispatch(setReduxMarkAsRead(targetId));
      if (item.notifId) dispatch(setReduxMarkAsRead(item.notifId));
    }

    const activeUser = user || storage.getUser();
    await markNotificationReadForTab(tabMode, item.notifId, item.rawId, nextRead, activeUser, item.id, item.notifId ? null : item.reqNo);
    window.dispatchEvent(new Event('refreshNotifications'));
  };

  // Handle Card Click: Mark as read if unread and intelligently navigate to Approvals or All Requests
  const handleCardClick = async (item) => {
    const targetReqNo = item.reqNo;
    const rawNo = item.reqNo || (item.rawId ? (isIhlr ? `IHLR-${item.rawId}` : `PA-${item.rawId}`) : '');
    const cleanReqNo = rawNo ? String(rawNo).replace(/^#/, '').trim() : '';

    // Identify unread item for this card specifically
    const itemsToMarkRead = notifications.filter(
      (n) => n.id === item.id && !n.read
    );

    // Update local and Redux state immediately so badge and unreadCount decrement instantly
    if (itemsToMarkRead.length > 0 || !item.read) {
      const updated = notifications.map((n) => {
        if (n.id === item.id) {
          return { ...n, read: true };
        }
        return n;
      });
      setNotifications(updated);
      dispatch(setReduxNotifications(updated));
      dispatch(setReduxMarkAsRead(item.id));
      if (item.notifId) dispatch(setReduxMarkAsRead(item.notifId));

      // Asynchronously persist read state to database and localStorage
      const activeUser = user || storage.getUser();
      (async () => {
        try {
          if (itemsToMarkRead.length > 0) {
            for (const targetItem of itemsToMarkRead) {
              await markNotificationReadForTab(
                tabMode,
                targetItem.notifId,
                targetItem.rawId,
                true,
                activeUser,
                targetItem.id,
                targetItem.notifId ? null : targetReqNo
              );
            }
          } else {
            await markNotificationReadForTab(
              tabMode,
              item.notifId,
              item.rawId,
              true,
              activeUser,
              item.id,
              item.notifId ? null : targetReqNo
            );
          }
          window.dispatchEvent(new Event('refreshNotifications'));
        } catch (err) {
          console.warn('Failed to persist notification read state:', err);
        }
      })();
    }

    const itemType = String(item.type || '').toLowerCase();
    const itemBadge = String(item.badgeLabel || '').toUpperCase();
    const itemFooter = String(item.footerFlag || '').toUpperCase();
    const itemTitle = String(item.title || '').toLowerCase();

    // Determine if notification represents a closed case
    const isClosed =
      ['case_closed', 'closed', 'closure_confirmed'].includes(itemType) ||
      itemBadge === 'CASE CLOSED' ||
      itemBadge === 'CONTAINMENT APPROVED' ||
      itemBadge === 'REPORT LOGGED' ||
      itemFooter === 'CASE_CLOSED' ||
      itemTitle.includes('closed') ||
      itemTitle.includes('closure approved');

    if (isIhlr) {
      let targetPath;
      if (isClosed) {
        targetPath = '/ihlr/all-requests';
      } else if (item.link) {
        targetPath = item.link.replace('/my-requests', '/all-requests');
      } else {
        targetPath = '/ihlr/approvals';
      }
      navigate(targetPath, {
        state: {
          search: cleanReqNo,
          highlightReq: cleanReqNo,
          requestId: item.rawId,
        },
      });
    } else {
      let targetPath;
      if (isClosed) {
        targetPath = '/process-audit/all-requests';
      } else if (item.link) {
        targetPath = item.link.replace('/my-requests', '/all-requests');
      } else {
        targetPath = '/process-audit/approvals';
      }
      navigate(targetPath, {
        state: {
          search: cleanReqNo,
          highlightReq: cleanReqNo,
          requestId: item.rawId,
        },
      });
    }
  };

  // Counts
  const totalCount = notifications.length;
  const unreadCount = notifications.filter((n) => !n.read).length;

  // Filtered List
  const filteredNotifications = useMemo(() => {
    const list = notifications.filter((item) => {
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

    return [...list].sort((a, b) => {
      const timeA = getNotificationSortTime(a);
      const timeB = getNotificationSortTime(b);
      if (timeB !== timeA) return timeB - timeA;
      const idA = Number(a.notifId || a.rawId || 0);
      const idB = Number(b.notifId || b.rawId || 0);
      return idB - idA;
    });
  }, [notifications, activeFilterTab, searchTerm]);

  return (
    <div
      className="space-y-5 w-full pb-16"
      style={{
        width: '100%',
        maxWidth: '100%',
        minWidth: 0,
        overflowX: 'hidden',
        paddingBottom: isMobile ? '32px' : '64px',
        boxSizing: 'border-box'
      }}
    >
      {/* 1. Page Header */}
      <div
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        style={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          alignItems: isMobile ? 'flex-start' : 'center',
          justifyContent: 'space-between',
          gap: isMobile ? '12px' : '16px',
          width: '100%',
          maxWidth: '100%',
          minWidth: 0,
          boxSizing: 'border-box'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
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
              {isIhlr ? 'IHLR Notifications Centre' : 'Process Audit Notifications Centre'}
            </h1>
            <span
              style={{
                padding: '2px 8px',
                borderRadius: '6px',
                fontSize: '10px',
                fontWeight: 800,
                fontFamily: 'monospace',
                backgroundColor: isIhlr ? '#eef2ff' : '#eff6ff',
                color: isIhlr ? '#4338ca' : '#1d4ed8',
                border: isIhlr ? '1px solid #c7d2fe' : '1px solid #bfdbfe'
              }}
            >
              {isIhlr ? 'IHLR DEFECT STREAM' : 'PROCESS AUDIT STREAM'}
            </span>
          </div>
          <p
            style={{
              fontSize: isMobile ? '12px' : '13px',
              color: '#64748b',
              marginTop: '4px',
              marginBottom: 0
            }}
          >
            {isIhlr
              ? 'Real-time alert feed for line defect reports, containment actions, and sign-offs.'
              : 'Real-time alert feed for audit observations, containment actions, and sign-off requests.'}
          </p>
        </div>

        {/* Mark All Read */}
        <div
          className="flex items-center shrink-0"
          style={{
            width: isMobile ? '100%' : 'auto',
            boxSizing: 'border-box'
          }}
        >
          <button
            type="button"
            disabled={unreadCount === 0}
            onClick={handleMarkAllRead}
            style={{
              height: '38px',
              padding: isMobile ? '0 14px' : '0 16px',
              borderRadius: '10px',
              fontSize: '12px',
              fontWeight: 700,
              width: isMobile ? '100%' : 'auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxSizing: 'border-box'
            }}
            className={`border text-xs font-bold transition shadow-2xs ${unreadCount === 0
              ? 'bg-slate-100/70 border-slate-200 text-slate-400 cursor-not-allowed opacity-60 select-none'
              : 'border-slate-200/90 bg-white hover:bg-slate-50 text-slate-800 hover:border-slate-300 cursor-pointer'
              }`}
            title={unreadCount === 0 ? 'No unread notifications to mark as read' : 'Mark all notifications as read'}
          >
            <CheckCheck className={`w-4 h-4 ${unreadCount === 0 ? 'text-slate-400' : 'text-slate-600'}`} style={{ width: '16px', height: '16px' }} />
            <span>Mark All Read</span>
          </button>
        </div>
      </div>

      {/* 2. Search & Filter Bar */}
      <div
        className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3"
        style={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          alignItems: isMobile ? 'stretch' : 'center',
          justifyContent: 'space-between',
          gap: isMobile ? '10px' : '12px',
          width: '100%',
          maxWidth: '100%',
          minWidth: 0,
          boxSizing: 'border-box'
        }}
      >
        {/* Filter Pills */}
        <div
          className="flex items-center gap-2"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            width: isMobile ? '100%' : 'auto'
          }}
        >
          <button
            type="button"
            onClick={() => setActiveFilterTab('ALL')}
            style={{
              flex: isMobile ? 1 : 'none',
              height: '38px',
              padding: isMobile ? '0 12px' : '0 16px',
              borderRadius: '10px',
              fontSize: '12px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
            className={`transition cursor-pointer ${activeFilterTab === 'ALL'
              ? 'bg-[#2563eb] text-white shadow-xs'
              : 'bg-white hover:bg-slate-50 text-slate-600 border border-slate-200'
              }`}
          >
            <span>All Alerts</span>
            <span
              style={{
                fontSize: '10px',
                padding: '2px 6px',
                borderRadius: '9999px'
              }}
              className={`font-mono ${activeFilterTab === 'ALL' ? 'bg-white/20 text-white font-bold' : 'bg-slate-100 text-slate-700 font-bold'
                }`}
            >
              {totalCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveFilterTab('UNREAD')}
            style={{
              flex: isMobile ? 1 : 'none',
              height: '38px',
              padding: isMobile ? '0 12px' : '0 16px',
              borderRadius: '10px',
              fontSize: '12px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
            className={`transition cursor-pointer ${activeFilterTab === 'UNREAD'
              ? 'bg-[#2563eb] text-white shadow-xs'
              : 'bg-white hover:bg-slate-50 text-slate-600 border border-slate-200'
              }`}
          >
            <span>Unread</span>
            <span
              style={{
                fontSize: '10px',
                padding: '2px 6px',
                borderRadius: '9999px'
              }}
              className={`font-mono font-bold ${unreadCount > 0 ? 'bg-rose-500 text-white' : 'bg-slate-100 text-slate-500'
                }`}
            >
              {unreadCount}
            </span>
          </button>
        </div>

        {/* Search Input */}
        <div
          className="relative"
          style={{
            position: 'relative',
            width: isMobile ? '100%' : '300px',
            minWidth: 0,
            boxSizing: 'border-box'
          }}
        >
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" style={{ width: '16px', height: '16px', left: '12px', top: '11px' }} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search alerts, req no, department..."
            style={{
              height: '38px',
              paddingLeft: '38px',
              paddingRight: searchTerm ? '32px' : '12px',
              borderRadius: '10px',
              fontSize: isMobile ? '13px' : '12px',
              boxSizing: 'border-box'
            }}
            className="w-full bg-white border border-slate-200 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
              style={{ right: '10px', top: '10px' }}
            >
              <X className="w-3.5 h-3.5" style={{ width: '14px', height: '14px' }} />
            </button>
          )}
        </div>
      </div>

      {/* 3. Section Divider: LIVE ACTIVITY STREAMS */}
      <div className="relative flex items-center justify-center py-2" style={{ padding: '8px 0' }}>
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-slate-200/90" style={{ borderTop: '1px solid #e2e8f0' }} />
        </div>
        <div
          className="relative px-4 bg-[#f8fafc] text-[10px] font-bold text-slate-400 tracking-widest uppercase"
          style={{
            fontSize: '10px',
            letterSpacing: '0.1em',
            padding: '0 16px',
            color: '#94a3b8'
          }}
        >
          LIVE ACTIVITY STREAMS
        </div>
      </div>

      {/* 4. Notifications Cards List */}
      <div className="space-y-4" style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box' }}>
        {loading ? (
          <div
            className="py-16 text-center text-slate-400 text-xs bg-white rounded-2xl border border-slate-200/90 shadow-2xs"
            style={{
              padding: '64px 16px',
              borderRadius: '14px',
              fontSize: '12px',
              border: '1px solid #e2e8f0',
              textAlign: 'center'
            }}
          >
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" style={{ width: '24px', height: '24px', margin: '0 auto 8px auto' }} />
            Loading live notification streams...
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div
            className="py-16 text-center text-slate-400 text-xs bg-white rounded-2xl border border-slate-200/90 shadow-2xs"
            style={{
              padding: '64px 16px',
              borderRadius: '14px',
              fontSize: '12px',
              border: '1px solid #e2e8f0',
              textAlign: 'center'
            }}
          >
            {activeFilterTab === 'UNREAD' ? (
              <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-500" style={{ width: '32px', height: '32px', margin: '0 auto 8px auto', color: '#10b981' }} />
            ) : (
              <Mail className="w-8 h-8 mx-auto mb-2 text-slate-300" style={{ width: '32px', height: '32px', margin: '0 auto 8px auto', color: '#cbd5e1' }} />
            )}
            <p className="font-semibold text-slate-700 mb-1" style={{ fontSize: '13px', fontWeight: 600, margin: '0 0 4px 0' }}>
              {activeFilterTab === 'UNREAD'
                ? 'All caught up! No unread notifications'
                : notifications.length === 0
                  ? 'No notifications found in database'
                  : 'No alerts matching your criteria'}
            </p>
            <p className="text-slate-400 text-[11px]" style={{ fontSize: '11px', margin: 0, color: '#94a3b8' }}>
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
                    : item.accentColor === 'purple'
                      ? 'border-l-purple-500'
                      : 'border-l-blue-600';

            // Top pill badge style
            const badgeBg =
              item.accentColor === 'emerald'
                ? 'bg-emerald-600'
                : item.accentColor === 'amber'
                  ? 'bg-amber-600'
                  : item.accentColor === 'rose'
                    ? 'bg-rose-600'
                    : item.accentColor === 'purple'
                      ? 'bg-purple-600'
                      : 'bg-blue-600';

            // Left icon container
            const iconBg =
              item.accentColor === 'emerald'
                ? 'bg-emerald-50 text-emerald-600'
                : item.accentColor === 'amber'
                  ? 'bg-amber-50 text-amber-600'
                  : item.accentColor === 'rose'
                    ? 'bg-rose-50 text-rose-600'
                    : item.accentColor === 'purple'
                      ? 'bg-purple-50 text-purple-600'
                      : 'bg-blue-50 text-blue-600';

            const IconComponent =
              item.accentColor === 'emerald'
                ? Activity
                : item.accentColor === 'amber'
                  ? ClipboardCheck
                  : item.accentColor === 'rose'
                    ? AlertCircle
                    : item.accentColor === 'purple'
                      ? ArrowRightLeft
                      : item.badgeLabel === 'CC NOTIFICATION' || item.type === 'cc_notification'
                        ? Mail
                        : Layers;

            return (
              <div
                key={item.id}
                onClick={() => handleCardClick(item)}
                style={{
                  borderRadius: isMobile ? '14px' : '16px',
                  padding: isMobile ? '14px' : '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: isMobile ? '10px' : '14px',
                  maxWidth: '100%',
                  minWidth: 0,
                  boxSizing: 'border-box'
                }}
                className={`border transition-all duration-150 cursor-pointer border-l-4 ${borderAccent} ${!item.read
                  ? 'bg-white border-blue-200/90 ring-2 ring-blue-500/20 shadow-xs hover:shadow-md hover:border-blue-300'
                  : 'bg-white/95 border-slate-200/90 shadow-2xs hover:shadow-md hover:border-slate-300 opacity-95'
                  }`}
              >
                {/* Top Row: Icon + Badge + ReqNo + Dept + Title + Timestamp & Subcategory */}
                <div
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                  style={{
                    display: 'flex',
                    flexDirection: isMobile ? 'column' : 'row',
                    alignItems: isMobile ? 'flex-start' : 'center',
                    justifyContent: 'space-between',
                    gap: isMobile ? '8px' : '10px',
                    width: '100%',
                    minWidth: 0
                  }}
                >
                  <div className="flex items-center gap-2 flex-wrap min-w-0" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', minWidth: 0 }}>
                    <div
                      className={`rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}
                      style={{ width: '28px', height: '28px', borderRadius: '8px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <IconComponent className="w-4 h-4" style={{ width: '16px', height: '16px' }} />
                    </div>

                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: '6px',
                        fontSize: '10px',
                        fontWeight: 800,
                        letterSpacing: '0.05em',
                        color: '#ffffff'
                      }}
                      className={`uppercase text-white shadow-2xs ${badgeBg}`}
                    >
                      {item.badgeLabel}
                    </span>

                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: '6px',
                        fontSize: '10px',
                        fontWeight: 700
                      }}
                      className="bg-slate-100 text-slate-700 font-mono"
                    >
                      {item.reqNo}
                    </span>
                  </div>

                  {/* Right side: Read/Unread Tag + Time + Subcategory */}
                  <div
                    className="flex flex-col items-start sm:items-end shrink-0 gap-1"
                    style={{
                      display: 'flex',
                      flexDirection: isMobile ? 'row' : 'column',
                      alignItems: isMobile ? 'center' : 'flex-end',
                      justifyContent: isMobile ? 'space-between' : 'flex-start',
                      width: isMobile ? '100%' : 'auto',
                      gap: '4px'
                    }}
                  >
                    <div className="flex items-center gap-2" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {!item.read ? (
                        <span
                          style={{
                            padding: '2px 8px',
                            borderRadius: '9999px',
                            fontSize: '10px',
                            fontWeight: 800,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                          className="uppercase bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" style={{ width: '6px', height: '6px', borderRadius: '9999px' }} />
                          UNREAD
                        </span>
                      ) : (
                        <span
                          style={{
                            padding: '2px 8px',
                            borderRadius: '9999px',
                            fontSize: '10px',
                            fontWeight: 600,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                          className="uppercase bg-slate-100 text-slate-500 border border-slate-200/80"
                        >
                          <Check className="w-3 h-3 text-slate-400" style={{ width: '12px', height: '12px' }} />
                          READ
                        </span>
                      )}
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px' }}>
                        <Clock className="w-3.5 h-3.5 text-slate-400" style={{ width: '14px', height: '14px' }} />
                        <span>{item.timeDisplay}</span>
                      </div>
                    </div>
                    {item.subCategory && (
                      <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold" style={{ fontSize: '10px' }}>
                        {item.subCategory}
                      </span>
                    )}
                  </div>
                </div>

                {/* Inset Message Body */}
                <div
                  className="bg-slate-50/70 border border-slate-100/90 rounded-xl p-3.5 text-xs text-slate-700 leading-relaxed font-normal"
                  style={{
                    padding: isMobile ? '10px 12px' : '14px 16px',
                    borderRadius: '10px',
                    fontSize: isMobile ? '12px' : '12px',
                    lineHeight: '18px',
                    wordBreak: 'break-word',
                    boxSizing: 'border-box'
                  }}
                >
                  {item.message}
                </div>

                {/* Card Footer: Mark Read/Unread Action */}
                <div
                  className="flex items-center justify-end pt-1 border-t border-slate-100 text-xs"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: isMobile ? 'stretch' : 'flex-end',
                    paddingTop: '6px',
                    borderTop: '1px solid #f1f5f9'
                  }}
                >
                  <div
                    className="flex items-center gap-3"
                    style={{
                      width: isMobile ? '100%' : 'auto'
                    }}
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleRead(item.id);
                      }}
                      style={{
                        height: '34px',
                        padding: '0 12px',
                        borderRadius: '8px',
                        fontSize: '10px',
                        fontWeight: 800,
                        letterSpacing: '0.05em',
                        width: isMobile ? '100%' : 'auto',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        boxSizing: 'border-box'
                      }}
                      className={`transition-all duration-150 cursor-pointer shadow-2xs select-none ${!item.read
                        ? 'bg-slate-100 hover:bg-slate-200 border-2 border-slate-900 text-black font-black hover:shadow-xs active:scale-95'
                        : 'bg-white hover:bg-slate-50 border border-slate-200/90 text-slate-400 hover:text-slate-600 font-bold active:scale-95'
                        }`}
                      title={item.read ? 'Mark as Unread' : 'Mark as Read'}
                    >
                      {!item.read ? (
                        <>
                          <CheckCheck className="w-3.5 h-3.5 text-black stroke-[2.5]" style={{ width: '14px', height: '14px' }} />
                          <span>MARK AS READ</span>
                        </>
                      ) : (
                        <>
                          <Mail className="w-3.5 h-3.5 text-slate-400" style={{ width: '14px', height: '14px' }} />
                          <span>MARK AS UNREAD</span>
                        </>
                      )}
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
