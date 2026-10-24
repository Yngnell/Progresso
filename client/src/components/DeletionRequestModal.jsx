import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsApi } from '../api/projects';
import { Button, Modal } from './ui';

export const MIN_REASON_LENGTH = 10;

// Asks the SK Admin for a reason and files a deletion request. The project is
// only removed after the Barangay Chairman approves it.
export default function DeletionRequestModal({ project, onClose }) {
  const qc = useQueryClient();
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: () => projectsApi.requestDeletion(project.id, reason.trim()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['deletion-requests'] });
      qc.invalidateQueries({ queryKey: ['stats'] });
      onClose();
    },
    onError: (err) =>
      setError(err.response?.data?.message || 'Could not send the deletion request'),
  });

  function submit() {
    if (reason.trim().length < MIN_REASON_LENGTH) {
      setError(`Please explain the reason (at least ${MIN_REASON_LENGTH} characters).`);
      return;
    }
    setError('');
    mutation.mutate();
  }

  return (
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
  );
}
