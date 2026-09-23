import React, { useState } from 'react';
import { 
  Download, 
  X, 
  FileSpreadsheet, 
  FileText, 
  Check 
} from 'lucide-react';

/**
 * Universal Export Selection Modal (Excel .xlsx vs PDF .pdf)
 * Used across Process Audit, IHLR, and Try Out Status for clean format selection.
 */
const ExportSelectionModal = ({
  isOpen,
  onClose,
  title = "Export Report",
  subtitle = "Choose your preferred download format",
  scopeText = "Current View",
  recordCount = null,
  onExportExcel,
  onExportPdf
}) => {
  const [format, setFormat] = useState('excel'); // 'excel' | 'pdf'

  if (!isOpen) return null;

  const handleDownload = () => {
    if (format === 'excel') {
      onExportExcel && onExportExcel();
    } else {
      onExportPdf && onExportPdf();
    }
  };

  return (
    <div 
      className="fixed inset-0 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      style={{ zIndex: 99999 }}
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-slate-200 p-6 space-y-5 animate-in zoom-in-95 duration-200 relative"
        style={{ zIndex: 100000 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-start justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-blue-50 text-blue-600 border border-blue-100">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                {title}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {subtitle}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scope Pill */}
        <div className="flex items-center justify-between px-3.5 py-2.5 bg-slate-50 rounded-xl border border-slate-100 text-xs">
          <span className="text-slate-500 font-medium">Export Scope</span>
          <span className="font-extrabold text-blue-600 font-mono">
            {recordCount !== null ? `${recordCount} Records (${scopeText})` : scopeText}
          </span>
        </div>

        {/* Format Selection Cards */}
        <div className="space-y-3">
          {/* Option 1: Excel (.xlsx) */}
          <div
            onClick={() => setFormat('excel')}
            className={`flex items-start gap-3.5 p-4 rounded-2xl border-2 transition cursor-pointer ${
              format === 'excel'
                ? 'border-emerald-500 bg-emerald-50/40 shadow-xs'
                : 'border-slate-200 hover:border-slate-300 bg-white'
            }`}
          >
            <div className="p-2.5 rounded-xl bg-emerald-100 text-emerald-700 shrink-0">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-slate-900 text-sm">
                  Excel Spreadsheet (.xlsx)
                </span>
                {format === 'excel' ? (
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-600 text-white shadow-xs">
                    <Check className="w-3 h-3 stroke-[3]" />
                  </span>
                ) : (
                  <span className="w-5 h-5 rounded-full border border-slate-300" />
                )}
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Full structured tabular workbook with individual data columns, parameters, and review status.
              </p>
            </div>
          </div>

          {/* Option 2: PDF (.pdf) */}
          <div
            onClick={() => setFormat('pdf')}
            className={`flex items-start gap-3.5 p-4 rounded-2xl border-2 transition cursor-pointer ${
              format === 'pdf'
                ? 'border-rose-500 bg-rose-50/40 shadow-xs'
                : 'border-slate-200 hover:border-slate-300 bg-white'
            }`}
          >
            <div className="p-2.5 rounded-xl bg-rose-100 text-rose-700 shrink-0">
              <FileText className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-slate-900 text-sm">
                  PDF Document (.pdf)
                </span>
                {format === 'pdf' ? (
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-rose-600 text-white shadow-xs">
                    <Check className="w-3 h-3 stroke-[3]" />
                  </span>
                ) : (
                  <span className="w-5 h-5 rounded-full border border-slate-300" />
                )}
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Official document formatted with India Nippon Electricals Limited branding, tables, and page numbers.
              </p>
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-xs font-bold transition shadow-md active:scale-95 cursor-pointer ${
              format === 'excel'
                ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
                : 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20'
            }`}
          >
            <Download className="w-4 h-4" />
            <span>
              Download {format === 'excel' ? 'Excel (.xlsx)' : 'PDF (.pdf)'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExportSelectionModal;
