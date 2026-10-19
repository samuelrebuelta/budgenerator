# Reforma integral importable — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar la biblioteca importable antigua por una base única y amplia de reforma integral con 30 partidas acordadas.

**Architecture:** La biblioteca seguirá definida como datos estáticos en `baseCatalogs.ts`, en la forma de tarifas existente para que `tradeImport` siga importando todo, una partida o un concepto. El store usará esa misma base para sembrar sólo cuentas sin catálogo ni tarifas anteriores.

**Tech Stack:** TypeScript strict, Zustand y catálogo de Firestore existente.

**Spec:** `docs/superpowers/specs/2026-10-19-catalogo-importaciones-reforma-integral-design.md`

## Global Constraints

- No añadir dependencias, cambiar reglas ni escribir datos reales de Firebase.
- Mantener español visible e identificadores de código en inglés.
- Partidas en orden alfabético y con nombres de una o dos palabras.
- Coste y tarifa base iniciales en cero; unidades limitadas a `m2`, `m3`, `ml`, `unit` y `hour`.
- No reemplazar ni borrar catálogos privados, presupuestos o plantillas existentes.

## Review Focus

- Todas las 30 partidas aprobadas están presentes y ordenadas alfabéticamente.
- Electricidad contiene instalaciones de potencia, mecanismos y luminarias; telecomunicaciones conserva red, seguridad y domótica.
- Varios y Limpieza no duplican el concepto de limpieza final de obra.
- Cada concepto tiene unidad válida y ambos importes iniciales son cero.
- La carga de una cuenta existente mantiene su catálogo privado; las cuentas nuevas sin catálogo reciben la nueva semilla.

---

### Task 1: Sustituir la biblioteca y la semilla

**Files:**
- Modify: `src/entities/catalog/model/baseCatalogs.ts`
- Modify: `src/entities/catalog/model/store.ts`

**Interfaces:**
- `TRADE_CATALOGS` expone únicamente la biblioteca maestra «Reforma integral»; se conserva la entrada no importable `En blanco` sólo donde ya la requiere el modelo.
- `loadCatalogs` utiliza `reforma_integral` como semilla sólo cuando no existe catálogo ni tarifa legacy.

- [x] Definir las 30 partidas con sus conceptos aprobados y las cinco unidades permitidas.
- [x] Aplanar los conceptos a la interfaz `BaseCatalog.tariffs`, con `basePrice: 0` y `cost: 0`.
- [x] Retirar las antiguas bases especializadas y cambiar la referencia de semilla sin tocar la lógica de carga o limpieza de catálogos privados.

### Task 2: Alinear importación y documentación

**Files:**
- Modify: `tests/catalogTradeImport.test.ts`
- Modify: `tests/catalogStore.test.ts`
- Modify: `docs/specs/BG-008-catalogo-unico-y-creacion-guiada.md`
- Modify: `docs/superpowers/specs/2026-10-18-bg-009-proyectos-como-core-design.md`
- Modify: `docs/plan.md`

**Interfaces:**
- Las pruebas existentes expresan la nueva biblioteca maestra y conservan la expectativa de deduplicación y preservación de tarifas privadas.
- La especificación BG-008 y el plan vigente describen la nueva biblioteca y la ausencia de migración de datos privados.

- [x] Actualizar las expectativas existentes de IDs, recuento y partidas al catálogo aprobado.
- [x] Registrar en los contratos que las tarifas de importación parten de cero, la semilla usa la biblioteca nueva y los catálogos privados no se migran.
- [x] Ejecutar `pnpm test`, `pnpm test:integration`, `pnpm lint`, `pnpm build`, `pnpm format:check` y `git diff --check`.

**Verificación:** 31 archivos y 131 tests unitarios; 41 tests de reglas y 38 E2E; lint, build, formato y diff check correctos. `test:integration` generó capturas de evidencia y se descartaron porque no forman parte de este cambio.
