import React, { useState, useEffect, useRef } from 'react';
import {
  ClipboardCheck,
  CheckCircle2,
  Clock,
  Search,
  Filter,
  Eye,
  X,
  FileText,
  ShieldAlert,
  Download,
  FileSpreadsheet,
  Check,
  Paperclip,
  UploadCloud,
  Save,
  Loader2,
  ChevronLeft,
  ChevronRight,
  FileCheck,
  AlertCircle
} from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ihlrService } from '../../services/ihlrService';
import { IhlrAttachmentThumbnail, parseAttachments } from './IhlrAttachmentView';
import IhlrRequestDetailsModal from './IhlrRequestDetailsModal';
import IhlrAttachmentPreviewModal from './IhlrAttachmentPreviewModal';
import ExportSelectionModal from '../../components/common/ExportSelectionModal';
import AttachmentChipList from '../../components/common/AttachmentChipList';

const IhlrApprovals = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [activeModalRequest, setActiveModalRequest] = useState(null);
  const [selectedPreviewAttachment, setSelectedPreviewAttachment] = useState(null);

  // Selected row for Closer Log form (left panel)
  const [selectedRequest, setSelectedRequest] = useState(null);

  // Form State for Closer Fields
  const [closerWhyWhy, setCloserWhyWhy] = useState(['', '', '', '', '']);
  const [closerAction, setCloserAction] = useState('');
  const [closerTargetDate, setCloserTargetDate] = useState('');
  const [closerRemarks, setCloserRemarks] = useState('');
  const [closerStatus, setCloserStatus] = useState('OPEN');
  const [existingEvidence, setExistingEvidence] = useState([]);
  const [newEvidenceFiles, setNewEvidenceFiles] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Pagination State (matching Image 2)
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  // Export State
  const [showExportModal, setShowExportModal] = useState(false);

  const fileInputRef = useRef(null);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const data = await ihlrService.getRequests();
      setRequests(data);

      // If a request was already selected, update it with fresh data
      if (selectedRequest) {
        const fresh = data.find((r) => r.id === selectedRequest.id);
        if (fresh) populateForm(fresh);
      }
    } catch (err) {
      console.error('Failed to load IHLR requests for approval:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  // Populate Closer form fields when a row is clicked
  const populateForm = (req) => {
    setSelectedRequest(req);
    setSuccessMessage('');
    setErrorMessage('');

    // 5-Why Occurrence Cause
    const whyArray = Array.isArray(req.prod_why_why) ? req.prod_why_why : [];
    const paddedWhys = [
      whyArray[0] || '',
      whyArray[1] || '',
      whyArray[2] || '',
      whyArray[3] || '',
      whyArray[4] || ''
    ];
    setCloserWhyWhy(paddedWhys);

    setCloserAction(req.action || '');
    setCloserTargetDate(req.target_date ? req.target_date.split('T')[0] : '');
    setCloserRemarks(req.remarks || '');
    setCloserStatus(req.status || 'OPEN');

    // Evidence attachments
    const existing = parseAttachments(req.evidence_attachment);
    setExistingEvidence(existing);
    setNewEvidenceFiles([]);
  };

  const handleWhyChange = (index, val) => {
    setCloserWhyWhy((prev) => {
      const updated = [...prev];
      updated[index] = val;
      return updated;
    });
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const added = Array.from(e.target.files);
      setNewEvidenceFiles((prev) => [...prev, ...added]);
    }
  };

  const handleRemoveExistingEvidence = (index) => {
    setExistingEvidence((prev) => prev.filter((_, i) => i !== index));
  };

  const handleRemoveNewEvidence = (index) => {
    setNewEvidenceFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // Submit Closer Log Updates
  const handleSaveCloser = async (e) => {
    if (e) e.preventDefault();
    if (!selectedRequest) return;

    setIsSaving(true);
    setSuccessMessage('');
    setErrorMessage('');

    try {
      let uploadedList = [];
      if (newEvidenceFiles.length > 0) {
        uploadedList = await ihlrService.uploadAttachments(newEvidenceFiles);
      }

      // Combine existing with newly uploaded
      const combinedEvidence = [...existingEvidence, ...uploadedList];

      const payload = {
        prod_why_why: closerWhyWhy,
        action: closerAction,
        evidence_attachment: JSON.stringify(combinedEvidence),
        target_date: closerTargetDate || null,
        remarks: closerRemarks,
        status: closerStatus
      };

      const updated = await ihlrService.updateRequest(selectedRequest.id, payload);
      window.dispatchEvent(new Event('refreshNotifications'));

      setSuccessMessage(`Closer log updated successfully for ${selectedRequest.req_no}!`);
      setNewEvidenceFiles([]);
      if (updated) {
        populateForm(updated);
      }
      await fetchRequests();

      setTimeout(() => {
        setSuccessMessage('');
      }, 4000);
    } catch (err) {
      console.error('Failed to update closer log:', err);
      setErrorMessage(err.message || 'Failed to update closer fields');
    } finally {
      setIsSaving(false);
    }
  };

  // Filter requests
  const filtered = requests.filter((r) => {
    const matchesSearch =
      (r.req_no || '').toLowerCase().includes(search.toLowerCase()) ||
      (r.problem || '').toLowerCase().includes(search.toLowerCase()) ||
      (r.model || '').toLowerCase().includes(search.toLowerCase()) ||
      (r.received_from || '').toLowerCase().includes(search.toLowerCase()) ||
      (r.remarks || '').toLowerCase().includes(search.toLowerCase()) ||
      (r.analysis_done_by || '').toLowerCase().includes(search.toLowerCase());
    const matchesStatus = selectedStatus === 'All' || r.status === selectedStatus;
    return matchesSearch && matchesStatus;
  });

  // Pagination calculation
  const totalRecords = filtered.length;
  const totalPages = Math.ceil(totalRecords / rowsPerPage) || 1;
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = Math.min(startIndex + rowsPerPage, totalRecords);
  const paginatedRequests = filtered.slice(startIndex, endIndex);

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
        '4M': r.four_m || '—',
        'RESP': r.resp || '—',
        'OCCURRENCE CAUSE (W1)': r.prod_why_why?.[0] || '—',
        'W2': r.prod_why_why?.[1] || '—',
        'W3': r.prod_why_why?.[2] || '—',
        'W4': r.prod_why_why?.[3] || '—',
        'W5': r.prod_why_why?.[4] || '—',
        'ACTION': r.action || '—',
        'TARGET DATE': r.target_date || '—',
        'REMARKS': r.remarks || '—',
        'STATUS': r.status || 'OPEN'
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      worksheet['!cols'] = [
        { wch: 8 }, { wch: 12 }, { wch: 14 }, { wch: 12 },
        { wch: 25 }, { wch: 15 }, { wch: 16 }, { wch: 16 },
        { wch: 10 }, { wch: 14 }, { wch: 25 }, { wch: 20 },
        { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 25 },
        { wch: 14 }, { wch: 25 }, { wch: 14 }
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
      doc.setTextColor(217, 119, 6);
      doc.text('IHLR Sign-off & Closer Approvals Queue', 40, 52);

      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text(`Generated: ${today} | Total Queue Records: ${filtered.length} | Status Filter: ${selectedStatus}`, 40, 68);

      const tableHeaders = [
        ['SL', 'REQ NO', 'DATE', 'PROBLEM & MODEL', 'DETECTED AT', '4M', 'ACTION', 'TARGET DATE', 'REMARKS', 'STATUS']
      ];

      const tableRows = filtered.map((r, idx) => [
        idx + 1,
        String(r.req_no).startsWith('IHLR-') ? r.req_no : `#${r.req_no}`,
        r.batch_date ? r.batch_date.split('T')[0] : '—',
        `${r.problem || '—'}\n(${r.model || '—'})`,
        r.problem_detected_at || '—',
        r.four_m || '—',
        r.action || '—',
        r.target_date ? r.target_date.split('T')[0] : '—',
        r.remarks || '—',
        r.status || 'OPEN'
      ]);

      autoTable(doc, {
        head: tableHeaders,
        body: tableRows,
        startY: 80,
        theme: 'grid',
        styles: { fontSize: 8.5, cellPadding: 4, valign: 'middle', overflow: 'linebreak' },
        headStyles: { fillColor: [30, 58, 138], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
        columnStyles: {
          0: { cellWidth: 28, halign: 'center' },
          1: { cellWidth: 65, fontStyle: 'bold', halign: 'center' },
          2: { cellWidth: 65 },
          3: { cellWidth: 120 },
          4: { cellWidth: 80 },
          5: { cellWidth: 45, halign: 'center' },
          6: { cellWidth: 120 },
          7: { cellWidth: 65 },
          8: { cellWidth: 110 },
          9: { cellWidth: 60, halign: 'center', fontStyle: 'bold' }
        },
        alternateRowStyles: { fillColor: [248, 250, 252] }
      });

      doc.save(`IHLR_Approvals_Queue_${today}.pdf`);
      setShowExportModal(false);
    } catch (err) {
      console.error('Failed to export approvals to PDF:', err);
      alert('Failed to export to PDF: ' + err.message);
    }
  };

  // Convert new files to previewable objects
  const previewableNewFiles = newEvidenceFiles.map((f) => {
    const ext = f.name.split('.').pop()?.toUpperCase() || 'FILE';
    const isImage = ['PNG', 'JPG', 'JPEG', 'WEBP', 'GIF', 'SVG'].includes(ext);
    const isPdf = ext === 'PDF';
    const isExcel = ['XLS', 'XLSX', 'CSV', 'XLSM'].includes(ext);
    const isWord = ['DOC', 'DOCX'].includes(ext);
    const isPpt = ['PPT', 'PPTX'].includes(ext);
    return {
      name: f.name,
      url: URL.createObjectURL(f),
      type: ext,
      isImage,
      isPdf,
      isExcel,
      isWord,
      isPpt
    };
  });

  return (
    <div className="space-y-6 w-full pb-16">
      {/* Top Header & Breadcrumbs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
            <span className="text-blue-600 font-bold uppercase tracking-wider font-mono">IHLR REPOSITORY</span>
            <span>/</span>
            <span>Approvals &amp; Closer Management</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            IHLR Approvals &amp; Closer Log
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Update 5-Why occurrence causes, corrective actions, evidence attachments, and sign off incident closures.
          </p>
        </div>
      </div>

      {/* Main Two-Column Split Layout (Matching Reference Image 2) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* ============================================================== */}
        {/* LEFT COLUMN: Update Closer Log Form (Fields from Image 1)       */}
        {/* ============================================================== */}
        <div className="lg:col-span-5 xl:col-span-4 bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 sm:p-6 space-y-5 sticky top-4">
          
          {/* Card Title */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-2xs">
                <FileCheck className="w-4 h-4" />
              </div>
              <h2 className="text-sm font-bold text-slate-900">
                Update Closer Log
              </h2>
            </div>
            {selectedRequest && (
              <span className="px-2 py-0.5 rounded-md font-mono text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                {String(selectedRequest.req_no).startsWith('IHLR-') ? selectedRequest.req_no : `#${selectedRequest.req_no}`}
              </span>
            )}
          </div>

          {/* Success / Error Alerts */}
          {successMessage && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 animate-in fade-in">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Form Fields */}
          <form onSubmit={handleSaveCloser} className="space-y-4 text-xs">
            
            {/* 1. Request Reference Fields (Disabled grey boxes, as in Image 2) */}
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  IHLR REQ NO <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  readOnly
                  disabled
                  value={selectedRequest ? (String(selectedRequest.req_no).startsWith('IHLR-') ? selectedRequest.req_no : `#${selectedRequest.req_no}`) : ''}
                  placeholder="Click a row on the right to select"
                  className="w-full px-3.5 py-2.5 bg-slate-100/80 border border-slate-200 rounded-xl text-slate-700 font-semibold cursor-not-allowed select-none outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  REQUESTED DATE <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  readOnly
                  disabled
                  value={selectedRequest?.batch_date ? selectedRequest.batch_date.split('T')[0] : ''}
                  placeholder="Click a row on the right to select"
                  className="w-full px-3.5 py-2.5 bg-slate-100/80 border border-slate-200 rounded-xl text-slate-700 font-semibold cursor-not-allowed select-none outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  PROBLEM / DETECTED AT <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  readOnly
                  disabled
                  value={selectedRequest ? `${selectedRequest.problem || ''} (${selectedRequest.problem_detected_at || ''})` : ''}
                  placeholder="Click a row on the right to select"
                  className="w-full px-3.5 py-2.5 bg-slate-100/80 border border-slate-200 rounded-xl text-slate-700 font-semibold cursor-not-allowed select-none outline-none truncate"
                />
              </div>
            </div>

            {/* Separator */}
            <div className="pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-black uppercase tracking-wider text-amber-700">
                  Occurrence Cause (Production Team - 5 Why)
                </span>
                <span className="text-[10px] text-slate-400 font-mono">W1 to W5</span>
              </div>

              {/* 5-Whys Stacked Inputs (Image 1: W1 to W5) */}
              <div className="space-y-1.5">
                {['W1', 'W2', 'W3', 'W4', 'W5'].map((label, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="w-8 shrink-0 text-[11px] font-black font-mono text-rose-600">
                      {label}:
                    </span>
                    <input
                      type="text"
                      disabled={!selectedRequest}
                      value={closerWhyWhy[idx] || ''}
                      onChange={(e) => handleWhyChange(idx, e.target.value)}
                      placeholder={selectedRequest ? `Enter ${label} cause...` : 'Select request on right'}
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none disabled:bg-slate-50 disabled:text-slate-400 transition"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Action Field (Image 1: Action Words) */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                ACTION <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={2}
                disabled={!selectedRequest}
                value={closerAction}
                onChange={(e) => setCloserAction(e.target.value)}
                placeholder={selectedRequest ? 'Describe corrective actions taken / countermeasures...' : 'Click a row on the right to select'}
                className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none disabled:bg-slate-50 disabled:text-slate-400 transition resize-none"
              />
            </div>

            {/* Evidence Attachment (Image 1: Format PPT, JPEG, EXCEL & PDF) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                  EVIDENCE ATTACHMENT
                </label>
                <span className="text-[10px] text-slate-400 font-mono">PPT, JPEG, EXCEL &amp; PDF</span>
              </div>

              {/* Styled File Input Button (matching Image 2) */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={!selectedRequest}
                  onClick={() => fileInputRef.current && fileInputRef.current.click()}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                >
                  Choose files
                </button>
                <span className="text-[11px] text-slate-500 truncate">
                  {newEvidenceFiles.length > 0
                    ? `${newEvidenceFiles.length} file(s) selected`
                    : existingEvidence.length > 0
                    ? `${existingEvidence.length} existing attachment(s)`
                    : 'No file chosen'}
                </span>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".ppt,.pptx,.pdf,.doc,.docx,.xls,.xlsx,.csv,.png,.jpg,.jpeg,.webp"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>

              {/* Existing and newly attached chips */}
              <div className="mt-2 space-y-1">
                {existingEvidence.length > 0 && (
                  <AttachmentChipList
                    attachments={existingEvidence}
                    onPreview={(att) => setSelectedPreviewAttachment(att)}
                    onRemove={(idx) => handleRemoveExistingEvidence(idx)}
                  />
                )}
                {previewableNewFiles.length > 0 && (
                  <AttachmentChipList
                    attachments={previewableNewFiles}
                    onPreview={(att) => setSelectedPreviewAttachment(att)}
                    onRemove={(idx) => handleRemoveNewEvidence(idx)}
                  />
                )}
              </div>
            </div>

            {/* Target Date */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                TARGET DATE
              </label>
              <input
                type="date"
                disabled={!selectedRequest}
                value={closerTargetDate}
                onChange={(e) => setCloserTargetDate(e.target.value)}
                className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none disabled:bg-slate-50 disabled:text-slate-400 transition"
              />
            </div>

            {/* Remarks (Image 1: REMARKS Word) with character count counter like Image 2 */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                  REMARKS <span className="text-rose-500">*</span>
                </label>
                <span className="text-[10px] text-slate-400 font-mono">
                  {1000 - closerRemarks.length} chars left
                </span>
              </div>
              <textarea
                rows={2}
                maxLength={1000}
                disabled={!selectedRequest}
                value={closerRemarks}
                onChange={(e) => setCloserRemarks(e.target.value)}
                placeholder={selectedRequest ? 'Enter Remarks...' : 'Click a row on the right to select'}
                className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none disabled:bg-slate-50 disabled:text-slate-400 transition resize-none"
              />
              <p className="text-[10px] text-slate-400 mt-0.5">
                Provide closer remarks and validation summary
              </p>
            </div>

            {/* Status (Image 1: REQUESTOR Status / Image 2: APPROVER VALIDATION STATUS) */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                STATUS <span className="text-rose-500">*</span>
              </label>
              <select
                disabled={!selectedRequest}
                value={closerStatus}
                onChange={(e) => setCloserStatus(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none disabled:bg-slate-50 disabled:text-slate-400 transition"
              >
                <option value="OPEN">OPEN (Containment Required)</option>
                <option value="IN_PROGRESS">IN PROGRESS (Why-Why Review)</option>
                <option value="CLOSED">CLOSED (Resolved &amp; Signed-off)</option>
              </select>
            </div>

            {/* Action Submit Button (Exact style from Reference Image 2) */}
            <div className="pt-2">
              {!selectedRequest ? (
                <button
                  type="button"
                  disabled
                  className="w-full py-3 px-4 rounded-xl border border-blue-200/80 bg-blue-50/50 text-blue-400 font-bold text-xs cursor-not-allowed select-none text-center shadow-2xs"
                >
                  Select a Request to Validate
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={isSaving}
                  className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs shadow-md hover:shadow-lg transition transform active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving Closer Details...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Update Closer Log</span>
                    </>
                  )}
                </button>
              )}
            </div>

          </form>
        </div>

        {/* ============================================================== */}
        {/* RIGHT COLUMN: Filter Bar & Table (Matching Reference Image 2)   */}
        {/* ============================================================== */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-4">
          
          {/* Top Filter and Search Bar (Image 2 Top Row) */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
              <input
                type="text"
                placeholder="Search by req no, problem, or remarks..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none font-medium transition"
              />
            </div>

            <div className="w-full sm:w-44">
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-semibold focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
              >
                <option value="All">All Decisions</option>
                <option value="OPEN">OPEN</option>
                <option value="IN_PROGRESS">IN PROGRESS</option>
                <option value="CLOSED">CLOSED</option>
              </select>
            </div>

            <button
              onClick={() => setShowExportModal(true)}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs hover:shadow transition transform active:scale-95 cursor-pointer shrink-0"
              id="approvals-export-pdf-btn"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export PDF</span>
            </button>
          </div>

          {/* Table Container */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="bg-[#f8fafc] border-b border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-500">
                    <th className="py-3 px-3 text-center w-12">SL NO</th>
                    <th className="py-3 px-3">IHLR REQ NO</th>
                    <th className="py-3 px-3">REQUESTED DATE</th>
                    <th className="py-3 px-4">PROBLEM &amp; MODEL</th>
                    <th className="py-3 px-3">EVIDENCE</th>
                    <th className="py-3 px-3 text-center">STATUS</th>
                    <th className="py-3 px-3">REMARKS</th>
                    <th className="py-3 px-3 text-center w-14">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                        <span>Loading approval queue...</span>
                      </td>
                    </tr>
                  ) : paginatedRequests.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        <ClipboardCheck className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                        <p className="font-semibold text-slate-600">No requests found matching criteria</p>
                      </td>
                    </tr>
                  ) : (
                    paginatedRequests.map((r, idx) => {
                      const isSelected = selectedRequest?.id === r.id;
                      return (
                        <tr
                          key={r.id}
                          onClick={() => populateForm(r)}
                          className={`transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-blue-50/80 border-l-4 border-l-blue-600 font-medium'
                              : 'hover:bg-slate-50/80'
                          }`}
                        >
                          <td className="py-3.5 px-3 text-center font-mono text-[11px] text-slate-500">
                            {startIndex + idx + 1}
                          </td>
                          <td className="py-3.5 px-3 font-mono font-bold text-blue-600 whitespace-nowrap">
                            {String(r.req_no).startsWith('IHLR-') ? r.req_no : `#${r.req_no}`}
                          </td>
                          <td className="py-3.5 px-3 whitespace-nowrap text-slate-600 font-mono text-[11px]">
                            {r.batch_date ? r.batch_date.split('T')[0] : '—'}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-slate-900 truncate max-w-[180px]" title={r.problem}>
                              {r.problem}
                            </div>
                            <div className="text-[11px] text-slate-500 truncate max-w-[180px]" title={r.model}>
                              {r.model}
                            </div>
                          </td>
                          <td className="py-3.5 px-3">
                            <IhlrAttachmentThumbnail rawAttachment={r.evidence_attachment || r.defect_image} />
                          </td>
                          <td className="py-3.5 px-3 text-center whitespace-nowrap">
                            {r.status === 'OPEN' && (
                              <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                OPEN
                              </span>
                            )}
                            {r.status === 'IN_PROGRESS' && (
                              <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                IN PROGRESS
                              </span>
                            )}
                            {r.status === 'CLOSED' && (
                              <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                CLOSED
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-3 text-slate-600 truncate max-w-[150px]" title={r.remarks || '—'}>
                            {r.remarks || '—'}
                          </td>
                          <td className="py-3.5 px-3 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => setActiveModalRequest(r)}
                              className="p-1 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition cursor-pointer"
                              title="View Full Report"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls (Matching Reference Image 2 Bottom Row) */}
            <div className="p-3.5 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-end gap-4 text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <span>Rows per page:</span>
                <select
                  value={rowsPerPage}
                  onChange={(e) => {
                    setRowsPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold outline-none"
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
              </div>

              <div className="font-mono text-[11px] text-slate-500">
                {totalRecords === 0
                  ? '0–0 of 0'
                  : `${startIndex + 1}–${endIndex} of ${totalRecords}`}
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                  className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
                  title="Previous Page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                  className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
                  title="Next Page"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

          </div>
        </div>

      </div>

      {/* Comprehensive Report Modal */}
      <IhlrRequestDetailsModal
        isOpen={Boolean(activeModalRequest)}
        request={activeModalRequest}
        onClose={() => setActiveModalRequest(null)}
      />

      {/* Standalone Attachment Preview Modal */}
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
        excelDescription="Full structured workbook with separate columns for incident details, 5-Why occurrence causes, containment actions, and target dates."
        pdfDescription="Official landscape document formatted with India Nippon Electricals Limited branding, tables, and page numbers."
      />
    </div>
  );
};

export default IhlrApprovals;
