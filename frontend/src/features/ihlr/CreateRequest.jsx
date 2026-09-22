import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FileText, 
  UploadCloud, 
  Send, 
  Calendar, 
  Layers, 
  ShieldAlert, 
  Trash2, 
  ArrowLeft,
  Image as ImageIcon
} from 'lucide-react';
import { ihlrService } from '../../services/ihlrService';

const IhlrCreateRequest = () => {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    req_no: `IHLR-${Math.floor(100 + Math.random() * 900)}`,
    batch_date: new Date().toISOString().split('T')[0],
    shift: 'I',
    problem: '',
    model: '',
    problem_detected_at: 'Final Testing',
    received_from: 'D3/LINE',
    analysis_done_by: 'GURU',
    actual_qty: 1,
    four_m: 'MAN',
    resp: 'PROD',
    status: 'OPEN'
  });

  const [qaWhyWhy, setQaWhyWhy] = useState(['', '', '', '', '']);
  const [defectImage, setDefectImage] = useState('');

  const handleQaWhyChange = (index, value) => {
    const updated = [...qaWhyWhy];
    updated[index] = value;
    setQaWhyWhy(updated);
  };

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setDefectImage(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.problem || !formData.model) {
      alert('Please fill in the Problem Description and Model.');
      return;
    }

    setSubmitting(true);
    try {
      await ihlrService.createRequest({
        ...formData,
        qa_why_why: qaWhyWhy,
        defect_image: defectImage
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
                Req No *
              </label>
              <input
                type="text"
                value={formData.req_no}
                onChange={(e) => setFormData({ ...formData, req_no: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
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
              >
                <option value="I">Shift I (Morning)</option>
                <option value="II">Shift II (Evening)</option>
                <option value="III">Shift III (Night)</option>
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
                value={formData.actual_qty}
                onChange={(e) => setFormData({ ...formData, actual_qty: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none font-mono"
              />
            </div>

            {/* 4M Category */}
            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1 text-[11px]">
                4M Category *
              </label>
              <select
                value={formData.four_m}
                onChange={(e) => setFormData({ ...formData, four_m: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none font-bold"
              >
                <option value="MAN">MAN</option>
                <option value="MACHINE">MACHINE</option>
                <option value="METHOD">METHOD</option>
                <option value="MATERIAL">MATERIAL</option>
              </select>
            </div>

            {/* Responsibility */}
            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1 text-[11px]">
                Responsibility (Resp) *
              </label>
              <select
                value={formData.resp}
                onChange={(e) => setFormData({ ...formData, resp: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none font-bold"
              >
                <option value="PROD">PROD (Production)</option>
                <option value="QA">QA (Quality Assurance)</option>
                <option value="MAINT">MAINT (Maintenance)</option>
                <option value="ENG">ENG (Engineering)</option>
                <option value="STORE">STORE (Logistics)</option>
              </select>
            </div>
          </div>

          {/* Defect Image Upload */}
          <div className="pt-2">
            <label className="block font-bold text-slate-700 uppercase tracking-wider mb-2 text-[11px]">
              Defect Image Upload
            </label>
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <label className="flex-1 w-full flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-2xl cursor-pointer bg-slate-50 hover:bg-blue-50/20 transition">
                <UploadCloud className="w-6 h-6 text-slate-400 mb-1" />
                <span className="text-xs font-semibold text-slate-700">Click to upload photo of defect</span>
                <span className="text-[10px] text-slate-400">PNG, JPG or JPEG up to 10MB</span>
                <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
              </label>

              {defectImage && (
                <div className="relative w-28 h-28 rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 shrink-0">
                  <img src={defectImage} alt="Defect Preview" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setDefectImage('')}
                    className="absolute top-1 right-1 p-1 bg-black/60 hover:bg-black text-white rounded-full transition cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
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
    </div>
  );
};

export default IhlrCreateRequest;
