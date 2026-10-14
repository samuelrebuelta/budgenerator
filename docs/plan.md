# BudGenerator — Plan SDD

Actualizado: 2026-10-14. Fuente operativa de tareas; los documentos técnicos existentes explican el sistema, no sustituyen este plan. El ecosistema incluye BudGenerator (presupuestos) y Web Factory Lite (generación de webs mediante starter + Codex con CMS Sanity y despliegue Cloudflare); sin monorepo ni integración de código obligatoria.

## Prioridades

| ID | Estado | Prioridad | Entrega |
| --- | --- | --- | --- |
| BG-001 | Pendiente | Crítica | Corregir Firestore Rules: los usuarios pueden escribir `users/{uid}.accountData.isAdmin` y elevar permisos. Separar autorización admin en fuente de confianza; probar con Emulator Suite sin afectar datos reales. |
| BG-002 | Pendiente | Alta | Completar refactor visual revisado; ver `docs/specs/BG-002-refactor-ui.md`. |
| BG-003 | Pendiente | Alta | Tests unitarios de cálculos, IVA, descuentos/recargos y redondeos; pruebas de reglas de seguridad. |
| BG-004 | Pendiente | Media | Reconciliar README, Firebase Rules, scripts y contratos de producto; verificar si free/premium, límites y administración siguen en alcance antes de eliminarlos. |
| BG-005 | Por definir | Media | Delimitar el encaje de Web Factory Lite dentro del ecosistema (starter + Codex, Sanity, Cloudflare), sin añadir CRM, facturación o automatización comercial. |

## Flujo mínimo

1. Elegir una tarea prioritaria sin solaparla con trabajos en curso; comprobar código y cambios reales.
2. Para cambios de comportamiento, definir objetivo, límites, criterios de aceptación y validación en `docs/specs/`. Los ajustes triviales pueden ir directamente en la PR.
3. Implementar en rama aislada; paralelizar únicamente cambios independientes, sin escrituras concurrentes en los mismos archivos.
4. Ejecutar lint/build y pruebas específicas del alcance, más suites de seguridad cuando aplique; ejecutar checks globales antes del merge. No afirmar pruebas no ejecutadas.
5. Actualizar estado del plan y documentación afectada; abrir PR revisable. No fusionar ni desplegar sin autorización.

Estados permitidos: Pendiente, En curso, En revisión, Bloqueado, Completado. Las especificaciones pendientes no son autorización de implementación. No iniciar más funcionalidad comercial ni arquitectura especulativa.
