import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Download,
  Search,
  Filter,
  Eye,
  X,
  AlertCircle,
  CheckCircle2,
  Hourglass,
  Layers,
  Plus,
  RefreshCw,
  Edit2,
  Trash2,
  ExternalLink,
  ChevronDown,
  Paperclip
} from 'lucide-react';
import { ihlrService } from '../../services/ihlrService';

const IhlrMyRequests = () => {
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedShift, setSelectedShift] = useState('All');
  const [selected4M, setSelected4M] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');

  // Modal State
  const [activeModalRequest, setActiveModalRequest] = useState(null);
  const [editingCloser, setEditingCloser] = useState(null);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const data = await ihlrService.getRequests({
        search: search || undefined,
        shift: selectedShift !== 'All' ? selectedShift : undefined,
        fourM: selected4M !== 'All' ? selected4M : undefined,
        status: selectedStatus !== 'All' ? selectedStatus : undefined
      });
      setRequests(data);
    } catch (err) {
      console.error('Failed to fetch IHLR requests:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [search, selectedShift, selected4M, selectedStatus]);

  const handleUpdateStatus = async (id, newStatus, actionUpdate) => {
    try {
      await ihlrService.updateRequest(id, {
        status: newStatus,
        action: actionUpdate !== undefined ? actionUpdate : undefined
      });
      fetchRequests();
      if (activeModalRequest && activeModalRequest.id === id) {
        setActiveModalRequest(prev => ({ ...prev, status: newStatus, action: actionUpdate || prev.action }));
      }
      setEditingCloser(null);
    } catch (err) {
      alert('Failed to update status: ' + err.message);
    }
  };

  const handleDelete = async (id, reqNo) => {
    if (window.confirm(`Are you sure you want to delete IHLR report #${reqNo}?`)) {
      try {
        await ihlrService.deleteRequest(id);
        fetchRequests();
        if (activeModalRequest?.id === id) setActiveModalRequest(null);
      } catch (err) {
        alert('Failed to delete report: ' + err.message);
      }
    }
  };

  const getStatusBadge = (status) => {
    const s = (status || '').toUpperCase();
    if (s === 'OPEN') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200 whitespace-nowrap">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
          OPEN
        </span>
      );
    }
    if (s === 'IN_PROGRESS') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200 whitespace-nowrap">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          IN PROGRESS
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        CLOSED
      </span>
    );
  };

  return (
    <div className="space-y-6 w-full pb-16">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
            <span className="text-blue-600 font-bold uppercase tracking-wider font-mono">IHLR REPOSITORY</span>
            <span>/</span>
            <span>Analysis Reports</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            IHLR Analysis Log &amp; Reports
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Comprehensive spreadsheet view of in-house line rejections, 5-Why root-causes, and containment actions.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/ihlr/create-request')}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/20 transition transform active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Report</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-2xs space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
          {/* Search */}
          <div className="lg:col-span-2 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
            <input
              type="text"
              placeholder="Search problem, model, line, inspector, or Req#..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none font-medium"
            />
          </div>

          {/* Shift Filter */}
          <div>
            <select
              value={selectedShift}
              onChange={(e) => setSelectedShift(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-semibold focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
            >
              <option value="All">All Shifts</option>
              <option value="Shift 1">Shift 1</option>
              <option value="Shift 2">Shift 2</option>
              <option value="Shift 3">Shift 3</option>
            </select>
          </div>

          {/* 4M Filter */}
          <div>
            <select
              value={selected4M}
              onChange={(e) => setSelected4M(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-semibold focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
            >
              <option value="All">All 4M Categories</option>
              <option value="MAN">MAN</option>
              <option value="MACHINE">MACHINE</option>
              <option value="METHOD">METHOD</option>
              <option value="MATERIAL">MATERIAL</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-semibold focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
            >
              <option value="All">All Statuses</option>
              <option value="OPEN">OPEN (Containment Required)</option>
              <option value="IN_PROGRESS">IN PROGRESS</option>
              <option value="CLOSED">CLOSED (Resolved)</option>
            </select>
          </div>
        </div>
      </div>

      {/* IHLR Analysis Report Master Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-extrabold uppercase tracking-widest text-slate-600 font-mono">
              SEP'26 IHLR- ANALYSIS REPORT
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 font-mono">
              {requests.length} Records
            </span>
          </div>
          <button
            onClick={() => window.print()}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export View</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1100px]">
            <thead>
              {/* Top Phase Header Row */}
              <tr className="text-[10px] font-black uppercase tracking-wider text-center border-b border-slate-200">
                <th colSpan={10} className="py-2 px-4 bg-amber-100 text-amber-900 border-r border-amber-200">
                  REQUESTOR (Defect Investigation &amp; QA 5-Why)
                </th>
                <th colSpan={3} className="py-2 px-4 bg-orange-100 text-orange-900 border-r border-orange-200">
                  CLOSER (Production Containment)
                </th>
                <th colSpan={2} className="py-2 px-4 bg-slate-100 text-slate-700">
                  REMARKS &amp; STATUS
                </th>
              </tr>
              {/* Detailed Column Header Row */}
              <tr className="bg-[#f8fafc] border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3 px-3 text-center w-12">SL NO</th>
                <th className="py-3 px-3">REQ NO</th>
                <th className="py-3 px-3">DATE / SHIFT</th>
                <th className="py-3 px-4">PROBLEM</th>
                <th className="py-3 px-3">MODEL</th>
                <th className="py-3 px-3">DETECTED AT</th>
                <th className="py-3 px-3">RECEIVED FROM</th>
                <th className="py-3 px-3">ANALYSIS BY</th>
                <th className="py-3 px-2 text-center w-12">DEFECT</th>
                <th className="py-3 px-2 text-center">4M / RESP</th>
                <th className="py-3 px-4">OCCURRENCE CAUSE</th>
                <th className="py-3 px-4">ACTION TAKEN</th>
                <th className="py-3 px-3">TARGET DATE</th>
                <th className="py-3 px-3">STATUS</th>
                <th className="py-3 px-3 text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {requests.length === 0 ? (
                <tr>
                  <td colSpan={15} className="py-12 text-center text-slate-400">
                    <AlertCircle className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="font-semibold text-slate-600">No IHLR Reports match your filter</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Try resetting search parameters or create a new request.</p>
                  </td>
                </tr>
              ) : (
                requests.map((r, index) => (
                  <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* SL NO */}
                    <td className="py-3.5 px-3 text-center font-mono font-semibold text-slate-400">
                      {index + 1}
                    </td>

                    {/* Req NO */}
                    <td className="py-3.5 px-3 font-mono font-bold text-blue-600 whitespace-nowrap">
                      {String(r.req_no).startsWith('IHLR-') ? r.req_no : `#${r.req_no}`}
                    </td>

                    {/* Date / Shift */}
                    <td className="py-3.5 px-3 whitespace-nowrap">
                      <div className="font-semibold text-slate-900">{r.batch_date}</div>
                      <span className="text-[10px] font-bold text-slate-400 font-mono">
                        {String(r.shift || '').startsWith('Shift') ? r.shift : `Shift ${r.shift}`}
                      </span>
                    </td>

                    {/* Problem */}
                    <td className="py-3.5 px-4 font-semibold text-slate-900 min-w-[150px]">
                      {r.problem}
                    </td>

                    {/* Model */}
                    <td className="py-3.5 px-3 font-bold text-blue-700 whitespace-nowrap">
                      {r.model}
                    </td>

                    {/* Problem Detected At */}
                    <td className="py-3.5 px-3 text-slate-700">
                      {r.problem_detected_at}
                    </td>

                    {/* Received From */}
                    <td className="py-3.5 px-3 font-mono text-slate-600">
                      {r.received_from}
                    </td>

                    {/* Analysis Done By */}
                    <td className="py-3.5 px-3 font-medium text-slate-800">
                      {r.analysis_done_by}
                    </td>

                    {/* Defect Image Thumbnail */}
                    <td className="py-3.5 px-2 text-center">
                      {r.defect_image ? (
                        <div 
                          onClick={() => setActiveModalRequest(r)}
                          className="w-8 h-8 rounded-lg overflow-hidden border border-slate-200 cursor-pointer hover:opacity-80 transition inline-block"
                          title="Click to view full image"
                        >
                          <img src={r.defect_image} alt="Defect" className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <span className="text-slate-300 text-[10px]">—</span>
                      )}
                    </td>

                    {/* 4M & Resp */}
                    <td className="py-3.5 px-2 text-center whitespace-nowrap">
                      <div className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold font-mono bg-amber-50 text-amber-800 border border-amber-200 mb-0.5">
                        {r.four_m || 'MAN'}
                      </div>
                      <div className="text-[10px] font-bold text-slate-600 font-mono">
                        {r.resp || '-'}
                      </div>
                      {r.resp_person && (
                        <div className="text-[9px] text-blue-600 font-semibold truncate max-w-[110px]" title={r.resp_person}>
                          {r.resp_person}
                        </div>
                      )}
                    </td>

                    {/* Occurrence Cause (First Why) */}
                    <td className="py-3.5 px-4 text-slate-600 max-w-[160px] truncate" title={r.prod_why_why?.[0]}>
                      {r.prod_why_why?.[0] || '—'}
                    </td>

                    {/* Action Taken */}
                    <td className="py-3.5 px-4 text-slate-800 font-medium max-w-[180px] truncate" title={r.action}>
                      {r.action || '—'}
                    </td>

                    {/* Target Date */}
                    <td className="py-3.5 px-3 text-slate-600 font-mono text-[11px] whitespace-nowrap">
                      {r.target_date || '—'}
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-3">
                      {getStatusBadge(r.status)}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setActiveModalRequest(r)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                          title="View Complete Report"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setEditingCloser(r)}
                          className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                          title="Update Containment & Status"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(r.id, r.req_no)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                          title="Delete Report"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Complete Inspection Modal */}
      {activeModalRequest && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur-xs z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-black text-xs font-mono px-1 text-center">
                  {String(activeModalRequest.req_no).startsWith('IHLR-') ? activeModalRequest.req_no : `#${activeModalRequest.req_no}`}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    IHLR Analysis File: {activeModalRequest.model}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Defect: <strong className="text-slate-800">{activeModalRequest.problem}</strong> • Date: {activeModalRequest.batch_date} (Shift {activeModalRequest.shift})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveModalRequest(null)}
                className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6">
              {/* Requestor Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-2xl bg-amber-50/40 border border-amber-200/60 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px] font-bold uppercase">4M CLASSIFICATION</span>
                  <span className="font-bold text-amber-800 font-mono">{activeModalRequest.four_m}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] font-bold uppercase">RESPONSIBILITY</span>
                  <span className="font-bold text-slate-900 font-mono">{activeModalRequest.resp}</span>
                  {activeModalRequest.resp_person && (
                    <span className="block text-[11px] font-medium text-blue-600 mt-0.5">{activeModalRequest.resp_person}</span>
                  )}
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] font-bold uppercase">DETECTED AT</span>
                  <span className="font-bold text-slate-900">{activeModalRequest.problem_detected_at}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] font-bold uppercase">RECEIVED FROM</span>
                  <span className="font-bold text-slate-900 font-mono">{activeModalRequest.received_from}</span>
                </div>
              </div>

              {/* Defect Photo & Evidence */}
              {activeModalRequest.defect_image && (
                <div className="space-y-2">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                    Defect Photographic Evidence
                  </span>
                  <div className="rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 max-h-72 flex items-center justify-center">
                    <img
                      src={activeModalRequest.defect_image}
                      alt="Defect"
                      className="w-full h-full object-contain max-h-72"
                    />
                  </div>
                </div>
              )}

              {/* Side-by-Side 5-Why Analysis */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* QA Why-Why */}
                <div className="p-4 rounded-2xl bg-amber-50/40 border border-amber-200/80 space-y-3">
                  <div className="flex items-center gap-2 pb-2 border-b border-amber-200/60">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                      QA Problem Cause (Why-Why Analysis)
                    </h4>
                  </div>
                  <div className="space-y-2 text-xs">
                    {(activeModalRequest.qa_why_why || []).map((w, idx) => (
                      w ? (
                        <div key={idx} className="flex items-start gap-2">
                          <span className="font-mono font-bold text-amber-700 shrink-0">W{idx + 1}:</span>
                          <span className="text-slate-800">{w}</span>
                        </div>
                      ) : null
                    ))}
                  </div>
                </div>

                {/* Production Occurrence Why-Why */}
                <div className="p-4 rounded-2xl bg-blue-50/40 border border-blue-200/80 space-y-3">
                  <div className="flex items-center gap-2 pb-2 border-b border-blue-200/60">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                      Production Occurrence Cause (Why-Why)
                    </h4>
                  </div>
                  <div className="space-y-2 text-xs">
                    {(activeModalRequest.prod_why_why || []).map((w, idx) => (
                      w ? (
                        <div key={idx} className="flex items-start gap-2">
                          <span className="font-mono font-bold text-blue-700 shrink-0">W{idx + 1}:</span>
                          <span className="text-slate-800">{w}</span>
                        </div>
                      ) : null
                    ))}
                  </div>
                </div>
              </div>

              {/* Action Taken & Remarks */}
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                  Containment Action &amp; Target Closure
                </h4>
                <div className="text-xs text-slate-800 leading-relaxed">
                  <span className="font-bold text-slate-900">Action: </span>
                  {activeModalRequest.action || 'No action recorded yet.'}
                </div>
                {activeModalRequest.remarks && (
                  <div className="text-xs text-slate-600 leading-relaxed border-t border-slate-200/60 pt-2">
                    <span className="font-bold text-slate-900">Remarks: </span>
                    {activeModalRequest.remarks}
                  </div>
                )}
                {activeModalRequest.evidence_attachment && (
                  <div className="flex items-center gap-2 text-xs text-blue-600 pt-2 border-t border-slate-200/60">
                    <Paperclip className="w-3.5 h-3.5" />
                    <span>Evidence Attached: <strong>{activeModalRequest.evidence_attachment}</strong></span>
                  </div>
                )}
                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-3 border-t border-slate-200/60">
                  <span>Target Date: <strong className="text-slate-900">{activeModalRequest.target_date || 'N/A'}</strong></span>
                  <div className="flex items-center gap-2">
                    <span>Status:</span>
                    {getStatusBadge(activeModalRequest.status)}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-5 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
              <button
                onClick={() => {
                  const target = activeModalRequest;
                  setActiveModalRequest(null);
                  setEditingCloser(target);
                }}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition cursor-pointer"
              >
                Update Containment &amp; Status
              </button>

              <button
                onClick={() => setActiveModalRequest(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Closer & Status Modal */}
      {editingCloser && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-slate-200 p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                Update Report {String(editingCloser.req_no).startsWith('IHLR-') ? editingCloser.req_no : `#${editingCloser.req_no}`}
              </h3>
              <button
                onClick={() => setEditingCloser(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1 text-[11px]">
                  Status
                </label>
                <select
                  defaultValue={editingCloser.status}
                  id="modal-status-select"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 outline-none"
                >
                  <option value="OPEN">OPEN (Containment Required)</option>
                  <option value="IN_PROGRESS">IN PROGRESS (Why-Why Review)</option>
                  <option value="CLOSED">CLOSED (Verified &amp; Resolved)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1 text-[11px]">
                  Action Countermeasure
                </label>
                <textarea
                  rows={3}
                  defaultValue={editingCloser.action}
                  id="modal-action-text"
                  placeholder="Describe corrective actions performed..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingCloser(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const s = document.getElementById('modal-status-select').value;
                  const a = document.getElementById('modal-action-text').value;
                  handleUpdateStatus(editingCloser.id, s, a);
                }}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-sm cursor-pointer"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default IhlrMyRequests;
