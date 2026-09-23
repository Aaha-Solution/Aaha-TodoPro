import React from 'react';
import { FileText, FileSpreadsheet, Paperclip, Image as ImageIcon } from 'lucide-react';
import { parseAttachments, getFileMeta } from './attachmentUtils';

/**
 * Universal Table Attachment Thumbnail Badge
 * Used in table rows across Process Audit, IHLR, and Try Out Status.
 */
const AttachmentThumbnail = ({ rawAttachment, onClick }) => {
  const attachments = parseAttachments(rawAttachment);
  if (!attachments || attachments.length === 0) {
    return <span className="text-slate-300 font-mono text-xs select-none">—</span>;
  }

  const first = attachments[0];
  const count = attachments.length;
  const meta = getFileMeta(first.type, first.name);

  return (
    <div
      onClick={onClick || undefined}
      className={`inline-flex items-center gap-1.5 p-1 rounded-xl transition select-none group relative ${
        onClick ? 'hover:bg-slate-100 cursor-pointer' : 'cursor-default pointer-events-none'
      }`}
      title={
        onClick
          ? `${count} attached file${count > 1 ? 's' : ''}: ${attachments.map((a) => a.name).join(', ')} (Click to inspect)`
          : `${count} attached file${count > 1 ? 's' : ''}: ${attachments.map((a) => a.name).join(', ')}`
      }
    >
      <div className="relative">
        {first.isImage && first.url ? (
          <div className="w-8 h-8 rounded-lg overflow-hidden border border-slate-200 bg-slate-100 flex items-center justify-center shrink-0">
            <img
              src={first.url}
              alt={first.name}
              className={`w-full h-full object-cover transition ${onClick ? 'group-hover:scale-105' : ''}`}
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
        ) : (
          <div className={`w-8 h-8 rounded-lg border flex flex-col items-center justify-center shrink-0 shadow-2xs ${meta.badgeBg}`}>
            {first.isExcel ? (
              <FileSpreadsheet className="w-4 h-4" />
            ) : first.isWord || first.isPdf ? (
              <FileText className="w-4 h-4" />
            ) : (
              <Paperclip className="w-4 h-4" />
            )}
            <span className="text-[7px] font-black uppercase tracking-tight leading-none mt-0.5">
              {meta.typeLabel.slice(0, 4)}
            </span>
          </div>
        )}

        {/* Multi-item pill indicator */}
        {count > 1 && (
          <span className="absolute -top-1.5 -right-1.5 px-1 py-0.2 rounded-full text-[9px] font-black font-mono bg-blue-600 text-white shadow-xs">
            +{count - 1}
          </span>
        )}
      </div>
    </div>
  );
};

export default AttachmentThumbnail;
