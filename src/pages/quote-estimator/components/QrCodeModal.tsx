import { useEffect, useRef, useState } from 'react';
import { Download } from 'lucide-react';
import { Alert, Button, Modal, ModalBody, ModalFooter, ModalHeader } from '@/shared/ui';

const MODULE_PX = 12;
const QUIET_ZONE_MODULES = 4;

/** Draws the QR of `url` on a canvas: dark modules on white, with the standard quiet zone. */
async function drawQr(canvas: HTMLCanvasElement, url: string) {
  const { default: qrcode } = await import('qrcode-generator');
  const qr = qrcode(0, 'M');
  qr.addData(url);
  qr.make();
  const count = qr.getModuleCount();
  const size = (count + QUIET_ZONE_MODULES * 2) * MODULE_PX;
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('canvas');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, size, size);
  context.fillStyle = '#1c3029';
  for (let row = 0; row < count; row += 1)
    for (let column = 0; column < count; column += 1)
      if (qr.isDark(row, column))
        context.fillRect(
          (column + QUIET_ZONE_MODULES) * MODULE_PX,
          (row + QUIET_ZONE_MODULES) * MODULE_PX,
          MODULE_PX,
          MODULE_PX,
        );
}

export function QrCodeModal({
  open,
  onClose,
  url,
  fileName,
}: {
  open: boolean;
  onClose: () => void;
  url: string;
  fileName: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!open) return;
    // The canvas mounts with the modal panel; draw on the next frame.
    const frame = requestAnimationFrame(() => {
      if (!canvasRef.current) return;
      drawQr(canvasRef.current, url)
        .then(() => setFailed(false))
        .catch(() => setFailed(true));
    });
    return () => cancelAnimationFrame(frame);
  }, [open, url]);

  const download = () => {
    canvasRef.current?.toBlob((blob) => {
      if (!blob) return;
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = fileName;
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    }, 'image/png');
  };

  return (
    <Modal open={open} onClose={onClose}>
      <ModalHeader
        title="Código QR del formulario"
        description="Imprímelo en tarjetas, presupuestos, la furgoneta o el local."
        onClose={onClose}
      />
      <ModalBody className="flex flex-col items-center gap-3">
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={`Código QR que abre ${url}`}
          className="h-56 w-56 rounded-lg border border-line bg-white"
        />
        <p className="break-all text-center font-mono text-xs text-gray-600">{url}</p>
        {failed && (
          <Alert tone="danger" plain>
            No se ha podido generar el código QR. Vuelve a intentarlo.
          </Alert>
        )}
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" onClick={onClose}>
          Cerrar
        </Button>
        <Button onClick={download} disabled={failed}>
          <Download size={15} /> Descargar PNG
        </Button>
      </ModalFooter>
    </Modal>
  );
}
