import React, { useState, useEffect, useRef } from 'react';
import { Calendar } from 'lucide-react';
import { formatDateDDMMYYYY, parseDateToYYYYMMDD } from '../../utils/dateUtils';

/**
 * Universal DateInput Component
 * Guarantees DD/MM/YYYY display across all operating systems and browsers,
 * eliminating the OS-dependent MM/DD/YYYY vs DD/MM/YYYY discrepancy.
 * 
 * Automatically synchronizes with standard YYYY-MM-DD for form state and backend storage.
 */
const DateInput = ({
  value = '',
  onChange,
  name,
  id,
  placeholder = 'DD/MM/YYYY',
  required = false,
  disabled = false,
  min,
  max,
  className = '',
  ...props
}) => {
  // ISO format string YYYY-MM-DD
  const isoValue = parseDateToYYYYMMDD(value);
  
  // Display text strictly in DD/MM/YYYY
  const [displayText, setDisplayText] = useState(() => (isoValue ? formatDateDDMMYYYY(isoValue) : ''));
  const hiddenInputRef = useRef(null);

  // Sync internal display when external value changes
  useEffect(() => {
    if (value) {
      setDisplayText(formatDateDDMMYYYY(value));
    } else {
      setDisplayText('');
    }
  }, [value]);

  const triggerChange = (newIsoDate) => {
    if (typeof onChange === 'function') {
      const syntheticEvent = {
        target: { name: name || id || 'date', value: newIsoDate, id },
        currentTarget: { name: name || id || 'date', value: newIsoDate, id },
        value: newIsoDate,
      };
      onChange(syntheticEvent);
    }
  };

  // Called when user selects a date via native calendar picker
  const handlePickerChange = (e) => {
    const selectedIso = e.target.value; // 'YYYY-MM-DD'
    if (selectedIso) {
      setDisplayText(formatDateDDMMYYYY(selectedIso));
      triggerChange(selectedIso);
    } else {
      setDisplayText('');
      triggerChange('');
    }
  };

  // Called when user manually types into the input
  const handleTextChange = (e) => {
    const raw = e.target.value;
    
    // Auto-masking: allow digits and slashes, automatically place slashes
    const digitsOnly = raw.replace(/\D/g, '').slice(0, 8);
    let formatted = digitsOnly;
    if (digitsOnly.length > 4) {
      formatted = `${digitsOnly.slice(0, 2)}/${digitsOnly.slice(2, 4)}/${digitsOnly.slice(4)}`;
    } else if (digitsOnly.length > 2) {
      formatted = `${digitsOnly.slice(0, 2)}/${digitsOnly.slice(2)}`;
    }

    setDisplayText(formatted);

    if (!formatted) {
      triggerChange('');
      return;
    }

    // If complete DD/MM/YYYY
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(formatted)) {
      const [d, m, y] = formatted.split('/');
      const day = parseInt(d, 10);
      const month = parseInt(m, 10);
      const year = parseInt(y, 10);

      if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1900 && year <= 2100) {
        const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        triggerChange(iso);
      }
    }
  };

  const handleBlur = () => {
    if (displayText && /^\d{2}\/\d{2}\/\d{4}$/.test(displayText)) {
      const [d, m, y] = displayText.split('/');
      const day = parseInt(d, 10);
      const month = parseInt(m, 10);
      const year = parseInt(y, 10);

      if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1900 && year <= 2100) {
        const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        triggerChange(iso);
        setDisplayText(formatDateDDMMYYYY(iso));
        return;
      }
    }

    // Revert to valid value or clear if invalid
    if (value) {
      setDisplayText(formatDateDDMMYYYY(value));
    } else {
      setDisplayText('');
    }
  };

  const openPicker = () => {
    if (disabled) return;
    if (hiddenInputRef.current) {
      try {
        if (typeof hiddenInputRef.current.showPicker === 'function') {
          hiddenInputRef.current.showPicker();
        } else {
          hiddenInputRef.current.focus();
          hiddenInputRef.current.click();
        }
      } catch {
        hiddenInputRef.current.click();
      }
    }
  };

  return (
    <div className="relative flex items-center w-full group">
      <input
        type="text"
        id={id}
        name={name}
        value={displayText}
        onChange={handleTextChange}
        onBlur={handleBlur}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        maxLength={10}
        className={`${className} pr-10 font-mono tracking-wide`}
        {...props}
      />

      {/* Calendar picker trigger button */}
      <button
        type="button"
        disabled={disabled}
        onClick={openPicker}
        tabIndex={-1}
        className="absolute right-2 p-1.5 rounded-lg text-slate-400 group-hover:text-blue-600 hover:bg-blue-50 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
        title="Open calendar"
      >
        <Calendar className="w-4 h-4" />
      </button>

      {/* Hidden native date input for the browser calendar dialog */}
      <input
        type="date"
        ref={hiddenInputRef}
        value={isoValue}
        onChange={handlePickerChange}
        min={min}
        max={max}
        disabled={disabled}
        tabIndex={-1}
        aria-hidden="true"
        className="absolute inset-0 opacity-0 pointer-events-none w-0 h-0"
      />
    </div>
  );
};

export default DateInput;
