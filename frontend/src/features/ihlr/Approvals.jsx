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
  ExternalLink,
  Download,
  FileSpreadsheet,
  Check,
  Paperclip
} from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ihlrService } from '../../services/ihlrService';
import { IhlrAttachmentThumbnail, parseAttachments } from './IhlrAttachmentView';
import IhlrRequestDetailsModal from './IhlrRequestDetailsModal';
import IhlrAttachmentPreviewModal from './IhlrAttachmentPreviewModal';
import ExportSelectionModal from '../../components/common/ExportSelectionModal';

const IhlrApprovals = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [activeModalRequest, setActiveModalRequest] = useState(null);
  const [selectedPreviewAttachment, setSelectedPreviewAttachment] = useState(null);

  // Export State
  const [showExportModal, setShowExportModal] = useState(false);

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
      (r.req_no || '').toLowerCase().includes(search.toLowerCase()) ||
      (r.problem || '').toLowerCase().includes(search.toLowerCase()) ||
      (r.model || '').toLowerCase().includes(search.toLowerCase()) ||
      (r.received_from || '').toLowerCase().includes(search.toLowerCase()) ||
      (r.analysis_done_by || '').toLowerCase().includes(search.toLowerCase());
    const matchesStatus = selectedStatus === 'All' || r.status === selectedStatus;
    return matchesSearch && matchesStatus;
  });

  // Export to Excel (.xlsx)
  const handleExportExcel = () => {
    try {
      const exportData = filtered.map((r, index) => ({
        'SL NO': index + 1,
        'REQ NO': String(r.req_no).startsWith('IHLR-') ? r.req_no : `#${r.req_no}`,
        'DATE': r.batch_date ? r.batch_date.split('T')[0] : '—',
        'SHIFT': String(r.shift || '').startsWith('Shift') ? r.shift : `Shift ${r.shift}`,
        'PROBLEM': r.problem || '—',
        'MODEL': r.model || '—',
        'DETECTED AT': r.problem_detected_at || '—',
        'RECEIVED FROM': r.received_from || '—',
        'ANALYSIS BY': r.analysis_done_by || '—',
        '4M': r.four_m || '—',
        'RESPONSIBILITY': r.resp || '—',
        'RESPONSIBLE PERSON': r.resp_person || '—',
        'OCCURRENCE CAUSE (WHY 1)': r.prod_why_why?.[0] || '—',
        'ACTION TAKEN': r.action || '—',
        'TARGET DATE': r.target_date || '—',
        'STATUS': r.status || 'OPEN'
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      worksheet['!cols'] = [
        { wch: 8 }, { wch: 12 }, { wch: 14 }, { wch: 12 },
        { wch: 25 }, { wch: 15 }, { wch: 16 }, { wch: 16 },
        { wch: 18 }, { wch: 12 }, { wch: 16 }, { wch: 20 },
        { wch: 28 }, { wch: 30 }, { wch: 14 }, { wch: 14 }
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'IHLR Approvals Queue');
      const today = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(workbook, `IHLR_Approvals_Queue_${today}.xlsx`);
      setShowExportModal(false);
    } catch (err) {
      console.error('Failed to export approvals to Excel:', err);
      alert('Failed to export to Excel: ' + err.message);
    }
  };

  // Export to PDF (.pdf)
  const handleExportPdf = () => {
    try {
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'pt',
        format: 'a4'
      });

      const today = new Date().toISOString().slice(0, 10);

      // Top Title and Company Branding
      doc.setFontSize(16);
      doc.setTextColor(30, 41, 59);
      doc.text('INDIA NIPPON ELECTRICALS LIMITED', 40, 36);

      doc.setFontSize(11);
      doc.setTextColor(217, 119, 6); // amber-600
      doc.text('IHLR Sign-off & Closure Approvals Queue', 40, 52);

      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text(`Generated: ${today} | Total Queue Records: ${filtered.length} | Status Filter: ${selectedStatus}`, 40, 68);

      const tableHeaders = [
        ['SL', 'REQ NO', 'DATE / SHIFT', 'PROBLEM', 'MODEL', 'DETECTED AT', 'FROM', 'ANALYSIS BY', '4M', 'RESP', 'STATUS']
      ];

      const tableRows = filtered.map((r, idx) => [
        idx + 1,
        String(r.req_no).startsWith('IHLR-') ? r.req_no : `#${r.req_no}`,
        `${r.batch_date ? r.batch_date.split('T')[0] : '—'}\n${String(r.shift || '').startsWith('Shift') ? r.shift : `Shift ${r.shift}`}`,
        r.problem || '—',
        r.model || '—',
        r.problem_detected_at || '—',
        r.received_from || '—',
        r.analysis_done_by || '—',
        r.four_m || '—',
        `${r.resp || '—'}${r.resp_person ? `\n(${r.resp_person})` : ''}`,
        r.status || 'OPEN'
      ]);

      autoTable(doc, {
        head: tableHeaders,
        body: tableRows,
        startY: 80,
        theme: 'grid',
        styles: { fontSize: 8.5, cellPadding: 4, valign: 'middle', overflow: 'linebreak' },
        headStyles: { fillColor: [180, 83, 9], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
        columnStyles: {
          0: { cellWidth: 30, halign: 'center' },
          1: { cellWidth: 65, fontStyle: 'bold', halign: 'center' },
          2: { cellWidth: 75 },
          3: { cellWidth: 120 },
          4: { cellWidth: 60 },
          5: { cellWidth: 75 },
          6: { cellWidth: 70 },
          7: { cellWidth: 75 },
          8: { cellWidth: 50, halign: 'center' },
          9: { cellWidth: 80 },
          10: { cellWidth: 55, halign: 'center', fontStyle: 'bold' }
        },
        alternateRowStyles: { fillColor: [254, 252, 232] }
      });

      doc.save(`IHLR_Approvals_Queue_${today}.pdf`);
      setShowExportModal(false);
    } catch (err) {
      console.error('Failed to export approvals to PDF:', err);
      alert('Failed to export to PDF: ' + err.message);
    }
  };

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
          <button
            onClick={() => setShowExportModal(true)}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:border-slate-300 shadow-2xs hover:shadow-xs transition transform active:scale-95 cursor-pointer"
            id="approvals-export-btn"
          >
            <Download className="w-3.5 h-3.5 text-amber-600" />
            <span>Export View</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[950px]">
            <thead>
              <tr className="bg-[#f8fafc] border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3 px-4">REQ NO</th>
                <th className="py-3 px-4">DATE / SHIFT</th>
                <th className="py-3 px-4">PROBLEM &amp; MODEL</th>
                <th className="py-3 px-4">DETECTED / FROM</th>
                <th className="py-3 px-2 text-center w-14">DEFECT</th>
                <th className="py-3 px-3">4M / RESP</th>
                <th className="py-3 px-4">STATUS</th>
                <th className="py-3 px-4 text-right">SIGN-OFF ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    Loading approval queue...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <ClipboardCheck className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="font-semibold text-slate-600">No reports found matching criteria</p>
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-blue-600 whitespace-nowrap">
                      {String(r.req_no).startsWith('IHLR-') ? r.req_no : `#${r.req_no}`}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="font-semibold text-slate-900">
                        {r.batch_date ? r.batch_date.split('T')[0] : '—'}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        {String(r.shift || '').startsWith('Shift') ? r.shift : `Shift ${r.shift}`}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900">{r.problem}</div>
                      <div className="text-[11px] text-slate-500">{r.model}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-slate-800">{r.problem_detected_at}</div>
                      <div className="text-[11px] text-slate-400">{r.received_from}</div>
                    </td>
                    {/* Defect Attachment Thumbnail (PDF, Excel, Word, JPG) */}
                    <td className="py-3.5 px-2 text-center">
                      <div className="flex items-center justify-center">
                        <IhlrAttachmentThumbnail rawAttachment={r.defect_image} />
                      </div>
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

      {/* Detail Modal (Matching Screenshots 1 & 2) */}
      <IhlrRequestDetailsModal
        isOpen={Boolean(activeModalRequest)}
        request={activeModalRequest}
        onClose={() => setActiveModalRequest(null)}
      />

      {/* Standalone Attachment Preview Modal (Works for Excel, PDF, Word, Images) */}
      <IhlrAttachmentPreviewModal
        isOpen={Boolean(selectedPreviewAttachment)}
        attachment={selectedPreviewAttachment}
        onClose={() => setSelectedPreviewAttachment(null)}
      />

      {/* Universal Export Format Selection Modal */}
      <ExportSelectionModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        onExportExcel={handleExportExcel}
        onExportPdf={handleExportPdf}
        title="Export Approval Queue"
        subtitle="Choose download format for approvals view"
        recordCount={filtered.length}
        excelDescription="Full structured workbook with separate columns for incident details, 4M categorization, and containment actions."
        pdfDescription="Official landscape document formatted with India Nippon Electricals Limited branding, tables, and page numbers."
      />
    </div>
  );
};

export default IhlrApprovals;
