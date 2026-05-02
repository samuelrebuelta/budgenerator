import { Plus } from 'lucide-react';
import { useBudgetStore, useActiveBudget } from '@/entities/budget';
import { Button } from '@/shared/ui';
import { t } from '@/shared/i18n';

interface AddTaskButtonProps {
  workItemId: string;
}

export function AddTaskButton({ workItemId }: AddTaskButtonProps) {
  const addTask = useBudgetStore((s) => s.addTask);
  const budget = useActiveBudget();
  const workItem = budget?.workItems.find((wi) => wi.id === workItemId);
  const hasDraft = workItem?.tasks.some(
    (t) => !t.description && t.quantity === 0 && t.price === 0,
  );

  return (
    <Button
      variant="ghost"
      onClick={() => addTask(workItemId)}
      className="text-xs no-print"
      disabled={hasDraft}
    >
      <Plus size={14} />
      {t.editor.addTask}
    </Button>
  );
}
