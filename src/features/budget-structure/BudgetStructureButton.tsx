import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Check, ListChecks, Search, X } from 'lucide-react';
import { useActiveBudget, useBudgetStore } from '@/entities/budget';
import { compareSpanish, searchCatalogParts, useCatalogStore } from '@/entities/catalog';
import { sessionRevision } from '@/shared/model/session';
import { Button, Modal } from '@/shared/ui';
import { UNIT_LABELS, type Budget, type CatalogPart } from '@/shared/types';
import { decimal } from '@/shared/lib/budgetMath';
import { conceptKey, structureFromSelection } from './model';

interface Snapshot {
  budget: Budget;
  parts: CatalogPart[];
  revision: number;
}

export function BudgetStructureButton() {
  const budget = useActiveBudget();
  const parts = useCatalogStore((s) => s.catalogs[0]?.parts ?? []);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  return (
    <>
      <Button
        variant="secondary"
        disabled={!budget || !parts.some((part) => part.concepts.length)}
        onClick={() => {
          if (budget) setSnapshot({ budget, parts, revision: sessionRevision() });
        }}
      >
        <ListChecks size={18} />
        Crear paso a paso
      </Button>
      {snapshot && <StructureFlow snapshot={snapshot} onClose={() => setSnapshot(null)} />}
    </>
  );
}

function StructureFlow({ snapshot, onClose }: { snapshot: Snapshot; onClose: () => void }) {
  const [step, setStep] = useState(0);
  const [partIds, setPartIds] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const submitted = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const currentBudget = useActiveBudget();
  const currentParts = useCatalogStore((s) => s.catalogs[0]?.parts ?? []);
  const stale =
    currentBudget !== snapshot.budget ||
    currentParts !== snapshot.parts ||
    sessionRevision() !== snapshot.revision;
  const selectableParts = useMemo(
    () => snapshot.parts.filter((part) => part.concepts.length > 0),
    [snapshot.parts],
  );
  const reviewStep = partIds.length + 1;
  const review = step === reviewStep;
  const currentPartId = step > 0 && !review ? partIds[step - 1] : undefined;
  const currentPart = snapshot.parts.find((part) => part.id === currentPartId);
  const visibleConcepts = useMemo(
    () => (currentPart ? (searchCatalogParts([currentPart], query)[0]?.concepts ?? []) : []),
    [currentPart, query],
  );
  const picked = partIds.flatMap((partId) => {
    const part = snapshot.parts.find((item) => item.id === partId);
    return (
      part?.concepts
        .filter((concept) => selected.includes(conceptKey(partId, concept.id)))
        .map((concept) => ({ partId, concept })) ?? []
    );
  });
  const reviewParts = partIds.filter((id) => picked.some((item) => item.partId === id));
  const orderedParts = partIds.filter((id) => reviewParts.includes(id));
  const stepTitle =
    step === 0 ? 'Partidas' : review ? 'Revisión' : (currentPart?.name ?? 'Conceptos');
  const stepHeading =
    step === 0
      ? '¿Qué partidas vas a incluir?'
      : review
        ? 'Revisa la estructura'
        : `Elige conceptos de ${currentPart?.name ?? 'la partida'}`;
  useEffect(() => {
    heading.current?.focus();
  }, [step]);

  const togglePart = (partId: string) =>
    setPartIds((old) =>
      old.includes(partId) ? old.filter((id) => id !== partId) : [...old, partId],
    );
  const move = (partId: string, delta: number) =>
    setPartIds((old) => {
      const next = [...old];
      const index = next.indexOf(partId);
      const target = reviewParts[reviewParts.indexOf(partId) + delta];
      const other = target ? next.indexOf(target) : -1;
      if (other >= 0 && other < next.length)
        [next[index], next[other]] = [next[other]!, next[index]!];
      return next;
    });
  const toggleConcept = (partId: string, conceptId: string) => {
    const key = conceptKey(partId, conceptId);
    if (selected.includes(key)) {
      setSelected((old) => old.filter((value) => value !== key));
      setQuantities((old) => {
        const next = { ...old };
        delete next[key];
        return next;
      });
      return;
    }
    setSelected((old) => [...old, key]);
  };
  const setQuantity = (key: string, value: string) =>
    setQuantities((old) => ({ ...old, [key]: value }));
  const goNext = () => {
    setQuery('');
    setError('');
    setStep((old) => old + 1);
  };
  const goBack = () => {
    setQuery('');
    setStep((old) => old - 1);
  };
  const removeReviewPart = (partId: string) => {
    setPartIds((old) => old.filter((id) => id !== partId));
    setStep(partIds.length);
  };
  const confirm = () => {
    if (submitted.current || stale) return;
    try {
      const selectedConceptKeys = picked
        .filter((item) => orderedParts.includes(item.partId))
        .map((item) => conceptKey(item.partId, item.concept.id));
      const selectedQuantities = Object.fromEntries(
        selectedConceptKeys.map((key) => [key, decimal(quantities[key] ?? '')]),
      );
      const items = structureFromSelection(
        snapshot.parts,
        orderedParts,
        selectedConceptKeys,
        selectedQuantities,
      );
      submitted.current = true;
      useBudgetStore.getState().appendStructure(items, snapshot.budget);
      onClose();
    } catch (e) {
      submitted.current = false;
      setError(e instanceof Error ? e.message : 'No se ha podido añadir la estructura.');
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Crear presupuesto paso a paso"
      panelClassName="structure-panel"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="structure-progress" role="status">
            Paso {step + 1} de {partIds.length + 2} · {stepTitle}
          </p>
          <h2 ref={heading} tabIndex={-1}>
            {stepHeading}
          </h2>
        </div>
        <Button variant="ghost" aria-label="Cerrar" onClick={onClose}>
          <X size={18} />
        </Button>
      </div>
      <p className="text-sm text-gray-500 mt-2 mb-5">
        {step === 0
          ? 'Empieza por la estructura de la reforma. Después revisarás cada partida por separado.'
          : review
            ? 'Ordena las partidas y comprueba las cantidades antes de pasar al editor.'
            : 'Elige los conceptos que necesitas. Puedes indicar una cantidad ahora o completarla después.'}
      </p>
      {stale && (
        <p role="alert" className="field-error">
          El presupuesto o el catálogo ha cambiado. Cierra el asistente y vuelve a abrirlo para
          revisar la selección.
        </p>
      )}
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
      <div className="structure-body">
        {step === 0 && (
          <div className="structure-categories">
            {selectableParts.map((part) => (
              <label
                key={part.id}
                className="structure-category"
                data-selected={partIds.includes(part.id)}
              >
                <input
                  type="checkbox"
                  checked={partIds.includes(part.id)}
                  onChange={() => togglePart(part.id)}
                />
                <span>
                  {part.name}
                  <small>
                    {part.concepts.length} {part.concepts.length === 1 ? 'concepto' : 'conceptos'}
                  </small>
                </span>
              </label>
            ))}
          </div>
        )}
        {currentPart && (
          <>
            <label className="catalog-search mb-4">
              <Search size={18} />
              <input
                aria-label="Buscar conceptos"
                placeholder={`Buscar en ${currentPart.name}`}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <section className="structure-section">
              {visibleConcepts.map((concept) => {
                const key = conceptKey(currentPart.id, concept.id);
                const isSelected = selected.includes(key);
                return (
                  <div key={key} className="structure-concept-row">
                    <label className="structure-concept">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleConcept(currentPart.id, concept.id)}
                      />
                      <span>
                        <strong>{concept.description}</strong>
                        <small>
                          {concept.basePrice.toLocaleString('es-ES')} €/
                          {UNIT_LABELS[concept.unit]}
                        </small>
                      </span>
                    </label>
                    {isSelected && (
                      <label className="structure-quantity">
                        Cantidad
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          aria-label={`Cantidad para ${concept.description}`}
                          value={quantities[key] ?? ''}
                          onChange={(event) => setQuantity(key, event.target.value)}
                        />
                        <span>{UNIT_LABELS[concept.unit]}</span>
                      </label>
                    )}
                  </div>
                );
              })}
              {!visibleConcepts.length && (
                <p className="text-sm text-gray-500 py-3">No hay coincidencias en esta partida.</p>
              )}
            </section>
          </>
        )}
        {review &&
          orderedParts.map((partId) => {
            const part = snapshot.parts.find((item) => item.id === partId);
            if (!part) return null;
            const concepts = picked
              .filter((item) => item.partId === partId)
              .sort((a, b) => compareSpanish(a.concept.description, b.concept.description));
            return (
              <section key={partId} className="structure-section">
                <div className="structure-review-heading">
                  <h3>{part.name}</h3>
                  <div className="flex">
                    <Button
                      variant="ghost"
                      aria-label={`Subir ${part.name}`}
                      disabled={reviewParts.indexOf(partId) === 0}
                      onClick={() => move(partId, -1)}
                    >
                      <ArrowUp size={16} />
                    </Button>
                    <Button
                      variant="ghost"
                      aria-label={`Bajar ${part.name}`}
                      disabled={reviewParts.indexOf(partId) === reviewParts.length - 1}
                      onClick={() => move(partId, 1)}
                    >
                      <ArrowDown size={16} />
                    </Button>
                    <Button
                      variant="ghost"
                      aria-label={`Quitar partida ${part.name}`}
                      onClick={() => removeReviewPart(partId)}
                    >
                      <X size={16} />
                    </Button>
                  </div>
                </div>
                {concepts.map(({ concept }) => {
                  const key = conceptKey(partId, concept.id);
                  const quantity = decimal(quantities[key] ?? '');
                  return (
                    <div key={concept.id} className="structure-review-concept">
                      <span>
                        {concept.description}
                        <small>
                          {quantity > 0
                            ? `${quantity.toLocaleString('es-ES')} ${UNIT_LABELS[concept.unit]}`
                            : 'Cantidad pendiente'}
                        </small>
                      </span>
                      <Button
                        variant="ghost"
                        aria-label={`Quitar ${concept.description}`}
                        onClick={() => toggleConcept(partId, concept.id)}
                      >
                        <X size={16} />
                      </Button>
                    </div>
                  );
                })}
              </section>
            );
          })}
      </div>
      <footer className="structure-footer">
        <p role="status">
          {picked.length}{' '}
          {picked.length === 1 ? 'concepto seleccionado' : 'conceptos seleccionados'}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          {step > 0 && (
            <Button variant="secondary" onClick={goBack}>
              Atrás
            </Button>
          )}
          {step < reviewStep ? (
            <Button disabled={stale || (step === 0 && !partIds.length)} onClick={goNext}>
              Continuar
            </Button>
          ) : (
            <Button disabled={stale || !picked.length} onClick={confirm}>
              <Check size={16} />
              Crear estructura
            </Button>
          )}
        </div>
      </footer>
    </Modal>
  );
}
