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

  const isIhlr =
    (typeof window !== 'undefined' && window.location.pathname.includes('/ihlr')) ||
    clean.includes('ihlr');
  const isTryout =
    (typeof window !== 'undefined' && (window.location.pathname.includes('tryout') || window.location.pathname.includes('try-out'))) ||
    clean.includes('tryout');
  const isProcessAudit =
    (typeof window !== 'undefined' && window.location.pathname.includes('process-audit')) ||
    clean.includes('process-audit');

  const moduleApi = isIhlr ? '/api/ihlr' : (isTryout ? '/api/tryout-status' : '/api/process-audit');

  if (clean.startsWith('/uploads')) {
    return `http://localhost:5000${moduleApi}${clean}`;
  }
  return `http://localhost:5000${moduleApi}/${clean.replace(/^\//, '')}`;
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
    let trimmed = item.trim();
    if (!trimmed || trimmed === '[]' || trimmed === 'null' || trimmed === '""') return null;

    // Guard against malformed JSON chunk fragments like '{"id":16' or '"name":"foo"'
    if (trimmed.startsWith('{"') || trimmed.endsWith('"}') || trimmed.includes('":"') || trimmed.startsWith('[{')) {
      // If it's a full valid JSON object or array, try parsing it
      if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
        try {
          const parsed = JSON.parse(trimmed);
          if (parsed && typeof parsed === 'object') {
            return normalizeAttachment(parsed);
          }
        } catch {}
      }
      // If it's a partial chunk or unparseable JSON fragment, reject it
      if (trimmed.includes('":"')) return null;
    }

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
    const ext = (item.type || (name ? name.split('.').pop() : '') || 'FILE').toUpperCase();

    const isIhlr =
      (typeof window !== 'undefined' && window.location.pathname.includes('/ihlr')) ||
      (item.url && item.url.includes('/ihlr')) ||
      (item.path && item.path.includes('/ihlr'));
    const isTryout =
      (typeof window !== 'undefined' && (window.location.pathname.includes('tryout') || window.location.pathname.includes('try-out'))) ||
      (item.url && item.url.includes('tryout')) ||
      (item.path && item.path.includes('tryout'));
    const isProcessAudit =
      (typeof window !== 'undefined' && window.location.pathname.includes('process-audit')) ||
      (item.url && item.url.includes('process-audit')) ||
      (item.path && item.path.includes('process-audit'));

    const defaultPrefix = isIhlr ? '/api/ihlr' : (isTryout ? '/api/tryout-status' : '/api/process-audit');

    const rawUrl =
      item.url ||
      item.path ||
      (item.id ? `${defaultPrefix}/attachments/binary/${item.id}` : '') ||
      (item.filename ? `${defaultPrefix}/attachments/binary/${encodeURIComponent(item.filename)}` : '');
    const resolvedUrl = resolveAttachmentUrl(rawUrl);

    const isImage =
      item.isImage !== undefined
        ? item.isImage
        : ['PNG', 'JPG', 'JPEG', 'WEBP', 'GIF', 'SVG'].includes(ext) || (rawUrl && rawUrl.startsWith('data:image'));
    const isPdf = item.isPdf !== undefined ? item.isPdf : ext === 'PDF' || (rawUrl && rawUrl.toLowerCase().endsWith('.pdf'));
    const isExcel =
      item.isExcel !== undefined
        ? item.isExcel
        : ['XLS', 'XLSX', 'CSV', 'XLSM'].includes(ext) ||
          (rawUrl && rawUrl.toLowerCase().endsWith('.xlsx')) ||
          (rawUrl && rawUrl.toLowerCase().endsWith('.csv')) ||
          (rawUrl && rawUrl.toLowerCase().endsWith('.xls'));
    const isWord =
      item.isWord !== undefined
        ? item.isWord
        : ['DOC', 'DOCX'].includes(ext) ||
          (rawUrl && rawUrl.toLowerCase().endsWith('.docx')) ||
          (rawUrl && rawUrl.toLowerCase().endsWith('.doc'));
    const isPpt =
      item.isPpt !== undefined
        ? item.isPpt
        : ['PPT', 'PPTX'].includes(ext) ||
          (rawUrl && rawUrl.toLowerCase().endsWith('.pptx')) ||
          (rawUrl && rawUrl.toLowerCase().endsWith('.ppt'));

    return {
      id: item.id,
      name,
      filename: item.filename || name,
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
    if (raw.url || raw.name || raw.filename || raw.id) return [normalizeAttachment(raw)].filter(Boolean);
    return [];
  }
  if (typeof raw === 'string') {
    let trimmed = raw.trim();
    if (!trimmed || trimmed === '[]' || trimmed === 'null' || trimmed === '""') return [];

    // 1. If it looks like JSON array or object, parse it safely
    if (
      (trimmed.startsWith('[') && trimmed.endsWith(']')) ||
      (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('"') && trimmed.endsWith('"'))
    ) {
      try {
        let parsed = JSON.parse(trimmed);
        if (typeof parsed === 'string') {
          try {
            parsed = JSON.parse(parsed);
          } catch {}
        }
        if (Array.isArray(parsed)) {
          return parsed.map(normalizeAttachment).filter(Boolean);
        }
        if (parsed && typeof parsed === 'object') {
          return [normalizeAttachment(parsed)].filter(Boolean);
        }
      } catch (err) {
        console.warn('Could not parse JSON attachments:', err);
      }
      // CRITICAL: Never fall through to comma-splitting for JSON structures!
      return [];
    }

    // 2. Only plain comma-separated paths or URLs (e.g. "image1.png, image2.jpg")
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
