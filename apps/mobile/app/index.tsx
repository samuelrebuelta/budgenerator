import { Redirect } from 'expo-router';
import { readLastTab } from '../src/navigation/lastTab';
import { useSession } from '../src/session';

/** Entry route. D8: the last tab used on this device (MMKV of the UID); the first time, Presupuestos. */
export default function Index() {
  const { status, uid } = useSession();
  if (status === 'loading') return null;
  if (status === 'signedOut') return <Redirect href="/login" />;
  return <Redirect href={`/${readLastTab(uid)}`} />;
}
