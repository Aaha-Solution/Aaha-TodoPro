import React, { useState } from 'react';
import { 
  Eye, 
  X, 
  Folder, 
  FileText, 
  Paperclip, 
  Download, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  ShieldCheck,
  Calendar,
  Layers,
  Wrench,
  UserCheck,
  FileSpreadsheet,
  Check
} from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { parseAttachments, getFileMeta } from './IhlrAttachmentView';
import IhlrAttachmentPreviewModal from './IhlrAttachmentPreviewModal';
import ExportSelectionModal from '../../components/common/ExportSelectionModal';

/**
 * Meaningful IHLR (In-House Line Rejection) Inspection & Analysis Report Modal:
 * - Direct, single-scroll layout without confusing CMS/L1/L2/L3 terms
 * - Section 1: Incident & Line Defect Details
 * - Section 2: Defect Problem Description
 * - Section 3: Attachments & Technical Evidence (Images, PDF, Excel, Word)
 * - Section 4: 5-Why Cause Analysis (QA Problem Cause & Production Occurrence Cause)
 * - Section 5: Containment Countermeasure & Target Closure
 */
const IhlrRequestDetailsModal = ({ isOpen, request, onClose, onEditMode }) => {
  const [previewAttachment, setPreviewAttachment] = useState(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFormat, setExportFormat] = useState('excel'); // 'excel' | 'pdf'

  if (!isOpen || !request) return null;

  const attachments = parseAttachments(request.defect_image);

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toISOString().split('T')[0];
    } catch {
      return dateStr;
    }
  };

  const formatShift = (shift) => {
    if (!shift) return 'Shift 1';
    const str = String(shift).trim();
    if (str.toLowerCase().startsWith('shift')) return str;
    return `Shift ${str}`;
  };

  const getStatusBadge = (status) => {
    const s = (status || 'OPEN').toUpperCase();
    if (s === 'CLOSED' || s === 'APPROVED') {
      return (
        <span className="px-3 py-0.5 rounded-full text-xs font-semibold border border-emerald-500 text-emerald-700 bg-emerald-50/70 inline-flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
          <span>Closed</span>
        </span>
      );
    }
    if (s === 'IN_PROGRESS' || s === 'UNDER_REVIEW') {
      return (
        <span className="px-3 py-0.5 rounded-full text-xs font-semibold border border-blue-400 text-blue-700 bg-blue-50/70 inline-flex items-center gap-1">
          <Clock className="w-3 h-3 text-blue-600" />
          <span>In Progress</span>
        </span>
      );
    }
    return (
      <span className="px-3 py-0.5 rounded-full text-xs font-semibold border border-amber-400 text-amber-800 bg-amber-50/70 inline-flex items-center gap-1">
        <AlertCircle className="w-3 h-3 text-amber-600" />
        <span>Open</span>
      </span>
    );
  };

  // Export this single report to Excel (.xlsx)
  const handleExportExcel = () => {
    try {
      const reqNo = String(request.req_no || '').startsWith('IHLR-') ? request.req_no : `#${request.req_no}`;
      const batchDate = formatDate(request.batch_date);
      const shiftStr = formatShift(request.shift);

      const data = [
        { Field: 'REPORT NUMBER', Value: reqNo },
        { Field: 'COMPANY', Value: 'India Nippon Electricals Limited' },
        { Field: 'BATCH / DEFECT DATE', Value: batchDate },
        { Field: 'SHIFT', Value: shiftStr },
        { Field: 'CURRENT STATUS', Value: request.status || 'OPEN' },
        { Field: 'MODEL / PART', Value: request.model || '—' },
        { Field: 'DEFECT DETECTED AT', Value: request.problem_detected_at || '—' },
        { Field: 'RECEIVED FROM (LINE)', Value: request.received_from || '—' },
        { Field: 'ANALYSIS DONE BY', Value: request.analysis_done_by || '—' },
        { Field: '4M CLASSIFICATION', Value: request.four_m || '—' },
        { Field: 'RESPONSIBLE DEPT', Value: request.resp || '—' },
        { Field: 'RESPONSIBLE IN-CHARGE', Value: request.resp_person || '—' },
        { Field: 'DEFECT PROBLEM / PHENOMENON', Value: request.problem || '—' },
        { Field: 'DETAILED OBSERVATION', Value: request.problem_description || request.detailed_observation || '—' },
        { Field: 'QA 5-WHY: WHY 1', Value: request.why_why?.[0] || '—' },
        { Field: 'QA 5-WHY: WHY 2', Value: request.why_why?.[1] || '—' },
        { Field: 'QA 5-WHY: WHY 3', Value: request.why_why?.[2] || '—' },
        { Field: 'QA 5-WHY: WHY 4', Value: request.why_why?.[3] || '—' },
        { Field: 'QA 5-WHY: WHY 5', Value: request.why_why?.[4] || '—' },
        { Field: 'PROD OCCURRENCE CAUSE: WHY 1', Value: request.prod_why_why?.[0] || '—' },
        { Field: 'PROD OCCURRENCE CAUSE: WHY 2', Value: request.prod_why_why?.[1] || '—' },
        { Field: 'PROD OCCURRENCE CAUSE: WHY 3', Value: request.prod_why_why?.[2] || '—' },
        { Field: 'PROD OCCURRENCE CAUSE: WHY 4', Value: request.prod_why_why?.[3] || '—' },
        { Field: 'PROD OCCURRENCE CAUSE: WHY 5', Value: request.prod_why_why?.[4] || '—' },
        { Field: 'CONTAINMENT ACTION / COUNTERMEASURE', Value: request.action || '—' },
        { Field: 'TARGET COMPLETION DATE', Value: request.target_date || '—' },
        { Field: 'REMARKS', Value: request.remarks || '—' },
        { Field: 'ATTACHMENTS', Value: attachments.map((a) => a.name).join(', ') || 'None' }
      ];

      const worksheet = XLSX.utils.json_to_sheet(data);
      worksheet['!cols'] = [{ wch: 35 }, { wch: 60 }];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'IHLR Details');
      const safeReqNo = String(request.req_no).replace(/[^a-zA-Z0-9_-]/g, '_');
      XLSX.writeFile(workbook, `IHLR_Report_${safeReqNo}_${batchDate}.xlsx`);
      setShowExportModal(false);
    } catch (err) {
      console.error('Failed to export report to Excel:', err);
      alert('Failed to export report to Excel: ' + err.message);
    }
  };

  // Export this single report to PDF (.pdf)
  const handleExportPdf = () => {
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'pt',
        format: 'a4'
      });

      const reqNo = String(request.req_no || '').startsWith('IHLR-') ? request.req_no : `#${request.req_no}`;
      const batchDate = formatDate(request.batch_date);
      const shiftStr = formatShift(request.shift);

      // Header Banner
      doc.setFillColor(30, 41, 59); // slate-800
      doc.rect(40, 30, 515, 45, 'F');

      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text('INDIA NIPPON ELECTRICALS LIMITED', 55, 52);

      doc.setFontSize(9);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(191, 219, 254);
      doc.text(`IN-HOUSE LINE REJECTION (IHLR) ANALYSIS REPORT  |  ${reqNo}`, 55, 66);

      // Section 1: Basic Information
      autoTable(doc, {
        startY: 85,
        theme: 'plain',
        styles: { fontSize: 9, cellPadding: 3 },
        body: [
          [
            { content: 'Report No:', styles: { fontStyle: 'bold', textColor: [71, 85, 105] } },
            { content: reqNo, styles: { fontStyle: 'bold', textColor: [37, 99, 235] } },
            { content: 'Status:', styles: { fontStyle: 'bold', textColor: [71, 85, 105] } },
            {
              content: request.status || 'OPEN',
              styles: {
                fontStyle: 'bold',
                textColor: request.status === 'CLOSED' ? [22, 101, 52] : [180, 83, 9]
              }
            }
          ],
          [
            { content: 'Date:', styles: { fontStyle: 'bold', textColor: [71, 85, 105] } },
            batchDate,
            { content: 'Shift:', styles: { fontStyle: 'bold', textColor: [71, 85, 105] } },
            shiftStr
          ],
          [
            { content: 'Model:', styles: { fontStyle: 'bold', textColor: [71, 85, 105] } },
            request.model || '—',
            { content: 'Detected At:', styles: { fontStyle: 'bold', textColor: [71, 85, 105] } },
            request.problem_detected_at || '—'
          ],
          [
            { content: 'Received From:', styles: { fontStyle: 'bold', textColor: [71, 85, 105] } },
            request.received_from || '—',
            { content: 'Analysis By:', styles: { fontStyle: 'bold', textColor: [71, 85, 105] } },
            request.analysis_done_by || '—'
          ],
          [
            { content: '4M Category:', styles: { fontStyle: 'bold', textColor: [71, 85, 105] } },
            request.four_m || '—',
            { content: 'Responsibility:', styles: { fontStyle: 'bold', textColor: [71, 85, 105] } },
            `${request.resp || '—'} ${request.resp_person ? `(${request.resp_person})` : ''}`
          ]
        ]
      });

      // Section 2: Defect Problem Description
      const lastY = doc.lastAutoTable.finalY + 10;
      autoTable(doc, {
        startY: lastY,
        head: [['DEFECT PROBLEM & PHENOMENON DESCRIPTION']],
        body: [
          [`Problem: ${request.problem || '—'}`],
          [`Detailed Occurrence: ${request.problem_description || request.detailed_observation || '—'}`]
        ],
        theme: 'grid',
        headStyles: { fillColor: [59, 130, 246], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
        styles: { fontSize: 8.5, cellPadding: 5 }
      });

      // Section 3: 5-Why Analysis
      const whyY = doc.lastAutoTable.finalY + 10;
      const whyRows = [];
      for (let i = 0; i < 5; i++) {
        const qa = request.why_why?.[i];
        const prod = request.prod_why_why?.[i];
        if (qa || prod || i === 0) {
          whyRows.push([`Why ${i + 1}`, qa || '—', prod || '—']);
        }
      }

      autoTable(doc, {
        startY: whyY,
        head: [['LEVEL', 'QA PROBLEM CAUSE (5-WHY)', 'PRODUCTION OCCURRENCE CAUSE (5-WHY)']],
        body: whyRows,
        theme: 'grid',
        headStyles: { fillColor: [245, 158, 11], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
        columnStyles: {
          0: { cellWidth: 50, fontStyle: 'bold', halign: 'center' },
          1: { cellWidth: 232 },
          2: { cellWidth: 232 }
        },
        styles: { fontSize: 8, cellPadding: 4 }
      });

      // Section 4: Containment Action & Closure
      const actionY = doc.lastAutoTable.finalY + 10;
      autoTable(doc, {
        startY: actionY,
        head: [['CONTAINMENT COUNTERMEASURE & CLOSURE']],
        body: [
          [`Corrective Action: ${request.action || 'Containment action pending review.'}`],
          [`Target Date: ${request.target_date || 'N/A'}  |  Responsible Person: ${request.resp_person || request.resp || 'Quality Team'}`],
          ...(request.remarks ? [[`Remarks: ${request.remarks}`]] : []),
          ...(attachments.length > 0 ? [[`Evidence Attachments (${attachments.length}): ${attachments.map((a) => a.name).join(', ')}`]] : [])
        ],
        theme: 'grid',
        headStyles: { fillColor: [16, 185, 129], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
        styles: { fontSize: 8.5, cellPadding: 5 }
      });

      // Footer
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text(
          `Page ${i} of ${pageCount}  |  Generated on ${new Date().toLocaleDateString()}`,
          40,
          doc.internal.pageSize.height - 20
        );
      }

      const safeReqNo = String(request.req_no).replace(/[^a-zA-Z0-9_-]/g, '_');
      doc.save(`IHLR_Report_${safeReqNo}_${batchDate}.pdf`);
      setShowExportModal(false);
    } catch (err) {
      console.error('Failed to export report to PDF:', err);
      alert('Failed to export report to PDF: ' + err.message);
    }
  };

  const handleDownload = () => {
    if (exportFormat === 'excel') {
      handleExportExcel();
    } else {
      handleExportPdf();
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-150">
        <div 
          className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
                <Eye className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 truncate">
                    IHLR Rejection Analysis Report
                  </h3>
                  {onEditMode && (
                    <button
                      type="button"
                      onClick={() => onEditMode(request)}
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-[11px] font-bold rounded-full uppercase tracking-wider transition shadow-2xs cursor-pointer"
                    >
                      EDIT MODE
                    </button>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tracking details for:{' '}
                  <strong className="text-slate-900 font-mono">
                    {request.req_no || `IHLR-${request.id}`}
                  </strong>
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition cursor-pointer shrink-0"
              title="Close Details"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Modal Body: Single Unified Scrollable IHLR Report */}
          <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-white">
            {/* 📁 1. GENERAL INFORMATION & DEFECT PARAMETERS */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-blue-600 text-xs font-bold uppercase tracking-wider">
                <Folder className="w-4 h-4" />
                <span>1. INCIDENT &amp; LINE DEFECT DETAILS</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-y-4 gap-x-6 text-xs p-4 rounded-2xl bg-slate-50/70 border border-slate-200/80">
                <div>
                  <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    REQ NO
                  </span>
                  <span className="font-bold text-slate-900 font-mono text-sm">
                    {request.req_no || `IHLR-${request.id}`}
                  </span>
                </div>

                <div>
                  <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    INCIDENT DATE
                  </span>
                  <span className="font-medium text-slate-800">
                    {formatDate(request.batch_date)}
                  </span>
                </div>

                <div>
                  <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    SHIFT
                  </span>
                  <span className="font-medium text-slate-800">
                    {formatShift(request.shift)}
                  </span>
                </div>

                <div>
                  <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                    STATUS
                  </span>
                  {getStatusBadge(request.status)}
                </div>

                <div>
                  <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    4M CATEGORY
                  </span>
                  <span className="font-bold text-amber-700 font-mono">
                    {request.four_m || 'N/A'}
                  </span>
                </div>

                <div>
                  <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    RESPONSIBILITY (DEPT)
                  </span>
                  <span className="font-bold text-slate-900 font-mono">
                    {request.resp || 'N/A'}
                  </span>
                  {request.resp_person && (
                    <span className="block text-[11px] text-blue-600 font-semibold mt-0.5">
                      {request.resp_person}
                    </span>
                  )}
                </div>

                <div>
                  <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    MODEL NAME / PART
                  </span>
                  <span className="font-bold text-slate-900">
                    {request.model || 'N/A'}
                  </span>
                </div>

                <div>
                  <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    REJECTED QTY
                  </span>
                  <span className="font-bold text-slate-900 font-mono">
                    {request.actual_qty || '1'}
                  </span>
                </div>

                <div>
                  <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    DETECTED AT
                  </span>
                  <span className="font-medium text-slate-800">
                    {request.problem_detected_at || 'Line Inspection'}
                  </span>
                </div>

                <div>
                  <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    RECEIVED FROM LINE
                  </span>
                  <span className="font-medium text-slate-800 font-mono">
                    {request.received_from || 'Assembly Line'}
                  </span>
                </div>

                <div className="sm:col-span-2">
                  <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    ANALYSIS DONE BY
                  </span>
                  <span className="font-bold text-slate-900 block">
                    {request.analysis_done_by || 'Admin'}
                  </span>
                </div>
              </div>
            </div>

            {/* 📄 2. DEFECT PROBLEM DESCRIPTION */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-blue-600 text-xs font-bold uppercase tracking-wider">
                <FileText className="w-4 h-4" />
                <span>2. DEFECT PROBLEM DESCRIPTION</span>
              </div>

              <div className="space-y-3">
                <div>
                  <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    PROBLEM / DEFECT PHENOMENON
                  </span>
                  <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl text-xs text-slate-700 leading-relaxed font-normal min-h-[50px]">
                    {request.problem || 'No defect description logged.'}
                  </div>
                </div>

                <div>
                  <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    DETAILED DEFECT OCCURRENCE &amp; OBSERVATION
                  </span>
                  <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl text-xs text-slate-700 leading-relaxed font-normal min-h-[60px]">
                    {request.occurrence_cause || request.problem || 'No detailed occurrence observations recorded.'}
                  </div>
                </div>
              </div>
            </div>

            {/* 📎 3. ATTACHMENTS & TECHNICAL EVIDENCE */}
            {attachments.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-blue-600 text-xs font-bold uppercase tracking-wider">
                    <Paperclip className="w-4 h-4" />
                    <span>3. DEFECT EVIDENCE &amp; ATTACHMENTS ({attachments.length})</span>
                  </div>
                  <span className="text-[11px] text-slate-400 font-medium">Click any file to preview or inspect</span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {attachments.map((att, idx) => (
                    <div
                      key={`${att.name || att.url}-${idx}`}
                      onClick={() => setPreviewAttachment(att)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#f1f5f9] hover:bg-blue-50 border border-slate-200 hover:border-blue-300 text-xs font-medium text-slate-700 hover:text-blue-700 shadow-2xs transition cursor-pointer group"
                      title={`Click to preview ${att.name}`}
                    >
                      <Paperclip className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600 shrink-0" />
                      <span className="truncate max-w-[200px]">{att.name}</span>
                      <Eye className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600 shrink-0 ml-0.5" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 🔬 4. 5-WHY ROOT CAUSE ANALYSIS */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-blue-600 text-xs font-bold uppercase tracking-wider">
                <ShieldCheck className="w-4 h-4" />
                <span>4. 5-WHY ROOT CAUSE ANALYSIS</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {/* QA Why-Why */}
                <div className="p-4 rounded-2xl bg-amber-50/40 border border-amber-200/80 space-y-3">
                  <div className="flex items-center gap-2 pb-2 border-b border-amber-200/60">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                      QA Problem Cause (5-Why Analysis)
                    </h4>
                  </div>
                  <div className="space-y-2">
                    {(request.qa_why_why || []).map((w, idx) =>
                      w ? (
                        <div key={idx} className="flex items-start gap-2">
                          <span className="font-mono font-bold text-amber-700 shrink-0">W{idx + 1}:</span>
                          <span className="text-slate-800 leading-relaxed">{w}</span>
                        </div>
                      ) : null
                    )}
                    {(!request.qa_why_why || request.qa_why_why.filter(Boolean).length === 0) && (
                      <p className="text-slate-400 italic">No QA 5-Why analysis recorded.</p>
                    )}
                  </div>
                </div>

                {/* Production Why-Why */}
                <div className="p-4 rounded-2xl bg-blue-50/40 border border-blue-200/80 space-y-3">
                  <div className="flex items-center gap-2 pb-2 border-b border-blue-200/60">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                      Production Occurrence Cause (5-Why)
                    </h4>
                  </div>
                  <div className="space-y-2">
                    {(request.prod_why_why || []).map((w, idx) =>
                      w ? (
                        <div key={idx} className="flex items-start gap-2">
                          <span className="font-mono font-bold text-blue-700 shrink-0">W{idx + 1}:</span>
                          <span className="text-slate-800 leading-relaxed">{w}</span>
                        </div>
                      ) : null
                    )}
                    {(!request.prod_why_why || request.prod_why_why.filter(Boolean).length === 0) && (
                      <p className="text-slate-400 italic">No production 5-Why analysis recorded.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* 🛡️ 5. CONTAINMENT COUNTERMEASURE & TARGET CLOSURE */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-blue-600 text-xs font-bold uppercase tracking-wider">
                <Wrench className="w-4 h-4" />
                <span>5. CONTAINMENT COUNTERMEASURE &amp; CLOSURE</span>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3 text-xs">
                <div>
                  <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    CORRECTIVE ACTION &amp; CONTAINMENT
                  </span>
                  <div className="text-slate-800 font-medium leading-relaxed bg-white p-3 rounded-xl border border-slate-200/60">
                    {request.action || 'Containment action pending review.'}
                  </div>
                </div>

                {request.remarks && (
                  <div>
                    <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                      REMARKS
                    </span>
                    <div className="text-slate-700 bg-white p-3 rounded-xl border border-slate-200/60 leading-relaxed">
                      {request.remarks}
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between pt-2 border-t border-slate-200/60 text-slate-500 text-[11px] gap-2">
                  <span>Target Date: <strong className="text-slate-800">{request.target_date || 'N/A'}</strong></span>
                  <span>Responsible Person: <strong className="text-blue-600">{request.resp_person || request.resp || 'Quality Team'}</strong></span>
                  <span>Closure Status: {getStatusBadge(request.status)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="p-4 sm:p-5 border-t border-slate-100 bg-white flex items-center justify-between shrink-0">
            <div>
              {attachments.length > 0 && (
                <span className="text-xs text-slate-400 font-medium">
                  {attachments.length} attachment{attachments.length > 1 ? 's' : ''} available
                </span>
              )}
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowExportModal(true);
                }}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-xs rounded-xl shadow-xs transition cursor-pointer"
                id="modal-export-btn"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Report</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 font-semibold text-xs rounded-xl border border-slate-300 transition cursor-pointer"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Attachment Preview Modal (Works for Excel, PDF, Images, Word) */}
      <IhlrAttachmentPreviewModal
        isOpen={Boolean(previewAttachment)}
        attachment={previewAttachment}
        onClose={() => setPreviewAttachment(null)}
      />

      {/* Universal Export Format Selection Modal */}
      <ExportSelectionModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        title={`Export Report ${String(request.req_no || '').startsWith('IHLR-') ? request.req_no : `#${request.req_no}`}`}
        subtitle="Choose whether to download as Excel or PDF document"
        scopeText="Single Inspection Report"
        onExportExcel={handleExportExcel}
        onExportPdf={handleExportPdf}
      />
    </>
  );
};

export default IhlrRequestDetailsModal;
