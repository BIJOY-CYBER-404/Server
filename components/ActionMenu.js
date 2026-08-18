import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

// Renders the dropdown into document.body instead of inline, positioned by
// the trigger button's actual screen coordinates. This is necessary because
// .table-wrap has overflow-x: auto for horizontal scrolling — and per the
// CSS overflow spec, setting one axis to a non-visible value forces the
// other axis to clip too. A plain position:absolute dropdown nested inside
// that container gets cut off (often invisible) for most rows. Portaling
// past the clipping ancestor and positioning with `fixed` sidesteps this
// entirely, regardless of table width, scroll position, or row count.
export default function ActionMenu({ isOpen, onClose, anchorEl, children }) {
  const [pos, setPos] = useState(null);

  useEffect(() => {
    if (!isOpen || !anchorEl) {
      setPos(null);
      return;
    }
    const MENU_WIDTH = 260;
    const rect = anchorEl.getBoundingClientRect();
    let left = rect.right - MENU_WIDTH;
    if (left < 8) left = 8;
    const maxLeft = window.innerWidth - MENU_WIDTH - 8;
    if (left > maxLeft) left = maxLeft;
    setPos({ top: rect.bottom + 6, left });
  }, [isOpen, anchorEl]);

  useEffect(() => {
    if (!isOpen) return;
    function close() {
      onClose();
    }
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !pos || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="action-menu open"
      style={{ position: 'fixed', top: pos.top, left: pos.left, right: 'auto' }}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>,
    document.body
  );
}
