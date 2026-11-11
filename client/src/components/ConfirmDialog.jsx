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
