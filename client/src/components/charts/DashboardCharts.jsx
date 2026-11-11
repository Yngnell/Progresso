import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AXIS_TICK, CHART, ChartEmpty, ChartTooltip } from './palette';

const GRID = <CartesianGrid stroke={CHART.hairline} strokeDasharray="3 4" vertical={false} />;

// Attendance for each recent session, stacked.
export function AttendanceBars({ data = [] }) {
  if (data.length === 0) return <ChartEmpty>No attendance has been recorded yet.</ChartEmpty>;
  const rows = data.map((d) => ({
    ...d,
    name: new Date(d.startAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }),
    full: d.title,
  }));
  return (
    <div
      className="h-60"
      role="img"
      aria-label={`Attendance for the last ${rows.length} sessions`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="30%">
          {GRID}
          <XAxis
            dataKey="name"
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={{ stroke: CHART.hairline }}
          />
          <YAxis
            allowDecimals={false}
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={false}
            width={28}
          />
          <Tooltip
            cursor={{ fill: CHART.track, opacity: 0.6 }}
            content={
              <ChartTooltip
                labelFormat={(l) => rows.find((r) => r.name === l)?.full || l}
              />
            }
          />
          <Legend
            iconType="square"
            iconSize={10}
            wrapperStyle={{ fontSize: 13, fontFamily: 'Barlow, sans-serif', color: CHART.slate }}
          />
          <Bar dataKey="present" name="Present" stackId="a" fill={CHART.azure} />
          <Bar dataKey="absent" name="Absent" stackId="a" fill={CHART.red} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// Donut of projects by status with the total in the middle.
export function StatusDonut({ data = [], colors, labels }) {
  const total = data.reduce((s, d) => s + d.count, 0);
  if (total === 0) return <ChartEmpty>No projects yet.</ChartEmpty>;
  return (
    <div className="flex flex-col items-center gap-4">
      <div
        className="relative h-44 w-44"
        role="img"
        aria-label={data.map((d) => `${d.count} ${labels[d.status]}`).join(', ')}
      >
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="count"
              nameKey="status"
              innerRadius="68%"
              outerRadius="100%"
              paddingAngle={2}
              stroke="none"
            >
              {data.map((d) => (
                <Cell key={d.status} fill={colors[d.status]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-4xl font-bold leading-none text-slate-900">
            {total}
          </span>
          <span className="text-sm text-slate-600">{total === 1 ? 'project' : 'projects'}</span>
        </div>
      </div>
      <ul className="grid w-full grid-cols-2 gap-x-4 gap-y-1.5">
        {data.map((d) => (
          <li key={d.status} className="flex items-center gap-2 text-slate-700">
            <span
              className="h-3 w-3 shrink-0 rounded-sm"
              style={{ background: colors[d.status] }}
              aria-hidden="true"
            />
            <span className="truncate text-sm font-medium">{labels[d.status]}</span>
            <span className="ml-auto font-display text-lg font-bold leading-none text-slate-900">
              {d.count}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
