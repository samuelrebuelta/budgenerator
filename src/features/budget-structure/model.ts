import type { Budget, BudgetTask, CatalogPart, WorkItem } from '@/shared/types';
import { compareSpanish, normalizeCatalogText } from '@/entities/catalog/search';

export function conceptKey(partId: string, conceptId: string): string {
  return JSON.stringify([partId, conceptId]);
}

function legacyKey(partName: string, description: string, unit: string): string {
  return JSON.stringify([normalizeCatalogText(partName), normalizeCatalogText(description), unit]);
}

function sourceKey(partId: string, conceptId: string): string {
  return JSON.stringify([partId, conceptId]);
}

export function rankPartConcepts(
  parts: readonly CatalogPart[],
  budgets: readonly Budget[],
  currentId: string,
) {
  const counts = new Map<string, number>();
  const legacyCandidates = new Map<string, string[]>();
  for (const part of parts) {
    for (const concept of part.concepts) {
      const key = legacyKey(part.name, concept.description, concept.unit);
      legacyCandidates.set(key, [
        ...(legacyCandidates.get(key) ?? []),
        sourceKey(part.id, concept.id),
      ]);
    }
  }

  for (const budget of budgets) {
    if (budget.id === currentId) continue;
    const usedConcepts = new Set<string>();
    for (const item of budget.workItems) {
      for (const task of item.tasks) {
        if (task.quantity <= 0) continue;
        if (item.catalogPartId && task.catalogConceptId) {
          usedConcepts.add(sourceKey(item.catalogPartId, task.catalogConceptId));
        } else {
          for (const key of legacyCandidates.get(
            legacyKey(item.name, task.description, task.unit),
          ) ?? [])
            usedConcepts.add(key);
        }
      }
    }
    for (const key of usedConcepts) counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return parts
    .flatMap((part) =>
      part.concepts.map((concept) => ({
        partId: part.id,
        partName: part.name,
        concept,
        uses: counts.get(sourceKey(part.id, concept.id)) ?? 0,
      })),
    )
    .sort(
      (a, b) =>
        b.uses - a.uses ||
        compareSpanish(a.partName, b.partName) ||
        compareSpanish(a.concept.description, b.concept.description) ||
        a.concept.id.localeCompare(b.concept.id),
    );
}

export function structureFromSelection(
  parts: readonly CatalogPart[],
  partIds: readonly string[],
  selectedConceptKeys: readonly string[],
  quantities: Readonly<Record<string, number>> = {},
): WorkItem[] {
  const selectedParts = [...new Set(partIds)];
  const selected = new Set(selectedConceptKeys);
  const byId = new Map(parts.map((part) => [part.id, part]));
  if (selectedParts.some((id) => !byId.has(id)))
    throw Error('El catálogo ha cambiado. Revisa la selección.');

  const knownConceptKeys = new Set(
    selectedParts.flatMap((partId) =>
      (byId.get(partId)?.concepts ?? []).map((concept) => conceptKey(partId, concept.id)),
    ),
  );
  if ([...selected].some((key) => !knownConceptKeys.has(key)))
    throw Error('El catálogo ha cambiado. Revisa la selección.');

  return selectedParts
    .map((partId) => {
      const part = byId.get(partId);
      if (!part) throw Error('El catálogo ha cambiado. Revisa la selección.');
      const concepts = part.concepts
        .filter((concept) => selected.has(conceptKey(part.id, concept.id)))
        .sort((a, b) => compareSpanish(a.description, b.description));
      return {
        id: part.id,
        name: part.name,
        catalogPartId: part.id,
        tasks: concepts.map((concept) => {
          const quantity = quantities[conceptKey(part.id, concept.id)] ?? 0;
          if (!Number.isFinite(quantity) || quantity < 0)
            throw Error('Las cantidades deben ser números positivos.');
          return {
            id: concept.id,
            catalogConceptId: concept.id,
            description: concept.description,
            quantity,
            unit: concept.unit,
            price: concept.basePrice,
            cost: concept.cost,
          } satisfies BudgetTask;
        }),
      };
    })
    .filter((item) => item.tasks.length > 0);
}
