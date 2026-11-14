# Análisis de profesionalización — noviembre 2026

Informes del 11-11-2026 sobre `59d00d2`. Son diagnósticos y propuestas, no decisiones: lo que cambie producto, dependencias o arquitectura necesita una spec aprobada (ver [AGENTS.md](../../AGENTS.md)).

| Informe                                               | Contenido                                                                                                                                      | Nota global |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| [Frontend PWA](frontend-pwa.md)                       | Estilos, componentes, FSD, estado, PWA, rendimiento, accesibilidad, i18n, calidad y anexo de navegador                                         | ~5,5/10     |
| [Backend](backend.md)                                 | Firestore, reglas, Functions, consistencia, operación, RGPD y preparación para nativo                                                          | ~5,4/10     |
| [Arquitectura IA](ai-architecture.md)                 | Contexto para agentes (AGENTS, docs, specs, Claude Code/Codex) e IA en producto (BG-006)                                                       | 6/10        |
| [Plan app nativa](native-app-plan.md)                 | Apoyo de la spec [BG-014](../specs/BG-014-app-nativa.md): monorepo, Expo, Firebase nativo, roadmap de 18-23 semanas; actualizado el 14-11-2026 | —           |
| [Viabilidad y Meta Ads](market-viability-meta-ads.md) | Mercado, competencia, precio, test de Meta, escenarios y dependencias técnicas cruzadas                                                        | —           |

## Prioridad transversal

1. **CI de `main` en rojo desde el 18-10-2026** (detectado por los tres análisis técnicos). La CI no instala las dependencias de `functions/` y 3 suites fallan. Se arregla en horas.
2. **Operación:** staging separado, backups/PITR, alertas de gasto, App Check y límites del estimador público.
3. **Legal y RGPD:** textos legales en el registro, borrado y exportación de cuenta, y retención de leads y enlaces compartidos.
4. **Comercial:** landing, Stripe (BG-004) y analítica con consentimiento. Son el requisito para el test de Meta Ads.
5. **Calidad de UI:** tokens de color, CSS por capas, primitivas (IconButton, Field, Alert, EmptyState) y menos carga en la ruta de login.
6. **Contexto para agentes:** `CLAUDE.md` versionado, unificar AGENTS y specs, y archivar los documentos históricos.
7. **App nativa:** después de lo anterior, y según la spec [BG-014](../specs/BG-014-app-nativa.md), aprobada el 14-11-2026.
