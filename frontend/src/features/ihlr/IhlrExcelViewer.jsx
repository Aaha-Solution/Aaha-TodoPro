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

const IhlrExcelViewer = ({ url, filename }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sheets, setSheets] = useState([]);
  const [activeSheet, setActiveSheet] = useState('');
  const [sheetData, setSheetData] = useState([]);
  const [search, setSearch] = useState('');

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
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });

      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        throw new Error('No sheets found in this Excel file.');
      }

      setSheets(workbook.SheetNames);
      const firstSheet = workbook.SheetNames[0];
      setActiveSheet(firstSheet);

      const worksheet = workbook.Sheets[firstSheet];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
      setSheetData(jsonData);
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
    setLoading(true);
    try {
      fetch(url)
        .then((res) => res.arrayBuffer())
        .then((buf) => {
          const workbook = XLSX.read(buf, { type: 'array' });
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
          setSheetData(jsonData);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    } catch {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full h-[60vh] sm:h-[65vh] rounded-xl border border-slate-200 bg-white flex flex-col items-center justify-center space-y-3">
        <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
        <p className="text-xs font-semibold text-slate-700">Loading spreadsheet data...</p>
        <p className="text-[11px] text-slate-400">Parsing Excel columns and rows</p>
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
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
          <a
            href={url}
            download={filename || 'spreadsheet.xlsx'}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-xs transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Excel</span>
          </a>
        </div>
      </div>
    );
  }

  // Filtered rows
  const headers = sheetData[0] || [];
  const bodyRows = sheetData.slice(1);
  const filteredRows = search.trim()
    ? bodyRows.filter((row) =>
        row.some((cell) =>
          String(cell).toLowerCase().includes(search.toLowerCase())
        )
      )
    : bodyRows;

  return (
    <div className="w-full h-[60vh] sm:h-[65vh] rounded-xl border border-slate-200 bg-white shadow-xs flex flex-col overflow-hidden">
      {/* Top Excel Bar */}
      <div className="p-3 bg-emerald-50/60 border-b border-emerald-100 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center">
            <FileSpreadsheet className="w-4 h-4" />
          </div>
          <div>
            <span className="text-xs font-bold text-emerald-950 block">
              {filename || 'Spreadsheet'}
            </span>
            <span className="text-[10px] text-emerald-700 font-medium">
              {sheetData.length} row{sheetData.length !== 1 ? 's' : ''} • {headers.length} column{headers.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* Search inside spreadsheet */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search table..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 w-36 sm:w-48 shadow-2xs"
            />
          </div>

          <a
            href={url}
            download={filename || 'document.xlsx'}
            className="flex items-center gap-1 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-2xs transition"
            title="Download spreadsheet"
          >
            <Download className="w-3 h-3" />
            <span className="hidden sm:inline">Download</span>
          </a>
        </div>
      </div>

      {/* Sheets Tab Bar (if multiple sheets exist) */}
      {sheets.length > 1 && (
        <div className="flex items-center gap-1 px-3 py-1.5 bg-slate-100/80 border-b border-slate-200 overflow-x-auto shrink-0">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mr-1">
            Sheets:
          </span>
          {sheets.map((sheetName) => (
            <button
              key={sheetName}
              type="button"
              onClick={() => handleSheetChange(sheetName)}
              className={`px-2.5 py-0.5 rounded text-xs font-medium transition cursor-pointer shrink-0 ${
                activeSheet === sheetName
                  ? 'bg-white text-emerald-700 font-bold border border-slate-200 shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-200/70'
              }`}
            >
              {sheetName}
            </button>
          ))}
        </div>
      )}

      {/* Spreadsheet Data Table */}
      <div className="flex-1 overflow-auto bg-white font-mono text-[11px]">
        {sheetData.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-400 text-xs">
            No rows found in this sheet.
          </div>
        ) : (
          <table className="w-full border-collapse">
            {/* Table Header Row */}
            <thead className="sticky top-0 bg-slate-100 z-10 border-b border-slate-300">
              <tr>
                <th className="w-10 py-1.5 px-2 bg-slate-200/80 border-r border-slate-300 text-slate-500 font-bold text-center select-none text-[10px]">
                  #
                </th>
                {headers.map((col, cIdx) => (
                  <th
                    key={cIdx}
                    className="py-1.5 px-3 border-r border-slate-300 text-left font-bold text-slate-700 whitespace-nowrap bg-slate-100"
                  >
                    {col !== '' && col !== undefined ? String(col) : `Col ${cIdx + 1}`}
                  </th>
                ))}
              </tr>
            </thead>

            {/* Table Body Rows */}
            <tbody className="divide-y divide-slate-200">
              {filteredRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={headers.length + 1}
                    className="py-8 text-center text-slate-400 italic text-xs font-sans"
                  >
                    No matching cells found for "{search}".
                  </td>
                </tr>
              ) : (
                filteredRows.map((row, rIdx) => (
                  <tr
                    key={rIdx}
                    className="hover:bg-emerald-50/40 transition-colors"
                  >
                    <td className="py-1.5 px-2 bg-slate-50 border-r border-slate-200 text-slate-400 font-medium text-center select-none text-[10px]">
                      {rIdx + 1}
                    </td>
                    {headers.map((_, cIdx) => {
                      const val = row[cIdx];
                      return (
                        <td
                          key={cIdx}
                          className="py-1.5 px-3 border-r border-slate-200 text-slate-800 whitespace-nowrap overflow-hidden text-ellipsis max-w-xs"
                          title={val !== undefined ? String(val) : ''}
                        >
                          {val !== undefined && val !== null ? String(val) : ''}
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Spreadsheet Status Footer */}
      <div className="p-2 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500 shrink-0 font-sans">
        <span>
          Showing {filteredRows.length} of {bodyRows.length} data rows
        </span>
        <span className="font-mono text-[10px] text-slate-400">
          Sheet: <strong>{activeSheet}</strong>
        </span>
      </div>
    </div>
  );
};

export default IhlrExcelViewer;
