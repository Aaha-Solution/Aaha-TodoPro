import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { 
  FileText, 
  UploadCloud, 
  Paperclip,
  X,
  Send, 
  ShieldAlert, 
  Trash2, 
  ArrowLeft,
  FileSpreadsheet,
  File as FileIcon,
  Presentation,
  Eye,
  Download,
  Image as ImageIcon,
  Check,
  ChevronDown,
  Search,
  Users
} from 'lucide-react';
import { ihlrService } from '../../services/ihlrService';
import { useAuth } from '../../hooks/useAuth';
import AttachmentPreviewModal from '../../components/common/AttachmentPreviewModal';
import DateInput from '../../components/common/DateInput';
import { useModal } from '../../context/ModalContext';
import { getTodayDateInput, formatDateDDMMYYYY } from '../../utils/dateUtils';

const IhlrCreateRequest = () => {
  const { alert, success, error, warning } = useModal();
  const navigate = useNavigate();
  const { user } = useAuth();

  const userDept = (user?.department || (() => {
    try {
      const u = sessionStorage.getItem('todo_user') || localStorage.getItem('todo_user');
      return u ? JSON.parse(u)?.department : '';
    } catch {
      return '';
    }
  })() || '').trim().toUpperCase();

  const userRole = (user?.role || '').trim().toUpperCase();
  const isIncomingQuality = userDept === 'INCOMING QUALITY';
  const isAdmin = userRole === 'ADMIN' || isIncomingQuality;
  const canCreate = isIncomingQuality || isAdmin;

  const [submitting, setSubmitting] = useState(false);
  const [dbUsers, setDbUsers] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [previewAttachment, setPreviewAttachment] = useState(null);

  const getDraftKey = () => {
    let uid = user?.id || user?.email;
    if (!uid) {
      try {
        const u = sessionStorage.getItem('todo_user') || localStorage.getItem('todo_user');
        if (u) {
          const parsed = JSON.parse(u);
          uid = parsed?.id || parsed?.email;
        }
      } catch {}
    }
    return `ihlr_create_request_draft_${uid || 'default'}`;
  };

  const defaultFormData = {
    req_no: 'IHLR-1',
    batch_date: getTodayDateInput(),
    shift: '',
    problem: '',
    model: '',
    problem_detected_at: '',
    received_from: '',
    analysis_done_by: '',
    actual_qty: '',
    four_m: '',
    resp: '',
    resp_person: '',
    status: 'OPEN'
  };

  const getSavedDraft = () => {
    try {
      const key = getDraftKey();
      const raw =
        sessionStorage.getItem(key) ||
        sessionStorage.getItem('ihlr_create_request_draft') ||
        localStorage.getItem(key) ||
        localStorage.getItem('ihlr_create_request_draft');
      if (raw) {
        return JSON.parse(raw);
      }
    } catch (e) {
      console.warn('Failed to parse IHLR draft:', e);
    }
    return null;
  };

  const [formData, setFormData] = useState(() => {
    const saved = getSavedDraft();
    if (saved?.formData) {
      return {
        ...defaultFormData,
        ...saved.formData,
        status: 'OPEN'
      };
    }
    return defaultFormData;
  });

  const [qaWhyWhy, setQaWhyWhy] = useState(() => {
    const saved = getSavedDraft();
    if (Array.isArray(saved?.qaWhyWhy)) {
      return saved.qaWhyWhy;
    }
    return ['', '', '', '', ''];
  });

  const [hasRestoredDraft, setHasRestoredDraft] = useState(() => {
    const saved = getSavedDraft();
    if (saved?.formData) {
      const d = saved.formData;
      return Boolean(
        d.problem || d.model || d.shift || d.four_m || d.resp || d.resp_person ||
        d.received_from || d.analysis_done_by || d.problem_detected_at || d.actual_qty ||
        (saved.qaWhyWhy && saved.qaWhyWhy.some(w => w && w.trim()))
      );
    }
    return false;
  });

  // Auto-save form inputs to sessionStorage so data is maintained across tab switches
  useEffect(() => {
    const key = getDraftKey();
    const isDirty = Boolean(
      formData.problem ||
      formData.model ||
      formData.shift ||
      formData.four_m ||
      formData.resp ||
      formData.resp_person ||
      formData.received_from ||
      formData.analysis_done_by ||
      formData.problem_detected_at ||
      formData.actual_qty ||
      qaWhyWhy.some((w) => w && w.trim())
    );

    if (isDirty) {
      try {
        sessionStorage.setItem(key, JSON.stringify({ formData, qaWhyWhy, updatedAt: new Date().toISOString() }));
      } catch (err) {
        console.warn('IHLR draft save error:', err);
      }
    }
  }, [formData, qaWhyWhy]);

  const handleResetForm = () => {
    const key = getDraftKey();
    try {
      sessionStorage.removeItem(key);
      sessionStorage.removeItem('ihlr_create_request_draft');
      localStorage.removeItem(key);
      localStorage.removeItem('ihlr_create_request_draft');
    } catch {}
    setFormData((prev) => ({
      ...defaultFormData,
      req_no: prev.req_no || 'IHLR-1',
    }));
    setQaWhyWhy(['', '', '', '', '']);
    setAttachments([]);
    setHasRestoredDraft(false);
  };

  useEffect(() => {
    let isMounted = true;
    ihlrService.getNextReqNo()
      .then((nextReqNo) => {
        if (isMounted && nextReqNo) {
          setFormData((prev) => ({ ...prev, req_no: nextReqNo }));
        }
      })
      .catch((err) => {
        console.warn('Could not fetch next req_no:', err);
      });

    ihlrService.getUsers()
      .then((users) => {
        if (isMounted && Array.isArray(users)) {
          setDbUsers(users);
        }
      })
      .catch((err) => console.warn('Could not fetch DB users:', err));

    return () => {
      isMounted = false;
    };
  }, []);

  const getDepartmentUsers = (dept) => {
    if (!dept) return [];
    const targetDept = dept.trim().toUpperCase();
    return dbUsers.filter((u) => {
      const uDept = (u.department || '').trim().toUpperCase();
      return uDept === targetDept;
    });
  };

  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const userDropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (userDropdownRef.current && !userDropdownRef.current.contains(e.target)) {
        setIsUserDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getSelectedUsers = () => {
    if (!formData.resp_person) return [];
    return formData.resp_person
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  };

  const handleToggleUser = (userName) => {
    const current = getSelectedUsers();
    let updated;
    if (current.includes(userName)) {
      updated = current.filter((u) => u !== userName);
    } else {
      updated = [...current, userName];
    }
    setFormData({ ...formData, resp_person: updated.join(', ') });
  };

  const handleRemoveUser = (userName, e) => {
    if (e) e.stopPropagation();
    const current = getSelectedUsers();
    const updated = current.filter((u) => u !== userName);
    setFormData({ ...formData, resp_person: updated.join(', ') });
  };

  const handleSelectAllUsers = () => {
    const deptUsers = getDepartmentUsers(formData.resp).map((u) => u.name);
    setFormData({ ...formData, resp_person: deptUsers.join(', ') });
  };

  const handleClearAllUsers = () => {
    setFormData({ ...formData, resp_person: '' });
  };

  const handleQaWhyChange = (index, value) => {
    const updated = [...qaWhyWhy];
    updated[index] = value;
    setQaWhyWhy(updated);
  };

  const getFileMeta = (file) => {
    const ext = (file?.type || (file?.name ? file.name.split('.').pop() : '') || '').toUpperCase();
    if (file?.isImage || ['PNG', 'JPG', 'JPEG', 'GIF', 'WEBP', 'SVG'].includes(ext)) {
      return {
        badgeBg: 'bg-blue-50 text-blue-600 border-blue-200',
        icon: ImageIcon,
        typeName: 'Image',
      };
    }
    if (file?.isPdf || ext === 'PDF') {
      return {
        badgeBg: 'bg-red-50 text-red-600 border-red-200',
        icon: FileText,
        typeName: 'PDF Document',
      };
    }
    if (file?.isExcel || ['XLS', 'XLSX', 'CSV', 'XLSM'].includes(ext)) {
      return {
        badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        icon: FileSpreadsheet,
        typeName: 'Excel Spreadsheet',
      };
    }
    if (file?.isPpt || ['PPT', 'PPTX', 'PPSX'].includes(ext)) {
      return {
        badgeBg: 'bg-orange-50 text-orange-700 border-orange-200',
        icon: Presentation,
        typeName: 'PowerPoint Presentation',
      };
    }
    if (file?.isWord || ['DOC', 'DOCX'].includes(ext)) {
      return {
        badgeBg: 'bg-indigo-50 text-indigo-700 border-indigo-200',
        icon: FileText,
        typeName: 'Word Document',
      };
    }
    return {
      badgeBg: 'bg-slate-50 text-slate-700 border-slate-200',
      icon: FileIcon,
      typeName: 'Document',
    };
  };

  const processFiles = (fileList) => {
    const files = Array.from(fileList || []);
    if (files.length > 0) {
      const newAttachments = files.map((file) => {
        const ext = file.name.split('.').pop()?.toUpperCase() || 'FILE';
        const isImage = ['PNG', 'JPG', 'JPEG', 'GIF', 'WEBP', 'SVG'].includes(ext);
        const isPdf = ext === 'PDF';
        const isExcel = ['XLS', 'XLSX', 'CSV', 'XLSM'].includes(ext);
        const isPpt = ['PPT', 'PPTX', 'PPSX'].includes(ext);
        const isWord = ['DOC', 'DOCX'].includes(ext);

        let previewUrl = '';
        try {
          previewUrl = URL.createObjectURL(file);
        } catch {
          previewUrl = '';
        }

        return {
          name: file.name,
          size: `${(file.size / (1024 * 1024)).toFixed(2)} MB`,
          type: ext,
          date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
          file,
          url: previewUrl,
          isImage,
          isPdf,
          isExcel,
          isPpt,
          isWord,
        };
      });

      setAttachments((prev) => [...prev, ...newAttachments]);
    }
  };

  const handleFileUpload = (e) => {
    processFiles(e.target.files);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    processFiles(e.dataTransfer.files);
  };

  const removeAttachment = (index) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canCreate) {
      warning('Access Denied: Only Administrators from the INCOMING QUALITY department are authorized to create IHLR requests.');
      return;
    }
    if (!formData.problem || !formData.model) {
      warning('Please fill in the Problem Description and Model.');
      return;
    }
    if (!formData.shift) {
      warning('Please select a Shift.');
      return;
    }
    if (!formData.four_m) {
      warning('Please select a 4M Category.');
      return;
    }
    if (!formData.resp) {
      warning('Please select a Responsibility department.');
      return;
    }
    if (!formData.resp_person || getSelectedUsers().length === 0) {
      warning('Please select at least one User Name (Responsible Person) based on the department.');
      return;
    }

    setSubmitting(true);
    try {
      // Upload physical attachment files if any
      let uploadedFilesMeta = [];
      const filesToUpload = attachments
        .filter((att) => att.file && (typeof window !== 'undefined' && window.File ? att.file instanceof window.File : true))
        .map((att) => att.file);

      if (filesToUpload.length > 0) {
        try {
          uploadedFilesMeta = await ihlrService.uploadAttachments(filesToUpload);
        } catch (uploadErr) {
          console.warn('Attachments upload notice:', uploadErr);
        }
      }

      const finalAttachments = attachments.map((att) => {
        const match = uploadedFilesMeta.find((u) => u.name === att.name || u.filename === att.name);
        const dbUrl = match?.url || (match?.id ? `/api/ihlr/attachments/${match.id}` : (att.url || ''));
        return {
          id: match?.id || null,
          name: att.name,
          size: match?.size || att.size,
          type: match?.type || att.type,
          date: att.date || new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
          path: match?.path || dbUrl,
          url: dbUrl,
          filename: match?.filename || att.name,
          isImage: att.isImage,
          isPdf: att.isPdf,
          isExcel: att.isExcel,
          isPpt: att.isPpt,
        };
      });

      const creatorName = user?.name || user?.email || 'Incoming Quality Admin';
      const creatorEmail = user?.email || '';
      const creatorId = user?.id || null;

      const selectedNames = getSelectedUsers();
      const selectedPersonUsers = dbUsers.filter((u) =>
        selectedNames.some((name) => (u.name || '').trim().toLowerCase() === name.toLowerCase())
      );
      const combinedAssignedEmails = selectedPersonUsers
        .map((u) => u.email)
        .filter(Boolean)
        .join(', ');

      await ihlrService.createRequest({
        ...formData,
        batch_date: formData.batch_date || new Date().toISOString().split('T')[0],
        actual_qty: formData.actual_qty ? Number(formData.actual_qty) : 1,
        qa_why_why: qaWhyWhy,
        defect_image: finalAttachments.length > 0 ? JSON.stringify(finalAttachments) : '',
        attachments: finalAttachments,
        created_by: creatorName,
        created_by_id: creatorId,
        created_by_email: creatorEmail,
        resp_person_email: combinedAssignedEmails || '',
      });
      window.dispatchEvent(new Event('refreshNotifications'));
      const draftKey = getDraftKey();
      try {
        sessionStorage.removeItem(draftKey);
        sessionStorage.removeItem('ihlr_create_request_draft');
        localStorage.removeItem(draftKey);
        localStorage.removeItem('ihlr_create_request_draft');
      } catch {}
      await success(`IHLR Analysis Report ${formData.req_no} submitted successfully!\n\n✓ In-App notifications sent to ${creatorName} and assigned personnel (${formData.resp_person}).\n✓ Email notifications triggered to all assigned parties.`);
      navigate('/ihlr/my-requests');
    } catch (err) {
      error('Failed to submit IHLR Report: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!canCreate) {
    return (
      <div className="space-y-6 w-full pb-16">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 sm:p-12 text-center max-w-xl mx-auto my-12">
          <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-amber-100 shadow-sm">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Incoming Quality Authorization Required</h2>
          <p className="text-sm text-gray-500 mb-6 leading-relaxed">
            In this system, only Administrators from the <span className="font-semibold text-gray-800">INCOMING QUALITY</span> department have privileges to create new IHLR defect analysis requests.
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => navigate('/ihlr/dashboard')}
              className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-sm rounded-xl transition cursor-pointer"
            >
              Go to Dashboard
            </button>
            <button
              onClick={() => navigate('/ihlr/my-requests')}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-xl shadow-sm transition cursor-pointer"
            >
              View Requests
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full pb-16">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <button
            onClick={() => navigate('/ihlr/dashboard')}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 mb-1 transition cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Dashboard</span>
          </button>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Create IHLR Analysis Report
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Log line rejection incident, 5-Why problem root cause, and occurrence containment.
          </p>
        </div>
      </div>

      {hasRestoredDraft && (
        <div className="flex items-center justify-between px-4 py-2.5 bg-blue-50/90 border border-blue-200/90 rounded-xl text-xs text-blue-800 shadow-2xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
            <span><strong>Draft Restored:</strong> Your form inputs were preserved across tab switching.</span>
          </div>
          <button
            type="button"
            onClick={handleResetForm}
            className="text-xs text-blue-700 hover:text-red-600 font-semibold underline ml-3 cursor-pointer shrink-0 transition"
          >
            Discard Draft
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Requestor & Incident Information */}
        <div className="bg-white rounded-2xl p-6 sm:p-7 border border-slate-200/90 shadow-2xs space-y-5">
          <div className="flex items-start gap-3 pb-4 border-b border-slate-100">
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                1. Requestor &amp; Line Defect Details (Yellow Phase)
              </h2>
              <p className="text-xs text-slate-500">
                Primary defect parameters, detection stage, and line responsibility.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            {/* Req No */}
            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1 text-[11px]">
                Req No (Auto-Generated) *
              </label>
              <input
                type="text"
                readOnly
                value={formData.req_no}
                className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl font-mono font-bold text-slate-700 focus:outline-none cursor-not-allowed select-none"
                required
              />
            </div>

            {/* Incident Date */}
            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1 text-[11px] flex items-center justify-between">
                <span>Incident Date *</span>
                <span className="text-[10px] text-slate-400 font-mono font-normal">DD/MM/YYYY</span>
              </label>
              <DateInput
                value={formData.batch_date}
                onChange={(e) => setFormData({ ...formData, batch_date: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none font-medium"
                required
              />
            </div>

            {/* Shift */}
            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1 text-[11px]">
                Shift *
              </label>
              <select
                value={formData.shift}
                onChange={(e) => setFormData({ ...formData, shift: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none font-medium"
                required
              >
                <option value="">Select Shift</option>
                <option value="Shift 1">Shift 1</option>
                <option value="Shift 2">Shift 2</option>
                <option value="Shift 3">Shift 3</option>
                <option value="General">General</option>
              </select>
            </div>

            {/* Model */}
            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1 text-[11px]">
                Model Name / Part *
              </label>
              <input
                type="text"
                placeholder="e.g. OLS LONG ARM"
                value={formData.model}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                required
              />
            </div>

            {/* Problem Description */}
            <div className="sm:col-span-2">
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1 text-[11px]">
                Problem / Defect Description *
              </label>
              <input
                type="text"
                placeholder="e.g. Low voltage / Improper sensor solder"
                value={formData.problem}
                onChange={(e) => setFormData({ ...formData, problem: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none font-semibold"
                required
              />
            </div>

            {/* Problem Detected At */}
            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1 text-[11px]">
                Problem Detected At
              </label>
              <input
                type="text"
                placeholder="e.g. Final Testing"
                value={formData.problem_detected_at}
                onChange={(e) => setFormData({ ...formData, problem_detected_at: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
              />
            </div>

            {/* Received From */}
            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1 text-[11px]">
                Received From (Line/Cell)
              </label>
              <input
                type="text"
                placeholder="e.g. D3/LINE"
                value={formData.received_from}
                onChange={(e) => setFormData({ ...formData, received_from: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
              />
            </div>

            {/* Analysis Done By */}
            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1 text-[11px]">
                Analysis Done By
              </label>
              <input
                type="text"
                placeholder="e.g. GURU"
                value={formData.analysis_done_by}
                onChange={(e) => setFormData({ ...formData, analysis_done_by: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none font-medium"
              />
            </div>

            {/* Actual Quantity */}
            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1 text-[11px]">
                Actual Rejected Qty
              </label>
              <input
                type="number"
                min="1"
                placeholder="e.g. 1"
                value={formData.actual_qty}
                onChange={(e) => setFormData({ ...formData, actual_qty: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none font-mono"
              />
            </div>

            {/* 4M Category */}
            <div className="sm:col-span-2 lg:col-span-2">
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1 text-[11px]">
                4M Category *
              </label>
              <select
                value={formData.four_m}
                onChange={(e) => setFormData({ ...formData, four_m: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none font-bold"
                required
              >
                <option value="">Select 4M Category</option>
                <option value="MAN">MAN</option>
                <option value="MACHINE">MACHINE</option>
                <option value="METHOD">METHOD</option>
                <option value="MATERIAL">MATERIAL</option>
              </select>
            </div>

            {/* Responsibility (Department) */}
            <div className="sm:col-span-1 lg:col-span-2">
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1 text-[11px]">
                Responsibility (Resp) *
              </label>
              <select
                value={formData.resp}
                onChange={(e) => {
                  setFormData({ ...formData, resp: e.target.value, resp_person: '' });
                  setIsUserDropdownOpen(false);
                  setUserSearchTerm('');
                }}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none font-bold cursor-pointer"
                required
              >
                <option value="">Select Responsibility</option>
                <option value="MAINTENANCE">MAINTENANCE</option>
                <option value="PRODUCTION">PRODUCTION</option>
                <option value="PED">PED</option>
                <option value="MATERIALS">MATERIALS</option>
                <option value="MARKETING">MARKETING</option>
                <option value="INCOMING QUALITY">INCOMING QUALITY</option>
              </select>
            </div>

            {/* Responsible Person(s) / User Name based on Department - Multi-Select */}
            <div className="relative sm:col-span-1 lg:col-span-2" ref={userDropdownRef}>
              <div className="flex items-center justify-between mb-1">
                <label className="block font-bold text-slate-700 uppercase tracking-wider text-[11px]">
                  User Name (Based on Dep) *
                </label>
                {formData.resp && getDepartmentUsers(formData.resp).length > 0 && (
                  <div className="flex items-center gap-2 text-[10px]">
                    {getSelectedUsers().length > 0 && (
                      <button
                        type="button"
                        onClick={handleClearAllUsers}
                        className="text-rose-600 hover:text-rose-700 font-semibold hover:underline cursor-pointer"
                      >
                        Clear
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleSelectAllUsers}
                      className="text-blue-600 hover:text-blue-700 font-semibold hover:underline cursor-pointer"
                    >
                      Select all ({getDepartmentUsers(formData.resp).length})
                    </button>
                  </div>
                )}
              </div>

              {/* Multi-Select Trigger Box */}
              <div
                onClick={() => {
                  if (formData.resp && getDepartmentUsers(formData.resp).length > 0) {
                    setIsUserDropdownOpen((prev) => !prev);
                  }
                }}
                className={`w-full min-h-[42px] px-3 py-2 border rounded-xl text-xs font-medium transition flex items-center justify-between gap-2 ${
                  !formData.resp
                    ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                    : getDepartmentUsers(formData.resp).length === 0
                    ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                    : isUserDropdownOpen
                    ? 'bg-white border-blue-500 ring-2 ring-blue-500/20 cursor-pointer shadow-xs'
                    : 'bg-slate-50 border-slate-200 hover:border-slate-300 text-slate-800 cursor-pointer'
                }`}
              >
                <div className="flex-1 flex flex-wrap items-center gap-1.5 min-w-0">
                  {!formData.resp ? (
                    <span className="text-slate-400 font-normal">Select Department First</span>
                  ) : getDepartmentUsers(formData.resp).length === 0 ? (
                    <span className="text-slate-400 font-normal">Users not found for this department</span>
                  ) : getSelectedUsers().length === 0 ? (
                    <span className="text-slate-400 font-normal">Select User Name(s)...</span>
                  ) : (
                    getSelectedUsers().map((userName) => (
                      <span
                        key={userName}
                        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 text-[11px] font-semibold"
                      >
                        <span className="truncate max-w-[140px]">{userName}</span>
                        <button
                          type="button"
                          onClick={(e) => handleRemoveUser(userName, e)}
                          className="p-0.5 hover:bg-blue-200/60 rounded text-blue-600 hover:text-blue-900 transition cursor-pointer"
                          title={`Remove ${userName}`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0 text-slate-400">
                  {getSelectedUsers().length > 0 && (
                    <span className="px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded-md text-[10px] font-bold">
                      {getSelectedUsers().length}
                    </span>
                  )}
                  <ChevronDown
                    className={`w-4 h-4 transition-transform duration-200 ${
                      isUserDropdownOpen ? 'rotate-180 text-blue-600' : ''
                    }`}
                  />
                </div>
              </div>

              {/* Hidden input for HTML form validation */}
              <input
                type="text"
                tabIndex={-1}
                required
                value={formData.resp_person}
                onChange={() => {}}
                className="sr-only"
                aria-hidden="true"
              />

              {/* Dropdown Menu */}
              {isUserDropdownOpen && formData.resp && getDepartmentUsers(formData.resp).length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                  {/* Search box inside dropdown if more than 2 options */}
                  {getDepartmentUsers(formData.resp).length > 2 && (
                    <div className="p-2 border-b border-slate-100 bg-slate-50/70">
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={userSearchTerm}
                          onChange={(e) => setUserSearchTerm(e.target.value)}
                          placeholder="Search user by name..."
                          className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                    </div>
                  )}

                  <div className="max-h-56 overflow-y-auto p-1.5 divide-y divide-slate-50">
                    {getDepartmentUsers(formData.resp)
                      .filter((u) => {
                        const q = userSearchTerm.toLowerCase();
                        return (u.name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q);
                      })
                      .map((u) => {
                        const isChecked = getSelectedUsers().includes(u.name);
                        return (
                          <div
                            key={u.id || u.name}
                            onClick={() => handleToggleUser(u.name)}
                            className={`flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition select-none ${
                              isChecked
                                ? 'bg-blue-50/80 text-blue-900 font-semibold'
                                : 'hover:bg-slate-50 text-slate-700'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0 pr-2">
                              <div
                                className={`w-4 h-4 rounded border flex items-center justify-center transition shrink-0 ${
                                  isChecked
                                    ? 'bg-blue-600 border-blue-600 text-white'
                                    : 'border-slate-300 bg-white'
                                }`}
                              >
                                {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                              </div>
                              <div className="min-w-0">
                                <div className="text-xs truncate">{u.name}</div>
                                {u.email && (
                                  <div className="text-[10px] text-slate-400 truncate">
                                    {u.email}
                                  </div>
                                )}
                              </div>
                            </div>
                            {isChecked && (
                              <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider shrink-0">
                                Selected
                              </span>
                            )}
                          </div>
                        );
                      })}
                  </div>

                  {/* Dropdown footer */}
                  <div className="p-2 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs">
                    <span className="text-[11px] text-slate-500">
                      {getSelectedUsers().length} of {getDepartmentUsers(formData.resp).length} selected
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsUserDropdownOpen(false)}
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Section 2: Defect Evidence / Attachment Upload */}
        <div className="bg-white rounded-2xl p-6 sm:p-7 border border-slate-200/90 shadow-2xs">
          <div className="flex items-start gap-3 pb-5 mb-5 border-b border-slate-100">
            <Paperclip className="w-5 h-5 text-slate-700 mt-0.5" />
            <div>
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                2. Defect Evidence / Attachment Upload (Images, PDF, Word, Excel, PPT)
              </h2>
              <p className="text-xs text-slate-500">
                Upload defect evidence
              </p>
            </div>
          </div>

          {/* Drag & Drop Upload Zone */}
          <label
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            className="border-2 border-dashed border-slate-200 hover:border-blue-400 rounded-2xl p-6 text-center flex flex-col items-center justify-center cursor-pointer bg-slate-50/50 hover:bg-slate-50 transition-colors"
          >
            <input
              type="file"
              multiple
              accept=".pdf,.png,.jpg,.jpeg,.xlsx,.xls,.csv,.ppt,.pptx,.doc,.docx,application/pdf,image/jpeg,image/png,image/*,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={handleFileUpload}
              className="hidden"
            />
            <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mb-2">
              <UploadCloud className="w-5 h-5" />
            </div>
            <p className="text-xs font-semibold text-slate-800">
              Drag & drop files here or <span className="text-blue-600 underline">browse</span>
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Supports Images, PDF, Word, Excel (.xlsx, .xls, .csv), and PowerPoint (Max 25MB per file) • Select multiple files
            </p>
          </label>

          {/* Attached Files List */}
          {attachments.length > 0 && (
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {attachments.map((file, idx) => {
                const meta = getFileMeta(file);
                const IconComponent = meta.icon;
                return (
                  <div
                    key={idx}
                    onClick={() => setPreviewAttachment(file)}
                    className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl shadow-2xs hover:border-blue-400 hover:shadow-xs transition cursor-pointer group"
                    title="Click to preview file"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                      {file.isImage && file.url ? (
                        <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0 border border-slate-200 bg-slate-50 flex items-center justify-center">
                          <img src={file.url} alt={file.name} className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className={`w-8 h-8 rounded-lg shrink-0 border flex items-center justify-center font-bold text-[10px] ${meta.badgeBg}`}>
                          <IconComponent className="w-4 h-4" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-800 truncate group-hover:text-blue-600 transition" title={file.name}>
                          {file.name}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          {file.type} • {file.size} • {file.date}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <span
                        className="p-1.5 rounded-lg text-slate-400 group-hover:text-blue-600 group-hover:bg-blue-50 transition"
                        title="Preview file"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeAttachment(idx);
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
                        title="Remove file"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Section 3: QA Why-Why Analysis */}
        <div className="bg-white rounded-2xl p-6 sm:p-7 border border-slate-200/90 shadow-2xs space-y-4">
          <div className="flex items-start gap-3 pb-4 border-b border-slate-100">
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                3. Problem Cause Why-Why Analysis (QA Team)
              </h2>
              <p className="text-xs text-slate-500">
                5-Why investigation path performed by Quality Assurance to isolate root failure.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {qaWhyWhy.map((val, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 font-mono font-bold text-xs flex items-center justify-center shrink-0">
                  W{idx + 1}
                </span>
                <input
                  type="text"
                  placeholder={`Why #${idx + 1} cause...`}
                  value={val}
                  onChange={(e) => handleQaWhyChange(idx, e.target.value)}
                  className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={handleResetForm}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer"
          >
            Clear Form
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/20 transition transform active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            <Send className="w-4 h-4" />
            <span>{submitting ? 'Submitting...' : 'Submit Report'}</span>
          </button>
        </div>
      </form>

      {/* Universal In-Page Attachment Preview Modal (Interactive Excel Spreadsheet, PDF, Images) */}
      <AttachmentPreviewModal
        isOpen={Boolean(previewAttachment)}
        attachment={previewAttachment}
        onClose={() => setPreviewAttachment(null)}
      />
    </div>
  );
};

export default IhlrCreateRequest;
