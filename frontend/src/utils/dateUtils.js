/**
 * Utility functions for consistent date formatting across the application.
 * All user-facing dates are standardized to DD/MM/YYYY regardless of OS locale.
 */

/**
 * Formats any date string (YYYY-MM-DD, ISO timestamp, Date object, or DD/MM/YYYY) into DD/MM/YYYY format.
 * Example: '2026-10-01' -> '01/10/2026'
 */
export const formatDateDDMMYYYY = (dateVal) => {
  if (!dateVal) return '—';
  try {
    if (dateVal instanceof Date) {
      if (isNaN(dateVal.getTime())) return '—';
      const day = String(dateVal.getDate()).padStart(2, '0');
      const month = String(dateVal.getMonth() + 1).padStart(2, '0');
      const year = dateVal.getFullYear();
      return `${day}/${month}/${year}`;
    }

    const str = String(dateVal).trim();
    if (!str || str === 'null' || str === 'undefined' || str === '—') return '—';

    // If already in DD/MM/YYYY format:
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(str)) {
      const [d, m, y] = str.split('/');
      return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
    }

    // If YYYY-MM-DD (or ISO with T or space)
    const datePart = str.split(/[T ]/)[0].trim();
    const hyphenParts = datePart.split('-');
    if (hyphenParts.length === 3 && hyphenParts[0].length === 4) {
      const [year, month, day] = hyphenParts;
      return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
    }

    // If DD-MM-YYYY
    if (hyphenParts.length === 3 && hyphenParts[2].length === 4) {
      const [day, month, year] = hyphenParts;
      return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
    }

    const d = new Date(str);
    if (isNaN(d.getTime())) return str;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return String(dateVal);
  }
};

/**
 * Converts any date format (DD/MM/YYYY, Date object, ISO) to standard YYYY-MM-DD.
 * Example: '01/10/2026' -> '2026-10-01'
 */
export const parseDateToYYYYMMDD = (val) => {
  if (!val) return '';
  const str = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(str)) {
    const [d, m, y] = str.split('/');
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  const d = new Date(val);
  if (!isNaN(d.getTime())) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return '';
};

/**
 * Returns today's date formatted as YYYY-MM-DD for standard HTML5/state storage.
 */
export const getTodayDateInput = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Returns today's date formatted as DD/MM/YYYY.
 */
export const getTodayDateDDMMYYYY = () => {
  return formatDateDDMMYYYY(new Date());
};

