/**
 * Universal Attachment Utilities for Process Audit, IHLR, and Try Out Status
 * Shared across all application tabs, modals, tables, and modules.
 */

/**
 * Dynamically resolves the API Gateway base URL.
 * Automatically adapts to:
 * - Localhost (development on same machine)
 * - LAN IP, e.g. http://192.168.0.169:5000 (accessing across Wi-Fi/LAN)
 * - Custom domain or production gateway
 */
export const getGatewayBaseUrl = () => {
  if (typeof window !== 'undefined' && window.location && window.location.hostname) {
    const { protocol, hostname } = window.location;
    return `${protocol}//${hostname}:5000`;
  }
  return (import.meta.env.VITE_GATEWAY_URL || 'http://localhost:5000').replace(/\/+$/, '');
};

/**
 * Universal Attachment URL Resolver
 * Resolves attachment objects, numeric IDs, database filenames, relative paths,
 * or full URLs into fully qualified, gateway-proxied streaming URLs.
 * Works seamlessly across all tabs (Process Audit, IHLR, Try Out Status).
 *
 * @param {string|number|object} rawAtt - The raw attachment reference
 * @param {string} moduleOverride - Optional explicit module ('process-audit', 'ihlr', 'tryout-status')
 * @returns {string} Fully resolved streaming URL
 */
export const resolveAttachmentUrl = (rawAtt, moduleOverride = '') => {
  if (rawAtt === null || rawAtt === undefined) return '';

  const gatewayBase = getGatewayBaseUrl();

  // 1. Detect module API prefix
  let moduleApi = '';
  if (moduleOverride) {
    const cleanMod = moduleOverride.replace(/^\/api\/?/, '').replace(/^\//, '');
    moduleApi = `/api/${cleanMod}`;
  } else if (typeof rawAtt === 'object' && (rawAtt.module || rawAtt.module_name)) {
    const mod = String(rawAtt.module || rawAtt.module_name).toLowerCase();
    moduleApi = mod.includes('ihlr') ? '/api/ihlr' : (mod.includes('tryout') ? '/api/tryout-status' : '/api/process-audit');
  } else if (typeof window !== 'undefined' && window.location) {
    const path = window.location.pathname.toLowerCase();
    if (path.includes('/ihlr') || path.includes('ihlr')) {
      moduleApi = '/api/ihlr';
    } else if (path.includes('tryout') || path.includes('try-out')) {
      moduleApi = '/api/tryout-status';
    } else {
      moduleApi = '/api/process-audit';
    }
  } else {
    moduleApi = '/api/process-audit';
  }

  // 2. Direct numeric ID lookup (e.g. 42 or "42")
  const isNumeric = typeof rawAtt === 'number' || (typeof rawAtt === 'string' && /^\d+$/.test(rawAtt.trim()));
  if (isNumeric) {
    return `${gatewayBase}${moduleApi}/attachments/${String(rawAtt).trim()}`;
  }

  // 3. Object-based attachment lookup
  if (typeof rawAtt === 'object') {
    // If it already has a persistent remote URL, resolve that URL
    if (rawAtt.url && !rawAtt.url.startsWith('blob:')) {
      return resolveAttachmentUrl(rawAtt.url, moduleOverride);
    }
    if (rawAtt.path && !rawAtt.path.startsWith('blob:')) {
      return resolveAttachmentUrl(rawAtt.path, moduleOverride);
    }
    // If it has an ID
    if (rawAtt.id !== undefined && rawAtt.id !== null) {
      return `${gatewayBase}${moduleApi}/attachments/${rawAtt.id}`;
    }
    // If it has a filename
    if (rawAtt.filename) {
      return `${gatewayBase}${moduleApi}/attachments/${encodeURIComponent(rawAtt.filename)}`;
    }
    // If it has a name
    if (rawAtt.name) {
      return `${gatewayBase}${moduleApi}/attachments/${encodeURIComponent(rawAtt.name)}`;
    }
    // If in-memory blob URL (pre-upload preview)
    if (rawAtt.url && rawAtt.url.startsWith('blob:')) {
      return rawAtt.url;
    }
    return '';
  }

  const trimmed = String(rawAtt).trim();
  if (!trimmed || trimmed === '[]' || trimmed === 'null' || trimmed === '""') return '';

  // 4. In-memory and data URLs (pass through as-is)
  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
    return trimmed;
  }

  // 5. Full HTTP/HTTPS URLs - ensure gateway port 5000 dynamically matches current LAN IP
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      const u = new URL(trimmed);
      if (u.port === '5000' && typeof window !== 'undefined' && window.location && window.location.hostname) {
        u.hostname = window.location.hostname;
        return u.toString();
      }
    } catch {}
    return trimmed;
  }

  const clean = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;

  // 6. Already has microservice route prefix
  if (
    clean.startsWith('/api/process-audit') ||
    clean.startsWith('/api/ihlr') ||
    clean.startsWith('/api/tryout-status')
  ) {
    return `${gatewayBase}${clean}`;
  }

  // 7. Generic /api route
  if (clean.startsWith('/api/')) {
    return `${gatewayBase}${clean}`;
  }

  // 8. Legacy uploads folder
  if (clean.startsWith('/uploads/')) {
    return `${gatewayBase}${moduleApi}${clean}`;
  }

  // 9. Raw filename or relative path
  return `${gatewayBase}${moduleApi}/attachments/${clean.replace(/^\//, '')}`;
};

/**
 * Common Alias for resolveAttachmentUrl to preserve compatibility
 */
export const getFullAttachmentUrl = resolveAttachmentUrl;

/**
 * Returns metadata (badge colors, icons, labels) for any file type or extension.
 */
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

/**
 * Normalizes any attachment item (string, object, or File) into a uniform schema.
 */
export const normalizeAttachment = (item, defaultModule = '') => {
  if (!item) return null;

  if (typeof item === 'string') {
    let trimmed = item.trim();
    if (!trimmed || trimmed === '[]' || trimmed === 'null' || trimmed === '""') return null;

    // Guard against malformed JSON chunk fragments
    if (trimmed.startsWith('{"') || trimmed.endsWith('"}') || trimmed.includes('":"') || trimmed.startsWith('[{')) {
      if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
        try {
          const parsed = JSON.parse(trimmed);
          if (parsed && typeof parsed === 'object') {
            return normalizeAttachment(parsed, defaultModule);
          }
        } catch {}
      }
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
      url: resolveAttachmentUrl(trimmed, defaultModule),
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
    const name = item.name || item.filename || (item.url ? item.url.split('/').pop()?.split('?')[0] : 'attachment');
    const ext = (item.type || (name ? name.split('.').pop() : '') || 'FILE').toUpperCase();

    const resolvedUrl = resolveAttachmentUrl(item, defaultModule);

    const isImage =
      item.isImage !== undefined
        ? item.isImage
        : ['PNG', 'JPG', 'JPEG', 'WEBP', 'GIF', 'SVG'].includes(ext) || (resolvedUrl && resolvedUrl.startsWith('data:image'));
    const isPdf = item.isPdf !== undefined ? item.isPdf : ext === 'PDF' || (resolvedUrl && resolvedUrl.toLowerCase().endsWith('.pdf'));
    const isExcel =
      item.isExcel !== undefined
        ? item.isExcel
        : ['XLS', 'XLSX', 'CSV', 'XLSM'].includes(ext) ||
          (resolvedUrl && resolvedUrl.toLowerCase().endsWith('.xlsx')) ||
          (resolvedUrl && resolvedUrl.toLowerCase().endsWith('.csv')) ||
          (resolvedUrl && resolvedUrl.toLowerCase().endsWith('.xls'));
    const isWord =
      item.isWord !== undefined
        ? item.isWord
        : ['DOC', 'DOCX'].includes(ext) ||
          (resolvedUrl && resolvedUrl.toLowerCase().endsWith('.docx')) ||
          (resolvedUrl && resolvedUrl.toLowerCase().endsWith('.doc'));
    const isPpt =
      item.isPpt !== undefined
        ? item.isPpt
        : ['PPT', 'PPTX'].includes(ext) ||
          (resolvedUrl && resolvedUrl.toLowerCase().endsWith('.pptx')) ||
          (resolvedUrl && resolvedUrl.toLowerCase().endsWith('.ppt'));

    return {
      id: item.id,
      name,
      filename: item.filename || name,
      url: resolvedUrl,
      size: item.size || '',
      type: ext,
      date: item.date || item.uploaded_at || '',
      file: item.file || (item instanceof File ? item : null),
      isImage,
      isPdf,
      isExcel,
      isWord,
      isPpt
    };
  }

  return null;
};

/**
 * Universal attachments parser. Accepts:
 * - JSON strings (arrays or objects)
 * - Array of objects or strings
 * - Single objects or raw strings
 * - Comma-separated strings (safely distinguishes JSON from plain CSV lists)
 */
export const parseAttachments = (raw, defaultModule = '') => {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.map((item) => normalizeAttachment(item, defaultModule)).filter(Boolean);
  }
  if (typeof raw === 'object') {
    if (raw.url || raw.name || raw.filename || raw.id) {
      return [normalizeAttachment(raw, defaultModule)].filter(Boolean);
    }
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
          return parsed.map((item) => normalizeAttachment(item, defaultModule)).filter(Boolean);
        }
        if (parsed && typeof parsed === 'object') {
          return [normalizeAttachment(parsed, defaultModule)].filter(Boolean);
        }
      } catch (err) {
        console.warn('Could not parse JSON attachments:', err);
      }
      return [];
    }

    // 2. Only plain comma-separated paths or URLs (e.g. "image1.png, image2.jpg")
    if (trimmed.includes(',')) {
      return trimmed
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((item) => normalizeAttachment(item, defaultModule))
        .filter(Boolean);
    }

    return [normalizeAttachment(trimmed, defaultModule)].filter(Boolean);
  }
  return [];
};

/**
 * Universal browser-direct file downloader
 * Downloads files cleanly to the user's computer WITHOUT navigating away,
 * opening blank pages, or affecting the UI state or open modals.
 */
export const triggerDirectDownload = async (url, filename = 'download', file = null) => {
  try {
    // 1. If file object already exists in memory
    if (file && (file instanceof Blob || file instanceof File)) {
      const blobUrl = URL.createObjectURL(file);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = blobUrl;
      a.download = filename || file.name || 'download';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        if (a.parentNode) document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
      }, 300);
      return true;
    }

    if (!url) return false;

    // 2. If already a blob or data URL
    if (url.startsWith('blob:') || url.startsWith('data:')) {
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = filename || 'download';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        if (a.parentNode) document.body.removeChild(a);
      }, 300);
      return true;
    }

    // 3. For remote or server URLs (Cross-origin or relative)
    // Fetch as Blob and create a same-origin Blob URL so the browser enforces direct download
    // without ever reloading or changing the current page
    const fetchUrl = url.includes('?') ? `${url}&download=1` : `${url}?download=1`;
    let blob;
    try {
      const res = await fetch(fetchUrl);
      if (res.ok) {
        blob = await res.blob();
      } else {
        const retry = await fetch(url);
        if (retry.ok) blob = await retry.blob();
      }
    } catch {}

    if (blob) {
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = blobUrl;
      a.download = filename || url.split('/').pop()?.split('?')[0] || 'download';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        if (a.parentNode) document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
      }, 300);
      return true;
    }

    // Fallback if CORS prevents blob fetch
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = fetchUrl;
    a.download = filename || 'download';
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      if (a.parentNode) document.body.removeChild(a);
    }, 300);
    return true;
  } catch (err) {
    console.error('[triggerDirectDownload] Error:', err);
    return false;
  }
};
