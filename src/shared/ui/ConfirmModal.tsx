import { Modal } from './Modal';
import { Button } from './Button';

interface ConfirmModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  variant?: 'danger' | 'primary';
  cancelLabel?: string;
}

export function ConfirmModal({
  open,
  onClose,
  title,
  message,
  confirmLabel,
  onConfirm,
  variant = 'danger',
  cancelLabel = 'Cancelar',
}: ConfirmModalProps) {
  return (
    <Modal open={open} onClose={onClose}>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-sm text-gray-600 mb-6">{message}</p>
      <div className="flex items-center justify-end gap-3">
        <Button variant="secondary" onClick={onClose}>
          {cancelLabel}
        </Button>
        <Button variant={variant} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
