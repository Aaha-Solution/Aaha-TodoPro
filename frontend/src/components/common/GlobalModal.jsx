import React, { useEffect, useRef } from 'react';
import { 
  CheckCircle2, 
  AlertTriangle, 
  AlertOctagon, 
  Info, 
  X 
} from 'lucide-react';

/**
 * Universal Global Modal Component
 * Replaces browser default alerts and confirms with modern, accessible, styled dialogs.
 */
const GlobalModal = ({
  isOpen,
  type = 'info', // 'info' | 'success' | 'warning' | 'error'
  title,
  message,
  confirmText = 'OK',
  cancelText = 'Cancel',
  isConfirm = false,
  isDestructive = false,
  onConfirm,
  onCancel,
}) => {
  const confirmBtnRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      // Auto-focus confirm button on open
      setTimeout(() => {
        confirmBtnRef.current?.focus();
      }, 50);

      const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          onCancel && onCancel();
        } else if (e.key === 'Enter' && !isConfirm) {
          e.preventDefault();
          onConfirm && onConfirm();
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, isConfirm, onConfirm, onCancel]);

  if (!isOpen) return null;

  // Configuration for modal types
  const config = {
    success: {
      icon: CheckCircle2,
      iconBg: 'bg-emerald-50 text-emerald-600 border-emerald-200',
      badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      badgeText: 'SUCCESS',
      btnBg: 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white shadow-emerald-600/25',
    },
    error: {
      icon: AlertOctagon,
      iconBg: 'bg-rose-50 text-rose-600 border-rose-200',
      badgeBg: 'bg-rose-50 text-rose-700 border-rose-200',
      badgeText: 'ERROR',
      btnBg: 'bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white shadow-rose-600/25',
    },
    warning: {
      icon: AlertTriangle,
      iconBg: 'bg-amber-50 text-amber-600 border-amber-200',
      badgeBg: 'bg-amber-50 text-amber-700 border-amber-200',
      badgeText: 'WARNING',
      btnBg: isDestructive 
        ? 'bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white shadow-rose-600/25' 
        : 'bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white shadow-amber-600/25',
    },
    info: {
      icon: Info,
      iconBg: 'bg-blue-50 text-blue-600 border-blue-200',
      badgeBg: 'bg-blue-50 text-blue-700 border-blue-200',
      badgeText: 'NOTICE',
      btnBg: 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white shadow-blue-600/25',
    },
  }[type] || {
    icon: Info,
    iconBg: 'bg-slate-50 text-slate-600 border-slate-200',
    badgeBg: 'bg-slate-50 text-slate-700 border-slate-200',
    badgeText: 'NOTICE',
    btnBg: 'bg-slate-900 hover:bg-slate-800 text-white shadow-slate-900/25',
  };

  const IconComponent = config.icon;

  // Split lines for multi-line formatting
  const formattedLines = typeof message === 'string' ? message.split('\n') : [message];

  return (
    <div 
      className="fixed inset-0 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
      style={{ zIndex: 999999 }}
      onClick={onCancel}
    >
      <div 
        className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-slate-100 p-6 space-y-5 animate-in zoom-in-95 duration-200 relative overflow-hidden"
        style={{ zIndex: 1000000 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Top subtle decorative color strip */}
        <div 
          className={`absolute top-0 left-0 right-0 h-1.5 ${
            type === 'success' ? 'bg-emerald-500' :
            type === 'error' ? 'bg-rose-500' :
            type === 'warning' ? 'bg-amber-500' : 'bg-blue-500'
          }`} 
        />

        {/* Modal Header */}
        <div className="flex items-start justify-between gap-3 pt-1">
          <div className="flex items-center gap-3.5">
            <div className={`p-3 rounded-2xl border ${config.iconBg} shadow-sm shrink-0`}>
              <IconComponent className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div>
              <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-extrabold tracking-wider border font-mono mb-1 ${config.badgeBg}`}>
                {config.badgeText}
              </span>
              <h3 className="text-lg font-extrabold text-slate-900 tracking-tight leading-snug">
                {title}
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onCancel}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Message Content */}
        <div className="text-sm text-slate-600 leading-relaxed space-y-1.5 max-h-60 overflow-y-auto px-0.5">
          {formattedLines.map((line, idx) => {
            if (!line.trim()) {
              return <div key={idx} className="h-2" />;
            }
            const isBullet = line.startsWith('✓') || line.startsWith('•') || line.startsWith('-');
            return (
              <p 
                key={idx} 
                className={`${isBullet ? 'flex items-start gap-2 font-medium text-slate-700' : ''}`}
              >
                {line}
              </p>
            );
          })}
        </div>

        {/* Actions Footer */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
          {isConfirm && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 active:bg-slate-200 transition-all border border-slate-200/80 shadow-xs"
            >
              {cancelText}
            </button>
          )}

          <button
            ref={confirmBtnRef}
            type="button"
            onClick={onConfirm}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 flex items-center justify-center gap-1.5 ${config.btnBg}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default GlobalModal;
