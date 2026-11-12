---
name: spec-new
description: Crea la spec y el plan de una tarea nueva de BudGenerator (BG-0xx) desde la plantilla y la registra en el índice. Úsala para cambios transversales, de modelo de datos, reglas o producto.
---

# Crear una spec

1. Elige el siguiente ID libre en `docs/specs/README.md`.
2. Crea `docs/specs/BG-0xx-slug.md` copiando `docs/specs/_template.md`. Rellena el estado (`Propuesta`), el objetivo, las exclusiones, los criterios de aceptación, los riesgos y los tests.
3. Si la ejecución tiene varios pasos, añade al final de la spec una sección `## Plan` con tareas en checklist. No crees otra carpeta.
4. Añade una fila al índice `docs/specs/README.md` y enlaza la spec desde `docs/plan.md` si pasa a ser trabajo vigente.
5. Cambios de monorepo, dependencias o producto: deja la spec en `Propuesta` hasta que el propietario la apruebe.
