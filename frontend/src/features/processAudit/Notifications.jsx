import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  Clock,
  RefreshCw,
  CheckCheck,
  ChevronRight,
  ClipboardCheck,
  Layers
} from 'lucide-react';
import { processAuditService } from '../../services/processAuditService';
import { useAuth } from '../../hooks/useAuth';

const ProcessAuditNotifications = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const data = await processAuditService.getNotifications({
        user: user?.name,
        user_id: user?.id,
        role: user?.role,
      });
      setNotifications(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, [user?.name]);

  const handleMarkAllRead = async () => {
    try {
      await processAuditService.markAllNotificationsAsRead(user?.name);
      setNotifications(notifications.map((n) => ({ ...n, read: true })));
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  const handleItemClick = async (item) => {
    if (!item.read) {
      await processAuditService.markNotificationAsRead(item.id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, read: true } : n))
      );
    }
    const targetLink = item.link || (item.type === 'approval_required' ? '/process-audit/approvals' : '/process-audit/my-requests');
    navigate(targetLink);
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="space-y-6 w-full pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
            <span className="text-blue-600 font-bold uppercase tracking-wider font-mono">PROCESS AUDIT</span>
            <span>/</span>
            <span>Alerts &amp; Dispatch</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Notifications &amp; Activity Feed
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Automated task assignments, approval requests, and audit lifecycle alerts.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            onClick={loadNotifications}
            disabled={loading}
            className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-2xs transition cursor-pointer flex items-center gap-1.5 disabled:opacity-60"
            title="Refresh notifications"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="px-4 py-2 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 text-xs font-bold text-blue-700 shadow-2xs transition cursor-pointer flex items-center gap-1.5"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Mark All as Read ({unreadCount})</span>
            </button>
          )}
        </div>
      </div>

      {/* Notifications List */}
      <div className="space-y-3.5">
        {loading ? (
          <div className="py-16 text-center text-slate-400 text-xs bg-white rounded-2xl border border-slate-200/90">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
            Loading your notification feed...
          </div>
        ) : notifications.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-xs bg-white rounded-2xl border border-slate-200/90">
            <Bell className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            <p className="font-semibold text-slate-600 mb-1">No notifications at the moment</p>
            <p className="text-slate-400">You will be alerted here whenever an audit task is assigned to you.</p>
          </div>
        ) : (
          notifications.map((item) => {
            const isApprovalReq = item.type === 'approval_required' || (item.title || '').includes('Assigned for Sign-off');
            const isApproved = (item.title || '').includes('Approved');
            const isRejected = (item.title || '').includes('Rejected');

            return (
              <div
                key={item.id}
                onClick={() => handleItemClick(item)}
                className={`bg-white rounded-2xl p-5 border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs hover:shadow-xs hover:border-blue-300 ${
                  !item.read ? 'border-blue-200 bg-blue-50/20 ring-1 ring-blue-500/10' : 'border-slate-200/90'
                }`}
              >
                <div className="flex items-start gap-3.5 flex-1 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                      isApprovalReq
                        ? 'bg-amber-50 text-amber-600 border border-amber-200'
                        : isApproved
                        ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                        : isRejected
                        ? 'bg-rose-50 text-rose-600 border border-rose-200'
                        : 'bg-blue-50 text-blue-600 border border-blue-200'
                    }`}
                  >
                    {isApprovalReq ? (
                      <Clock className="w-5 h-5 animate-pulse" />
                    ) : isApproved ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : isRejected ? (
                      <AlertTriangle className="w-5 h-5" />
                    ) : (
                      <Bell className="w-5 h-5" />
                    )}
                  </div>

                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                        {item.title}
                      </h3>
                      {!item.read && (
                        <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {item.message}
                    </p>
                    <div className="flex items-center gap-3 text-[11px] text-slate-400 pt-0.5">
                      <span className="font-mono">{item.date}</span>
                      {item.requestId && (
                        <>
                          <span>•</span>
                          <span className="font-mono font-semibold text-blue-600">#{item.requestId}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleItemClick(item);
                    }}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs ${
                      isApprovalReq
                        ? 'bg-amber-600 hover:bg-amber-700 text-white'
                        : 'bg-[#2563eb] hover:bg-blue-700 text-white'
                    }`}
                  >
                    <span>{isApprovalReq ? 'Review & Sign-off' : 'View Details'}</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default ProcessAuditNotifications;
