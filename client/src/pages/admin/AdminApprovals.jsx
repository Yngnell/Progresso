import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { projectsApi } from '../../api/projects';
import { StatusRibbon } from '../../components/Roundel';
import { Card, EmptyState } from '../../components/ui';
import PageHeader from '../../components/PageHeader';
import ProjectReviewPanel from '../../components/ProjectReviewPanel';
import { formatDate, formatPeso } from '../../utils/format';

const cardTitle = 'font-display text-2xl font-bold uppercase tracking-wide text-slate-900';

// Approvals (Barangay Chairman): the Project Requests waiting for a decision (Proposed).
// Approve moves a request to Planning; Reject cancels it (Archives > Cancelled).
export default function AdminApprovals() {
  const qc = useQueryClient();
  const [error, setError] = useState('');
  const { data, isLoading } = useQuery({
    queryKey: ['projects', 'proposals'],
    queryFn: () => projectsApi.list({ status: 'PROPOSED' }),
  });
  const requests = data?.projects || [];

  const onDone = () => {
    qc.invalidateQueries({ queryKey: ['projects'] });
    qc.invalidateQueries({ queryKey: ['stats'] });
    setError('');
  };
  const onFail = (fallback) => (err) => setError(err?.response?.data?.message || fallback);

  return (
    <div>
      <PageHeader
        title="Approvals"
        description="Project Requests waiting for your decision. Approve moves a request to Planning; Reject cancels it."
      />
      {error && (
        <p className="mt-4 text-sm font-medium text-red-600" role="alert">
          {error}
        </p>
      )}

      <div className="mt-6 space-y-6">
        {isLoading ? (
          <p className="text-slate-600">Loading…</p>
        ) : requests.length === 0 ? (
          <EmptyState title="No Project Requests" description="New Project Requests from the SK appear here for approval." />
        ) : (
          requests.map((p) => <RequestCard key={p.id} project={p} onDone={onDone} onFail={onFail} />)
        )}
      </div>
    </div>
  );
}

// One Project Request with its full details, then Approve / Reject.
function RequestCard({ project, onDone, onFail }) {
  const items = project.requestItems || [];
  return (
    <section aria-labelledby={`request-${project.id}`}>
      <Card className="p-6">
        <StatusRibbon status={project.status} />
        <h2 id={`request-${project.id}`} className={`mt-2 ${cardTitle}`}>
          {project.title}
        </h2>
        <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">
          {project.description || 'No description provided.'}
        </p>

        <div className="mt-4 grid gap-4 text-sm sm:grid-cols-3">
          <div>
            <p className="font-semibold text-slate-600">Prepared by</p>
            <p className="text-slate-700">
              {project.proposedByName
                ? `${project.proposedByName}${project.proposedByPosition ? ` (${project.proposedByPosition})` : ''}`
                : project.createdBy?.name || '—'}
            </p>
          </div>
          <div>
            <p className="font-semibold text-slate-600">Submitted</p>
            <p className="text-slate-700">{formatDate(project.createdAt)}</p>
          </div>
          <div>
            <p className="font-semibold text-slate-600">Total budget</p>
            <p className="font-semibold text-slate-800">{formatPeso(project.budget)}</p>
          </div>
        </div>

        <h3 className="mt-5 text-sm font-semibold text-slate-600">Purchase requests</h3>
        {items.length === 0 ? (
          <p className="mt-1 text-sm text-slate-600">No purchase requests listed.</p>
        ) : (
          <div className="mt-1 overflow-x-auto">
            <table className="w-full min-w-[32rem] text-sm">
              <thead className="text-left text-sm text-slate-600">
                <tr>
                  <th className="py-2">No.</th>
                  <th className="py-2">PR no.</th>
                  <th className="py-2">Date of PR</th>
                  <th className="py-2">Requested by</th>
                  <th className="py-2 text-right">Estimated amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((r, i) => (
                  <tr key={r.id}>
                    <td className="py-2 text-slate-500">{i + 1}</td>
                    <td className="py-2 text-slate-700">{r.prNo || '—'}</td>
                    <td className="py-2 text-slate-500">{formatDate(r.prDate)}</td>
                    <td className="py-2 uppercase text-slate-700">{r.requestedBy || '—'}</td>
                    <td className="py-2 text-right font-medium text-slate-700">{formatPeso(r.amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-200">
                  <td className="py-2 font-semibold text-slate-700" colSpan={4}>
                    Total
                  </td>
                  <td className="py-2 text-right font-semibold text-slate-800">
                    {formatPeso(items.reduce((s, r) => s + Number(r.amount || 0), 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        <ProjectReviewPanel project={project} onDone={onDone} onFail={onFail} inline />
      </Card>
    </section>
  );
}
