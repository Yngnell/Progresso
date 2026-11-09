import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Download, FileSpreadsheet, FileText } from 'lucide-react';

// "Export" button with two choices: PDF and Excel.
// onExport('pdf' | 'excel') may return a promise; the button shows it is working meanwhile.
export default function ExportMenu({ onExport, disabled = false }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');
  const ref = useRef(null);

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

  async function run(kind) {
    setOpen(false);
    setError('');
    setBusy(kind);
    try {
      await onExport(kind);
    } catch (err) {
      console.error(err);
      setError(err?.response?.data?.message || 'The file could not be made. Try again.');
    } finally {
      setBusy(null);
    }
  }

  const items = [
    { kind: 'pdf', label: 'PDF', note: 'For printing and signing', Icon: FileText },
    { kind: 'excel', label: 'Excel', note: 'One sheet per section', Icon: FileSpreadsheet },
  ];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className="btn btn-primary px-4 py-2 text-[15px]"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled || busy !== null}
        onClick={() => setOpen((o) => !o)}
      >
        <Download size={18} strokeWidth={1.75} aria-hidden="true" />
        {busy ? `Making ${busy === 'pdf' ? 'PDF' : 'Excel'}…` : 'Export'}
        <ChevronDown size={16} strokeWidth={2} aria-hidden="true" />
      </button>
      {open && (
        <ul
          role="menu"
          className="absolute right-0 z-30 mt-1 min-w-[14rem] overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-cardHover"
        >
          {items.map(({ kind, label, note, Icon }) => (
            <li key={kind} role="none">
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-start gap-2.5 px-3.5 py-2.5 text-left transition-colors hover:bg-slate-50"
                onClick={() => run(kind)}
              >
                <Icon size={18} strokeWidth={1.75} className="mt-0.5 text-brand-700" aria-hidden="true" />
                <span>
                  <span className="block text-[15px] font-semibold text-slate-900">{label}</span>
                  <span className="block text-sm text-slate-600">{note}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p className="absolute right-0 mt-1 w-64 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
