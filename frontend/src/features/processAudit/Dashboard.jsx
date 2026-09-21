import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, 
  BarChart3, 
  Hourglass, 
  Cpu, 
  ShieldCheck, 
  Check, 
  X, 
  AlertOctagon,
  Eye,
  FileText
} from 'lucide-react';
import { useDispatch } from 'react-redux';
import { openStopperModal } from '../../redux/slices/stopperSlice';

const ProcessAuditDashboard = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [selectedRequest, setSelectedRequest] = useState(null);

  const kpis = [
    {
      title: 'Total Requests',
      value: '5',
      subtitle: 'Across all production lines',
      icon: BarChart3,
      iconBg: 'bg-blue-50 text-blue-600',
    },
    {
      title: 'Pending Execution',
      value: '1',
      subtitle: 'Awaiting floor commencement',
      icon: Hourglass,
      iconBg: 'bg-amber-50 text-amber-600',
    },
    {
      title: 'In Execution',
      value: '0',
      subtitle: 'Floor machining & assembly',
      icon: Cpu,
      iconBg: 'bg-purple-50 text-purple-600',
    },
    {
      title: 'Pending Approval',
      value: '2',
      subtitle: 'Level 1 & Level 2 reviews',
      icon: ShieldCheck,
      iconBg: 'bg-sky-50 text-sky-600',
    },
    {
      title: 'Approved',
      value: '1',
      subtitle: 'Released to Inventory',
      icon: Check,
      iconBg: 'bg-emerald-50 text-emerald-600',
    },
    {
      title: 'Rejected',
      value: '1',
      subtitle: 'Actionable rework needed',
      icon: X,
      iconBg: 'bg-rose-50 text-rose-600',
    },
  ];

  const recentRequests = [
    {
      id: 'REQ-1001',
      date: '03 Sep 2026',
      shift: 'Morning',
      production: '1,250 Units',
      stage: 'Assembly',
      status: 'Pending Execution',
      statusColor: 'bg-amber-50 text-amber-700 border-amber-200/80 dot-amber-500',
      dotColor: 'bg-amber-500',
      createdDate: '03 Sep 2026, 10:15 AM',
      line: 'Line A - Main Chassis Assembly',
      executor: 'Mr. Kumar',
    },
    {
      id: 'REQ-1002',
      date: '03 Sep 2026',
      shift: 'Evening',
      production: '980 Units',
      stage: 'Inspection',
      status: 'Pending Approval',
      statusColor: 'bg-purple-50 text-purple-700 border-purple-200/80 dot-purple-500',
      dotColor: 'bg-purple-500',
      createdDate: '03 Sep 2026, 08:30 AM',
      line: 'Line C - Optical Inspection',
      executor: 'Mr. Ravi',
    },
    {
      id: 'REQ-1003',
      date: '02 Sep 2026',
      shift: 'Afternoon',
      production: '3,400 Units',
      stage: 'Packaging',
      status: 'Partially Approved',
      statusColor: 'bg-teal-50 text-teal-700 border-teal-200/80 dot-teal-500',
      dotColor: 'bg-teal-500',
      createdDate: '02 Sep 2026, 11:00 AM',
      line: 'Line D - High Speed Pack',
      executor: 'Mr. Arjun',
    },
    {
      id: 'REQ-1004',
      date: '01 Sep 2026',
      shift: 'Morning',
      production: '2,500 Kg',
      stage: 'Raw Material',
      status: 'Approved',
      statusColor: 'bg-emerald-50 text-emerald-700 border-emerald-200/80 dot-emerald-500',
      dotColor: 'bg-emerald-500',
      createdDate: '01 Sep 2026, 08:30 AM',
      line: 'Raw Material Intake Silo 3',
      executor: 'Mr. Suresh',
    },
    {
      id: 'REQ-1005',
      date: '02 Sep 2026',
      shift: 'Night',
      production: '2,100 Units',
      stage: 'Production',
      status: 'Rejected',
      statusColor: 'bg-rose-50 text-rose-700 border-rose-200/80 dot-rose-500',
      dotColor: 'bg-rose-500',
      createdDate: '02 Sep 2026, 21:00 PM',
      line: 'Line B - CNC Milling',
      executor: 'Mr. Suresh',
    },
  ];

  return (
    <div className="space-y-7">
      {/* Top Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Dashboard
          </h1>
        </div>

        <button
          onClick={() => navigate('/process-audit/create-request')}
          className="px-5 py-2.5 bg-[#2563eb] hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/20 flex items-center justify-center gap-2 transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Create Production Request</span>
        </button>
      </div>

      {/* 6 Top Metric Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {kpis.map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <div
              key={idx}
              className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-2xs hover:shadow-xs transition flex flex-col justify-between"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-600 truncate">{kpi.title}</span>
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${kpi.iconBg}`}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
              </div>

              <div className="mt-3">
                <div className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                  {kpi.value}
                </div>
                <p className="text-[10px] text-slate-400 mt-1 truncate">
                  {kpi.subtitle}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Recent Production Requests Card */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
        {/* Card Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm sm:text-base font-bold text-slate-900">
            Recent Production Requests
          </h2>
          <button
            onClick={() => navigate('/process-audit/my-requests')}
            className="px-3.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 shadow-2xs transition cursor-pointer"
          >
            View All Tracking
          </button>
        </div>

        {/* Requests Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#f8fafc] border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3.5 px-6">REQUEST ID</th>
                <th className="py-3.5 px-6">DATE</th>
                <th className="py-3.5 px-6">SHIFT</th>
                <th className="py-3.5 px-6">PRODUCTION</th>
                <th className="py-3.5 px-6">STAGE</th>
                <th className="py-3.5 px-6">STATUS</th>
                <th className="py-3.5 px-6">CREATED DATE</th>
                <th className="py-3.5 px-6 text-center">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {recentRequests.map((req) => (
                <tr key={req.id} className="hover:bg-slate-50/70 transition">
                  <td className="py-4 px-6 font-bold text-blue-600">{req.id}</td>
                  <td className="py-4 px-6 text-slate-600 font-medium">{req.date}</td>
                  <td className="py-4 px-6 text-slate-600 font-medium">{req.shift}</td>
                  <td className="py-4 px-6 text-slate-800 font-semibold">{req.production}</td>
                  <td className="py-4 px-6 text-slate-600">{req.stage}</td>
                  <td className="py-4 px-6">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${req.statusColor}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${req.dotColor}`}></span>
                      <span>{req.status}</span>
                    </span>
                  </td>
                  <td className="py-4 px-6 text-slate-500 text-[11px] font-mono">{req.createdDate}</td>
                  <td className="py-4 px-6 text-center">
                    <button
                      onClick={() => setSelectedRequest(req)}
                      className="px-3 py-1 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 transition shadow-2xs cursor-pointer"
                    >
                      View Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* View Details Modal with Stopper Check */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-7 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">{selectedRequest.id} Production Details</h3>
                  <p className="text-[11px] text-slate-500">Created on {selectedRequest.createdDate}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedRequest(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="my-5 grid grid-cols-2 gap-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Line & Station</span>
                <span className="font-bold text-slate-800">{selectedRequest.line}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Assigned Executor</span>
                <span className="font-bold text-slate-800">{selectedRequest.executor}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Production Volume</span>
                <span className="font-bold text-slate-800">{selectedRequest.production}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Current Stage</span>
                <span className="font-bold text-slate-800">{selectedRequest.stage}</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <button
                onClick={() => {
                  setSelectedRequest(null);
                  dispatch(openStopperModal());
                }}
                className="px-3.5 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold border border-red-200 flex items-center gap-1.5 transition"
              >
                <AlertOctagon className="w-4 h-4" />
                Trigger Line Stopper
              </button>

              <button
                onClick={() => setSelectedRequest(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProcessAuditDashboard;
