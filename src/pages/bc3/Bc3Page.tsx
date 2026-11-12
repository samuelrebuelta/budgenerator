import { useEffect, useRef, useState } from 'react';
import { Download, FileUp, Pencil, Save, Trash2, X } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useAuthStore } from '@/entities/auth';
import type { ConstructionDocument } from '@/entities/construction-document/model';
import {
  discardStagedConstructionDocument,
  listConstructionDocuments,
  publishConstructionDocument,
  stageConstructionDocument,
  loadConstructionDocument,
  deleteConstructionDocument,
} from '@/entities/construction-document/api/firestore';
import { calculateConstructionDocument } from '@/entities/construction-document/model/math';
import { parseBc3, serializeBc3 } from '@/shared/lib/bc3';
import type { Bc3Diagnostic } from '@/shared/lib/bc3';
import { Button, PageHeader, PageLayout } from '@/shared/ui';
import { ConstructionDocumentEditor } from './ConstructionDocumentEditor';

type SavedDocument = {
  id: string;
  title?: string;
  kind: ConstructionDocument['kind'];
  updatedAt?: string;
};

export function Bc3Page() {
  const user = useAuthStore((state) => state.user);
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<ConstructionDocument | null>(null);
  const [editingEntry, setEditingEntry] = useState<{
    uid: string;
    document: ConstructionDocument;
  } | null>(null);
  const editing =
    editingEntry && user && editingEntry.uid === user.uid ? editingEntry.document : null;
  const setEditing = (document: ConstructionDocument | null) => {
    if (!document) setEditingEntry(null);
    else if (user) setEditingEntry({ uid: user.uid, document });
  };
  const [diagnostics, setDiagnostics] = useState<Bc3Diagnostic[]>([]);
  const [documentsEntry, setDocumentsEntry] = useState<{
    uid: string;
    documents: SavedDocument[];
  } | null>(null);
  const documents =
    documentsEntry && user && documentsEntry.uid === user.uid ? documentsEntry.documents : [];
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedDocumentId = searchParams.get('document');

  const refresh = async () => {
    if (!user) return;
    const result = await listConstructionDocuments(user.uid);
    setDocumentsEntry({ uid: user.uid, documents: result as SavedDocument[] });
  };
  useEffect(() => {
    if (!user) return;
    let active = true;
    listConstructionDocuments(user.uid)
      .then((result) => {
        if (active) setDocumentsEntry({ uid: user.uid, documents: result as SavedDocument[] });
      })
      .catch((reason: unknown) => {
        if (active)
          setError(
            reason instanceof Error ? reason.message : 'No se pudieron cargar tus documentos.',
          );
      });
    return () => {
      active = false;
    };
  }, [user]);

  useEffect(() => {
    if (!user || !requestedDocumentId) return;
    let active = true;
    loadConstructionDocument(user.uid, requestedDocumentId)
      .then((document) => {
        if (active) setEditingEntry({ uid: user.uid, document });
      })
      .catch((reason: unknown) => {
        if (active)
          setError(reason instanceof Error ? reason.message : 'No se pudo abrir el documento.');
      });
    return () => {
      active = false;
    };
  }, [user, requestedDocumentId]);

  const selectFile = async (file?: File) => {
    setError('');
    setMessage('');
    if (!file) return;
    try {
      const result = parseBc3(new Uint8Array(await file.arrayBuffer()));
      setDiagnostics(result.diagnostics);
      setPreview(result.document);
      if (!result.document) setError('No se puede importar este archivo sin perder información.');
      else setMessage(`Archivo leído: ${Object.keys(result.document.concepts).length} conceptos.`);
    } catch (reason) {
      setPreview(null);
      setError(reason instanceof Error ? reason.message : 'No se pudo leer el archivo.');
    }
  };

  const importDocument = async () => {
    if (!user || !preview) return;
    setBusy(true);
    setError('');
    let staged: Awaited<ReturnType<typeof stageConstructionDocument>> | undefined;
    try {
      staged = await stageConstructionDocument(user.uid, preview);
      await publishConstructionDocument(staged);
      setPreview(null);
      setMessage('Documento importado y guardado en tu cuenta.');
      await refresh();
    } catch (reason) {
      if (staged) await discardStagedConstructionDocument(user.uid, staged).catch(() => undefined);
      setError(reason instanceof Error ? reason.message : 'No se pudo guardar el documento.');
    } finally {
      setBusy(false);
    }
  };

  const openEditor = async (item: SavedDocument) => {
    if (!user) return;
    setBusy(true);
    setError('');
    try {
      setEditing(await loadConstructionDocument(user.uid, item.id));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo abrir el documento.');
    } finally {
      setBusy(false);
    }
  };

  const saveEditedDocument = async () => {
    if (!user || !editing) return;
    const totals = editing.kind === 'budget' ? calculateConstructionDocument(editing) : undefined;
    if (totals && !totals.valid) {
      setError(`Corrige los datos antes de guardar: ${totals.issues[0]?.message}`);
      return;
    }
    setBusy(true);
    setError('');
    let staged: Awaited<ReturnType<typeof stageConstructionDocument>> | undefined;
    try {
      staged = await stageConstructionDocument(user.uid, editing);
      await publishConstructionDocument(staged);
      setEditing(null);
      setSearchParams({}, { replace: true });
      setMessage('Cambios guardados en el documento FIEBDC.');
      await refresh();
    } catch (reason) {
      if (staged) await discardStagedConstructionDocument(user.uid, staged).catch(() => undefined);
      setError(reason instanceof Error ? reason.message : 'No se pudieron guardar los cambios.');
    } finally {
      setBusy(false);
    }
  };

  const exportDocument = async (item: SavedDocument) => {
    if (!user) return;
    setBusy(true);
    setError('');
    try {
      const nativeDocument = await loadConstructionDocument(user.uid, item.id);
      const bytes = serializeBc3(nativeDocument);
      const exportBuffer = bytes.slice().buffer as ArrayBuffer;
      const url = URL.createObjectURL(
        new Blob([exportBuffer], { type: 'application/octet-stream' }),
      );
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${(nativeDocument.header.title || 'presupuesto').replace(/[^\p{L}\p{N}-]+/gu, '-').replace(/^-|-$/g, '') || 'presupuesto'}.bc3`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo exportar el documento.');
    } finally {
      setBusy(false);
    }
  };

  const removeDocument = async (item: SavedDocument) => {
    if (!user || !window.confirm(`¿Eliminar «${item.title || 'sin título'}»?`)) return;
    setBusy(true);
    try {
      await deleteConstructionDocument(user.uid, item.id);
      await refresh();
      setMessage('Documento eliminado.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo eliminar el documento.');
    } finally {
      setBusy(false);
    }
  };

  const totals = preview?.kind === 'budget' ? calculateConstructionDocument(preview) : undefined;

  return (
    <PageLayout>
      <PageHeader
        title="Intercambio BC3"
        description="Importa y exporta presupuestos, catálogos y plantillas en formato FIEBDC-3."
        backTo="/budgets"
        backLabel="Volver a presupuestos"
      />
      <section className="mx-auto mt-6 max-w-4xl space-y-6">
        {editing && (
          <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Editar documento FIEBDC</h2>
                <p className="mt-1 text-sm text-gray-600">
                  Los cambios se guardan como una nueva revisión y conservan los códigos y la
                  estructura BC3.
                </p>
              </div>
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => {
                  setEditing(null);
                  setSearchParams({}, { replace: true });
                }}
              >
                <X size={16} /> Cerrar
              </Button>
            </div>
            <ConstructionDocumentEditor document={editing} onChange={setEditing} />
            <div className="mt-5 flex justify-end">
              <Button disabled={busy} onClick={() => void saveEditedDocument()}>
                <Save size={16} /> Guardar cambios
              </Button>
            </div>
          </div>
        )}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Importar un archivo BC3</h2>
          <p className="mt-1 text-sm text-gray-600">
            Revisaremos el contenido antes de guardarlo. Si falta una partida o una medición,
            bloquearemos la importación.
          </p>
          <input
            ref={input}
            type="file"
            accept=".bc3,application/octet-stream,text/plain"
            className="sr-only"
            onChange={(event) => void selectFile(event.currentTarget.files?.[0])}
          />
          <Button className="mt-4" onClick={() => input.current?.click()}>
            <FileUp size={16} /> Elegir archivo BC3
          </Button>
          {preview && (
            <div className="mt-5 rounded-lg bg-gray-50 p-4">
              <h3 className="font-medium">{preview.header.title || 'Documento sin título'}</h3>
              <label className="mt-3 block max-w-sm text-sm font-medium">
                Guardar en BudGenerator como
                <select
                  className="mt-1 block min-h-11 w-full rounded-md border border-gray-300 bg-white px-3"
                  value={preview.kind}
                  onChange={(event) =>
                    setPreview({
                      ...preview,
                      kind: event.currentTarget.value as ConstructionDocument['kind'],
                      header: {
                        ...preview.header,
                        informationType: event.currentTarget.value === 'catalog' ? 1 : 2,
                      },
                    })
                  }
                >
                  {preview.header.informationType === 1 ? (
                    <option value="catalog">Catálogo</option>
                  ) : (
                    <>
                      <option value="budget">Presupuesto</option>
                      <option value="template">Plantilla reutilizable</option>
                    </>
                  )}
                </select>
              </label>
              <p className="mt-1 text-sm text-gray-600">
                {preview.kind === 'catalog'
                  ? 'Catálogo'
                  : preview.kind === 'template'
                    ? 'Plantilla'
                    : 'Presupuesto'}{' '}
                · {Object.keys(preview.concepts).length} conceptos · {preview.roots.length} partidas
                principales
              </p>
              {totals && (
                <p className="mt-1 text-sm">
                  {totals.valid
                    ? `Total calculado: ${totals.total?.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}`
                    : `No se puede calcular: ${totals.issues[0]?.message}`}
                </p>
              )}
              {diagnostics.length > 0 && (
                <ul className="mt-3 list-disc pl-5 text-sm text-amber-800">
                  {diagnostics.map((item, index) => (
                    <li key={`${item.code}-${index}`}>{item.message}</li>
                  ))}
                </ul>
              )}
              <Button className="mt-4" disabled={busy} onClick={() => void importDocument()}>
                Importar a mi cuenta
              </Button>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Mis documentos FIEBDC</h2>
          {documents.length === 0 ? (
            <p className="mt-2 text-sm text-gray-600">Todavía no hay documentos importados.</p>
          ) : (
            <ul className="mt-3 divide-y divide-gray-100">
              {documents.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <div>
                    <p className="font-medium">{item.title || 'Sin título'}</p>
                    <p className="text-sm text-gray-500">
                      {item.kind === 'catalog'
                        ? 'Catálogo'
                        : item.kind === 'template'
                          ? 'Plantilla'
                          : 'Presupuesto'}
                      {item.updatedAt
                        ? ` · ${new Date(item.updatedAt).toLocaleDateString('es-ES')}`
                        : ''}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      disabled={busy}
                      onClick={() => void openEditor(item)}
                    >
                      <Pencil size={16} /> Editar
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={busy}
                      onClick={() => void exportDocument(item)}
                    >
                      <Download size={16} /> Exportar BC3
                    </Button>
                    <Button
                      variant="ghost"
                      aria-label={`Eliminar ${item.title || 'documento'}`}
                      disabled={busy}
                      onClick={() => void removeDocument(item)}
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        {message && (
          <p role="status" className="text-sm text-green-700">
            {message}
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}
      </section>
    </PageLayout>
  );
}
