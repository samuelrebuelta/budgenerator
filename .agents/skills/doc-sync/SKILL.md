---
name: doc-sync
description: Sincroniza la documentación de BudGenerator al cerrar una tarea, actualizando plan, estado de la spec y el contrato técnico afectado. Úsala al terminar una entrega.
---

# Sincronizar documentación

1. `docs/plan.md`: actualiza el estado actual y los pendientes en una o dos líneas. Las verificaciones detalladas van a la spec.
2. Spec de la tarea: cambia `Estado:` y añade la evidencia (comandos y resultados reales).
3. Contrato técnico (`architecture.md`, `firebase.md`, `state-and-cache.md`, `styles-and-responsive.md`, `testing.md`…): describe el comportamiento vigente, no la historia. La historia va a `docs/archive/plan-history.md`.
4. Ejecuta `pnpm docs:check`.
