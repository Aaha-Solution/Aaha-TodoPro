import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  Download, 
  X, 
  FileSpreadsheet, 
  FileText, 
  Check,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { useModal } from '../../context/ModalContext';
import { useScrollLock } from '../../hooks/useScrollLock';

const DEFAULT_EXCEL_DESC =
  'Full structured tabular workbook with individual data columns, parameters, and review status.';
const DEFAULT_PDF_DESC =
  'Official document formatted with India Nippon Electricals Limited branding, tables, and page numbers.';

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
  loading = false,
  excelDescription = DEFAULT_EXCEL_DESC,
  pdfDescription = DEFAULT_PDF_DESC,
  onExportExcel,
  onExportPdf
}) => {
  useScrollLock(isOpen);
  const [format, setFormat] = useState('excel'); // 'excel' | 'pdf'
  const [submitting, setSubmitting] = useState(false);
  const { warning: modalWarning } = useModal();

  const [screenWidth, setScreenWidth] = useState(
    typeof window !== 'undefined' ? window.innerWidth : 1200
  );

  useEffect(() => {
    const handleResize = () => setScreenWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isMobile = screenWidth < 768;
  const isTablet = screenWidth >= 768 && screenWidth < 1024;
  const isDesktop = screenWidth >= 1024;

  useEffect(() => {
    if (!isOpen) {
      setSubmitting(false);
    }
  }, [isOpen]);

  const isBusy = Boolean(loading || submitting);

  if (!isOpen) return null;

  const handleClose = () => {
    if (!isBusy && onClose) {
      onClose();
    }
  };

  const handleDownload = async () => {
    if (isBusy) return;
    if (recordCount !== null && recordCount <= 0) {
      if (modalWarning) {
        modalWarning('No data available to export. Cannot download an empty file.', 'No Data Available');
      }
      return;
    }
    try {
      setSubmitting(true);
      if (format === 'excel') {
        await Promise.resolve(onExportExcel && onExportExcel());
      } else {
        await Promise.resolve(onExportPdf && onExportPdf());
      }
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div 
      className="fixed inset-0 !m-0 !mt-0 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200 overscroll-contain"
      style={{
        zIndex: 99999,
        padding: isMobile ? '12px' : '16px',
        boxSizing: 'border-box'
      }}
      onClick={handleClose}
    >
      <div 
        className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200 relative overscroll-contain"
        style={{
          zIndex: 100000,
          borderRadius: isMobile ? '18px' : '24px',
          padding: isMobile ? '16px' : '24px',
          maxWidth: isMobile ? 'calc(100vw - 24px)' : '448px',
          maxHeight: 'calc(100vh - 32px)',
          overflowY: 'auto',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          gap: isMobile ? '14px' : '20px'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          className="flex items-start justify-between pb-3 border-b border-slate-100"
          style={{
            paddingBottom: '12px',
            borderBottom: '1px solid #f1f5f9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div className="flex items-center gap-3" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              className="rounded-2xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center shrink-0"
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <Download className="w-5 h-5" style={{ width: '18px', height: '18px' }} />
            </div>
            <div>
              <h3
                className="font-extrabold text-slate-900 tracking-tight"
                style={{
                  fontSize: isMobile ? '15px' : '16px',
                  fontWeight: 800,
                  margin: 0,
                  color: '#0f172a'
                }}
              >
                {title}
              </h3>
              <p
                className="text-slate-500"
                style={{
                  fontSize: isMobile ? '11px' : '12px',
                  margin: '2px 0 0 0',
                  color: '#64748b'
                }}
              >
                {subtitle}
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={isBusy}
            onClick={handleClose}
            style={{ padding: '6px', borderRadius: '8px' }}
            className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <X className="w-4 h-4" style={{ width: '16px', height: '16px' }} />
          </button>
        </div>

        {/* Scope Pill */}
        <div
          className="flex items-center justify-between bg-slate-50 rounded-xl border border-slate-100"
          style={{
            padding: isMobile ? '8px 12px' : '10px 14px',
            borderRadius: '10px',
            fontSize: '11px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <span className="text-slate-500 font-medium">Export Scope</span>
          <span className={`font-extrabold font-mono ${recordCount === 0 ? 'text-rose-600' : 'text-blue-600'}`}>
            {recordCount !== null ? `${recordCount} Records (${scopeText})` : scopeText}
          </span>
        </div>

        {recordCount !== null && recordCount <= 0 && (
          <div
            className="flex items-start gap-2.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs"
            style={{ padding: '10px 12px', borderRadius: '10px', fontSize: '11px' }}
          >
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" style={{ width: '16px', height: '16px' }} />
            <div>
              <span className="font-bold">No Records Available: </span>
              <span className="text-amber-800">
                There are 0 records matching your current criteria. Please clear or adjust filters before exporting.
              </span>
            </div>
          </div>
        )}

        {/* Format Selection Cards */}
        <div className="space-y-3" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* Option 1: Excel (.xlsx) */}
          <div
            onClick={() => !isBusy && setFormat('excel')}
            style={{
              padding: isMobile ? '12px' : '14px 16px',
              borderRadius: '14px',
              cursor: isBusy ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
              boxSizing: 'border-box'
            }}
            className={`border-2 transition ${
              isBusy ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'
            } ${
              format === 'excel'
                ? 'border-emerald-500 bg-emerald-50/40 shadow-xs'
                : 'border-slate-200 hover:border-slate-300 bg-white'
            }`}
          >
            <div
              className="rounded-xl bg-emerald-100 text-emerald-700 shrink-0 flex items-center justify-center"
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <FileSpreadsheet className="w-5 h-5" style={{ width: '20px', height: '20px' }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1" style={{ marginBottom: '4px' }}>
                <span className="font-bold text-slate-900" style={{ fontSize: isMobile ? '13px' : '14px', fontWeight: 700 }}>
                  Excel Spreadsheet (.xlsx)
                </span>
                {format === 'excel' ? (
                  <span
                    className="inline-flex items-center justify-center rounded-full bg-emerald-600 text-white shadow-xs"
                    style={{ width: '18px', height: '18px', borderRadius: '9999px', flexShrink: 0 }}
                  >
                    <Check className="w-3 h-3 stroke-[3]" style={{ width: '12px', height: '12px' }} />
                  </span>
                ) : (
                  <span className="rounded-full border border-slate-300" style={{ width: '18px', height: '18px', borderRadius: '9999px', flexShrink: 0 }} />
                )}
              </div>
              <p className="text-slate-500 leading-relaxed" style={{ fontSize: '11px', lineHeight: '16px', margin: 0, color: '#64748b' }}>
                {excelDescription || DEFAULT_EXCEL_DESC}
              </p>
            </div>
          </div>

          {/* Option 2: PDF (.pdf) */}
          <div
            onClick={() => !isBusy && setFormat('pdf')}
            style={{
              padding: isMobile ? '12px' : '14px 16px',
              borderRadius: '14px',
              cursor: isBusy ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
              boxSizing: 'border-box'
            }}
            className={`border-2 transition ${
              isBusy ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'
            } ${
              format === 'pdf'
                ? 'border-rose-500 bg-rose-50/40 shadow-xs'
                : 'border-slate-200 hover:border-slate-300 bg-white'
            }`}
          >
            <div
              className="rounded-xl bg-rose-100 text-rose-700 shrink-0 flex items-center justify-center"
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <FileText className="w-5 h-5" style={{ width: '20px', height: '20px' }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1" style={{ marginBottom: '4px' }}>
                <span className="font-bold text-slate-900" style={{ fontSize: isMobile ? '13px' : '14px', fontWeight: 700 }}>
                  PDF Document (.pdf)
                </span>
                {format === 'pdf' ? (
                  <span
                    className="inline-flex items-center justify-center rounded-full bg-rose-600 text-white shadow-xs"
                    style={{ width: '18px', height: '18px', borderRadius: '9999px', flexShrink: 0 }}
                  >
                    <Check className="w-3 h-3 stroke-[3]" style={{ width: '12px', height: '12px' }} />
                  </span>
                ) : (
                  <span className="rounded-full border border-slate-300" style={{ width: '18px', height: '18px', borderRadius: '9999px', flexShrink: 0 }} />
                )}
              </div>
              <p className="text-slate-500 leading-relaxed" style={{ fontSize: '11px', lineHeight: '16px', margin: 0, color: '#64748b' }}>
                {pdfDescription || DEFAULT_PDF_DESC}
              </p>
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div
          className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100"
          style={{
            display: 'flex',
            flexDirection: isMobile ? 'column-reverse' : 'row',
            alignItems: 'center',
            justifyContent: isMobile ? 'stretch' : 'flex-end',
            gap: '10px',
            paddingTop: '12px',
            borderTop: '1px solid #f1f5f9',
            width: '100%',
            boxSizing: 'border-box'
          }}
        >
          <button
            type="button"
            disabled={isBusy}
            onClick={handleClose}
            style={{
              height: '42px',
              padding: '0 16px',
              borderRadius: '10px',
              fontSize: '12px',
              fontWeight: 700,
              width: isMobile ? '100%' : 'auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxSizing: 'border-box'
            }}
            className="border border-slate-200 text-slate-600 hover:bg-slate-50 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isBusy}
            onClick={handleDownload}
            style={{
              height: '42px',
              padding: '0 20px',
              borderRadius: '10px',
              fontSize: '12px',
              fontWeight: 700,
              width: isMobile ? '100%' : 'auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxSizing: 'border-box'
            }}
            className={`text-white transition shadow-md active:scale-95 cursor-pointer disabled:opacity-75 disabled:cursor-wait ${
              format === 'excel'
                ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
                : 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20'
            }`}
          >
            {isBusy ? <Loader2 className="w-4 h-4 animate-spin" style={{ width: '16px', height: '16px' }} /> : <Download className="w-4 h-4" style={{ width: '16px', height: '16px' }} />}
            <span>
              {isBusy
                ? `Generating ${format === 'excel' ? 'Excel (.xlsx)' : 'PDF (.pdf)'}...`
                : `Download ${format === 'excel' ? 'Excel (.xlsx)' : 'PDF (.pdf)'}`}
            </span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ExportSelectionModal;
