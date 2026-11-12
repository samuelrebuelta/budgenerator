import { useState } from 'react';
import { Download, Trash2 } from 'lucide-react';
import { deleteAccount, exportAccountData } from '@/entities/auth/api/firebase';
import { Button, Card, Input, Modal } from '@/shared/ui';

function errorMessage(error: unknown) {
  const code = (error as { code?: string })?.code ?? '';
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password')
    return 'La contraseña no es correcta.';
  if (code === 'auth/too-many-requests') return 'Demasiados intentos. Espera unos minutos.';
  if (code === 'functions/unauthenticated')
    return 'Por seguridad, vuelve a introducir tu contraseña.';
  return 'No se ha podido completar. Revisa tu conexión y vuelve a intentarlo.';
}

function downloadJson(data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `budgenerator-datos-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

/** RGPD: download every account document and delete the account. */
export function AccountDataSection() {
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const exportData = async () => {
    setExporting(true);
    setExportError('');
    try {
      downloadJson(await exportAccountData());
    } catch (error) {
      setExportError(errorMessage(error));
    } finally {
      setExporting(false);
    }
  };

  const closeDelete = () => {
    if (deleting) return;
    setDeleteOpen(false);
    setPassword('');
    setConfirmation('');
    setDeleteError('');
  };

  const confirmDelete = async () => {
    setDeleting(true);
    setDeleteError('');
    try {
      await deleteAccount(password);
      // Sign-out happens inside deleteAccount; the auth guard redirects to /login.
    } catch (error) {
      setDeleteError(errorMessage(error));
      setDeleting(false);
    }
  };

  return (
    <section className="mt-6" aria-labelledby="account-data-title">
      <h2 id="account-data-title" className="text-base font-semibold text-gray-900 mb-3">
        Tus datos
      </h2>
      <Card className="divide-y divide-gray-100">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div>
            <p className="font-medium text-gray-900">Descargar mis datos</p>
            <p className="text-sm text-gray-500">
              Un fichero JSON con tu cuenta, presupuestos, proyectos, solicitudes y ajustes.
            </p>
            {exportError && (
              <p className="field-error mt-1" role="alert">
                {exportError}
              </p>
            )}
          </div>
          <Button variant="secondary" loading={exporting} onClick={() => void exportData()}>
            <Download size={16} />
            Descargar
          </Button>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div>
            <p className="font-medium text-gray-900">Borrar mi cuenta</p>
            <p className="text-sm text-gray-500">
              Elimina todos tus datos y el acceso. No se puede deshacer.
            </p>
          </div>
          <Button variant="danger" onClick={() => setDeleteOpen(true)}>
            <Trash2 size={16} />
            Borrar cuenta
          </Button>
        </div>
      </Card>

      <Modal open={deleteOpen} onClose={closeDelete} title="Borrar cuenta">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">¿Borrar tu cuenta?</h3>
        <p className="text-sm text-gray-600 mb-4">
          Se eliminarán de forma permanente tus presupuestos, proyectos, catálogo, plantillas,
          equipo, solicitudes recibidas, enlaces públicos y avisos. Descarga antes tus datos si los
          necesitas.
        </p>
        <label htmlFor="delete-password" className="block text-sm font-medium text-gray-700 mb-1">
          Contraseña actual
        </label>
        <Input
          id="delete-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <label
          htmlFor="delete-confirmation"
          className="block text-sm font-medium text-gray-700 mt-3 mb-1"
        >
          Escribe BORRAR para confirmar
        </label>
        <Input
          id="delete-confirmation"
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          autoComplete="off"
        />
        {deleteError && (
          <p className="field-error mt-2" role="alert">
            {deleteError}
          </p>
        )}
        <div className="flex items-center justify-end gap-3 mt-5">
          <Button variant="secondary" disabled={deleting} onClick={closeDelete}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            loading={deleting}
            disabled={!password || confirmation.trim().toUpperCase() !== 'BORRAR'}
            onClick={() => void confirmDelete()}
          >
            Borrar definitivamente
          </Button>
        </div>
      </Modal>
    </section>
  );
}
