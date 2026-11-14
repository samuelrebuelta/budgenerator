# BG-005 — implementación del estimador público

**Estado:** implementado localmente en `codex/bg005-public-estimator`; sin despliegue. La entrega incluye formulario, captura/gestión de leads y conversión a presupuesto dentro de BudGenerator. La landing externa solo enlazará a la URL generada.

## Criterios

- El propietario configura combinaciones de estancia, alcance y calidad con conceptos del catálogo `main-v1` y cantidades mínimas/máximas.
- El visitante indica una o varias estancias parciales, o vivienda completa como integral exclusiva, calidad y superficie aproximada (1–1000 m²).
- El token es aleatorio y revocable. No es una regla de Firestore ni permite leer el catálogo al navegador.
- Cloud Functions calcula usando `basePrice` actual, almacena la solicitud bajo el propietario del token y solo devuelve horquilla total, moneda, IVA y confirmación.
- El lead conserva datos básicos de contacto, selecciones, horquilla y prueba del consentimiento hasta que el propietario lo borre manualmente; nunca hay TTL automático.
- El titular puede revisar/borrar el lead o crear desde él un presupuesto relacionado. El presupuesto conserva solo el nombre del cliente; el resto del contexto se mantiene en un panel privado de solo lectura y no se publica.
- No se crean landings, textos con IA, planes Free/Pro ni despliegues.

## Entrega

- [x] Modelo tipado, validación y cálculo puro de la horquilla.
- [x] Cloud Functions v2 para publicar, consultar estado, revocar, obtener opciones y calcular.
- [x] Reglas de Firestore para configuración del propietario y documentos server-only.
- [x] Página privada de configuración y enlace público revocable.
- [x] Formulario público responsive con contacto obligatorio y consentimiento explícito para recibir solicitudes.
- [x] Bandeja autenticada de leads, borrado manual y creación atómica de presupuesto relacionado.
- [x] Selección múltiple de estancias y exclusión integral/vivienda completa.
- [x] Contratos de arquitectura, Firebase, estado/caché, estilos y plan actualizados.
- [x] Unit, reglas y E2E específicos de envío, consulta, borrado y conversión; registro de resultados en `docs/plan.md`.

## Verificación requerida

Se ejecutaron `pnpm lint`, `pnpm format:check`, `pnpm build`, `pnpm build:functions`, 69 tests unitarios, 22 pruebas de reglas en emulador y 28 E2E, incluida la prueba específica del estimador y leads. El emulador ejecutó Node 24 del host aunque Functions declara Node 22. Los cambios de reglas se validaron con las pruebas de emulador.

## Pendiente antes de producción

- Confirmar el plan de Firebase compatible con Cloud Functions.
- Desplegar Functions y reglas con autorización explícita.
- Resolver con BG-004 si el estimador tiene una elegibilidad Free/Pro.
- No publicar precios unitarios. Aunque la API solo devuelve totales, muchas consultas comparativas podrían permitir inferir algunos precios subyacentes.
