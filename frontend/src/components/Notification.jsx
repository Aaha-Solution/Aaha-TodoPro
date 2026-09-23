import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import { useSelector, useDispatch } from 'react-redux';
import { setNotifications, markAsRead, markAllAsRead } from '../redux/slices/notificationSlice';
import { processAuditService } from '../services/processAuditService';
import { useAuth } from '../hooks/useAuth';

const Notification = () => {
  const [open, setOpen] = useState(false);
  const { notifications, unreadCount } = useSelector((state) => state.notification);
  const dispatch = useDispatch();
  const dropdownRef = useRef(null);
  const navigate = useNavigate();
  const { user } = useAuth();

  const fetchLiveNotifications = async () => {
    try {
      const data = await processAuditService.getNotifications({
        user: user?.name,
        user_id: user?.id,
        role: user?.role,
      });
      if (Array.isArray(data)) {
        dispatch(setNotifications(data));
      }
    } catch (err) {
      console.error('Failed to load notifications in header:', err);
    }
  };

  useEffect(() => {
    fetchLiveNotifications();
    const interval = setInterval(fetchLiveNotifications, 10000); // 10s poll
    const handleFocus = () => fetchLiveNotifications();
    const handleRefresh = () => fetchLiveNotifications();

    window.addEventListener('focus', handleFocus);
    window.addEventListener('refreshNotifications', handleRefresh);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('refreshNotifications', handleRefresh);
    };
  }, [user?.name, user?.id, user?.role]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleItemClick = (item) => {
    if (!item.read) {
      processAuditService.markNotificationAsRead(item.id);
      dispatch(markAsRead(item.id));
    }
    setOpen(false);
    if (item.link) {
      navigate(item.link);
    }
  };

  const handleMarkAllRead = () => {
    processAuditService.markAllNotificationsAsRead(user?.name);
    dispatch(markAllAsRead());
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors cursor-pointer"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] px-1 bg-blue-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-white animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-xl border border-slate-100 py-3 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="px-4 pb-2.5 flex items-center justify-between border-b border-slate-100">
            <div>
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Notifications</h4>
              <p className="text-[11px] text-slate-500">{unreadCount} unread message{unreadCount === 1 ? '' : 's'}</p>
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

          <div className="max-h-72 overflow-y-auto divide-y divide-slate-50">
            {notifications.length === 0 ? (
              <p className="p-4 text-center text-xs text-slate-400">No notifications</p>
            ) : (
              notifications.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleItemClick(item)}
                  className={`p-3.5 hover:bg-slate-50 transition cursor-pointer flex items-start gap-3 ${
                    !item.read ? 'bg-blue-50/30' : ''
                  }`}
                >
                  <div
                    className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                      !item.read ? 'bg-blue-600 ring-4 ring-blue-100' : 'bg-transparent'
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-800 truncate">{item.title}</p>
                    <p className="text-xs text-slate-600 mt-0.5 leading-relaxed line-clamp-2">{item.message}</p>
                    <span className="text-[10px] text-slate-400 mt-1 block font-mono">{item.time || item.date}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="px-4 pt-2.5 mt-1 border-t border-slate-100 text-center">
            <button
              onClick={() => {
                setOpen(false);
                navigate('/process-audit/notifications');
              }}
              className="text-xs font-bold text-blue-600 hover:text-blue-700 cursor-pointer"
            >
              View All Notifications
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Notification;
