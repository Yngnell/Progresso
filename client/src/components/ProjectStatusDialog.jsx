import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsApi } from '../api/projects';
import { Button, Modal, Input } from './ui';

export const MIN_REASON_LENGTH = 10;

// Closing a project always records why:
//  - "complete": confirmed by SK council approval (date required, resolution no. optional)
//  - "cancel":   a written reason is required
export default function ProjectStatusDialog({ project, mode, onClose }) {
  const qc = useQueryClient();
  const [approvedOn, setApprovedOn] = useState('');
  const [resolutionNo, setResolutionNo] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const isComplete = mode === 'complete';

  const mutation = useMutation({
    mutationFn: () =>
      isComplete
        ? projectsApi.complete(project.id, {
            councilApprovedOn: approvedOn,
            councilResolutionNo: resolutionNo,
          })
        : projectsApi.cancel(project.id, { reason: reason.trim() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['stats'] });
      onClose();
    },
    onError: (err) => setError(err.response?.data?.message || 'Could not update the project'),
  });

  function submit() {
    if (isComplete && !approvedOn) {
      setError('Please enter the date the SK council approved the completion.');
      return;
    }
    if (!isComplete && reason.trim().length < MIN_REASON_LENGTH) {
      setError(`Please explain the reason (at least ${MIN_REASON_LENGTH} characters).`);
      return;
    }
    setError('');
    mutation.mutate();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={isComplete ? 'Mark project as completed' : 'Cancel project'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Back
          </Button>
          <Button
            variant={isComplete ? 'primary' : 'danger'}
            onClick={submit}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? 'Saving…' : isComplete ? 'Mark as completed' : 'Cancel project'}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-slate-600">
          <span className="font-semibold text-slate-800">{project.title}</span>
          {isComplete
            ? ' is completed once the SK council has approved it. Progress will show 100%.'
            : ' will be closed. This is normally decided by the SK council, so state the reason.'}
        </p>

        {isComplete ? (
          <>
            <Input
              label="SK council approval date *"
              type="date"
              value={approvedOn}
              onChange={(e) => setApprovedOn(e.target.value)}
            />
            <Input
              label="Resolution no. (optional)"
              value={resolutionNo}
              onChange={(e) => setResolutionNo(e.target.value)}
              placeholder="e.g. Resolution No. 12, Series of 2026"
            />
          </>
        ) : (
          <div>
            <label className="label">Reason for cancelling *</label>
            <textarea
              className="input"
              rows={3}
              placeholder="e.g. Cancelled by the SK council due to typhoon"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </Modal>
  );
}
