@AGENTS.md

## Solo Claude Code

- Las skills del proyecto están en `.agents/skills/` y se exponen en `.claude/skills`. Para cerrar una tarea, usa `verify`.
- Los subagentes del proyecto están en `.claude/agents/`: `firebase-rules-reviewer` para revisar reglas y Functions, `doc-drift-auditor` para comparar documentación y código, y `e2e-triager` para diagnosticar fallos de Playwright.
- Delega la exploración amplia en `Explore` con `haiku` y quédate con la conclusión.
- `.claude/settings.json` bloquea el deploy, el push y la lectura de secretos. Tras cada edición, un hook pasa ESLint y Prettier sobre el fichero tocado.
