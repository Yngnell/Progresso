// Shared look for the dashboard charts: notebook palette, hairline grid, Lexend labels.
export const CHART = {
  // Keys kept from the old palette so the charts keep working; values are the notebook's.
  azure: '#1F4D3A', // pine
  action: '#1F4D3A',
  navy: '#23211E', // ink
  gold: '#E0A93B', // mustard
  goldDeep: '#B88523',
  green: '#7F9A7A', // sage
  red: '#C8643B', // clay
  slate: '#A39A8B',
  hairline: '#E2D9C8', // line
  track: '#F1EBDF',
  rule: '#CFC4AF',
  ink: '#23211E',
};

export const AXIS_TICK = { fill: '#6B655C', fontSize: 13, fontFamily: 'Lexend, sans-serif' };

// Tooltip card in the same style as the app's cards.
export function ChartTooltip({ active, payload, label, format = (v) => v, labelFormat }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-control border border-line bg-panel px-3 py-2 text-sm">
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
    <div className="flex h-full min-h-[11rem] items-center justify-center rounded-control border border-dashed border-line bg-paper px-6 text-center text-slate-600">
      {children}
    </div>
  );
}
