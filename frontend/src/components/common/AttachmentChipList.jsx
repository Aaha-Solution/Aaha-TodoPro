import React from 'react';
import { FileText, FileSpreadsheet, Paperclip, X, Eye } from 'lucide-react';
import { getFileMeta, parseAttachments } from './attachmentUtils';

/**
 * Universal Attachment Chip List Component
 * Renders attachment chips with icons, format badges, and click-to-preview triggers.
 * Supports onRemove callback for upload forms.
 */
const AttachmentChipList = ({ 
  attachments, 
  onPreview, 
  onRemove, 
  readonly = false 
}) => {
  const list = Array.isArray(attachments) ? attachments : parseAttachments(attachments);

  if (!list || list.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 pt-1">
      {list.map((file, idx) => {
        const meta = getFileMeta(file.type, file.name);
        return (
          <div
            key={idx}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 shadow-2xs transition group text-xs select-none"
          >
            <div 
              onClick={() => onPreview && onPreview(file)}
              className="flex items-center gap-2 cursor-pointer max-w-[220px]"
              title={`Click to preview ${file.name}`}
            >
              <div className={`p-1 rounded-md shrink-0 ${meta.badgeBg}`}>
                {file.isExcel ? (
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                ) : file.isWord || file.isPdf ? (
                  <FileText className="w-3.5 h-3.5" />
                ) : (
                  <Paperclip className="w-3.5 h-3.5" />
                )}
              </div>
              <span className="font-semibold text-slate-800 truncate" title={file.name}>
                {file.name}
              </span>
              <Eye className="w-3 h-3 text-slate-400 group-hover:text-blue-600 transition shrink-0" />
            </div>

            {!readonly && onRemove && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(idx, file);
                }}
                className="p-0.5 rounded-md hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                title="Remove file"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default AttachmentChipList;
