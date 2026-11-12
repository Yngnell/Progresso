import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Circle, CircleCheck } from 'lucide-react';
import { projectsApi } from '../../api/projects';
import { StatusRibbon } from '../../components/Roundel';
import { Badge, Card, EmptyState } from '../../components/ui';
import PageHeader from '../../components/PageHeader';
import ProjectReviewPanel from '../../components/ProjectReviewPanel';
import { formatDate, formatDateTime, formatPeso } from '../../utils/format';

const cardTitle = 'section-title';

// Approvals (Barangay Chairman): the Project Requests the SK Admin submitted (Pending
// Approval). Approve moves a request to Approved; Reject (remarks required) moves it to
// Archives under Rejected. Both notify the SK Admin.
export default function AdminApprovals() {
  const qc = useQueryClient();
  const [notice, setNotice] = useState(null); // { ok, text }
  const { data, isLoading } = useQuery({
    queryKey: ['projects', 'proposals'],
    queryFn: () => projectsApi.list({ status: 'PENDING_APPROVAL', submitted: 'true' }),
  });
  const requests = data?.projects || [];

  const onDone = (_res, message) => {
    qc.invalidateQueries({ queryKey: ['projects'] });
    qc.invalidateQueries({ queryKey: ['stats'] });
    qc.invalidateQueries({ queryKey: ['notifications'] });
    setNotice(message ? { ok: true, text: message } : null);
  };
  const onFail = (fallback) => (err) => setNotice({ ok: false, text: err?.response?.data?.message || fallback });

  return (
    <div>
      <PageHeader
        title="Approvals"
        description="Project Requests the SK Admin submitted. Check the documents, then approve or reject (remarks are required to reject)."
        actions={
          !isLoading && (
            <Badge tone={requests.length ? 'amber' : 'slate'}>
              {requests.length} pending
            </Badge>
          )
        }
      />
      {notice && (
        <p className={`notice mt-4 ${notice.ok ? 'notice-ok' : 'notice-error'}`} role={notice.ok ? 'status' : 'alert'}>
          {notice.text}
        </p>
      )}

      <div className="mt-6 space-y-6">
        {isLoading ? (
          <p className="text-slate-600">Loading…</p>
        ) : requests.length === 0 ? (
          <EmptyState title="No Project Requests" description="Requests the SK Admin submits appear here for your approval." />
        ) : (
          requests.map((p) => <RequestCard key={p.id} project={p} onDone={onDone} onFail={onFail} />)
        )}
      </div>
    </div>
  );
}

// One Project Request with its full details and documents, then Approve / Reject.
function RequestCard({ project, onDone, onFail }) {
  const items = project.requestItems || [];
  const documents = (project.checklist || []).find((g) => g.stage === 'PENDING_APPROVAL')?.documents || [];
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
            <p className="text-slate-700">{formatDateTime(project.submittedAt || project.createdAt)}</p>
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
            <table className="table-notebook table-stack">
              <thead>
                <tr>
                  <th className="py-2">No.</th>
                  <th className="py-2">PR no.</th>
                  <th className="py-2">Date of PR</th>
                  <th className="py-2">Requested by</th>
                  <th className="py-2 text-right">Estimated amount</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r, i) => (
                  <tr key={r.id}>
                    <td data-label="No." className="py-2 text-slate-500">{i + 1}</td>
                    <td data-label="PR no." className="py-2 text-slate-700">{r.prNo || '—'}</td>
                    <td data-label="Date of PR" className="py-2 text-slate-500">{formatDate(r.prDate)}</td>
                    <td data-label="Requested by" className="py-2 uppercase text-slate-700">{r.requestedBy || '—'}</td>
                    <td data-label="Estimated amount" className="py-2 text-right font-medium text-slate-700">{formatPeso(r.amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-line">
                  <td data-label="" className="py-2 font-semibold text-slate-700" colSpan={4}>
                    Total
                  </td>
                  <td data-label="Total" className="py-2 text-right font-semibold text-slate-800">
                    {formatPeso(items.reduce((s, r) => s + Number(r.amount || 0), 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        {project.abyipItem && (
          <p className="mt-4 text-sm">
            <span className="font-semibold text-slate-600">ABYIP item:</span>{' '}
            <span className="text-slate-700">{project.abyipItem}</span>
          </p>
        )}

        <h3 className="mt-5 text-sm font-semibold text-slate-600">Documents</h3>
        <ul className="mt-1 space-y-1 text-sm">
          {documents.map((d) => (
            <li key={d.id} className="flex items-center gap-2">
              {d.complete ? (
                <CircleCheck size={16} strokeWidth={1.75} className="shrink-0 text-sage" aria-label="Complete" />
              ) : (
                <Circle size={16} strokeWidth={1.75} className="shrink-0 text-slate-400" aria-label="Not complete" />
              )}
              <span className="text-slate-800">{d.name}</span>
              <span className="text-slate-500">
                · {d.files.length} file{d.files.length === 1 ? '' : 's'}
              </span>
            </li>
          ))}
        </ul>
        <Link
          to={`/admin/projects/${project.id}`}
          className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-pine hover:underline"
        >
          Open the documents <ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" />
        </Link>

        <ProjectReviewPanel project={project} onDone={onDone} onFail={onFail} inline />
      </Card>
    </section>
  );
}
