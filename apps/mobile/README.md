# @bg/mobile — app nativa de BudGenerator

App iOS/Android de la [spec BG-014](../../docs/specs/BG-014-app-nativa.md): Expo (SDK 58) con Expo Router, dev client y CNG (`ios/` y `android/` se generan con `expo prebuild` y no se versionan). Usa `@bg/domain` y `@bg/ui-tokens` del workspace y `@react-native-firebase` para Auth, Firestore y Functions.

## Variantes

`APP_VARIANT` (por defecto `development`) elige la variante en `app.config.ts`:

| Variante      | Bundle id / paquete            | Firebase                                                                             |
| ------------- | ------------------------------ | ------------------------------------------------------------------------------------ |
| `development` | `com.budgenerator.app.dev`     | Emuladores de `demo-budgenerator` (ficheros ficticios en `firebase/development`)     |
| `preview`     | `com.budgenerator.app.preview` | Ficheros reales por secreto de EAS (`GOOGLE_SERVICES_PLIST`, `GOOGLE_SERVICES_JSON`) |
| `production`  | `com.budgenerator.app`         | Igual que `preview`                                                                  |

La app falla al arrancar si `development` no apunta a un proyecto `demo-*` o si las otras variantes sí lo hacen.

## Arrancar en local con emuladores

Requisitos: Node 24, pnpm 10, Xcode (iOS) o Android SDK + JDK 21 (Android), CocoaPods y Java para los emuladores de Firebase.

```bash
pnpm install                                  # desde la raíz del repositorio
pnpm build:functions                          # si vas a llamar a callables
pnpm exec firebase emulators:start --project demo-budgenerator --only auth,firestore,functions

cd apps/mobile
pnpm exec expo prebuild --clean               # genera ios/ y android/
LANG=en_US.UTF-8 pnpm ios                     # compila el dev client y lo abre en el simulador
pnpm android                                  # ídem en el emulador de Android
pnpm start                                    # sólo Metro, si el dev client ya está instalado
```

El simulador de iOS llega a los emuladores por `localhost` y el emulador de Android por `10.0.2.2` (`src/platform/firebase.ts`). En un dispositivo físico, exporta `EXPO_PUBLIC_EMULATOR_HOST=<IP del Mac>` antes de `pnpm start`. Los puertos son los de `firebase.json` (Auth 9199, Firestore 8180, Functions 5001); si otro proyecto los ocupa, arranca los emuladores con otra configuración y exporta `EXPO_PUBLIC_FIREBASE_AUTH_EMULATOR_PORT`, `EXPO_PUBLIC_FIREBASE_FIRESTORE_EMULATOR_PORT` y `EXPO_PUBLIC_FIREBASE_FUNCTIONS_EMULATOR_PORT` antes de `pnpm start`. CocoaPods necesita `LANG=en_US.UTF-8` en la shell.

En el simulador de iOS, el dev client tiene que estar firmado ad hoc (lo hace `pnpm ios` o `xcodebuild` con `CODE_SIGN_IDENTITY=-`): con `CODE_SIGNING_ALLOWED=NO` el binario no lleva entitlements y Firebase Auth falla con `auth/keychain-error`.

Las cuentas de prueba se crean desde la propia app (registro) contra el emulador de Auth. El enlace de verificación no se envía: el emulador lo deja en `http://localhost:9199/emulator/v1/projects/demo-budgenerator/oobCodes`, y abrirlo marca el email como verificado («Ya lo he verificado» en la app). En `development`, Metro avisa (`[runtime]`) si falta alguna API web que usan `@bg/domain` y jsPDF en Hermes. Los spikes de fase 0 se retiraron en la fase 1; su código está en el commit `ae6a037` y el resultado en el [informe](../../docs/specs/plans/2026-11-14-bg-014-spikes.md).

## Comprobaciones

```bash
pnpm --filter @bg/mobile typecheck
pnpm --filter @bg/mobile test                 # Jest (jest-expo) + React Native Testing Library
pnpm lint && pnpm format:check                # desde la raíz; incluyen apps/mobile
```

## Recursos generados

- Fuentes: `python3 apps/mobile/scripts/build-fonts.py` crea los TTF estáticos de Manrope y Fraunces desde `@fontsource-variable` (necesita `fonttools[woff]`).
- Icono y splash: `node apps/mobile/scripts/build-icons.mjs` los crea desde `public/brand`.
