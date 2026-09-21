import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const ProcessAuditNotifications = () => {
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState([
    {
      id: 1,
      title: 'Request Approved Successfully',
      message: 'Request REQ-1004 has received final approval from Plant Head (Mr. Anand) and is completed.',
      date: '02 Sep 2026, 10:00 AM',
      requestId: 'REQ-1004',
      read: false,
    },
    {
      id: 2,
      title: 'Request Rejected',
      message: 'Request REQ-1005 was rejected by Mr. Raj due to tolerance deviation. View notes for action.',
      date: '03 Sep 2026, 08:30 AM',
      requestId: 'REQ-1005',
      read: false,
    },
  ]);

  const handleMarkAllRead = () => {
    setNotifications(notifications.map((n) => ({ ...n, read: true })));
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Notifications & Activity Feed
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Automated system alerts, task assignments, and approval escalations.
          </p>
        </div>

        <button
          onClick={handleMarkAllRead}
          className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-2xs transition cursor-pointer"
        >
          Mark All as Read
        </button>
      </div>

      {/* Notifications List */}
      <div className="space-y-4">
        {notifications.map((item) => (
          <div
            key={item.id}
            className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:shadow-xs transition"
          >
            <div className="space-y-1.5 flex-1">
              <h3 className="text-sm font-bold text-slate-900">{item.title}</h3>
              <p className="text-xs text-slate-600 leading-relaxed">{item.message}</p>
              <span className="text-[11px] text-slate-400 font-mono block pt-0.5">
                {item.date}
              </span>
            </div>

            <button
              onClick={() => navigate('/process-audit/my-requests')}
              className="px-5 py-2.5 bg-[#2563eb] hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/20 transition whitespace-nowrap self-start sm:self-center cursor-pointer"
            >
              View Request
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProcessAuditNotifications;
