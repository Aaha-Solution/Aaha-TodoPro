import React from 'react';
import { 
  FileText, 
  FileSpreadsheet, 
  File, 
  Download, 
  Eye, 
  ExternalLink, 
  Image as ImageIcon,
  Paperclip,
  X
} from 'lucide-react';

export const resolveAttachmentUrl = (rawUrl) => {
  if (!rawUrl) return '';
  const trimmed = String(rawUrl).trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
    return trimmed;
  }
  const clean = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  if (clean.startsWith('/api')) {
    return `http://localhost:5000${clean}`;
  }
  if (clean.startsWith('/uploads')) {
    return `http://localhost:5000/api/ihlr${clean}`;
  }
  return `http://localhost:5000/api/ihlr/${clean.replace(/^\//, '')}`;
};

export const normalizeAttachment = (item) => {
  if (!item) return null;
  if (typeof item === 'string') {
    const trimmed = item.trim();
    if (!trimmed) return null;
    const cleanUrl = trimmed.split('?')[0];
    const filename = cleanUrl.split('/').pop() || (trimmed.startsWith('data:image') ? 'defect-image.png' : 'attachment');
    const ext = filename.split('.').pop()?.toUpperCase() || (trimmed.startsWith('data:image') ? 'PNG' : 'FILE');
    const isImage = ['PNG', 'JPG', 'JPEG', 'WEBP', 'GIF', 'SVG'].includes(ext) || trimmed.startsWith('data:image');
    const isPdf = ext === 'PDF' || cleanUrl.toLowerCase().endsWith('.pdf');
    const isExcel = ['XLS', 'XLSX', 'CSV', 'XLSM'].includes(ext) || cleanUrl.toLowerCase().endsWith('.xlsx') || cleanUrl.toLowerCase().endsWith('.csv') || cleanUrl.toLowerCase().endsWith('.xls');
    const isWord = ['DOC', 'DOCX'].includes(ext) || cleanUrl.toLowerCase().endsWith('.docx') || cleanUrl.toLowerCase().endsWith('.doc');

    return {
      name: filename,
      url: resolveAttachmentUrl(trimmed),
      size: '',
      type: ext,
      isImage,
      isPdf,
      isExcel,
      isWord
    };
  }

  if (typeof item === 'object') {
    const name = item.name || item.filename || (item.url ? item.url.split('/').pop() : 'attachment');
    const ext = (item.type || name.split('.').pop() || 'FILE').toUpperCase();
    const rawUrl = item.url || '';
    const resolvedUrl = resolveAttachmentUrl(rawUrl);
    const isImage = item.isImage !== undefined ? item.isImage : (['PNG', 'JPG', 'JPEG', 'WEBP', 'GIF', 'SVG'].includes(ext) || rawUrl.startsWith('data:image'));
    const isPdf = item.isPdf !== undefined ? item.isPdf : (ext === 'PDF' || rawUrl.toLowerCase().endsWith('.pdf'));
    const isExcel = item.isExcel !== undefined ? item.isExcel : (['XLS', 'XLSX', 'CSV', 'XLSM'].includes(ext) || rawUrl.toLowerCase().endsWith('.xlsx') || rawUrl.toLowerCase().endsWith('.csv') || rawUrl.toLowerCase().endsWith('.xls'));
    const isWord = item.isWord !== undefined ? item.isWord : (['DOC', 'DOCX'].includes(ext) || rawUrl.toLowerCase().endsWith('.docx') || rawUrl.toLowerCase().endsWith('.doc'));

    return {
      name,
      url: resolvedUrl,
      size: item.size || '',
      type: ext,
      isImage,
      isPdf,
      isExcel,
      isWord
    };
  }

  return null;
};

export const parseAttachments = (raw) => {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.map(normalizeAttachment).filter(Boolean);
  }
  if (typeof raw === 'object') {
    if (raw.url || raw.name) return [normalizeAttachment(raw)].filter(Boolean);
    return [];
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map(normalizeAttachment).filter(Boolean);
      }
      if (parsed && typeof parsed === 'object') {
        return [normalizeAttachment(parsed)].filter(Boolean);
      }
    } catch {
      // Not JSON
    }
    return [normalizeAttachment(trimmed)].filter(Boolean);
  }
  return [];
};

export const parseAttachment = (raw) => {
  const list = parseAttachments(raw);
  return list.length > 0 ? list[0] : null;
};

export const getFileMeta = (file) => {
  if (!file) {
    return {
      badgeBg: 'bg-slate-50 text-slate-700 border-slate-200',
      badgeLabel: 'FILE',
      typeName: 'Document',
      icon: File,
      isImage: false,
      isPdf: false,
      isExcel: false,
      isWord: false
    };
  }

  const name = file.name || file.filename || '';
  const ext = (file.type || name.split('.').pop() || '').toUpperCase();
  const url = file.url || '';

  if (file.isImage || ['PNG', 'JPG', 'JPEG', 'GIF', 'WEBP', 'SVG'].includes(ext) || url.startsWith('data:image')) {
    return {
      badgeBg: 'bg-blue-50 text-blue-700 border-blue-200',
      badgeLabel: 'IMAGE',
      typeName: 'Image File',
      icon: ImageIcon,
      isImage: true,
      isPdf: false,
      isExcel: false,
      isWord: false
    };
  }
  if (file.isPdf || ext === 'PDF' || url.toLowerCase().includes('.pdf')) {
    return {
      badgeBg: 'bg-rose-50 text-rose-700 border-rose-200',
      badgeLabel: 'PDF',
      typeName: 'PDF Document',
      icon: FileText,
      isImage: false,
      isPdf: true,
      isExcel: false,
      isWord: false
    };
  }
  if (file.isExcel || ['XLS', 'XLSX', 'CSV', 'XLSM'].includes(ext) || url.toLowerCase().includes('.xlsx') || url.toLowerCase().includes('.csv') || url.toLowerCase().includes('.xls')) {
    return {
      badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      badgeLabel: 'EXCEL',
      typeName: 'Excel Spreadsheet',
      icon: FileSpreadsheet,
      isImage: false,
      isPdf: false,
      isExcel: true,
      isWord: false
    };
  }
  if (file.isWord || ['DOC', 'DOCX'].includes(ext) || url.toLowerCase().includes('.docx') || url.toLowerCase().includes('.doc')) {
    return {
      badgeBg: 'bg-sky-50 text-sky-700 border-sky-200',
      badgeLabel: 'WORD',
      typeName: 'Word Document',
      icon: FileText,
      isImage: false,
      isPdf: false,
      isExcel: false,
      isWord: true
    };
  }

  return {
    badgeBg: 'bg-slate-50 text-slate-700 border-slate-200',
    badgeLabel: ext || 'FILE',
    typeName: 'Document',
    icon: File,
    isImage: false,
    isPdf: false,
    isExcel: false,
    isWord: false
  };
};

/**
 * Compact thumbnail for table rows (handles single or multiple attachments)
 */
export const IhlrAttachmentThumbnail = ({ rawAttachment, onClick }) => {
  const attachments = parseAttachments(rawAttachment);
  if (attachments.length === 0) {
    return (
      <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200/60 flex items-center justify-center text-slate-300">
        <File className="w-4 h-4" />
      </div>
    );
  }

  const primary = attachments[0];
  const meta = getFileMeta(primary);
  const IconComponent = meta.icon;
  const count = attachments.length;

  return (
    <div
      onClick={onClick}
      className="relative cursor-pointer hover:opacity-90 transition group shrink-0"
      title={`${count} attachment${count > 1 ? 's' : ''}: ${attachments.map((a) => a.name).join(', ')}`}
    >
      {meta.isImage ? (
        <div className="w-9 h-9 rounded-xl overflow-hidden border border-slate-200 bg-slate-50 shadow-2xs">
          <img src={primary.url} alt="Attachment" className="w-full h-full object-cover" />
        </div>
      ) : (
        <div className={`w-9 h-9 rounded-xl border flex flex-col items-center justify-center shadow-2xs ${meta.badgeBg}`}>
          <IconComponent className="w-4 h-4 mb-0.5" />
          <span className="text-[8px] font-black uppercase tracking-tighter leading-none">{meta.badgeLabel}</span>
        </div>
      )}

      {count > 1 && (
        <span className="absolute -top-1.5 -right-1.5 bg-blue-600 text-white font-bold text-[9px] px-1.5 py-0.5 rounded-full shadow-xs border border-white">
          +{count - 1}
        </span>
      )}
    </div>
  );
};

/**
 * Pill-style Attachment Chips matching the user's requested layout:
 * [ 📎 Filename.ext  ✕ ]
 */
export const IhlrAttachmentChips = ({ attachments = [], onRemove, onPreview, readOnly = false }) => {
  if (!attachments || attachments.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 pt-1">
      {attachments.map((att, idx) => {
        const meta = getFileMeta(att);
        return (
          <div
            key={`${att.name || att.url}-${idx}`}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#f1f5f9] hover:bg-slate-200/80 border border-slate-200/90 text-xs font-medium text-slate-700 shadow-2xs transition group"
          >
            <Paperclip className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 shrink-0" />
            <span
              className="truncate max-w-[170px] sm:max-w-[220px] cursor-pointer hover:text-blue-600 select-none"
              title={`${att.name} ${att.size ? `(${att.size})` : ''} - Click to preview`}
              onClick={() => onPreview ? onPreview(att) : null}
            >
              {att.name || 'Attachment'}
            </span>
            {!readOnly && onRemove && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(idx);
                }}
                className="p-0.5 text-slate-400 hover:text-red-500 rounded-full hover:bg-slate-300/50 transition cursor-pointer ml-0.5"
                title={`Remove ${att.name || 'file'}`}
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
};

/**
 * Full card preview for detail modals and inspection drawers (supports single or multiple attachments)
 */
export const IhlrAttachmentPreviewCard = ({ rawAttachment }) => {
  const attachments = parseAttachments(rawAttachment);
  if (attachments.length === 0) return null;

  return (
    <div className="space-y-3">
      {attachments.length > 1 && (
        <div className="flex items-center justify-between text-xs text-slate-500 font-semibold px-0.5">
          <span>{attachments.length} Attachments</span>
          <IhlrAttachmentChips attachments={attachments} readOnly />
        </div>
      )}

      {attachments.map((att, idx) => {
        const meta = getFileMeta(att);
        const IconComponent = meta.icon;
        const isImage = meta.isImage;

        return (
          <div key={`${att.name || att.url}-${idx}`} className="rounded-2xl border border-slate-200 overflow-hidden bg-slate-50/50 p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${meta.badgeBg}`}>
                  <IconComponent className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="block text-xs font-bold text-slate-800 truncate" title={att.name}>
                    {att.name}
                  </span>
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-medium">
                    <span className={`px-1.5 py-0.2 rounded font-mono font-bold text-[9px] border ${meta.badgeBg}`}>
                      {meta.badgeLabel}
                    </span>
                    <span>{meta.typeName}</span>
                    {att.size && <span>• {att.size}</span>}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {att.url && (
                  <a
                    href={att.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-[11px] font-semibold text-slate-700 transition shadow-2xs"
                    title="Open in new window"
                  >
                    <ExternalLink className="w-3 h-3 text-slate-500" />
                    <span>Open</span>
                  </a>
                )}
                {att.url && (
                  <a
                    href={att.url}
                    download={att.name}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-[11px] font-semibold text-white transition shadow-2xs"
                    title="Download file"
                  >
                    <Download className="w-3 h-3" />
                    <span>Download</span>
                  </a>
                )}
              </div>
            </div>

            {isImage && att.url && (
              <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-white max-h-72 flex items-center justify-center p-1">
                <img src={att.url} alt="Defect Attachment" className="max-h-68 w-auto max-w-full object-contain rounded-lg" />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
