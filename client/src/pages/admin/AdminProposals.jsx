import { useState } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsApi } from '../../api/projects';
import { useAuth } from '../../context/AuthContext';
import { Button, Card, Badge, EmptyState } from '../../components/ui';
import { formatPeso, formatDate, formatDateTime } from '../../utils/format';

// Pending deletion requests: the SK Admin gave a reason; the chairman decides.
function DeletionRequests({ isChairman }) {
  const qc = useQueryClient();
  const [remarks, setRemarks] = useState({});
  const [errors, setErrors] = useState({});

  const { data, isLoading } = useQuery({
    queryKey: ['deletion-requests', 'pending'],
    queryFn: () => projectsApi.deletionRequests({ status: 'PENDING' }),
  });
  const requests = data?.requests || [];

  const mutation = useMutation({
    mutationFn: ({ id, decision, remarks: text }) =>
      projectsApi.reviewDeletion(id, { decision, remarks: text }),
    onSuccess: (_res, vars) => {
      setErrors((e) => ({ ...e, [vars.id]: '' }));
      qc.invalidateQueries({ queryKey: ['deletion-requests'] });
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['stats'] });
    },
    onError: (err, vars) =>
      setErrors((e) => ({
        ...e,
        [vars.id]: err.response?.data?.message || 'Could not save the decision',
      })),
  });

  function decide(request, decision) {
    const text = (remarks[request.id] || '').trim();
    if (decision === 'REJECT' && !text) {
      setErrors((e) => ({ ...e, [request.id]: 'Please write remarks before rejecting.' }));
      return;
    }
    if (
      decision === 'APPROVE' &&
      !window.confirm(
        `Approve deleting "${request.projectTitle}"? It will move to the Archive: it disappears from the Projects list and the public site, but all its records are kept.`
      )
    ) {
      return;
    }
    mutation.mutate({ id: request.id, decision, remarks: text });
  }

  return (
    <div className="mt-10">
      <h2 className="text-lg font-bold text-slate-800">Deletion requests</h2>
      <p className="mt-1 text-sm text-slate-500">
        A project is only removed after the Barangay Chairman approves a request with a reason. It
        then moves to the Archive; nothing is erased.
      </p>

      <div className="mt-4">
        {isLoading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : requests.length === 0 ? (
          <p className="text-slate-600">No deletion requests waiting.</p>
        ) : (
          <div className="space-y-4">
            {requests.map((r) => (
              <Card key={r.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    {r.project ? (
                      <Link
                        to={`/admin/projects/${r.project.id}`}
                        className="text-lg font-bold text-slate-900 hover:text-brand-700"
                      >
                        {r.projectTitle}
                      </Link>
                    ) : (
                      <p className="text-lg font-bold text-slate-900">{r.projectTitle}</p>
                    )}
                    <p className="mt-0.5 text-sm text-slate-600">
                      Requested by {r.requestedByName} on {formatDate(r.createdAt)}
                      {r.project ? ` · Budget ${formatPeso(r.project.budget)}` : ''}
                    </p>
                  </div>
                  <Badge tone="red">Deletion requested</Badge>
                </div>

                <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  <span className="font-semibold">Reason:</span> {r.reason}
                </div>

                {isChairman && (
                  <div className="mt-4 border-t border-slate-100 pt-4">
                    <label className="label">Remarks</label>
                    <textarea
                      className="input"
                      rows={2}
                      placeholder="Required when rejecting the request"
                      value={remarks[r.id] || ''}
                      onChange={(e) => setRemarks({ ...remarks, [r.id]: e.target.value })}
                    />
                    {errors[r.id] && <p className="mt-1 text-sm text-red-600">{errors[r.id]}</p>}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        variant="danger"
                        disabled={mutation.isPending}
                        onClick={() => decide(r, 'APPROVE')}
                      >
                        Approve deletion
                      </Button>
                      <Button
                        variant="secondary"
                        disabled={mutation.isPending}
                        onClick={() => decide(r, 'REJECT')}
                      >
                        Reject request
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Proposed projects waiting on (or returned by) the Barangay Chairman,
// plus project deletion requests.
export default function AdminProposals() {
  const { user } = useAuth();
  const isChairman = user?.role === 'CHAIRMAN';
  const qc = useQueryClient();
  const [remarks, setRemarks] = useState({});
  const [errors, setErrors] = useState({});

  const { data, isLoading } = useQuery({
    queryKey: ['projects', 'proposals'],
    queryFn: () => projectsApi.list({ status: 'PROPOSED' }),
  });
  const proposals = data?.projects || [];

  const reviewMutation = useMutation({
    mutationFn: ({ id, decision, remarks: text }) =>
      projectsApi.review(id, { decision, remarks: text }),
    onSuccess: (_res, vars) => {
      setErrors((e) => ({ ...e, [vars.id]: '' }));
      setRemarks((r) => ({ ...r, [vars.id]: '' }));
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['stats'] });
    },
    onError: (err, vars) =>
      setErrors((e) => ({
        ...e,
        [vars.id]: err.response?.data?.message || 'Could not save the decision',
      })),
  });

  function decide(project, decision) {
    const text = (remarks[project.id] || '').trim();
    if (decision !== 'APPROVE' && !text) {
      const verb = decision === 'RETURN' ? 'returning' : 'rejecting';
      setErrors((e) => ({ ...e, [project.id]: `Please write remarks before ${verb}.` }));
      return;
    }
    if (
      decision === 'REJECT' &&
      !window.confirm(
        `Reject "${project.title}"? The proposal will be closed and the SK will need to propose a different program.`
      )
    ) {
      return;
    }
    reviewMutation.mutate({ id: project.id, decision, remarks: text });
  }

  return (
    <div>
      <PageHeader
        title="Approvals"
        description={
          isChairman
            ? 'Review projects proposed by the SK. Approving moves a project to Planning.'
            : 'Projects waiting for the Barangay Chairman’s approval.'
        }
      />
      <h2 className="mt-8 font-display text-2xl font-bold uppercase tracking-wide text-slate-900">
        Proposed projects
      </h2>

      <div className="mt-6">
        {isLoading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : proposals.length === 0 ? (
          <EmptyState
            title="No proposals waiting"
            description="New projects will appear here until the Barangay Chairman approves them."
          />
        ) : (
          <div className="space-y-4">
            {proposals.map((p) => {
              const returned = p.approvalState === 'RETURNED';
              return (
                <Card key={p.id} className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        to={`/admin/projects/${p.id}`}
                        className="text-lg font-bold text-slate-900 hover:text-brand-700"
                      >
                        {p.title}
                      </Link>
                      <p className="mt-0.5 text-sm text-slate-600">
                        Proposed by{' '}
                        {p.proposedByName
                          ? `${p.proposedByName}${p.proposedByPosition ? ` (${p.proposedByPosition})` : ''}`
                          : p.createdBy?.name || '—'}
                      </p>
                    </div>
                    <Badge tone={returned ? 'amber' : 'slate'}>
                      {returned ? 'Returned for revision' : 'Awaiting approval'}
                    </Badge>
                  </div>

                  {p.description && (
                    <p className="mt-3 text-sm text-slate-600">{p.description}</p>
                  )}

                  <div className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
                    <div>
                      <p className="text-slate-400">Budget</p>
                      <p className="font-medium text-slate-700">{formatPeso(p.budget)}</p>
                    </div>
                    <div>
                      <p className="text-slate-400">Venue</p>
                      <p className="font-medium text-slate-700">{p.location || '—'}</p>
                    </div>
                    <div>
                      <p className="text-slate-400">Start</p>
                      <p className="font-medium text-slate-700">{formatDateTime(p.startDate)}</p>
                    </div>
                    <div>
                      <p className="text-slate-400">End</p>
                      <p className="font-medium text-slate-700">{formatDateTime(p.endDate)}</p>
                    </div>
                  </div>

                  {(p.officials || []).length > 0 && (
                    <p className="mt-3 text-sm text-slate-600">
                      Team: {p.officials.map((o) => o.name).join(', ')}
                    </p>
                  )}

                  {returned && p.reviewRemarks && (
                    <div className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                      <span className="font-semibold">
                        Chairman’s remarks{p.reviewedBy ? ` (${p.reviewedBy.name})` : ''}:
                      </span>{' '}
                      {p.reviewRemarks}
                    </div>
                  )}

                  {isChairman ? (
                    <div className="mt-4 border-t border-slate-100 pt-4">
                      <label className="label">Remarks</label>
                      <textarea
                        className="input"
                        rows={2}
                        placeholder="Required when returning or rejecting a proposal"
                        value={remarks[p.id] || ''}
                        onChange={(e) => setRemarks({ ...remarks, [p.id]: e.target.value })}
                      />
                      {errors[p.id] && (
                        <p className="mt-1 text-sm text-red-600">{errors[p.id]}</p>
                      )}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          variant="primary"
                          disabled={reviewMutation.isPending}
                          onClick={() => decide(p, 'APPROVE')}
                        >
                          Approve
                        </Button>
                        <Button
                          variant="secondary"
                          disabled={reviewMutation.isPending}
                          onClick={() => decide(p, 'RETURN')}
                        >
                          Return for revision
                        </Button>
                        <Button
                          variant="danger"
                          disabled={reviewMutation.isPending}
                          onClick={() => decide(p, 'REJECT')}
                        >
                          Reject
                        </Button>
                      </div>
                    </div>
                  ) : (
                    returned && (
                      <p className="mt-3 text-sm text-slate-600">
                        Edit the project to address the remarks; saving it resubmits it for
                        approval.
                      </p>
                    )
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <DeletionRequests isChairman={isChairman} />
    </div>
  );
}
