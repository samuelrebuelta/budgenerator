# BudGenerator — producto y ecosistema

## Producto principal

Herramienta web para empresas de reformas: presupuestos, catálogo, plantillas, datos de empresa y exportación PDF. La hoja de ruta propuesta añade suscripción, landing de captación y seguimiento ligero de proyectos; su definición está en `docs/superpowers/specs/`. Priorizar claridad, velocidad y corrección de importes.

## Ecosistema

**BudGenerator** es el nombre vigente (no Tavio). **Web Factory Lite** forma parte del ecosistema y permite generar webs profesionales mediante un starter personalizable + Codex con libertad visual. CMS Sanity editable por el cliente y despliegue previsto en Cloudflare. No equivale por sí solo a un módulo interno ni exige compartir repositorio.

BudGenerator podrá ofrecer una landing sencilla generada con ayuda de IA y editable por la empresa, con un formulario que cree solicitudes en el perfil de BudGenerator. La relación comercial seguirá siendo manual: teléfono y estados básicos de solicitud; no crear un CRM completo, campañas ni automatizaciones.

La oferta propuesta es Free con hasta 3 presupuestos y sin límites de catálogos o plantillas, y **BudGenerator Pro** a 19,99 €/mes + IVA mediante Stripe. “Pro” es el nombre recomendado. La interpretación del límite de 3, el acceso a las landings y los detalles de facturación se concretarán al preparar cada implementación, como indica `docs/plan.md`.

La landing puede redactarse con IA a partir de información pública de la empresa y sus servicios. Las estimaciones deben calcularse con reglas deterministas y tarifas del catálogo; no generar partidas ni precios con IA. La generación de presupuestos con IA se retiró del roadmap activo.

Web Factory Lite conserva independencia de código y despliegue; cualquier página creada allí puede enlazar al formulario público de BudGenerator, sin monorepo implícito.

## Decisiones a concretar al implementar

Los diseños BG-004, BG-005 y BG-009 sirven como base para sus respectivos planes de implementación; las decisiones abiertas se resolverán al preparar cada uno. Las cuentas `premium` existentes y la administración manual deben conservarse hasta definir su transición. La integración de código con Web Factory Lite no está dentro del alcance propuesto.

## Principios

- Costes operativos bajos y servicios gratuitos cuando sea viable.
- Simplicidad del flujo de presupuestos; preservar exportaciones, datos y cálculos.
- Mobile usable; desktop sin acciones duplicadas.
- Prioridad a seguridad y corrección funcional, luego refinamiento visual.
- No exponer tarifas internas ni datos de solicitudes en rutas públicas.
- Los proyectos son una vista operativa del avance, no facturación ni gestión completa de obras.
- Las propuestas documentadas no autorizan por sí mismas implementaciones o despliegues.
