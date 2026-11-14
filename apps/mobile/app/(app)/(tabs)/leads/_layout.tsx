import { Stack } from 'expo-router';
import { detailOptions, tabRootOptions } from '../../../../src/navigation/options';

/**
 * Leads stack: list → detail. A deep link (`/profile/solicitudes?leadId=…`) or a notification
 * opens the detail directly; `anchor` keeps the list under it so «back» goes there.
 */
export const unstable_settings = { anchor: 'index' };

export default function SolicitudesLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={tabRootOptions('Solicitudes')} />
      <Stack.Screen name="[leadId]" options={detailOptions('Solicitud')} />
    </Stack>
  );
}
