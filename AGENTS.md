# Instrucciones para agentes — BudGenerator

SPA de presupuestos para profesionales: React 19, TypeScript strict, Vite, Tailwind 4, Zustand, Firebase Auth/Firestore/Hosting y jsPDF. Se gestiona con pnpm. BudGenerator es la herramienta de presupuestos del ecosistema; Web Factory Lite es un proyecto independiente y cualquier integración de código o monorepo requiere una especificación aprobada.

## Punto de entrada

Lee el [plan vigente](docs/plan.md) para conocer el estado y los pendientes; el [histórico](docs/plan-history.md) sirve para rastrear una decisión o entrega. Abre los archivos afectados y sigue solo la fila que corresponda:

| Si la tarea afecta a                         | Lee primero                                                                                                                                     |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| UI, modales, formularios o responsive        | [Patrones y ejemplos de UI](docs/styles-and-responsive.md#patrones-de-ui) y el componente más parecido en `src/shared/ui` o la feature afectada |
| Alcance, comportamiento o reglas de producto | [Producto](docs/product.md) y la especificación vigente de la tarea                                                                             |
| Capas, navegación o límites entre módulos    | [Arquitectura](docs/architecture.md)                                                                                                            |
| Datos, permisos o Firebase                   | [Firebase](docs/firebase.md), reglas reales y servicios afectados                                                                               |
| Estado, guardado u offline                   | [Estado y caché](docs/state-and-cache.md) y los stores o servicios afectados                                                                    |
| Rendimiento o PDF                            | [Rendimiento](docs/performance.md) o [Exportación PDF](docs/pdf-export.md)                                                                      |
| Pruebas y publicación                        | [Pruebas y despliegue](docs/testing.md) y los scripts de `package.json`                                                                         |

Para un ajuste localizado basta la tarea, la fila pertinente y el código afectado. Para cambios transversales, añade la spec correspondiente en `docs/specs/` o `docs/superpowers/specs/`. Amplía la lectura cuando haya dependencias, contradicciones o riesgo. En revisiones, usa `context-aware-pr-review` si está disponible. Las skills del proyecto están en `.agents/skills/` (`verify`, `spec-new`, `rules-change`, `doc-sync`). `docs/analysis/` y el histórico no describen el estado actual: léelos solo para trazabilidad.

## Arquitectura y convenciones

- FSD adaptada: `app → pages → features → entities → shared`. `shared` no importa entidades. Mantén las APIs públicas y las responsabilidades existentes.
- El CRUD de Firebase vive en `src/entities/<entity>/api`. Mantén la revisión de sesión y las colas por documento; no recargues listas desde cada guard.
- El editor compartido está en `src/features/budget-editor`. Los cálculos monetarios están en `src/shared/lib/budgetMath.ts` y se reutilizan en editor, visor y PDF. Para publicar, usa el DTO público, nunca el objeto privado completo.
- Contrato PWA: recursos de una versión coherente, ningún dato de Firebase en Cache Storage, actualizaciones explícitas y sin recarga si hay cambios sin guardar.
- Estilos con tokens, fuentes locales y componentes compartidos. Reutiliza componentes y estados existentes; mantén responsive, nombres accesibles y errores visibles.
- Documentación y UI en español; identificadores de código en inglés.
- No añadas dependencias, capas ni funcionalidades comerciales de forma especulativa ni hagas refactors no solicitados. No elimines por tu cuenta el modelo de planes, la administración ni funciones existentes: revisa y propón primero.

## Seguridad

- Sin secretos en Git. Las contraseñas de producción solo están en documentación local ignorada (`docs/testing-access.local.md`): no las copies, muestres ni hardcodees.
- No modifiques datos reales ni producción al probar. Los emuladores usan siempre un projectId `demo-`.
- No hagas commit, push, merge ni deploy sin petición explícita. `pnpm firebase:deploy` publica solo Hosting y `pnpm firebase:deploy:all`, reglas y Hosting.

## Ejecución y verificación

- Una tarea por PR, salvo cambios cohesivos. Delimita objetivo, exclusiones, criterios de aceptación, riesgos y tests; las tareas menores no necesitan spec.
- Delega en subagentes la exploración amplia y la lectura voluminosa y quédate con la conclusión. Agentes que escriben en paralelo solo con ficheros independientes y sin compartir checkout.
- Primero checks específicos del cambio; para cerrar, `pnpm lint`, `pnpm build` y los tests que apliquen: `pnpm test`, `pnpm test:rules`, `pnpm test:e2e`, `pnpm test:integration`. Los cambios de Firestore Rules exigen tests reales contra emuladores antes de considerarlos seguros.
- Un fallo «conocido» o «ajeno» no se acepta: se arregla o se abre una tarea en el plan. No se despliega con la CI en rojo.
- Registra solo resultados ejecutados, sin inventarlos. Actualiza el plan cuando cambie el estado del trabajo y el contrato técnico cuando cambie el comportamiento documentado.
