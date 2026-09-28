import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import GlobalModal from '../components/common/GlobalModal';

const ModalContext = createContext(null);

// Global modal reference for non-React invocation
export const modal = {
  alert: (opts, title) => Promise.resolve(),
  confirm: (opts, title) => Promise.resolve(false),
  success: (msg, title) => Promise.resolve(),
  error: (msg, title) => Promise.resolve(),
  warning: (msg, title) => Promise.resolve(),
  info: (msg, title) => Promise.resolve(),
  close: () => {},
};

export const ModalProvider = ({ children }) => {
  const [modalState, setModalState] = useState({
    isOpen: false,
    type: 'info', // 'info' | 'success' | 'warning' | 'error'
    title: '',
    message: '',
    confirmText: 'OK',
    cancelText: 'Cancel',
    isConfirm: false,
    isDestructive: false,
  });

  const resolverRef = useRef(null);

  const closeModal = useCallback((result = false) => {
    setModalState((prev) => ({ ...prev, isOpen: false }));
    if (resolverRef.current) {
      resolverRef.current(result);
      resolverRef.current = null;
    }
  }, []);

  const openModal = useCallback((options) => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setModalState({
        isOpen: true,
        type: options.type || 'info',
        title: options.title || (options.type === 'error' ? 'Error' : options.type === 'success' ? 'Success' : 'Notice'),
        message: options.message || '',
        confirmText: options.confirmText || (options.isConfirm ? 'Confirm' : 'OK'),
        cancelText: options.cancelText || 'Cancel',
        isConfirm: !!options.isConfirm,
        isDestructive: !!options.isDestructive,
      });
    });
  }, []);

  const alert = useCallback((optionsOrMsg, title) => {
    if (typeof optionsOrMsg === 'string' || typeof optionsOrMsg === 'number') {
      const text = String(optionsOrMsg);
      let detectedType = 'info';
      let defaultTitle = title || 'Notice';

      if (/fail|error|denied|unable/i.test(text)) {
        detectedType = 'error';
        defaultTitle = title || 'Notice';
      } else if (/success|saved|created|completed|submitted/i.test(text)) {
        detectedType = 'success';
        defaultTitle = title || 'Success';
      } else if (/please|warning|caution|required|missing/i.test(text)) {
        detectedType = 'warning';
        defaultTitle = title || 'Attention Required';
      }

      return openModal({
        title: defaultTitle,
        message: text,
        type: detectedType,
        isConfirm: false,
      });
    }

    return openModal({
      ...optionsOrMsg,
      isConfirm: false,
    });
  }, [openModal]);

  const confirm = useCallback((optionsOrMsg, title) => {
    if (typeof optionsOrMsg === 'string') {
      const isDelete = /delete|remove|discard/i.test(optionsOrMsg);
      return openModal({
        title: title || (isDelete ? 'Confirm Deletion' : 'Please Confirm'),
        message: optionsOrMsg,
        type: isDelete ? 'error' : 'warning',
        isConfirm: true,
        isDestructive: isDelete,
        confirmText: isDelete ? 'Delete' : 'Confirm',
        cancelText: 'Cancel',
      });
    }

    return openModal({
      ...optionsOrMsg,
      isConfirm: true,
    });
  }, [openModal]);

  const success = useCallback((msg, title = 'Success') => {
    return alert({ title, message: msg, type: 'success' });
  }, [alert]);

  const error = useCallback((msg, title = 'Error') => {
    return alert({ title, message: msg, type: 'error' });
  }, [alert]);

  const warning = useCallback((msg, title = 'Warning') => {
    return alert({ title, message: msg, type: 'warning' });
  }, [alert]);

  const info = useCallback((msg, title = 'Information') => {
    return alert({ title, message: msg, type: 'info' });
  }, [alert]);

  // Bind global singleton and override browser window.alert
  useEffect(() => {
    modal.alert = alert;
    modal.confirm = confirm;
    modal.success = success;
    modal.error = error;
    modal.warning = warning;
    modal.info = info;
    modal.close = closeModal;
  }, [alert, confirm, success, error, warning, info, closeModal]);

  return (
    <ModalContext.Provider
      value={{
        alert,
        confirm,
        success,
        error,
        warning,
        info,
        closeModal,
      }}
    >
      {children}
      <GlobalModal
        isOpen={modalState.isOpen}
        type={modalState.type}
        title={modalState.title}
        message={modalState.message}
        confirmText={modalState.confirmText}
        cancelText={modalState.cancelText}
        isConfirm={modalState.isConfirm}
        isDestructive={modalState.isDestructive}
        onConfirm={() => closeModal(true)}
        onCancel={() => closeModal(false)}
      />
    </ModalContext.Provider>
  );
};

export const useModal = () => {
  const context = useContext(ModalContext);
  if (!context) {
    // Fallback to global singleton if called outside Provider
    return modal;
  }
  return context;
};

export default ModalContext;
