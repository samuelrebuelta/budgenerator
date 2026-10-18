import { money } from '@/shared/lib/budgetMath';
import type { Unit } from '@/shared/types';
import type { NewProjectSupplement, Project, ProjectSupplement, ProjectWorkItem } from './types';

const units: readonly Unit[] = ['m2', 'm3', 'ml', 'unit', 'hour'];

export function buildProjectSupplement(
  project: Project,
  id: string,
  input: NewProjectSupplement,
  createdAt: string,
): ProjectSupplement {
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(id))
    throw new Error('El identificador de la ampliación no es válido.');
  const description = input.description.trim();
  if (!description || description.length > 300)
    throw new Error('La descripción debe tener entre 1 y 300 caracteres.');
  if (!Number.isFinite(input.quantity) || input.quantity <= 0 || input.quantity > 1_000_000)
    throw new Error('La cantidad debe ser mayor que cero.');
  if (!units.includes(input.unit as Unit)) throw new Error('La unidad no es válida.');
  if (!Number.isFinite(input.unitPrice) || input.unitPrice <= 0 || input.unitPrice > 1_000_000)
    throw new Error('El precio unitario debe ser mayor que cero.');
  if (!Number.isFinite(project.ivaRate) || project.ivaRate < 0 || project.ivaRate > 1)
    throw new Error('El IVA del presupuesto aceptado no es válido.');
  if (!Number.isFinite(Date.parse(createdAt))) throw new Error('La fecha de alta no es válida.');

  const subtotal = money(input.quantity * input.unitPrice);
  const iva = money(subtotal * project.ivaRate);
  return {
    id,
    description,
    quantity: input.quantity,
    unit: input.unit,
    unitPrice: input.unitPrice,
    vatRate: project.ivaRate,
    subtotal,
    iva,
    total: money(subtotal + iva),
    createdAt,
    workItemId: `supplement_${id}`,
  };
}

export function createSupplementWorkItem(
  supplement: ProjectSupplement,
  position: number,
): ProjectWorkItem {
  return {
    id: supplement.workItemId,
    name: supplement.description,
    position,
    supplementId: supplement.id,
    tasks: [
      {
        id: `concept_${supplement.id}`,
        description: supplement.description,
        quantity: supplement.quantity,
        unit: supplement.unit as Unit,
        price: supplement.unitPrice,
        cost: 0,
      },
    ],
  };
}
