import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
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
  Users,
  PenTool,
  Save
} from 'lucide-react';
import { ihlrService } from '../../services/ihlrService';
import { useAuth } from '../../hooks/useAuth';
import AttachmentPreviewModal from '../../components/common/AttachmentPreviewModal';
import ImageAnnotationModal from '../../components/common/ImageAnnotationModal';
import DateInput from '../../components/common/DateInput';
import { useModal } from '../../context/ModalContext';
import { getTodayDateInput, formatDateDDMMYYYY } from '../../utils/dateUtils';
import { IHLR_SHIFTS } from '../../utils/constants';
import { parseAttachments } from './IhlrAttachmentView';

const IhlrCreateRequest = () => {
  const { alert, success, error, warning } = useModal();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const { user } = useAuth();

  const editId = searchParams.get('id') || searchParams.get('edit') || location.state?.editId;
  const isEditMode = Boolean(editId);

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
  const [annotatingItem, setAnnotatingItem] = useState(null);
  const [errors, setErrors] = useState({});

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
        shift: saved.formData.shift || '',
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
    setErrors({});
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

  useEffect(() => {
    if (editId) {
      ihlrService.getRequestById(editId).then((r) => {
        if (r) {
          setFormData({
            req_no: r.req_no || `IHLR-${r.id}`,
            batch_date: r.batch_date ? String(r.batch_date).split('T')[0] : getTodayDateInput(),
            shift: r.shift || '',
            problem: r.problem || '',
            model: r.model || '',
            problem_detected_at: r.problem_detected_at || '',
            received_from: r.received_from || '',
            analysis_done_by: r.analysis_done_by || '',
            actual_qty: r.actual_qty || '',
            four_m: r.four_m || '',
            resp: r.resp || '',
            resp_person: r.resp_person || '',
            status: r.status || 'OPEN'
          });
          setAttachments(parseAttachments(r.defect_image));
          if (Array.isArray(r.qa_why_why) && r.qa_why_why.length > 0) {
            setQaWhyWhy([...r.qa_why_why, '', '', '', ''].slice(0, 5));
          }
        }
      }).catch(err => console.warn('Failed to load request for edit:', err));
    }
  }, [editId]);

  const isUserActive = (u) => {
    if (!u) return false;
    if (u.is_active === false || u.is_active === 0 || u.is_active === '0') return false;
    const s = String(u.status || 'ACTIVE').trim().toUpperCase();
    return s !== 'INACTIVE';
  };

  const getDepartmentUsers = (dept) => {
    if (!dept) return [];
    const targetDept = dept.trim().toUpperCase();
    return dbUsers.filter((u) => {
      const uDept = (u.department || '').trim().toUpperCase();
      return uDept === targetDept && isUserActive(u);
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
    if (updated.length > 0) {
      setErrors((prev) => ({ ...prev, resp_person: false }));
    }
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
    if (deptUsers.length > 0) {
      setErrors((prev) => ({ ...prev, resp_person: false }));
    }
  };

  const handleClearAllUsers = () => {
    setFormData({ ...formData, resp_person: '' });
  };

  const handleQaWhyChange = (index, value) => {
    const updated = [...qaWhyWhy];
    updated[index] = value;
    setQaWhyWhy(updated);
    if (index === 0 && value.trim()) {
      setErrors((prev) => ({ ...prev, w1: false }));
    }
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

  const handleSaveAnnotation = (annotatedFile, newPreviewUrl) => {
    if (!annotatingItem) return;
    const { index } = annotatingItem;
    setAttachments((prev) =>
      prev.map((att, i) => {
        if (i === index) {
          return {
            ...att,
            name: annotatedFile.name,
            file: annotatedFile,
            url: newPreviewUrl,
            size: `${(annotatedFile.size / (1024 * 1024)).toFixed(2)} MB`,
            type: 'PNG',
            isImage: true,
            isAnnotated: true,
          };
        }
        return att;
      })
    );
    setAnnotatingItem(null);
  };

  const handleSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!canCreate) {
      warning('Access Denied: Only Administrators from the INCOMING QUALITY department are authorized to create IHLR requests.');
      return;
    }

    const newErrors = {};

    if (!formData.batch_date || !formData.batch_date.trim()) {
      newErrors.batch_date = 'Incident Date is required';
    }
    if (!formData.shift || !formData.shift.trim()) {
      newErrors.shift = 'Shift is required';
    }
    if (!formData.model || !formData.model.trim()) {
      newErrors.model = 'Model Name / Part is required';
    }
    if (!formData.problem || !formData.problem.trim()) {
      newErrors.problem = 'Problem / Defect Description is required';
    }
    if (!formData.problem_detected_at || !formData.problem_detected_at.trim()) {
      newErrors.problem_detected_at = 'Problem Detected At is required';
    }
    if (!formData.received_from || !formData.received_from.trim()) {
      newErrors.received_from = 'Received From (Line/Cell) is required';
    }
    if (!formData.analysis_done_by || !formData.analysis_done_by.trim()) {
      newErrors.analysis_done_by = 'Analysis Done By is required';
    }
    if (formData.actual_qty === '' || formData.actual_qty === null || formData.actual_qty === undefined || Number(formData.actual_qty) <= 0) {
      newErrors.actual_qty = 'Actual Rejected Qty is required (min 1)';
    }
    if (!formData.four_m || !formData.four_m.trim()) {
      newErrors.four_m = '4M Category is required';
    }
    if (!formData.resp || !formData.resp.trim()) {
      newErrors.resp = 'Responsibility department is required';
    }
    if (!formData.resp_person || getSelectedUsers().length === 0) {
      newErrors.resp_person = 'User Name is required';
    }
    if (!qaWhyWhy[0] || !qaWhyWhy[0].trim()) {
      newErrors.w1 = 'Why 1 (W1) is mandatory. Please enter root cause.';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      // DO NOT TRIGGER BACKEND!
      return;
    }

    setErrors({});

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

      if (isEditMode) {
        await ihlrService.updateRequest(editId, {
          batch_date: formData.batch_date || new Date().toISOString().split('T')[0],
          shift: formData.shift,
          problem: formData.problem,
          model: formData.model,
          problem_detected_at: formData.problem_detected_at,
          received_from: formData.received_from,
          analysis_done_by: formData.analysis_done_by,
          actual_qty: formData.actual_qty ? Number(formData.actual_qty) : 1,
          four_m: formData.four_m,
          resp: formData.resp,
          resp_person: formData.resp_person,
          resp_person_email: combinedAssignedEmails || '',
          qa_why_why: qaWhyWhy,
          defect_image: finalAttachments.length > 0 ? JSON.stringify(finalAttachments) : '',
        });
        await success(`IHLR Report #${formData.req_no} requester details updated successfully!`);
        window.dispatchEvent(new Event('refreshNotifications'));
        navigate('/ihlr/my-requests');
        return;
      }

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
      const draftKey = getDraftKey();
      try {
        sessionStorage.removeItem(draftKey);
        sessionStorage.removeItem('ihlr_create_request_draft');
        localStorage.removeItem(draftKey);
        localStorage.removeItem('ihlr_create_request_draft');
      } catch {}
      await success(`IHLR Analysis Report ${formData.req_no} submitted successfully!`);
      window.dispatchEvent(new Event('refreshNotifications'));
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
            {isEditMode ? `Edit Requester Details (${formData.req_no})` : 'Create IHLR Analysis Report'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            {isEditMode 
              ? 'Update line rejection incident details, defect description, attachments, and QA 5-Why analysis.'
              : 'Log line rejection incident, 5-Why problem root cause, and occurrence containment.'}
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

      <form onSubmit={handleSubmit} noValidate className="space-y-6">
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
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1 text-[11px] flex items-center">
                <span>Req No (Auto-Generated)</span>
                <span className="text-red-500 font-bold ml-1">*</span>
              </label>
              <input
                type="text"
                readOnly
                value={formData.req_no}
                className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl font-mono font-bold text-slate-700 focus:outline-none cursor-not-allowed select-none"
              />
            </div>

            {/* Incident Date */}
            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1 text-[11px] flex items-center justify-between">
                <span className="flex items-center">
                  <span>Incident Date</span>
                  <span className="text-red-500 font-bold ml-1">*</span>
                </span>
                <span className="text-[10px] text-slate-400 font-mono font-normal">DD/MM/YYYY</span>
              </label>
              <DateInput
                value={formData.batch_date}
                onChange={(e) => {
                  setFormData({ ...formData, batch_date: e.target.value });
                  if (errors.batch_date && e.target.value) {
                    setErrors((prev) => ({ ...prev, batch_date: false }));
                  }
                }}
                className={`w-full px-3 py-2 border rounded-xl text-slate-900 outline-none font-medium transition ${
                  errors.batch_date
                    ? 'border-rose-400 focus:ring-2 focus:ring-rose-400/20 focus:border-rose-500 bg-rose-50/20'
                    : 'bg-slate-50 border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500'
                }`}
              />
              {errors.batch_date && (
                <p className="text-[11px] text-rose-500 font-semibold mt-1 flex items-center gap-1">
                  <span>* {errors.batch_date}</span>
                </p>
              )}
            </div>

            {/* Shift */}
            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1 text-[11px] flex items-center">
                <span>Shift</span>
                <span className="text-red-500 font-bold ml-1">*</span>
              </label>
              <select
                value={formData.shift}
                onChange={(e) => {
                  setFormData({ ...formData, shift: e.target.value });
                  if (errors.shift && e.target.value) {
                    setErrors((prev) => ({ ...prev, shift: false }));
                  }
                }}
                className={`w-full px-3 py-2 border rounded-xl text-slate-900 outline-none font-medium transition cursor-pointer ${
                  errors.shift
                    ? 'border-rose-400 focus:ring-2 focus:ring-rose-400/20 focus:border-rose-500 bg-rose-50/20'
                    : 'bg-slate-50 border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500'
                }`}
              >
                <option value="">Select Shift</option>
                {IHLR_SHIFTS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
              {errors.shift && (
                <p className="text-[11px] text-rose-500 font-semibold mt-1 flex items-center gap-1">
                  <span>* {errors.shift}</span>
                </p>
              )}
            </div>

            {/* Model */}
            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1 text-[11px] flex items-center">
                <span>Model Name / Part</span>
                <span className="text-red-500 font-bold ml-1">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. OLS LONG ARM"
                value={formData.model}
                onChange={(e) => {
                  setFormData({ ...formData, model: e.target.value });
                  if (errors.model && e.target.value.trim()) {
                    setErrors((prev) => ({ ...prev, model: false }));
                  }
                }}
                className={`w-full px-3 py-2 border rounded-xl font-semibold text-slate-900 outline-none transition ${
                  errors.model
                    ? 'border-rose-400 focus:ring-2 focus:ring-rose-400/20 focus:border-rose-500 bg-rose-50/20'
                    : 'bg-slate-50 border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500'
                }`}
              />
              {errors.model && (
                <p className="text-[11px] text-rose-500 font-semibold mt-1 flex items-center gap-1">
                  <span>* {errors.model}</span>
                </p>
              )}
            </div>

            {/* Problem Description */}
            <div className="sm:col-span-2">
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1 text-[11px] flex items-center">
                <span>Problem / Defect Description</span>
                <span className="text-red-500 font-bold ml-1">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Low voltage / Improper sensor solder"
                value={formData.problem}
                onChange={(e) => {
                  setFormData({ ...formData, problem: e.target.value });
                  if (errors.problem && e.target.value.trim()) {
                    setErrors((prev) => ({ ...prev, problem: false }));
                  }
                }}
                className={`w-full px-3 py-2 border rounded-xl text-slate-900 outline-none font-semibold transition ${
                  errors.problem
                    ? 'border-rose-400 focus:ring-2 focus:ring-rose-400/20 focus:border-rose-500 bg-rose-50/20'
                    : 'bg-slate-50 border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500'
                }`}
              />
              {errors.problem && (
                <p className="text-[11px] text-rose-500 font-semibold mt-1 flex items-center gap-1">
                  <span>* {errors.problem}</span>
                </p>
              )}
            </div>

            {/* Problem Detected At */}
            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1 text-[11px] flex items-center">
                <span>Problem Detected At</span>
                <span className="text-red-500 font-bold ml-1">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Final Testing"
                value={formData.problem_detected_at}
                onChange={(e) => {
                  setFormData({ ...formData, problem_detected_at: e.target.value });
                  if (errors.problem_detected_at && e.target.value.trim()) {
                    setErrors((prev) => ({ ...prev, problem_detected_at: false }));
                  }
                }}
                className={`w-full px-3 py-2 border rounded-xl text-slate-900 outline-none transition ${
                  errors.problem_detected_at
                    ? 'border-rose-400 focus:ring-2 focus:ring-rose-400/20 focus:border-rose-500 bg-rose-50/20'
                    : 'bg-slate-50 border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500'
                }`}
              />
              {errors.problem_detected_at && (
                <p className="text-[11px] text-rose-500 font-semibold mt-1 flex items-center gap-1">
                  <span>* {errors.problem_detected_at}</span>
                </p>
              )}
            </div>

            {/* Received From */}
            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1 text-[11px] flex items-center">
                <span>Received From (Line/Cell)</span>
                <span className="text-red-500 font-bold ml-1">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. D3/LINE"
                value={formData.received_from}
                onChange={(e) => {
                  setFormData({ ...formData, received_from: e.target.value });
                  if (errors.received_from && e.target.value.trim()) {
                    setErrors((prev) => ({ ...prev, received_from: false }));
                  }
                }}
                className={`w-full px-3 py-2 border rounded-xl text-slate-900 outline-none transition ${
                  errors.received_from
                    ? 'border-rose-400 focus:ring-2 focus:ring-rose-400/20 focus:border-rose-500 bg-rose-50/20'
                    : 'bg-slate-50 border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500'
                }`}
              />
              {errors.received_from && (
                <p className="text-[11px] text-rose-500 font-semibold mt-1 flex items-center gap-1">
                  <span>* {errors.received_from}</span>
                </p>
              )}
            </div>

            {/* Analysis Done By */}
            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1 text-[11px] flex items-center">
                <span>Analysis Done By</span>
                <span className="text-red-500 font-bold ml-1">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. GURU"
                value={formData.analysis_done_by}
                onChange={(e) => {
                  setFormData({ ...formData, analysis_done_by: e.target.value });
                  if (errors.analysis_done_by && e.target.value.trim()) {
                    setErrors((prev) => ({ ...prev, analysis_done_by: false }));
                  }
                }}
                className={`w-full px-3 py-2 border rounded-xl text-slate-900 outline-none font-medium transition ${
                  errors.analysis_done_by
                    ? 'border-rose-400 focus:ring-2 focus:ring-rose-400/20 focus:border-rose-500 bg-rose-50/20'
                    : 'bg-slate-50 border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500'
                }`}
              />
              {errors.analysis_done_by && (
                <p className="text-[11px] text-rose-500 font-semibold mt-1 flex items-center gap-1">
                  <span>* {errors.analysis_done_by}</span>
                </p>
              )}
            </div>

            {/* Actual Quantity */}
            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1 text-[11px] flex items-center">
                <span>Actual Rejected Qty</span>
                <span className="text-red-500 font-bold ml-1">*</span>
              </label>
              <input
                type="number"
                min="1"
                placeholder="e.g. 1"
                value={formData.actual_qty}
                onChange={(e) => {
                  setFormData({ ...formData, actual_qty: e.target.value });
                  if (errors.actual_qty && e.target.value && Number(e.target.value) > 0) {
                    setErrors((prev) => ({ ...prev, actual_qty: false }));
                  }
                }}
                className={`w-full px-3 py-2 border rounded-xl text-slate-900 outline-none font-mono transition ${
                  errors.actual_qty
                    ? 'border-rose-400 focus:ring-2 focus:ring-rose-400/20 focus:border-rose-500 bg-rose-50/20'
                    : 'bg-slate-50 border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500'
                }`}
              />
              {errors.actual_qty && (
                <p className="text-[11px] text-rose-500 font-semibold mt-1 flex items-center gap-1">
                  <span>* {errors.actual_qty}</span>
                </p>
              )}
            </div>

            {/* 4M Category */}
            <div className="sm:col-span-2 lg:col-span-2">
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1 text-[11px] flex items-center">
                <span>4M Category</span>
                <span className="text-red-500 font-bold ml-1">*</span>
              </label>
              <select
                value={formData.four_m}
                onChange={(e) => {
                  setFormData({ ...formData, four_m: e.target.value });
                  if (errors.four_m && e.target.value) {
                    setErrors((prev) => ({ ...prev, four_m: false }));
                  }
                }}
                className={`w-full px-3 py-2 border rounded-xl text-slate-900 outline-none font-bold transition cursor-pointer ${
                  errors.four_m
                    ? 'border-rose-400 focus:ring-2 focus:ring-rose-400/20 focus:border-rose-500 bg-rose-50/20'
                    : 'bg-slate-50 border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500'
                }`}
              >
                <option value="">Select 4M Category</option>
                <option value="MAN">MAN</option>
                <option value="MACHINE">MACHINE</option>
                <option value="METHOD">METHOD</option>
                <option value="MATERIAL">MATERIAL</option>
              </select>
              {errors.four_m && (
                <p className="text-[11px] text-rose-500 font-semibold mt-1 flex items-center gap-1">
                  <span>* {errors.four_m}</span>
                </p>
              )}
            </div>

            {/* Responsibility (Department) */}
            <div className="sm:col-span-1 lg:col-span-2">
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1 text-[11px] flex items-center">
                <span>Responsibility (Resp)</span>
                <span className="text-red-500 font-bold ml-1">*</span>
              </label>
              <select
                value={formData.resp}
                onChange={(e) => {
                  const val = e.target.value;
                  setFormData({ ...formData, resp: val, resp_person: '' });
                  setIsUserDropdownOpen(false);
                  setUserSearchTerm('');
                  if (errors.resp && val) {
                    setErrors((prev) => ({ ...prev, resp: false }));
                  }
                }}
                className={`w-full px-3 py-2 border rounded-xl text-slate-900 outline-none font-bold cursor-pointer transition ${
                  errors.resp
                    ? 'border-rose-400 focus:ring-2 focus:ring-rose-400/20 focus:border-rose-500 bg-rose-50/20'
                    : 'bg-slate-50 border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500'
                }`}
              >
                <option value="">Select Responsibility</option>
                <option value="MAINTENANCE">MAINTENANCE</option>
                <option value="PRODUCTION">PRODUCTION</option>
                <option value="PED">PED</option>
                <option value="MATERIALS">MATERIALS</option>
                <option value="MARKETING">MARKETING</option>
                <option value="INCOMING QUALITY">INCOMING QUALITY</option>
              </select>
              {errors.resp && (
                <p className="text-[11px] text-rose-500 font-semibold mt-1 flex items-center gap-1">
                  <span>* {errors.resp}</span>
                </p>
              )}
            </div>

            {/* Responsible Person(s) / User Name based on Department - Multi-Select */}
            <div className="relative sm:col-span-1 lg:col-span-2" ref={userDropdownRef}>
              <div className="flex items-center justify-between mb-1">
                <label className="block font-bold text-slate-700 uppercase tracking-wider text-[11px] flex items-center">
                  <span>User Name (Based on Dep)</span>
                  <span className="text-red-500 font-bold ml-1">*</span>
                </label>
                {formData.resp && getDepartmentUsers(formData.resp).length > 0 && getSelectedUsers().length > 0 && (
                  <div className="flex items-center gap-2 text-[10px]">
                    <button
                      type="button"
                      onClick={handleClearAllUsers}
                      className="text-rose-600 hover:text-rose-700 font-semibold hover:underline cursor-pointer"
                    >
                      Clear
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
                  errors.resp_person
                    ? 'border-rose-400 bg-rose-50/20 ring-2 ring-rose-400/20 cursor-pointer'
                    : !formData.resp
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
              {errors.resp_person && (
                <p className="text-[11px] text-rose-500 font-semibold mt-1 flex items-center gap-1">
                  <span>* {errors.resp_person}</span>
                </p>
              )}

              {/* Hidden input for HTML form accessibility */}
              <input
                type="text"
                tabIndex={-1}
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
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-semibold text-slate-800 truncate group-hover:text-blue-600 transition" title={file.name}>
                            {file.name}
                          </p>
                          {file.isAnnotated && (
                            <span
                              className="shrink-0 px-1.5 py-0.5 text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-300 rounded-full"
                              title="Contains drawing annotations (circle, arrows, lines, sketches)"
                            >
                              Annotated
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400">
                          {file.type} • {file.size} • {file.date}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {(file.isImage || file.isPdf || (file.type || '').toUpperCase() === 'PDF' || file.name?.toLowerCase().endsWith('.pdf')) && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setAnnotatingItem({ attachment: file, index: idx });
                          }}
                          className="px-2 py-1 rounded-lg text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 flex items-center gap-1 transition cursor-pointer shadow-2xs"
                          title="Annotate technical drawing or PDF blueprint (draw circle, arrows, lines, sketches)"
                        >
                          <PenTool className="w-3 h-3 text-amber-600" />
                          <span className="hidden sm:inline">Annotate</span>
                        </button>
                      )}
                      {(file.isExcel || ['XLS', 'XLSX', 'CSV'].includes((file.type || '').toUpperCase())) && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPreviewAttachment(file);
                          }}
                          className="px-2 py-1 rounded-lg text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 flex items-center gap-1 transition cursor-pointer shadow-2xs"
                          title="Preview spreadsheet and click 'Annotate Sheet' to mark cells"
                        >
                          <PenTool className="w-3 h-3 text-emerald-600" />
                          <span className="hidden sm:inline">Annotate</span>
                        </button>
                      )}
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
            <div className="flex-1 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                    3. Problem Cause Why-Why Analysis (QA Team)
                  </h2>
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-full flex items-center gap-1">
                    <span>W1 Mandatory</span>
                    <span className="text-red-500 font-bold">*</span>
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  5-Why investigation path performed by Quality Assurance to isolate root failure.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {qaWhyWhy.map((val, idx) => {
              const isW1 = idx === 0;
              const hasW1Error = isW1 && Boolean(errors.w1);
              return (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-8 h-8 rounded-xl font-mono font-bold text-xs flex items-center justify-center shrink-0 border transition ${
                        isW1
                          ? hasW1Error
                            ? 'bg-rose-50 border-rose-300 text-rose-700'
                            : 'bg-amber-100/80 border-amber-300 text-amber-800'
                          : 'bg-amber-50 border-amber-200 text-amber-700'
                      }`}
                    >
                      W{idx + 1}{isW1 && <span className="text-red-500 ml-0.5 font-bold">*</span>}
                    </span>
                    <input
                      type="text"
                      placeholder={`Why #${idx + 1} cause...${isW1 ? ' (Mandatory)' : ''}`}
                      value={val}
                      onChange={(e) => handleQaWhyChange(idx, e.target.value)}
                      className={`flex-1 px-3 py-2 border rounded-xl text-xs text-slate-900 outline-none transition ${
                        hasW1Error
                          ? 'border-rose-400 focus:ring-2 focus:ring-rose-400/20 focus:border-rose-500 bg-rose-50/20'
                          : 'bg-slate-50 border-slate-200 focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500'
                      }`}
                    />
                  </div>
                  {hasW1Error && (
                    <p className="text-[11px] text-rose-500 font-semibold pl-11 flex items-center gap-1">
                      <span>* {errors.w1}</span>
                    </p>
                  )}
                </div>
              );
            })}
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
            {isEditMode ? (
              <>
                <Check className="w-4 h-4 stroke-[2.5]" />
                <span>{submitting ? 'Updating...' : 'Update Requester Details'}</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>{submitting ? 'Submitting...' : 'Submit Report'}</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Universal In-Page Attachment Preview Modal (Interactive Excel Spreadsheet, PDF, Images) */}
      <AttachmentPreviewModal
        isOpen={Boolean(previewAttachment)}
        attachment={previewAttachment}
        onClose={() => setPreviewAttachment(null)}
        onAnnotate={(att) => {
          const idx = attachments.findIndex((a) => a === att || a.name === att?.name);
          if (idx !== -1) {
            setAnnotatingItem({ attachment: attachments[idx], index: idx });
          } else {
            const newAtt = {
              name: att.name,
              size: `${((att.file?.size || 102400) / (1024 * 1024)).toFixed(2)} MB`,
              type: 'PNG',
              date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
              file: att.file,
              url: att.url,
              isImage: true,
              isAnnotated: false,
            };
            setAttachments((prev) => {
              const next = [...prev, newAtt];
              setAnnotatingItem({ attachment: newAtt, index: next.length - 1 });
              return next;
            });
          }
        }}
      />

      {/* Technical Drawing & Defect Image Annotation Modal (Circle, Arrow, Line, Sketches) */}
      <ImageAnnotationModal
        isOpen={Boolean(annotatingItem)}
        imageAttachment={annotatingItem?.attachment}
        onClose={() => setAnnotatingItem(null)}
        onSave={handleSaveAnnotation}
      />
    </div>
  );
};

export default IhlrCreateRequest;
