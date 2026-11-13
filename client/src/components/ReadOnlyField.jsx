// A value the system fills in (balances, totals, reviewer, dates): gray and read-only.
export default function ReadOnlyField({ label, value, hint, className = '', tone }) {
  const color = tone === 'bad' ? 'text-clay-text' : tone === 'good' ? 'text-sage-text' : 'text-slate-700';
  return (
    <div className={`min-w-0 ${className}`}>
      {label && <p className="label">{label}</p>}
      <div
        className={`flex min-h-[var(--control-height)] items-center rounded-control border border-line bg-slate-100 px-3 py-2 text-[15px] font-medium ${color}`}
        aria-readonly="true"
      >
        <span className="truncate">{value ?? '—'}</span>
      </div>
      {hint && <p className="mt-1 text-[13px] text-slate-600">{hint}</p>}
    </div>
  );
}
