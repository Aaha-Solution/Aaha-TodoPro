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
  const clean = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  if (clean.startsWith('/api')) {
    return `http://localhost:5000${clean}`;
  }
  if (clean.startsWith('/uploads')) {
    return `http://localhost:5000/api/ihlr${clean}`;
  }
  return `http://localhost:5000/api/ihlr/${clean.replace(/^\//, '')}`;
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
      // Fallback: comma-separated or single URL
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
  }
  return [];
};
