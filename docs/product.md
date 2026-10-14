# BudGenerator — producto y ecosistema

## Producto principal
Herramienta web de creación y gestión de presupuestos para reformas: partidas, tarifas, cálculos, clientes, información de empresa y exportación PDF. Priorizar claridad, velocidad y corrección de importes. Evitar textos comerciales innecesarios dentro de la herramienta.

## Ecosistema
**BudGenerator** es el nombre vigente (no Tavio). **Web Factory Lite** forma parte del ecosistema y permite generar webs profesionales mediante un starter personalizable + Codex con libertad visual. CMS Sanity editable por el cliente y despliegue previsto en Cloudflare. No equivale por sí solo a un módulo interno ni exige compartir repositorio.
El usuario gestiona manualmente captación, clientes, facturación y negocio: excluir CRM, suscripciones automáticas, billing complejo y sobreingeniería.

## Decisiones por confirmar
El código actual mantiene cuentas, administración y planes free/premium con límites. No eliminar ni rediseñar esos flujos sólo por su aparente discrepancia con la visión simplificada; contrastar su uso real y confirmar el alcance antes de cambios.
La integración UX o navegación entre BudGenerator y Web Factory Lite todavía requiere especificación y aprobación.

## Principios
- Costes operativos bajos y servicios gratuitos cuando sea viable.
- Simplicidad del flujo de presupuestos; preservar exportaciones, datos y cálculos.
- Mobile usable; desktop sin acciones duplicadas.
- Prioridad a seguridad y corrección funcional, luego refinamiento visual.
- Las propuestas documentadas no autorizan por sí mismas implementaciones o despliegues.
