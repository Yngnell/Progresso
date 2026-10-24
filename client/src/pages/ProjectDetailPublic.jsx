import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { projectsApi } from '../api/projects';
import { Card } from '../components/ui';
import { totalSpent, progressSummary } from '../components/ProjectCard';
import { ProgressRoundel, ScheduleWords, StatusRibbon } from '../components/Roundel';
import ProjectChecklist from '../components/ProjectChecklist';
import { formatPeso, formatDate, formatDateTime } from '../utils/format';

function Fact({ label, children }) {
  return (
    <div>
      <dt className="text-sm font-semibold text-slate-600">{label}</dt>
      <dd className="mt-0.5 text-lg font-bold text-slate-900">{children || '—'}</dd>
    </div>
  );
}

export default function ProjectDetailPublic() {
  const { id } = useParams();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['projects', id],
    queryFn: () => projectsApi.get(id),
  });
  const project = data?.project;

  if (isLoading) return <p className="p-10 text-slate-600">Loading…</p>;
  if (isError || !project)
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="text-slate-700">Project not found.</p>
        <Link to="/projects" className="mt-4 inline-flex items-center gap-1 font-semibold text-brand-700">
          <ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" /> Back to Projects
        </Link>
      </div>
    );

  const spent = totalSpent(project);
  const summary = progressSummary(project.progressBreakdown);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <Link
        to="/projects"
        className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:text-brand-800"
      >
        <ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" /> Back to Projects
      </Link>

      <div className="mt-5 flex flex-col gap-6 sm:flex-row sm:items-center">
        <ProgressRoundel
          value={project.progress}
          breakdown={project.progressBreakdown}
          size="lg"
          className="mx-auto sm:mx-0"
        />
        <div className="min-w-0 text-center sm:text-left">
          <StatusRibbon status={project.status} />
          <h1 className="mt-3 font-display text-4xl font-bold uppercase leading-none tracking-wide text-slate-900 sm:text-5xl">
            {project.title}
          </h1>
          {project.category && <p className="mt-1 text-slate-600">{project.category}</p>}
          <div className="mt-2">
            <ScheduleWords breakdown={project.progressBreakdown} />
            {summary && <p className="mt-0.5 text-sm text-slate-600">{summary}</p>}
          </div>
        </div>
      </div>

      <Card className="mt-8 p-6">
        <p className="max-w-prose whitespace-pre-wrap text-[17px] leading-relaxed text-slate-700">
          {project.description || 'No description provided.'}
        </p>

        <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-5 border-t border-slate-100 pt-5 sm:grid-cols-3">
          <Fact label="Budget">{formatPeso(project.budget)}</Fact>
          <Fact label="Spent">{formatPeso(spent)}</Fact>
          <Fact label="Venue">{project.location}</Fact>
          <Fact label="Start">{formatDateTime(project.startDate)}</Fact>
          <Fact label="Target completion">{formatDateTime(project.endDate)}</Fact>
        </dl>
      </Card>

      <Card className="mt-6 p-6">
        <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-slate-900">
          Progress details
        </h2>
        <div className="mt-4">
          <ProjectChecklist project={project} />
        </div>
      </Card>

      {/* Expenses are public so residents can see where the budget goes. */}
      <Card className="mt-6 p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-slate-900">
            Expenses
          </h2>
          <p className="text-slate-600">
            <span className="font-semibold text-slate-900">{formatPeso(spent)}</span> of{' '}
            {formatPeso(project.budget)} spent
          </p>
        </div>
        {(project.expenses || []).length === 0 ? (
          <p className="mt-4 text-slate-600">No expenses recorded yet.</p>
        ) : (
          <table className="mt-4 w-full">
            <thead className="border-b border-slate-200 text-left text-sm text-slate-600">
              <tr>
                <th className="py-2 font-semibold">Item</th>
                <th className="py-2 font-semibold">Date</th>
                <th className="py-2 text-right font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {project.expenses.map((e) => (
                <tr key={e.id}>
                  <td className="py-2.5 pr-3 font-medium text-slate-900">{e.item}</td>
                  <td className="py-2.5 pr-3 text-slate-600">{formatDate(e.date)}</td>
                  <td className="py-2.5 text-right font-semibold text-slate-900">
                    {formatPeso(e.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-ink">
                <td className="py-2.5 font-bold text-slate-900" colSpan={2}>
                  Total
                </td>
                <td className="py-2.5 text-right font-display text-xl font-bold text-slate-900">
                  {formatPeso(spent)}
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </Card>

      {(project.officials || []).length > 0 && (
        <Card className="mt-6 p-6">
          <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-slate-900">
            Project team
          </h2>
          <ul className="mt-4 flex flex-wrap gap-2">
            {project.officials.map((o) => (
              <li
                key={o.id}
                className="rounded-full bg-brand-50 px-3.5 py-1.5 text-[15px] font-semibold text-brand-800"
              >
                {o.name} <span className="font-normal text-brand-700">· {o.position}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
