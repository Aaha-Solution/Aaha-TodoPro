import React, { useRef, useState } from 'react';
import { UploadCloud, FileText, FileSpreadsheet, Paperclip } from 'lucide-react';
import AttachmentChipList from './AttachmentChipList';

/**
 * Universal Multi-Format Attachment Upload Area
 * Accepts PDF (.pdf), Excel (.xlsx, .xls, .csv), Word (.doc, .docx), and Images (.png, .jpg, .webp).
 * Used in Create/Edit forms across Process Audit, IHLR, and Try Out Status.
 */
const AttachmentUploadArea = ({ 
  files = [], 
  onChange, 
  onPreview,
  maxFiles = 20,
  label = "Upload Technical Evidence / Documents",
  subLabel = "Attach relevant inspection reports, photos, CAD drawings, CMM data, or investigation documents."
}) => {
  const fileInputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFiles = (incomingFileList) => {
    if (!incomingFileList || incomingFileList.length === 0) return;
    const newFiles = Array.from(incomingFileList);
    const combined = [...files, ...newFiles].slice(0, maxFiles);
    onChange && onChange(combined);
  };

  const handleRemove = (index) => {
    const updated = files.filter((_, i) => i !== index);
    onChange && onChange(updated);
  };

  return (
    <div className="space-y-3">
      {label && (
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
            {label}
          </label>
          {subLabel && (
            <p className="text-xs text-slate-500 mb-2">{subLabel}</p>
          )}
        </div>
      )}

      {/* Drag & Drop Area */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          if (e.dataTransfer.files) {
            handleFiles(e.dataTransfer.files);
          }
        }}
        onClick={() => fileInputRef.current && fileInputRef.current.click()}
        className={`border-2 border-dashed rounded-2xl p-6 sm:p-7 text-center transition cursor-pointer flex flex-col items-center justify-center space-y-2.5 ${
          isDragging
            ? 'border-blue-500 bg-blue-50/70'
            : 'border-slate-300 hover:border-blue-400 bg-slate-50/60 hover:bg-slate-50'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx,.csv"
          onChange={(e) => {
            if (e.target.files) {
              handleFiles(e.target.files);
            }
          }}
          className="hidden"
        />

        <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-2xs">
          <UploadCloud className="w-6 h-6" />
        </div>

        <div>
          <p className="text-xs sm:text-sm font-bold text-slate-800">
            Click to upload or drag &amp; drop files here
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Supports multiple files: PDF, Excel (.xlsx, .csv), Word (.docx), and Images (PNG, JPG)
          </p>
        </div>

        {/* Accepted Formats Badges */}
        <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
          <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-purple-50 text-purple-700 border border-purple-200">
            JPG / PNG
          </span>
          <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-rose-50 text-rose-700 border border-rose-200">
            PDF
          </span>
          <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
            EXCEL (.xlsx)
          </span>
          <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200">
            WORD (.docx)
          </span>
        </div>
      </div>

      {/* Selected Files Chip List */}
      {files && files.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Attached Evidence ({files.length} of {maxFiles})</span>
            <button
              type="button"
              onClick={() => onChange && onChange([])}
              className="text-[11px] text-rose-600 hover:underline font-semibold cursor-pointer"
            >
              Clear All
            </button>
          </div>
          <AttachmentChipList
            attachments={files.map((f) => {
              if (f instanceof File) {
                const ext = f.name.split('.').pop()?.toUpperCase() || 'FILE';
                const isImage = ['PNG', 'JPG', 'JPEG', 'WEBP', 'GIF', 'SVG'].includes(ext);
                const isPdf = ext === 'PDF';
                const isExcel = ['XLS', 'XLSX', 'CSV', 'XLSM'].includes(ext);
                const isWord = ['DOC', 'DOCX'].includes(ext);
                return {
                  name: f.name,
                  url: URL.createObjectURL(f),
                  type: ext,
                  isImage,
                  isPdf,
                  isExcel,
                  isWord
                };
              }
              return f;
            })}
            onPreview={onPreview}
            onRemove={handleRemove}
          />
        </div>
      )}
    </div>
  );
};

export default AttachmentUploadArea;
