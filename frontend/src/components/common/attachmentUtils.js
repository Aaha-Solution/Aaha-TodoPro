/**
 * Universal Attachment Utilities for Process Audit, IHLR, and Try Out Status
 */

export const resolveAttachmentUrl = (rawUrl) => {
  if (!rawUrl) return '';
  const trimmed = String(rawUrl).trim();
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:')
  ) {
    return trimmed;
  }
  const apiBase = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL)
    ? import.meta.env.VITE_API_BASE_URL.replace(/\/api\/?$/, '')
    : 'http://localhost:5000';

  const clean = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  if (clean.startsWith('/api/')) {
    return `${apiBase}${clean}`;
  }

  const isProcessAudit =
    (typeof window !== 'undefined' && window.location.pathname.includes('process-audit')) ||
    clean.includes('process-audit');

  if (clean.startsWith('/uploads')) {
    return isProcessAudit
      ? `${apiBase}/api/process-audit${clean}`
      : `${apiBase}/api/ihlr${clean}`;
  }
  return isProcessAudit
    ? `${apiBase}/api/process-audit/${clean.replace(/^\//, '')}`
    : `${apiBase}/api/ihlr/${clean.replace(/^\//, '')}`;
};

export const getFileMeta = (type = '', name = '') => {
  const ext = (type || name.split('.').pop() || 'FILE').toUpperCase();

  if (['PNG', 'JPG', 'JPEG', 'WEBP', 'GIF', 'SVG'].includes(ext)) {
    return {
      typeLabel: 'IMAGE',
      badgeBg: 'bg-purple-100 text-purple-700 border-purple-200',
      pillColor: 'bg-purple-600',
      iconName: 'Image'
    };
  }
  if (ext === 'PDF') {
    return {
      typeLabel: 'PDF',
      badgeBg: 'bg-rose-100 text-rose-700 border-rose-200',
      pillColor: 'bg-rose-600',
      iconName: 'FileText'
    };
  }
  if (['XLS', 'XLSX', 'CSV', 'XLSM'].includes(ext)) {
    return {
      typeLabel: 'EXCEL',
      badgeBg: 'bg-emerald-100 text-emerald-700 border-emerald-200',
      pillColor: 'bg-emerald-600',
      iconName: 'FileSpreadsheet'
    };
  }
  if (['DOC', 'DOCX'].includes(ext)) {
    return {
      typeLabel: 'WORD',
      badgeBg: 'bg-blue-100 text-blue-700 border-blue-200',
      pillColor: 'bg-blue-600',
      iconName: 'FileText'
    };
  }
  if (['PPT', 'PPTX'].includes(ext)) {
    return {
      typeLabel: 'PPT',
      badgeBg: 'bg-amber-100 text-amber-700 border-amber-200',
      pillColor: 'bg-amber-600',
      iconName: 'FileText'
    };
  }
  return {
    typeLabel: ext || 'FILE',
    badgeBg: 'bg-slate-100 text-slate-700 border-slate-200',
    pillColor: 'bg-slate-600',
    iconName: 'File'
  };
};

export const normalizeAttachment = (item) => {
  if (!item) return null;

  if (typeof item === 'string') {
    const trimmed = item.trim();
    if (!trimmed) return null;
    const cleanUrl = trimmed.split('?')[0];
    const filename =
      cleanUrl.split('/').pop() ||
      (trimmed.startsWith('data:image') ? 'attachment-image.png' : 'document');
    const ext = filename.split('.').pop()?.toUpperCase() || (trimmed.startsWith('data:image') ? 'PNG' : 'FILE');
    const isImage = ['PNG', 'JPG', 'JPEG', 'WEBP', 'GIF', 'SVG'].includes(ext) || trimmed.startsWith('data:image');
    const isPdf = ext === 'PDF' || cleanUrl.toLowerCase().endsWith('.pdf');
    const isExcel =
      ['XLS', 'XLSX', 'CSV', 'XLSM'].includes(ext) ||
      cleanUrl.toLowerCase().endsWith('.xlsx') ||
      cleanUrl.toLowerCase().endsWith('.csv') ||
      cleanUrl.toLowerCase().endsWith('.xls');
    const isWord =
      ['DOC', 'DOCX'].includes(ext) ||
      cleanUrl.toLowerCase().endsWith('.docx') ||
      cleanUrl.toLowerCase().endsWith('.doc');
    const isPpt =
      ['PPT', 'PPTX'].includes(ext) ||
      cleanUrl.toLowerCase().endsWith('.pptx') ||
      cleanUrl.toLowerCase().endsWith('.ppt');

    return {
      name: filename,
      url: resolveAttachmentUrl(trimmed),
      size: '',
      type: ext,
      isImage,
      isPdf,
      isExcel,
      isWord,
      isPpt
    };
  }

  if (typeof item === 'object') {
    const name = item.name || item.filename || (item.url ? item.url.split('/').pop() : 'attachment');
    const rawUrl =
      item.url ||
      item.path ||
      (item.id ? `${defaultPrefix}/attachments/binary/${item.id}` : '') ||
      (item.filename ? `${defaultPrefix}/attachments/binary/${encodeURIComponent(item.filename)}` : '');
    const resolvedUrl = resolveAttachmentUrl(rawUrl);
    const isImage =
      item.isImage !== undefined
        ? item.isImage
        : ['PNG', 'JPG', 'JPEG', 'WEBP', 'GIF', 'SVG'].includes(ext) || rawUrl.startsWith('data:image');
    const isPdf = item.isPdf !== undefined ? item.isPdf : ext === 'PDF' || rawUrl.toLowerCase().endsWith('.pdf');
    const isExcel =
      item.isExcel !== undefined
        ? item.isExcel
        : ['XLS', 'XLSX', 'CSV', 'XLSM'].includes(ext) ||
          rawUrl.toLowerCase().endsWith('.xlsx') ||
          rawUrl.toLowerCase().endsWith('.csv') ||
          rawUrl.toLowerCase().endsWith('.xls');
    const isWord =
      item.isWord !== undefined
        ? item.isWord
        : ['DOC', 'DOCX'].includes(ext) ||
          rawUrl.toLowerCase().endsWith('.docx') ||
          rawUrl.toLowerCase().endsWith('.doc');
    const isPpt =
      item.isPpt !== undefined
        ? item.isPpt
        : ['PPT', 'PPTX'].includes(ext) ||
          rawUrl.toLowerCase().endsWith('.pptx') ||
          rawUrl.toLowerCase().endsWith('.ppt');

    return {
      id: item.id,
      name,
      url: resolvedUrl,
      size: item.size || '',
      type: ext,
      date: item.date || '',
      isImage,
      isPdf,
      isExcel,
      isWord,
      isPpt
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
    if (raw.url || raw.name || raw.filename) return [normalizeAttachment(raw)].filter(Boolean);
    return [];
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed || trimmed === '[]' || trimmed === 'null' || trimmed === '""') return [];

    // If it's a JSON array or object string
    if ((trimmed.startsWith('[') && trimmed.endsWith(']')) || (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed.map(normalizeAttachment).filter(Boolean);
        }
        if (parsed && typeof parsed === 'object') {
          return [normalizeAttachment(parsed)].filter(Boolean);
        }
      } catch (err) {
        console.warn('Could not parse JSON attachments:', err);
      }
      return [];
    }

    // Only if it's NOT a JSON string, fallback to comma-separated URLs or filenames:
    if (trimmed.includes(',')) {
      return trimmed
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .map(normalizeAttachment)
        .filter(Boolean);
    }
    return [normalizeAttachment(trimmed)].filter(Boolean);
  }
  return [];
};
