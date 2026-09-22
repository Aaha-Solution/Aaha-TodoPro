import React, { useState, useEffect } from 'react';
import { Bell, CheckCircle2, Clock, AlertCircle, RefreshCw } from 'lucide-react';
import { ihlrService } from '../../services/ihlrService';

const IhlrNotifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifs = async () => {
    setLoading(true);
    try {
      const data = await ihlrService.getNotifications();
      setNotifications(data);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifs();
  }, []);

  const handleMarkAllRead = () => {
    setNotifications(notifications.map(n => ({ ...n, read: true })));
  };

  return (
    <div className="space-y-6 w-full pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
            <span className="text-blue-600 font-bold uppercase tracking-wider font-mono">IHLR FEED</span>
            <span>/</span>
            <span>Alerts &amp; Activity</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            IHLR Notifications &amp; Activity Feed
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Real-time quality rejection alerts, occurrence updates, and closer timeline escalations.
          </p>
        </div>

        <button
          onClick={handleMarkAllRead}
          className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-2xs transition cursor-pointer"
        >
          Mark All as Read
        </button>
      </div>

      {/* List */}
      <div className="space-y-3">
        {notifications.map((item) => (
          <div
            key={item.id}
            className={`bg-white rounded-2xl p-5 border shadow-2xs flex items-start gap-4 transition hover:shadow-xs ${
              item.read ? 'border-slate-200/80 opacity-75' : 'border-blue-200/80 bg-blue-50/20'
            }`}
          >
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
              item.status === 'CLOSED'
                ? 'bg-emerald-50 text-emerald-600'
                : item.status === 'IN_PROGRESS'
                ? 'bg-amber-50 text-amber-600'
                : 'bg-rose-50 text-rose-600'
            }`}>
              <Bell className="w-4 h-4" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-1">
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                  {item.title}
                </h3>
                <span className="text-[11px] font-mono text-slate-400 shrink-0">
                  {item.date}
                </span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed font-normal">
                {item.message}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default IhlrNotifications;
