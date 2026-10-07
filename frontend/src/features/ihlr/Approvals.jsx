import React, { useState, useEffect, useRef } from 'react';
import {
  ClipboardCheck,
  CheckCircle2,
  Search,
  Eye,
  ShieldAlert,
  Download,
  Check,
  Save,
  Loader2,
  ChevronLeft,
  ChevronRight,
  FileCheck,
  AlertCircle,
  UserCheck
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
import DateInput from '../../components/common/DateInput';
import { useModal } from '../../context/ModalContext';
import { useAuth } from '../../hooks/useAuth';
import { formatDateDDMMYYYY } from '../../utils/dateUtils';
import { isIhlrRequestVisibleToUser } from '../../utils/ihlrAuthUtils';

const IhlrApprovals = () => {
  const { user } = useAuth();
  const { success: modalSuccess, error: modalError, warning: modalWarning } = useModal();

  const userDept = (user?.department || (() => {
    try {
      const u = sessionStorage.getItem('todo_user') || localStorage.getItem('todo_user');
      return u ? JSON.parse(u)?.department : '';
    } catch {
      return '';
    }
  })() || '').trim().toUpperCase();

  const userRole = (user?.role || '').trim().toUpperCase();
  const isAdmin = userRole === 'ADMIN' || userDept === 'INCOMING QUALITY';

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [activeModalRequest, setActiveModalRequest] = useState(null);
  const [selectedPreviewAttachment, setSelectedPreviewAttachment] = useState(null);
  const [selectedRequest, setSelectedRequest] = useState(null);

  const cleanStr = (val) => (val || '').trim().toLowerCase().replace(/^(mr\.|mrs\.|ms\.)\s+/i, '');
  const uName = cleanStr(user?.name);
  const uEmail = cleanStr(user?.email);
  const uDept = cleanStr(user?.department);
  const uId = String(user?.id || '');

  const rRespPerson = cleanStr(selectedRequest?.resp_person);
  const rRespPersonList = rRespPerson.split(',').map((s) => cleanStr(s)).filter(Boolean);
  const rRespEmail = cleanStr(selectedRequest?.resp_person_email);
  const rRespDept = cleanStr(selectedRequest?.resp);
  const isCloser = Boolean(
    (rRespPerson && (uName === rRespPerson || rRespPersonList.includes(uName) || rRespPersonList.some((p) => p.includes(uName) || uName.includes(p)))) ||
    (rRespEmail && uEmail && (uEmail === rRespEmail || rRespEmail.includes(uEmail))) ||
    (rRespDept && uDept && uDept === rRespDept)
  );

  const rCreatedBy = cleanStr(selectedRequest?.created_by);
  const rCreatedEmail = cleanStr(selectedRequest?.created_by_email);
  const rCreatedId = String(selectedRequest?.created_by_id || '');
  const isRequester = Boolean(
    (rCreatedId && uId && rCreatedId === uId) ||
    (rCreatedBy && uName === rCreatedBy) ||
    (rCreatedEmail && uEmail && uEmail === rCreatedEmail)
  );

  const isSelectedClosed = String(selectedRequest?.status || '').toUpperCase() === 'CLOSED';

  // 1. Closer Fields (Occurrence Cause 5-Why: W1-W5, Action, Evidence Attachment, Target Date):
  //    Only the assigned Closer (or Admin) can update. Disabled for others.
  const canUpdateCloserFields = Boolean(
    selectedRequest && (isAdmin || isCloser) && (!isSelectedClosed || isAdmin)
  );

  // 2. Admin Only Fields (Remarks, Status):
  //    Strictly for Admins only. Hidden for regular users.
  const canUpdateAdminFields = Boolean(
    selectedRequest && isAdmin
  );

  const isLockedForCloserUser = !isAdmin && isSelectedClosed;

  // Form State for Closer Fields
  const [closerWhyWhy, setCloserWhyWhy] = useState(['', '', '', '', '']);
  const [closerAction, setCloserAction] = useState('');
  const [closerTargetDate, setCloserTargetDate] = useState('');
  const [closerRemarks, setCloserRemarks] = useState('');
  const [closerStatus, setCloserStatus] = useState('OPEN');
  const [isReassignOpen, setIsReassignOpen] = useState(false);
  const [reassignedDept, setReassignedDept] = useState('');
  const [reassignedPerson, setReassignedPerson] = useState('');
  const [dbUsers, setDbUsers] = useState([]);
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

  // Fetch users for department-based reassignment
  useEffect(() => {
    let isMounted = true;
    ihlrService.getUsers()
      .then((users) => {
        if (isMounted && Array.isArray(users)) {
          setDbUsers(users);
        }
      })
      .catch((err) => console.warn('Could not fetch DB users in Approvals:', err));

    return () => {
      isMounted = false;
    };
  }, []);

  const STANDARD_DEPTS = [
    'PRODUCTION',
    'MAINTENANCE',
    'PED',
    'MATERIALS',
    'MARKETING',
    'INCOMING QUALITY'
  ];

  const departmentList = Array.from(
    new Set([
      ...STANDARD_DEPTS,
      ...dbUsers.map((u) => (u.department || '').trim().toUpperCase()).filter(Boolean)
    ])
  ).sort();

  const getDepartmentUsers = (dept) => {
    if (!dept) return [];
    const targetDept = dept.trim().toUpperCase();
    return dbUsers.filter((u) => {
      const uDept = (u.department || '').trim().toUpperCase();
      return uDept === targetDept;
    });
  };

  const handleDeptChange = (newDept) => {
    setReassignedDept(newDept);
    const usersInDept = getDepartmentUsers(newDept);
    if (!usersInDept.some((u) => u.name === reassignedPerson)) {
      setReassignedPerson('');
    }
  };

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const data = await ihlrService.getRequests();
      // Enforce that closer non-admins only see requests where they are the selected person (resp_person) or creator
      const visibleData = isAdmin ? data : data.filter((r) => isIhlrRequestVisibleToUser(r, user));
      setRequests(visibleData);

      // If a request was already selected, update it with fresh data if visible
      if (selectedRequest) {
        const fresh = visibleData.find((r) => r.id === selectedRequest.id);
        if (fresh) {
          populateForm(fresh);
        } else if (visibleData.length > 0) {
          populateForm(visibleData[0]);
        } else {
          setSelectedRequest(null);
        }
      } else if (visibleData.length > 0) {
        populateForm(visibleData[0]);
      } else {
        setSelectedRequest(null);
      }
    } catch (err) {
      console.error('Failed to load IHLR requests for approval:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();

    let debounceTimer = null;
    const handleLiveUpdate = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        fetchRequests();
      }, 150);
    };

    window.addEventListener('ihlrLiveUpdate', handleLiveUpdate);

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      window.removeEventListener('ihlrLiveUpdate', handleLiveUpdate);
    };
  }, [user?.name, user?.email, user?.role, user?.department]);

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
    setReassignedDept(req.resp || '');
    setReassignedPerson(req.resp_person || '');
    setIsReassignOpen(false);

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

  // Submit Updates (Closer fields vs Requester fields vs Admin)
  const handleSaveCloser = async (e) => {
    if (e) e.preventDefault();
    if (!selectedRequest) return;

    if (isLockedForCloserUser) {
      modalError('This incident is closed. Only Admin can update closed reports.');
      return;
    }

    if (!canUpdateCloserFields && !isAdmin) {
      modalError('You do not have permission to update fields on this request.');
      return;
    }

    setIsSaving(true);
    setSuccessMessage('');
    setErrorMessage('');

    try {
      const payload = {};

      // 1. Closer Fields (Occurrence Cause 5-Why: W1-W5, Action, Evidence, Target Date)
      if (canUpdateCloserFields || isAdmin) {
        let uploadedList = [];
        if (newEvidenceFiles.length > 0) {
          uploadedList = await ihlrService.uploadAttachments(newEvidenceFiles);
        }
        const combinedEvidence = [...existingEvidence, ...uploadedList];

        payload.prod_why_why = closerWhyWhy;
        payload.action = closerAction;
        payload.evidence_attachment = JSON.stringify(combinedEvidence);
        payload.target_date = closerTargetDate || null;

        // When closer (non-admin) updates their fields, automatically set status to IN_PROGRESS unless already CLOSED
        if (!isAdmin && (selectedRequest.status || '').toUpperCase() !== 'CLOSED') {
          payload.status = 'IN_PROGRESS';
        }
      }

      // 2. Admin Only Fields (Remarks, Status, Optional Reassignment)
      if (isAdmin) {
        payload.remarks = closerRemarks;
        payload.status = closerStatus;

        if (isReassignOpen) {
          if (reassignedDept && reassignedDept !== selectedRequest.resp) {
            payload.resp = reassignedDept;
          }
          if (reassignedPerson && reassignedPerson !== selectedRequest.resp_person) {
            payload.resp_person = reassignedPerson;
            const names = reassignedPerson.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
            const matchedEmails = dbUsers
              .filter((u) => names.includes((u.name || '').trim().toLowerCase()))
              .map((u) => u.email)
              .filter(Boolean);
            if (matchedEmails.length > 0) {
              payload.resp_person_email = matchedEmails.join(', ');
            }
          }
        }
      }

      // 3. User Context for resilient backend permission checking
      if (user) {
        payload.user = {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          department: user.department
        };
      }

      const updated = await ihlrService.updateRequest(selectedRequest.id, payload);

      const isReassigned = isAdmin && isReassignOpen && (
        (reassignedPerson && reassignedPerson !== selectedRequest.resp_person) ||
        (reassignedDept && reassignedDept !== selectedRequest.resp)
      );

      const msg = isAdmin
        ? isReassigned
          ? `Report updated & reassigned to ${reassignedPerson} (${reassignedDept}) successfully for ${selectedRequest.req_no}!`
          : `Report & status sign-off updated successfully for ${selectedRequest.req_no}!`
        : `Closer details submitted successfully for ${selectedRequest.req_no}! Admin will review and sign off status.`;

      setSuccessMessage(msg);
      setNewEvidenceFiles([]);
      setIsReassignOpen(false);
      if (updated) {
        populateForm(updated);
      }
      await fetchRequests();
      modalSuccess(msg);

      setTimeout(() => {
        setSuccessMessage('');
      }, 4000);
    } catch (err) {
      console.error('Failed to update request:', err);
      setErrorMessage(err.message || 'Failed to update fields');
      modalError(err.message || 'Failed to update fields');
    } finally {
      setIsSaving(false);
    }
  };

  // Filter requests
  const filtered = requests.filter((r) => {
    // Restrict visibility for closer non-admins strictly to their assigned requests (or created)
    if (!isAdmin && !isIhlrRequestVisibleToUser(r, user)) return false;

    const matchesSearch =
      (r.req_no || '').toLowerCase().includes(search.toLowerCase()) ||
      (r.problem || '').toLowerCase().includes(search.toLowerCase()) ||
      (r.model || '').toLowerCase().includes(search.toLowerCase()) ||
      (r.received_from || '').toLowerCase().includes(search.toLowerCase()) ||
      (r.remarks || '').toLowerCase().includes(search.toLowerCase()) ||
      (r.analysis_done_by || '').toLowerCase().includes(search.toLowerCase()) ||
      (r.resp_person || '').toLowerCase().includes(search.toLowerCase());
    const matchesStatus = selectedStatus === 'All' || r.status === selectedStatus;
    return matchesSearch && matchesStatus;
  });

  // Pagination calculation
  const totalRecords = filtered.length;
  const totalPages = Math.ceil(totalRecords / rowsPerPage) || 1;
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = Math.min(startIndex + rowsPerPage, totalRecords);
  const paginatedRequests = filtered.slice(startIndex, endIndex);

  // Open Export Modal with validation check
  const handleOpenExportModal = () => {
    if (!filtered || filtered.length === 0) {
      modalWarning('No data available to export. Please adjust your search or status filter.', 'No Data Available');
      return;
    }
    setShowExportModal(true);
  };

  // Export to Excel (.xlsx)
  const handleExportExcel = () => {
    try {
      if (!filtered || filtered.length === 0) {
        modalWarning('No data available to export. Cannot download an empty file.', 'No Data Available');
        setShowExportModal(false);
        return;
      }

      const exportData = filtered.map((r, index) => ({
        'SL NO': index + 1,
        'REQ NO': String(r.req_no).startsWith('IHLR-') ? r.req_no : `#${r.req_no}`,
        'DATE': formatDateDDMMYYYY(r.batch_date),
        'SHIFT': String(r.shift || '').toLowerCase().includes('gen') ? r.shift : String(r.shift || '').startsWith('Shift') ? r.shift : `Shift ${r.shift}`,
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
        'TARGET DATE': formatDateDDMMYYYY(r.target_date),
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
      modalError('Failed to export to Excel: ' + err.message);
    }
  };

  // Export to PDF (.pdf)
  const handleExportPdf = () => {
    try {
      if (!filtered || filtered.length === 0) {
        modalWarning('No data available to export. Cannot download an empty file.', 'No Data Available');
        setShowExportModal(false);
        return;
      }

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
        formatDateDDMMYYYY(r.batch_date),
        `${r.problem || '—'}\n(${r.model || '—'})`,
        r.problem_detected_at || '—',
        r.four_m || '—',
        r.action || '—',
        formatDateDDMMYYYY(r.target_date),
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
      modalError('Failed to export to PDF: ' + err.message);
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
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {isAdmin ? 'IHLR Approvals & Closer Log' : 'My Approvals & Closer Log'}
            </h1>
            {!isAdmin && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                Assigned to: <strong>{user?.name || user?.email}</strong>
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            {isAdmin
              ? 'Update 5-Why occurrence causes, corrective actions, evidence attachments, and sign off incident closures.'
              : `Review and submit 5-Why root cause and corrective actions for requests assigned to you (${user?.name || user?.email}).`}
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

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  CURRENT ASSIGNED CLOSER <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  readOnly
                  disabled
                  value={selectedRequest ? `${selectedRequest.resp_person || 'Not Assigned'} (${selectedRequest.resp || 'N/A'})` : ''}
                  placeholder="Click a row on the right to select"
                  className="w-full px-3.5 py-2.5 bg-slate-100/80 border border-slate-200 rounded-xl text-slate-700 font-semibold cursor-not-allowed select-none outline-none truncate"
                />
              </div>
            </div>

            {/* Separator */}
            <div className="pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-black uppercase tracking-wider text-amber-700 flex items-center gap-1.5">
                  <span>Occurrence Cause (Production Team - 5 Why)</span>
                  {selectedRequest && (
                    canUpdateCloserFields ? (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-200">
                        Closer
                      </span>
                    ) : (
                      <span className="text-[9px] font-medium px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded border border-slate-200">
                        Closer Only (Read-Only)
                      </span>
                    )
                  )}
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
                      disabled={!canUpdateCloserFields}
                      value={closerWhyWhy[idx] || ''}
                      onChange={(e) => handleWhyChange(idx, e.target.value)}
                      placeholder={
                        !selectedRequest
                          ? 'Select request on right'
                          : canUpdateCloserFields
                          ? `Enter ${label} cause...`
                          : 'Read-only (Closer only)'
                      }
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none disabled:bg-slate-100/70 disabled:text-slate-500 disabled:cursor-not-allowed transition"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Action Field (Image 1: Action Words) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <span>ACTION</span>
                  <span className="text-rose-500">*</span>
                  {selectedRequest && (
                    canUpdateCloserFields ? (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-200">
                        Closer
                      </span>
                    ) : (
                      <span className="text-[9px] font-medium px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded border border-slate-200">
                        Closer Only (Read-Only)
                      </span>
                    )
                  )}
                </label>
              </div>
              <textarea
                rows={2}
                disabled={!canUpdateCloserFields}
                value={closerAction}
                onChange={(e) => setCloserAction(e.target.value)}
                placeholder={
                  !selectedRequest
                    ? 'Click a row on the right to select'
                    : canUpdateCloserFields
                    ? 'Describe corrective actions taken / countermeasures...'
                    : 'Read-only (Closer only)'
                }
                className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none disabled:bg-slate-100/70 disabled:text-slate-500 disabled:cursor-not-allowed transition resize-none"
              />
            </div>

            {/* Evidence Attachment (Image 1: Format PPT, JPEG, EXCEL & PDF) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <span>EVIDENCE ATTACHMENT</span>
                  {selectedRequest && (
                    canUpdateCloserFields ? (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-200">
                        Closer
                      </span>
                    ) : (
                      <span className="text-[9px] font-medium px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded border border-slate-200">
                        Closer Only (Read-Only)
                      </span>
                    )
                  )}
                </label>
                <span className="text-[10px] text-slate-400 font-mono">PPT, JPEG, EXCEL &amp; PDF</span>
              </div>

              {/* Styled File Input Button (matching Image 2) */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={!canUpdateCloserFields}
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
                    onRemove={canUpdateCloserFields ? (idx) => handleRemoveExistingEvidence(idx) : undefined}
                  />
                )}
                {previewableNewFiles.length > 0 && (
                  <AttachmentChipList
                    attachments={previewableNewFiles}
                    onPreview={(att) => setSelectedPreviewAttachment(att)}
                    onRemove={canUpdateCloserFields ? (idx) => handleRemoveNewEvidence(idx) : undefined}
                  />
                )}
              </div>
            </div>

            {/* Target Date */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <span>TARGET DATE</span>
                  {selectedRequest && (
                    canUpdateCloserFields ? (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-200">
                        Closer
                      </span>
                    ) : (
                      <span className="text-[9px] font-medium px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded border border-slate-200">
                        Closer Only (Read-Only)
                      </span>
                    )
                  )}
                </label>
              </div>
              <DateInput
                disabled={!canUpdateCloserFields}
                value={closerTargetDate}
                onChange={(e) => setCloserTargetDate(e.target.value)}
                className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none disabled:bg-slate-100/70 disabled:text-slate-500 disabled:cursor-not-allowed transition"
              />
            </div>

            {/* Pending Sign-Off Alert Banner */}
            {selectedRequest && !isSelectedClosed && (
              <div className="p-2.5 rounded-xl border border-amber-200 bg-amber-50/70 text-amber-900 text-[11px] flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="leading-tight">
                  <span className="font-bold">
                    {isAdmin ? 'Admin Review & Sign-Off: ' : 'Closer Action: '}
                  </span>
                  <span className="text-amber-800">
                    {isAdmin
                      ? 'Closer countermeasures review. Provide validation remarks and finalize status below.'
                      : 'Submit 5-Why root cause and corrective countermeasures. Quality Admin will review remarks and finalize status.'}
                  </span>
                </div>
              </div>
            )}

            {/* Remarks, Status & Reassign - ONLY FOR ADMINS */}
            {isAdmin && (
              <>
                {/* Reassign Closer (Optional - Button trigger to expand) */}
                <div className="space-y-2">
                  {!isReassignOpen ? (
                    <div className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200/90 rounded-xl">
                      <div className="flex items-center gap-2">
                        <UserCheck className="w-4 h-4 text-blue-600" />
                        <div className="text-left">
                          <div className="text-[11px] font-bold text-slate-800 flex items-center gap-1.5">
                            <span>Reassign Closer</span>
                            <span className="text-[9px] font-bold px-1.5 py-0.2 bg-purple-50 text-purple-700 rounded border border-purple-200">
                              Admin
                            </span>
                            <span className="text-[10px] text-slate-400 font-normal">(Optional)</span>
                          </div>
                          <div className="text-[10px] text-slate-500">
                            Current: <strong className="text-slate-700">{selectedRequest?.resp_person || 'Not Assigned'}</strong> ({selectedRequest?.resp || 'N/A'})
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setIsReassignOpen(true);
                          setReassignedDept(selectedRequest?.resp || '');
                          setReassignedPerson(selectedRequest?.resp_person || '');
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs border border-blue-200 shadow-2xs transition flex items-center gap-1.5 cursor-pointer shrink-0"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>Reassign</span>
                      </button>
                    </div>
                  ) : (
                    <div className="p-3 bg-gradient-to-r from-blue-50/70 via-indigo-50/50 to-slate-50 rounded-xl border border-blue-200/90 space-y-2.5 animate-in fade-in">
                      <div className="flex items-center justify-between pb-1.5 border-b border-blue-200/60">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                          <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                          <span>REASSIGN CLOSER</span>
                          <span className="text-[9px] font-bold px-1.5 py-0.5 bg-purple-50 text-purple-700 rounded border border-purple-200">
                            Admin
                          </span>
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setIsReassignOpen(false);
                            setReassignedDept(selectedRequest?.resp || '');
                            setReassignedPerson(selectedRequest?.resp_person || '');
                          }}
                          className="text-[11px] text-slate-500 hover:text-rose-600 font-semibold cursor-pointer underline flex items-center gap-1"
                        >
                          Cancel
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {/* Department (Resp) */}
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                            Department (Resp) *
                          </label>
                          <select
                            value={reassignedDept}
                            onChange={(e) => handleDeptChange(e.target.value)}
                            className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-xl font-semibold text-slate-800 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none cursor-pointer"
                          >
                            <option value="">Select Department</option>
                            {departmentList.map((dept) => (
                              <option key={dept} value={dept}>
                                {dept}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Department-based User Name */}
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                            User Name (Dep Based) *
                          </label>
                          <select
                            value={reassignedPerson}
                            disabled={!reassignedDept}
                            onChange={(e) => setReassignedPerson(e.target.value)}
                            className={`w-full px-2.5 py-2 border rounded-xl font-semibold text-xs outline-none transition ${
                              reassignedDept
                                ? 'bg-white border-slate-300 text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer'
                                : 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                            }`}
                          >
                            <option value="">
                              {!reassignedDept
                                ? 'Select Dept First'
                                : getDepartmentUsers(reassignedDept).length === 0
                                ? 'No users in this dept'
                                : 'Select User Name'}
                            </option>
                            {reassignedPerson && !getDepartmentUsers(reassignedDept).some((u) => u.name === reassignedPerson) && (
                              <option value={reassignedPerson}>{reassignedPerson}</option>
                            )}
                            {getDepartmentUsers(reassignedDept).map((u) => (
                              <option key={u.id} value={u.name}>
                                {u.name} {u.email ? `(${u.email})` : ''}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <p className="text-[10px] text-slate-500 leading-tight">
                        Selecting a new department and person will transfer the 5-Why root cause and countermeasure responsibility to them.
                      </p>
                    </div>
                  )}
                </div>

                {/* Remarks */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <span>REMARKS</span>
                      <span className="text-rose-500">*</span>
                      {selectedRequest && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 bg-purple-50 text-purple-700 rounded border border-purple-200">
                          Admin
                        </span>
                      )}
                    </label>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {1000 - closerRemarks.length} chars left
                    </span>
                  </div>
                  <textarea
                    rows={2}
                    maxLength={1000}
                    value={closerRemarks}
                    onChange={(e) => setCloserRemarks(e.target.value)}
                    placeholder={
                      !selectedRequest
                        ? 'Click a row on the right to select'
                        : 'Enter remarks and validation summary...'
                    }
                    className="w-full px-3.5 py-2 border rounded-xl text-slate-800 outline-none transition resize-none bg-white border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Provide admin sign-off or review remarks.
                  </p>
                </div>

                {/* Status */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <span>STATUS</span>
                      <span className="text-rose-500">*</span>
                      {selectedRequest && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 bg-purple-50 text-purple-700 rounded border border-purple-200">
                          Admin
                        </span>
                      )}
                      {isSelectedClosed && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded border border-emerald-200">
                          Closed
                        </span>
                      )}
                    </label>
                  </div>
                  <select
                    value={closerStatus}
                    onChange={(e) => setCloserStatus(e.target.value)}
                    className="w-full px-3.5 py-2.5 border rounded-xl font-bold text-slate-800 outline-none transition bg-white border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
                  >
                    <option value="OPEN">OPEN</option>
                    <option value="IN_PROGRESS">IN PROGRESS</option>
                    <option value="CLOSED">CLOSED</option>
                  </select>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Select OPEN, IN PROGRESS, or CLOSED to finalize status.
                  </p>
                </div>
              </>
            )}

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
              ) : isLockedForCloserUser ? (
                <div className="w-full py-3 px-4 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 font-bold text-xs select-none text-center shadow-2xs flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Incident Closed — Updates Locked for Users (Admin Only)</span>
                </div>
              ) : !canUpdateCloserFields && !isAdmin ? (
                <div className="w-full py-3 px-4 rounded-xl border border-slate-200 bg-slate-100 text-slate-600 font-bold text-xs select-none text-center shadow-2xs flex items-center justify-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-slate-500" />
                  <span>Read Only Access — Assigned Closer or Admin Only</span>
                </div>
              ) : (
                <button
                  type="submit"
                  disabled={isSaving}
                  className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs shadow-md hover:shadow-lg transition transform active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving Updates...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>
                        {isAdmin
                          ? 'Save & Update Report'
                          : 'Update Closer Log'}
                      </span>
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
              onClick={handleOpenExportModal}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs hover:shadow transition transform active:scale-95 cursor-pointer shrink-0"
              id="approvals-export-view-btn"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export View</span>
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
                        <p className="font-semibold text-slate-600">
                          {isAdmin ? 'No requests found matching criteria' : 'No IHLR requests assigned to you found matching criteria'}
                        </p>
                        <p className="text-[11px] text-slate-400 mt-1">
                          {isAdmin ? 'Try clearing filters or search parameters.' : `When a requester assigns a request to ${user?.name || 'you'}, it will appear here.`}
                        </p>
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
                            {formatDateDDMMYYYY(r.batch_date)}
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
                            <IhlrAttachmentThumbnail
                              rawAttachment={r.evidence_attachment || r.defect_image}
                            />
                          </td>
                          <td className="py-3.5 px-3 text-center whitespace-nowrap">
                            {r.status === 'CLOSED' ? (
                              <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                CLOSED
                              </span>
                            ) : !isAdmin ? (
                              <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                PENDING
                              </span>
                            ) : r.status === 'IN_PROGRESS' ? (
                              <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                IN PROGRESS
                              </span>
                            ) : (
                              <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                OPEN
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
