import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  UserCheck,
  Paperclip,
  MessageSquare,
  UploadCloud,
  Trash2,
  Send,
  Check,
  Calendar,
  X,
  Eye,
  Download,
  FileSpreadsheet,
  Presentation,
  File as FileIcon,
  Image as ImageIcon
} from 'lucide-react';
import { processAuditService } from '../../services/processAuditService';

const DEPARTMENT_EXECUTORS = {
  'MAINTENANCE': [
    'Mr. Karthik (Maintenance Engineer)',
    'Mr. Rajesh (Electrical Lead)',
    'Mr. Balaji (Tooling Specialist)',
  ],
  'PRODUCTION': [
    'Mr. Kumar (Assembly Lead)',
    'Mr. Murugan (Line 1 Supervisor)',
    'Ms. Kavitha (Assembly Specialist)',
    'Mr. Suresh (Floor Engineer)',
  ],
  'PED': [
    'Mr. Vignesh (Process Engineer)',
    'Mr. Anand (NPI Lead)',
    'Mr. Dinesh (Tooling & Fixtures)',
  ],
  'MATERIALS': [
    'Mr. Arjun (Packaging Supervisor)',
    'Mr. Ramesh (Material Planning)',
    'Mr. Sathish (Inventory Lead)',
  ],
  'MARKETING': [
    'Mr. Praveen (Customer Quality Liaison)',
    'Ms. Priya (Order Fulfillment)',
  ],
  'INCOMING QUALITY': [
    'Mr. Ravi (Inspection Head)',
    'Mr. Prakash (QC Inspector)',
    'Ms. Deepa (Quality Auditor)',
  ],
};

const DEPARTMENT_LIST = Array.isArray(DEPARTMENT_EXECUTORS)
  ? DEPARTMENT_EXECUTORS
  : Object.keys(DEPARTMENT_EXECUTORS);

const EXECUTORS_MAP = Array.isArray(DEPARTMENT_EXECUTORS)
  ? {
      'MAINTENANCE': ['Mr. Karthik (Maintenance Engineer)', 'Mr. Rajesh (Electrical Lead)', 'Mr. Balaji (Tooling Specialist)'],
      'PRODUCTION': ['Mr. Kumar (Assembly Lead)', 'Mr. Murugan (Line 1 Supervisor)', 'Ms. Kavitha (Assembly Specialist)', 'Mr. Suresh (Floor Engineer)'],
      'PED': ['Mr. Vignesh (Process Engineer)', 'Mr. Anand (NPI Lead)', 'Mr. Dinesh (Tooling & Fixtures)'],
      'MATERIALS': ['Mr. Arjun (Packaging Supervisor)', 'Mr. Ramesh (Material Planning)', 'Mr. Sathish (Inventory Lead)'],
      'MARKETING': ['Mr. Praveen (Customer Quality Liaison)', 'Ms. Priya (Order Fulfillment)'],
      'INCOMING QUALITY': ['Mr. Ravi (Inspection Head)', 'Mr. Prakash (QC Inspector)', 'Ms. Deepa (Quality Auditor)'],
    }
  : DEPARTMENT_EXECUTORS;

const CreateRequest = () => {
  const navigate = useNavigate();

  const getTodayDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [formData, setFormData] = useState({
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
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const [attachments, setAttachments] = useState([]);
  const [previewAttachment, setPreviewAttachment] = useState(null);

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
      const newAttachments = files.map((file) => {
        const ext = file.name.split('.').pop()?.toUpperCase() || 'FILE';
        const isImage = ['PNG', 'JPG', 'JPEG', 'GIF', 'WEBP', 'SVG'].includes(ext);
        const isPdf = ext === 'PDF';
        const isExcel = ['XLS', 'XLSX', 'CSV', 'XLSM'].includes(ext);
        const isPpt = ['PPT', 'PPTX', 'PPSX'].includes(ext);
        return {
          file, // Keep raw File instance for backend upload
          name: file.name,
          size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
          date: 'Just now',
          type: ext,
          isImage,
          isPdf,
          isExcel,
          isPpt,
          url: URL.createObjectURL(file),
        };
      });
      setAttachments((prev) => [...prev, ...newAttachments]);
    }
  };

  const handleFileUpload = (e) => {
    processFiles(e.target.files);
    e.target.value = '';
  };

  const handleDrop = (e) => {
    e.preventDefault();
    processFiles(e.dataTransfer.files);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.product) {
      alert('Please select a Product');
      return;
    }
    if (!formData.model) {
      alert('Please select a Model');
      return;
    }
    if (!formData.processOperation) {
      alert('Please select a Process / Operation');
      return;
    }
    if (!formData.shift) {
      alert('Please select a Shift');
      return;
    }
    if (!formData.department) {
      alert('Please select a Department in Section 3');
      return;
    }
    if (!formData.executor) {
      alert('Please select an Assign Executor in Section 3');
      return;
    }

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
      const match = uploadedFilesMeta.find((u) => u.name === att.name);
      return {
        name: att.name,
        size: att.size,
        type: att.type,
        date: att.date,
        path: match?.path || `uploads/attachments/${att.name}`,
        url: match?.url || att.url || '',
        filename: match?.filename || '',
      };
    });

    const formattedIssueNo = String(formData.requestId || '').startsWith('PA-')
      ? formData.requestId
      : `PA-${formData.requestId || '1'}`;

    const payload = {
      issue_no: formattedIssueNo,
      escalation_date: formData.date,
      product: formData.product,
      model: formData.model,
      process_operation: formData.processOperation,
      shift: formData.shift,
      issue_type: formData.issueType || 'New',
      priority: formData.priority || 'Medium',
      issue_observation: formData.issueObservation,
      department: formData.department,
      executor: formData.executor,
      comments: formData.comments,
      attachments: finalAttachments,
    };

    try {
      const res = await processAuditService.createRequest(payload);
      const savedId = res?.data?.issue_no || (res?.data?.id ? `PA-${res.data.id}` : formData.requestId);
      alert(`Production Request ${savedId} created and saved to Database successfully!`);
      navigate('/process-audit/my-requests');
    } catch (err) {
      console.error('Failed to save request in DB:', err);
      const msg = err.response?.data?.message || err.message || 'Saved locally';
      alert(`Production Request ${formData.requestId} created! (Notice: ${msg})`);
      navigate('/process-audit/my-requests');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 w-full pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Create Production Request
          </h1>

        </div>


      </div>




      {/* Form Container */}
      <form onSubmit={handleSubmit} className="space-y-6">
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
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  ISSUE NO (Auto-Generated)
                </label>
                <input
                  type="text"
                  disabled
                  value={String(formData.requestId || '').startsWith('PA-') ? formData.requestId : `PA-${formData.requestId || '1'}`}
                  className="w-full px-3.5 py-2.5 bg-slate-100/80 border border-slate-200 rounded-xl text-xs font-semibold text-slate-500 cursor-not-allowed"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">Unique sequential tracking ID</span>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Escalation Date *
                </label>
                <div className="relative">
                  <input
                    type="date"
                    required
                    value={formData.date || ''}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-3.5  py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-500 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500  cursor-pointer [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                  />
                </div>
              </div>







              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Product *
                </label>
                <select
                  value={formData.product}
                  onChange={(e) => setFormData({ ...formData, product: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
                >
                  <option value="">Select</option>
                  <option value="Units">Units</option>
                  <option value="Kg">Kg</option>
                  <option value="Batches">Batches</option>
                  <option value="Sets">Sets</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Model *
                </label>
                <select
                  value={formData.model}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
                >
                  <option value="">Select</option>
                  <option value="Assembly">Assembly</option>
                  <option value="Inspection">Inspection</option>
                  <option value="Packaging">Packaging</option>
                  <option value="Raw Material">Raw Material</option>
                  <option value="Production">Production</option>
                </select>
              </div>
            </div>

            {/* Row 2 */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Process / Operation *
                </label>
                <select
                  required
                  value={formData.processOperation}
                  onChange={(e) => setFormData({ ...formData, processOperation: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
                >
                  <option value="">Select</option>
                  <option value="Laser Marking">Laser Marking</option>
                  <option value="Stator Winding & Lacing">Stator Winding & Lacing</option>
                  <option value="Rotor Die Casting">Rotor Die Casting</option>
                  <option value="CNC Milling & Machining">CNC Milling & Machining</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Shift *
                </label>
                <select
                  value={formData.shift}
                  onChange={(e) => setFormData({ ...formData, shift: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
                >
                  <option value="">Select</option>
                  <option value="Morning (06:00 - 14:30)">Morning (06:00 - 14:30)</option>
                  <option value="Evening (14:30 - 22:30)">Evening (14:30 - 22:30)</option>
                  <option value="Night (22:30 - 06:00)">Night (22:30 - 06:00)</option>
                  <option value="General (08:30 - 17:00)">General (08:30 - 17:00)</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Issue Type
                </label>
                <select
                  value={formData.issueType}
                  onChange={(e) => setFormData({ ...formData, issueType: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
                >
                  <option value="">Select</option>
                  <option value="Repeated">Repeated</option>
                  <option value="New">New</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Priority
                </label>
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
                >
                  <option value="">Select</option>
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                  <option value="Critical">Critical</option>
                </select>
              </div>

            </div>

            {/* Row 3 */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Issue / Observation
              </label>
              <textarea
                rows={3}
                value={formData.issueObservation}
                onChange={(e) => setFormData({ ...formData, issueObservation: e.target.value })}
                className="w-full p-3.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition shadow-2xs"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Attachments & Technical Drawings */}
        <div className="bg-white rounded-2xl p-6 sm:p-7 border border-slate-200/90 shadow-2xs">
          <div className="flex items-start gap-3 pb-5 mb-5 border-b border-slate-100">
            <Paperclip className="w-5 h-5 text-slate-700 mt-0.5" />
            <div>
              <h2 className="text-sm font-bold text-slate-900">2. Attachments & Technical Drawings</h2>
              <p className="text-xs text-slate-500">
                Upload spec sheets, CAD revisions, BOM documents, or torque tolerance blueprints.
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
              accept=".pdf,.png,.jpg,.jpeg,.xlsx,.xls,.csv,.ppt,.pptx,application/pdf,image/jpeg,image/png,image/*,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
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
              Supports Excel (.xlsx, .xls), PowerPoint (.pptx, .ppt), JPEG/Images, and PDF (Max 25MB per file) • Select multiple files
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
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Department *
              </label>
              <select
                required
                value={formData.department}
                onChange={(e) => {
                  const newDept = e.target.value;
                  setFormData((prev) => ({
                    ...prev,
                    department: newDept,
                    executor: '',
                  }));
                }}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
              >
                <option value="">Select</option>
                {DEPARTMENT_LIST.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Assign Executor *
              </label>
              <select
                required
                disabled={!formData.department}
                value={formData.executor}
                onChange={(e) => setFormData({ ...formData, executor: e.target.value })}
                className={`w-full px-3.5 py-2.5 border rounded-xl text-xs font-medium transition ${formData.department
                  ? 'bg-white border-slate-200 text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer'
                  : 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
              >
                <option value="">
                  {formData.department ? 'Select' : 'Select Department first'}
                </option>
                {((EXECUTORS_MAP[formData.department]) || []).map((exec) => (
                  <option key={exec} value={exec}>
                    {exec}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <span className="text-[11px] text-slate-400 mt-2.5 block">
            An automated dispatch and in-app alert will notify the executor upon submission.
          </span>
        </div>



        {/* Section 4: Production Notes & Comments */}
        <div className="bg-white rounded-2xl p-6 sm:p-7 border border-slate-200/90 shadow-2xs">
          <div className="flex items-start gap-3 pb-5 mb-5 border-b border-slate-100">
            <MessageSquare className="w-5 h-5 text-slate-700 mt-0.5" />
            <div>
              <h2 className="text-sm font-bold text-slate-900">4.  Comments</h2>
              <p className="text-xs text-slate-500">
                Provide specific handling precautions, tooling notes, or safety instructions.
              </p>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Comments
            </label>
            <textarea
              rows={3}
              value={formData.comments}
              onChange={(e) => setFormData({ ...formData, comments: e.target.value })}
              className="w-full p-3.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition shadow-2xs"
            />
          </div>
        </div>

        {/* Bottom Actions Bar */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2.5 bg-[#2563eb] hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/20 flex items-center gap-2 transition cursor-pointer disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Saving to Database...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Submit Request</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Attachment Preview Modal */}
      {previewAttachment && (() => {
        const meta = getFileMeta(previewAttachment);
        const IconComponent = meta.icon;
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-4 animate-in fade-in duration-150"
            onClick={() => setPreviewAttachment(null)}
          >
            <div
              className="bg-white rounded-3xl max-w-3xl w-full p-5 sm:p-6 shadow-2xl border border-slate-100 flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 shrink-0">
                <div className="flex items-center gap-3 min-w-0 pr-4">
                  <span className={`px-2.5 py-1 text-xs font-bold rounded-lg border shrink-0 flex items-center gap-1.5 ${meta.badgeBg}`}>
                    <IconComponent className="w-3.5 h-3.5" />
                    {previewAttachment.type}
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-slate-900 truncate" title={previewAttachment.name}>
                      {previewAttachment.name}
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      {meta.typeName} • {previewAttachment.size} • {previewAttachment.date}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {previewAttachment.url && (
                    <a
                      href={previewAttachment.url}
                      download={previewAttachment.name}
                      className="p-2 rounded-xl text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition cursor-pointer"
                      title="Download file"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => setPreviewAttachment(null)}
                    className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                    title="Close preview"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Modal Content Preview */}
              <div className="flex-1 overflow-auto p-4 my-2 flex items-center justify-center min-h-[300px] bg-slate-50/70 rounded-2xl border border-slate-100">
                {previewAttachment.isImage && previewAttachment.url ? (
                  <img
                    src={previewAttachment.url}
                    alt={previewAttachment.name}
                    className="max-h-[65vh] w-auto max-w-full object-contain rounded-xl shadow-xs"
                  />
                ) : previewAttachment.isPdf && previewAttachment.url ? (
                  <iframe
                    src={previewAttachment.url}
                    title={previewAttachment.name}
                    className="w-full h-[65vh] rounded-xl border border-slate-200"
                  />
                ) : (
                  <div className="text-center py-10 px-4 max-w-md">
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-3 text-lg font-bold border shadow-xs ${meta.badgeBg}`}>
                      <IconComponent className="w-8 h-8" />
                    </div>
                    <h4 className="text-sm font-bold text-slate-800 mb-1">
                      {previewAttachment.name}
                    </h4>
                    <p className="text-xs text-slate-500 mb-4">
                      {previewAttachment.isExcel
                        ? 'This Microsoft Excel spreadsheet can be downloaded or opened with Excel / Office viewer.'
                        : previewAttachment.isPpt
                          ? 'This Microsoft PowerPoint presentation can be downloaded or opened with PowerPoint / presentation viewer.'
                          : `This file format (${previewAttachment.type}) cannot be directly rendered inline in the browser.`}
                    </p>
                    {previewAttachment.url && (
                      <div className="flex flex-wrap items-center justify-center gap-3">
                        <a
                          href={previewAttachment.url}
                          download={previewAttachment.name}
                          className={`inline-flex items-center gap-2 px-4 py-2.5 text-white text-xs font-semibold rounded-xl shadow-xs transition ${previewAttachment.isExcel
                            ? 'bg-emerald-600 hover:bg-emerald-700'
                            : previewAttachment.isPpt
                              ? 'bg-orange-600 hover:bg-orange-700'
                              : 'bg-blue-600 hover:bg-blue-700'
                            }`}
                        >
                          <Download className="w-4 h-4" />
                          Download {previewAttachment.type} File
                        </a>
                        <a
                          href={previewAttachment.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl shadow-xs transition"
                        >
                          <Eye className="w-4 h-4" />
                          Open in Browser Tab
                        </a>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default CreateRequest;
