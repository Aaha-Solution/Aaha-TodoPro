import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { 
  FileSpreadsheet, 
  Search, 
  Download, 
  Loader2, 
  AlertCircle, 
  Table as TableIcon,
  RefreshCw
} from 'lucide-react';

/**
 * Universal Excel / Spreadsheet Live Viewer Component
 * Accurately preserves original formatted values (currencies, dates, decimals, percentages)
 * and honors cell alignments, merged cell ranges, and column dimensions.
 */

// Helper to convert index to Excel column letter (A, B, ..., Z, AA, AB, ...)
const colLetter = (colIdx) => {
  let letter = '';
  let temp = colIdx;
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
};

// Parse raw worksheet into rich cell grid preserving exact formatted values and alignments
const parseWorksheetToGrid = (worksheet) => {
  if (!worksheet || !worksheet['!ref']) {
    return { headerRow: [], bodyRows: [], colsInfo: [], totalCols: 0 };
  }

  const range = XLSX.utils.decode_range(worksheet['!ref']);
  const colsInfo = worksheet['!cols'] || [];
  const merges = worksheet['!merges'] || [];

  // Map merged cells
  const mergeMap = new Map();
  const hiddenCells = new Set();

  merges.forEach((m) => {
    const key = `${m.s.r}:${m.s.c}`;
    const rowSpan = m.e.r - m.s.r + 1;
    const colSpan = m.e.c - m.s.c + 1;
    mergeMap.set(key, { rowSpan, colSpan });

    // Mark covered child cells as hidden
    for (let R = m.s.r; R <= m.e.r; ++R) {
      for (let C = m.s.c; C <= m.e.c; ++C) {
        if (R !== m.s.r || C !== m.s.c) {
          hiddenCells.add(`${R}:${C}`);
        }
      }
    }
  });

  const allRows = [];
  for (let R = range.s.r; R <= range.e.r; ++R) {
    const rowCells = [];
    for (let C = range.s.c; C <= range.e.c; ++C) {
      if (hiddenCells.has(`${R}:${C}`)) {
        continue;
      }

      const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
      const cell = worksheet[cellAddress];
      const merge = mergeMap.get(`${R}:${C}`) || null;

      if (!cell) {
        rowCells.push({
          raw: '',
          formatted: '',
          align: 'left',
          type: 'z',
          key: cellAddress,
          merge
        });
        continue;
      }

      // 1. Exact formatted string value as configured in Excel
      let formatted = cell.w;
      if (formatted === undefined || formatted === null || formatted === '') {
        try {
          formatted = XLSX.utils.format_cell(cell);
        } catch {
          if (cell.v instanceof Date) {
            formatted = cell.v.toLocaleDateString();
          } else {
            formatted = cell.v !== undefined ? String(cell.v) : '';
          }
        }
      }

      // 2. Exact alignment: from cell metadata or infer based on data type & format
      let align = 'left';
      if (cell.s?.alignment?.horizontal) {
        align = cell.s.alignment.horizontal;
      } else if (cell.t === 'n') {
        const strVal = String(formatted || cell.v || '').trim();
        if (cell.z && (cell.z.includes('yy') || cell.z.includes('dd') || cell.z.includes('hh:'))) {
          align = 'center';
        } else if (/^\d{1,4}[/-]\d{1,2}[/-]\d{1,4}$/.test(strVal)) {
          align = 'center';
        } else {
          align = 'right';
        }
      } else if (cell.t === 'd' || cell.t === 'b') {
        align = 'center';
      } else {
        const strVal = String(formatted || cell.v || '').trim();
        if (/^(yes|no|pass|fail|active|closed|open|pending|shift\s*[1-3])$/i.test(strVal)) {
          align = 'center';
        } else if (/^\d{1,4}[/-]\d{1,2}[/-]\d{1,4}$/.test(strVal)) {
          align = 'center';
        } else if (/^[\$€£₹]?\s*-?\d+(,\d{3})*(\.\d+)?%?$/.test(strVal)) {
          align = 'right';
        }
      }

      rowCells.push({
        raw: cell.v,
        formatted: String(formatted),
        align,
        type: cell.t || 's',
        formatString: cell.z || '',
        key: cellAddress,
        merge
      });
    }
    allRows.push(rowCells);
  }

  const headerRow = allRows[0] || [];
  const bodyRows = allRows.slice(1);

  return { headerRow, bodyRows, colsInfo, totalCols: range.e.c - range.s.c + 1 };
};

const ExcelViewer = ({ url, filename }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sheets, setSheets] = useState([]);
  const [activeSheet, setActiveSheet] = useState('');
  const [gridData, setGridData] = useState({ headerRow: [], bodyRows: [], colsInfo: [], totalCols: 0 });
  const [search, setSearch] = useState('');
  const [workbookRef, setWorkbookRef] = useState(null);

  const loadExcel = async () => {
    if (!url) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to load file (${response.status}: ${response.statusText})`);
      }
      const arrayBuffer = await response.arrayBuffer();

      // Read with full formatting, styles, date and number formats retained
      const workbook = XLSX.read(arrayBuffer, {
        type: 'array',
        cellDates: true,
        cellNF: true,
        cellText: true,
        cellStyles: true,
        raw: false
      });

      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        throw new Error('No sheets found in this Excel file.');
      }

      setWorkbookRef(workbook);
      setSheets(workbook.SheetNames);
      const firstSheet = workbook.SheetNames[0];
      setActiveSheet(firstSheet);

      const worksheet = workbook.Sheets[firstSheet];
      const parsedGrid = parseWorksheetToGrid(worksheet);
      setGridData(parsedGrid);
    } catch (err) {
      console.error('Error parsing Excel:', err);
      setError(err.message || 'Could not parse Excel document.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExcel();
  }, [url]);

  const handleSheetChange = (sheetName) => {
    setActiveSheet(sheetName);
    if (!workbookRef) return;
    const worksheet = workbookRef.Sheets[sheetName];
    if (worksheet) {
      const parsedGrid = parseWorksheetToGrid(worksheet);
      setGridData(parsedGrid);
    }
  };

  if (loading) {
    return (
      <div className="w-full h-[60vh] sm:h-[65vh] rounded-xl border border-slate-200 bg-white flex flex-col items-center justify-center space-y-3">
        <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
        <p className="text-xs font-semibold text-slate-700">Loading spreadsheet data...</p>
        <p className="text-[11px] text-slate-400">Preserving exact formatting, styles and cell alignments</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-[60vh] sm:h-[65vh] rounded-xl border border-slate-200 bg-white p-6 flex flex-col items-center justify-center text-center space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h4 className="text-sm font-bold text-slate-800">Could not preview spreadsheet</h4>
        <p className="text-xs text-slate-500 max-w-sm">{error}</p>
        <div className="flex items-center gap-2 pt-2">
          <button
            type="button"
            onClick={loadExcel}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
          {url && (
            <a
              href={url}
              download={filename || 'spreadsheet.xlsx'}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-xs transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download File</span>
            </a>
          )}
        </div>
      </div>
    );
  }

  const { headerRow, bodyRows, colsInfo } = gridData;

  const filteredRows = search.trim()
    ? bodyRows.filter((row) =>
        row.some((cell) =>
          String(cell.formatted || cell.raw || '')
            .toLowerCase()
            .includes(search.toLowerCase().trim())
        )
      )
    : bodyRows;

  return (
    <div className="w-full flex flex-col h-[65vh] rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
      {/* Top Toolbar */}
      <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700">
            <FileSpreadsheet className="w-4 h-4" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-800 font-mono">
              {filename || 'Spreadsheet.xlsx'}
            </span>
            <span className="text-[10px] text-slate-400 block font-sans">
              {filteredRows.length} rows &bull; {headerRow.length} columns &bull; Exact Formatting &amp; Alignment Preserved
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-1 max-w-sm justify-end">
          <div className="relative w-full max-w-[220px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
            <input
              type="text"
              placeholder="Search in cells..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>

          {url && (
            <a
              href={url}
              download={filename || 'spreadsheet.xlsx'}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-2xs transition cursor-pointer shrink-0"
              title="Download Original Excel File"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Download</span>
            </a>
          )}
        </div>
      </div>

      {/* Spreadsheet Data Grid */}
      <div className="flex-1 overflow-auto bg-slate-50/50">
        <table className="w-full border-collapse text-[11px]">
          <thead className="sticky top-0 z-10 bg-slate-100 shadow-2xs">
            <tr>
              <th className="w-12 px-2 py-2 text-center text-slate-400 border border-slate-200 bg-slate-100 font-bold select-none text-[10px]">
                #
              </th>
              {headerRow.map((cell, idx) => {
                const alignClass = cell.align === 'right' ? 'text-right' : cell.align === 'center' ? 'text-center' : 'text-left';
                const colWidth = colsInfo[idx]?.wch ? `${Math.max(colsInfo[idx].wch * 9, 100)}px` : undefined;

                return (
                  <th
                    key={cell.key || idx}
                    colSpan={cell.merge?.colSpan}
                    rowSpan={cell.merge?.rowSpan}
                    style={colWidth ? { minWidth: colWidth } : undefined}
                    className={`px-3 py-2 font-bold border border-slate-200 bg-slate-100 whitespace-nowrap min-w-[110px] max-w-[320px] truncate ${alignClass}`}
                    title={cell.formatted || cell.raw}
                  >
                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-semibold mb-0.5">
                      <span>{colLetter(idx)}</span>
                    </div>
                    <span className="text-slate-900 text-[11px] font-bold">
                      {cell.formatted || cell.raw || `Col ${colLetter(idx)}`}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-100">
            {filteredRows.length === 0 ? (
              <tr>
                <td
                  colSpan={Math.max(headerRow.length + 1, 2)}
                  className="py-12 text-center text-slate-400"
                >
                  <TableIcon className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  <p className="font-semibold text-slate-600">No matching cells found</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Try searching for another keyword</p>
                </td>
              </tr>
            ) : (
              filteredRows.map((row, rIdx) => (
                <tr key={rIdx} className="hover:bg-emerald-50/40 transition-colors">
                  <td className="px-2 py-1.5 text-center text-slate-400 border border-slate-200 bg-slate-50/80 text-[10px] select-none font-semibold">
                    {rIdx + 2}
                  </td>
                  {row.map((cell, cIdx) => {
                    const textVal = cell.formatted !== undefined && cell.formatted !== null ? cell.formatted : String(cell.raw || '');
                    const isMatched = search.trim() && textVal.toLowerCase().includes(search.toLowerCase().trim());
                    const alignClass = cell.align === 'right' ? 'text-right' : cell.align === 'center' ? 'text-center' : 'text-left';
                    const isNumeric = cell.type === 'n' || cell.align === 'right';

                    return (
                      <td
                        key={cell.key || cIdx}
                        colSpan={cell.merge?.colSpan}
                        rowSpan={cell.merge?.rowSpan}
                        className={`px-3 py-1.5 border border-slate-200 text-slate-800 whitespace-nowrap max-w-[340px] truncate ${alignClass} ${
                          isNumeric ? 'font-mono' : 'font-sans'
                        } ${isMatched ? 'bg-amber-100/90 font-bold text-amber-900' : ''}`}
                        title={textVal}
                      >
                        {textVal !== '' ? textVal : <span className="text-slate-300 select-none">—</span>}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Sheets Navigation Bar */}
      {sheets.length > 1 && (
        <div className="px-3 py-1.5 bg-slate-100 border-t border-slate-200 flex items-center gap-1.5 overflow-x-auto shrink-0 select-none">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">
            Sheets:
          </span>
          {sheets.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => handleSheetChange(s)}
              className={`px-3 py-1 text-xs rounded-md font-medium transition cursor-pointer ${
                activeSheet === s
                  ? 'bg-white text-emerald-700 font-bold border border-slate-200 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ExcelViewer;
