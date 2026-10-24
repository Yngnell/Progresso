import { useEffect, useRef, useState } from 'react';
import { MoreHorizontal } from 'lucide-react';

// A "More" menu for the quiet, risky actions (cancel, delete) so they do not compete with
// the main ones. items: [{ label, Icon, onClick, danger, disabled }]
export default function OverflowMenu({ items, label = 'More actions', className = '' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Close on outside click and on Escape
  useEffect(() => {
    if (!open) return undefined;
    const onClick = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const visible = items.filter(Boolean);
  if (visible.length === 0) return null;

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        className="btn btn-secondary px-2.5 py-2"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        title={label}
        onClick={() => setOpen((o) => !o)}
      >
        <MoreHorizontal size={18} strokeWidth={1.75} aria-hidden="true" />
      </button>
      {open && (
        <ul
          role="menu"
          className="absolute right-0 z-30 mt-1 min-w-[12rem] overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-cardHover"
        >
          {visible.map((item) => (
            <li key={item.label} role="none">
              <button
                type="button"
                role="menuitem"
                disabled={item.disabled}
                className={`flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[15px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                  item.danger
                    ? 'text-red-700 hover:bg-red-50'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
                onClick={() => {
                  setOpen(false);
                  item.onClick();
                }}
              >
                {item.Icon && <item.Icon size={17} strokeWidth={1.75} aria-hidden="true" />}
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
