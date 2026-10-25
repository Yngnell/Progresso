import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, CircleCheck, ClipboardCheck, Plus } from 'lucide-react';
import { statsApi } from '../../api/stats';
import { projectsApi } from '../../api/projects';
import { eventsApi } from '../../api/events';
import { useAuth } from '../../context/AuthContext';
import { Button, Card } from '../../components/ui';
import { PROJECT_STATUS, formatPeso, formatDateTime } from '../../utils/format';
import { ProgressBar, totalSpent } from '../../components/ProjectCard';
import { ProgressRoundel, ScheduleWords, StatusRibbon } from '../../components/Roundel';
import DateTile from '../../components/DateTile';
import EventTypeIcon from '../../components/EventTypeIcon';
import KpiCard from '../../components/KpiCard';
import {
  AttendanceBars,
  BudgetBars,
  SpendingChart,
  StatusDonut,
} from '../../components/charts/DashboardCharts';
import { CHART } from '../../components/charts/palette';

// Same colours as the status ribbons, so the donut and the ribbons read as one system.
const STATUS_COLOR = {
  PROPOSED: CHART.slate,
  PLANNING: CHART.azure,
  ONGOING: CHART.gold,
  COMPLETED: CHART.green,
  CANCELLED: CHART.red,
};
const STATUS_ORDER = ['PROPOSED', 'PLANNING', 'ONGOING', 'COMPLETED', 'CANCELLED'];
const STATUS_LABEL = Object.fromEntries(STATUS_ORDER.map((k) => [k, PROJECT_STATUS[k].label]));

const DAY = 24 * 60 * 60 * 1000;

// Projects an official should look at first: behind schedule, past their end date and not yet
// completed, or ending within 3 days.
function needsAttention(projects) {
  const now = Date.now();
  const ended = (p) => (p.endDate && new Date(p.endDate).getTime() <= now ? 0 : 1);
  return projects
    .filter((p) => {
      if (p.status !== 'ONGOING') return false;
      const s = p.progressBreakdown?.schedule;
      const endsSoon = p.endDate && new Date(p.endDate).getTime() - now <= 3 * DAY;
      return s === 'BEHIND' || endsSoon;
    })
    .sort((a, b) => ended(a) - ended(b) || new Date(a.endDate) - new Date(b.endDate));
}

function Panel({ title, action, children, className = '' }) {
  return (
    <Card className={`p-5 sm:p-6 ${className}`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-slate-900">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </Card>
  );
}

function PanelLink({ to, children }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:text-brand-800"
    >
      {children} <ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" />
    </Link>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const isChairman = user?.role === 'CHAIRMAN';

  const { data } = useQuery({ queryKey: ['stats'], queryFn: statsApi.get });
  const { data: projectsData } = useQuery({
    queryKey: ['projects', 'admin'],
    queryFn: () => projectsApi.list({}),
  });
  const { data: eventsData } = useQuery({
    queryKey: ['events', 'upcoming'],
    queryFn: () => eventsApi.list({ upcoming: 'true' }),
  });

  const s = data?.stats || {};
  const a = s.analytics || {};
  const projects = projectsData?.projects || [];
  const attention = needsAttention(projects);
  const upcoming = (eventsData?.events || []).slice(0, 5);
  const recent = projects.slice(0, 6);

  const statusData = STATUS_ORDER.map((k) => ({
    status: k,
    count: (s.byStatus || []).find((row) => row.status === k)?.count || 0,
  })).filter((d) => d.count > 0);
  const awaiting = (s.pendingApproval || 0) + (s.pendingDeletions || 0);
  const spentAll = s.totalSpent ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-bold uppercase tracking-wide text-slate-900">
            Dashboard
          </h1>
          <p className="mt-0.5 text-slate-600">How your projects, budget and sessions are doing.</p>
        </div>
        {isChairman ? (
          <Link to="/admin/proposals">
            <Button variant="primary">
              <ClipboardCheck size={18} strokeWidth={1.75} aria-hidden="true" />
              Review approvals
            </Button>
          </Link>
        ) : (
          <Link to="/admin/projects">
            <Button variant="accent">
              <Plus size={18} strokeWidth={2} aria-hidden="true" />
              Add Project
            </Button>
          </Link>
        )}
      </div>

      {/* Chairman: proposals waiting for a decision */}
      {isChairman && awaiting > 0 && (
        <Link
          to="/admin/proposals"
          className="flex items-center justify-between gap-4 rounded-xl border border-accent-300 bg-accent-100 px-5 py-4 text-accent-900 transition-colors hover:bg-accent-200"
        >
          <span className="font-semibold">
            {[
              s.pendingApproval > 0 &&
                `${s.pendingApproval} ${s.pendingApproval === 1 ? 'proposal' : 'proposals'}`,
              s.pendingDeletions > 0 &&
                `${s.pendingDeletions} deletion ${s.pendingDeletions === 1 ? 'request' : 'requests'}`,
            ]
              .filter(Boolean)
              .join(' and ')}{' '}
            awaiting your decision
          </span>
          <span className="inline-flex items-center gap-1 text-sm font-semibold">
            Review <ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" />
          </span>
        </Link>
      )}

      {/* Key numbers */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          label="Active projects"
          value={a.activeProjects ?? '—'}
          note={`of ${s.totalProjects ?? 0} in total`}
        />
        <KpiCard
          label="Budget used"
          value={a.budgetUsedRate != null ? `${a.budgetUsedRate}%` : '—'}
          note={`${formatPeso(spentAll)} of ${formatPeso(s.totalBudget || 0)}`}
          meter={a.budgetUsedRate}
          tone={a.budgetUsedRate > 100 ? 'red' : 'azure'}
        />
        <KpiCard
          label="Completion rate"
          value={a.completionRate != null ? `${a.completionRate}%` : '—'}
          note={`${s.completedProjects ?? 0} completed`}
          meter={a.completionRate}
          tone="green"
        />
        <KpiCard
          label="Attendance rate"
          value={a.attendance?.rate != null ? `${a.attendance.rate}%` : '—'}
          note={
            a.attendance?.recorded
              ? `${a.attendance.present + a.attendance.late} of ${a.attendance.recorded} present or late`
              : 'No attendance recorded yet'
          }
          meter={a.attendance?.rate}
          tone="gold"
        />
      </div>

      {/* Trends */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="Spending by month" className="lg:col-span-2">
          <SpendingChart data={a.monthlySpending} />
        </Panel>
        <Panel title="Projects by status">
          <StatusDonut data={statusData} colors={STATUS_COLOR} labels={STATUS_LABEL} />
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Budget vs spent">
          <BudgetBars data={a.spendByProject} />
        </Panel>
        <Panel
          title="Attendance by session"
          action={<PanelLink to="/admin/attendance">Attendance</PanelLink>}
        >
          <AttendanceBars data={a.sessionAttendance} />
        </Panel>
      </div>

      {/* What needs the officials' attention, then the sessions coming up */}
      <div className="grid items-start gap-6 lg:grid-cols-3">
        <Panel title="Needs attention" className="lg:col-span-2">
          {attention.length === 0 ? (
            <div className="flex items-center gap-3 rounded-lg bg-green-50 px-4 py-5 text-green-800">
              <CircleCheck size={24} strokeWidth={1.75} aria-hidden="true" />
              <p className="font-semibold">
                Every ongoing project is on track. Nothing is behind schedule or ending within 3 days.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {attention.map((p) => (
                <li key={p.id}>
                  <Link
                    to={`/admin/projects/${p.id}`}
                    className="-mx-2 flex items-center gap-4 rounded-lg px-2 py-3 transition-colors hover:bg-slate-50"
                  >
                    <ProgressRoundel value={p.progress} breakdown={p.progressBreakdown} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-base font-bold text-slate-900">
                        {p.title}
                      </span>
                      <span className="block text-sm text-slate-600">
                        {p.endDate && new Date(p.endDate) <= new Date() ? 'Ended' : 'Due'}{' '}
                        {formatDateTime(p.endDate)}
                      </span>
                    </span>
                    <ScheduleWords breakdown={p.progressBreakdown} className="hidden sm:inline-flex" />
                    <ArrowRight
                      size={18}
                      strokeWidth={1.75}
                      className="shrink-0 text-slate-400"
                      aria-hidden="true"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Upcoming sessions" action={<PanelLink to="/admin/calendar">Calendar</PanelLink>}>
          {upcoming.length === 0 ? (
            <p className="py-4 text-slate-600">No sessions are scheduled.</p>
          ) : (
            <ul className="space-y-3">
              {upcoming.map((e) => (
                <li key={e.id}>
                  <Link
                    to={`/admin/calendar/${e.id}`}
                    className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-slate-50"
                  >
                    <DateTile date={e.startAt} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 truncate font-semibold text-slate-900">
                        <EventTypeIcon type={e.type} size={15} className="text-brand-600" />
                        <span className="truncate">{e.title}</span>
                      </span>
                      <span className="block text-sm text-slate-600">
                        {formatDateTime(e.startAt)}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {/* Recent projects */}
      <Panel title="Recent projects" action={<PanelLink to="/admin/projects">Manage</PanelLink>}>
        {recent.length === 0 ? (
          <p className="text-slate-600">
            No projects yet.
            {!isChairman && (
              <>
                {' '}
                <Link to="/admin/projects" className="font-semibold text-brand-700">
                  Add your first project
                </Link>
                .
              </>
            )}
          </p>
        ) : (
          <>
            {/* Wide screens: a table with the figures lined up */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-200 text-sm text-slate-600">
                    <th className="py-2 pr-4 font-semibold">Project</th>
                    <th className="w-56 py-2 pr-4 font-semibold">Progress</th>
                    <th className="py-2 pr-4 text-right font-semibold">Budget</th>
                    <th className="py-2 text-right font-semibold">Spent</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recent.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="py-3 pr-4">
                        <Link
                          to={`/admin/projects/${p.id}`}
                          className="block font-bold text-slate-900 hover:text-brand-700"
                        >
                          {p.title}
                        </Link>
                        <StatusRibbon status={p.status} className="mt-1" />
                      </td>
                      <td className="py-3 pr-4">
                        <ProgressBar value={p.progress} breakdown={p.progressBreakdown} />
                      </td>
                      <td className="py-3 pr-4 text-right font-semibold text-slate-900">
                        {formatPeso(p.budget)}
                      </td>
                      <td className="py-3 text-right font-semibold text-slate-900">
                        {formatPeso(totalSpent(p))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Phones: the same facts stacked */}
            <ul className="divide-y divide-slate-100 md:hidden">
              {recent.map((p) => (
                <li key={p.id} className="py-4">
                  <Link to={`/admin/projects/${p.id}`} className="block">
                    <span className="flex items-start justify-between gap-3">
                      <span className="font-bold text-slate-900">{p.title}</span>
                      <StatusRibbon status={p.status} />
                    </span>
                    <ProgressBar
                      value={p.progress}
                      breakdown={p.progressBreakdown}
                      className="mt-3"
                    />
                    <span className="mt-2 flex justify-between text-sm text-slate-600">
                      <span>Budget {formatPeso(p.budget)}</span>
                      <span>Spent {formatPeso(totalSpent(p))}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </Panel>
    </div>
  );
}
