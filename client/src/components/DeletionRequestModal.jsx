import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsApi } from '../api/projects';
import { Button, Modal } from './ui';
import { useConfirm } from './ConfirmDialog';

export const MIN_REASON_LENGTH = 10;

// Asks the SK Admin for a reason and files a deletion request. The project is
// only removed after the Barangay Chairman approves it.
export default function DeletionRequestModal({ project, onClose, onSent }) {
  const qc = useQueryClient();
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [ask, askDialog] = useConfirm();

  const mutation = useMutation({
    mutationFn: () => projectsApi.requestDeletion(project.id, reason.trim()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['deletion-requests'] });
      qc.invalidateQueries({ queryKey: ['stats'] });
      onSent?.('Deletion request sent to the Barangay Chairman.');
      onClose();
    },
    onError: (err) =>
      setError(err.response?.data?.message || 'Could not send the deletion request'),
  });

  async function submit() {
    if (reason.trim().length < MIN_REASON_LENGTH) {
      setError(`Please explain the reason (at least ${MIN_REASON_LENGTH} characters).`);
      return;
    }
    setError('');
    if (!(await ask('Are you sure you want to send this deletion request?'))) return;
    mutation.mutate();
  }

  return (
    <>
    <Modal
      open={Boolean(project)}
      onClose={onClose}
      title="Request project deletion"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" onClick={submit} disabled={mutation.isPending}>
            {mutation.isPending ? 'Sending…' : 'Send request'}
          </Button>
        </>
      }
    >
      {project && (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            <span className="font-semibold text-slate-800">{project.title}</span> will only be
            removed if the Barangay Chairman approves this request. Until then it stays as it is.
            If approved, it moves to the <span className="font-semibold">Archive</span>: nothing is
            erased, and the records stay read-only.
          </p>
          <div>
            <label className="label">Reason for deletion *</label>
            <textarea
              className="input"
              rows={4}
              placeholder="e.g. Duplicate of another project, or cancelled by the council"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      )}
    </Modal>
    {askDialog}
    </>
  );
}
