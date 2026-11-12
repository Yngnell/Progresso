import { Card } from './ui';

const METER = {
  azure: 'bg-pine',
  green: 'bg-sage',
  gold: 'bg-mustard',
  red: 'bg-clay',
};

// One key number: label, big figure, a short supporting line and an optional 0-100 meter.
export default function KpiCard({ label, value, note, meter, tone = 'azure' }) {
  const pct = meter == null ? null : Math.max(0, Math.min(100, meter));
  return (
    <Card className="p-5">
      <p className="section-label">{label}</p>
      <p className="mt-3 font-display text-[40px] leading-none text-ink">{value}</p>
      {pct != null && (
        <div
          className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100"
          role="progressbar"
          aria-label={label}
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className={`h-full rounded-full ${METER[tone]}`} style={{ width: `${pct}%` }} />
        </div>
      )}
      {note && <p className="mt-2 text-sm text-slate-600">{note}</p>}
    </Card>
  );
}
