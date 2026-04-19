import { Plus } from 'lucide-react';
import { useBudgetStore, useActiveBudget } from '@/entities/budget';
import { Button } from '@/shared/ui';
import { t } from '@/shared/i18n';

interface AddRowButtonProps {
  sectionId: string;
}

export function AddRowButton({ sectionId }: AddRowButtonProps) {
  const addRow = useBudgetStore((s) => s.addRow);
  const budget = useActiveBudget();
  const section = budget?.sections.find((s) => s.id === sectionId);
  const hasDraft = section?.rows.some(
    (r) => !r.description && r.quantity === 0 && r.price === 0,
  );

  return (
    <Button
      variant="ghost"
      onClick={() => addRow(sectionId)}
      className="text-xs no-print"
      disabled={hasDraft}
    >
      <Plus size={14} />
      {t.editor.addRow}
    </Button>
  );
}
