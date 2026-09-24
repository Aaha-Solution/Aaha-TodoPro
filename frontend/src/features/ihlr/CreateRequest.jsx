import React, { useState, useEffect } from 'react';
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
  Image as ImageIcon
} from 'lucide-react';
import { ihlrService } from '../../services/ihlrService';

const IhlrCreateRequest = () => {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [dbUsers, setDbUsers] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [previewAttachment, setPreviewAttachment] = useState(null);

  const [formData, setFormData] = useState({
    req_no: 'IHLR-1',
    batch_date: '',
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
  });

  const [qaWhyWhy, setQaWhyWhy] = useState(['', '', '', '', '']);

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
        if (isImage || isPdf) {
          try {
            previewUrl = URL.createObjectURL(file);
          } catch {
            previewUrl = '';
          }
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
    if (!formData.problem || !formData.model) {
      alert('Please fill in the Problem Description and Model.');
      return;
    }
    if (!formData.shift) {
      alert('Please select a Shift.');
      return;
    }
    if (!formData.four_m) {
      alert('Please select a 4M Category.');
      return;
    }
    if (!formData.resp) {
      alert('Please select a Responsibility department.');
      return;
    }
    if (!formData.resp_person) {
      alert('Please select a User Name (Responsible Person) based on the department.');
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

      await ihlrService.createRequest({
        ...formData,
        batch_date: formData.batch_date || new Date().toISOString().split('T')[0],
        actual_qty: formData.actual_qty ? Number(formData.actual_qty) : 1,
        qa_why_why: qaWhyWhy,
        defect_image: finalAttachments.length > 0 ? JSON.stringify(finalAttachments) : '',
        attachments: finalAttachments,
      });
      alert('IHLR Analysis Report submitted successfully!');
      navigate('/ihlr/my-requests');
    } catch (err) {
      alert('Failed to submit IHLR Report: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

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
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1 text-[11px]">
                Incident Date *
              </label>
              <input
                type="date"
                value={formData.batch_date}
                onChange={(e) => setFormData({ ...formData, batch_date: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none font-medium cursor-pointer"
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
                onChange={(e) => setFormData({ ...formData, resp: e.target.value, resp_person: '' })}
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

            {/* Responsible Person / User Name based on Department */}
            <div className="sm:col-span-1 lg:col-span-2">
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1 text-[11px]">
                User Name (Based on Dep) *
              </label>
              <select
                value={formData.resp_person}
                disabled={!formData.resp}
                onChange={(e) => setFormData({ ...formData, resp_person: e.target.value })}
                className={`w-full px-3 py-2 border rounded-xl font-medium outline-none transition ${
                  formData.resp
                    ? 'bg-slate-50 border-slate-200 text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer'
                    : 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                }`}
                required
              >
                <option value="">
                  {!formData.resp
                    ? 'Select Department First'
                    : getDepartmentUsers(formData.resp).length === 0
                      ? 'No DB users found for this department'
                      : 'Select User Name'}
                </option>
                {getDepartmentUsers(formData.resp).map((u) => (
                  <option key={u.id} value={u.name}>
                    {u.name}
                  </option>
                ))}
              </select>
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
            onClick={() => navigate('/ihlr/my-requests')}
            className="px-5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/20 transition transform active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            <Send className="w-4 h-4" />
            <span>{submitting ? 'Submitting...' : 'Submit IHLR Report'}</span>
          </button>
        </div>
      </form>

      {/* Attachment Preview Modal */}
      {previewAttachment && (() => {
        const meta = getFileMeta(previewAttachment);
        const IconComponent = meta.icon;
        return createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-4 animate-in fade-in duration-150"
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
                      {meta.typeName} {previewAttachment.size ? `• ${previewAttachment.size}` : ''}
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
          </div>,
          document.body
        );
      })()}
    </div>
  );
};

export default IhlrCreateRequest;
