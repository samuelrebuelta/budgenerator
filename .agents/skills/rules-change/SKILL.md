---
name: rules-change
description: Protocolo para cambiar firestore.rules, índices o Cloud Functions en BudGenerator con tests reales contra emuladores. Úsala antes de tocar reglas, índices o functions/.
---

# Cambiar reglas o Functions

1. Lee `docs/firebase.md` y el bloque afectado de `firestore.rules`.
2. Escribe primero el test que falla en `tests/*.rules.test.ts` (o en `functions/tests`). Cubre el caso permitido, el denegado, otro usuario y el usuario no autenticado.
3. Implementa el cambio mínimo. No uses `get()` innecesarios y respeta el límite de llamadas por petición.
4. Ejecuta los tests con emuladores de projectId `demo-` (`pnpm test:integration` o `firebase emulators:exec --project demo-cimbra --only auth,firestore,functions "pnpm test:rules"`). Nunca contra `budgenerator`.
5. Pide una revisión al subagente `firebase-rules-reviewer`.
6. Actualiza `docs/firebase.md` con el contrato nuevo, no con una bitácora. No despliegues: lo hace el propietario con `pnpm firebase:deploy:all` cuando lo pida.
