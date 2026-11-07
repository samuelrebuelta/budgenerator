# BG-011: interacción del calendario semanal

## Objetivo y alcance

Corregir el retorno al día de hoy, simplificar el marcado visual de días, permitir saltar a una semana desde el selector de fecha nativo, precargar semanas contiguas y guardar automáticamente la fecha estimada del proyecto al cambiarla. No se cambia el modelo de asignaciones ni se escriben datos de producción durante la verificación.

## Aceptación

- «Hoy» está habilitado cuando la semana actual está visible pero el día seleccionado no es hoy; al pulsarlo, selecciona hoy.
- El día seleccionado sólo usa el círculo granate. El número de hoy sin seleccionar destaca en granate y negrita. Las bolitas quedan separadas 2 px del círculo.
- El rango de semana activa el selector nativo de fecha; elegir cualquier fecha muestra y selecciona la semana que la contiene.
- Las semanas anterior y siguiente se precargan en la caché local y aparecen sin skeleton al navegar cuando termina esa precarga.
- La fecha estimada se guarda al cambiar el control; desaparece el botón de guardado. La selección táctil/puntero se confirma al elegir y la edición por teclado se confirma al salir, sin guardar años parciales; una edición pendiente se envía si se desmonta la página.

## Secuencia de ejecución

1. Añadir regresiones E2E para día de hoy, selector de semana, estilos y autoguardado; ejecutar y confirmar que fallan antes del cambio.
2. Implementar los comportamientos y precargar semanas contiguas sin duplicar lecturas en curso.
3. Ejecutar E2E focalizada, checks de lint/formato/build y suites pertinentes; actualizar capturas, contratos y plan.
4. Ejecutar revisión visual y revisión de código; desplegar únicamente Hosting en Firebase `budgenerator` y verificar rutas y artefactos publicados.

## Riesgos y límites

El selector nativo depende del navegador y del dispositivo; la prueba automatizada cambia el valor del `input[type=date]` y verifica el salto de semana sin intentar automatizar el popup del sistema operativo. La precarga es oportunista y conserva la lectura habitual como respaldo si falla la red.

## Verificación y publicación

- E2E semanal en Chromium con Auth y Firestore Emulator: 1/1 pasada. Incluye selección de hoy, estilos del día y margen de los puntos, salto de semana, ausencia de skeleton al abrir la semana precargada, guardado por selector y edición del año por teclado sin persistir el primer dígito; navegar fuera conserva la fecha final.
- Rules Emulator: 61/61. No hubo cambios de reglas.
- `pnpm lint`, `pnpm format:check`, Prettier de archivos modificados, `pnpm build` y `git diff --check`: correctos. El detector Impeccable terminó con código 0 y sin hallazgos. Revisión de código independiente: sin hallazgos pendientes.
- `pnpm test`: 206/207; persiste el fallo preexistente y ajeno al cambio en `tests/catalogTradeImport.test.ts`, que espera sólo `reforma_integral` aunque el catálogo actual incluye los nueve catálogos de especialidad.
- Capturas E2E actualizadas en `docs/testing-evidence/bg011-weekly-team-desktop.png` y `bg011-weekly-team-mobile.png`.
- Desplegado sólo Firebase Hosting en `https://budgenerator.web.app`, versión PWA `9aaba2750e2467f2`. Los 99/99 archivos servidos coinciden byte a byte con `dist`; `/`, `/budgets`, `/projects`, `/team`, `/team/manage` y `/projects/project-navigation` responden HTTP 200. No se desplegaron Rules ni Functions y no se escribieron datos reales.
