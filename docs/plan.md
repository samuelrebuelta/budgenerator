# BudGenerator — Plan vigente

Actualizado el 09-11-2026. Para trabajar en una tarea, consulta el área correspondiente en [AGENTS.md](../AGENTS.md). El [archivo del plan](plan-history.md) conserva las entregas, verificaciones y decisiones históricas.

## Estado actual

- El MVP está integrado en `main` y publicado para validación. Presupuestos es el flujo principal. Las otras pestañas son Proyectos, Equipo y Solicitudes. Catálogo, Plantillas y Estimador se abren desde el menú.
- **BG-005 y BG-010.** Estimador público y solicitudes publicados para pruebas. Los avisos son push y se activan por dispositivo.
- **BG-007 a BG-009.** UX, catálogo único, creación guiada y seguimiento de proyectos integrados. Queda como seguimiento opcional comprobar teclado, área segura y gestos en PWA física.
- **BG-011 y BG-012.** Planificación semanal, gestión de equipo, consulta offline y refresco al recuperar conexión integrados y desplegados. La [especificación offline](specs/BG-012-modo-offline.md) describe el contrato.

- **Endurecimiento del back (12-11-2026).** En `claude/backend-hardening`, sin desplegar: despliegue con guardarraíles y alias de staging, Functions en `europe-southwest1` con Node 24, App Check en observación, límites anti-abuso, verificación de email, borrado y exportación de cuenta, retención de leads y enlaces, admin por custom claim, textos legales plantilla, logo comprimido, push multiplataforma y logs estructurados. Pendiente: tareas de consola y orden de publicación en [Firebase](firebase.md#tareas-del-propietario-en-consola-o-gcloud) y [Estabilización](stability-and-release.md#endurecimiento-del-back-12-11-2026).

## Trabajo futuro y decisiones

- **BC3.** Trabajo futuro, fuera de `main`. Hay una implementación en la rama `codex/bc3-native-model`. Consultar su estado y el [plan BC3](superpowers/plans/2026-10-19-bc3-intercambio.md) al retomar la tarea.
- **BG-004.** Monetización y Stripe aplazados hasta validar el MVP. Se mantienen los planes y la administración actuales.
- **BG-006.** Generación con IA retirada del roadmap. El asistente es el flujo vigente de creación guiada.

## Mantenimiento de este plan

Actualiza este resumen cuando cambie el estado, una decisión o un pendiente. Deja las verificaciones detalladas en la tarea o el contrato técnico pertinente y enlázalas desde aquí cuando afecten a la siguiente entrega.
