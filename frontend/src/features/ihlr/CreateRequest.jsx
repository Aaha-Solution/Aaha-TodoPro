import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FileText, 
  UploadCloud, 
  Upload,
  Paperclip,
  X,
  Send, 
  ShieldAlert, 
  Trash2, 
  ArrowLeft,
  FileSpreadsheet,
  File,
  ExternalLink,
  Loader2,
  Image as ImageIcon
} from 'lucide-react';
import { ihlrService } from '../../services/ihlrService';
import { getFileMeta, parseAttachments } from './IhlrAttachmentView';
import IhlrAttachmentPreviewModal from './IhlrAttachmentPreviewModal';


const IhlrCreateRequest = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
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

  const handleFileUpload = async (e) => {
    const fileList = Array.from(e.target.files || []);
    if (fileList.length === 0) return;

    setUploadingFile(true);
    try {
      const uploaded = await ihlrService.uploadAttachments(fileList);
      if (uploaded && uploaded.length > 0) {
        setAttachments((prev) => {
          const existingNames = new Set(prev.map((f) => f.name));
          const fresh = uploaded.filter((f) => !existingNames.has(f.name));
          return [...prev, ...(fresh.length > 0 ? fresh : uploaded)];
        });
      }
    } catch (err) {
      console.warn('Upload API call failed, using client file representation:', err);
      const clientFiles = fileList.map((file) => {
        const ext = file.name.split('.').pop()?.toUpperCase() || 'FILE';
        const isImg = ['PNG', 'JPG', 'JPEG', 'GIF', 'WEBP', 'SVG'].includes(ext);
        return {
          name: file.name,
          size: `${(file.size / (1024 * 1024)).toFixed(2)} MB`,
          type: ext,
          isImage: isImg,
          url: URL.createObjectURL(file),
        };
      });
      setAttachments((prev) => [...prev, ...clientFiles]);
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveAttachment = (indexToRemove) => {
    setAttachments((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleClearAllAttachments = (e) => {
    if (e) e.stopPropagation();
    setAttachments([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
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
      await ihlrService.createRequest({
        ...formData,
        batch_date: formData.batch_date || new Date().toISOString().split('T')[0],
        actual_qty: formData.actual_qty ? Number(formData.actual_qty) : 1,
        qa_why_why: qaWhyWhy,
        defect_image: attachments.length > 0 ? JSON.stringify(attachments) : ''
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

            {/* Date */}
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

          {/* Defect Attachment / Evidence Upload (Images, PDF, Word, Excel) */}
          <div className="pt-2 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="block font-bold text-slate-700 uppercase tracking-wider text-[11px]">
                Defect Evidence / Attachment Upload (Images, PDF, Word, Excel)
              </label>
              {uploadingFile && (
                <span className="flex items-center gap-1.5 text-xs text-blue-600 font-semibold animate-pulse">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Uploading attachment(s)...
                </span>
              )}
            </div>

            {/* Input Bar with Comma-Separated Filenames + Clear Button + Upload Button */}
            <div className="flex items-center gap-2.5">
              <div className="relative flex-1">
                <input
                  type="text"
                  readOnly
                  value={attachments.map((f) => f.name).join(', ')}
                  placeholder="Select images, PDF, Word or Excel files..."
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full pl-3.5 pr-8 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 cursor-pointer shadow-2xs truncate select-none"
                />
                {attachments.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearAllAttachments}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-100 transition cursor-pointer"
                    title="Clear all files"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Hidden Native Multi-File Input */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                onChange={handleFileUpload}
                className="hidden"
              />

              {/* Upload Button matching requested UI */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingFile}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-300 hover:border-blue-400 rounded-lg text-xs font-semibold text-blue-600 hover:text-blue-700 transition shadow-2xs cursor-pointer shrink-0 disabled:opacity-50"
              >
                {uploadingFile ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                    <span>Uploading...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 text-blue-600" />
                    <span>Upload</span>
                  </>
                )}
              </button>
            </div>

            {/* Attachment Chips matching user requested UI: [ 📎 Filename.ext  ✕ ] */}
            {attachments.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 pt-0.5">
                {attachments.map((att, idx) => (
                  <div
                    key={`${att.name || att.url}-${idx}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#f1f5f9] hover:bg-slate-200/80 border border-slate-200 text-xs font-medium text-slate-700 shadow-2xs transition group"
                  >
                    <Paperclip className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 shrink-0" />
                    <span
                      className="truncate max-w-[170px] sm:max-w-[240px] cursor-pointer hover:text-blue-600 select-none"
                      title={`${att.name} ${att.size ? `(${att.size})` : ''} - Click to preview`}
                      onClick={() => setPreviewAttachment(att)}
                    >
                      {att.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveAttachment(idx)}
                      className="p-0.5 text-slate-400 hover:text-red-500 rounded-full hover:bg-slate-300/50 transition cursor-pointer ml-0.5"
                      title={`Remove ${att.name}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Image Preview Thumbnails (if any images are selected) */}
            {attachments.some((a) => a.isImage || (a.url && a.url.startsWith('data:image')) || ['PNG', 'JPG', 'JPEG', 'WEBP', 'GIF'].includes((a.type || '').toUpperCase())) && (
              <div className="flex flex-wrap items-center gap-2.5 pt-2">
                {attachments
                  .filter((a) => a.isImage || (a.url && a.url.startsWith('data:image')) || ['PNG', 'JPG', 'JPEG', 'WEBP', 'GIF'].includes((a.type || '').toUpperCase()))
                  .map((imgAtt, i) => (
                    <div
                      key={`img-prev-${i}`}
                      className="relative w-16 h-16 rounded-xl overflow-hidden border border-slate-200 bg-white shadow-2xs group cursor-pointer"
                      onClick={() => setPreviewAttachment(imgAtt)}
                      title={`Preview: ${imgAtt.name}`}
                    >
                      <img src={imgAtt.url} alt={imgAtt.name} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition text-[9px] font-bold">
                        View
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>

        {/* Section 2: QA Why-Why Analysis */}
        <div className="bg-white rounded-2xl p-6 sm:p-7 border border-slate-200/90 shadow-2xs space-y-4">
          <div className="flex items-start gap-3 pb-4 border-b border-slate-100">
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                2. Problem Cause Why-Why Analysis (QA Team)
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

      {/* Dedicated In-Page Preview Modal (Never opens in new tab) */}
      <IhlrAttachmentPreviewModal
        isOpen={Boolean(previewAttachment)}
        attachment={previewAttachment}
        onClose={() => setPreviewAttachment(null)}
      />
    </div>
  );
};

export default IhlrCreateRequest;
