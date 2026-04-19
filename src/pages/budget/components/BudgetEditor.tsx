import { Trash2, GripVertical } from 'lucide-react';
import { useBudgetStore, useActiveBudget } from '@/entities/budget';
import { AddRowButton } from './AddRowButton';
import { TariffSelector } from './TariffSelector';
import { UNIT_LABELS } from '@/shared/types';
import type { Unit } from '@/shared/types';
import { formatCurrency } from '@/shared/lib';
import { Button } from '@/shared/ui';

export function BudgetEditor() {
  const budget = useActiveBudget();
  const sections = budget?.sections ?? [];
  const removeSection = useBudgetStore((s) => s.removeSection);
  const renameSection = useBudgetStore((s) => s.renameSection);
  const updateRow = useBudgetStore((s) => s.updateRow);
  const removeRow = useBudgetStore((s) => s.removeRow);
  const getSectionSubtotal = useBudgetStore((s) => s.getSectionSubtotal);
  const getRowAmount = useBudgetStore((s) => s.getRowAmount);

  if (sections.length === 0) {
    return (
      <div className="py-12 text-center text-gray-400">
        <p className="text-lg">Sin secciones</p>
        <p className="text-sm mt-1">Añade una sección para empezar a crear tu presupuesto</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {sections.map((section) => (
        <div key={section.id} className="border border-gray-200 rounded-lg overflow-hidden">
          {/* Section Header */}
          <div className="bg-gray-50 px-4 py-3 flex items-center justify-between border-b border-gray-200">
            <div className="flex items-center gap-2">
              <GripVertical size={16} className="text-gray-400 no-print" />
              <input
                value={section.name}
                onChange={(e) => renameSection(section.id, e.target.value)}
                className="font-semibold text-gray-900 bg-transparent border-none outline-none text-sm print:font-bold"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-600">
                Subtotal: {formatCurrency(getSectionSubtotal(section.id))}
              </span>
              <Button
                variant="danger"
                onClick={() => removeSection(section.id)}
                className="no-print"
              >
                <Trash2 size={14} />
              </Button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <th className="px-4 py-2 w-[36%]">Descripción</th>
                  <th className="px-4 py-2 w-[10%] text-right">Cant.</th>
                  <th className="px-4 py-2 w-[10%] text-center">Ud.</th>
                  <th className="px-4 py-2 w-[12%] text-right">Precio</th>
                  <th className="px-4 py-2 w-[12%] text-right">Importe</th>
                  <th className="px-4 py-2 w-[12%] text-right no-print">Margen</th>
                  <th className="px-4 py-2 w-[8%] text-center no-print"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {section.rows.map((row) => {
                  const amount = getRowAmount(row);
                  return (
                    <tr key={row.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <input
                            value={row.description}
                            onChange={(e) =>
                              updateRow(section.id, row.id, { description: e.target.value })
                            }
                            placeholder="Descripción de la partida"
                            className="w-full bg-transparent border-none outline-none text-sm"
                          />
                          <TariffSelector sectionId={section.id} rowId={row.id} sectionName={section.name} />
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={row.quantity || ''}
                          onChange={(e) =>
                            updateRow(section.id, row.id, {
                              quantity: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="w-full bg-transparent border-none outline-none text-right text-sm"
                          placeholder="0"
                        />
                      </td>
                      <td className="px-4 py-2 text-center">
                        <select
                          value={row.unit}
                          onChange={(e) =>
                            updateRow(section.id, row.id, { unit: e.target.value as Unit })
                          }
                          className="bg-transparent border-none outline-none text-sm text-center cursor-pointer print:appearance-none"
                        >
                          {Object.entries(UNIT_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={row.price || ''}
                          onChange={(e) =>
                            updateRow(section.id, row.id, {
                              price: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="w-full bg-transparent border-none outline-none text-right text-sm"
                          placeholder="0.00"
                        />
                      </td>
                      <td className="px-4 py-2 text-right font-medium text-gray-700">
                        {formatCurrency(amount)}
                      </td>
                      <td className="px-4 py-2 text-right no-print">
                        {row.cost > 0 ? (
                          <span className={`text-xs font-medium ${
                            row.price > row.cost ? 'text-green-600' : row.price < row.cost ? 'text-red-500' : 'text-gray-400'
                          }`}>
                            {((row.price - row.cost) * row.quantity).toFixed(2)}€
                            <span className="ml-1 text-gray-400">
                              ({row.price > 0 ? (((row.price - row.cost) / row.price) * 100).toFixed(0) : 0}%)
                            </span>
                          </span>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-center no-print">
                        <button
                          onClick={() => removeRow(section.id, row.id)}
                          className="text-gray-400 hover:text-red-500 transition-colors cursor-pointer"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Add Row */}
          <div className="px-4 py-2 border-t border-gray-100">
            <AddRowButton sectionId={section.id} />
          </div>
        </div>
      ))}
    </div>
  );
}
