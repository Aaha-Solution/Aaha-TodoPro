import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ClipboardCheck,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Eye,
  X,
  RefreshCw,
  AlertCircle,
  FileText,
  Paperclip,
  Download,
  FileSpreadsheet,
  Presentation,
  File as FileIcon,
  Image as ImageIcon,
  UploadCloud,
  Check,
  Trash2,
  AlertTriangle,
  CheckCheck,
  RotateCcw,
  FileCheck,
  Save,
  Loader2,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { processAuditService } from '../../services/processAuditService';
import { useAuth } from '../../hooks/useAuth';
import ExportSelectionModal from '../../components/common/ExportSelectionModal';
import AttachmentChipList from '../../components/common/AttachmentChipList';
import AttachmentThumbnail from '../../components/common/AttachmentThumbnail';
import AttachmentPreviewModal from '../../components/common/AttachmentPreviewModal';

const ProcessAuditApprovals = () => {
  const { user } = useAuth();
  const isAdmin = (user?.role || '').toUpperCase() === 'ADMIN';

  const [searchParams] = useSearchParams();
  const queryRequestId = searchParams.get('requestId') || searchParams.get('id');

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [activeModalRequest, setActiveModalRequest] = useState(null);
  const [selectedPreviewAttachment, setSelectedPreviewAttachment] = useState(null);

  // Selected row for Closer Log form (left panel)
  const [selectedRequest, setSelectedRequest] = useState(null);

  // Form State for Process Audit Sign-off Fields
  const [rootCause, setRootCause] = useState('');
  const [closerAction, setCloserAction] = useState('');
  const [standardizationDetails, setStandardizationDetails] = useState('');
  const [closerTargetDate, setCloserTargetDate] = useState('');
  const [closerRemarks, setCloserRemarks] = useState('');
  const [closerStatus, setCloserStatus] = useState('Approved');
  const [existingEvidence, setExistingEvidence] = useState([]);
  const [newEvidenceFiles, setNewEvidenceFiles] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Pagination State
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  // Export State
  const [showExportModal, setShowExportModal] = useState(false);

  const fileInputRef = useRef(null);

  // Attachment URL resolver tailored for Process Audit backend
  const getFullAttachmentUrl = (att) => {
    if (!att) return '';
    const apiBase = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '');

    if (typeof att === 'number' || (typeof att === 'string' && /^\d+$/.test(att.trim()))) {
      return `${apiBase}/api/process-audit/attachments/${String(att).trim()}`;
    }

    if (typeof att === 'object' && att.id) {
      return `${apiBase}/api/process-audit/attachments/${att.id}`;
    }

    let url = '';
    if (typeof att === 'string') {
      url = att;
    } else {
      if (att.url && !att.url.startsWith('blob:')) {
        url = att.url;
      } else if (att.path && !att.path.startsWith('blob:')) {
        url = att.path;
      } else if (att.filename) {
        url = `/api/process-audit/attachments/${encodeURIComponent(att.filename)}`;
      } else if (att.name) {
        url = `/api/process-audit/attachments/${encodeURIComponent(att.name)}`;
      }
    }

    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }

    if (url.startsWith('blob:')) {
      const fallbackName = typeof att === 'object' ? (att.filename || att.name) : '';
      if (fallbackName) {
        return `${apiBase}/api/process-audit/attachments/${encodeURIComponent(fallbackName)}`;
      }
      return url;
    }

    const cleanUrl = url.startsWith('/') ? url : `/${url}`;
    if (cleanUrl.startsWith('/uploads/')) {
      return `${apiBase}/api/process-audit${cleanUrl}`;
    }
    return `${apiBase}${cleanUrl}`;
  };

  // Convert raw attachment data into uniform objects
  const normalizeAttachment = (item) => {
    if (!item) return null;
    const url = getFullAttachmentUrl(item);
    const name =
      typeof item === 'string'
        ? item.split('/').pop().split('\\').pop() || 'Attachment'
        : item.name || item.filename || (url ? url.split('/').pop() : 'Attachment');
    const ext = (item.type || name.split('.').pop() || 'FILE').toUpperCase();
    const isImage = ['PNG', 'JPG', 'JPEG', 'WEBP', 'GIF', 'SVG'].includes(ext);
    const isPdf = ext === 'PDF';
    const isExcel = ['XLS', 'XLSX', 'CSV', 'XLSM'].includes(ext);
    const isWord = ['DOC', 'DOCX'].includes(ext);
    const isPpt = ['PPT', 'PPTX'].includes(ext);

    return {
      ...(typeof item === 'object' ? item : {}),
      name,
      url,
      type: ext,
      isImage,
      isPdf,
      isExcel,
      isWord,
      isPpt
    };
  };

  const parseAttachments = (attData) => {
    if (!attData) return [];
    let list = [];
    if (Array.isArray(attData)) {
      list = attData;
    } else if (typeof attData === 'string') {
      const trimmed = attData.trim();
      if (!trimmed || trimmed === '[]' || trimmed === 'null' || trimmed === '""') return [];
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        try {
          const parsed = JSON.parse(trimmed);
          list = Array.isArray(parsed) ? parsed : [parsed];
        } catch {
          list = [];
        }
      } else if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        try {
          list = [JSON.parse(trimmed)];
        } catch {
          list = [];
        }
      } else {
        list = trimmed.split(',').map((s) => s.trim()).filter(Boolean);
      }
    } else if (typeof attData === 'object') {
      list = [attData];
    }
    return list.map(normalizeAttachment).filter(Boolean);
  };

  const matchesExecutorUser = (execStr, uName, uEmail) => {
    if (!execStr) return false;
    const e = execStr.trim().toLowerCase();
    const name = (uName || '').trim().toLowerCase();
    const email = (uEmail || '').trim().toLowerCase();

    if (name && e === name) return true;
    if (email && e === email) return true;

    const tokens = e.replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter(Boolean);
    if (name && tokens.includes(name)) return true;
    return false;
  };

  const loadRequests = async () => {
    setLoading(true);
    try {
      const params = {};
      if (!isAdmin && user?.name) {
        params.executor = user.name;
        params.role = user?.role;
      }
      const data = await processAuditService.getRequests(params);
      const list = Array.isArray(data) ? data : [];
      setRequests(list);

      // Deep linking or re-selecting active request
      if (selectedRequest) {
        const fresh = list.find((r) => r.id === selectedRequest.id || r.issue_no === selectedRequest.issue_no);
        if (fresh) populateForm(fresh);
      } else if (queryRequestId && list.length > 0) {
        const match = list.find(
          (r) =>
            String(r.id) === String(queryRequestId) ||
            String(r.issue_no || '').toLowerCase() === String(queryRequestId).toLowerCase()
        );
        if (match) populateForm(match);
      }
    } catch (err) {
      console.error('Failed to load approval requests from DB:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  // Populate form fields when a row is clicked
  const populateForm = (req) => {
    setSelectedRequest(req);
    setSuccessMessage('');
    setErrorMessage('');

    setRootCause(req.root_cause || '');
    setCloserAction(req.corrective_action || req.action || '');
    setStandardizationDetails(req.standardization_details || '');
    setCloserTargetDate(
      req.target_date
        ? req.target_date.includes('T')
          ? req.target_date.split('T')[0]
          : req.target_date
        : ''
    );
    setCloserRemarks(req.creator_remark || req.comments || req.remarks || req.rejection_reason || '');

    // Status mapping
    const s = req.status || 'Pending Execution';
    if (s.toLowerCase().includes('approved')) {
      setCloserStatus('Approved');
    } else if (s.toLowerCase().includes('close')) {
      setCloserStatus('Closed');
    } else if (s.toLowerCase().includes('reject')) {
      setCloserStatus('Rejected');
    } else if (s.toLowerCase() === 'open' || s.toLowerCase().includes('open')) {
      setCloserStatus('Open');
    } else {
      setCloserStatus('Approved');
    }

    // Evidence attachments: only load executor's saved action_attachments from DB (never creator's initial attachments)
    const existing = req.action_attachments ? parseAttachments(req.action_attachments) : [];
    setExistingEvidence(existing);
    setNewEvidenceFiles([]);
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

  // Submit Sign-off / Closer Updates
  const handleSaveCloser = async (e) => {
    if (e) e.preventDefault();
    if (!selectedRequest) return;

    setIsSaving(true);
    setSuccessMessage('');
    setErrorMessage('');

    try {
      let uploadedList = [];
      if (newEvidenceFiles.length > 0) {
        uploadedList = await processAuditService.uploadAttachments(newEvidenceFiles);
      }

      // Combine existing with newly uploaded (matching IHLR method)
      const combinedEvidence = [...existingEvidence, ...uploadedList];
      const reqId = selectedRequest.id || selectedRequest.issue_no;

      const payload = {
        status: closerStatus,
        root_cause: rootCause.trim(),
        corrective_action: closerAction.trim(),
        standardization_details: standardizationDetails.trim(),
        action_attachments: combinedEvidence,
        target_date: closerTargetDate || null,
        creator_remark: closerRemarks.trim(),
        comments: closerRemarks.trim(),
        remarks: closerRemarks.trim(),
        rejectionReason: closerStatus === 'Rejected' ? closerRemarks.trim() : null,
        rejection_reason: closerStatus === 'Rejected' ? closerRemarks.trim() : null,
        action_taken_by: user?.name || user?.email || 'Assigned Executor',
        approved_by: user?.name || user?.email || 'Assigned Executor',
        approved_by_id: user?.id || null,
        approved_by_email: user?.email || null,
        approved_by_role: user?.role || null
      };

      const updated = await processAuditService.updateRequestStatus(reqId, closerStatus, payload);
      window.dispatchEvent(new Event('refreshNotifications'));

      const displayId =
        selectedRequest.issue_no ||
        (selectedRequest.id ? `PA-${selectedRequest.id}` : `#${selectedRequest.id}`);
      setSuccessMessage(`Sign-off updated successfully for ${displayId}!`);
      setNewEvidenceFiles([]);

      const mergedUpdated = { ...selectedRequest, ...payload, ...updated, status: closerStatus };
      setSelectedRequest(mergedUpdated);
      if (updated) {
        populateForm(mergedUpdated);
      }

      setRequests((prev) =>
        prev.map((r) =>
          r.id === selectedRequest.id || r.issue_no === selectedRequest.issue_no ? mergedUpdated : r
        )
      );

      await loadRequests();

      setTimeout(() => {
        setSuccessMessage('');
      }, 4000);
    } catch (err) {
      console.error('Failed to update sign-off log:', err);
      setErrorMessage(err.response?.data?.message || err.message || 'Failed to update fields');
    } finally {
      setIsSaving(false);
    }
  };

  // Filter requests
  const filtered = requests.filter((r) => {
    if (!isAdmin) {
      const isAssignedToMe = matchesExecutorUser(r.executor, user?.name, user?.email);
      if (!isAssignedToMe) return false;
    }

    const reqId = String(r.issue_no || (r.id ? `PA-${r.id}` : '')).toLowerCase();
    const stage = String(r.model || r.stage || '').toLowerCase();
    const line = String(r.process_operation || r.line || '').toLowerCase();
    const executor = String(r.executor || '').toLowerCase();
    const creator = String(r.created_by || r.creator || '').toLowerCase();
    const prod = String(r.product || r.production || '').toLowerCase();
    const obs = String(r.issue_observation || r.problem || '').toLowerCase();
    const remarks = String(r.creator_remark || r.comments || r.remarks || '').toLowerCase();
    const q = search.trim().toLowerCase();

    const matchesSearch =
      !q ||
      reqId.includes(q) ||
      stage.includes(q) ||
      line.includes(q) ||
      executor.includes(q) ||
      creator.includes(q) ||
      prod.includes(q) ||
      obs.includes(q) ||
      remarks.includes(q);

    const s = (r.status || 'Pending Execution').toLowerCase();
    let matchesStatus = true;
    if (selectedStatus === 'Pending Approval' || selectedStatus === 'PENDING') {
      matchesStatus =
        s.includes('pending') ||
        (!s.includes('approved') && !s.includes('close') && !s.includes('open') && !s.includes('reject'));
    } else if (selectedStatus === 'Approved' || selectedStatus === 'APPROVED') {
      matchesStatus = s.includes('approved') && !s.includes('partially') && !s.includes('close');
    } else if (selectedStatus === 'Closed' || selectedStatus === 'CLOSED') {
      matchesStatus = s.includes('close');
    } else if (selectedStatus === 'Open' || selectedStatus === 'OPEN') {
      matchesStatus = s === 'open' || s.includes('open') || s.includes('reopen');
    } else if (selectedStatus === 'Rejected' || selectedStatus === 'REJECTED') {
      matchesStatus = s.includes('reject');
    }

    return matchesSearch && matchesStatus;
  });

  // Pagination calculation
  const totalRecords = filtered.length;
  const totalPages = Math.ceil(totalRecords / rowsPerPage) || 1;
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = Math.min(startIndex + rowsPerPage, totalRecords);
  const paginatedRequests = filtered.slice(startIndex, endIndex);

  const formatDate = (dateVal) => {
    if (!dateVal) return '—';
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return String(dateVal).split('T')[0];
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  // Export to Excel (.xlsx)
  const handleExportExcel = () => {
    try {
      const exportData = filtered.map((r, index) => {
        return {
          'SL NO': index + 1,
          'AUDIT REQ NO': r.issue_no || (r.id ? `PA-${r.id}` : `#${r.id}`),
          'DATE': r.escalation_date ? r.escalation_date.split('T')[0] : (r.created_at ? r.created_at.split('T')[0] : '—'),
          'SHIFT': r.shift || '—',
          'PRODUCT': r.product || '—',
          'STAGE / MODEL': r.model || r.stage || '—',
          'LINE / OPERATION': r.process_operation || r.line || '—',
          'AUDIT OBSERVATION': r.issue_observation || r.problem || '—',
          'EXECUTOR': r.executor || '—',
          'ROOT CAUSE': r.root_cause || '—',
          'ACTION': r.corrective_action || r.action || '—',
          'STANDARDIZATION': r.standardization_details || '—',
          'TARGET DATE': r.target_date ? r.target_date.split('T')[0] : '—',
          'REMARKS': r.creator_remark || r.comments || r.remarks || '—',
          'STATUS': r.status || 'Pending Execution'
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      worksheet['!cols'] = [
        { wch: 8 }, { wch: 14 }, { wch: 14 }, { wch: 10 },
        { wch: 16 }, { wch: 18 }, { wch: 20 }, { wch: 30 },
        { wch: 18 }, { wch: 25 }, { wch: 25 }, { wch: 25 },
        { wch: 14 }, { wch: 25 }, { wch: 15 }
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Audit Approvals Queue');
      const today = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(workbook, `Process_Audit_Approvals_Queue_${today}.xlsx`);
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
      doc.text('Process Audit Sign-off & Closer Approvals Queue', 40, 52);

      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text(`Generated: ${today} | Total Records: ${filtered.length} | Status Filter: ${selectedStatus}`, 40, 68);

      const tableHeaders = [
        ['SL', 'REQ NO', 'DATE', 'OBSERVATION & STAGE', 'EXECUTOR', 'ROOT CAUSE', 'ACTION', 'TARGET DATE', 'STATUS']
      ];

      const tableRows = filtered.map((r, idx) => [
        idx + 1,
        r.issue_no || (r.id ? `PA-${r.id}` : `#${r.id}`),
        r.escalation_date ? r.escalation_date.split('T')[0] : (r.created_at ? r.created_at.split('T')[0] : '—'),
        `${r.issue_observation || r.problem || '—'}\n(${r.model || r.stage || '—'} - ${r.process_operation || r.line || '—'})`,
        r.executor || '—',
        r.root_cause || '—',
        r.corrective_action || r.action || '—',
        r.target_date ? r.target_date.split('T')[0] : '—',
        r.status || 'Pending'
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
          3: { cellWidth: 150 },
          4: { cellWidth: 80 },
          5: { cellWidth: 120 },
          6: { cellWidth: 120 },
          7: { cellWidth: 65 },
          8: { cellWidth: 65, halign: 'center', fontStyle: 'bold' }
        },
        alternateRowStyles: { fillColor: [248, 250, 252] }
      });

      doc.save(`Process_Audit_Approvals_Queue_${today}.pdf`);
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
      isPpt,
      rawFile: f
    };
  });

  return (
    <div className="space-y-6 w-full pb-16">
      {/* Top Header & Breadcrumbs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
            <span className="text-blue-600 font-bold uppercase tracking-wider font-mono">PROCESS AUDIT REPOSITORY</span>
            <span>/</span>
            <span>Approvals &amp; Sign-off Management</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Process Audit Approvals &amp; Sign-off Log
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Update root causes, corrective actions, standardization details, evidence attachments, and sign off audit closures.
          </p>
        </div>

        <button
          onClick={loadRequests}
          disabled={loading}
          className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold border border-slate-200 shadow-2xs flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-60 self-start sm:self-auto"
          title="Refresh database records"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Main Two-Column Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

        {/* ============================================================== */}
        {/* LEFT COLUMN: Update Sign-off Log Form                         */}
        {/* ============================================================== */}
        <div className="lg:col-span-5 xl:col-span-4 bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 sm:p-6 space-y-5 sticky top-4">

          {/* Card Title */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-2xs">
                <FileCheck className="w-4 h-4" />
              </div>
              <h2 className="text-sm font-bold text-slate-900">
                Update Sign-off Log
              </h2>
            </div>
            {selectedRequest && (
              <span className="px-2 py-0.5 rounded-md font-mono text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                {selectedRequest.issue_no || (selectedRequest.id ? `PA-${selectedRequest.id}` : `#${selectedRequest.id}`)}
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

            {/* 1. Request Reference Fields (Disabled grey boxes) */}
           

            {/* Root Cause Field (replaces 5-Why occurrence cause) */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                ROOT CAUSE <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={2}
                disabled={!selectedRequest}
                value={rootCause}
                onChange={(e) => setRootCause(e.target.value)}
                placeholder={selectedRequest ? 'Identify underlying root cause of deviation/defect...' : 'Click a row on the right to select'}
                className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none disabled:bg-slate-50 disabled:text-slate-400 transition resize-none"
              />
            </div>

            {/* Action Field */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
               CORRECTIVE ACTION <span className="text-rose-500">*</span>
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

            {/* Standardization Details Field */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                STANDARDIZATION DETAILS
              </label>
              <textarea
                rows={2}
                disabled={!selectedRequest}
                value={standardizationDetails}
                onChange={(e) => setStandardizationDetails(e.target.value)}
                placeholder={selectedRequest ? 'Detail SOP revisions, Work Instructions, poka-yoke, or line standards...' : 'Click a row on the right to select'}
                className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none disabled:bg-slate-50 disabled:text-slate-400 transition resize-none"
              />
            </div>

            {/* Evidence Attachment */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                  EVIDENCE ATTACHMENT
                </label>
                <span className="text-[10px] text-slate-400 font-mono">PPT, JPEG, EXCEL &amp; PDF</span>
              </div>

              {/* Styled File Input Button */}
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

              {/* Existing (saved in DB) and newly selected chips */}
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

          
            {/* Action Submit Button */}
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
                      <span>Saving ....</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Save</span>
                    </>
                  )}
                </button>
              )}
            </div>

          </form>
        </div>

        {/* ============================================================== */}
        {/* RIGHT COLUMN: Filter Bar & Table                              */}
        {/* ============================================================== */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-4">

          {/* Top Filter and Search Bar */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
              <input
                type="text"
                placeholder="Search by req no, problem, or remarks..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none font-medium transition"
              />
            </div>

            <div className="w-full sm:w-48">
              <select
                value={selectedStatus}
                onChange={(e) => {
                  setSelectedStatus(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-semibold focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none cursor-pointer"
              >
                <option value="All">All Decisions</option>
                <option value="Pending Approval">Pending Approval / Execution</option>
                <option value="Approved">Approved</option>
                <option value="Closed">Closed</option>
                <option value="Open">Open</option>
                <option value="Rejected">Rejected</option>
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
                    <th className="py-3 px-3">AUDIT REQ NO</th>
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
                      const isSelected =
                        selectedRequest &&
                        (selectedRequest.id === r.id || selectedRequest.issue_no === r.issue_no);
                      const displayId = r.issue_no || (r.id ? `PA-${r.id}` : `#${r.id}`);
                      const problemText = r.issue_observation || r.problem || '—';
                      const modelText = `${r.model || r.stage || ''} • ${r.process_operation || r.line || ''}`.trim().replace(/^•\s*|\s*•$/g, '');
                      const statusLower = (r.status || 'Pending Execution').toLowerCase();
                      const isApproved = statusLower.includes('approved') && !statusLower.includes('partially') && !statusLower.includes('close');
                      const isClosed = statusLower.includes('close');
                      const isOpen = statusLower === 'open' || statusLower.includes('open') || statusLower.includes('reopen');
                      const isRejected = statusLower.includes('reject');
                      const isPending = !isApproved && !isClosed && !isOpen && !isRejected;

                      const remarksText = r.creator_remark || r.corrective_action || r.comments || r.remarks || r.rejection_reason || '—';
                      const attachmentsRaw = r.action_attachments || r.attachments || r.evidence_attachment;

                      return (
                        <tr
                          key={r.id || idx}
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
                            {displayId}
                          </td>
                          <td className="py-3.5 px-3 whitespace-nowrap text-slate-600 font-mono text-[11px]">
                            {r.escalation_date
                              ? r.escalation_date.split('T')[0]
                              : r.created_at
                              ? r.created_at.split('T')[0]
                              : '—'}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-slate-900 truncate max-w-[180px]" title={problemText}>
                              {problemText}
                            </div>
                            <div className="text-[11px] text-slate-500 truncate max-w-[180px]" title={modelText}>
                              {modelText}
                            </div>
                          </td>
                          <td className="py-3.5 px-3">
                            <AttachmentThumbnail
                              rawAttachment={attachmentsRaw}
                              onClick={(e) => {
                                e?.stopPropagation?.();
                                const parsed = parseAttachments(attachmentsRaw);
                                if (parsed.length > 0) setSelectedPreviewAttachment(parsed[0]);
                              }}
                            />
                          </td>
                          <td className="py-3.5 px-3 text-center whitespace-nowrap">
                            {isApproved && (
                              <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                APPROVED
                              </span>
                            )}
                            {isClosed && (
                              <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-teal-700 border border-teal-200">
                                CLOSED
                              </span>
                            )}
                            {isOpen && (
                              <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200">
                                OPEN
                              </span>
                            )}
                            {isRejected && (
                              <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                REJECTED
                              </span>
                            )}
                            {isPending && (
                              <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                PENDING
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-3 text-slate-600 truncate max-w-[150px]" title={remarksText}>
                            {remarksText}
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

            {/* Pagination Controls */}
            <div className="p-3.5 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-end gap-4 text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <span>Rows per page:</span>
                <select
                  value={rowsPerPage}
                  onChange={(e) => {
                    setRowsPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold outline-none cursor-pointer"
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

      {/* Comprehensive Report Modal (View Details via Eye Icon) */}
      {activeModalRequest && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-4xl w-full p-6 sm:p-8 shadow-2xl border border-slate-100 max-h-[92vh] flex flex-col animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <ClipboardCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                    <span>Audit Request Details: #{activeModalRequest.issue_no || (activeModalRequest.id ? `PA-${activeModalRequest.id}` : 'PA-1')}</span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    {activeModalRequest.model || activeModalRequest.stage || 'Stage'} • {activeModalRequest.process_operation || activeModalRequest.line || 'Line'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                  (activeModalRequest.status || '').toLowerCase().includes('approved')
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : (activeModalRequest.status || '').toLowerCase().includes('reject')
                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                    : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}>
                  {activeModalRequest.status || 'Pending Execution'}
                </span>
                <button
                  onClick={() => setActiveModalRequest(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Scrollable Content */}
            <div className="my-5 overflow-y-auto pr-1.5 space-y-5 text-xs flex-1">
              {/* Overview Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-slate-400 block font-semibold text-[10px] uppercase">Incident Date &amp; Shift</span>
                  <span className="font-bold text-slate-800 truncate block">
                    {formatDate(activeModalRequest.escalation_date || activeModalRequest.created_at)} ({activeModalRequest.shift || '—'})
                  </span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-slate-400 block font-semibold text-[10px] uppercase">Product</span>
                  <span className="font-bold text-slate-800 font-mono truncate block">{activeModalRequest.product || '—'}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-slate-400 block font-semibold text-[10px] uppercase">Department</span>
                  <span className="font-bold text-slate-800 truncate block">{activeModalRequest.department || '—'}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-slate-400 block font-semibold text-[10px] uppercase">Assigned Executor</span>
                  <span className="font-bold text-blue-700 truncate block">{activeModalRequest.executor || '—'}</span>
                </div>
              </div>

              {/* Observation Findings */}
              <div>
                <span className="text-slate-500 block font-bold mb-1.5 uppercase text-[10px] tracking-wider">
                  Audit Observation &amp; Findings
                </span>
                <p className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl text-slate-800 leading-relaxed whitespace-pre-wrap text-xs font-normal">
                  {activeModalRequest.issue_observation || activeModalRequest.problem || 'No observation recorded.'}
                </p>
              </div>

              {/* Root Cause */}
              {activeModalRequest.root_cause && (
                <div>
                  <span className="text-amber-700 block font-bold mb-1.5 uppercase text-[10px] tracking-wider">
                    Root Cause Analysis
                  </span>
                  <p className="p-3.5 bg-amber-50/50 border border-amber-200/60 rounded-2xl text-slate-800 leading-relaxed whitespace-pre-wrap text-xs">
                    {activeModalRequest.root_cause}
                  </p>
                </div>
              )}

              {/* Corrective Action */}
              {activeModalRequest.corrective_action && (
                <div>
                  <span className="text-blue-700 block font-bold mb-1.5 uppercase text-[10px] tracking-wider">
                    Corrective Actions &amp; Countermeasures
                  </span>
                  <p className="p-3.5 bg-blue-50/50 border border-blue-200/60 rounded-2xl text-slate-800 leading-relaxed whitespace-pre-wrap text-xs">
                    {activeModalRequest.corrective_action}
                  </p>
                </div>
              )}

              {/* Standardization Details */}
              {activeModalRequest.standardization_details && (
                <div>
                  <span className="text-slate-700 block font-bold mb-1.5 uppercase text-[10px] tracking-wider">
                    Standardization Details
                  </span>
                  <p className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl text-slate-800 leading-relaxed whitespace-pre-wrap text-xs">
                    {activeModalRequest.standardization_details}
                  </p>
                </div>
              )}

              {/* Creator Incident / Defect Attachments */}
              {parseAttachments(activeModalRequest.attachments).length > 0 && (
                <div>
                  <span className="text-slate-500 block font-bold mb-1.5 uppercase text-[10px] tracking-wider">
                    Creator Incident Attachments
                  </span>
                  <AttachmentChipList
                    attachments={parseAttachments(activeModalRequest.attachments)}
                    onPreview={(att) => setSelectedPreviewAttachment(att)}
                    readonly
                  />
                </div>
              )}

              {/* Executor Evidence Attachments */}
              {parseAttachments(activeModalRequest.action_attachments).length > 0 && (
                <div>
                  <span className="text-slate-500 block font-bold mb-1.5 uppercase text-[10px] tracking-wider">
                    Executor Action Evidence
                  </span>
                  <AttachmentChipList
                    attachments={parseAttachments(activeModalRequest.action_attachments)}
                    onPreview={(att) => setSelectedPreviewAttachment(att)}
                    readonly
                  />
                </div>
              )}

              {/* Remarks */}
              {(activeModalRequest.creator_remark || activeModalRequest.comments || activeModalRequest.remarks) && (
                <div>
                  <span className="text-slate-500 block font-bold mb-1.5 uppercase text-[10px] tracking-wider">
                    Sign-off Remarks &amp; Auditor Notes
                  </span>
                  <p className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl text-slate-800 leading-relaxed whitespace-pre-wrap text-xs">
                    {activeModalRequest.creator_remark || activeModalRequest.comments || activeModalRequest.remarks}
                  </p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between gap-3 pt-4 border-t border-slate-100 shrink-0">
              <div className="text-[11px] text-slate-400">
                Created by: <strong className="text-slate-700">{activeModalRequest.created_by || 'Quality Auditor'}</strong>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    populateForm(activeModalRequest);
                    setActiveModalRequest(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition cursor-pointer"
                >
                  Edit in Sign-off Form
                </button>
                <button
                  type="button"
                  onClick={() => setActiveModalRequest(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-semibold text-xs hover:bg-slate-50 transition cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Universal Attachment Preview Modal */}
      <AttachmentPreviewModal
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
        title="Export Audit Approval Queue"
        subtitle="Choose download format for process audit approvals view"
        recordCount={filtered.length}
        excelDescription="Full structured workbook with separate columns for observation details, root causes, corrective actions, and target dates."
        pdfDescription="Official landscape document formatted with India Nippon Electricals Limited branding, tables, and page numbers."
      />
    </div>
  );
};

export default ProcessAuditApprovals;
