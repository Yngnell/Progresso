import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { CircleCheck, X } from 'lucide-react';
import { projectsApi } from '../api/projects';
import { Button, Card } from './ui';

// Proposed: the Barangay Chairman approves (-> Planning) or rejects (-> Cancelled).
// Used on a Proposed project's page (its own card) and inside each request card on the
// Approvals page (inline: a section under a divider).
export default function ProjectReviewPanel({ project, onDone, onFail, inline = false }) {
  const [remarks, setRemarks] = useState('');
  const review = useMutation({
    mutationFn: (decision) => projectsApi.review(project.id, { decision, remarks: remarks.trim() }),
    onSuccess: onDone,
    onError: onFail('Could not save your decision'),
  });
  function decide(decision) {
    const question =
      decision === 'APPROVE'
        ? `Approve "${project.title}"? It moves to Planning.`
        : `Reject "${project.title}"? It is cancelled and moves to Archives under Cancelled.`;
    if (window.confirm(question)) review.mutate(decision);
  }
  const remarksId = `review-remarks-${project.id}`;
  const Wrapper = inline ? 'div' : Card;
  return (
    <Wrapper className={inline ? 'mt-5 border-t border-slate-200 pt-5' : 'mt-4 p-5'}>
      <h2 className="text-lg font-bold text-slate-900">Approve or reject this Project Request</h2>
      <label className="label mt-3" htmlFor={remarksId}>
        Remarks (optional)
      </label>
      <textarea
        id={remarksId}
        className="input"
        rows={2}
        value={remarks}
        onChange={(e) => setRemarks(e.target.value)}
      />
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="primary" disabled={review.isPending} onClick={() => decide('APPROVE')}>
          <CircleCheck size={18} strokeWidth={1.75} aria-hidden="true" />
          Approve
        </Button>
        <Button variant="danger" disabled={review.isPending} onClick={() => decide('REJECT')}>
          <X size={18} strokeWidth={1.75} aria-hidden="true" />
          Reject
        </Button>
      </div>
    </Wrapper>
  );
}
