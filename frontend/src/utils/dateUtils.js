/**
 * Utility functions for consistent date formatting across the application.
 */

/**
 * Formats any date string (YYYY-MM-DD, ISO timestamp, Date object) into DD/MM/YYYY format.
 * Example: '2026-09-28' -> '28/09/2026'
 */
export const formatDateDDMMYYYY = (dateVal) => {
  if (!dateVal) return '—';
  try {
    const raw = String(dateVal).split('T')[0].trim();
    const parts = raw.split('-');
    if (parts.length === 3 && parts[0].length === 4) {
      const [year, month, day] = parts;
      return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
    }
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return String(dateVal);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return String(dateVal);
  }
};

/**
 * Returns today's date formatted as YYYY-MM-DD for standard HTML5 <input type="date">.
 */
export const getTodayDateInput = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
