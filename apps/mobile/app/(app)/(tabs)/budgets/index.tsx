import { EmailVerificationNotice } from '../../../../src/features/account/EmailVerificationNotice';
import { useBudgetStore } from '../../../../src/state/stores';
import { Screen, Text } from '../../../../src/ui';

export default function BudgetsScreen() {
  const count = useBudgetStore((state) => state.records.length);
  return (
    <Screen edges={[]}>
      <EmailVerificationNotice />
      <Text tone="muted" testID="budgets-placeholder">
        {count === 1 ? 'Tienes 1 presupuesto.' : `Tienes ${count} presupuestos.`} La lista llegará
        en la siguiente entrega de la fase 1.
      </Text>
    </Screen>
  );
}
