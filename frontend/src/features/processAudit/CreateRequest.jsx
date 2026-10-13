import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  UserCheck,
  Paperclip,
  MessageSquare,
  UploadCloud,
  Trash2,
  Send,
  Calendar,
  X,
  Eye,
  Download,
  FileSpreadsheet,
  Presentation,
  File as FileIcon,
  Image as ImageIcon,
  ShieldAlert,
  ChevronDown,
  Check,
  Search,
  Users,
  PenTool,
} from 'lucide-react';
import { processAuditService } from '../../services/processAuditService';
import { useAuth } from '../../hooks/useAuth';
import { useModal } from '../../context/ModalContext';
import AttachmentPreviewModal from '../../components/common/AttachmentPreviewModal';
import ImageAnnotationModal from '../../components/common/ImageAnnotationModal';
import DateInput from '../../components/common/DateInput';
import { storage } from '../../utils/storage';

const DEFAULT_DEPARTMENTS = [
  'PRODUCTION',
  'MAINTENANCE',
  'PED',
  'MATERIALS',
  'MARKETING',
  'INCOMING QUALITY',
];

const CreateRequest = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { success, warning, error: modalError } = useModal();

  const getTodayDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

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
    return `process_audit_create_request_draft_${uid || 'default'}`;
  };

  const defaultFormData = {
    requestId: 'PA-1',
    date: getTodayDate(),
    product: '',
    model: '',
    processOperation: '',
    shift: '',
    issueType: '',
    priority: '',
    issueObservation: '',
    department: '',
    executor: '',
    comments: '',
  };

  const getSavedDraft = () => {
    try {
      const key = getDraftKey();
      const raw =
        sessionStorage.getItem(key) ||
        sessionStorage.getItem('process_audit_create_request_draft') ||
        localStorage.getItem(key) ||
        localStorage.getItem('process_audit_create_request_draft');
      if (raw) {
        return JSON.parse(raw);
      }
    } catch (e) {
      console.warn('Failed to parse Process Audit draft:', e);
    }
    return null;
  };

  const [formData, setFormData] = useState(() => {
    const saved = getSavedDraft();
    if (saved?.formData) {
      return {
        ...defaultFormData,
        ...saved.formData,
        date: saved.formData.date || getTodayDate(),
      };
    }
    return defaultFormData;
  });

  const [selectedExecutors, setSelectedExecutors] = useState(() => {
    const saved = getSavedDraft();
    if (Array.isArray(saved?.selectedExecutors)) {
      return saved.selectedExecutors;
    }
    return [];
  });

  const [hasRestoredDraft, setHasRestoredDraft] = useState(() => {
    const saved = getSavedDraft();
    if (saved?.formData) {
      const d = saved.formData;
      return Boolean(
        d.product ||
        d.model ||
        d.processOperation ||
        d.shift ||
        d.issueType ||
        d.priority ||
        d.issueObservation ||
        d.department ||
        d.comments ||
        (Array.isArray(saved?.selectedExecutors) && saved.selectedExecutors.length > 0)
      );
    }
    return false;
  });

  // Auto-save form inputs to sessionStorage so data is preserved across tab switching
  useEffect(() => {
    const key = getDraftKey();
    const isDirty = Boolean(
      formData.product ||
      formData.model ||
      formData.processOperation ||
      formData.shift ||
      formData.issueType ||
      formData.priority ||
      formData.issueObservation ||
      formData.department ||
      formData.comments ||
      (selectedExecutors && selectedExecutors.length > 0)
    );

    if (isDirty) {
      try {
        sessionStorage.setItem(
          key,
          JSON.stringify({
            formData,
            selectedExecutors,
            updatedAt: new Date().toISOString(),
          })
        );
      } catch (err) {
        console.warn('Process Audit draft save error:', err);
      }
    }
  }, [formData, selectedExecutors]);

  const handleResetForm = () => {
    const key = getDraftKey();
    try {
      sessionStorage.removeItem(key);
      sessionStorage.removeItem('process_audit_create_request_draft');
      localStorage.removeItem(key);
      localStorage.removeItem('process_audit_create_request_draft');
    } catch {}
    setFormData((prev) => ({
      ...defaultFormData,
      requestId: prev.requestId || 'PA-1',
    }));
    setSelectedExecutors([]);
    setAttachments([]);
    setHasRestoredDraft(false);
    setErrors({});
  };

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dbUsers, setDbUsers] = useState([]);
  const [deptUsers, setDeptUsers] = useState([]);
  const [loadingExecutors, setLoadingExecutors] = useState(false);

  const [executorDropdownOpen, setExecutorDropdownOpen] = useState(false);
  const [executorSearch, setExecutorSearch] = useState('');
  const executorDropdownRef = useRef(null);

  // Close executor dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (executorDropdownRef.current && !executorDropdownRef.current.contains(event.target)) {
        setExecutorDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Fetch all users from DB on mount
  useEffect(() => {
    let isMounted = true;
    processAuditService.getUsers()
      .then((users) => {
        if (isMounted && Array.isArray(users)) {
          setDbUsers(users);
        }
      })
      .catch((err) => console.error('Failed to load DB users:', err));
    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch executors from DB whenever department changes
  useEffect(() => {
    if (!formData.department) {
      setDeptUsers([]);
      return;
    }
    let isMounted = true;
    const isUserActive = (u) => {
      if (!u) return false;
      if (u.is_active === false || u.is_active === 0 || u.is_active === '0') return false;
      const s = String(u.status || 'ACTIVE').trim().toUpperCase();
      return s !== 'INACTIVE';
    };

    setLoadingExecutors(true);
    processAuditService.getUsers(formData.department)
      .then((users) => {
        if (isMounted) {
          if (Array.isArray(users) && users.length > 0) {
            setDeptUsers(users.filter(isUserActive));
          } else {
            // Fallback filter on dbUsers by case-insensitive department
            const matched = dbUsers.filter(
              (u) => (u.department || u.dept || '').trim().toLowerCase() === formData.department.trim().toLowerCase() && isUserActive(u)
            );
            setDeptUsers(matched);
          }
        }
      })
      .catch((err) => {
        console.error('Failed to fetch executors for department from DB:', err);
        if (isMounted) {
          const matched = dbUsers.filter(
            (u) => (u.department || u.dept || '').trim().toLowerCase() === formData.department.trim().toLowerCase() && isUserActive(u)
          );
          setDeptUsers(matched);
        }
      })
      .finally(() => {
        if (isMounted) setLoadingExecutors(false);
      });

    return () => {
      isMounted = false;
    };
  }, [formData.department, dbUsers]);

  const departmentList = Array.from(
    new Set([
      'PRODUCTION',
      'MAINTENANCE',
      'PED',
      'MATERIALS',
      'MARKETING',
      'INCOMING QUALITY',
      ...dbUsers.map((u) => (u.department || u.dept || '').trim()).filter(Boolean),
    ])
  );

  useEffect(() => {
    let isMounted = true;
    processAuditService.getNextId()
      .then((nextId) => {
        if (isMounted && nextId) {
          const formatted = String(nextId).startsWith('PA-') ? String(nextId) : `PA-${nextId}`;
          setFormData((prev) => ({ ...prev, requestId: formatted }));
        }
      })
      .catch((err) => {
        console.warn('Using default ID:', err);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // Compute available executors strictly from DB users in the selected department
  const availableExecutors = React.useMemo(() => {
    if (!formData.department) return [];
    if (deptUsers && deptUsers.length > 0) {
      return deptUsers.map((u) => {
        const displayLabel = `${u.name}${u.role && u.role.toLowerCase() !== 'user' ? ` (${u.role})` : ''}`;
        return {
          id: u.id,
          name: u.name,
          role: u.role || '',
          label: displayLabel,
        };
      });
    }
    return [];
  }, [formData.department, deptUsers]);

  const handleToggleExecutor = (name) => {
    setSelectedExecutors((prev) => {
      const exists = prev.includes(name);
      const next = exists ? prev.filter((item) => item !== name) : [...prev, name];
      setFormData((f) => ({ ...f, executor: next.join(', ') }));
      if (next.length > 0) {
        setErrors((err) => ({ ...err, executor: false }));
      }
      return next;
    });
  };

  const handleSelectAllExecutors = () => {
    const allNames = availableExecutors.map((e) => e.name);
    setSelectedExecutors(allNames);
    setFormData((f) => ({ ...f, executor: allNames.join(', ') }));
    if (allNames.length > 0) {
      setErrors((err) => ({ ...err, executor: false }));
    }
  };

  const handleClearAllExecutors = () => {
    setSelectedExecutors([]);
    setFormData((f) => ({ ...f, executor: '' }));
  };

  const [attachments, setAttachments] = useState([]);
  const [previewAttachment, setPreviewAttachment] = useState(null);
  const [annotatingItem, setAnnotatingItem] = useState(null);

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

  const removeAttachment = (index) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const getFileMeta = (file) => {
    const ext = (file?.type || '').toUpperCase();
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
    return {
      badgeBg: 'bg-slate-50 text-slate-700 border-slate-200',
      icon: FileIcon,
      typeName: 'Document',
    };
  };

  const processFiles = (fileList) => {
    const files = Array.from(fileList || []);
    if (files.length > 0) {
      if (errors.attachments) {
        setErrors((prev) => ({ ...prev, attachments: false }));
      }
      const newAttachments = files.map((file) => {
        const ext = file.name.split('.').pop()?.toUpperCase() || 'FILE';
        const isImage = ['PNG', 'JPG', 'JPEG', 'GIF', 'WEBP', 'SVG'].includes(ext);
        const isPdf = ext === 'PDF';
        const isExcel = ['XLS', 'XLSX', 'CSV', 'XLSM'].includes(ext);
        const isPpt = ['PPT', 'PPTX', 'PPSX'].includes(ext);

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

  const savedUser = storage.getUser();
  const currentUser = user || savedUser;

  const currentCreator = currentUser?.name || currentUser?.email || (() => {
    try {
      const u = sessionStorage.getItem('todo_user') || localStorage.getItem('todo_user');
      return u ? JSON.parse(u)?.name || JSON.parse(u)?.email : '';
    } catch {
      return '';
    }
  })();

  const currentDept = (currentUser?.department || (() => {
    try {
      const u = sessionStorage.getItem('todo_user') || localStorage.getItem('todo_user');
      return u ? JSON.parse(u)?.department : '';
    } catch {
      return '';
    }
  })() || '').trim();

  const userRole = (currentUser?.role || (() => {
    try {
      const u = sessionStorage.getItem('todo_user') || localStorage.getItem('todo_user');
      return u ? JSON.parse(u)?.role : '';
    } catch {
      return '';
    }
  })() || '').trim().toUpperCase();

  const isIncomingQuality = currentDept.toUpperCase() === 'INCOMING QUALITY';
  const isAdmin = userRole === 'ADMIN' || isIncomingQuality;
  const canCreate = isIncomingQuality || isAdmin;

  const handleSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();

    if (!canCreate) {
      warning('Only members of the Incoming Quality department can create new requests.');
      return;
    }

    const newErrors = {};

    if (!formData.date || !formData.date.trim()) {
      newErrors.date = 'Escalation Date is required';
    }
    if (!formData.product || !formData.product.trim()) {
      newErrors.product = 'Product is required';
    }
    if (!formData.model || !formData.model.trim()) {
      newErrors.model = 'Model is required';
    }
    if (!formData.processOperation || !formData.processOperation.trim()) {
      newErrors.processOperation = 'Process / Operation is required';
    }
    if (!formData.shift || !formData.shift.trim()) {
      newErrors.shift = 'Shift is required';
    }
    if (!formData.issueType || !formData.issueType.trim()) {
      newErrors.issueType = 'Issue Type is required';
    }
    if (!formData.priority || !formData.priority.trim()) {
      newErrors.priority = 'Priority is required';
    }
    if (!formData.issueObservation || !formData.issueObservation.trim()) {
      newErrors.issueObservation = 'Issue / Observation is required';
    }
    if (!attachments || attachments.length === 0) {
      newErrors.attachments = 'At least one file attachment is required';
    }
    if (!formData.department || !formData.department.trim()) {
      newErrors.department = 'Department is required';
      newErrors.executor = 'Department must be selected first';
    } else if (availableExecutors.length === 0) {
      newErrors.executor = 'There are no users in the selected department';
    } else if (!formData.executor && selectedExecutors.length === 0) {
      newErrors.executor = 'Please select at least one person to assign';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      // DO NOT TRIGGER BACKEND!
      return;
    }

    setErrors({});
    setIsSubmitting(true);

    // Upload physical attachment files to backend uploads/attachments folder
    let uploadedFilesMeta = [];
    const filesToUpload = attachments
      .filter((att) => att.file && (typeof window !== 'undefined' && window.File ? att.file instanceof window.File : true))
      .map((att) => att.file);

    if (filesToUpload.length > 0) {
      try {
        uploadedFilesMeta = await processAuditService.uploadAttachments(filesToUpload);
      } catch (uploadErr) {
        console.warn('Attachments upload notice:', uploadErr);
      }
    }

    const finalAttachments = attachments.map((att) => {
      const match = uploadedFilesMeta.find((u) => u.name === att.name || u.filename === att.name);
      const dbUrl = match?.url || (match?.id ? `/api/process-audit/attachments/${match.id}` : `/api/process-audit/attachments/${encodeURIComponent(att.name)}`);
      return {
        id: match?.id || null,
        name: att.name,
        size: match?.size || att.size,
        type: match?.type || att.type,
        date: att.date,
        path: match?.path || dbUrl,
        url: dbUrl,
        filename: match?.filename || att.name,
      };
    });

    const formattedIssueNo = String(formData.requestId || '').startsWith('PA-')
      ? formData.requestId
      : `PA-${formData.requestId || '1'}`;

    const creatorName = currentCreator;

    const payload = {
      issue_no: formattedIssueNo,
      escalation_date: formData.date,
      product: formData.product,
      model: formData.model,
      process_operation: formData.processOperation,
      shift: formData.shift,
      issue_type: formData.issueType || '',
      priority: formData.priority || '',
      issue_observation: formData.issueObservation,
      department: formData.department,
      executor: selectedExecutors.length > 0 ? selectedExecutors.join(', ') : (formData.executor || ''),
      comments: formData.comments,
      attachments: finalAttachments,
      created_by: creatorName,
      created_by_id: user?.id || null,
    };

    try {
      const res = await processAuditService.createRequest(payload);
      const savedId = res?.data?.issue_no || (res?.data?.id ? `PA-${res.data.id}` : formData.requestId);
      const draftKey = getDraftKey();
      try {
        sessionStorage.removeItem(draftKey);
        sessionStorage.removeItem('process_audit_create_request_draft');
        localStorage.removeItem(draftKey);
        localStorage.removeItem('process_audit_create_request_draft');
      } catch {}
      window.dispatchEvent(new Event('refreshNotifications'));
      await success(`Request ${savedId} created successfully!`);
      navigate('/process-audit/my-requests');
    } catch (err) {
      console.error('Failed to save request in DB:', err);
      const draftKey = getDraftKey();
      try {
        sessionStorage.removeItem(draftKey);
        sessionStorage.removeItem('process_audit_create_request_draft');
        localStorage.removeItem(draftKey);
        localStorage.removeItem('process_audit_create_request_draft');
      } catch {}
      await success(`Request ${formData.requestId} created successfully!`);
      navigate('/process-audit/my-requests');
    } finally {
      setIsSubmitting(false);
    }
  };

  // If user is not from INCOMING QUALITY, display restricted authorization notice
  if (!canCreate) {
    return (
      <div className="space-y-6 w-full pb-12">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Create Production Request
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Process Audit Observation • Departmental Access Control
            </p>
          </div>
        </div>

        <div className="max-w-2xl mx-auto my-8 bg-white rounded-3xl p-8 sm:p-10 border border-slate-200/90 shadow-sm text-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">
            Department Authorization Required
          </h2>
          <p className="text-sm text-slate-600 mb-6 leading-relaxed">
            In <strong>Process Audit Observation</strong>, only personnel from the{' '}
            <span className="font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200 inline-block my-1">
              INCOMING QUALITY
            </span>{' '}
            department are authorized to create new production audit requests.
          </p>
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/70 text-xs text-slate-600 mb-6 max-w-md mx-auto text-left space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Logged-in User:</span>
              <strong className="text-slate-800">{currentCreator || 'Unknown'}</strong>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Your Department:</span>
              <strong className="text-rose-600 font-semibold">{currentDept || 'Not Assigned / Other Department'}</strong>
            </div>
          </div>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => navigate('/process-audit/dashboard')}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer"
            >
              Go to Dashboard
            </button>
            <button
              onClick={() => navigate('/process-audit/my-requests')}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs transition cursor-pointer"
            >
              View All Requests
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Create Production Request
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Initiate a manufacturing process audit and assign operational execution.
          </p>
        </div>

        {/* Creator Info Pill */}
        {currentCreator && (
          <div className="flex items-center gap-2.5 px-3.5 py-2 bg-white rounded-xl border border-slate-200/80 shadow-2xs">
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs">
              {currentCreator.charAt(0).toUpperCase()}
            </div>
            <div className="text-left text-xs leading-tight">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-slate-400 font-semibold uppercase">Created By</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {currentDept || 'INCOMING QUALITY'}
                </span>
              </div>
              <span className="font-bold text-slate-800">{currentCreator}</span>
            </div>
          </div>
        )}
      </div>

      {/* Draft Restored Banner */}
      {hasRestoredDraft && (
        <div className="flex items-center justify-between px-4 py-2.5 bg-blue-50/90 border border-blue-200/90 rounded-xl text-xs text-blue-800 shadow-2xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
            <span>
              <strong>Draft Restored:</strong> Your form inputs were preserved across tab switching.
            </span>
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

      {/* Form Container */}
      <form onSubmit={handleSubmit} noValidate className="space-y-6">
        {/* Section 1: Production Details */}
        <div className="bg-white rounded-2xl p-6 sm:p-7 border border-slate-200/90 shadow-2xs">
          <div className="flex items-start gap-3 pb-5 mb-5 border-b border-slate-100">
            <FileText className="w-5 h-5 text-slate-700 mt-0.5" />
            <div>
              <h2 className="text-sm font-bold text-slate-900">1. Production Details</h2>
              <p className="text-xs text-slate-500">
                Key manufacturing parameters and production line specifications.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Row 1 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center">
                  <span>ISSUE NO (Auto-Generated)</span>
                  <span className="text-red-500 font-bold ml-1">*</span>
                </label>
                <input
                  type="text"
                  disabled
                  value={String(formData.requestId || '').startsWith('PA-') ? formData.requestId : `PA-${formData.requestId || '1'}`}
                  className="w-full px-3.5 py-2.5 bg-slate-100/80 border border-slate-200 rounded-xl text-xs font-semibold text-slate-500 cursor-not-allowed select-none"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">Unique sequential tracking ID</span>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span className="flex items-center">
                    <span>Escalation Date</span>
                    <span className="text-red-500 font-bold ml-1">*</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono font-normal">DD/MM/YYYY</span>
                </label>
                <DateInput
                  value={formData.date || ''}
                  onChange={(e) => {
                    setFormData({ ...formData, date: e.target.value });
                    if (errors.date && e.target.value) {
                      setErrors((prev) => ({ ...prev, date: false }));
                    }
                  }}
                  className={`w-full px-3.5 py-2.5 border rounded-xl text-xs font-medium outline-none transition cursor-pointer ${
                    errors.date
                      ? 'border-rose-400 focus:ring-2 focus:ring-rose-400/20 focus:border-rose-500 bg-rose-50/20 text-slate-900'
                      : 'bg-white border-slate-200 text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500'
                  }`}
                />
                {errors.date && (
                  <p className="text-[11px] text-rose-500 font-semibold mt-1 flex items-center gap-1">
                    <span>* {errors.date}</span>
                  </p>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center">
                  <span>Product</span>
                  <span className="text-red-500 font-bold ml-1">*</span>
                </label>
                <select
                  value={formData.product}
                  onChange={(e) => {
                    setFormData({ ...formData, product: e.target.value });
                    if (errors.product && e.target.value) {
                      setErrors((prev) => ({ ...prev, product: false }));
                    }
                  }}
                  className={`w-full px-3.5 py-2.5 border rounded-xl text-xs font-medium outline-none transition cursor-pointer ${
                    errors.product
                      ? 'border-rose-400 focus:ring-2 focus:ring-rose-400/20 focus:border-rose-500 bg-rose-50/20 text-slate-900'
                      : 'bg-white border-slate-200 text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500'
                  }`}
                >
                  <option value="">Select Product</option>
                  <option value="Sets">SMT</option>
                  <option value="Units">RR</option>
                  <option value="Kg">Converter</option>
                  <option value="Batches">Sensor</option>
                  <option value="Sets">FWM</option>
                  <option value="Sets">IU/IG</option>
                  <option value="Sets">Display Unit</option>
                  <option value="Sets">ISG</option>
                  <option value="Sets">TCI/CDI</option>
                </select>
                {errors.product && (
                  <p className="text-[11px] text-rose-500 font-semibold mt-1 flex items-center gap-1">
                    <span>* {errors.product}</span>
                  </p>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center">
                  <span>Model</span>
                  <span className="text-red-500 font-bold ml-1">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Enter model"
                  value={formData.model}
                  onChange={(e) => {
                    setFormData({ ...formData, model: e.target.value });
                    if (errors.model && e.target.value.trim()) {
                      setErrors((prev) => ({ ...prev, model: false }));
                    }
                  }}
                  className={`w-full px-3.5 py-2.5 border rounded-xl text-xs font-medium placeholder:text-slate-400 outline-none transition ${
                    errors.model
                      ? 'border-rose-400 focus:ring-2 focus:ring-rose-400/20 focus:border-rose-500 bg-rose-50/20 text-slate-900'
                      : 'bg-white border-slate-200 text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500'
                  }`}
                />
                {errors.model && (
                  <p className="text-[11px] text-rose-500 font-semibold mt-1 flex items-center gap-1">
                    <span>* {errors.model}</span>
                  </p>
                )}
              </div>
            </div>

            {/* Row 2 */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center">
                  <span>Process / Operation</span>
                  <span className="text-red-500 font-bold ml-1">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Enter process or operation"
                  value={formData.processOperation}
                  onChange={(e) => {
                    setFormData({ ...formData, processOperation: e.target.value });
                    if (errors.processOperation && e.target.value.trim()) {
                      setErrors((prev) => ({ ...prev, processOperation: false }));
                    }
                  }}
                  className={`w-full px-3.5 py-2.5 border rounded-xl text-xs font-medium placeholder:text-slate-400 outline-none transition ${
                    errors.processOperation
                      ? 'border-rose-400 focus:ring-2 focus:ring-rose-400/20 focus:border-rose-500 bg-rose-50/20 text-slate-900'
                      : 'bg-white border-slate-200 text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500'
                  }`}
                />
                {errors.processOperation && (
                  <p className="text-[11px] text-rose-500 font-semibold mt-1 flex items-center gap-1">
                    <span>* {errors.processOperation}</span>
                  </p>
                )}
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center">
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
                  className={`w-full px-3.5 py-2.5 border rounded-xl text-xs font-medium outline-none transition cursor-pointer ${
                    errors.shift
                      ? 'border-rose-400 focus:ring-2 focus:ring-rose-400/20 focus:border-rose-500 bg-rose-50/20 text-slate-900'
                      : 'bg-white border-slate-200 text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500'
                  }`}
                >
                  <option value="">Select Shift</option>
                  <option value="Morning (06:00 - 14:30)">Morning (06:30 - 03:00)</option>
                  <option value="Evening (14:30 - 22:30)">Evening (03:00 - 11:30)</option>
                  <option value="Night (22:30 - 06:00)">Night (11:30 - 06:00)</option>
                  <option value="General (08:30 - 17:00)">General (08:30 - 05:00)</option>
                </select>
                {errors.shift && (
                  <p className="text-[11px] text-rose-500 font-semibold mt-1 flex items-center gap-1">
                    <span>* {errors.shift}</span>
                  </p>
                )}
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center">
                  <span>Issue Type</span>
                  <span className="text-red-500 font-bold ml-1">*</span>
                </label>
                <select
                  value={formData.issueType}
                  onChange={(e) => {
                    setFormData({ ...formData, issueType: e.target.value });
                    if (errors.issueType && e.target.value) {
                      setErrors((prev) => ({ ...prev, issueType: false }));
                    }
                  }}
                  className={`w-full px-3.5 py-2.5 border rounded-xl text-xs font-medium outline-none transition cursor-pointer ${
                    errors.issueType
                      ? 'border-rose-400 focus:ring-2 focus:ring-rose-400/20 focus:border-rose-500 bg-rose-50/20 text-slate-900'
                      : 'bg-white border-slate-200 text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500'
                  }`}
                >
                  <option value="">Select Issue Type</option>
                  <option value="Repeated">Repeated</option>
                  <option value="New">New</option>
                </select>
                {errors.issueType && (
                  <p className="text-[11px] text-rose-500 font-semibold mt-1 flex items-center gap-1">
                    <span>* {errors.issueType}</span>
                  </p>
                )}
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center">
                  <span>Priority</span>
                  <span className="text-red-500 font-bold ml-1">*</span>
                </label>
                <select
                  value={formData.priority}
                  onChange={(e) => {
                    setFormData({ ...formData, priority: e.target.value });
                    if (errors.priority && e.target.value) {
                      setErrors((prev) => ({ ...prev, priority: false }));
                    }
                  }}
                  className={`w-full px-3.5 py-2.5 border rounded-xl text-xs font-medium outline-none transition cursor-pointer ${
                    errors.priority
                      ? 'border-rose-400 focus:ring-2 focus:ring-rose-400/20 focus:border-rose-500 bg-rose-50/20 text-slate-900'
                      : 'bg-white border-slate-200 text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500'
                  }`}
                >
                  <option value="">Select Priority</option>
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                  <option value="Critical">Critical</option>
                </select>
                {errors.priority && (
                  <p className="text-[11px] text-rose-500 font-semibold mt-1 flex items-center gap-1">
                    <span>* {errors.priority}</span>
                  </p>
                )}
              </div>

            </div>

            {/* Row 3 */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center">
                <span>Issue / Observation</span>
                <span className="text-red-500 font-bold ml-1">*</span>
              </label>
              <textarea
                rows={3}
                placeholder="Enter detailed issue observation..."
                value={formData.issueObservation}
                onChange={(e) => {
                  setFormData({ ...formData, issueObservation: e.target.value });
                  if (errors.issueObservation && e.target.value.trim()) {
                    setErrors((prev) => ({ ...prev, issueObservation: false }));
                  }
                }}
                className={`w-full p-3.5 border rounded-xl text-xs outline-none transition shadow-2xs ${
                  errors.issueObservation
                    ? 'border-rose-400 focus:ring-2 focus:ring-rose-400/20 focus:border-rose-500 bg-rose-50/20 text-slate-900'
                    : 'bg-white border-slate-200 text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500'
                }`}
              />
              {errors.issueObservation && (
                <p className="text-[11px] text-rose-500 font-semibold mt-1 flex items-center gap-1">
                  <span>* {errors.issueObservation}</span>
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Section 2: Attachments & Technical Drawings */}
        <div className="bg-white rounded-2xl p-6 sm:p-7 border border-slate-200/90 shadow-2xs">
          <div className="flex items-start gap-3 pb-5 mb-5 border-b border-slate-100">
            <Paperclip className="w-5 h-5 text-slate-700 mt-0.5" />
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center">
                <span>2. Attachments & Technical Drawings</span>
                <span className="text-red-500 font-bold ml-1">*</span>
              </h2>
              <p className="text-xs text-slate-500">
                Upload CAD blueprints, PDF drawings, defect photos, or Excel inspection sheets. Click "Annotate" on any photo or spreadsheet to mark with circles, arrows, lines, and freehand sketches.
              </p>
            </div>
          </div>

          {/* Drag & Drop Upload Zone */}
          <label
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-2xl p-6 text-center flex flex-col items-center justify-center cursor-pointer transition-colors ${
              errors.attachments
                ? 'border-rose-400 bg-rose-50/30 hover:bg-rose-50/50'
                : 'border-slate-200 hover:border-blue-400 bg-slate-50/50 hover:bg-slate-50'
            }`}
          >
            <input
              type="file"
              multiple
              accept=".pdf,.png,.jpg,.jpeg,.xlsx,.xls,.csv,.ppt,.pptx,application/pdf,image/jpeg,image/png,image/*,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
              onChange={handleFileUpload}
              className="hidden"
            />
            <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 ${
              errors.attachments ? 'bg-rose-100 text-rose-600' : 'bg-blue-50 text-blue-600'
            }`}>
              <UploadCloud className="w-5 h-5" />
            </div>
            <p className="text-xs font-semibold text-slate-800">
              Drag & drop files here or <span className="text-blue-600 underline">browse</span>
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Supports Excel (.xlsx, .xls), PowerPoint (.pptx, .ppt), JPEG/Images, and PDF (Max 25MB per file) • Select multiple files
            </p>
          </label>

          {errors.attachments && (
            <p className="text-[11px] text-rose-500 font-semibold mt-1.5 flex items-center gap-1">
              <span>* {errors.attachments}</span>
            </p>
          )}

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
                      {/* Annotate - ONLY for image files */}
                      {(file.isImage || ['PNG', 'JPG', 'JPEG', 'WEBP', 'GIF', 'BMP', 'SVG'].includes((file.type || file.name?.split('.').pop() || '').toUpperCase())) && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setAnnotatingItem({ attachment: file, index: idx });
                          }}
                          className="px-2 py-1 rounded-lg text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 flex items-center gap-1 transition cursor-pointer shadow-2xs"
                          title="Annotate image"
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


        {/* Section 3: Assign Executor */}
        <div className="bg-white rounded-2xl p-6 sm:p-7 border border-slate-200/90 shadow-2xs">
          <div className="flex items-start gap-3 pb-5 mb-5 border-b border-slate-100">
            <UserCheck className="w-5 h-5 text-slate-700 mt-0.5" />
            <div>
              <h2 className="text-sm font-bold text-slate-900">3. Assign Executor</h2>
              <p className="text-xs text-slate-500">
                Designate the department and technician or supervisor accountable for running this batch.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center">
                <span>Department</span>
                <span className="text-red-500 font-bold ml-1">*</span>
              </label>
              <select
                value={formData.department}
                onChange={(e) => {
                  const newDept = e.target.value;
                  setFormData((prev) => ({
                    ...prev,
                    department: newDept,
                    executor: '',
                  }));
                  setSelectedExecutors([]);
                  setExecutorDropdownOpen(false);
                  setExecutorSearch('');
                  if (errors.department) {
                    setErrors((prev) => ({ ...prev, department: '' }));
                  }
                }}
                className={`w-full px-3.5 py-2.5 bg-white border rounded-xl text-xs font-medium transition cursor-pointer ${
                  errors.department
                    ? 'border-rose-400 focus:ring-2 focus:ring-rose-400/20 focus:border-rose-500 bg-rose-50/20 text-slate-900'
                    : 'border-slate-200 text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500'
                }`}
              >
                <option value="">Select</option>
                {departmentList.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
              {errors.department && (
                <p className="text-[11px] text-rose-500 font-semibold mt-1 flex items-center gap-1">
                  <span>* {errors.department}</span>
                </p>
              )}
            </div>

            <div className="relative" ref={executorDropdownRef}>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center">
                  <span>Assign Executor</span>
                  <span className="text-red-500 font-bold ml-1">*</span>
                </label>
                {formData.department && availableExecutors.length > 0 && selectedExecutors.length > 0 && (
                  <div className="flex items-center gap-2 text-[10px]">
                    <button
                      type="button"
                      onClick={handleClearAllExecutors}
                      className="text-rose-600 hover:text-rose-700 font-semibold hover:underline cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>

              {/* Multi-select Trigger Box */}
              <div
                onClick={() => {
                  if (formData.department && !loadingExecutors && availableExecutors.length > 0) {
                    setExecutorDropdownOpen((prev) => !prev);
                  }
                }}
                className={`w-full min-h-[42px] px-3.5 py-2 border rounded-xl text-xs font-medium transition flex items-center justify-between gap-2 ${
                  !formData.department
                    ? 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed'
                    : loadingExecutors
                    ? 'bg-slate-50 border-slate-200 text-slate-400 cursor-wait'
                    : availableExecutors.length === 0
                    ? 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed'
                    : errors.executor
                    ? 'border-rose-400 bg-rose-50/20 ring-2 ring-rose-400/20 cursor-pointer'
                    : executorDropdownOpen
                    ? 'bg-white border-blue-500 ring-2 ring-blue-500/20 cursor-pointer shadow-xs'
                    : 'bg-white border-slate-200 hover:border-slate-300 text-slate-800 cursor-pointer shadow-2xs'
                }`}
              >
                <div className="flex-1 flex flex-wrap items-center gap-1.5 min-w-0 py-0.5">
                  {!formData.department ? (
                    <span className="text-slate-400">Select Department first</span>
                  ) : loadingExecutors ? (
                    <span className="text-slate-400 flex items-center gap-2">
                      <span className="w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                      Loading executors from DB...
                    </span>
                  ) : availableExecutors.length === 0 ? (
                    <span className="text-slate-500 italic">There is no users in the selected department</span>
                  ) : selectedExecutors.length === 0 ? (
                    <span className="text-slate-400">Select one or more executors</span>
                  ) : (
                    selectedExecutors.map((execName) => {
                      const matched = availableExecutors.find((e) => e.name === execName);
                      const display = matched ? matched.name : execName;
                      return (
                        <span
                          key={execName}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200/80 text-[11px] font-semibold"
                        >
                          <span className="truncate max-w-[150px]">{display}</span>
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleExecutor(execName);
                            }}
                            className="p-0.5 hover:bg-blue-200/60 rounded text-blue-600 hover:text-blue-900 transition cursor-pointer"
                            title="Remove"
                          >
                            <X className="w-3 h-3" />
                          </span>
                        </span>
                      );
                    })
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0 text-slate-400">
                  {selectedExecutors.length > 0 && (
                    <span className="px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded-md text-[10px] font-bold">
                      {selectedExecutors.length}
                    </span>
                  )}
                  <ChevronDown
                    className={`w-4 h-4 transition-transform duration-200 ${
                      executorDropdownOpen ? 'rotate-180 text-blue-600' : ''
                    }`}
                  />
                </div>
              </div>

              {errors.executor && (
                <p className="text-[11px] text-rose-500 font-semibold mt-1 flex items-center gap-1">
                  <span>* {errors.executor}</span>
                </p>
              )}

              {/* Hidden input for multi-select */}
              <input
                type="text"
                tabIndex={-1}
                value={selectedExecutors.join(', ')}
                onChange={() => {}}
                className="sr-only"
                aria-hidden="true"
              />

              {/* Dropdown Menu */}
              {executorDropdownOpen && formData.department && availableExecutors.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                  {/* Search box inside dropdown if more than 3 options */}
                  {availableExecutors.length > 3 && (
                    <div className="p-2 border-b border-slate-100 bg-slate-50/70">
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={executorSearch}
                          onChange={(e) => setExecutorSearch(e.target.value)}
                          placeholder="Search executor by name..."
                          className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                    </div>
                  )}

                  <div className="max-h-56 overflow-y-auto p-1.5 divide-y divide-slate-50">
                    {availableExecutors
                      .filter((e) =>
                        e.label.toLowerCase().includes(executorSearch.toLowerCase()) ||
                        e.name.toLowerCase().includes(executorSearch.toLowerCase())
                      )
                      .map((exec) => {
                        const isChecked = selectedExecutors.includes(exec.name);
                        return (
                          <div
                            key={exec.id || exec.name}
                            onClick={() => handleToggleExecutor(exec.name)}
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
                                <div className="text-xs truncate">{exec.name}</div>
                                {exec.role && exec.role.toLowerCase() !== 'user' && (
                                  <div className="text-[10px] text-slate-400 truncate">
                                    {exec.role}
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
                      {selectedExecutors.length} of {availableExecutors.length} selected
                    </span>
                    <button
                      type="button"
                      onClick={() => setExecutorDropdownOpen(false)}
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <span className="text-[11px] mt-2.5 block">
            {formData.department && !loadingExecutors && availableExecutors.length === 0 ? (
              <span className="text-amber-600 font-medium flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 inline shrink-0" />
                There is no users in the selected department
              </span>
            ) : selectedExecutors.length > 1 ? (
              <span className="text-slate-400">
                An automated dispatch and in-app alert will notify all {selectedExecutors.length} executors upon submission.
              </span>
            ) : (
              <span className="text-slate-400">
                An automated dispatch and in-app alert will notify the executor upon submission.
              </span>
            )}
          </span>
        </div>



        {/* Section 4: Production Notes & Comments */}
        <div className="bg-white rounded-2xl p-6 sm:p-7 border border-slate-200/90 shadow-2xs">
          <div className="flex items-start gap-3 pb-5 mb-5 border-b border-slate-100">
            <MessageSquare className="w-5 h-5 text-slate-700 mt-0.5" />
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <span>4. Comments</span>
                <span className="text-xs font-normal text-slate-400">(Optional)</span>
              </h2>
              <p className="text-xs text-slate-500">
                Provide specific handling precautions, tooling notes, or safety instructions.
              </p>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <span>Comments</span>
              <span className="text-slate-400 font-normal lowercase">(optional)</span>
            </label>
            <textarea
              rows={3}
              placeholder="Enter optional comments, remarks, or specific handling notes..."
              value={formData.comments}
              onChange={(e) => setFormData({ ...formData, comments: e.target.value })}
              className="w-full p-3.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition shadow-2xs"
            />
          </div>
        </div>

        {/* Bottom Actions Bar */}
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
            disabled={isSubmitting}
            className="px-6 py-2.5 bg-[#2563eb] hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/20 flex items-center gap-2 transition cursor-pointer disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Submitting...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Submit </span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Universal Attachment Preview Modal (Interactive Excel Spreadsheet, PDF, Images) */}
      <AttachmentPreviewModal
        isOpen={Boolean(previewAttachment)}
        attachment={previewAttachment}
        onClose={() => setPreviewAttachment(null)}
        onAnnotate={(att) => {
          if (!att) return;
          const idx = attachments.findIndex((a) => a === att || a.name === att?.name);
          if (idx !== -1) {
            setAnnotatingItem({ attachment: attachments[idx], index: idx });
          } else {
            // New snapshot created from an Excel sheet
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

export default CreateRequest;
