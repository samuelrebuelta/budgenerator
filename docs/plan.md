# BudGenerator — Plan vigente

Actualizado el 13-11-2026. Para trabajar en una tarea, consulta el área correspondiente en [AGENTS.md](../AGENTS.md). El [archivo del plan](archive/plan-history.md) conserva las entregas, verificaciones y decisiones históricas.

## Estado actual

- El MVP está integrado en `main` y publicado para validación. Presupuestos es el flujo principal. Las otras pestañas son Proyectos, Equipo y Solicitudes. Catálogo, Plantillas y Estimador se abren desde el menú.
- **BG-005 y BG-010.** Estimador público y solicitudes publicados para pruebas. Los avisos son push y se activan por dispositivo.
- **BG-007 a BG-009.** UX, catálogo único, creación guiada y seguimiento de proyectos integrados. Queda como seguimiento opcional comprobar teclado, área segura y gestos en PWA física.
- **BG-011 y BG-012.** Planificación semanal, gestión de equipo, consulta offline y refresco al recuperar conexión integrados y desplegados. La [especificación offline](specs/BG-012-modo-offline.md) describe el contrato.
- **Integración del 13-11-2026 (rama `claude/project-analysis-improvement-914b89`, sin desplegar).** Reúne CI arreglada, contexto para agentes (`CLAUDE.md`, skills y subagentes), endurecimiento del back, el modelo canónico BC3 y la base de frontend:
  - **Back.** Despliegue con guardarraíles y alias de staging, Functions en `europe-southwest1` con Node 24, App Check en observación, límites anti-abuso, verificación de email (también para crear enlaces públicos), borrado y exportación de cuenta, retención de leads y enlaces, admin por custom claim, textos legales plantilla, push multiplataforma y logs estructurados.
  - **BC3.** El modelo FIEBDC es la única fuente de verdad de presupuestos, catálogo, plantillas, enlaces públicos y proyectos, con importación y exportación `.bc3` en Catálogo, Presupuestos y Plantillas. Ver [spec](specs/2026-10-19-bc3-intercambio-design.md) y [plan](specs/plans/2026-10-19-bc3-intercambio.md).
  - **Frontend.** Tokens semánticos y CSS por capas, primitivas de `shared/ui`, Equipo dividido en tres rutas, carga diferida de la sesión, i18next retirado, splash de iOS y fronteras FSD en ESLint, según el [análisis del frontend](analysis/frontend-pwa.md).
  - **Documentación.** Históricos en `archive/`, specs y planes unificados en `specs/` con [índice](specs/README.md) y `pnpm docs:check` en CI.
  - **Verificación local.** `pnpm lint`, `format:check`, `test` (297), `docs:check`, `build`, reglas con emulador (93) y E2E con emuladores (49/49) tras la batida funcional.
  - **Batida funcional del 13-11-2026.** Usuario nuevo contra emuladores: alta, BC3 de ida y vuelta, PDF, enlace público, proyecto, equipo, estimador, solicitudes, móvil, exportación y borrado de cuenta. Corregidos: redondeo de céntimos y subtotal de capítulos padre en PDF y vista pública, token desfasado al compartir tras verificar el email y formato de cantidades.
- **Pendiente de la integración.**
  - Tareas de consola del propietario antes de publicar: ver [Firebase](firebase.md#tareas-del-propietario-en-consola-o-gcloud).
  - Validar BC3 con archivos reales de Presto, Arquímedes y TCQ.
  - Mejoras de la batida: el estimador pierde la configuración al ir a completar la empresa; avisos de instalar y push demasiado altos en móvil; placeholder de contraseña con 6 caracteres; el export BC3 del catálogo no conserva `~X`; la base de precios no rellena el coste; descripción truncada en el editor móvil; presupuesto convertido que parece editable; total de pasos de la guía que cambia; fecha ISO en el PDF.
  - Comprobar teclado, área segura y gestos en una PWA física.
  - Estimador y solicitudes (prueba del 13-11-2026): requisitos al inicio y completables sin salir, borrador automático, aviso de privacidad alojado para quien no tiene web, precios orientativos, errores concretos, confirmar al revocar y opción de pausar, kit para compartir (QR, WhatsApp, URL corta), integral con precio propio, presupuesto con capítulos desde la solicitud y estado de cada solicitud.
  - Decidir el límite por formulario: hoy son 10 solicitudes por hora para todos los clientes juntos (además de 10/h por IP, 50/día por propietario y 500/día global).
  - Decisiones de producto abiertas: D1–D10 de la [app nativa](analysis/native-app-plan.md) y prueba gratuita frente a BG-004.

- **Decisiones del 13-11-2026.**
  - Los leads con más de 12 meses se anonimizan en lugar de borrarse: se quitan contacto, consentimiento y huella de la petición, y se conservan la reforma, la estimación y el mes de recepción. Implementado en `applyRetentionPolicies`.
  - Se aceptan los límites por IP actuales: 60 estimaciones por minuto y 10 solicitudes por hora.

## Trabajo futuro y decisiones

- **App nativa.** Plan con React Native + Expo en el [análisis](analysis/native-app-plan.md) (BG-N01, propuesto).
- **Lanzamiento.** Viabilidad y campaña en Meta en el [análisis de mercado](analysis/market-viability-meta-ads.md).
- **BG-004.** Monetización y Stripe aplazados hasta validar el MVP. Se mantienen los planes y la administración actuales.
- **BG-006.** Generación con IA retirada del roadmap. El asistente es el flujo vigente de creación guiada.

## Mantenimiento de este plan

Actualiza este resumen cuando cambie el estado, una decisión o un pendiente. Deja las verificaciones detalladas en la tarea o el contrato técnico pertinente y enlázalas desde aquí cuando afecten a la siguiente entrega.
