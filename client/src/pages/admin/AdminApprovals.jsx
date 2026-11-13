import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardCheck } from 'lucide-react';
import { projectsApi } from '../../api/projects';
import { StatusRibbon } from '../../components/Roundel';
import { Button, Card, EmptyState } from '../../components/ui';
import PageHeader from '../../components/PageHeader';
import ProjectReviewForm from '../../components/ProjectReviewForm';
import { formatDate, formatPeso2 } from '../../utils/format';

// Approvals (Barangay Chairman): the Project Requests waiting for a decision (Pending).
// Review opens Form 4: Approve, Return for Revision or Reject.
export default function AdminApprovals() {
  const qc = useQueryClient();
  const [notice, setNotice] = useState(null);
  const [reviewing, setReviewing] = useState(null);
  const { data, isLoading } = useQuery({
    queryKey: ['projects', 'pending'],
    queryFn: () => projectsApi.list({ status: 'PENDING' }),
  });
  const requests = data?.projects || [];

  const onDone = (_res, text) => {
    setReviewing(null);
    setNotice(text);
    qc.invalidateQueries({ queryKey: ['projects'] });
    qc.invalidateQueries({ queryKey: ['abyip'] });
    qc.invalidateQueries({ queryKey: ['stats'] });
  };

  return (
    <div>
      <PageHeader
        title="Approvals"
        description="Project Requests waiting for your decision. Review each one: approve it, return it for revision, or reject it."
      />
      {notice && <p className="notice notice-ok mt-4" role="status">{notice}</p>}

      <div className="mt-6">
        {isLoading ? (
          <p className="text-slate-600">Loading…</p>
        ) : requests.length === 0 ? (
          <EmptyState title="No requests to review" description="Project Requests submitted by the SK Admin appear here." />
        ) : (
          <Card>
            <ul className="divide-y divide-line">
              {requests.map((p) => (
                <li key={p.id} className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center">
                  <div className="min-w-0 flex-1">
                    <StatusRibbon status={p.status} />
                    <Link to={`/admin/projects/${p.id}`} className="mt-1.5 block truncate font-display text-lg text-ink hover:text-pine">
                      {p.title}
                    </Link>
                    <p className="text-sm text-slate-600">
                      {p.abyipItem ? `${p.abyipItem.name} · ` : ''}Submitted {formatDate(p.submittedAt || p.createdAt)}
                      {p.reviews?.length ? ` · resubmitted after ${p.reviews.length} review${p.reviews.length === 1 ? '' : 's'}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-4 md:justify-end">
                    <div className="text-right">
                      <p className="text-[13px] text-slate-600">Estimated cost</p>
                      <p className="font-semibold text-ink">{formatPeso2(p.estimatedCost)}</p>
                    </div>
                    <Button onClick={() => setReviewing(p.id)}>
                      <ClipboardCheck size={16} aria-hidden="true" /> Review
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
      {reviewing && <ProjectReviewForm projectId={reviewing} onClose={() => setReviewing(null)} onDone={onDone} />}
    </div>
  );
}
