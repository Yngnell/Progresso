import { useCallback, useRef, useState } from 'react';
import { Button, Modal } from './ui';

// One confirmation dialog for the whole app: a message, Cancel, and the confirm button.
// Cancel (or the backdrop / X) closes it and changes nothing; onConfirm runs the action.
export default function ConfirmDialog({
  open,
  title = 'Please confirm',
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'primary',
  busy = false,
  onConfirm,
  onCancel,
}) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button variant={variant} onClick={onConfirm} disabled={busy} autoFocus>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="pb-5 text-[15px] text-slate-700">{message}</p>
    </Modal>
  );
}

// Ask first, act on Yes. Returns [confirm, dialog]: render `dialog` once in the component,
// then `if (await confirm('Are you sure…?')) doIt();`. Answers default to Yes / No.
// Options: { title, confirmLabel, cancelLabel, variant }.
export function useConfirm() {
  const [ask, setAsk] = useState(null); // { message, ...options }
  const resolver = useRef(null);

  const confirm = useCallback(
    (message, options = {}) =>
      new Promise((resolve) => {
        resolver.current = resolve;
        setAsk({ message, ...options });
      }),
    []
  );

  const answer = (yes) => {
    resolver.current?.(yes);
    resolver.current = null;
    setAsk(null);
  };

  const dialog = (
    <ConfirmDialog
      open={Boolean(ask)}
      title={ask?.title}
      message={ask?.message}
      confirmLabel={ask?.confirmLabel || 'Yes'}
      cancelLabel={ask?.cancelLabel || 'No'}
      variant={ask?.variant || 'primary'}
      onConfirm={() => answer(true)}
      onCancel={() => answer(false)}
    />
  );

  return [confirm, dialog];
}
