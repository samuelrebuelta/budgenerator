# BG-017 — Entrega y operación

Estado: implementado

Fecha: 2026-11-15.

## Objetivo

Acortar la publicación de cambios y permitir el desarrollo con emuladores en paralelo con otros proyectos.

## Alcance y exclusiones

- Reutilizar el resultado de CI para desplegar el commit verificado, con verificación local explícita y reenvío de flags al CLI.
- Separar los puertos de los emuladores y actualizar los consumidores de sus valores por defecto.
- Ajustar los permisos del agente, preparar Android de producción y resolver los hallazgos de la batida registrados en el plan.
- Los textos legales, el despliegue y las operaciones del proyecto Firebase quedan fuera del código de esta entrega. El propietario confirma las operaciones por separado.

## Criterios de aceptación

- CI verde del SHA evita los checks duplicados. El build sigue siendo obligatorio y Hosting verifica el bundle.
- Los puertos 9399, 8280 y 5101 se usan para Auth, Firestore y Functions en los emuladores principales. Las suites con puertos 48xxx conservan su aislamiento.
- Android se puede preparar con su archivo Firebase externo y la variante de producción.
- El BC3 de TCQ conserva el importe declarado al importar, exportar e importar de nuevo.

## Riesgos

- Auth usa 9399 para convivir con otros proyectos que usan 9299 para Eventarc.
- Si la CI disponible pertenece a otro commit, los checks locales no levantan el bloqueo de producción.
- La instalación de producción en Android depende del registro Firebase y del archivo de configuración de la app.

## Plan

- [x] Reducir los checks repetidos y cubrir los casos de CI y flags con pruebas.
- [x] Actualizar Firebase Emulator Suite, sus consumidores y CI.
- [x] Actualizar permisos y preparación de la build Android.
- [x] Corregir los hallazgos de la batida y validar un archivo real de TCQ.
- [x] Sincronizar el plan y los procedimientos de trabajo.

## Verificación local

| Comando                                              | Resultado                                                                                          |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `pnpm lint`, `pnpm format:check`, `pnpm exec tsc -b` | Código de salida 0 en los tres.                                                                    |
| `pnpm test`                                          | 356 correctas y 4 omitidas por falta de los BC3 externos en la ruta por defecto.                   |
| `pnpm test:rules:emulator`                           | 95/95 reglas.                                                                                      |
| `pnpm test:notifications:emulator`                   | 31/31 integración y 2/2 reglas.                                                                    |
| `pnpm test:integration`                              | 95/95 reglas y 49/49 recorridos. Auth en 9399 con la configuración versionada y Uuma en ejecución. |
| `pnpm build`                                         | Código de salida 0. PWA `44292689afeca50e`, 90 recursos.                                           |
| `pnpm --filter @bg/mobile typecheck`                 | Código de salida 0.                                                                                |
| `pnpm --filter @bg/mobile test`                      | 10/10 suites y 80/80 tests.                                                                        |
| `pnpm docs:check`                                    | Documentación correcta (56 ficheros).                                                              |

El BC3 real de TCQ pasó la prueba externa de ida y vuelta con el mismo total, 333.046,58 €. Se comprobó `expo prebuild --clean --platform android --no-install` con un JSON ficticio externo, sin plist de iOS. Expo generó el paquete `com.budgenerator.app`. Gradle procesó la configuración y construyó el APK con `:app:assembleRelease` (`BUILD SUCCESSFUL in 3m 31s`).
