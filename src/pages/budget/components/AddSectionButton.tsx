import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { useBudgetStore, useActiveBudget } from '@/entities/budget';
import { RENOVATION_CATEGORIES } from '@/entities/tariff';
import { Button } from '@/shared/ui';

export function AddSectionButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState('');
  const [mode, setMode] = useState<'catalog' | 'custom'>('catalog');
  const addSection = useBudgetStore((s) => s.addSection);
  const budget = useActiveBudget();

  const usedNames = useMemo(
    () => new Set(budget?.sections.map((s) => s.name) ?? []),
    [budget],
  );

  const availableCategories = useMemo(
    () => RENOVATION_CATEGORIES.filter((c) => !usedNames.has(c)),
    [usedNames],
  );

  const handleAdd = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    addSection(trimmed);
    setName('');
    setIsOpen(false);
    setMode('catalog');
  };

  const handleSelectCategory = (cat: string) => {
    if (!cat) return;
    addSection(cat);
    setName('');
  };

  if (!isOpen) {
    return (
      <Button variant="secondary" onClick={() => setIsOpen(true)} className="no-print">
        <Plus size={16} />
        Añadir sección
      </Button>
    );
  }

  return (
    <div className="no-print space-y-3 rounded-lg border border-gray-200 bg-white p-4">
      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 pb-2">
        <button
          onClick={() => setMode('catalog')}
          className={`text-xs px-3 py-1.5 rounded-t cursor-pointer transition-colors ${
            mode === 'catalog'
              ? 'bg-blue-50 text-blue-700 font-medium border border-b-0 border-blue-200'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Del catálogo
        </button>
        <button
          onClick={() => setMode('custom')}
          className={`text-xs px-3 py-1.5 rounded-t cursor-pointer transition-colors ${
            mode === 'custom'
              ? 'bg-blue-50 text-blue-700 font-medium border border-b-0 border-blue-200'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Personalizada
        </button>
      </div>

      {mode === 'catalog' ? (
        <div>
          {availableCategories.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {availableCategories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => handleSelectCategory(cat)}
                  className="text-xs px-2.5 py-1.5 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-blue-50 hover:border-blue-400 hover:text-blue-700 cursor-pointer transition-colors"
                >
                  {cat}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-400">Todas las categorías ya están añadidas</p>
          )}
        </div>
      ) : (
        <div className="flex items-end gap-2">
          <input
            placeholder="Nombre de sección personalizada"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            autoFocus
            className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500"
          />
          <Button onClick={handleAdd}>Añadir</Button>
        </div>
      )}

      <div className="flex justify-end">
        <Button variant="ghost" onClick={() => { setIsOpen(false); setName(''); setMode('catalog'); }}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
