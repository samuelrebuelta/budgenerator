// Grants or revokes the `admin` custom claim used by Firestore Rules and the UI.
//
//   node scripts/set-admin-claim.mjs --project <projectId> --email <email> [--revoke] [--apply]
//
// Without --apply it only prints what would change (dry run). Against a real
// project it uses Application Default Credentials (`gcloud auth application-default
// login`) and requires typing the project id again in --confirm <projectId>.
// With FIREBASE_AUTH_EMULATOR_HOST set it talks to the local emulator instead.
//
// The user must sign out and in again (or wait up to one hour) to receive the
// new ID token. The script also mirrors the flag in `users/{uid}.accountData.isAdmin`,
// which is informative only: Rules trust the claim, never the document.
import { createRequire } from 'node:module';

const require = createRequire(new URL('../functions/package.json', import.meta.url));
const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');

function arg(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const projectId = arg('project');
const email = arg('email');
const revoke = process.argv.includes('--revoke');
const apply = process.argv.includes('--apply');
const emulator = Boolean(process.env.FIREBASE_AUTH_EMULATOR_HOST);

if (!projectId || !email) {
  console.error(
    'Uso: node scripts/set-admin-claim.mjs --project <id> --email <email> [--revoke] [--apply]',
  );
  process.exit(1);
}
if (apply && !emulator && arg('confirm') !== projectId) {
  console.error(`Proyecto real: repite el id con --confirm ${projectId} para aplicar el cambio.`);
  process.exit(1);
}

initializeApp({ projectId });
const auth = getAuth();
const user = await auth.getUserByEmail(email);
const claims = { ...(user.customClaims ?? {}) };
if (revoke) delete claims.admin;
else claims.admin = true;

console.log(
  `${apply ? 'Aplicando' : 'Simulación'}: ${revoke ? 'retirar' : 'asignar'} admin a ${email} (${user.uid}) en ${projectId}${emulator ? ' [emulador]' : ''}.`,
);
console.log(
  `Claims actuales: ${JSON.stringify(user.customClaims ?? {})} → nuevos: ${JSON.stringify(claims)}`,
);
if (!user.emailVerified) console.warn('⚠ El email de esta cuenta no está verificado.');
if (!apply) {
  console.log('No se ha cambiado nada. Añade --apply para aplicar.');
  process.exit(0);
}

await auth.setCustomUserClaims(user.uid, claims);
const userRef = getFirestore().doc(`users/${user.uid}`);
if ((await userRef.get()).exists) await userRef.update({ 'accountData.isAdmin': !revoke });
console.log('Hecho. La cuenta debe cerrar sesión y volver a entrar para aplicar el cambio.');
