# BudGenerator — Plan SDD

Actualizado: 2026-10-15. Fuente operativa de tareas; los documentos técnicos existentes explican el sistema, no sustituyen este plan. El ecosistema incluye BudGenerator (presupuestos) y Web Factory Lite (generación de webs mediante starter + Codex con CMS Sanity y despliegue Cloudflare); sin monorepo ni integración de código obligatoria.

## Prioridades

| ID | Estado | Prioridad | Entrega |
| --- | --- | --- | --- |
| BG-001 | Completado | Crítica | Firestore Rules protegen roles, cuotas y enlaces públicos; 12 pruebas contra Emulator Suite. |
| BG-002 | Completado | Alta | Refactor visual y observaciones de revisión aplicados; ver `docs/specs/BG-002-refactor-ui.md` y `docs/sdd-plan.md`. |
| BG-003 | Completado | Alta | 23 pruebas unitarias de cálculos, IVA, redondeos, stores y PWA; 12 de reglas y 7 de navegador. |
| BG-004 | En revisión | Media | README, reglas, scripts y contratos técnicos reconciliados. Mantener free/premium y administración hasta decidir su alcance de producto. |
| BG-005 | Por definir | Media | Delimitar el encaje de Web Factory Lite dentro del ecosistema (starter + Codex, Sanity, Cloudflare), sin añadir CRM, facturación o automatización comercial. |
| BG-006 | Pendiente | Alta | Generación asistida de presupuestos mediante texto/voz a partir del catálogo y plantillas del usuario. SDD contrastado con el código en [`docs/specs/BG-006-ai-budget-generation.md`](specs/BG-006-ai-budget-generation.md); implementación separada por PR, no iniciada. |

## Flujo mínimo

1. Elegir una tarea prioritaria sin solaparla con trabajos en curso; comprobar código y cambios reales.
2. Para cambios de comportamiento, definir objetivo, límites, criterios de aceptación y validación en `docs/specs/`. Los ajustes triviales pueden ir directamente en la PR.
3. Implementar en rama aislada; paralelizar únicamente cambios independientes, sin escrituras concurrentes en los mismos archivos.
4. Ejecutar lint/build y pruebas específicas del alcance, más suites de seguridad cuando aplique; ejecutar checks globales antes del merge. No afirmar pruebas no ejecutadas.
5. Actualizar estado del plan y documentación afectada; abrir PR revisable. No fusionar ni desplegar sin autorización.

Estados permitidos: Pendiente, En curso, En revisión, Bloqueado, Completado. Las especificaciones pendientes no son autorización de implementación. No iniciar más funcionalidad comercial ni arquitectura especulativa.
