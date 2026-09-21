import React, { useState } from 'react';
import {
  Download,
  Search,
  RotateCcw,
  Eye,
  X,
  AlertOctagon,
  CheckCircle2,
  Clock,
  Layers,
  FileText
} from 'lucide-react';
import { useDispatch } from 'react-redux';
import { openStopperModal } from '../../redux/slices/stopperSlice';

const MyRequests = () => {
  const dispatch = useDispatch();

  const [search, setSearch] = useState('');
  const [selectedShift, setSelectedShift] = useState('All Shifts');
  const [selectedStage, setSelectedStage] = useState('All Stages');
  const [selectedExecutor, setSelectedExecutor] = useState('All Executors');
  const [selectedStatus, setSelectedStatus] = useState('All Statuses');
  const [activeModalRequest, setActiveModalRequest] = useState(null);

  const rawRequests = [
    {
      id: 'REQ-1001',
      date: '03 Sep 2026',
      shift: 'Morning',
      production: '1,250 Units',
      stage: 'Assembly',
      line: 'Line A - Main Chassis',
      creator: 'iyyu',
      executor: 'Mr. Kumar',
      status: 'Pending Execution',
      statusColor: 'bg-amber-50 text-amber-700 border-amber-200/80 dot-amber-500',
      dotColor: 'bg-amber-500',
    },
    {
      id: 'REQ-1002',
      date: '03 Sep 2026',
      shift: 'Evening',
      production: '980 Units',
      stage: 'Inspection',
      line: 'Line C - Optical Inspection',
      creator: 'iyyu',
      executor: 'Mr. Ravi',
      status: 'Pending Approval',
      statusColor: 'bg-purple-50 text-purple-700 border-purple-200/80 dot-purple-500',
      dotColor: 'bg-purple-500',
    },
    {
      id: 'REQ-1003',
      date: '02 Sep 2026',
      shift: 'Afternoon',
      production: '3,400 Units',
      stage: 'Packaging',
      line: 'Line D - High Speed Pack',
      creator: 'iyyu',
      executor: 'Mr. Arjun',
      status: 'Partially Approved',
      statusColor: 'bg-teal-50 text-teal-700 border-teal-200/80 dot-teal-500',
      dotColor: 'bg-teal-500',
    },
    {
      id: 'REQ-1004',
      date: '01 Sep 2026',
      shift: 'Morning',
      production: '2,500 Kg',
      stage: 'Raw Material',
      line: 'Raw Material Intake Silo 3',
      creator: 'iyyu',
      executor: 'Mr. Suresh',
      status: 'Approved',
      statusColor: 'bg-emerald-50 text-emerald-700 border-emerald-200/80 dot-emerald-500',
      dotColor: 'bg-emerald-500',
    },
    {
      id: 'REQ-1005',
      date: '02 Sep 2026',
      shift: 'Night',
      production: '2,100 Units',
      stage: 'Production',
      line: 'Line B - CNC Milling',
      creator: 'iyyu',
      executor: 'Mr. Suresh',
      status: 'Rejected',
      statusColor: 'bg-rose-50 text-rose-700 border-rose-200/80 dot-rose-500',
      dotColor: 'bg-rose-500',
    },
  ];

  const handleReset = () => {
    setSearch('');
    setSelectedShift('All Shifts');
    setSelectedStage('All Stages');
    setSelectedExecutor('All Executors');
    setSelectedStatus('All Statuses');
  };

  const filteredRequests = rawRequests.filter((req) => {
    const matchesSearch =
      !search ||
      req.id.toLowerCase().includes(search.toLowerCase()) ||
      req.line.toLowerCase().includes(search.toLowerCase()) ||
      req.executor.toLowerCase().includes(search.toLowerCase());

    const matchesShift = selectedShift === 'All Shifts' || req.shift === selectedShift;
    const matchesStage = selectedStage === 'All Stages' || req.stage === selectedStage;
    const matchesExecutor = selectedExecutor === 'All Executors' || req.executor === selectedExecutor;
    const matchesStatus = selectedStatus === 'All Statuses' || req.status === selectedStatus;

    return matchesSearch && matchesShift && matchesStage && matchesExecutor && matchesStatus;
  });

  const handleExportCSV = () => {
    const headers = 'REQUEST ID,DATE,SHIFT,PRODUCTION,STAGE,LINE,CREATOR,EXECUTOR,STATUS\n';
    const rows = filteredRequests
      .map((r) => `${r.id},${r.date},${r.shift},"${r.production}",${r.stage},"${r.line}",${r.creator},${r.executor},${r.status}`)
      .join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `INEL_Production_Requests_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Request Tracking
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Complete enterprise repository with dynamic search, stage, and role filtering.
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold border border-slate-200 shadow-2xs flex items-center justify-center gap-2 transition cursor-pointer"
        >
          <Download className="w-4 h-4 text-slate-500" />
          <span>Export CSV</span>
        </button>
      </div>

      {/* Filter Box */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs space-y-4">
        {/* Search Bar + Reset Button */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Request ID (e.g. REQ-1001), comments, or line..."
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          <button
            onClick={handleReset}
            className="w-full sm:w-auto px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-medium border border-slate-200 shadow-2xs transition whitespace-nowrap cursor-pointer"
          >
            Reset Filters
          </button>
        </div>

        {/* 4 Filter Dropdowns */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Shift
            </label>
            <select
              value={selectedShift}
              onChange={(e) => setSelectedShift(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
            >
              <option>All Shifts</option>
              <option>Morning</option>
              <option>Evening</option>
              <option>Afternoon</option>
              <option>Night</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Stage
            </label>
            <select
              value={selectedStage}
              onChange={(e) => setSelectedStage(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
            >
              <option>All Stages</option>
              <option>Assembly</option>
              <option>Inspection</option>
              <option>Packaging</option>
              <option>Raw Material</option>
              <option>Production</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Executor
            </label>
            <select
              value={selectedExecutor}
              onChange={(e) => setSelectedExecutor(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
            >
              <option>All Executors</option>
              <option>Mr. Kumar</option>
              <option>Mr. Ravi</option>
              <option>Mr. Arjun</option>
              <option>Mr. Suresh</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Status
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
            >
              <option>All Statuses</option>
              <option>Pending Execution</option>
              <option>Pending Approval</option>
              <option>Partially Approved</option>
              <option>Approved</option>
              <option>Rejected</option>
            </select>
          </div>
        </div>
      </div>

      {/* Requests Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#f8fafc] border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3.5 px-6">REQUEST ID</th>
                <th className="py-3.5 px-4">DATE</th>
                <th className="py-3.5 px-4">SHIFT</th>
                <th className="py-3.5 px-4">PRODUCTION</th>
                <th className="py-3.5 px-4">STAGE</th>
                <th className="py-3.5 px-4">LINE</th>
                <th className="py-3.5 px-4">CREATOR</th>
                <th className="py-3.5 px-4">EXECUTOR</th>
                <th className="py-3.5 px-4">STATUS</th>
                <th className="py-3.5 px-6 text-center">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredRequests.map((req) => (
                <tr key={req.id} className="hover:bg-slate-50/70 transition">
                  <td className="py-4 px-6 font-bold text-blue-600">{req.id}</td>
                  <td className="py-4 px-4 text-slate-600 font-medium">{req.date}</td>
                  <td className="py-4 px-4 text-slate-600 font-medium">{req.shift}</td>
                  <td className="py-4 px-4 text-slate-800 font-semibold">{req.production}</td>
                  <td className="py-4 px-4 text-slate-600">{req.stage}</td>
                  <td className="py-4 px-4 text-slate-700 font-medium">{req.line}</td>
                  <td className="py-4 px-4 text-slate-600">{req.creator}</td>
                  <td className="py-4 px-4 text-slate-800 font-semibold">{req.executor}</td>
                  <td className="py-4 px-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${req.statusColor}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${req.dotColor}`}></span>
                      <span>{req.status}</span>
                    </span>
                  </td>
                  <td className="py-4 px-6 text-center">
                    <button
                      onClick={() => setActiveModalRequest(req)}
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

      {/* Details Modal with Line Stopper integration */}
      {activeModalRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-7 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {activeModalRequest.id} — Full Audit & Production Profile
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Status: <span className="font-semibold text-slate-800">{activeModalRequest.status}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveModalRequest(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="my-5 grid grid-cols-2 gap-3.5 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Line & Station</span>
                <span className="font-bold text-slate-800">{activeModalRequest.line}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Assigned Executor</span>
                <span className="font-bold text-slate-800">{activeModalRequest.executor}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Target Production</span>
                <span className="font-bold text-slate-800">{activeModalRequest.production}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Batch Date & Shift</span>
                <span className="font-bold text-slate-800">{activeModalRequest.date} ({activeModalRequest.shift})</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <button
                onClick={() => {
                  setActiveModalRequest(null);
                  dispatch(openStopperModal());
                }}
                className="px-3.5 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold border border-red-200 flex items-center gap-1.5 transition cursor-pointer"
              >
                <AlertOctagon className="w-4 h-4" />
                <span>Halt with Line Stopper</span>
              </button>

              <button
                onClick={() => setActiveModalRequest(null)}
                className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
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

export default MyRequests;
