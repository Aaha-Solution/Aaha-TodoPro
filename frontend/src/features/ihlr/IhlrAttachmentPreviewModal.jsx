import React from 'react';
import { Paperclip, X, Eye, Download, ExternalLink, FileSpreadsheet, FileText, File } from 'lucide-react';
import { getFileMeta, resolveAttachmentUrl } from './IhlrAttachmentView';
import IhlrExcelViewer from './IhlrExcelViewer';

/**
 * Dedicated Attachment Preview Modal matching user specification:
 * - Header: [📎] filename.pdf  [✕]
 * - Body: full embedded document / PDF / image viewer
 * - Bottom link: 👁 Open PDF in new window
 * - Footer: [ Close Preview ] blue button
 */
const IhlrAttachmentPreviewModal = ({ isOpen, attachment, onClose }) => {
  if (!isOpen || !attachment) return null;

  const meta = getFileMeta(attachment);
  const name = attachment.name || 'Attachment';
  const resolvedUrl = resolveAttachmentUrl(attachment.url || '');
  const isPdf = meta.isPdf;
  const isImage = meta.isImage;
  const isExcel = meta.isExcel;
  const isWord = meta.isWord;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div
        className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
              <Paperclip className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-slate-800 truncate" title={name}>
                {name}
              </h3>
              {attachment.size && (
                <p className="text-[11px] text-slate-400 font-medium">
                  {meta.typeName} • {attachment.size}
                </p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition cursor-pointer shrink-0"
            title="Close Preview"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body / Embedded Preview */}
        <div className="p-4 sm:p-6 flex-1 overflow-y-auto bg-slate-50/50 flex flex-col justify-center">
          {isPdf && resolvedUrl && (
            <div className="w-full h-[60vh] sm:h-[65vh] rounded-xl overflow-hidden border border-slate-200 bg-white shadow-xs">
              <object
                data={`${resolvedUrl}#toolbar=1`}
                type="application/pdf"
                className="w-full h-full"
              >
                <iframe
                  src={`${resolvedUrl}#toolbar=1`}
                  title={name}
                  className="w-full h-full border-0"
                >
                  <p className="p-4 text-xs text-slate-500">
                    Your browser does not support inline PDF viewing.{' '}
                    <a href={resolvedUrl} target="_blank" rel="noreferrer" className="text-blue-600 underline font-bold">
                      Click here to open PDF
                    </a>.
                  </p>
                </iframe>
              </object>
            </div>
          )}

          {isImage && resolvedUrl && (
            <div className="w-full h-[60vh] sm:h-[65vh] rounded-xl overflow-hidden border border-slate-200 bg-slate-900/5 flex items-center justify-center p-3">
              <img
                src={resolvedUrl}
                alt={name}
                className="max-h-full max-w-full object-contain rounded-lg shadow-sm"
              />
            </div>
          )}

          {/* Excel / Spreadsheet Interactive Viewer */}
          {isExcel && resolvedUrl && (
            <IhlrExcelViewer url={resolvedUrl} filename={name} />
          )}

          {/* Fallback for Word Documents & Other Files */}
          {!isPdf && !isImage && !isExcel && (
            <div className="w-full h-[50vh] rounded-xl border border-slate-200 bg-white p-6 sm:p-8 flex flex-col items-center justify-center text-center space-y-4 shadow-xs">
              <div className={`w-16 h-16 rounded-2xl border flex items-center justify-center shadow-xs ${meta.badgeBg}`}>
                {isWord ? (
                  <FileText className="w-8 h-8" />
                ) : (
                  <File className="w-8 h-8" />
                )}
              </div>
              <div className="max-w-md">
                <h4 className="text-sm font-bold text-slate-800 truncate" title={name}>
                  {name}
                </h4>
                <p className="text-xs text-slate-500 mt-1">
                  {meta.typeName} • Ready to view or download
                </p>
              </div>
              <div className="flex items-center gap-2 pt-2">
                {resolvedUrl && (
                  <a
                    href={resolvedUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-xl border border-blue-200 transition"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Open in Browser</span>
                  </a>
                )}
                {resolvedUrl && (
                  <a
                    href={resolvedUrl}
                    download={name}
                    className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs transition"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download File</span>
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Open in new window sub-link (matching Screenshot 2) */}
          {resolvedUrl && (
            <div className="flex justify-end pt-3">
              <a
                href={resolvedUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline transition"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Open {isPdf ? 'PDF' : isImage ? 'Image' : 'File'} in new window</span>
              </a>
            </div>
          )}
        </div>

        {/* Modal Footer (matching Screenshot 2) */}
        <div className="p-4 border-t border-slate-100 bg-white flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-xs rounded-xl shadow-xs transition cursor-pointer"
          >
            Close Preview
          </button>
        </div>
      </div>
    </div>
  );
};

export default IhlrAttachmentPreviewModal;
