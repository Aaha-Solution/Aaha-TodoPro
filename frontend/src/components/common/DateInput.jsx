import React, { useState, useEffect, useRef } from 'react';
import { Calendar } from 'lucide-react';
import { formatDateDDMMYYYY, parseDateToYYYYMMDD } from '../../utils/dateUtils';

/**
 * Universal DateInput Component
 * Guarantees DD/MM/YYYY display across all operating systems and browsers,
 * eliminating the OS-dependent MM/DD/YYYY vs DD/MM/YYYY discrepancy.
 * 
 * Automatically synchronizes with standard YYYY-MM-DD for form state and backend storage.
 * Seamlessly supports iOS Safari (iPhone), Android Mobile, and Desktop browsers.
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
  const [isMobileTouch, setIsMobileTouch] = useState(false);
  const hiddenInputRef = useRef(null);

  // Detect primary touch devices (phones/tablets) without misclassifying Windows touch laptops using a mouse
  useEffect(() => {
    const checkMobileTouch = () => {
      if (typeof window === 'undefined') return false;
      if (window.matchMedia) {
        return window.matchMedia('(pointer: coarse) and (hover: none)').matches;
      }
      return 'ontouchstart' in window && navigator.maxTouchPoints > 0;
    };
    setIsMobileTouch(checkMobileTouch());
  }, []);

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
      const minIso = min ? parseDateToYYYYMMDD(min) : '';
      const maxIso = max ? parseDateToYYYYMMDD(max) : '';
      if (minIso && selectedIso < minIso) return;
      if (maxIso && selectedIso > maxIso) return;
      setDisplayText(formatDateDDMMYYYY(selectedIso));
      triggerChange(selectedIso);
    } else {
      setDisplayText('');
      triggerChange('');
    }
  };

  // Called when user manually types into the input (desktop)
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
        const minIso = min ? parseDateToYYYYMMDD(min) : '';
        const maxIso = max ? parseDateToYYYYMMDD(max) : '';
        if (minIso && iso < minIso) {
          const fallback = (value && value >= minIso) ? value : minIso;
          setDisplayText(formatDateDDMMYYYY(fallback));
          triggerChange(fallback);
          return;
        }
        if (maxIso && iso > maxIso) {
          const fallback = (value && value <= maxIso) ? value : maxIso;
          setDisplayText(formatDateDDMMYYYY(fallback));
          triggerChange(fallback);
          return;
        }
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

  const openPicker = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (disabled || !hiddenInputRef.current) return;
    try {
      if (typeof hiddenInputRef.current.showPicker === 'function') {
        hiddenInputRef.current.showPicker();
      } else {
        hiddenInputRef.current.focus();
        hiddenInputRef.current.click();
      }
    } catch {
      hiddenInputRef.current.focus();
      hiddenInputRef.current.click();
    }
  };

  const supportsShowPicker =
    typeof HTMLInputElement !== 'undefined' &&
    typeof HTMLInputElement.prototype.showPicker === 'function';
  const useButtonTrigger = !isMobileTouch && supportsShowPicker;

  const parsedMin = min ? parseDateToYYYYMMDD(min) : undefined;
  const parsedMax = max ? parseDateToYYYYMMDD(max) : undefined;

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
        readOnly={isMobileTouch || props.readOnly}
        className={`${className} pr-10 font-mono tracking-wide`}
        {...props}
      />

      {/* Calendar picker trigger button */}
      <button
        type="button"
        disabled={disabled}
        onClick={openPicker}
        tabIndex={-1}
        aria-label="Open calendar"
        className={`absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg text-slate-400 group-hover:text-blue-600 hover:text-blue-600 hover:bg-blue-50 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center ${
          useButtonTrigger ? 'z-20' : 'z-10 pointer-events-none'
        }`}
        title="Open calendar"
      >
        <Calendar className="w-4 h-4 pointer-events-none" />
      </button>

      {/* Native date input:
          - On modern desktop: sits underneath with pointer-events-none and opens via button onClick -> showPicker().
          - On mobile touch (or legacy browsers without showPicker): .date-picker-overlay expands the native
            calendar picker indicator across 100% of the element so tapping anywhere on it opens immediately.
      */}
      <input
        type="date"
        ref={hiddenInputRef}
        value={isoValue}
        onChange={handlePickerChange}
        min={parsedMin}
        max={parsedMax}
        disabled={disabled}
        tabIndex={-1}
        aria-hidden="true"
        className={`date-picker-overlay absolute opacity-0 ${
          isMobileTouch
            ? 'inset-0 w-full h-full z-20 cursor-pointer'
            : useButtonTrigger
            ? 'right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 z-0 pointer-events-none'
            : 'right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 z-20 cursor-pointer'
        }`}
      />
    </div>
  );
};

export default DateInput;
