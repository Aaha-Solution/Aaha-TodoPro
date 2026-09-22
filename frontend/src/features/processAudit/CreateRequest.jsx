import React, { useState } from 'react';
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
  X
} from 'lucide-react';

const CreateRequest = () => {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    requestId: 'REQ-1006',
    date: '2026-09-17',
    shift: 'Morning (06:00 - 14:30)',
    priority: 'High',
    quantity: '1,500',
    unit: 'Units',
    stage: 'Assembly',
    line: 'Line A - Main Chassis Assembly',
    executor: 'Mr. Kumar (Assembly Lead)',
    comments: 'Target completion by end of shift. Calibrate digital micrometer prior to starting assembly batch #1006.',
  });

  const [attachments, setAttachments] = useState([
    {
      name: 'Technical_Spec_Sheet_RevB.pdf',
      size: '1.4 MB',
      date: 'Uploaded Today',
      type: 'PDF'
    }
  ]);

  const removeAttachment = (index) => {
    setAttachments(attachments.filter((_, i) => i !== index));
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setAttachments([
        ...attachments,
        {
          name: file.name,
          size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
          date: 'Just now',
          type: file.name.split('.').pop()?.toUpperCase() || 'FILE',
        },
      ]);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    alert('Production Request REQ-1006 created successfully!');
    navigate('/process-audit/my-requests');
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
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
                  Request ID (Auto-Generated)
                </label>
                <input
                  type="text"
                  disabled
                  value={formData.requestId}
                  className="w-full px-3.5 py-2.5 bg-slate-100/80 border border-slate-200 rounded-xl text-xs font-semibold text-slate-500 cursor-not-allowed"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">Unique sequential tracking ID</span>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Date *
                </label>
                <div className="relative">
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
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
                  <option>Morning (06:00 - 14:30)</option>
                  <option>Evening (14:30 - 22:30)</option>
                  <option>Night (22:30 - 06:00)</option>
                  <option>General (08:30 - 17:00)</option>
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
                  <option>High</option>
                  <option>Medium</option>
                  <option>Low</option>
                  <option>Critical (Hot Lot)</option>
                </select>
              </div>
            </div>

            {/* Row 2 */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Production Quantity *
                </label>
                <input
                  type="text"
                  required
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Production Unit *
                </label>
                <select
                  value={formData.unit}
                  onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
                >
                  <option>Units</option>
                  <option>Kg</option>
                  <option>Batches</option>
                  <option>Sets</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Stage *
                </label>
                <select
                  value={formData.stage}
                  onChange={(e) => setFormData({ ...formData, stage: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
                >
                  <option>Assembly</option>
                  <option>Inspection</option>
                  <option>Packaging</option>
                  <option>Raw Material</option>
                  <option>Production</option>
                </select>
              </div>
            </div>

            {/* Row 3 */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Production Line *
              </label>
              <select
                value={formData.line}
                onChange={(e) => setFormData({ ...formData, line: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
              >
                <option>Line A - Main Chassis Assembly</option>
                <option>Line B - CNC Milling</option>
                <option>Line C - Optical Inspection</option>
                <option>Line D - High Speed Pack</option>
                <option>Raw Material Intake Silo 3</option>
              </select>
            </div>
          </div>
        </div>

        {/* Section 2: Assign Executor */}
        <div className="bg-white rounded-2xl p-6 sm:p-7 border border-slate-200/90 shadow-2xs">
          <div className="flex items-start gap-3 pb-5 mb-5 border-b border-slate-100">
            <UserCheck className="w-5 h-5 text-slate-700 mt-0.5" />
            <div>
              <h2 className="text-sm font-bold text-slate-900">2. Assign Executor</h2>
              <p className="text-xs text-slate-500">
                Designate the technician or supervisor accountable for running this batch.
              </p>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Select Executor *
            </label>
            <select
              value={formData.executor}
              onChange={(e) => setFormData({ ...formData, executor: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
            >
              <option>Mr. Kumar (Assembly Lead)</option>
              <option>Mr. Ravi (Inspection Head)</option>
              <option>Mr. Arjun (Packaging Supervisor)</option>
              <option>Mr. Suresh (Floor Engineer)</option>
            </select>
            <span className="text-[11px] text-slate-400 mt-1.5 block">
              An automated dispatch and in-app alert will notify the executor upon submission.
            </span>
          </div>
        </div>

        {/* Section 3: Attachments & Technical Drawings */}
        <div className="bg-white rounded-2xl p-6 sm:p-7 border border-slate-200/90 shadow-2xs">
          <div className="flex items-start gap-3 pb-5 mb-5 border-b border-slate-100">
            <Paperclip className="w-5 h-5 text-slate-700 mt-0.5" />
            <div>
              <h2 className="text-sm font-bold text-slate-900">3. Attachments & Technical Drawings</h2>
              <p className="text-xs text-slate-500">
                Upload spec sheets, CAD revisions, BOM documents, or torque tolerance blueprints.
              </p>
            </div>
          </div>

          {/* Drag & Drop Upload Zone */}
          <label className="border-2 border-dashed border-slate-200 hover:border-blue-400 rounded-2xl p-6 text-center flex flex-col items-center justify-center cursor-pointer bg-slate-50/50 hover:bg-slate-50 transition-colors">
            <input type="file" onChange={handleFileUpload} className="hidden" />
            <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mb-2">
              <UploadCloud className="w-5 h-5" />
            </div>
            <p className="text-xs font-semibold text-slate-800">
              Drag & drop files here or <span className="text-blue-600 underline">browse</span>
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Supports PDF, PNG, JPG, DOCX (Max 25MB per file)
            </p>
          </label>

          {/* Attached Files List */}
          {attachments.length > 0 && (
            <div className="mt-4 space-y-2">
              {attachments.map((file, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl shadow-2xs"
                >
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-1 bg-red-50 text-red-600 text-[10px] font-bold rounded-md border border-red-200">
                      {file.type}
                    </span>
                    <div>
                      <p className="text-xs font-semibold text-slate-800">{file.name}</p>
                      <p className="text-[10px] text-slate-400">
                        {file.size} • {file.date}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => removeAttachment(idx)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Section 4: Production Notes & Comments */}
        <div className="bg-white rounded-2xl p-6 sm:p-7 border border-slate-200/90 shadow-2xs">
          <div className="flex items-start gap-3 pb-5 mb-5 border-b border-slate-100">
            <MessageSquare className="w-5 h-5 text-slate-700 mt-0.5" />
            <div>
              <h2 className="text-sm font-bold text-slate-900">4. Production Notes & Comments</h2>
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
            type="button"
            onClick={() => alert('Draft saved successfully!')}
            className="px-5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold border border-slate-200 transition shadow-2xs cursor-pointer"
          >
            Save Draft
          </button>

          <button
            type="submit"
            className="px-6 py-2.5 bg-[#2563eb] hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/20 flex items-center gap-2 transition cursor-pointer"
          >
            <Send className="w-4 h-4" />
            <span>Submit Request</span>
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateRequest;
