import React, { useState, useEffect } from 'react';
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
  FileText,
  ShieldAlert,
  ArrowRight,
  ExternalLink
} from 'lucide-react';
import { ihlrService } from '../../services/ihlrService';

const IhlrApprovals = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [activeModalRequest, setActiveModalRequest] = useState(null);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const data = await ihlrService.getRequests();
      setRequests(data);
    } catch (err) {
      console.error('Failed to load IHLR requests for approval:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleSignOff = async (id, status) => {
    try {
      await ihlrService.updateRequest(id, { status });
      fetchRequests();
      if (activeModalRequest?.id === id) {
        setActiveModalRequest((prev) => ({ ...prev, status }));
      }
    } catch (err) {
      alert('Failed to update status: ' + err.message);
    }
  };

  const filtered = requests.filter((r) => {
    const matchesSearch =
      r.req_no.toLowerCase().includes(search.toLowerCase()) ||
      r.problem.toLowerCase().includes(search.toLowerCase()) ||
      r.model.toLowerCase().includes(search.toLowerCase()) ||
      (r.received_from || '').toLowerCase().includes(search.toLowerCase()) ||
      (r.analysis_done_by || '').toLowerCase().includes(search.toLowerCase());
    const matchesStatus = selectedStatus === 'All' || r.status === selectedStatus;
    return matchesSearch && matchesStatus;
  });

  const openCount = requests.filter((r) => r.status === 'OPEN').length;
  const inProgressCount = requests.filter((r) => r.status === 'IN_PROGRESS').length;
  const closedCount = requests.filter((r) => r.status === 'CLOSED').length;

  return (
    <div className="space-y-6 w-full pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
            <span className="text-amber-600 font-bold uppercase tracking-wider font-mono">IHLR REPOSITORY</span>
            <span>/</span>
            <span>Approvals &amp; Sign-offs</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            IHLR Sign-off &amp; Closure Approvals
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Validate QA root-cause investigations, approve containment actions, and authorize incident closures.
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Awaiting Containment</span>
            <div className="text-2xl font-black text-rose-600 mt-1">{openCount}</div>
            <p className="text-[11px] text-slate-500 mt-0.5">Open rejection incidents</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Analysis In Review</span>
            <div className="text-2xl font-black text-amber-600 mt-1">{inProgressCount}</div>
            <p className="text-[11px] text-slate-500 mt-0.5">5-Why investigation underway</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <ShieldAlert className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Approved &amp; Closed</span>
            <div className="text-2xl font-black text-emerald-600 mt-1">{closedCount}</div>
            <p className="text-[11px] text-slate-500 mt-0.5">Validated with root countermeasures</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-2xs space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="sm:col-span-2 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
            <input
              type="text"
              placeholder="Search Req#, Problem, Model, or Inspector..."
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
              <option value="OPEN">OPEN (Containment Required)</option>
              <option value="IN_PROGRESS">IN PROGRESS (Why-Why Analysis)</option>
              <option value="CLOSED">CLOSED (Resolved &amp; Signed-off)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-extrabold uppercase tracking-widest text-slate-600 font-mono">
              IHLR APPROVAL QUEUE
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 font-mono">
              {filtered.length} Reports
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="bg-[#f8fafc] border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3 px-4">REQ NO</th>
                <th className="py-3 px-4">DATE / SHIFT</th>
                <th className="py-3 px-4">PROBLEM &amp; MODEL</th>
                <th className="py-3 px-4">DETECTED / FROM</th>
                <th className="py-3 px-3">4M / RESP</th>
                <th className="py-3 px-4">STATUS</th>
                <th className="py-3 px-4 text-right">SIGN-OFF ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    Loading approval queue...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <ClipboardCheck className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="font-semibold text-slate-600">No reports found matching criteria</p>
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-blue-600 whitespace-nowrap">
                      #{r.req_no}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="font-semibold text-slate-900">{r.batch_date}</div>
                      <div className="text-[11px] text-slate-400">Shift {r.shift}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900">{r.problem}</div>
                      <div className="text-[11px] text-slate-500">{r.model}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-slate-800">{r.problem_detected_at}</div>
                      <div className="text-[11px] text-slate-400">{r.received_from}</div>
                    </td>
                    <td className="py-3.5 px-3 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 font-bold font-mono text-[10px] border border-amber-200 mr-1">
                        {r.four_m}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 font-bold font-mono text-[10px] border border-blue-200">
                        {r.resp}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {r.status === 'OPEN' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                          OPEN
                        </span>
                      )}
                      {r.status === 'IN_PROGRESS' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                          IN PROGRESS
                        </span>
                      )}
                      {r.status === 'CLOSED' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          CLOSED
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setActiveModalRequest(r)}
                          className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                          title="View Full Report"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {r.status !== 'CLOSED' && (
                          <button
                            onClick={() => handleSignOff(r.id, 'CLOSED')}
                            className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] transition shadow-xs cursor-pointer flex items-center gap-1"
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            Sign-off Close
                          </button>
                        )}
                        {r.status === 'OPEN' && (
                          <button
                            onClick={() => handleSignOff(r.id, 'IN_PROGRESS')}
                            className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200 font-bold text-[11px] transition cursor-pointer"
                          >
                            Mark In Progress
                          </button>
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

      {/* Detail Modal */}
      {activeModalRequest && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  IHLR Report Review: #{activeModalRequest.req_no}
                </h3>
                <p className="text-xs text-slate-500">{activeModalRequest.model} - {activeModalRequest.problem}</p>
              </div>
              <button
                onClick={() => setActiveModalRequest(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div>
                  <span className="text-slate-400 block font-semibold text-[10px] uppercase">Incident Date &amp; Shift</span>
                  <span className="font-bold text-slate-800">{activeModalRequest.batch_date} (Shift {activeModalRequest.shift})</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-semibold text-[10px] uppercase">Rejected Qty</span>
                  <span className="font-bold text-slate-800 font-mono">{activeModalRequest.actual_qty}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-semibold text-[10px] uppercase">Detected Stage</span>
                  <span className="font-bold text-slate-800">{activeModalRequest.problem_detected_at}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-semibold text-[10px] uppercase">Received Line</span>
                  <span className="font-bold text-slate-800">{activeModalRequest.received_from}</span>
                </div>
              </div>

              {/* Defect Image Preview */}
              {activeModalRequest.defect_image && (
                <div>
                  <span className="text-slate-500 block font-bold mb-1 uppercase text-[10px]">Defect Photo Evidence</span>
                  <div className="h-40 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 flex items-center justify-center">
                    <img src={activeModalRequest.defect_image} alt="Defect" className="h-full object-contain" />
                  </div>
                </div>
              )}

              {/* QA 5-Why */}
              <div>
                <span className="text-slate-500 block font-bold mb-1 uppercase text-[10px]">QA Team Why-Why Analysis</span>
                <div className="space-y-1.5 p-3 rounded-xl bg-amber-50/50 border border-amber-200/60">
                  {(activeModalRequest.qa_why_why || []).map((w, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <span className="font-mono font-bold text-rose-600 shrink-0">W{idx + 1}:</span>
                      <span className="text-slate-800 font-medium">{w || '—'}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Countermeasure Action */}
              {activeModalRequest.action && (
                <div>
                  <span className="text-slate-500 block font-bold mb-1 uppercase text-[10px]">Floor Containment Action</span>
                  <p className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-slate-800">
                    {activeModalRequest.action}
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              {activeModalRequest.status !== 'CLOSED' && (
                <button
                  onClick={() => handleSignOff(activeModalRequest.id, 'CLOSED')}
                  className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 shadow-md shadow-emerald-600/20 transition cursor-pointer"
                >
                  Authorize Closure
                </button>
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

export default IhlrApprovals;
