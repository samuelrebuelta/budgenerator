import { Redirect, useLocalSearchParams } from 'expo-router';
import { leadIdFromDeepLink } from '../../../src/features/leads/model';

/**
 * Web path of the leads page, so the links the web and the notifications use also open the app:
 * `budgenerator://profile/solicitudes?leadId=…` and, once universal links / App Links are set up,
 * `https://budgenerator.web.app/profile/solicitudes?leadId=…`. The query is validated with
 * `notifications/navigation` of `@bg/domain` (one safe `leadId`, nothing else): a valid one opens
 * the list, which pushes the detail; anything else opens the list with the web's «no disponible»
 * notice, and no `leadId` at all just opens the list. Inside `(app)`, so the session guard applies
 * first.
 */
export default function LeadsDeepLink() {
  const params = useLocalSearchParams<Record<string, string | string[]>>();
  if (Object.keys(params).length === 0) return <Redirect href="/leads" />;
  const leadId = leadIdFromDeepLink(params);
  if (!leadId) return <Redirect href={{ pathname: '/leads', params: { notice: 'unavailable' } }} />;
  // The list opens the detail on top of itself, so «back» always lands on the list.
  return <Redirect href={{ pathname: '/leads', params: { leadId } }} />;
}
