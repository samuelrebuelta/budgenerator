# Instrucciones para agentes — BudGenerator

## Punto de entrada

BudGenerator es la herramienta de presupuestos del ecosistema. Web Factory Lite es un proyecto independiente. Cualquier integración de código o monorepo requiere una especificación aprobada.

Lee el [plan vigente](docs/plan.md) para conocer el estado y los pendientes. Abre los archivos afectados y sigue solo la fila que corresponda. Consulta el archivo histórico desde el plan cuando necesites rastrear una decisión o entrega.

| Si la tarea afecta a                         | Lee primero                                                                                                                                     |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| UI, modales, formularios o responsive        | [Patrones y ejemplos de UI](docs/styles-and-responsive.md#patrones-de-ui) y el componente más parecido en `src/shared/ui` o la feature afectada |
| Alcance, comportamiento o reglas de producto | [Producto](docs/product.md) y la especificación vigente de la tarea                                                                             |
| Capas, navegación o límites entre módulos    | [Arquitectura](docs/architecture.md)                                                                                                            |
| Datos, permisos o Firebase                   | [Firebase](docs/firebase.md), reglas reales y servicios afectados                                                                               |
| Estado, guardado u offline                   | [Estado y caché](docs/state-and-cache.md) y los stores o servicios afectados                                                                    |
| Rendimiento o PDF                            | [Rendimiento](docs/performance.md) o [Exportación PDF](docs/pdf-export.md)                                                                      |
| Pruebas y publicación                        | [Pruebas y despliegue](docs/testing.md) y los scripts de `package.json`                                                                         |

Para un ajuste localizado basta la tarea, la fila pertinente y el código afectado. Para cambios transversales, añade la spec correspondiente en `docs/specs/` o `docs/superpowers/specs/`. Amplía la lectura cuando haya dependencias, contradicciones o riesgo. En revisiones, usa `context-aware-pr-review` si está disponible.

## Convenciones

React, TypeScript strict, Vite, Zustand, Tailwind y Firebase; mantener arquitectura FSD adaptada, APIs públicas y responsabilidades existentes. No añadir dependencias, capas o funcionalidades comerciales de forma especulativa. No modificar datos reales o producción en pruebas. Sin secretos en Git.
Documentación y UI en español; identificadores de código en inglés. Reutilizar componentes y estados existentes cuando corresponda.
No decidir unilateralmente la eliminación del modelo de planes, administración o funciones existentes: revisar y proponer primero.

## Ejecución

Una tarea por PR, salvo cambios cohesivos. Delimitar objetivo, exclusiones, criterios de aceptación, riesgos y tests. Para tareas menores no se necesita spec adicional. Agentes paralelos sólo con archivos independientes; no compartir checkout para escrituras simultáneas. Evitar refactors no solicitados.
Primero checks específicos, luego `pnpm lint` y `pnpm build` y tests disponibles para cerrar. Hay scripts reales `test`, `test:rules`, `test:e2e` y `test:integration`; registrar resultados ejecutados y no inventarlos. Cambios de Firestore Rules exigen tests reales contra emuladores antes de considerarlos seguros.
Actualizar el plan cuando cambie el estado del trabajo y el contrato técnico cuando cambie el comportamiento documentado. Registrar verificaciones y pendientes. No auto-merge ni despliegues sin instrucción explícita.
