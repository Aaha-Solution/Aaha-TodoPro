import { useEffect } from 'react';

/**
 * Locks background document/body scroll when isLocked is true.
 * Uses a reference counter on document.body so stacked/nested modals
 * don't prematurely unlock the background when an inner modal closes.
 */
export const useScrollLock = (isLocked = true) => {
  useEffect(() => {
    if (!isLocked) return;

    const body = document.body;
    const html = document.documentElement;

    const count = parseInt(body.getAttribute('data-scroll-lock-count') || '0', 10);
    body.setAttribute('data-scroll-lock-count', String(count + 1));

    if (count === 0) {
      body.style.overflow = 'hidden';
      html.style.overflow = 'hidden';
    }

    return () => {
      const remaining = Math.max(0, parseInt(body.getAttribute('data-scroll-lock-count') || '1', 10) - 1);
      if (remaining === 0) {
        body.removeAttribute('data-scroll-lock-count');
        body.style.overflow = '';
        html.style.overflow = '';
      } else {
        body.setAttribute('data-scroll-lock-count', String(remaining));
      }
    };
  }, [isLocked]);
};

export default useScrollLock;

