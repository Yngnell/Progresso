// A small wall-calendar leaf: the day in large condensed numerals over the month.
export default function DateTile({ date, className = '' }) {
  const d = new Date(date);
  return (
    <div
      className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-lg bg-brand-900 text-white ${className}`}
      aria-hidden="true"
    >
      <span className="font-display text-2xl font-bold leading-none">{d.getDate()}</span>
      <span className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-brand-200">
        {d.toLocaleDateString('en-PH', { month: 'short' })}
      </span>
    </div>
  );
}
