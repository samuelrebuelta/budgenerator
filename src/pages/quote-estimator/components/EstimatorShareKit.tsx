import { useState } from 'react';
import {
  Code,
  Copy,
  ExternalLink,
  MessageCircle,
  Pause,
  Play,
  QrCode,
  Share2,
  Unlink,
} from 'lucide-react';
import { revokeEstimatorLink, setEstimatorPaused } from '@/entities/quote-estimator';
import {
  Alert,
  Button,
  buttonClassName,
  ConfirmModal,
  Input,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from '@/shared/ui';
import { QrCodeModal } from './QrCodeModal';
import {
  formUrl,
  shortLinkUrl,
  websiteButtonHtml,
  whatsappShareUrl,
} from '../model/estimatorSharing';

async function copyText(text: string) {
  await navigator.clipboard.writeText(text);
}

interface EstimatorShareKitProps {
  token: string;
  slug: string;
  paused: boolean;
  companyName: string;
  onPausedChange: (paused: boolean) => void;
  onRevoked: () => void;
  onDeleteRequest: () => void;
  busy: boolean;
}

/** Published form: its link, ways to share it, pause and revoke. */
export function EstimatorShareKit({
  token,
  slug,
  paused,
  companyName,
  onPausedChange,
  onRevoked,
  onDeleteRequest,
  busy,
}: EstimatorShareKitProps) {
  const url = slug ? shortLinkUrl(slug) : formUrl(token);
  const [working, setWorking] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [qrOpen, setQrOpen] = useState(false);
  const [htmlOpen, setHtmlOpen] = useState(false);
  const [revokeOpen, setRevokeOpen] = useState(false);
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const report = (message: string, failed = false) => {
    setNotice(failed ? '' : message);
    setError(failed ? message : '');
  };

  const copy = async (text: string, done: string) => {
    try {
      await copyText(text);
      report(done);
    } catch {
      report('No se ha podido copiar. Selecciona el texto y cópialo a mano.', true);
    }
  };

  const share = async () => {
    try {
      await navigator.share({ title: `Presupuesto · ${companyName}`, url });
    } catch (cause) {
      if (!(cause instanceof Error && cause.name === 'AbortError'))
        report('No se ha podido abrir el menú de compartir.', true);
    }
  };

  const togglePause = async () => {
    setWorking(paused ? 'Reanudando…' : 'Pausando…');
    try {
      const result = await setEstimatorPaused(!paused);
      onPausedChange(result.paused);
      report(
        result.paused
          ? 'Formulario en pausa. El enlace muestra tus datos de contacto.'
          : 'Formulario activo de nuevo con el mismo enlace.',
      );
    } catch {
      report('No se ha podido cambiar el estado. Vuelve a intentarlo.', true);
    } finally {
      setWorking('');
    }
  };

  const revoke = async () => {
    try {
      await revokeEstimatorLink();
      setRevokeOpen(false);
      onRevoked();
    } catch {
      throw new Error('No se ha podido revocar el enlace. Vuelve a intentarlo.');
    }
  };

  const disabled = busy || Boolean(working);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold text-gray-900">Tu formulario</h2>
        <span
          className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${paused ? 'bg-warning-surface text-warning-ink' : 'bg-success-surface text-success-ink'}`}
        >
          {paused ? 'En pausa' : 'Activo'}
        </span>
      </div>
      <Input id="estimator-summary-url" label="Enlace para compartir" value={url} readOnly />
      {slug && (
        <p className="text-xs text-gray-500">
          Este enlace corto se mantiene aunque pauses, revoques o vuelvas a publicar el formulario.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => void copy(url, 'Enlace copiado.')} disabled={disabled}>
          <Copy size={15} /> Copiar enlace
        </Button>
        <a
          href={whatsappShareUrl(companyName, url)}
          target="_blank"
          rel="noreferrer"
          className={buttonClassName({ variant: 'secondary' })}
        >
          <MessageCircle size={15} /> WhatsApp
        </a>
        <Button variant="secondary" onClick={() => setQrOpen(true)} disabled={disabled}>
          <QrCode size={15} /> Código QR
        </Button>
        {canShare && (
          <Button variant="secondary" onClick={() => void share()} disabled={disabled}>
            <Share2 size={15} /> Compartir
          </Button>
        )}
        <Button variant="secondary" onClick={() => setHtmlOpen(true)} disabled={disabled}>
          <Code size={15} /> Botón para tu web
        </Button>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className={buttonClassName({ variant: 'ghost' })}
        >
          <ExternalLink size={15} /> Ver como cliente
        </a>
      </div>
      <div className="flex flex-wrap gap-2 border-t border-line pt-4">
        <Button
          variant="secondary"
          onClick={() => void togglePause()}
          loading={Boolean(working)}
          disabled={busy}
        >
          {paused ? <Play size={15} /> : <Pause size={15} />}
          {working || (paused ? 'Reanudar formulario' : 'Pausar formulario')}
        </Button>
        <Button variant="danger" onClick={() => setRevokeOpen(true)} disabled={disabled}>
          <Unlink size={15} /> Revocar enlace
        </Button>
        <Button variant="ghost" onClick={onDeleteRequest} disabled={disabled}>
          Borrar configuración
        </Button>
      </div>
      <div className="min-h-6" aria-live="polite">
        {notice && (
          <p
            role="status"
            className="rounded-lg bg-success-surface px-3 py-2 text-sm text-success-ink"
          >
            {notice}
          </p>
        )}
        {error && (
          <Alert tone="danger" plain>
            {error}
          </Alert>
        )}
      </div>

      <QrCodeModal
        open={qrOpen}
        onClose={() => setQrOpen(false)}
        url={url}
        fileName={`qr-${slug || 'formulario'}.png`}
      />
      <Modal open={htmlOpen} onClose={() => setHtmlOpen(false)}>
        <ModalHeader
          title="Botón para tu web"
          description="Pega este código en tu web (por ejemplo, en un bloque HTML de WordPress o Wix)."
          onClose={() => setHtmlOpen(false)}
        />
        <ModalBody>
          <label htmlFor="estimator-website-html" className="sr-only">
            Código HTML del botón
          </label>
          <textarea
            id="estimator-website-html"
            readOnly
            rows={5}
            value={websiteButtonHtml(url)}
            className="w-full rounded-lg border border-line bg-surface-muted p-3 font-mono text-xs text-gray-700"
            onFocus={(event) => event.currentTarget.select()}
          />
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setHtmlOpen(false)}>
            Cerrar
          </Button>
          <Button
            onClick={() => {
              void copy(websiteButtonHtml(url), 'Código del botón copiado.');
              setHtmlOpen(false);
            }}
          >
            <Copy size={15} /> Copiar código
          </Button>
        </ModalFooter>
      </Modal>
      <ConfirmModal
        open={revokeOpen}
        onClose={() => setRevokeOpen(false)}
        title="¿Revocar el enlace del formulario?"
        message={
          slug
            ? 'El formulario dejará de aceptar solicitudes. El enlace corto mostrará tus datos de contacto hasta que lo vuelvas a publicar. Si solo quieres parar un tiempo, usa «Pausar formulario».'
            : 'El enlace dejará de funcionar y, al volver a publicar, se generará otro distinto. Si solo quieres parar un tiempo, usa «Pausar formulario».'
        }
        confirmLabel="Revocar enlace"
        onConfirm={revoke}
      />
    </div>
  );
}
