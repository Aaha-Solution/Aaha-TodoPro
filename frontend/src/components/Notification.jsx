import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Bell, CheckCheck, ExternalLink } from 'lucide-react';
import { useSelector, useDispatch } from 'react-redux';
import { setNotifications, markAsRead, markAllAsRead } from '../redux/slices/notificationSlice';
import {
  fetchNotificationsForTab,
  markNotificationReadForTab,
  markAllNotificationsReadForTab
} from '../services/notificationFeedService';
import { useAuth } from '../hooks/useAuth';

const Notification = () => {
  const [open, setOpen] = useState(false);
  const { notifications, unreadCount } = useSelector((state) => state.notification);
  const dispatch = useDispatch();
  const dropdownRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const isIhlr = location.pathname.startsWith('/ihlr');
  const tabMode = isIhlr ? 'ihlr' : 'process-audit';

  const fetchLiveNotifications = async () => {
    try {
      // Get live data specifically for the current active tab
      const data = await fetchNotificationsForTab(tabMode, user);
      if (Array.isArray(data)) {
        dispatch(setNotifications(data));
      }
    } catch (err) {
      console.error(`Failed to load ${tabMode} notifications in header:`, err);
    }
  };

  useEffect(() => {
    fetchLiveNotifications();
    const handleRefresh = () => fetchLiveNotifications();

    window.addEventListener('refreshNotifications', handleRefresh);
    window.addEventListener('focus', handleRefresh);

    return () => {
      window.removeEventListener('refreshNotifications', handleRefresh);
      window.removeEventListener('focus', handleRefresh);
    };
  }, [user?.name, user?.id, user?.role, tabMode]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleItemClick = async (item) => {
    if (!item.read) {
      await markNotificationReadForTab(tabMode, item.notifId, item.rawId);
      dispatch(markAsRead(item.id));
    }
    setOpen(false);
    navigate(item.link || (isIhlr ? '/ihlr/my-requests' : '/process-audit/approvals'));
  };

  const handleMarkAllRead = async () => {
    await markAllNotificationsReadForTab(tabMode, user?.name);
    dispatch(markAllAsRead());
    window.dispatchEvent(new Event('refreshNotifications'));
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => {
          const next = !open;
          setOpen(next);
          if (next) fetchLiveNotifications();
        }}
        className="relative p-2.5 rounded-xl text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer flex items-center justify-center"
        aria-label="Notifications"
        title="Notifications Centre"
      >
        <Bell className="w-5 h-5 text-slate-700 hover:text-slate-900 stroke-[2.2] transition-colors" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-80" />
            <span className="relative inline-flex rounded-full h-4 w-4 bg-red-600 text-white text-[9px] font-extrabold items-center justify-center ring-2 ring-white shadow-xs">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-84 sm:w-96 bg-white rounded-2xl shadow-xl border border-slate-100 py-3 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="px-4 pb-2.5 flex items-center justify-between border-b border-slate-100">
            <div>
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <span>{isIhlr ? 'IHLR Alerts' : 'Audit Alerts'}</span>
                <span
                  className={`text-[9px] font-mono px-1.5 py-0.2 rounded-full font-bold ${
                    isIhlr
                      ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                      : 'bg-blue-50 text-blue-700 border border-blue-200'
                  }`}
                >
                  {isIhlr ? 'IHLR' : 'PROCESS AUDIT'}
                </span>
              </h4>
              <p className="text-[11px] text-slate-500">
                {unreadCount} unread alert{unreadCount === 1 ? '' : 's'}
              </p>
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-[11px] text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1 cursor-pointer"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
            {notifications.length === 0 ? (
              <p className="p-6 text-center text-xs text-slate-400">No notifications in stream</p>
            ) : (
              notifications.map((item) => {
                const badgeColor =
                  item.accentColor === 'emerald'
                    ? 'bg-emerald-600'
                    : item.accentColor === 'amber'
                    ? 'bg-amber-600'
                    : item.accentColor === 'rose'
                    ? 'bg-rose-600'
                    : 'bg-blue-600';

                return (
                  <div
                    key={item.id}
                    onClick={() => handleItemClick(item)}
                    className={`p-3.5 hover:bg-slate-50 transition cursor-pointer flex items-start gap-3 ${
                      !item.read ? 'bg-blue-50/20' : ''
                    }`}
                  >
                    <div
                      className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                        !item.read ? 'bg-blue-600 ring-4 ring-blue-100' : 'bg-transparent'
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                        {item.badgeLabel && (
                          <span
                            className={`px-1.5 py-0.2 text-[9px] font-extrabold uppercase rounded text-white ${badgeColor}`}
                          >
                            {item.badgeLabel}
                          </span>
                        )}
                        {item.reqNo && (
                          <span className="text-[10px] font-mono font-bold text-slate-700 bg-slate-100 px-1 rounded">
                            {item.reqNo}
                          </span>
                        )}
                        {item.department && (
                          <span className="text-[9px] font-semibold text-blue-700 bg-blue-50 px-1 rounded border border-blue-100">
                            {item.department}
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-bold text-slate-800 truncate">{item.title}</p>
                      <p className="text-xs text-slate-600 mt-0.5 leading-relaxed line-clamp-2">
                        {item.message}
                      </p>
                      <div className="flex items-center justify-between mt-1 text-[10px] text-slate-400">
                        <span className="font-mono">{item.timeDisplay || item.date || item.time}</span>
                        {item.subCategory && (
                          <span className="font-semibold text-slate-400 uppercase text-[9px]">
                            {item.subCategory}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="px-4 pt-2.5 mt-1 border-t border-slate-100 text-center">
            <button
              onClick={() => {
                setOpen(false);
                navigate(isIhlr ? '/ihlr/notifications' : '/process-audit/notifications');
              }}
              className="text-xs font-bold text-blue-600 hover:text-blue-700 cursor-pointer inline-flex items-center gap-1"
            >
              <span>View All Notifications</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Notification;
