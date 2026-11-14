import { projectWorkItems, type ConstructionDocument } from '../construction-document/index.js';
import { createSupplementWorkItem } from './supplements';
import type { ProjectSupplement, ProjectSupplementVoid, ProjectWorkItem } from './types';

/** `projects/{id}/progress/state`: completion date per item occurrence (node ID) or supplement. */
export interface ProjectProgressState {
  completed: Record<string, string>;
  updatedAt: string;
}

/**
 * Derived project structure: chapters and items of the locked budget document plus the
 * supplements, with completion dates applied. Nothing here is persisted.
 */
export function buildProjectWorkItems(
  document: ConstructionDocument,
  supplements: readonly ProjectSupplement[],
  supplementVoids: readonly ProjectSupplementVoid[],
  completed: Readonly<Record<string, string>>,
): ProjectWorkItem[] {
  const budgetItems = projectWorkItems(document)
    .filter((workItem) => workItem.tasks.length > 0)
    .map((workItem, position): ProjectWorkItem => ({
      id: workItem.id,
      name: workItem.name,
      position,
      ...(workItem.catalogPartId ? { catalogPartId: workItem.catalogPartId } : {}),
      tasks: workItem.tasks.map((task) =>
        completed[task.id] ? { ...task, completedAt: completed[task.id] } : { ...task },
      ),
    }));
  const voids = new Map(supplementVoids.map((item) => [item.supplementId, item.voidedAt]));
  const supplementItems = [...supplements]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((supplement, index) => {
      const workItem = createSupplementWorkItem(supplement, budgetItems.length + index);
      const voidedAt = voids.get(supplement.id);
      return {
        ...workItem,
        ...(voidedAt ? { voidedAt } : {}),
        tasks: workItem.tasks.map((task) =>
          completed[task.id] ? { ...task, completedAt: completed[task.id] } : task,
        ),
      };
    });
  return [...budgetItems, ...supplementItems];
}
