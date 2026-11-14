# BG-014 — App nativa iOS/Android con React Native y Expo

Estado: aprobado

Fecha: 2026-11-14. Detalle técnico y justificación: [análisis de la app nativa](../analysis/native-app-plan.md) (antes BG-N01). Las decisiones D1–D10 se revisaron con el propietario el 14-11-2026 y la spec quedó aprobada ese mismo día. La aprobación autoriza el trabajo de las fases en PRs separadas; los despliegues, envíos a tienda y cambios de reglas siguen necesitando instrucción explícita (AGENTS.md).

## Objetivo

Dar a la empresa de reformas una app nativa de BudGenerator para iPhone y Android que resuelva lo que la PWA no cubre bien en obra: avisos de solicitudes fiables con la app cerrada, consulta sin conexión que sobrevive a cerrar la app, compartir el PDF con el menú nativo del móvil, fotos de obra y presencia en App Store y Google Play. La app reutiliza el dominio TypeScript y el mismo proyecto Firebase, sin divergir en importes ni reglas de negocio respecto a la web.

## Decisiones

| ID  | Decisión                                                                                                                                                                                                 |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Monorepo pnpm **incremental**: `apps/mobile` y `packages/*` (`@bg/domain`, `@bg/firebase-api`, `@bg/app-core`, `@bg/ui-tokens`); la web sigue en la raíz hasta la beta móvil.                            |
| D2  | `@react-native-firebase` en móvil y SDK JS en web, con repositorios de datos inyectables. Condicionado al spike de fase 0; si no es viable, repositorios por plataforma con una suite de contrato común. |
| D3  | Persistencia en disco de Firestore **sólo en nativo** (en web se mantiene BG-012). Al cerrar sesión o cambiar de cuenta: `terminate` + `clearPersistence` + borrado de MMKV del UID.                     |
| D4  | Sin conexión sólo se podrá **marcar partidas** (fase 3, spec propia). El resto de mutaciones offline siguen bloqueadas con el toast de BG-012.                                                           |
| D5  | **No se crea proyecto de staging.** Desarrollo y QA contra emuladores `demo-*`; lo que exige dispositivo físico va contra `budgenerator` sólo con cuentas sintéticas, borradas al terminar.              |
| D6  | Titular de las cuentas de tienda, bundle ID definitivo y nombre: **se deciden antes de la fase 4.** Hasta entonces, `com.budgenerator.app` como identificador provisional.                               |
| D7  | App **gratuita**, sin precios, compras ni enlaces de pago mientras BG-004 siga aplazado. Las cuentas `premium` asignadas por administración funcionan igual.                                             |
| D8  | La app abre en la **última tab usada**; la primera vez, Presupuestos.                                                                                                                                    |
| D9  | **iOS y Android a la vez, sólo teléfono** en v1.                                                                                                                                                         |
| D10 | Fase 3: **marcar partidas sin red, fotos de obra y abrir la obra en Mapas.** La firma del cliente queda fuera.                                                                                           |

## Alcance y exclusiones

- Incluye (MVP, fases 1–2):
  - Registro con aceptación de condiciones versionada, verificación de email, login y recuperación de contraseña.
  - Presupuestos sobre el modelo canónico BC3: lista, detalle, editor, alta guiada desde catálogo, aceptación, PDF compartido con el menú nativo y enlace público.
  - Proyectos: lista, detalle, marcar partidas, fechas, suplementos, anulaciones e historial.
  - Equipo: planificación semanal, asignaciones diarias, trabajos puntuales, personas y cuadrillas.
  - Solicitudes con push nativo y apertura directa del lead.
  - Mi cuenta: perfil de empresa con logo desde galería, avisos, contraseña y borrado de cuenta.
  - Catálogo, plantillas, resumen del estimador y ayuda.
  - Consulta offline de lo ya sincronizado.
- Incluye (fase 3, cada punto con spec propia): marcar partidas sin red, fotos de obra con Cloud Storage y abrir la obra en Mapas.
- No incluye:
  - Se queda sólo en web: administración, configuración completa del estimador, estimador público, visor público, enlaces cortos, avisos de privacidad públicos, textos legales, importación y exportación de ficheros BC3, y exportación de datos de la cuenta.
  - Tablet, modo oscuro, analítica de producto, compras in-app, firma del cliente, proyecto de staging, integración con Web Factory Lite, IA y cuentas para trabajadores.

## Lo que ya existe en `main`

Comprobado sobre `57129b7`; no hay que construirlo de nuevo para la app.

- `deleteAccount` y `exportAccount` (`functions/src/account/account.ts`), con reautenticación reciente y la sección de datos de `/account` en la web.
- Payload push por plataforma (`buildPushMessage`, `functions/src/notifications/fcm.ts`) y `platform` opcional en `registerPushDevice`.
- App Check en la web y modo `off | monitor | enforce` en Functions (por defecto `monitor`).
- Textos legales plantilla en `/legal/:document` con aceptación versionada en el registro.
- Modelo BC3 puro en `src/entities/construction-document/model` y `t()` síncrono sin i18next.
- Callables en `europe-southwest1`; admin por custom claim.

## Criterios de aceptación

- [ ] La web pasa `pnpm lint`, `pnpm build`, `pnpm test`, `pnpm test:rules`, `pnpm build:functions` y `pnpm test:e2e` sin cambios de comportamiento tras extraer los paquetes, y el PDF de referencia de `tests/pdf.test.ts` no cambia.
- [x] Functions importa de `@bg/domain` y no queda ningún `../../src` en `functions/src` (14-11-2026: a través de `functions/src/domain.ts`, que re-exporta las fuentes del paquete por ruta relativa).
- [ ] Mismos importes en web y móvil para el conjunto de presupuestos de prueba (test de paridad sobre `budgetTotals` y el modelo BC3).
- [ ] El PDF móvil es equivalente página a página al web para el documento largo de los tests y se comparte con el menú nativo.
- [ ] En modo avión, las vistas visitadas se muestran sin skeleton tras reiniciar la app y una mutación muestra el toast de BG-012.
- [ ] Cambiar de cuenta no deja datos del UID anterior en la caché de Firestore ni en MMKV (test automatizado).
- [ ] Un lead nuevo genera un aviso con la app cerrada en iOS y Android físicos, y al tocarlo se abre ese lead.
- [ ] Borrar la cuenta desde la app deja vacías todas las colecciones del UID en el emulador y cierra la sesión.
- [ ] La app no muestra precios, compras ni enlaces de pago (D7).
- [ ] La app abre en la última tab usada y, la primera vez, en Presupuestos (D8).
- [ ] Ninguna prueba usa datos reales; las pruebas contra `budgenerator` usan cuentas sintéticas que se borran al terminar (D5).
- [ ] VoiceOver y TalkBack recorren crear presupuesto → exportar PDF sin bloqueos.
- [ ] La app se aprueba en App Store y Google Play con crash-free ≥ 99,5 % en beta.

## Riesgos

- RNFB y el SDK JS difieren en tipos y la reutilización de repositorios no compensa: spike en fase 0 y fallback con suite de contrato común (D2).
- jsPDF falla o es lento en Hermes: spike en fase 0 y fallback con `expo-print` sobre los mismos totales.
- La persistencia offline filtra datos entre cuentas: borrado completo en `resetSession` y test automático (D3).
- Sin staging, las pruebas en dispositivo tocan producción: sólo cuentas sintéticas, sin desplegar reglas ni Functions para probar (D5).
- La migración a monorepo rompe la PWA en producción: extracción incremental, web en la raíz y verificación de Hosting antes de desplegar.
- Rechazo en revisión de tiendas (borrado de cuenta, funcionalidad mínima, metadatos de compra): borrado ya disponible, app sin precios y cuenta de revisión sintética.
- Un desarrollador para dos plataformas: mismo código y sólo teléfono (D9).

## Tests

- Unitarios: Vitest en `packages/domain` con los tests puros actuales (importes, modelo BC3, catálogo, proyectos, planificación, PDF) más paridad web/móvil; Jest (`jest-expo`) y React Native Testing Library para pantallas, estados offline y accesibilidad básica.
- Reglas / integración: suite de contrato de `@bg/firebase-api` contra emuladores; `pnpm test:rules` sin cambios en el MVP y con casos de Storage si se añaden fotos; `pnpm test:integration` si cambian Functions.
- E2E: Maestro contra emuladores `demo-*` (login, crear presupuesto, PDF, marcar partida, modo avión, borrar cuenta); checklist manual en dispositivos físicos para push, App Check y compartir.

## Plan

Estimación: 18–23 semanas de un desarrollador hasta publicar; beta interna a las 9–12 y MVP con push a las 13–17. Detalle por fase en el [análisis](../analysis/native-app-plan.md#9-roadmap).

### Fase 0 — Preparación y monorepo (3–4 semanas)

- [x] Aprobación de esta spec por el propietario (14-11-2026).
- [x] `pnpm-workspace.yaml` con la web en la raíz (14-11-2026).
- [x] Extraer `@bg/domain` (tipos, modelo BC3, importes, catálogo, estimador, proyectos, planificación, fechas y textos) con sus tests; web y Functions importan de él (14-11-2026; Functions vía el shim `functions/src/domain.ts`).
- [ ] Extraer `@bg/ui-tokens` y generar el `@theme` de la web.
- [ ] `apps/mobile` con Expo Router, dev client, EAS y variantes `development`, `preview` y `production`.
- [ ] Spikes con informe go/fallback: repositorio `project` con RNFB, PDF en Hermes, push en dispositivo físico y borrado de persistencia al cambiar de cuenta.

### Fase 1 — Núcleo (6–8 semanas)

- [ ] `@bg/firebase-api` y `@bg/app-core` con puertos de plataforma (MMKV, NetInfo, imágenes).
- [ ] Registro, verificación de email, login y recuperación; tabs (D8).
- [ ] Presupuestos, Proyectos y Solicitudes del MVP; PDF compartido; enlace público.
- [ ] Mi cuenta con cerrar sesión; consulta offline con persistencia nativa (D3).
- [ ] Tests de paridad y flujo Maestro login → presupuesto → PDF.

### Fase 2 — Paridad (4–5 semanas)

- [ ] Equipo completo.
- [ ] Push nativo: registro con `platform`, canal `leads`, deep links y universal links.
- [ ] Perfil con logo, catálogo, plantillas, resumen del estimador y ayuda.
- [ ] Borrado de cuenta en la app sobre `deleteAccount`.
- [ ] Sentry y App Check nativo con Functions en `monitor`.

### Fase 3 — Nativo diferencial (3–4 semanas)

- [ ] Spec y entrega de marcar partidas sin red (D4).
- [ ] Spec y entrega de fotos de obra con Cloud Storage, `storage.rules` probadas en emulador y borrado en `deleteAccount`.
- [ ] Abrir la obra en Mapas.

### Fase 4 — Publicación (1,5–2,5 semanas más revisión)

- [ ] Resolver D6 y crear las cuentas de desarrollador.
- [ ] Revisión legal de los textos con los datos de la app; etiquetas de privacidad y Data Safety.
- [ ] Fichas, capturas de teléfono y cuenta de revisión sintética.
- [ ] App Check en `enforce` tras revisar las métricas.
- [ ] TestFlight y prueba cerrada de Play; envío a revisión con instrucción explícita del propietario.
