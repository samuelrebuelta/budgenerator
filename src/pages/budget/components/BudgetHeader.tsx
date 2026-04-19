import { useBudgetStore, useActiveBudget } from '@/entities/budget';
import { Input } from '@/shared/ui';

export function BudgetHeader() {
  const budget = useActiveBudget();
  const updateInfo = useBudgetStore((s) => s.updateInfo);

  if (!budget) return null;
  const { info } = budget;

  return (
    <div className="border-b border-gray-200 pb-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-4 print:text-xl">Presupuesto de Reforma</h1>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Input
          id="clientName"
          label="Nombre del cliente"
          value={info.clientName}
          onChange={(e) => updateInfo({ clientName: e.target.value })}
          placeholder="Nombre completo del cliente"
        />
        <Input
          id="address"
          label="Dirección de la vivienda"
          value={info.address}
          onChange={(e) => updateInfo({ address: e.target.value })}
          placeholder="Calle, número, piso..."
        />
        <Input
          id="date"
          label="Fecha"
          type="date"
          value={info.date}
          onChange={(e) => updateInfo({ date: e.target.value })}
        />
        <Input
          id="budgetNumber"
          label="Nº Presupuesto"
          value={info.budgetNumber}
          onChange={(e) => updateInfo({ budgetNumber: e.target.value })}
          placeholder="Ej. 26038"
        />
      </div>
    </div>
  );
}
