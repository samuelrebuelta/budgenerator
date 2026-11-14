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

## Diseño nativo

La app usa el lenguaje de cada sistema y no imita la web: Liquid Glass en iOS 26 y Material 3 en Android. Los tokens de `@bg/ui-tokens` siguen siendo la base de color (marca, texto, estados); el sistema pone el material (vidrio, superficies tonales, ripple) y las formas. Las pantallas nuevas se montan con las primitivas de `src/ui` y las opciones de `src/navigation/options.tsx`, sin estilos de plataforma sueltos.

| Pieza               | iOS 26 (Liquid Glass)                                                                                           | Android (Material 3)                                                                                        | API                                                                    |
| ------------------- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Tabs                | Barra flotante de vidrio del sistema, SF Symbols (contorno, relleno al seleccionar), se minimiza al bajar       | Barra de navegación M3 sobre `sidebar`, indicador `highlight`, Material Symbols, etiquetas siempre visibles | `NativeTabs` de `expo-router/native-tabs` (estable en SDK 58)          |
| Cabecera            | Sin fondo propio: cabecera transparente de vidrio con efecto de borde; título grande en Fraunces en las tabs    | Top app bar pequeña M3 sobre `canvas`, título a la izquierda (22 sp), sin sombra                            | `tabRootOptions` / `menuScreenOptions` (native stack)                  |
| Botón de cabecera   | Bar button sobre el fondo de vidrio compartido de la cabecera                                                   | Icon button estándar (48 dp, ripple sin borde)                                                              | `HeaderIconButton`                                                     |
| Menú de cuenta      | `formSheet` con detents 60 % / 100 % y grabber; el vidrio de la hoja se ve detrás (`Screen transparent`)        | Modal a pantalla completa (react-native-screens no admite un stack anidado en su bottom sheet)              | `presentation` en `app/(app)/_layout.tsx`                              |
| Botón               | `primary`/`danger`: vidrio teñido interactivo (cápsula 50 pt); `secondary`: vidrio claro; `ghost`/`link`: texto | `primary`/`danger`: filled; `secondary`: filled tonal (`highlight`); `ghost`/`link`: text button; ripple    | `Button` (`GlassSurface` en iOS)                                       |
| Superficie flotante | Vidrio (`GlassView`), p. ej. el toast                                                                           | Superficie sólida con borde                                                                                 | `GlassSurface`                                                         |
| Contenido           | Nunca en vidrio: bloques opacos tipo inset grouped (24 pt, esquinas continuas)                                  | Tarjeta elevada M3 (12 dp, elevación 1) y listas de 56 dp con ripple                                        | `Card`, `ListGroup` + `ListRow`                                        |
| Campo de texto      | Campo redondeado (12 pt), etiqueta encima                                                                       | Campo outlined M3 (56 dp, 4 dp, contorno de 2 dp `primary` con foco), etiqueta encima                       | `TextField`                                                            |
| Fecha               | Botón compacto del sistema que abre el calendario en un popover; sin fecha, calendario en línea desplegable     | Chip que abre el selector de fecha M3 (diálogo)                                                             | `DateField` (`@react-native-community/datetimepicker`)                 |
| Iconos              | SF Symbols                                                                                                      | Material Symbols                                                                                            | `Icon` con nombres Feather y la tabla `SYSTEM_ICONS` de `expo-symbols` |
| Área táctil         | ≥ 44 pt                                                                                                         | ≥ 48 dp                                                                                                     | `touchTarget`, `controlHeight`                                         |

Reglas:

- **Vidrio sólo en la capa de navegación y controles flotantes** (barras, botones, toasts), nunca en tarjetas ni listas. No animes la opacidad de un `GlassView` ni de sus padres: UIKit deja de dibujar el vidrio.
- **Accesibilidad:** `useNativeLook()` devuelve `glass` sólo en iOS 26 sin «Reducir transparencia» ni «Aumentar contraste»; con cualquiera de los dos (o en iOS < 26) las primitivas dibujan superficies sólidas con borde. Las barras del sistema se adaptan solas. Etiquetas accesibles en todos los controles de sólo icono.
- **Sin modo oscuro (v1):** `userInterfaceStyle: 'light'` fuerza claro en todo el sistema y `GlassSurface` fija `colorScheme="light"`, así que el vidrio no se oscurece aunque el dispositivo esté en oscuro.
- **Color de marca frente al del sistema:** en Android no se usa el color dinámico de Material You (sustituiría la marca); los roles M3 se rellenan con tokens (`systemColors` en `src/ui/theme.ts`). En iOS el tinte del vidrio y de las barras es `primary`. La tipografía es la de la marca (Manrope y Fraunces) en ambas plataformas.
- **Android edge-to-edge:** React Native 0.88 dibuja siempre bajo las barras del sistema; las pantallas usan el área segura de `Screen` y la barra de tabs aplica su propio inset.

## Presupuestos

Lista (`FlashList` con búsqueda nativa en la cabecera, deslizar para borrar y tirar para recargar), detalle y editor sobre el documento BC3 canónico (`src/features/budgets`, rutas `app/(app)/(tabs)/budgets`). Partida, capítulo y «Crear paso a paso» se abren como hojas nativas. Todos los importes salen de `budgetTotals` y sus funciones de `@bg/domain` (`src/features/budgets/model.ts`); `tests/budgetParity.test.ts` comprueba que coinciden con el editor web, el visor público y la lista. Sin conexión, editar un presupuesto guardado se bloquea con el aviso de BG-012; el borrador es local hasta «Guardar». El PDF se genera con `buildBudgetDocument` y se comparte con la hoja del sistema; el enlace público exige el email verificado y apunta al visor web (`/shared/:token`).

## Proyectos

Lista (`FlashList` con búsqueda nativa, filtro por estado y tirar para recargar) y detalle (`src/features/projects`, rutas `app/(app)/(tabs)/projects`): avance con `workItemProgress` de `@bg/domain`, marcar y desmarcar partidas (fila tipo casilla con háptica de `expo-haptics` tras la transacción), completar capítulo, fecha estimada de fin y fechas de finalización con el selector de fecha nativo, ampliaciones y su anulación, y la evolución (`[projectId]/history`) como hojas nativas. Los importes de la ampliación se previsualizan con `buildProjectSupplement`, la misma función de la transacción. «Convertir en proyecto» está en el detalle de un presupuesto aceptado. Todas las mutaciones se bloquean sin conexión con el aviso de BG-012 (D4: marcar sin red es fase 3). Las asignaciones de equipo siguen en la web hasta la tab Equipo.

## Flujo Maestro

`.maestro/budget-pdf.yaml` recorre login → nuevo presupuesto → capítulo y partida → guardar → PDF en la hoja de compartir; `.maestro/project-mark.yaml`, login → presupuesto → aceptar → convertir en proyecto → marcar partida. Maestro no forma parte del repositorio:

```bash
curl -fsSL "https://get.maestro.mobile.dev" | bash   # instala la CLI (necesita Java 17+)
pnpm exec firebase emulators:start --project demo-budgenerator --only auth,firestore
# crea la cuenta en el emulador (registro en la app o REST de Auth) y arranca Metro + el dev client
maestro test apps/mobile/.maestro/budget-pdf.yaml -e EMAIL=<cuenta demo> -e PASSWORD=<contraseña demo>
maestro test apps/mobile/.maestro/project-mark.yaml -e EMAIL=<cuenta demo> -e PASSWORD=<contraseña demo>
```

## Comprobaciones

```bash
pnpm --filter @bg/mobile typecheck
pnpm --filter @bg/mobile test                 # Jest (jest-expo) + React Native Testing Library
pnpm lint && pnpm format:check                # desde la raíz; incluyen apps/mobile
```

## Recursos generados

- Fuentes: `python3 apps/mobile/scripts/build-fonts.py` crea los TTF estáticos de Manrope y Fraunces desde `@fontsource-variable` (necesita `fonttools[woff]`).
- Icono y splash: `node apps/mobile/scripts/build-icons.mjs` los crea desde `public/brand`.
