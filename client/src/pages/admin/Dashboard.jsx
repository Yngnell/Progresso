import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { reportsApi } from '../../api/reports';
import { settingsApi } from '../../api/settings';
import ExportMenu from '../../components/ExportMenu';
import { exportDashboardExcel, exportDashboardPdf } from '../../utils/reportExport';
import { ArrowRight, CircleCheck, ClipboardCheck } from 'lucide-react';
import { statsApi } from '../../api/stats';
import { projectsApi } from '../../api/projects';
import { eventsApi } from '../../api/events';
import { useAuth } from '../../context/AuthContext';
import { isAdmin } from '../../utils/roles';
import { Button, Card } from '../../components/ui';
import { PROJECT_STATUS, formatPeso, formatDateTime } from '../../utils/format';
import { STAGES, StageSteps, StatusRibbon } from '../../components/Roundel';
import DateTile from '../../components/DateTile';
import EventTypeIcon from '../../components/EventTypeIcon';
import KpiCard from '../../components/KpiCard';
import {
  AttendanceBars,
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
  ON_HOLD: CHART.navy,
};
const STATUS_ORDER = ['PROPOSED', 'PLANNING', 'ONGOING', 'ON_HOLD', 'COMPLETED', 'CANCELLED'];
const STATUS_LABEL = Object.fromEntries(STATUS_ORDER.map((k) => [k, PROJECT_STATUS[k].label]));

const DAY = 24 * 60 * 60 * 1000;

// Ongoing projects an official should look at first: past their end date and not yet
// completed, or ending within 3 days.
function needsAttention(projects) {
  const now = Date.now();
  const ended = (p) => (p.endDate && new Date(p.endDate).getTime() <= now ? 0 : 1);
  return projects
    .filter((p) => p.status === 'ONGOING' && p.endDate && new Date(p.endDate).getTime() - now <= 3 * DAY)
    .sort((a, b) => ended(a) - ended(b) || new Date(a.endDate) - new Date(b.endDate));
}

// pdfChart: this panel's chart is captured as a picture in the Dashboard PDF export.
function Panel({ title, action, children, className = '', pdfChart = false }) {
  return (
    <Card className={`p-5 sm:p-6 ${className}`} data-pdf-chart={pdfChart ? '' : undefined}>
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

// "Sort by Project", From / To dates and Export Analytics. The export covers the chosen
// project (or all of them) and dates; the charts are captured as shown on the Dashboard.
function DashboardExport({ user, projects, projectId, onProject }) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const badRange = from && to && from > to;

  async function onExport(kind) {
    const [report, { settings }] = await Promise.all([
      reportsApi.dashboard({ from: from || undefined, to: to || undefined, projectId: projectId || undefined }),
      settingsApi.get(),
    ]);
    if (kind === 'pdf') {
      const chartNodes = Array.from(document.querySelectorAll('[data-pdf-chart]'));
      await exportDashboardPdf({ report, settings, user, chartNodes });
    } else {
      await exportDashboardExcel({ report, settings, user });
    }
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <label>
        <span className="label">Sort by Project</span>
        <select className="input w-56" value={projectId} onChange={(e) => onProject(e.target.value)}>
          <option value="">All Projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className="label">From</span>
        <input type="date" className="input w-40" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
      </label>
      <label>
        <span className="label">To</span>
        <input type="date" className="input w-40" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
      </label>
      <ExportMenu label="Export Analytics" onExport={onExport} disabled={Boolean(badRange)} />
      {badRange && <p className="w-full text-sm font-medium text-red-700">"From" must be on or before "To".</p>}
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const isChairman = user?.role === 'CHAIRMAN';
  const canManage = isAdmin(user);

  // "Sort by Project": '' shows every project; an id narrows the cards, charts and lists.
  const [projectId, setProjectId] = useState('');
  const { data } = useQuery({
    queryKey: ['stats', projectId || 'all'],
    queryFn: () => statsApi.get(projectId ? { projectId } : undefined),
  });
  const { data: projectsData } = useQuery({
    queryKey: ['projects', 'all'],
    queryFn: () => projectsApi.list({ archive: 'all' }),
  });
  const { data: eventsData } = useQuery({
    queryKey: ['events', 'upcoming'],
    queryFn: () => eventsApi.list({ upcoming: 'true' }),
  });

  const s = data?.stats || {};
  const a = s.analytics || {};
  const allProjects = projectsData?.projects || [];
  const selected = projectId ? allProjects.find((p) => p.id === projectId) : null;
  const projects = selected ? [selected] : allProjects;
  const attention = needsAttention(projects);
  const upcoming = (eventsData?.events || [])
    .filter((e) => !selected || e.relatedProjectId === selected.id)
    .slice(0, 5);
  const recent = projects.slice(0, 6);

  const statusData = STATUS_ORDER.map((k) => ({
    status: k,
    count: (s.byStatus || []).find((row) => row.status === k)?.count || 0,
  })).filter((d) => d.count > 0);
  const awaiting = (s.pendingApproval || 0) + (s.pendingDeletions || 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-bold uppercase tracking-wide text-slate-900">
            Dashboard
          </h1>
          <p className="mt-0.5 text-slate-600">
            {selected ? (
              <>
                Showing <span className="font-semibold text-slate-900">{selected.title}</span> only.
              </>
            ) : (
              'How your projects, budget and sessions are doing.'
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <DashboardExport user={user} projects={allProjects} projectId={projectId} onProject={setProjectId} />
          {isChairman && (
          <Link to="/admin/projects?status=PROPOSED">
            <Button variant="primary">
              <ClipboardCheck size={18} strokeWidth={1.75} aria-hidden="true" />
              Review proposals
            </Button>
          </Link>
          )}
        </div>
      </div>

      {/* Chairman: proposals waiting for a decision */}
      {isChairman && awaiting > 0 && (
        <Link
          to={s.pendingApproval > 0 ? '/admin/projects?status=PROPOSED' : '/admin/projects'}
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
      <div className="grid gap-4 sm:grid-cols-2">
        {selected ? (
          <KpiCard
            label="Stage"
            value={PROJECT_STATUS[selected.status]?.label || selected.status}
            note={
              selected.status === 'CANCELLED'
                ? 'Rejected at the Proposed stage'
                : selected.status === 'ON_HOLD'
                  ? 'Paused at the Ongoing stage'
                  : `Stage ${STAGES.indexOf(selected.status) + 1} of ${STAGES.length}`
            }
            tone="azure"
          />
        ) : (
          <KpiCard
            label="Active projects"
            value={a.activeProjects ?? '—'}
            note={`of ${s.totalProjects ?? 0} in total`}
          />
        )}
        {selected ? (
          <KpiCard
            label="Liquidation"
            value={`${selected.liquidationCount || 0} file${selected.liquidationCount === 1 ? '' : 's'}`}
            note={
              selected.checklistTotal
                ? `Checklist: ${selected.checklistDone} of ${selected.checklistTotal} done`
                : 'No checklist items'
            }
            tone="green"
          />
        ) : (
          <KpiCard
            label="Completion rate"
            value={a.completionRate != null ? `${a.completionRate}%` : '—'}
            note={`${s.completedProjects ?? 0} completed`}
            meter={a.completionRate}
            tone="green"
          />
        )}
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Projects by status" pdfChart>
          <StatusDonut data={statusData} colors={STATUS_COLOR} labels={STATUS_LABEL} />
        </Panel>
        <Panel
          pdfChart
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
                No ongoing project has ended or ends within 3 days.
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
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-base font-bold text-slate-900">
                        {p.title}
                      </span>
                      <span className="block text-sm text-slate-600">
                        {p.endDate && new Date(p.endDate) <= new Date() ? 'Ended' : 'Due'}{' '}
                        {formatDateTime(p.endDate)}
                      </span>
                    </span>
                    <StatusRibbon status={p.status} className="hidden sm:inline-flex" />
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

        <Panel title="Upcoming sessions" action={<PanelLink to="/admin/meetings">Meetings</PanelLink>}>
          {upcoming.length === 0 ? (
            <p className="py-4 text-slate-600">No sessions are scheduled.</p>
          ) : (
            <ul className="space-y-3">
              {upcoming.map((e) => (
                <li key={e.id}>
                  <Link
                    to={`/admin/meetings/${e.id}`}
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
            {canManage && (
              <>
                {' '}
                <Link to="/admin/projects" className="font-semibold text-brand-700">
                  Send a Project Request
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
                    <th className="w-56 py-2 pr-4 font-semibold">Stage</th>
                    <th className="py-2 text-right font-semibold">Budget</th>
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
                        <StageSteps status={p.status} />
                      </td>
                      <td className="py-3 text-right font-semibold text-slate-900">
                        {formatPeso(p.budget)}
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
                    <StageSteps status={p.status} className="mt-3" />
                    <span className="mt-2 block text-sm text-slate-600">Budget {formatPeso(p.budget)}</span>
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
