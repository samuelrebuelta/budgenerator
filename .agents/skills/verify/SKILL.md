---
name: verify
description: Elige y ejecuta las comprobaciones de BudGenerator según los ficheros cambiados y registra solo resultados reales. Úsala antes de dar una tarea por cerrada, abrir una PR o actualizar el plan.
---

# Verificar un cambio

1. Lista los cambios con `git diff --name-only main...HEAD` y `git status --short`.
2. Ejecuta siempre `pnpm lint`, `pnpm format:check` y `pnpm exec tsc -b`.
3. Si hay cambios en `src/**`, `functions/src/**` o `tests/*.test.ts`, ejecuta `pnpm test`. Necesita las dependencias de `functions/` (`pnpm --dir functions install --frozen-lockfile`).
4. Si hay cambios en `firestore.rules`, `firestore.indexes.json` o `functions/**`, ejecuta `pnpm test:integration`, que levanta emuladores `demo-` con reglas, build de Functions y E2E. Si solo cambian las reglas, ejecuta antes `pnpm test:rules` dentro de `firebase emulators:exec`.
5. Si cambia la UI, ejecuta los E2E afectados (`pnpm exec playwright test tests/e2e/<spec>`) y revisa en el navegador a 390 y 1440 px.
6. Si cambian docs, ejecuta `pnpm docs:check`.
7. Para cerrar, ejecuta `pnpm build`.

Informa de cada comando con su resultado literal (n/total) y los fallos. Un fallo «conocido» no se acepta: se arregla o se registra como tarea en `docs/plan.md`.
