import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';
import { statsApi } from '../../api/stats';
import { Card } from '../../components/ui';
import { PROJECT_STATUS, formatPeso } from '../../utils/format';

const STATUS_COLORS = {
  PROPOSED: '#94a3b8',
  PLANNING: '#6366f1',
  ONGOING: '#f59e0b',
  COMPLETED: '#22c55e',
  CANCELLED: '#ef4444',
};

function StatCard({ label, value, icon, tone = 'brand' }) {
  const tones = {
    brand: 'from-brand-500 to-brand-700',
    accent: 'from-accent-400 to-accent-600',
    green: 'from-green-500 to-green-700',
    slate: 'from-slate-500 to-slate-700',
  };
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-4 p-5">
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${tones[tone]} text-2xl text-white`}
        >
          {icon}
        </div>
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p className="text-2xl font-bold text-slate-800">{value}</p>
        </div>
      </div>
    </Card>
  );
}

export default function Dashboard() {
  const { data } = useQuery({
    queryKey: ['stats'],
    queryFn: statsApi.get,
  });
  const s = data?.stats || {};

  const chartData = (s.byStatus || []).map((row) => ({
    name: PROJECT_STATUS[row.status]?.label || row.status,
    value: row.count,
    color: STATUS_COLORS[row.status] || '#94a3b8',
  }));
  const hasChartData = chartData.reduce((sum, d) => sum + d.value, 0) > 0;

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
      <p className="mt-1 text-sm text-slate-500">
        Overview of your SK's programs and community.
      </p>

      {/* Stat cards */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Projects" value={s.totalProjects ?? '—'} icon="📁" />
        <StatCard
          label="Ongoing"
          value={s.ongoingProjects ?? '—'}
          icon="⚙️"
          tone="accent"
        />
        <StatCard
          label="Total Budget"
          value={s.totalBudget != null ? formatPeso(s.totalBudget) : '—'}
          icon="💰"
          tone="green"
        />
        <StatCard
          label="Registered Viewers"
          value={s.totalViewers ?? '—'}
          icon="🙋"
          tone="slate"
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Project status chart */}
        <Card className="p-6 lg:col-span-2">
          <h2 className="text-base font-semibold text-slate-800">
            Projects by Status
          </h2>
          {hasChartData ? (
            <div className="mt-4 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    label
                  >
                    {chartData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-400">
              No projects yet. Add projects to see this chart.
            </p>
          )}
        </Card>

        {/* Quick stats / activity */}
        <Card className="p-6">
          <h2 className="text-base font-semibold text-slate-800">At a glance</h2>
          <ul className="mt-4 space-y-3 text-sm">
            <li className="flex items-center justify-between">
              <span className="text-slate-500">Completed projects</span>
              <span className="font-semibold text-slate-800">
                {s.completedProjects ?? 0}
              </span>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-slate-500">Active officials</span>
              <span className="font-semibold text-slate-800">
                {s.totalOfficials ?? 0}
              </span>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-slate-500">Published news</span>
              <span className="font-semibold text-slate-800">
                {s.totalNews ?? 0}
              </span>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-slate-500">Upcoming events</span>
              <span className="font-semibold text-slate-800">
                {s.upcomingEvents ?? 0}
              </span>
            </li>
          </ul>

          <div className="mt-6 border-t border-slate-100 pt-4">
            <p className="text-xs font-medium text-slate-400">Quick links</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Link
                to="/admin/officials"
                className="rounded-lg bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-100"
              >
                Manage Officials
              </Link>
              <Link
                to="/admin/news"
                className="rounded-lg bg-accent-50 px-3 py-1.5 text-xs font-medium text-accent-700 hover:bg-accent-100"
              >
                Post News
              </Link>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

