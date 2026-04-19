import { Plus } from 'lucide-react';
import { useBudgetStore } from '@/entities/budget';
import { Button } from '@/shared/ui';

interface AddRowButtonProps {
  sectionId: string;
}

export function AddRowButton({ sectionId }: AddRowButtonProps) {
  const addRow = useBudgetStore((s) => s.addRow);

  return (
    <Button
      variant="ghost"
      onClick={() => addRow(sectionId)}
      className="text-xs no-print"
    >
      <Plus size={14} />
      Añadir fila
    </Button>
  );
}
