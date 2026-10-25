// Shared look for the dashboard charts: seal palette, hairline grid, Barlow labels.
export const CHART = {
  azure: '#2F7FE6',
  action: '#1C66CC',
  navy: '#0B1F4A',
  gold: '#F2B705',
  goldDeep: '#CB8F00',
  green: '#538A1B',
  red: '#D52826',
  slate: '#627290',
  hairline: '#D8E0EE',
  track: '#E9EEF7',
  rule: '#BAC6DB',
  ink: '#0A0C10',
};

export const AXIS_TICK = { fill: '#627290', fontSize: 12, fontFamily: 'Barlow, sans-serif' };

// Tooltip card in the same style as the app's cards.
export function ChartTooltip({ active, payload, label, format = (v) => v, labelFormat }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-card">
      {label != null && (
        <p className="mb-1 font-semibold text-slate-900">{labelFormat ? labelFormat(label) : label}</p>
      )}
      <ul className="space-y-0.5">
        {payload.map((p) => (
          <li key={p.dataKey} className="flex items-center gap-2 text-slate-700">
            <span
              className="h-2.5 w-2.5 rounded-sm"
              style={{ background: p.color || p.fill }}
              aria-hidden="true"
            />
            <span>{p.name}</span>
            <span className="ml-auto pl-4 font-semibold text-slate-900">{format(p.value, p)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Shown instead of an empty axis.
export function ChartEmpty({ children }) {
  return (
    <div className="flex h-full min-h-[11rem] items-center justify-center rounded-lg bg-slate-50 px-6 text-center text-slate-600">
      {children}
    </div>
  );
}
