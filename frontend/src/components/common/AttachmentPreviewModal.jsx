import React, { useState } from 'react';
import { 
  X, 
  Download, 
  ExternalLink, 
  FileText, 
  FileSpreadsheet, 
  File, 
  ZoomIn, 
  ZoomOut, 
  Maximize2,
  Paperclip,
  Check
} from 'lucide-react';
import { getFileMeta } from './attachmentUtils';
import ExcelViewer from './ExcelViewer';

/**
 * Universal In-Page Attachment Preview Modal
 * Supports PDF, Excel (.xlsx, .xls, .csv), Word (.doc, .docx), and Images (.png, .jpg, etc.)
 * Works across Process Audit, IHLR, and Try Out Status.
 */
const AttachmentPreviewModal = ({ isOpen, attachment, onClose }) => {
  const [zoom, setZoom] = useState(1);
  const [imageError, setImageError] = useState(false);

  React.useEffect(() => {
    setImageError(false);
    setZoom(1);
  }, [attachment?.url, attachment?.name]);

  if (!isOpen || !attachment) return null;

  const ext = (attachment.type || attachment.name?.split('.').pop() || '').toUpperCase();
  const meta = getFileMeta(attachment.type || ext, attachment.name);
  const isImage = attachment.isImage !== undefined
    ? attachment.isImage
    : ['PNG', 'JPG', 'JPEG', 'WEBP', 'GIF', 'SVG'].includes(ext) || Boolean(attachment.url?.startsWith('data:image'));
  const isPdf = attachment.isPdf !== undefined
    ? attachment.isPdf
    : ext === 'PDF' || Boolean(attachment.url?.toLowerCase().includes('.pdf'));
  const isExcel = attachment.isExcel !== undefined
    ? attachment.isExcel
    : ['XLS', 'XLSX', 'CSV', 'XLSM'].includes(ext) || Boolean(attachment.url?.toLowerCase().includes('.xls'));
  const isWord = attachment.isWord !== undefined
    ? attachment.isWord
    : ['DOC', 'DOCX'].includes(ext) || Boolean(attachment.url?.toLowerCase().includes('.doc'));

  return (
    <div 
      className="fixed inset-0 flex items-center justify-center p-2 sm:p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200"
      style={{ zIndex: 99999 }}
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-3xl w-full max-w-5xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200 relative"
        style={{ zIndex: 100000 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`p-2.5 rounded-2xl border shrink-0 ${meta.badgeBg}`}>
              {isExcel ? (
                <FileSpreadsheet className="w-5 h-5" />
              ) : isWord || isPdf ? (
                <FileText className="w-5 h-5" />
              ) : (
                <Paperclip className="w-5 h-5" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm sm:text-base font-bold text-slate-900 truncate max-w-md" title={attachment.name}>
                  {attachment.name}
                </h3>
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider ${meta.badgeBg}`}>
                  {meta.typeLabel}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Technical Evidence &bull; In-Page Document Preview
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Image zoom controls */}
            {isImage && (
              <div className="hidden sm:flex items-center gap-1 bg-slate-100 p-1 rounded-xl mr-2">
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.max(z - 0.25, 0.5))}
                  className="p-1 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-white transition cursor-pointer"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="text-[11px] font-mono px-1 font-semibold text-slate-600">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.min(z + 0.25, 3))}
                  className="p-1 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-white transition cursor-pointer"
                  title="Zoom In"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
              </div>
            )}

            {attachment.url && (
              <a
                href={attachment.url}
                download={attachment.name}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                title="Download original file"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Download</span>
              </a>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition cursor-pointer"
              title="Close Preview"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-3 sm:p-5 flex-1 overflow-auto bg-slate-50/60 flex items-center justify-center">
          {/* 1. Interactive Excel / Spreadsheet Viewer */}
          {isExcel ? (
            <div className="w-full">
              <ExcelViewer url={attachment.url} filename={attachment.name} />
            </div>
          ) : /* 2. Embedded PDF Document Viewer */
          isPdf ? (
            <div className="w-full h-[68vh] rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-xs">
              <object
                data={attachment.url}
                type="application/pdf"
                className="w-full h-full"
              >
                <iframe
                  src={attachment.url}
                  title={attachment.name}
                  className="w-full h-full border-none"
                >
                  <div className="p-6 text-center">
                    <p className="text-sm font-semibold text-slate-700">PDF preview not supported by your browser.</p>
                    <a
                      href={attachment.url}
                      download={attachment.name}
                      className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold"
                    >
                      <Download className="w-4 h-4" />
                      Download PDF
                    </a>
                  </div>
                </iframe>
              </object>
            </div>
          ) : /* 3. High-Res Image Canvas */
          isImage ? (
            !imageError ? (
              <div className="w-full h-full flex items-center justify-center overflow-auto p-2">
                <img
                  src={attachment.url}
                  alt={attachment.name}
                  onError={() => setImageError(true)}
                  style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
                  className="max-h-[68vh] max-w-full object-contain rounded-xl shadow-md transition-transform duration-150"
                />
              </div>
            ) : (
              <div className="w-full max-w-md bg-white rounded-3xl p-8 border border-slate-200 shadow-xl text-center space-y-4 my-auto">
                <div className="w-16 h-16 rounded-3xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center mx-auto shadow-xs">
                  <Paperclip className="w-8 h-8" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-slate-900 truncate" title={attachment.name}>
                    {attachment.name}
                  </h4>
                  <p className="text-xs text-slate-500 mt-1">
                    Image file could not be rendered directly in current viewport.
                  </p>
                </div>
                {attachment.url && (
                  <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                    <a
                      href={attachment.url}
                      download={attachment.name}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm transition"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download Image</span>
                    </a>
                    <a
                      href={attachment.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl shadow-sm transition"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>Open in New Tab</span>
                    </a>
                  </div>
                )}
              </div>
            )
          ) : /* 4. Word Document Card */
          isWord ? (
            <div className="w-full max-w-lg bg-white rounded-3xl p-8 border border-slate-200 shadow-xl text-center space-y-4 my-auto">
              <div className="w-16 h-16 rounded-3xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center mx-auto shadow-xs">
                <FileText className="w-8 h-8" />
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-900 truncate" title={attachment.name}>
                  {attachment.name}
                </h4>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto leading-relaxed">
                  Microsoft Word documents can be viewed with Microsoft Office, Word Viewer, or downloaded directly for full formatting and editing.
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3 pt-3">
                <a
                  href={attachment.url}
                  download={attachment.name}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-600/20 transition cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Word Document</span>
                </a>
              </div>
            </div>
          ) : /* 5. Fallback File Card */
          (
            <div className="w-full max-w-md bg-white rounded-3xl p-8 border border-slate-200 shadow-xl text-center space-y-4 my-auto">
              <div className="w-16 h-16 rounded-3xl bg-slate-50 text-slate-600 border border-slate-100 flex items-center justify-center mx-auto shadow-xs">
                <File className="w-8 h-8" />
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-900 truncate" title={attachment.name}>
                  {attachment.name}
                </h4>
                <p className="text-xs text-slate-500 mt-1">
                  Format: <span className="font-mono font-bold text-slate-700">{meta.typeLabel}</span>
                </p>
              </div>

              <div className="flex items-center justify-center pt-3">
                <a
                  href={attachment.url}
                  download={attachment.name}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl shadow-sm transition cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Download File</span>
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AttachmentPreviewModal;
