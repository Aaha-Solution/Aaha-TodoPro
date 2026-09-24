import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, 
  AlertCircle, 
  Hourglass, 
  CheckCircle2, 
  Layers, 
  ArrowUpRight,
  Eye,
  X,
  FileText,
  Calendar,
  User,
  Wrench,
  Clock,
  ShieldCheck,
  RefreshCw,
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
import { useAuth } from '../../hooks/useAuth';

const IhlrDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const userDept = (user?.department || (() => {
    try {
      const u = localStorage.getItem('todo_user');
      return u ? JSON.parse(u)?.department : '';
    } catch {
      return '';
    }
  })() || '').trim().toUpperCase();

  const userRole = (user?.role || '').trim().toUpperCase();
  const isIncomingQuality = userDept === 'INCOMING QUALITY';
  const isAdmin = userRole === 'ADMIN' || isIncomingQuality;
  const canCreate = isIncomingQuality || isAdmin;

  const [stats, setStats] = useState({
    total: 0,
    open: 0,
    inProgress: 0,
    closed: 0,
    fourMBreakdown: { MAN: 0, MACHINE: 0, METHOD: 0, MATERIAL: 0 },
    recentRequests: []
  });
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [selectedPreviewAttachment, setSelectedPreviewAttachment] = useState(null);

  // Export State
  const [showExportModal, setShowExportModal] = useState(false);

  // Export to Excel (.xlsx)
  const handleExportExcel = () => {
    try {
      const exportData = (stats.recentRequests || []).map((r, index) => ({
        'SL NO': index + 1,
        'REQ NO': String(r.req_no).startsWith('IHLR-') ? r.req_no : `#${r.req_no}`,
        'DATE': r.batch_date ? r.batch_date.split('T')[0] : '—',
        'SHIFT': String(r.shift || '').startsWith('Shift') ? r.shift : `Shift ${r.shift}`,
        'PROBLEM': r.problem || '—',
        'MODEL': r.model || '—',
        'DETECTED AT': r.problem_detected_at || '—',
        'RECEIVED FROM': r.received_from || '—',
        '4M': r.four_m || '—',
        'RESPONSIBILITY': r.resp || '—',
        'STATUS': r.status || 'OPEN'
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      worksheet['!cols'] = [
        { wch: 8 }, { wch: 12 }, { wch: 14 }, { wch: 12 },
        { wch: 25 }, { wch: 15 }, { wch: 16 }, { wch: 16 },
        { wch: 12 }, { wch: 16 }, { wch: 14 }
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Recent IHLR Reports');
      const today = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(workbook, `IHLR_Recent_Reports_${today}.xlsx`);
      setShowExportModal(false);
    } catch (err) {
      console.error('Failed to export dashboard reports to Excel:', err);
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
      doc.setTextColor(37, 99, 235);
      doc.text('IHLR Overview Dashboard - Recent Analysis Reports', 40, 52);

      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text(
        `Generated: ${today} | Total Active Cases: ${stats.total || 0} | Open: ${stats.open || 0} | In Progress: ${stats.inProgress || 0} | Closed: ${stats.closed || 0}`,
        40,
        68
      );

      const tableHeaders = [
        ['SL', 'REQ NO', 'DATE / SHIFT', 'PROBLEM', 'MODEL', 'STAGE & LINE', '4M', 'RESP', 'STATUS']
      ];

      const tableRows = (stats.recentRequests || []).map((r, idx) => [
        idx + 1,
        String(r.req_no).startsWith('IHLR-') ? r.req_no : `#${r.req_no}`,
        `${r.batch_date ? r.batch_date.split('T')[0] : '—'}\n${String(r.shift || '').startsWith('Shift') ? r.shift : `Shift ${r.shift}`}`,
        r.problem || '—',
        r.model || '—',
        `${r.problem_detected_at || '—'}\n(${r.received_from || 'Line'})`,
        r.four_m || '—',
        r.resp || '—',
        r.status || 'OPEN'
      ]);

      autoTable(doc, {
        head: tableHeaders,
        body: tableRows,
        startY: 80,
        theme: 'grid',
        styles: { fontSize: 8.5, cellPadding: 4, valign: 'middle', overflow: 'linebreak' },
        headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
        columnStyles: {
          0: { cellWidth: 30, halign: 'center' },
          1: { cellWidth: 70, fontStyle: 'bold', halign: 'center' },
          2: { cellWidth: 80 },
          3: { cellWidth: 140 },
          4: { cellWidth: 80 },
          5: { cellWidth: 100 },
          6: { cellWidth: 50, halign: 'center' },
          7: { cellWidth: 80 },
          8: { cellWidth: 60, halign: 'center', fontStyle: 'bold' }
        },
        alternateRowStyles: { fillColor: [248, 250, 252] }
      });

      doc.save(`IHLR_Dashboard_Reports_${today}.pdf`);
      setShowExportModal(false);
    } catch (err) {
      console.error('Failed to export dashboard reports to PDF:', err);
      alert('Failed to export to PDF: ' + err.message);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await ihlrService.getDashboardStats();
      setStats(data);
    } catch (err) {
      console.error('Failed to load IHLR dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const kpis = [
    {
      title: 'Total IHLR Reports',
      value: stats.total || 0,
      subtitle: 'Recorded line rejections',
      icon: Layers,
      iconBg: 'bg-blue-50 text-blue-600',
    },
    {
      title: 'Open Containments',
      value: stats.open || 0,
      subtitle: 'Awaiting root cause closer',
      icon: AlertCircle,
      iconBg: 'bg-rose-50 text-rose-600',
    },
    {
      title: 'In-Progress (Why-Why)',
      value: stats.inProgress || 0,
      subtitle: 'RCA & action review',
      icon: Hourglass,
      iconBg: 'bg-amber-50 text-amber-600',
    },
    {
      title: 'Closed & Contained',
      value: stats.closed || 0,
      subtitle: 'Verified by Quality',
      icon: CheckCircle2,
      iconBg: 'bg-emerald-50 text-emerald-600',
    },
  ];

  const getStatusBadge = (status) => {
    const s = (status || '').toUpperCase();
    if (s === 'OPEN') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
          OPEN
        </span>
      );
    }
    if (s === 'IN_PROGRESS') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          IN PROGRESS
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        CLOSED
      </span>
    );
  };

  return (
    <div className="space-y-6 w-full pb-12">
      {/* Page Title & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
            <span className="text-blue-600 font-bold uppercase tracking-wider font-mono">IHLR PORTAL</span>
            <span>/</span>
            <span>Overview Dashboard</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            IHLR Analysis Dashboard
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            In-House Line Rejection monitoring, 4M root-cause Why-Why tracking, and corrective action containment.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 shadow-2xs transition cursor-pointer"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {canCreate && (
            <button
              onClick={() => navigate('/ihlr/create-request')}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/20 transition transform active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create IHLR Request</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, index) => {
          const Icon = kpi.icon;
          return (
            <div
              key={index}
              className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/90 shadow-2xs flex flex-col justify-between hover:shadow-xs transition"
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">{kpi.title}</span>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${kpi.iconBg}`}>
                  <Icon className="w-5 h-5" />
                </div>
              </div>
              <div>
                <span className="text-3xl font-black text-slate-900 font-mono tracking-tight">{kpi.value}</span>
                <p className="text-[11px] text-slate-400 mt-1 font-medium">{kpi.subtitle}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* 4M Distribution Breakdown Banner */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-extrabold uppercase tracking-widest text-slate-400 font-mono">
            4M CLASSIFICATION DISTRIBUTION
          </span>
          <p className="text-xs text-slate-600 mt-0.5">
            Breakdown of root causes by Man, Machine, Method, and Material.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-200 text-xs font-bold text-blue-700">
            <span>MAN:</span>
            <span className="font-mono text-sm">{stats.fourMBreakdown?.MAN || 0}</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-purple-50 border border-purple-200 text-xs font-bold text-purple-700">
            <span>MACHINE:</span>
            <span className="font-mono text-sm">{stats.fourMBreakdown?.MACHINE || 0}</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-xs font-bold text-amber-700">
            <span>METHOD:</span>
            <span className="font-mono text-sm">{stats.fourMBreakdown?.METHOD || 0}</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-700">
            <span>MATERIAL:</span>
            <span className="font-mono text-sm">{stats.fourMBreakdown?.MATERIAL || 0}</span>
          </div>
        </div>
      </div>

      {/* Recent IHLR Analysis Reports Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">Recent IHLR Analysis Reports</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Live manufacturing rejection cases with Why-Why analysis & closer actions.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowExportModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:border-slate-300 shadow-2xs hover:shadow-xs transition transform active:scale-95 cursor-pointer"
              id="dashboard-export-btn"
            >
              <Download className="w-3.5 h-3.5 text-blue-600" />
              <span>Export View</span>
            </button>
            <button
              onClick={() => navigate('/ihlr/my-requests')}
              className="flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 transition cursor-pointer"
            >
              <span>View All Reports</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#f8fafc] border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3.5 px-4 text-center w-14">SL NO</th>
                <th className="py-3.5 px-4">REQ NO</th>
                <th className="py-3.5 px-4">DATE / SHIFT</th>
                <th className="py-3.5 px-6">PROBLEM &amp; MODEL</th>
                <th className="py-3.5 px-4">STAGE &amp; LINE</th>
                <th className="py-3.5 px-2 text-center w-14">DEFECT</th>
                <th className="py-3.5 px-4 text-center">4M</th>
                <th className="py-3.5 px-4">RESP</th>
                <th className="py-3.5 px-4">STATUS</th>
                <th className="py-3.5 px-6 text-right">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {(stats.recentRequests || []).length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    <AlertCircle className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="font-semibold text-slate-600">No IHLR Reports recorded yet</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Click "Create IHLR Request" to file your first rejection report.</p>
                  </td>
                </tr>
              ) : (
                stats.recentRequests.map((req, index) => (
                  <tr key={req.id} className="hover:bg-slate-50/70 transition-colors">
                    {/* SL NO */}
                    <td className="py-4 px-4 text-center font-mono font-semibold text-slate-500">
                      {index + 1}
                    </td>

                    {/* Req NO */}
                    <td className="py-4 px-4 font-mono font-bold text-blue-600">
                      {String(req.req_no).startsWith('IHLR-') ? req.req_no : `#${req.req_no}`}
                    </td>

                    {/* Date / Shift */}
                    <td className="py-4 px-4">
                      <div className="font-semibold text-slate-900">
                        {req.batch_date ? req.batch_date.split('T')[0] : '—'}
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 font-mono">
                        {String(req.shift || '').startsWith('Shift') ? req.shift : `Shift ${req.shift}`}
                      </span>
                    </td>

                    {/* Problem & Model */}
                    <td className="py-4 px-6">
                      <div className="font-bold text-slate-900">{req.problem}</div>
                      <div className="text-[11px] text-blue-600 font-medium">{req.model}</div>
                    </td>

                    {/* Detected At & Line */}
                    <td className="py-4 px-4">
                      <div className="font-semibold text-slate-800">{req.problem_detected_at}</div>
                      <span className="text-[10px] text-slate-500 font-mono">{req.received_from}</span>
                    </td>

                    {/* Defect Attachment Thumbnail (PDF, Excel, Word, JPG) */}
                    <td className="py-4 px-2 text-center">
                      <div className="flex items-center justify-center">
                        <IhlrAttachmentThumbnail rawAttachment={req.defect_image} />
                      </div>
                    </td>

                    {/* 4M */}
                    <td className="py-4 px-4 text-center">
                      <span className="px-2 py-0.5 rounded-md font-mono text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                        {req.four_m || 'MAN'}
                      </span>
                    </td>

                    {/* Responsibility */}
                    <td className="py-4 px-4 font-mono">
                      <div className="font-bold text-slate-800 text-xs">{req.resp || '-'}</div>
                      {req.resp_person && (
                        <div className="text-[10px] text-blue-600 font-semibold truncate max-w-[120px]" title={req.resp_person}>{req.resp_person}</div>
                      )}
                    </td>

                    {/* Status */}
                    <td className="py-4 px-4">
                      {getStatusBadge(req.status)}
                    </td>

                    {/* View Action */}
                    <td className="py-4 px-6 text-right">
                      <button
                        onClick={() => setSelectedRequest(req)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold text-blue-600 hover:text-blue-700 bg-blue-50/60 hover:bg-blue-100/80 border border-blue-200/60 rounded-lg transition cursor-pointer"
                        title="View Detailed Why-Why Analysis"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Inspect</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inspection Modal (Matching Screenshots 1 & 2) */}
      <IhlrRequestDetailsModal
        isOpen={Boolean(selectedRequest)}
        request={selectedRequest}
        onClose={() => setSelectedRequest(null)}
        onEditMode={() => {
          setSelectedRequest(null);
          navigate('/ihlr/my-requests');
        }}
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
        title="Export Dashboard Summary"
        subtitle="Choose download format for recent reports"
        recordCount={(stats.recentRequests || []).length}
        excelDescription="Download full structured workbook with recent incident details, line rejections, and 4M classification."
        pdfDescription="Official landscape document formatted with India Nippon Electricals Limited branding, tables, and page numbers."
      />
    </div>
  );
};

export default IhlrDashboard;
