import { useState } from 'react';
import { Download, X } from 'lucide-react';
import type { ConstructionDocument } from '@/entities/construction-document/model';
import { Button, Modal } from '@/shared/ui';
import { downloadBytes, prepareBc3Export, type PreparedExport } from '../model/download';

/**
 * Exports the canonical document to FIEBDC-3. When the export has warnings (data without
 * FIEBDC equivalent, replaced characters) they are shown before downloading.
 */
export function ExportBc3Button({
  document,
  name,
  label = 'Exportar BC3',
  disabled,
}: {
  document: ConstructionDocument | null | undefined;
  name: string;
  label?: string;
  disabled?: boolean;
}) {
  const [prepared, setPrepared] = useState<PreparedExport | null>(null);
  const [error, setError] = useState('');

  const start = () => {
    if (!document) return;
    setError('');
    try {
      const result = prepareBc3Export(document, name);
      if (result.warnings.length) setPrepared(result);
      else downloadBytes(result.bytes, result.fileName);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se ha podido exportar el archivo.');
    }
  };

  return (
    <div className="no-print">
      <Button type="button" variant="secondary" disabled={disabled || !document} onClick={start}>
        <Download size={16} />
        {label}
      </Button>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      <Modal
        open={!!prepared}
        onClose={() => setPrepared(null)}
        title="Antes de exportar"
        panelClassName="max-w-lg"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold text-gray-900">Antes de exportar</h2>
          <Button variant="ghost" aria-label="Cerrar" onClick={() => setPrepared(null)}>
            <X size={18} />
          </Button>
        </div>
        <p className="mt-2 text-sm text-gray-600">
          El archivo <strong>{prepared?.fileName}</strong> se genera en este dispositivo con
          formato FIEBDC-3 (ANSI). Revisa lo que no se incluye tal cual:
        </p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-amber-800">
          {prepared?.warnings.map((warning) => <li key={warning}>{warning}</li>)}
        </ul>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={() => setPrepared(null)}>
            Cancelar
          </Button>
          <Button
            onClick={() => {
              if (prepared) downloadBytes(prepared.bytes, prepared.fileName);
              setPrepared(null);
            }}
          >
            <Download size={16} />
            Descargar
          </Button>
        </div>
      </Modal>
    </div>
  );
}
