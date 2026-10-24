import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { projectsApi } from '../../api/projects';
import { totalSpent } from '../../components/ProjectCard';
import Letterhead from '../../components/Letterhead';
import { PROJECT_STATUS, formatPeso, formatDate, formatDateTime } from '../../utils/format';

const SCHEDULE_LABEL = {
  ON_TRACK: 'Ongoing',
  BEHIND: 'Behind schedule',
  COMPLETED: 'Completed',
};

function Section({ title, children }) {
  return (
    <section className="no-break mt-6">
      <h2 className="border-b border-slate-400 pb-1 text-sm font-bold uppercase tracking-wide text-slate-800">
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <p className="text-[11px] uppercase text-slate-500">{label}</p>
      <p className="text-sm text-slate-900">{children || '—'}</p>
    </div>
  );
}

function Signature({ role, person, fallbackTitle }) {
  return (
    <div className="no-break pt-10 text-center">
      <div className="mx-auto w-4/5 border-t border-slate-800 pt-1">
        <p className="text-sm font-semibold text-slate-900">{person?.name || ' '}</p>
        <p className="text-xs text-slate-600">{person?.position || fallbackTitle}</p>
      </div>
      <p className="mt-1 text-[11px] uppercase text-slate-500">{role}</p>
    </div>
  );
}

// Printable Accomplishment Report. Opens outside the admin layout so the sidebar
// never prints; use "Print / Save as PDF" in the toolbar.
export default function ProjectReport() {
  const { id } = useParams();
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['projects', id, 'report'],
    queryFn: () => projectsApi.report(id),
  });

  if (isLoading) return <p className="p-8 text-sm text-slate-500">Preparing report…</p>;
  if (isError || !data) {
    return (
      <div className="p-8 text-center">
        <p className="text-slate-700">
          {error?.response?.data?.message || 'The report could not be loaded.'}
        </p>
        <Link to={`/admin/projects/${id}`} className="mt-3 inline-block text-brand-600">
          ← Back to the project
        </Link>
      </div>
    );
  }

  const { project, sessions, signatories, generatedAt } = data;
  const status = PROJECT_STATUS[project.status]?.label || project.status;
  const b = project.progressBreakdown || {};
  const spent = totalSpent(project);
  const budget = Number(project.budget || 0);
  const remaining = budget - spent;
  const used = budget > 0 ? Math.round((spent / budget) * 100) : 0;
  const tasks = project.tasks || [];
  const expenses = project.expenses || [];

  const basis =
    b.source === 'sessions'
      ? `${b.eventsDone} of ${b.eventsTotal} scheduled sessions held`
      : b.source === 'timeline'
        ? 'based on the project start and end dates'
        : project.status === 'COMPLETED'
          ? 'project completed'
          : '';

  return (
    <div className="min-h-screen bg-slate-200 py-6 print:bg-white print:py-0">
      <style>{`
        @media print {
          @page { size: A4; margin: 15mm; }
          body { background: #fff !important; }
          .no-break, tr { break-inside: avoid; }
        }
      `}</style>

      {/* Toolbar (not printed) */}
      <div className="mx-auto mb-4 flex max-w-[210mm] items-center justify-between px-2 print:hidden">
        <Link to={`/admin/projects/${id}`} className="text-sm text-brand-600 hover:text-brand-700">
          ← Back to the project
        </Link>
        <button
          onClick={() => window.print()}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Print / Save as PDF
        </button>
      </div>

      <article className="mx-auto max-w-[210mm] bg-white p-10 text-slate-900 shadow print:max-w-none print:p-0 print:shadow-none">
        {/* Letterhead (shared with the project proposal form) */}
        <Letterhead />
        <div className="mt-4 text-center">
          <h1 className="text-xl font-bold uppercase tracking-wide">Accomplishment Report</h1>
          <p className="text-xs text-slate-600">As of {formatDate(generatedAt)}</p>
        </div>

        {/* Profile */}
        <Section title="I. Project profile">
          <p className="text-base font-bold">{project.title}</p>
          {project.description && (
            <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{project.description}</p>
          )}
          <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3">
            <Field label="Status">{status}</Field>
            <Field label="Venue">{project.location}</Field>
            <Field label="Implementation period">
              {formatDateTime(project.startDate)} – {formatDateTime(project.endDate)}
            </Field>
            <Field label="Project team">
              {(project.officials || []).map((o) => o.name).join(', ')}
            </Field>
            <Field label="Approved by the Barangay Chairman">
              {project.reviewedBy && project.reviewedAt
                ? `${project.reviewedBy.name} on ${formatDate(project.reviewedAt)}`
                : ''}
            </Field>
            <Field label="Completion approved by the SK council">
              {project.councilApprovedOn
                ? `${formatDate(project.councilApprovedOn)}${
                    project.councilResolutionNo ? ` (${project.councilResolutionNo})` : ''
                  }`
                : ''}
            </Field>
          </div>
          {project.status === 'CANCELLED' && project.cancelReason && (
            <p className="mt-3 text-sm">
              <span className="font-semibold">Cancelled:</span> {project.cancelReason}
            </p>
          )}
        </Section>

        {/* Progress */}
        <Section title="II. Progress">
          <p className="text-sm">
            <span className="text-2xl font-bold">{project.progress}%</span>{' '}
            <span className="text-slate-600">
              {basis}
              {b.expected != null && b.schedule && b.schedule !== 'COMPLETED'
                ? ` · expected by now: ${b.expected}%`
                : ''}
              {SCHEDULE_LABEL[b.schedule] ? ` · ${SCHEDULE_LABEL[b.schedule]}` : ''}
            </span>
          </p>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-slate-700"
              style={{ width: `${project.progress}%` }}
            />
          </div>
          {tasks.length > 0 && (
            <ul className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
              {tasks.map((t) => (
                <li key={t.id} className={t.done ? '' : 'text-slate-500'}>
                  <span
                    className={`mr-1.5 inline-block h-3 w-3 border border-ink align-[-1px] ${
                      t.done ? 'bg-ink' : ''
                    }`}
                    aria-label={t.done ? 'Done' : 'Not done'}
                  />
                  {t.title}
                  {t.done && t.completedAt ? ` (${formatDate(t.completedAt)})` : ''}
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* Sessions */}
        <Section title="III. Activities conducted">
          {sessions.length === 0 ? (
            <p className="text-sm text-slate-500">No sessions were scheduled for this project.</p>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-400 text-left text-[11px] uppercase text-slate-500">
                  <th className="py-1 pr-2">Activity</th>
                  <th className="py-1 pr-2">Date and time</th>
                  <th className="py-1 pr-2">Venue</th>
                  <th className="py-1 pr-2">Status</th>
                  <th className="py-1 text-right">Attended</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.id} className="border-b border-slate-200 align-top">
                    <td className="py-1 pr-2">{s.title}</td>
                    <td className="py-1 pr-2">{formatDateTime(s.startAt)}</td>
                    <td className="py-1 pr-2">{s.location || '—'}</td>
                    <td className="py-1 pr-2">{s.held ? 'Held' : 'Upcoming'}</td>
                    <td className="py-1 text-right">
                      {s.total > 0 ? `${s.present + s.late} of ${s.total}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>

        {/* Finances */}
        <Section title="IV. Financial summary">
          <div className="grid grid-cols-4 gap-4">
            <Field label="Approved budget">{formatPeso(budget)}</Field>
            <Field label="Total spent">{formatPeso(spent)}</Field>
            <Field label="Remaining">{formatPeso(remaining)}</Field>
            <Field label="Budget used">{`${used}%`}</Field>
          </div>
          {remaining < 0 && (
            <p className="mt-2 text-xs font-semibold text-red-700">
              Spending exceeds the approved budget.
            </p>
          )}
          {(project.requestItems || []).length > 0 && (
            <div className="no-break mt-4">
              <p className="text-[11px] font-bold uppercase text-slate-600">
                Itemized purchase requests (approved budget)
              </p>
              <table className="mt-1 w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-400 text-left text-[11px] uppercase text-slate-500">
                    <th className="py-1 pr-2">No.</th>
                    <th className="py-1 pr-2">PR no.</th>
                    <th className="py-1 pr-2">Date of PR</th>
                    <th className="py-1 pr-2">Requested by</th>
                    <th className="py-1 text-right">Estimated amount</th>
                  </tr>
                </thead>
                <tbody>
                  {project.requestItems.map((r, i) => (
                    <tr key={r.id} className="border-b border-slate-200">
                      <td className="py-1 pr-2">{i + 1}</td>
                      <td className="py-1 pr-2">{r.prNo || '—'}</td>
                      <td className="py-1 pr-2">{formatDate(r.prDate)}</td>
                      <td className="py-1 pr-2 uppercase">{r.requestedBy || '—'}</td>
                      <td className="py-1 text-right">{formatPeso(r.amount)}</td>
                    </tr>
                  ))}
                  <tr className="font-bold">
                    <td className="py-1" colSpan={4}>
                      Total
                    </td>
                    <td className="py-1 text-right">{formatPeso(budget)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
          {expenses.length > 0 ? (
            <table className="mt-3 w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-400 text-left text-[11px] uppercase text-slate-500">
                  <th className="py-1 pr-2">Date</th>
                  <th className="py-1 pr-2">Item</th>
                  <th className="py-1 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((e) => (
                  <tr key={e.id} className="border-b border-slate-200">
                    <td className="py-1 pr-2">{formatDate(e.date)}</td>
                    <td className="py-1 pr-2">{e.item}</td>
                    <td className="py-1 text-right">{formatPeso(e.amount)}</td>
                  </tr>
                ))}
                <tr className="font-bold">
                  <td className="py-1" colSpan={2}>
                    Total
                  </td>
                  <td className="py-1 text-right">{formatPeso(spent)}</td>
                </tr>
              </tbody>
            </table>
          ) : (
            <p className="mt-3 text-sm text-slate-500">No expenses have been recorded.</p>
          )}
        </Section>

        {/* Signatures */}
        <section className="no-break mt-8">
          <div className="grid grid-cols-2 gap-x-10">
            <Signature role="Prepared by" person={signatories.secretary} fallbackTitle="SK Secretary" />
            <Signature
              role="Certified correct (finances)"
              person={signatories.treasurer}
              fallbackTitle="SK Treasurer"
            />
            <Signature
              role="Approved by"
              person={signatories.chairperson}
              fallbackTitle="SK Chairperson"
            />
            <Signature
              role="Noted by"
              person={
                project.reviewedBy
                  ? { name: project.reviewedBy.name, position: 'Barangay Chairman' }
                  : null
              }
              fallbackTitle="Barangay Chairman"
            />
          </div>
        </section>
      </article>
    </div>
  );
}
