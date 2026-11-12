// A small planner leaf: the month in clay over the day in serif numerals.
export default function DateTile({ date, className = '' }) {
  const d = new Date(date);
  return (
    <div
      className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-control border border-line bg-panel ${className}`}
      aria-hidden="true"
    >
      <span className="text-[13px] font-medium uppercase leading-none tracking-wider text-clay-text">
        {d.toLocaleDateString('en-PH', { month: 'short' })}
      </span>
      <span className="mt-1 font-display text-2xl leading-none text-ink">{d.getDate()}</span>
    </div>
  );
}
