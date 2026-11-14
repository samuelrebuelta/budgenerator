import { Redirect } from 'expo-router';
import { useSession } from '../src/session';

/**
 * Entry route. TODO(BG-014 D8): open the last used tab (saved in MMKV per UID); the first time,
 * Presupuestos.
 */
export default function Index() {
  const { status } = useSession();
  if (status === 'loading') return null;
  return <Redirect href={status === 'signedIn' ? '/budgets' : '/login'} />;
}
