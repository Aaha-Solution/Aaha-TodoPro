import React, { useState, useRef, useEffect } from 'react';
import { Bell, Check, CheckCheck } from 'lucide-react';
import { useSelector, useDispatch } from 'react-redux';
import { markAsRead, markAllAsRead } from '../redux/slices/notificationSlice';

const Notification = () => {
  const [open, setOpen] = useState(false);
  const { notifications, unreadCount } = useSelector((state) => state.notification);
  const dispatch = useDispatch();
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-purple-600 rounded-full ring-2 ring-white animate-pulse"></span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-xl border border-slate-100 py-3 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="px-4 pb-2.5 flex items-center justify-between border-b border-slate-100">
            <div>
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Notifications</h4>
              <p className="text-[11px] text-slate-500">{unreadCount} unread messages</p>
            </div>
            {unreadCount > 0 && (
              <button
                onClick={() => dispatch(markAllAsRead())}
                className="text-[11px] text-purple-600 hover:text-purple-700 font-medium flex items-center gap-1"
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
                  onClick={() => dispatch(markAsRead(item.id))}
                  className={`p-3.5 hover:bg-slate-50 transition cursor-pointer flex items-start gap-3 ${
                    !item.read ? 'bg-purple-50/40' : ''
                  }`}
                >
                  <div
                    className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                      !item.read ? 'bg-purple-600 ring-4 ring-purple-100' : 'bg-transparent'
                    }`}
                  />
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-slate-800">{item.title}</p>
                    <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{item.message}</p>
                    <span className="text-[10px] text-slate-400 mt-1 block">{item.time}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Notification;
