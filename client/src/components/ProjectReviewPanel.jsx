import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { CircleCheck, X } from 'lucide-react';
import { projectsApi } from '../api/projects';
import { useConfirm } from './ConfirmDialog';
import { Button, Card } from './ui';

// Pending Approval (submitted): the Barangay Chairman approves (-> Approved) or rejects
// (-> Rejected; remarks required). Used on the request's page (its own card) and inside each
// request card on the Approvals page (inline: a section under a divider).
// onDone(res, message) gets the updated project and a success message.
export default function ProjectReviewPanel({ project, onDone, onFail, inline = false }) {
  const [remarks, setRemarks] = useState('');
  const [problem, setProblem] = useState('');
  const [ask, askDialog] = useConfirm();
  const review = useMutation({
    mutationFn: (decision) =>
      decision === 'APPROVE'
        ? projectsApi.approve(project.id, remarks.trim())
        : projectsApi.reject(project.id, remarks.trim()),
    onSuccess: (res, decision) =>
      onDone(
        res,
        decision === 'APPROVE'
          ? `"${project.title}" was approved. The SK Admin has been notified.`
          : `"${project.title}" was rejected. The SK Admin has been notified.`
      ),
    onError: onFail('Could not save your decision'),
  });
  async function decide(decision) {
    if (decision === 'REJECT' && !remarks.trim()) {
      setProblem('Write your remarks before rejecting: they tell the SK Admin why.');
      return;
    }
    setProblem('');
    const yes = await ask(
      decision === 'APPROVE'
        ? `Approve "${project.title}"? It moves to the Approved stage.`
        : `Reject "${project.title}"? It moves to Archives under Rejected, with your remarks.`,
      decision === 'APPROVE'
        ? { title: 'Approve this request?', confirmLabel: 'Approve', cancelLabel: 'Cancel' }
        : { title: 'Reject this request?', confirmLabel: 'Reject', cancelLabel: 'Cancel', variant: 'danger' }
    );
    if (yes) review.mutate(decision);
  }
  const remarksId = `review-remarks-${project.id}`;
  const Wrapper = inline ? 'div' : Card;
  return (
    <Wrapper className={inline ? 'mt-5 border-t border-slate-200 pt-5' : 'mt-4 p-5'}>
      <h2 className="text-lg font-bold text-slate-900">Approve or reject this Project Request</h2>
      <p className="mt-1 text-sm text-slate-600">Check the documents first. Remarks are required when you reject.</p>
      <label className="label mt-3" htmlFor={remarksId}>
        Remarks
      </label>
      <textarea
        id={remarksId}
        className="input"
        rows={2}
        value={remarks}
        aria-describedby={problem ? `${remarksId}-problem` : undefined}
        onChange={(e) => setRemarks(e.target.value)}
      />
      {problem && (
        <p id={`${remarksId}-problem`} className="mt-1 text-sm font-medium text-red-600" role="alert">
          {problem}
        </p>
      )}
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
      {askDialog}
    </Wrapper>
  );
}
