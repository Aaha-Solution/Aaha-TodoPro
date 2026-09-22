import React, { useState } from 'react';
import {
  ClipboardCheck,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Filter,
  Eye,
  X,
  AlertTriangle,
  UserCheck,
  FileText,
  ShieldCheck,
  Layers
} from 'lucide-react';

const ProcessAuditApprovals = () => {
  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [activeModalRequest, setActiveModalRequest] = useState(null);

  const [approvalRequests, setApprovalRequests] = useState([
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
      priority: 'High',
      notes: 'Dimensional tolerance inspection complete. Optical sensor calibration verified within ±0.02mm.'
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
      status: 'Pending Approval',
      priority: 'Medium',
      notes: 'Carton sealing strength tested. Barcode readability verified at 100% throughput.'
    },
    {
      id: 'REQ-1001',
      date: '03 Sep 2026',
      shift: 'Morning',
      production: '1,250 Units',
      stage: 'Assembly',
      line: 'Line A - Main Chassis',
      creator: 'iyyu',
      executor: 'Mr. Kumar',
      status: 'Approved',
      priority: 'High',
      notes: 'Torque tightening audit completed. All fasteners within 12-14 Nm specification.'
    },
    {
      id: 'REQ-1005',
      date: '01 Sep 2026',
      shift: 'Night',
      production: '2,100 Units',
      stage: 'Machining & Tooling',
      line: 'Line B - Sub Assembly',
      creator: 'iyyu',
      executor: 'Mr. Suresh',
      status: 'Pending Approval',
      priority: 'High',
      notes: 'CNC tool wear inspection logged. Critical diameter variance detected on 4 units.'
    }
  ]);

  const handleApprove = (id) => {
    setApprovalRequests((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: 'Approved' } : r))
    );
    if (activeModalRequest?.id === id) {
      setActiveModalRequest((prev) => ({ ...prev, status: 'Approved' }));
    }
  };

  const handleReject = (id) => {
    const reason = prompt('Please provide reason for rejection / re-audit:');
    if (reason) {
      setApprovalRequests((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: 'Rejected', rejectionReason: reason } : r))
      );
      if (activeModalRequest?.id === id) {
        setActiveModalRequest((prev) => ({ ...prev, status: 'Rejected', rejectionReason: reason }));
      }
    }
  };

  const filtered = approvalRequests.filter((r) => {
    const matchesSearch =
      r.id.toLowerCase().includes(search.toLowerCase()) ||
      r.stage.toLowerCase().includes(search.toLowerCase()) ||
      r.line.toLowerCase().includes(search.toLowerCase()) ||
      r.executor.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = selectedStatus === 'All' || r.status === selectedStatus;
    return matchesSearch && matchesStatus;
  });

  const pendingCount = approvalRequests.filter((r) => r.status === 'Pending Approval').length;
  const approvedCount = approvalRequests.filter((r) => r.status === 'Approved').length;
  const rejectedCount = approvalRequests.filter((r) => r.status === 'Rejected').length;

  return (
    <div className="space-y-6 w-full pb-16">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
            <span className="text-blue-600 font-bold uppercase tracking-wider font-mono">PROCESS AUDIT</span>
            <span>/</span>
            <span>Sign-off Portal</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Audit Approvals &amp; Sign-offs
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Review production floor audits, verify quality compliance, and issue management sign-offs.
          </p>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Pending Review</span>
            <div className="text-2xl font-black text-amber-600 mt-1">{pendingCount}</div>
            <p className="text-[11px] text-slate-500 mt-0.5">Awaiting manager sign-off</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Approved</span>
            <div className="text-2xl font-black text-emerald-600 mt-1">{approvedCount}</div>
            <p className="text-[11px] text-slate-500 mt-0.5">Sign-off completed</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Rejected / Re-audit</span>
            <div className="text-2xl font-black text-rose-600 mt-1">{rejectedCount}</div>
            <p className="text-[11px] text-slate-500 mt-0.5">Corrective action requested</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
            <XCircle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-2xs space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="sm:col-span-2 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by Request ID, Line, Stage, or Executor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none font-medium"
            />
          </div>

          <div>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-semibold focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
            >
              <option value="All">All Statuses</option>
              <option value="Pending Approval">Pending Approval</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>
        </div>
      </div>

      {/* Approvals Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-extrabold uppercase tracking-widest text-slate-600 font-mono">
              AUDIT APPROVAL QUEUE
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 font-mono">
              {filtered.length} Records
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="bg-[#f8fafc] border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3 px-4">REQ ID</th>
                <th className="py-3 px-4">DATE / SHIFT</th>
                <th className="py-3 px-4">STAGE &amp; LINE</th>
                <th className="py-3 px-4">EXECUTOR</th>
                <th className="py-3 px-4">PRODUCTION</th>
                <th className="py-3 px-4">STATUS</th>
                <th className="py-3 px-4 text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <ClipboardCheck className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="font-semibold text-slate-600">No requests matching approval criteria</p>
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-blue-600 whitespace-nowrap">
                      #{r.id}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="font-semibold text-slate-900">{r.date}</div>
                      <div className="text-[11px] text-slate-400">{r.shift}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900">{r.stage}</div>
                      <div className="text-[11px] text-slate-400">{r.line}</div>
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-800">
                      {r.executor}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-semibold text-slate-700">
                      {r.production}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {r.status === 'Pending Approval' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                          Pending Approval
                        </span>
                      )}
                      {r.status === 'Approved' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Approved
                        </span>
                      )}
                      {r.status === 'Rejected' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                          <XCircle className="w-3.5 h-3.5" />
                          Rejected
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setActiveModalRequest(r)}
                          className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                          title="View Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {r.status === 'Pending Approval' && (
                          <>
                            <button
                              onClick={() => handleApprove(r.id)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] transition shadow-xs cursor-pointer flex items-center gap-1"
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              Approve
                            </button>
                            <button
                              onClick={() => handleReject(r.id)}
                              className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 font-bold text-[11px] transition cursor-pointer flex items-center gap-1"
                            >
                              <XCircle className="w-3 h-3" />
                              Reject
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Details Modal */}
      {activeModalRequest && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Audit Sign-off Review: #{activeModalRequest.id}
                </h3>
                <p className="text-xs text-slate-500">{activeModalRequest.stage} - {activeModalRequest.line}</p>
              </div>
              <button
                onClick={() => setActiveModalRequest(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div>
                  <span className="text-slate-400 block font-semibold text-[10px] uppercase">Incident Date</span>
                  <span className="font-bold text-slate-800">{activeModalRequest.date} ({activeModalRequest.shift})</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-semibold text-[10px] uppercase">Production Volume</span>
                  <span className="font-bold text-slate-800 font-mono">{activeModalRequest.production}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-semibold text-[10px] uppercase">Executor</span>
                  <span className="font-bold text-slate-800">{activeModalRequest.executor}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-semibold text-[10px] uppercase">Current Status</span>
                  <span className="font-bold text-slate-800">{activeModalRequest.status}</span>
                </div>
              </div>

              <div>
                <span className="text-slate-500 block font-bold mb-1 uppercase text-[10px]">Audit Observation &amp; Findings</span>
                <p className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-slate-700 leading-relaxed">
                  {activeModalRequest.notes}
                </p>
              </div>

              {activeModalRequest.rejectionReason && (
                <div>
                  <span className="text-rose-600 block font-bold mb-1 uppercase text-[10px]">Rejection Reason</span>
                  <p className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-800">
                    {activeModalRequest.rejectionReason}
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              {activeModalRequest.status === 'Pending Approval' && (
                <>
                  <button
                    onClick={() => handleReject(activeModalRequest.id)}
                    className="px-4 py-2 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 font-bold text-xs hover:bg-rose-100 transition cursor-pointer"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => handleApprove(activeModalRequest.id)}
                    className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 shadow-md shadow-emerald-600/20 transition cursor-pointer"
                  >
                    Approve Sign-off
                  </button>
                </>
              )}
              <button
                onClick={() => setActiveModalRequest(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-semibold text-xs hover:bg-slate-50 transition cursor-pointer"
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

export default ProcessAuditApprovals;
