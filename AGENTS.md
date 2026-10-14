# Instrucciones para agentes — BudGenerator

## Contexto y fuentes
BudGenerator es la herramienta de presupuestos del ecosistema del mismo nombre. Web Factory Lite es otra herramienta complementaria para producir webs con un starter y Codex; no integrar código ni crear monorepo sin una especificación aprobada.
Lee primero `docs/plan.md` para conocer el trabajo vigente. Consulta `docs/product.md` para límites funcionales y `docs/architecture.md`, `docs/firebase.md`, `docs/state-and-cache.md`, `docs/styles-and-responsive.md`, `docs/performance.md` y `docs/pdf-export.md` **sólo según el área modificada**.

## Lectura progresiva para ahorrar cuota de Codex
- Corrección localizada: este archivo, plan y archivos directamente afectados.
- Feature o refactor transversal: lo anterior + especificación `docs/specs/BG-*.md` y documentos técnicos relacionados.
- Seguridad, datos y arquitectura: leer reglas reales, stores/servicios, documentación técnica y todos los contratos afectados antes de cambiar.
No abrir por defecto todos los archivos del repositorio ni releer historial completo de cada milestone. Recuperar contexto adicional cuando exista una dependencia o contradicción real. La exactitud y la seguridad priman sobre ahorrar tokens.

## Convenciones
React, TypeScript strict, Vite, Zustand, Tailwind y Firebase; mantener arquitectura FSD adaptada, APIs públicas y responsabilidades existentes. No añadir dependencias, capas o funcionalidades comerciales de forma especulativa. No modificar datos reales o producción en pruebas. Sin secretos en Git.
Documentación y UI en español; identificadores de código en inglés. Reutilizar componentes y estados existentes cuando corresponda.
No decidir unilateralmente la eliminación del modelo de planes, administración o funciones existentes: revisar y proponer primero.

## Ejecución
Una tarea por PR, salvo cambios cohesivos. Delimitar objetivo, exclusiones, criterios de aceptación, riesgos y tests. Para tareas menores no se necesita spec adicional. Agentes paralelos sólo con archivos independientes; no compartir checkout para escrituras simultáneas. Evitar refactors no solicitados.
Primero checks específicos, luego `pnpm lint` y `pnpm build` y tests disponibles para cerrar. El repositorio todavía no define script `test`; no inventar resultados. Cambios de Firestore Rules exigen tests reales contra emuladores antes de considerarlos seguros.
Actualizar `docs/plan.md` y contrato técnico pertinente; registrar qué se verificó y qué quedó pendiente. No auto-merge ni despliegues sin instrucción explícita.
