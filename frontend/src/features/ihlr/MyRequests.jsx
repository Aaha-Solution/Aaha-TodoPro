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
  Paperclip,
  FileSpreadsheet,
  FileText,
  Check
} from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ihlrService } from '../../services/ihlrService';
import { IhlrAttachmentThumbnail, parseAttachments } from './IhlrAttachmentView';
import IhlrRequestDetailsModal from './IhlrRequestDetailsModal';
import IhlrAttachmentPreviewModal from './IhlrAttachmentPreviewModal';

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
  const [selectedPreviewAttachment, setSelectedPreviewAttachment] = useState(null);

  // Export State
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFormat, setExportFormat] = useState('excel'); // 'excel' | 'pdf'

  // Export to Excel (.xlsx)
  const handleExportExcel = () => {
    try {
      const exportData = requests.map((r, index) => ({
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
        'WHY 2': r.prod_why_why?.[1] || '—',
        'WHY 3': r.prod_why_why?.[2] || '—',
        'WHY 4': r.prod_why_why?.[3] || '—',
        'WHY 5': r.prod_why_why?.[4] || '—',
        'ACTION TAKEN': r.action || '—',
        'TARGET DATE': r.target_date || '—',
        'STATUS': r.status || 'OPEN'
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      worksheet['!cols'] = [
        { wch: 8 },  // SL NO
        { wch: 12 }, // REQ NO
        { wch: 14 }, // DATE
        { wch: 12 }, // SHIFT
        { wch: 25 }, // PROBLEM
        { wch: 15 }, // MODEL
        { wch: 16 }, // DETECTED AT
        { wch: 16 }, // RECEIVED FROM
        { wch: 18 }, // ANALYSIS BY
        { wch: 12 }, // 4M
        { wch: 16 }, // RESPONSIBILITY
        { wch: 20 }, // RESPONSIBLE PERSON
        { wch: 28 }, // WHY 1
        { wch: 25 }, // WHY 2
        { wch: 25 }, // WHY 3
        { wch: 25 }, // WHY 4
        { wch: 25 }, // WHY 5
        { wch: 30 }, // ACTION TAKEN
        { wch: 14 }, // TARGET DATE
        { wch: 14 }  // STATUS
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'IHLR Analysis Log');
      const today = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(workbook, `IHLR_Analysis_Report_${today}.xlsx`);
      setShowExportModal(false);
    } catch (err) {
      console.error('Failed to export to Excel:', err);
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
      doc.setTextColor(30, 41, 59); // slate-800
      doc.text('INDIA NIPPON ELECTRICALS LIMITED', 40, 36);

      doc.setFontSize(11);
      doc.setTextColor(37, 99, 235); // blue-600
      doc.text('IHLR Analysis Log & Rejection Reports', 40, 52);

      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139); // slate-500
      doc.text(
        `Generated: ${today} | Total Records: ${requests.length} | Shift: ${selectedShift} | 4M: ${selected4M} | Status: ${selectedStatus}`,
        40,
        68
      );

      const tableHeaders = [
        [
          'SL',
          'REQ NO',
          'DATE / SHIFT',
          'PROBLEM',
          'MODEL',
          'DETECTED AT',
          'FROM',
          'ANALYSIS BY',
          '4M',
          'RESP / IN-CHARGE',
          'OCCURRENCE CAUSE',
          'ACTION TAKEN',
          'STATUS'
        ]
      ];

      const tableRows = requests.map((r, idx) => [
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
        r.prod_why_why?.[0] || '—',
        r.action || '—',
        r.status || 'OPEN'
      ]);

      autoTable(doc, {
        head: tableHeaders,
        body: tableRows,
        startY: 80,
        theme: 'grid',
        styles: {
          fontSize: 8,
          cellPadding: 4,
          valign: 'middle',
          overflow: 'linebreak'
        },
        headStyles: {
          fillColor: [30, 41, 59], // Dark slate header
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          halign: 'center'
        },
        columnStyles: {
          0: { cellWidth: 25, halign: 'center' },
          1: { cellWidth: 55, fontStyle: 'bold', halign: 'center' },
          2: { cellWidth: 68 },
          3: { cellWidth: 95 },
          4: { cellWidth: 48 },
          5: { cellWidth: 62 },
          6: { cellWidth: 58 },
          7: { cellWidth: 65 },
          8: { cellWidth: 42, halign: 'center' },
          9: { cellWidth: 68 },
          10: { cellWidth: 95 },
          11: { cellWidth: 95 },
          12: { cellWidth: 48, halign: 'center', fontStyle: 'bold' }
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252] // slate-50
        },
        didDrawPage: (data) => {
          const pageCount = doc.internal.getNumberOfPages();
          doc.setFontSize(8);
          doc.setTextColor(148, 163, 184);
          doc.text(
            `Page ${data.pageNumber} of ${pageCount}`,
            doc.internal.pageSize.width - 80,
            doc.internal.pageSize.height - 20
          );
        }
      });

      doc.save(`IHLR_Analysis_Report_${today}.pdf`);
      setShowExportModal(false);
    } catch (err) {
      console.error('Failed to export to PDF:', err);
      alert('Failed to export to PDF: ' + err.message);
    }
  };

  const handleDownload = () => {
    if (exportFormat === 'excel') {
      handleExportExcel();
    } else {
      handleExportPdf();
    }
  };

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
            onClick={() => setShowExportModal(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:border-slate-300 shadow-2xs hover:shadow-xs transition transform active:scale-95 cursor-pointer"
            id="export-view-btn"
          >
            <Download className="w-4 h-4 text-blue-600" />
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
                      <div className="font-semibold text-slate-900">
                        {r.batch_date ? r.batch_date.split('T')[0] : '—'}
                      </div>
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

                    {/* Defect Attachment Thumbnail */}
                    <td className="py-3.5 px-2 text-center">
                      <div className="flex items-center justify-center">
                        <IhlrAttachmentThumbnail
                          rawAttachment={r.defect_image}
                          onClick={() => {
                            const atts = parseAttachments(r.defect_image);
                            if (atts.length > 0) {
                              setSelectedPreviewAttachment(atts[0]);
                            } else {
                              setActiveModalRequest(r);
                            }
                          }}
                        />
                      </div>
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

      {/* Complete Inspection Modal (Matching Screenshots 1 & 2) */}
      <IhlrRequestDetailsModal
        isOpen={Boolean(activeModalRequest)}
        request={activeModalRequest}
        onClose={() => setActiveModalRequest(null)}
        onEditMode={(req) => {
          setActiveModalRequest(null);
          setEditingCloser(req);
        }}
      />

      {/* Standalone Attachment Preview Modal (when clicking table thumbnail directly) */}
      <IhlrAttachmentPreviewModal
        isOpen={Boolean(selectedPreviewAttachment)}
        attachment={selectedPreviewAttachment}
        onClose={() => setSelectedPreviewAttachment(null)}
      />

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

      {/* Export Format Selection Modal */}
      {showExportModal && (
        <div 
          className="fixed inset-0 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
          style={{ zIndex: 99999 }}
          onClick={(e) => {
            e.stopPropagation();
            setShowExportModal(false);
          }}
        >
          <div 
            className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-slate-200 p-6 space-y-5 animate-in zoom-in-95 duration-200 relative"
            style={{ zIndex: 100000 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-blue-50 text-blue-600 border border-blue-100">
                  <Download className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                    Export Analysis Report
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Choose download format for current view
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowExportModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scope Summary Pill */}
            <div className="flex items-center justify-between px-3.5 py-2.5 bg-slate-50 rounded-xl border border-slate-100 text-xs">
              <span className="text-slate-500 font-medium">Filtered Scope</span>
              <span className="font-extrabold text-blue-600 font-mono">
                {requests.length} Records
              </span>
            </div>

            {/* Selection Options */}
            <div className="space-y-3">
              {/* Option 1: Excel (.xlsx) */}
              <div
                onClick={() => setExportFormat('excel')}
                className={`flex items-start gap-3.5 p-4 rounded-2xl border-2 transition cursor-pointer ${
                  exportFormat === 'excel'
                    ? 'border-emerald-500 bg-emerald-50/40 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="p-2.5 rounded-xl bg-emerald-100 text-emerald-700 shrink-0">
                  <FileSpreadsheet className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-slate-900 text-sm">
                      Excel Spreadsheet (.xlsx)
                    </span>
                    {exportFormat === 'excel' ? (
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-600 text-white shadow-xs">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </span>
                    ) : (
                      <span className="w-5 h-5 rounded-full border border-slate-300" />
                    )}
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Full structured workbook with separate columns for 5-Why root-causes, containment actions, and target dates.
                  </p>
                </div>
              </div>

              {/* Option 2: PDF (.pdf) */}
              <div
                onClick={() => setExportFormat('pdf')}
                className={`flex items-start gap-3.5 p-4 rounded-2xl border-2 transition cursor-pointer ${
                  exportFormat === 'pdf'
                    ? 'border-rose-500 bg-rose-50/40 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="p-2.5 rounded-xl bg-rose-100 text-rose-700 shrink-0">
                  <FileText className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-slate-900 text-sm">
                      PDF Document (.pdf)
                    </span>
                    {exportFormat === 'pdf' ? (
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-rose-600 text-white shadow-xs">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </span>
                    ) : (
                      <span className="w-5 h-5 rounded-full border border-slate-300" />
                    )}
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Official landscape document formatted with India Nippon Electricals Limited branding, tables, and page numbers.
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowExportModal(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDownload}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-xs font-bold transition shadow-md active:scale-95 cursor-pointer ${
                  exportFormat === 'excel'
                    ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
                    : 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20'
                }`}
              >
                <Download className="w-4 h-4" />
                <span>
                  Download {exportFormat === 'excel' ? 'Excel (.xlsx)' : 'PDF (.pdf)'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default IhlrMyRequests;
