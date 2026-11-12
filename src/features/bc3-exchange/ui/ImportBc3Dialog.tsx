import { useId, useMemo, useRef, useState } from 'react';
import { AlertTriangle, FileUp, Info, X } from 'lucide-react';
import {
  parseBc3,
  type Bc3ParseResult,
} from '@/entities/construction-document/bc3';
import {
  documentTotals,
  isChapterNode,
  projectWorkItems,
  type ConstructionDocument,
  type ConstructionDocumentKind,
} from '@/entities/construction-document/model';
import { formatCurrency } from '@/shared/lib';
import { sessionRevision } from '@/shared/model/session';
import { Button, Modal } from '@/shared/ui';
import { readFileBytes } from '../model/download';

const TARGET_COPY: Record<ConstructionDocumentKind, { title: string; confirm: string; hint: string }> = {
  catalog: {
    title: 'Importar base de precios BC3',
    confirm: 'Añadir al catálogo',
    hint: 'Las partidas se añaden a tu catálogo por capítulos. Las que ya existen (misma descripción y unidad) no se duplican ni cambian de precio.',
  },
  budget: {
    title: 'Importar presupuesto BC3',
    confirm: 'Crear presupuesto',
    hint: 'Se abre como borrador nuevo; no consume plaza hasta que lo guardes.',
  },
  template: {
    title: 'Importar plantilla BC3',
    confirm: 'Crear plantilla',
    hint: 'La estructura y las partidas se guardan como plantilla reutilizable.',
  },
};

interface Props {
  target: ConstructionDocumentKind;
  /** Persists the confirmed document. Cancelling never calls it. */
  onConfirm: (document: ConstructionDocument) => Promise<void> | void;
  label?: string;
  disabled?: boolean;
}

/**
 * Local BC3 import: the file is read in the browser, previewed with its diagnostics and only
 * the confirmed canonical document reaches the store. Errors block confirmation.
 */
export function ImportBc3Dialog({ target, onConfirm, label = 'Importar BC3', disabled }: Props) {
  const copy = TARGET_COPY[target];
  const inputId = useId();
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState('');
  const [result, setResult] = useState<Bc3ParseResult | null>(null);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const confirming = useRef(false);
  const revision = useRef(0);

  const reset = () => {
    setFileName('');
    setResult(null);
    setExcluded(new Set());
    setError('');
  };
  const close = () => {
    if (confirming.current) return;
    reset();
    setOpen(false);
  };

  const handleFile = async (file: File | undefined) => {
    reset();
    if (!file) return;
    setFileName(file.name);
    revision.current = sessionRevision();
    try {
      setResult(parseBc3(await readFileBytes(file), { target }));
    } catch {
      setError('No se ha podido leer el archivo.');
    }
  };

  const document = result?.document ?? null;
  const chapters = useMemo(() => {
    if (!document) return [];
    const totals = documentTotals(document);
    return document.tree.map((node) => {
      const concept = document.concepts[node.conceptId];
      let items = 0;
      const count = (current: typeof node) => {
        if (isChapterNode(current, document.concepts[current.conceptId]))
          current.children.forEach(count);
        else items++;
      };
      count(node);
      return {
        id: node.id,
        name: isChapterNode(node, concept) ? concept?.summary || concept?.code || '' : concept?.summary ?? '',
        chapter: isChapterNode(node, concept),
        items,
        amount: totals.nodes.get(node.id)?.rawAmount ?? 0,
      };
    });
  }, [document]);
  const errors = result?.diagnostics.filter((item) => item.severity === 'error') ?? [];
  const warnings = result?.diagnostics.filter((item) => item.severity === 'warning') ?? [];
  const totals = document && target !== 'catalog' ? documentTotals(document) : null;
  const selectedCount = chapters.filter((chapter) => !excluded.has(chapter.id)).length;

  const confirm = async () => {
    if (!document || errors.length || confirming.current) return;
    if (sessionRevision() !== revision.current) {
      setError('La sesión ha cambiado. Vuelve a seleccionar el archivo.');
      return;
    }
    confirming.current = true;
    setBusy(true);
    setError('');
    try {
      const pruned =
        target === 'catalog' && excluded.size
          ? { ...document, tree: document.tree.filter((node) => !excluded.has(node.id)) }
          : document;
      await onConfirm(pruned);
      confirming.current = false;
      reset();
      setOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se ha podido importar.');
      confirming.current = false;
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button type="button" variant="secondary" disabled={disabled} onClick={() => setOpen(true)}>
        <FileUp size={16} />
        {label}
      </Button>
      <Modal open={open} onClose={close} title={copy.title} panelClassName="bc3-import-panel">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{copy.title}</h2>
            <p className="mt-1 text-sm text-gray-600">{copy.hint}</p>
          </div>
          <Button variant="ghost" aria-label="Cerrar" onClick={close} disabled={busy}>
            <X size={18} />
          </Button>
        </div>

        <div className="mt-4">
          <label htmlFor={inputId} className="text-sm font-medium text-gray-800">
            Archivo FIEBDC-3 (.bc3)
          </label>
          <input
            id={inputId}
            type="file"
            accept=".bc3,.BC3,application/octet-stream"
            disabled={busy}
            onChange={(event) => void handleFile(event.target.files?.[0])}
            className="mt-1 block w-full text-sm"
          />
          <p className="mt-1 text-xs text-gray-500">
            El archivo se procesa en este dispositivo y no se sube a ningún servidor.
          </p>
        </div>

        {result && (
          <div className="mt-4 space-y-3" aria-live="polite">
            <dl className="bc3-summary grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-xs text-gray-500">Archivo</dt>
                <dd className="truncate font-medium" title={fileName}>
                  {fileName}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Tipo</dt>
                <dd className="font-medium">
                  {result.summary.informationType === 1
                    ? 'Base de precios'
                    : result.summary.informationType === 2
                      ? 'Presupuesto u obra'
                      : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Formato</dt>
                <dd className="font-medium">
                  {result.summary.version || '—'} · {result.summary.charset || '—'}
                </dd>
              </div>
              {result.summary.program && (
                <div>
                  <dt className="text-xs text-gray-500">Programa</dt>
                  <dd className="font-medium">{result.summary.program}</dd>
                </div>
              )}
              <div>
                <dt className="text-xs text-gray-500">Capítulos · partidas</dt>
                <dd className="font-medium">
                  {result.summary.chapters} · {result.summary.items}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Mediciones · descompuestos</dt>
                <dd className="font-medium">
                  {result.summary.measuredItems} · {result.summary.composedConcepts}
                </dd>
              </div>
              {totals && (
                <div className="col-span-2 sm:col-span-3">
                  <dt className="text-xs text-gray-500">Total de ejecución (sin IVA)</dt>
                  <dd className="font-semibold">
                    {formatCurrency(totals.raw)}
                    {result.summary.declaredTotal !== null && (
                      <span className="ml-2 text-xs font-normal text-gray-500">
                        declarado en el archivo: {formatCurrency(result.summary.declaredTotal)}
                      </span>
                    )}
                  </dd>
                </div>
              )}
            </dl>

            {errors.length > 0 && (
              <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3">
                <p className="flex items-center gap-2 text-sm font-semibold text-red-800">
                  <AlertTriangle size={16} aria-hidden="true" />
                  No se puede importar sin perder información
                </p>
                <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-red-700">
                  {errors.slice(0, 12).map((item, index) => (
                    <li key={index}>
                      {item.message}
                      {item.recordIndex ? ` (registro ${item.recordIndex})` : ''}
                    </li>
                  ))}
                  {errors.length > 12 && <li>…y {errors.length - 12} errores más.</li>}
                </ul>
              </div>
            )}
            {warnings.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="flex items-center gap-2 text-sm font-semibold text-amber-900">
                  <Info size={16} aria-hidden="true" />
                  Avisos
                </p>
                <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-amber-900">
                  {warnings.map((item, index) => (
                    <li key={index}>{item.message}</li>
                  ))}
                </ul>
              </div>
            )}

            {document && chapters.length > 0 && (
              <fieldset className="rounded-lg border border-gray-200 p-3">
                <legend className="px-1 text-sm font-medium text-gray-800">
                  {target === 'catalog' ? 'Capítulos que se añadirán' : 'Estructura'}
                </legend>
                <ul className="bc3-chapter-list max-h-56 space-y-1 overflow-y-auto text-sm">
                  {chapters.map((chapter) => (
                    <li key={chapter.id} className="flex items-center justify-between gap-3">
                      {target === 'catalog' ? (
                        <label className="flex min-h-11 items-center gap-2">
                          <input
                            type="checkbox"
                            checked={!excluded.has(chapter.id)}
                            onChange={(event) =>
                              setExcluded((current) => {
                                const next = new Set(current);
                                if (event.target.checked) next.delete(chapter.id);
                                else next.add(chapter.id);
                                return next;
                              })
                            }
                          />
                          {chapter.chapter ? chapter.name : `${chapter.name} (sin capítulo)`}
                        </label>
                      ) : (
                        <span>{chapter.name}</span>
                      )}
                      <span className="shrink-0 text-xs text-gray-500">
                        {chapter.items} partidas
                        {target !== 'catalog' ? ` · ${formatCurrency(chapter.amount)}` : ''}
                      </span>
                    </li>
                  ))}
                </ul>
                {target !== 'catalog' && (
                  <p className="mt-2 text-xs text-gray-500">
                    {projectWorkItems(document).length} grupos de partidas en el editor.
                  </p>
                )}
              </fieldset>
            )}
          </div>
        )}

        {error && (
          <p className="field-error mt-3" role="alert">
            {error}
          </p>
        )}

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={close} disabled={busy}>
            Cancelar
          </Button>
          <Button
            onClick={() => void confirm()}
            loading={busy}
            disabled={!document || errors.length > 0 || busy || (target === 'catalog' && !selectedCount)}
          >
            {copy.confirm}
          </Button>
        </div>
      </Modal>
    </>
  );
}
