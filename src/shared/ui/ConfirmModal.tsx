import { useRef, useState } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';

interface ConfirmModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void | Promise<void>;
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const inFlight = useRef(false);
  const confirm = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setSaving(true);
    setError('');
    try {
      await onConfirm();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se ha podido completar. Vuelve a intentarlo.');
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  };
  return (
    <Modal
      open={open}
      title={title}
      onClose={() => {
        if (!saving) {
          setError('');
          onClose();
        }
      }}
    >
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-sm text-gray-600 mb-6">{message}</p>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      <div className="flex items-center justify-end gap-3">
        <Button variant="secondary" disabled={saving} onClick={onClose}>
          {cancelLabel}
        </Button>
        <Button variant={variant} loading={saving} onClick={() => void confirm()}>
          {saving ? 'Un momento…' : confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
