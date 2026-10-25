import {
  Area,
  AreaChart,
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
import { formatPeso } from '../../utils/format';
import { AXIS_TICK, CHART, ChartEmpty, ChartTooltip } from './palette';

const peso = (n) => formatPeso(n);
const compactPeso = (n) =>
  n >= 1000 ? `₱${Math.round(n / 100) / 10}k` : `₱${Math.round(n)}`;
const monthLabel = (key) =>
  new Date(`${key}-01T00:00:00`).toLocaleDateString('en-PH', { month: 'short' });
const monthLong = (key) =>
  new Date(`${key}-01T00:00:00`).toLocaleDateString('en-PH', { month: 'long', year: 'numeric' });

const GRID = <CartesianGrid stroke={CHART.hairline} strokeDasharray="3 4" vertical={false} />;

// Money spent per month, last six months.
export function SpendingChart({ data = [] }) {
  const hasData = data.some((d) => d.total > 0);
  if (!hasData) return <ChartEmpty>No expenses recorded in the last six months.</ChartEmpty>;
  const total = data.reduce((s, d) => s + d.total, 0);
  return (
    <div
      className="h-60"
      role="img"
      aria-label={`Spending by month, ${peso(total)} in total over the last six months`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="spendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART.azure} stopOpacity={0.28} />
              <stop offset="100%" stopColor={CHART.azure} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          {GRID}
          <XAxis
            dataKey="month"
            tickFormatter={monthLabel}
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={{ stroke: CHART.hairline }}
          />
          <YAxis
            tickFormatter={compactPeso}
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={false}
            width={52}
          />
          <Tooltip
            cursor={{ stroke: CHART.hairline }}
            content={<ChartTooltip format={peso} labelFormat={monthLong} />}
          />
          <Area
            type="monotone"
            dataKey="total"
            name="Spent"
            stroke={CHART.action}
            strokeWidth={2.5}
            fill="url(#spendFill)"
            dot={{ r: 3.5, strokeWidth: 2, fill: '#fff', stroke: CHART.action }}
            activeDot={{ r: 5 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// Budget against spending for the biggest projects. Over budget turns red.
export function BudgetBars({ data = [] }) {
  if (data.length === 0) return <ChartEmpty>Projects with a budget will appear here.</ChartEmpty>;
  const rows = data.map((d) => ({
    ...d,
    name: d.title.length > 22 ? `${d.title.slice(0, 21)}…` : d.title,
  }));
  return (
    <div
      className="h-60"
      role="img"
      aria-label={`Budget and spending for ${rows.length} projects`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={rows}
          layout="vertical"
          margin={{ top: 4, right: 12, left: 0, bottom: 0 }}
          barCategoryGap="28%"
        >
          <CartesianGrid stroke={CHART.hairline} strokeDasharray="3 4" horizontal={false} />
          <XAxis
            type="number"
            tickFormatter={compactPeso}
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={{ stroke: CHART.hairline }}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={false}
            width={140}
          />
          <Tooltip
            cursor={{ fill: CHART.track, opacity: 0.6 }}
            content={<ChartTooltip format={peso} labelFormat={(l) => l} />}
          />
          <Legend
            iconType="square"
            iconSize={10}
            wrapperStyle={{ fontSize: 13, fontFamily: 'Barlow, sans-serif', color: CHART.slate }}
          />
          <Bar dataKey="budget" name="Budget" fill={CHART.rule} radius={[0, 4, 4, 0]} />
          <Bar dataKey="spent" name="Spent" fill={CHART.azure} radius={[0, 4, 4, 0]}>
            {rows.map((r) => (
              <Cell key={r.id} fill={r.spent > r.budget ? CHART.red : CHART.azure} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

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
          <Bar dataKey="late" name="Late" stackId="a" fill={CHART.gold} />
          <Bar dataKey="excused" name="Excused" stackId="a" fill={CHART.slate} />
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
