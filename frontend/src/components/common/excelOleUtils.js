import * as XLSX from 'xlsx';

const defaultKey = 'default';
const CFB = XLSX.CFB || XLSX[defaultKey]?.CFB;

const OLE_PACKAGE_CLSID_HEX = '0c00030000000000c000000000000046';

const REL_TYPE_VML_DRAWING =
  'http://schemas.openxmlformats.org/officeDocument/2006/relationships/vmlDrawing';
const REL_TYPE_OLE_OBJECT =
  'http://schemas.openxmlformats.org/officeDocument/2006/relationships/oleObject';
const REL_TYPE_IMAGE =
  'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image';

const CONTENT_TYPE_OLE = 'application/vnd.openxmlformats-officedocument.oleObject';
const CONTENT_TYPE_VML = 'application/vnd.openxmlformats-officedocument.vmlDrawing';
const CONTENT_TYPE_PNG = 'image/png';

/**
 * Sanitizes an attachment filename into a Windows-safe ASCII basename
 * suitable for ANSI OLE10Native fields and temporary file extraction.
 */
export const sanitizeOleFileName = (fileName) => {
  const rawBase = String(fileName || 'attachment.bin').split(/[/\\]/).pop() || 'attachment.bin';
  const cleaned = rawBase
    .replace(/[^\x20-\x7E]/g, '_')
    .replace(/[<>:"/\\|?*]/g, '_')
    .trim();

  if (!cleaned) return 'attachment.bin';
  if (cleaned.length <= 120) return cleaned;

  const dotIdx = cleaned.lastIndexOf('.');
  if (dotIdx > 0 && cleaned.length - dotIdx <= 15) {
    const ext = cleaned.slice(dotIdx);
    return `${cleaned.slice(0, 120 - ext.length)}${ext}`;
  }
  return cleaned.slice(0, 120);
};

const encodeAsciiNull = (str) => {
  const out = new Uint8Array(str.length + 1);
  for (let i = 0; i < str.length; i++) {
    out[i] = str.charCodeAt(i) & 0xff;
  }
  out[str.length] = 0;
  return out;
};

/**
 * Builds the \x01Ole10Native stream following Windows packager.dll OLE 1.0 Package format.
 */
const buildOle10NativeStream = (asciiFileName, fileBytes) => {
  const payload = fileBytes instanceof Uint8Array ? fileBytes : new Uint8Array(fileBytes);
  const labelBytes = encodeAsciiNull(asciiFileName);
  const origPathBytes = encodeAsciiNull(asciiFileName);
  const tempPathBytes = encodeAsciiNull(asciiFileName);

  // bodySize excludes the leading 4-byte totalSize field
  const bodySize =
    2 + // flags1 (0x0002)
    labelBytes.length +
    origPathBytes.length +
    2 + // flags2 (0x0000)
    2 + // type (0x0003 = Embedded File)
    4 + // tempPathLen (including null terminator)
    tempPathBytes.length +
    4 + // dataSize
    payload.byteLength;

  const out = new Uint8Array(4 + bodySize);
  const view = new DataView(out.buffer);
  let offset = 0;

  view.setUint32(offset, bodySize, true);
  offset += 4;

  view.setUint16(offset, 0x0002, true);
  offset += 2;

  out.set(labelBytes, offset);
  offset += labelBytes.length;

  out.set(origPathBytes, offset);
  offset += origPathBytes.length;

  view.setUint16(offset, 0x0000, true);
  offset += 2;

  view.setUint16(offset, 0x0003, true);
  offset += 2;

  view.setUint32(offset, tempPathBytes.length, true);
  offset += 4;

  out.set(tempPathBytes, offset);
  offset += tempPathBytes.length;

  view.setUint32(offset, payload.byteLength, true);
  offset += 4;

  out.set(payload, offset);

  return out;
};

/**
 * Builds the 20-byte \x01Ole stream ([MS-OLEDS] 2.3.3 OLEStream) for an embedded object.
 */
const buildOleStream = () =>
  new Uint8Array([
    0x01, 0x00, 0x00, 0x02, // Version = 0x02000001
    0x00, 0x00, 0x00, 0x00, // Flags = Embedded
    0x00, 0x00, 0x00, 0x00, // LinkUpdateOption
    0x00, 0x00, 0x00, 0x00, // Reserved1
    0x00, 0x00, 0x00, 0x00  // ReservedMonikerStreamSize
  ]);

/**
 * Builds the \x01CompObj stream ([MS-OLEDS] 2.3.8 CompObjStream) for OLE Package.
 */
const buildCompObjStream = () => {
  const userTypeBytes = encodeAsciiNull('Package');
  const progIdBytes = encodeAsciiNull('Package');
  const headerSize = 28;
  const totalSize =
    headerSize +
    4 + userTypeBytes.length + // AnsiUserType
    4 + // AnsiClipboardFormat (0 = absent)
    4 + progIdBytes.length + // Reserved1 (AnsiProgId)
    4; // UnicodeMarker (0 = no unicode trailer)

  const out = new Uint8Array(totalSize);
  const view = new DataView(out.buffer);

  // CompObjHeader (28 bytes)
  out.set(
    [
      0x01, 0x00, 0xfe, 0xff, // Reserved1
      0x03, 0x0a, 0x00, 0x00, // Version
      0xff, 0xff, 0xff, 0xff, // Reserved2
      // ClassId = {0003000C-0000-0000-C000-000000000046} (OLE Package)
      0x0c, 0x00, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00,
      0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x46
    ],
    0
  );

  let offset = headerSize;
  view.setUint32(offset, userTypeBytes.length, true);
  offset += 4;
  out.set(userTypeBytes, offset);
  offset += userTypeBytes.length;

  view.setUint32(offset, 0, true);
  offset += 4;

  view.setUint32(offset, progIdBytes.length, true);
  offset += 4;
  out.set(progIdBytes, offset);
  offset += progIdBytes.length;

  view.setUint32(offset, 0, true);
  return out;
};

/**
 * Wraps an arbitrary file's raw binary bytes into a valid OLE2 Compound File Binary (.bin)
 * recognized by Excel & Windows Packager (ProgId="Package").
 */
export const buildOlePackageBin = (fileName, fileBytes) => {
  const asciiFileName = sanitizeOleFileName(fileName);
  const cfb = CFB.utils.cfb_new({ CLSID: OLE_PACKAGE_CLSID_HEX });

  CFB.utils.cfb_add(cfb, '/\u0001CompObj', buildCompObjStream());
  CFB.utils.cfb_add(cfb, '/\u0001Ole', buildOleStream());
  CFB.utils.cfb_add(cfb, '/\u0001Ole10Native', buildOle10NativeStream(asciiFileName, fileBytes));

  const written = CFB.write(cfb, { type: 'array' });
  return written instanceof Uint8Array ? written : new Uint8Array(written);
};

const getFileBadgeStyle = (fileName) => {
  const ext = String(fileName || '').split('.').pop()?.toUpperCase() || 'FILE';
  if (ext === 'PDF') {
    return { label: 'PDF', accent: '#DC2626', accentLight: '#FEE2E2' };
  }
  if (['XLSX', 'XLS', 'XLSM', 'CSV'].includes(ext)) {
    return { label: ext.slice(0, 4), accent: '#15803D', accentLight: '#DCFCE7' };
  }
  if (['DOC', 'DOCX'].includes(ext)) {
    return { label: ext.slice(0, 4), accent: '#2563EB', accentLight: '#DBEAFE' };
  }
  if (['PPT', 'PPTX'].includes(ext)) {
    return { label: ext.slice(0, 4), accent: '#EA580C', accentLight: '#FFEDD5' };
  }
  if (['ZIP', 'RAR', '7Z'].includes(ext)) {
    return { label: ext.slice(0, 4), accent: '#D97706', accentLight: '#FEF3C7' };
  }
  return { label: ext.slice(0, 4) || 'FILE', accent: '#475569', accentLight: '#F1F5F9' };
};

const wrapCanvasText = (ctx, text, maxWidth, maxLines = 2) => {
  const raw = String(text || 'Attachment').trim() || 'Attachment';
  const lines = [];
  let current = '';

  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    const next = current + ch;
    if (ctx.measureText(next).width <= maxWidth) {
      current = next;
    } else {
      if (lines.length + 1 >= maxLines) {
        // Fit trailing ellipsis into the last allowed line
        let trimmed = current;
        while (trimmed.length > 0 && ctx.measureText(`${trimmed}...`).width > maxWidth) {
          trimmed = trimmed.slice(0, -1);
        }
        lines.push(`${trimmed}...`);
        current = '';
        break;
      }
      // Prefer breaking after common filename separators when available near the end
      const breakChars = ['_', '-', '.', ' '];
      let splitAt = -1;
      for (let j = current.length - 1; j >= Math.max(3, current.length - 8); j--) {
        if (breakChars.includes(current[j])) {
          splitAt = j + 1;
          break;
        }
      }
      if (splitAt > 0 && splitAt < current.length) {
        lines.push(current.slice(0, splitAt));
        current = current.slice(splitAt) + ch;
      } else {
        lines.push(current);
        current = ch;
      }
    }
  }

  if (current && lines.length < maxLines) {
    lines.push(current);
  }
  return lines;
};

// Minimal valid 1x1 transparent PNG fallback for non-DOM test environments
const FALLBACK_PNG_BYTES = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
  0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
  0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
  0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82
]);

/**
 * Generates a crisp Excel-style embedded object card PNG (white box with thin border,
 * document icon + extension badge, and wrapped filename underneath).
 */
export const renderFileIconCardPng = (fileName) => {
  if (typeof document === 'undefined') {
    return FALLBACK_PNG_BYTES;
  }

  const width = 256;
  const height = 124;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return FALLBACK_PNG_BYTES;

  const { label, accent, accentLight } = getFileBadgeStyle(fileName);

  // Card background & crisp border
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = '#64748B';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, width - 2, height - 2);

  // Document icon in upper center
  const docW = 46;
  const docH = 56;
  const docX = (width - docW) / 2;
  const docY = 12;
  const fold = 12;

  ctx.beginPath();
  ctx.moveTo(docX, docY);
  ctx.lineTo(docX + docW - fold, docY);
  ctx.lineTo(docX + docW, docY + fold);
  ctx.lineTo(docX + docW, docY + docH);
  ctx.lineTo(docX, docY + docH);
  ctx.closePath();
  ctx.fillStyle = accentLight;
  ctx.fill();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Folded corner
  ctx.beginPath();
  ctx.moveTo(docX + docW - fold, docY);
  ctx.lineTo(docX + docW - fold, docY + fold);
  ctx.lineTo(docX + docW, docY + fold);
  ctx.closePath();
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.stroke();

  // Extension pill inside icon
  const pillW = 54;
  const pillH = 22;
  const pillX = (width - pillW) / 2;
  const pillY = docY + 26;
  ctx.fillStyle = accent;
  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, 4);
    ctx.fill();
  } else {
    ctx.fillRect(pillX, pillY, pillW, pillH);
  }

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 14px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, width / 2, pillY + pillH / 2 + 0.5);

  // Filename label below icon
  ctx.fillStyle = '#0F172A';
  ctx.font = '18px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const lines = wrapCanvasText(ctx, fileName, width - 20, 2);
  const lineStartY = lines.length === 1 ? 82 : 74;
  lines.forEach((line, idx) => {
    ctx.fillText(line, width / 2, lineStartY + idx * 21);
  });

  const dataUrl = canvas.toDataURL('image/png');
  const b64 = dataUrl.split(',')[1];
  const binStr = atob(b64);
  const bytes = new Uint8Array(binStr.length);
  for (let i = 0; i < binStr.length; i++) {
    bytes[i] = binStr.charCodeAt(i);
  }
  return bytes;
};

const escapeXml = (str) =>
  String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const ensureContentTypeDefault = (xml, extension, contentType) => {
  const extRegex = new RegExp(`<Default[^>]*Extension="${extension}"`, 'i');
  if (extRegex.test(xml)) return xml;
  const tag = `<Default Extension="${extension}" ContentType="${contentType}"/>`;
  return xml.replace('</Types>', `${tag}</Types>`);
};

const getNextRelIdNumber = (relsXml) => {
  let maxId = 0;
  const matches = relsXml.matchAll(/Id="rId(\d+)"/g);
  for (const m of matches) {
    const num = parseInt(m[1], 10);
    if (num > maxId) maxId = num;
  }
  return maxId + 1;
};

const normalizeZipPath = (zipPath) =>
  String(zipPath || '').replace(/^Root Entry\//i, '').replace(/^\/+/, '');

const findCfbEntry = (cfb, zipPath) => {
  const clean = normalizeZipPath(zipPath);
  return CFB.find(cfb, clean) || CFB.find(cfb, `/${clean}`);
};

const getCfbTextEntry = (cfb, zipPath) => {
  const entry = findCfbEntry(cfb, zipPath);
  if (!entry || !entry.content) return null;
  const raw = entry.content instanceof Uint8Array ? entry.content : new Uint8Array(entry.content);
  return new TextDecoder('utf-8').decode(raw);
};

const setCfbEntry = (cfb, zipPath, data) => {
  const clean = normalizeZipPath(zipPath);
  const bytes = typeof data === 'string'
    ? new TextEncoder().encode(data)
    : (data instanceof Uint8Array ? data : new Uint8Array(data));

  const existing = findCfbEntry(cfb, clean);
  if (existing && existing.type === 2) {
    existing.content = bytes;
    existing.size = bytes.length;
    return;
  }
  CFB.utils.cfb_add(cfb, `/${clean}`, bytes);
};

const getNextSequentialIndex = (cfb, prefixRegex) => {
  let maxIdx = 0;
  (cfb.FullPaths || []).forEach((fullPath) => {
    const cleanPath = normalizeZipPath(fullPath);
    const m = cleanPath.match(prefixRegex);
    if (m) {
      const idx = parseInt(m[1], 10);
      if (idx > maxIdx) maxIdx = idx;
    }
  });
  return maxIdx + 1;
};

const appendRelationships = (relsXml, relTagsStr) => {
  if (/<Relationships\b[^>]*\/>/.test(relsXml)) {
    return relsXml.replace(
      /<Relationships\b([^>]*)\/>/,
      `<Relationships$1>${relTagsStr}</Relationships>`
    );
  }
  return relsXml.replace('</Relationships>', `${relTagsStr}</Relationships>`);
};

const insertWorksheetOleNodes = (sheetXml, legacyDrawingTag, oleObjectsXml) => {
  // ECMA-376 CT_Worksheet sequence order:
  // drawing -> legacyDrawing -> legacyDrawingHF -> picture -> oleObjects -> controls -> webPublishItems -> tableParts -> extLst
  let updated = sheetXml;

  if (legacyDrawingTag) {
    if (/<legacyDrawingHF\b/.test(updated)) {
      updated = updated.replace(/<legacyDrawingHF\b/, `${legacyDrawingTag}<legacyDrawingHF`);
    } else if (/<picture\b/.test(updated)) {
      updated = updated.replace(/<picture\b/, `${legacyDrawingTag}<picture`);
    } else if (/<oleObjects\b/.test(updated)) {
      updated = updated.replace(/<oleObjects\b/, `${legacyDrawingTag}<oleObjects`);
    } else if (/<controls\b/.test(updated)) {
      updated = updated.replace(/<controls\b/, `${legacyDrawingTag}<controls`);
    } else if (/<webPublishItems\b/.test(updated)) {
      updated = updated.replace(/<webPublishItems\b/, `${legacyDrawingTag}<webPublishItems`);
    } else if (/<tableParts\b/.test(updated)) {
      updated = updated.replace(/<tableParts\b/, `${legacyDrawingTag}<tableParts`);
    } else if (/<extLst\b/.test(updated)) {
      updated = updated.replace(/<extLst\b/, `${legacyDrawingTag}<extLst`);
    } else {
      updated = updated.replace('</worksheet>', `${legacyDrawingTag}</worksheet>`);
    }
  }

  if (/<oleObjects\b/.test(updated)) {
    const inner = oleObjectsXml.replace(/^<oleObjects>/, '').replace(/<\/oleObjects>$/, '');
    updated = updated.replace('</oleObjects>', `${inner}</oleObjects>`);
  } else if (/<controls\b/.test(updated)) {
    updated = updated.replace(/<controls\b/, `${oleObjectsXml}<controls`);
  } else if (/<webPublishItems\b/.test(updated)) {
    updated = updated.replace(/<webPublishItems\b/, `${oleObjectsXml}<webPublishItems`);
  } else if (/<tableParts\b/.test(updated)) {
    updated = updated.replace(/<tableParts\b/, `${oleObjectsXml}<tableParts`);
  } else if (/<extLst\b/.test(updated)) {
    updated = updated.replace(/<extLst\b/, `${oleObjectsXml}<extLst`);
  } else {
    updated = updated.replace('</worksheet>', `${oleObjectsXml}</worksheet>`);
  }

  return updated;
};

/**
 * Post-processes an ExcelJS-generated .xlsx buffer to embed arbitrary non-image files
 * as offline OLE Package objects displayed as clickable file-icon cards inside their cells.
 *
 * @param {ArrayBuffer|Uint8Array} xlsxBuffer - Raw .xlsx buffer from workbook.xlsx.writeBuffer()
 * @param {Array<{colZero: number, rowZero: number, fileName: string, fileBytes: Uint8Array, colWidths?: number[], rowHeights?: number[]}>} oleItems
 * @param {{ sheetIndex?: number, colWidths?: number[], rowHeights?: number[] }} options
 * @returns {Promise<Uint8Array>}
 */
export const embedOleObjectsInXlsx = async (xlsxBuffer, oleItems = [], options = {}) => {
  if (!oleItems || oleItems.length === 0) {
    return xlsxBuffer instanceof Uint8Array ? xlsxBuffer : new Uint8Array(xlsxBuffer);
  }

  const sheetNum = options.sheetIndex || 1;
  const colWidths = options.colWidths || [];
  const rowHeights = options.rowHeights || [];

  const rawBytes = xlsxBuffer instanceof Uint8Array ? xlsxBuffer : new Uint8Array(xlsxBuffer);
  const cfb = CFB.read(rawBytes, { type: 'array' });
  const sheetPath = `xl/worksheets/sheet${sheetNum}.xml`;
  const sheetRelsPath = `xl/worksheets/_rels/sheet${sheetNum}.xml.rels`;
  const contentTypesPath = '[Content_Types].xml';

  let sheetXml = getCfbTextEntry(cfb, sheetPath);
  let contentTypesXml = getCfbTextEntry(cfb, contentTypesPath);
  if (!sheetXml || !contentTypesXml) {
    return rawBytes;
  }

  let sheetRelsXml =
    getCfbTextEntry(cfb, sheetRelsPath) ||
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>';

  let nextRid = getNextRelIdNumber(sheetRelsXml);
  let nextOleFileNum = getNextSequentialIndex(cfb, /^xl\/embeddings\/oleObject(\d+)\.bin$/);
  let nextIconNum = getNextSequentialIndex(cfb, /^xl\/media\/oleIcon(\d+)\.png$/);
  const nextVmlNum = getNextSequentialIndex(cfb, /^xl\/drawings\/vmlDrawing(\d+)\.vml$/);

  const vmlFileName = `vmlDrawing${nextVmlNum}.vml`;
  const vmlPath = `xl/drawings/${vmlFileName}`;
  const vmlRelsPath = `xl/drawings/_rels/${vmlFileName}.rels`;

  const vmlRelId = `rId${nextRid++}`;
  const newSheetRels = [
    `<Relationship Id="${vmlRelId}" Type="${REL_TYPE_VML_DRAWING}" Target="../drawings/${vmlFileName}"/>`
  ];
  const vmlRels = [];
  const vmlShapes = [];
  const oleObjectTags = [];

  // Cumulative layout offsets in points for VML CSS position fallback
  const getColLeftPt = (colZero) => {
    let px = 0;
    for (let c = 0; c < colZero; c++) {
      const w = colWidths[c] || 12;
      px += Math.floor(w * 7 + 5);
    }
    return px * 0.75;
  };

  const getRowTopPt = (rowZero) => {
    let pt = 0;
    for (let r = 0; r < rowZero; r++) {
      pt += rowHeights[r] || 18;
    }
    return pt;
  };

  oleItems.forEach((item, idx) => {
    const oleIndex = nextOleFileNum++;
    const iconIndex = nextIconNum++;
    const shapeNum = 1025 + idx;
    const shapeId = `_x0000_s${shapeNum}`;

    const binPath = `xl/embeddings/oleObject${oleIndex}.bin`;
    const iconPath = `xl/media/oleIcon${iconIndex}.png`;

    const binBytes = buildOlePackageBin(item.fileName, item.fileBytes);
    const iconBytes = renderFileIconCardPng(item.fileName);

    setCfbEntry(cfb, binPath, binBytes);
    setCfbEntry(cfb, iconPath, iconBytes);

    const oleRelId = `rId${nextRid++}`;
    newSheetRels.push(
      `<Relationship Id="${oleRelId}" Type="${REL_TYPE_OLE_OBJECT}" Target="../embeddings/oleObject${oleIndex}.bin"/>`
    );

    const vmlImgRelId = `rId${idx + 1}`;
    vmlRels.push(
      `<Relationship Id="${vmlImgRelId}" Type="${REL_TYPE_IMAGE}" Target="../media/oleIcon${iconIndex}.png"/>`
    );

    const colW = colWidths[item.colZero] || 22;
    const cellPxW = Math.floor(colW * 7 + 5);
    const cellPtH = rowHeights[item.rowZero] || 56;
    const cellPxH = Math.floor((cellPtH * 96) / 72);

    const boxPxW = Math.min(128, Math.max(84, cellPxW - 24));
    const boxPxH = Math.min(62, Math.max(44, cellPxH - 10));
    const dx1 = Math.max(4, Math.floor((cellPxW - boxPxW) / 2));
    const dy1 = Math.max(3, Math.floor((cellPxH - boxPxH) / 2));
    const dx2 = dx1 + boxPxW;
    const dy2 = dy1 + boxPxH;

    const leftPt = (getColLeftPt(item.colZero) + dx1 * 0.75).toFixed(2);
    const topPt = (getRowTopPt(item.rowZero) + dy1 * 0.75).toFixed(2);
    const widthPt = (boxPxW * 0.75).toFixed(2);
    const heightPt = (boxPxH * 0.75).toFixed(2);

    vmlShapes.push(
      `<v:shape id="${shapeId}" type="#_x0000_t75" style="position:absolute;margin-left:${leftPt}pt;margin-top:${topPt}pt;width:${widthPt}pt;height:${heightPt}pt;z-index:${idx + 1}" filled="f" stroked="f" o:insetmode="auto" o:ole="">` +
        `<v:imagedata o:relid="${vmlImgRelId}" o:title="${escapeXml(item.fileName)}"/>` +
        `<x:ClientData ObjectType="Pict">` +
          `<x:SizeWithCells/>` +
          `<x:Anchor>${item.colZero}, ${dx1}, ${item.rowZero}, ${dy1}, ${item.colZero}, ${dx2}, ${item.rowZero}, ${dy2}</x:Anchor>` +
          `<x:CF>Pict</x:CF>` +
          `<x:AutoPict/>` +
        `</x:ClientData>` +
      `</v:shape>`
    );

    oleObjectTags.push(
      `<oleObject progId="Package" dvAspect="DVASPECT_ICON" shapeId="${shapeNum}" r:id="${oleRelId}"/>`
    );
  });

  const vmlXml =
    `<xml xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">` +
      `<o:shapelayout v:ext="edit"><o:idmap v:ext="edit" data="${sheetNum}"/></o:shapelayout>` +
      `<v:shapetype id="_x0000_t75" coordsize="21600,21600" o:spt="75" o:preferrelative="t" path="m@4@5l@4@11@9@11@9@5xe" filled="f" stroked="f">` +
        `<v:stroke joinstyle="miter"/>` +
        `<v:formulas>` +
          `<v:f eqn="if lineDrawn pixelLineWidth 0"/>` +
          `<v:f eqn="sum @0 1 0"/>` +
          `<v:f eqn="sum 0 0 @1"/>` +
          `<v:f eqn="prod @2 1 2"/>` +
          `<v:f eqn="prod @3 21600 pixelWidth"/>` +
          `<v:f eqn="prod @3 21600 pixelHeight"/>` +
          `<v:f eqn="sum @0 0 1"/>` +
          `<v:f eqn="prod @6 1 2"/>` +
          `<v:f eqn="prod @7 21600 pixelWidth"/>` +
          `<v:f eqn="sum @8 21600 0"/>` +
          `<v:f eqn="prod @7 21600 pixelHeight"/>` +
          `<v:f eqn="sum @10 21600 0"/>` +
        `</v:formulas>` +
        `<v:path o:extrusionok="f" gradientshapeok="t" o:connecttype="rect"/>` +
        `<o:lock v:ext="edit" aspectratio="t"/>` +
      `</v:shapetype>` +
      vmlShapes.join('') +
    `</xml>`;

  const vmlRelsXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${vmlRels.join('')}</Relationships>`;

  setCfbEntry(cfb, vmlPath, vmlXml);
  setCfbEntry(cfb, vmlRelsPath, vmlRelsXml);

  sheetRelsXml = appendRelationships(sheetRelsXml, newSheetRels.join(''));
  setCfbEntry(cfb, sheetRelsPath, sheetRelsXml);

  const legacyDrawingTag = `<legacyDrawing r:id="${vmlRelId}"/>`;
  const oleObjectsXml = `<oleObjects>${oleObjectTags.join('')}</oleObjects>`;
  sheetXml = insertWorksheetOleNodes(sheetXml, legacyDrawingTag, oleObjectsXml);
  setCfbEntry(cfb, sheetPath, sheetXml);

  contentTypesXml = ensureContentTypeDefault(contentTypesXml, 'bin', CONTENT_TYPE_OLE);
  contentTypesXml = ensureContentTypeDefault(contentTypesXml, 'vml', CONTENT_TYPE_VML);
  contentTypesXml = ensureContentTypeDefault(contentTypesXml, 'png', CONTENT_TYPE_PNG);
  setCfbEntry(cfb, contentTypesPath, contentTypesXml);

  const out = CFB.write(cfb, {
    type: 'array',
    fileType: 'zip',
    compression: true
  });
  return out instanceof Uint8Array ? out : new Uint8Array(out);
};
