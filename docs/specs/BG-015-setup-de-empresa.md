# BG-015 — Configuración inicial de la empresa por oficio: catálogo base y formulario de solicitudes

Estado: aprobado

Fecha: 2026-11-14. Plataformas: PWA (escritorio y móvil) y app Expo ([BG-014](BG-014-app-nativa.md)). Incluye cambio de producto (precios de referencia), de modelo de datos (perfil y estimador), de reglas y de Functions. Las decisiones D1–D8 se aprobaron con el propietario el 14-11-2026, que pidió incluir también la adaptación del formulario de solicitudes a otros oficios; D9–D12 se aprobaron el 15-11-2026 y con ellas la spec. La aprobación autoriza el trabajo por fases en PRs separadas; despliegues y cambios de reglas o Functions en producción siguen necesitando instrucción explícita (AGENTS.md).

## Objetivo

Que una empresa recién registrada no empiece con un catálogo vacío o con 300 partidas a 0 €. Tras el alta, un asistente visual pregunta a qué se dedica (uno o varios oficios: reformas, electricidad, fontanería, carpintería…), le propone un catálogo base con precios de referencia para esos oficios, le deja revisarlo y ajustarlo, y lo importa en «Mi catálogo» en formato BC3 (FIEBDC, el modelo canónico de la app). En menos de dos minutos puede crear su primer presupuesto con partidas y precios reales.

El formulario público de solicitudes deja de estar ligado a reformas por estancias: cada empresa ofrece los servicios de sus oficios (p. ej. «Puntos de luz» para un electricista o «Puertas de paso» para un carpintero), con la medida que tiene sentido para cada uno, y la horquilla orientativa se calcula igual que hoy.

## Situación actual (comprobada en el código)

- El alta (`src/pages/login/LoginPage.tsx`, `apps/mobile/app/(auth)/register.tsx`) crea la cuenta y, en la web, marca el tour de bienvenida (`src/features/app-tour`). No hay asistente ni campo de oficio: `CompanyProfile` (`packages/domain/src/types/index.ts`) sólo tiene nombre, CIF, dirección, teléfono, email, aviso de privacidad y logo, y `validProfile` en `firestore.rules` impide otras claves.
- Al cargar la sesión, `createCatalogStore.loadCatalogs` (`packages/app-core/src/stores/catalog.ts`) siembra de forma idempotente `users/{uid}/catalog/main` con la biblioteca «Reforma integral»: 30 capítulos con precio y coste a 0 (decisión de la [spec de 19-10-2026](2026-10-19-catalogo-importaciones-reforma-integral-design.md): «no inventar precios»).
- El importador «Importar por categoría» (`importTrade`) y la importación BC3 (`importDocument`) fusionan con `mergeIntoCatalog`: capítulos por nombre normalizado y partidas por resumen y unidad, sin sobrescribir precios. Las bibliotecas viven en TypeScript en `packages/domain/src/catalog/baseCatalogs.ts` y ya están en los paquetes que comparten web y móvil.
- El formulario público (`src/pages/public-quote/QuoteEstimatorPage.tsx`, Functions en `functions/src/quoteEstimator.ts`, dominio en `packages/domain/src/quote-estimator`) sólo conoce reformas: alcance parcial o integral, estancias (`ESTIMATOR_ROOMS`: baño, cocina, salón, dormitorio, exterior), superficie y calidad, con tarifas por m² y estancia (`SimpleQuoteEstimatorSettings`, esquema 2). El esquema 1 (combinaciones de catálogo) sigue vivo para enlaces antiguos. Las solicitudes guardan `selections` con esa forma y las pintan Solicitudes (web), el detalle de presupuesto, el detalle de solicitud de la app (`apps/mobile/src/features/leads/model.ts`) y el aviso push.
- La app Expo tiene alta, login y los stores de catálogo y perfil montados (`apps/mobile/src/state/stores.ts`), pero aún no pantalla de catálogo (fase 2 de BG-014). Tiene `expo-haptics`, `react-native-reanimated`, `react-native-gesture-handler` y `expo-glass-effect`; no tiene `react-native-svg`.

## Decisiones

| ID  | Pregunta                                                    | Propuesta                                                                                                                                                                                                                                                                                                                           |
| --- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | ¿De dónde salen los «precios estándar»?                     | Base propia de BudGenerator, redactada a partir de rangos públicos de mercado (España, media nacional, sin IVA, fecha de referencia visible). **No** copiar bases con licencia (generadores de precios comerciales, BEDEC, PREOC). Revisión del propietario antes de publicar. Sustituye «no inventar precios» sólo para esta base. |
| D2  | Lista de oficios                                            | 16 oficios iniciales (ver «Oficios»). Se pueden añadir sin migrar datos.                                                                                                                                                                                                                                                            |
| D3  | ¿El asistente es obligatorio?                               | Se abre siempre tras el alta, pero se puede omitir («Ahora no, empezar en blanco») y repetir desde Catálogo y Ayuda.                                                                                                                                                                                                                |
| D4  | ¿Qué pasa con la siembra automática de «Reforma integral»?  | Las cuentas nuevas se crean con el catálogo vacío; el contenido llega por el asistente. Las cuentas existentes no cambian.                                                                                                                                                                                                          |
| D5  | ¿Cómo se ajustan los precios en el asistente?               | Un único control «Nivel de precios de tu zona» de −20 % a +30 % (pasos de 5 %) con ejemplo en vivo. El margen se respeta: coste y precio escalan juntos. Nada más en v1.                                                                                                                                                            |
| D6  | Ilustraciones de los oficios                                | Set propio de 16 ilustraciones planas con los tokens de marca, en SVG para la web y PNG @2x/@3x generados por script para la app (sin añadir `react-native-svg`). Alternativa barata: iconos lucide (web) y Feather (app), menos vistosa.                                                                                           |
| D7  | ¿Pedir datos de empresa en el asistente?                    | Sólo el nombre comercial (opcional, se guarda en el perfil). Logo, CIF y dirección siguen en «Mi empresa», que el tour señala al final.                                                                                                                                                                                             |
| D8  | ¿Se sustituyen las bibliotecas a 0 € del importador actual? | No en esta spec. El importador añade una entrada «Catálogo base por oficio» que reutiliza el paso de revisión. Retirar las bibliotecas a 0 € queda como seguimiento.                                                                                                                                                                |
| D9  | Compatibilidad del formulario                               | Esquema 3 aditivo en `users/{uid}/quoteEstimator/settings`: estancias de reforma (lo actual) más servicios por oficio. Los enlaces con esquema 1 y 2 siguen funcionando sin migrar; al guardar la configuración nueva se pasa a 3. Las solicitudes antiguas se siguen mostrando como hoy.                                           |
| D10 | Precios de los servicios del formulario                     | Se proponen a partir de la base de D1 con el nivel de precios elegido en el asistente; la empresa los revisa antes de publicar. El asistente no publica ni escribe la configuración del formulario: sólo la deja propuesta.                                                                                                         |
| D11 | Campo libre «Cuéntanos qué necesitas»                       | Sí, opcional y de hasta 1000 caracteres. Al anonimizar una solicitud a los 12 meses se borra, porque puede contener datos personales. Sin fotos en v1.                                                                                                                                                                              |
| D12 | Configuración del formulario en la app                      | Se mantiene sólo en la web (BG-014). La app muestra bien las solicitudes nuevas, el aviso push y el resumen del formulario con sus servicios.                                                                                                                                                                                       |

D1–D8: aprobadas el 14-11-2026. D9–D12: aprobadas el 15-11-2026.

## Alcance y exclusiones

- Incluye:
  - Base de oficios y partidas con precio y coste de referencia, versionada, en `@bg/domain`.
  - Constructor puro del catálogo propuesto (unión de oficios sin duplicados, exclusiones, ajuste de precios) que devuelve un documento FIEBDC de tipo base de precios.
  - Estado `setup` y `trades` en el perfil de empresa, con reglas y tests contra emuladores.
  - Asistente en la PWA (escritorio y móvil) y en la app Expo con la misma lógica compartida en `@bg/app-core`.
  - Entrada «Catálogo base por oficio» en Catálogo (web) para cuentas existentes y para quien omitió el asistente.
  - Encadenar el tour de bienvenida tras el asistente en la web.
  - Formulario de solicitudes por oficio: servicios por oficio con su medida, configuración propuesta según los oficios de la empresa, formulario público, cálculo y envío en Functions, y visualización de las solicitudes nuevas en web, app y aviso push.
- No incluye: precios por provincia o código postal, actualización automática de precios ya importados, IA, descomposición de precios (mano de obra/material), presupuesto con capítulos generado desde la solicitud (los servicios guardan los códigos de partida para hacerlo después), fotos en la solicitud, configuración del formulario en la app, retirar las bibliotecas a 0 €, analítica de producto, tablet y modo oscuro en la app.

## Oficios

Selección múltiple. Cada oficio declara los capítulos que aporta; un capítulo compartido (p. ej. «Varios» o «Demoliciones») sólo aparece una vez.

Reformas integrales · Albañilería · Electricidad · Fontanería · Carpintería de madera · Carpintería metálica y PVC · Pintura · Pladur y techos · Climatización · Cocinas · Baños · Suelos y alicatados · Cubiertas e impermeabilización · Energía solar · Cerrajería · Jardinería y exteriores.

«Reformas integrales» incluye los capítulos de todos los gremios residenciales (equivale a la biblioteca actual, ahora con precios).

## Experiencia

### Flujo (común a todas las plataformas)

1. **Bienvenida.** Ilustración, «Vamos a preparar tu catálogo en 2 minutos», campo opcional de nombre comercial y botón «Empezar». Enlace secundario «Ahora no, empezar en blanco».
2. **¿A qué se dedica tu empresa?** Cuadrícula de tarjetas ilustradas, selección múltiple con check animado. Contador «3 oficios · 142 partidas» que se actualiza al marcar. Buscador si la lista crece. Continuar exige al menos un oficio.
3. **Tu catálogo base.** Capítulos resultantes con interruptor por capítulo, número de partidas y rango de precios. Al abrir un capítulo se ven sus partidas (resumen, unidad, precio) y se pueden desmarcar una a una. Control «Nivel de precios de tu zona» (D5) que recalcula los precios mostrados con una animación breve. Aviso fijo: «Precios orientativos sin IVA (referencia nov-2026). Revísalos antes de presupuestar».
4. **Importación.** Animación de progreso corta, resumen («12 capítulos y 142 partidas añadidas a Mi catálogo») y dos acciones: «Crear mi primer presupuesto» y «Ver mi catálogo». En la web arranca después el tour de bienvenida, sin la parada del importador.

Reglas de comportamiento:

- El progreso se guarda en local por cuenta (paso, oficios, exclusiones, ajuste) y se recupera al recargar o reabrir la app. Se borra al terminar u omitir.
- Volver atrás conserva todo. Cambiar oficios en el paso 2 recalcula el paso 3 conservando las exclusiones que sigan aplicando.
- Importar requiere conexión: sin red se muestra el estado de BG-012 y el botón se desactiva; no se pierde la selección.
- Doble pulsación o dos pestañas no duplican: la importación usa `mergeIntoCatalog` y el estado `setup` se escribe una vez.
- El asistente se muestra si el perfil no tiene `setup` **y** el catálogo no tiene partidas. Así aparece en el primer dispositivo donde entre la cuenta nueva (web o app) y nunca a cuentas existentes, que ya tienen catálogo sembrado.

### PWA — escritorio (≥ breakpoint `shell`)

- Ruta `/setup` a pantalla completa, fuera de la shell (sin tabs ni menú), con logo y «Salir del asistente».
- Dos columnas: a la izquierda los pasos (stepper vertical con estado) y el contenido; a la derecha, desde el paso 2, un panel fijo «Tu catálogo» que crece en vivo con los capítulos que van entrando (lista con conteos y un mini gráfico de barras por capítulo).
- Tarjetas de oficio en cuadrícula de 4 columnas; teclado completo (Tab, Espacio para marcar, Enter para continuar), foco visible.
- En el paso 3 la lista de capítulos es un acordeón; el detalle de partidas se despliega en línea con la tabla de partidas (resumen, unidad, precio).

### PWA — móvil

- Mismo `/setup` a pantalla completa con barra de progreso arriba y botón principal fijo abajo respetando el área segura.
- Tarjetas en 2 columnas; el contador de partidas va en el botón («Continuar · 142 partidas»).
- El panel «Tu catálogo» se convierte en un resumen plegable sobre la lista; el detalle de un capítulo se abre en `Modal size="sheet"`, como el importador por categoría.
- Transiciones horizontales entre pasos y retroceso con el gesto del navegador; movimiento reducido las quita.

### App Expo (iOS y Android)

- Grupo de rutas `app/(app)/setup/` (`index`, `trades`, `catalog`, `chapter/[chapterId]`, `done`) en un stack sin tabs. El guard de `(app)/_layout.tsx` redirige ahí con la condición común; el registro sigue llevando al login y, tras entrar, al asistente.
- Lenguaje visual de BG-014: Liquid Glass (`expo-glass-effect`) en la barra inferior en iOS y Material 3 en Android. Tarjetas grandes de oficio (2 columnas) con háptica ligera al marcar (`expo-haptics`) y animación de escala con Reanimated.
- Paso 3 con `SectionList` de capítulos e interruptores nativos; el detalle se abre como hoja (`presentation: 'formSheet'`). El control de nivel de precios es un selector segmentado de pasos (sin dependencia nueva de slider).
- «Ver mi catálogo» sólo aparece cuando exista la pantalla de catálogo de BG-014 fase 2; hasta entonces, la acción principal es crear el primer presupuesto, cuyo alta guiada ya usa el catálogo.
- Accesibilidad: cada tarjeta es `accessibilityRole="checkbox"` con estado; VoiceOver y TalkBack anuncian el contador.

## Formulario de solicitudes por oficio

### Modelo

- Cada oficio de la base declara sus **servicios públicos**: `StarterService { id, tradeId, label, description, measure, qualities, itemCodes }`.
  - `measure`: `area` (m²), `length` (m lineales), `count` (unidades, con etiqueta propia: «puntos», «puertas», «equipos») o `visit` (precio fijo de visita o diagnóstico).
  - `qualities`: si el servicio pregunta calidad (media, alta, lujo, como hoy) o no.
  - `itemCodes`: partidas de la base que lo componen; sirven para proponer el precio y, más adelante, para crear un presupuesto con capítulos desde la solicitud.
- Ejemplos: Electricidad → instalación completa de vivienda (m²), puntos de luz y enchufes (puntos), cambio de cuadro (unidad), boletín (visita). Carpintería de madera → puertas de paso (puertas), armario empotrado (ml), tarima (m²). Fontanería → cambio de bañera por plato (unidad), renovar instalación de baño (unidad). Pintura → interior de vivienda (m²). Climatización → instalar split (equipos). Energía solar → instalación de autoconsumo (paneles). Reformas integrales y parciales → las estancias actuales, sin cambios para quien ya las usa.
- Configuración, esquema 3: `{ schemaVersion: 3, rooms?: RoomEstimateRate[], services: ServiceEstimateRate[], contact }`, con `ServiceEstimateRate { serviceId, enabled, minimumCentsPerUnit, maximumCentsPerUnit, qualityStepCentsPerUnit? }`. `rooms` conserva el contrato del esquema 2.
- Solicitudes: `selections` admite además `{ kind: 'service', serviceId, quantity, quality?, instanceId }`; las de estancia no cambian. Se añade `details?` (D11). El cálculo de la horquilla (`calculateQuoteRange`) suma estancias y servicios con el mismo redondeo.

### Configuración (web, `/quote-estimator`)

- Si no hay configuración y el perfil tiene `trades`, la pantalla parte de una propuesta: los servicios de esos oficios activados, con precios de la base (D10). Un usuario de reformas ve también las estancias, como hoy.
- Lista agrupada por oficio con interruptor por servicio, precio mínimo y máximo por unidad con la unidad visible («€ por punto», «€ por m²») y el ejemplo de horquilla de BG-013 adaptado a cada medida.
- Se conservan requisitos, borrador, errores por campo, pausa, enlace corto, QR y kit para compartir de BG-013.

### Formulario público (`/q/{token}` y `/p/{slug}`)

- Paso «¿Qué necesitas?»: tarjetas con los servicios activos de la empresa, agrupadas por oficio sólo si tiene más de uno, con las mismas ilustraciones del asistente. Selección múltiple.
- Paso de detalle por servicio: cantidad con la unidad del servicio (control con − y + para unidades, campo numérico para m² y ml) y calidad cuando aplique. Si la empresa ofrece reforma por estancias, se mantiene el flujo actual de estancias como un servicio más.
- Campo opcional «Cuéntanos qué necesitas» (D11), contacto, cuándo empezar, consentimiento y horquilla, como hoy.
- Textos neutros: «trabajo» o «servicio» en vez de «reforma» salvo en los servicios de reforma; el título pasa a «Solicita tu presupuesto a {empresa}».
- Escritorio y móvil con el mismo patrón que el asistente (cuadrícula de tarjetas y botón fijo abajo en móvil).

### Functions y datos

- `getPublicEstimator` devuelve los servicios activos (id, etiqueta, medida, calidades), nunca precios unitarios, `itemCodes` ni costes. `calculatePublicEstimate` y `submitPublicLead` validan el esquema 3 con los mismos límites (cantidad máxima por medida, número máximo de selecciones, longitud de `details`) y los guardas anti-abuso actuales.
- El aviso push y su texto resumen los servicios («Nueva solicitud: puntos de luz y cambio de cuadro»).
- Retención: la anonimización a 12 meses borra también `details`.
- La exportación de cuenta incluye la configuración y las solicitudes nuevas sin cambios de formato.

### Solicitudes en web y app

- Solicitudes (web), el detalle de presupuesto que enlaza la solicitud y el detalle de solicitud de la app muestran cada servicio con cantidad, unidad y calidad, y el texto libre. Un helper compartido en `@bg/domain` (`describeLeadSelection`) da el texto para las tres pantallas y el push.
- Crear un presupuesto desde la solicitud se comporta como hoy (datos del cliente y la solicitud como referencia).

## Diseño técnico

### Datos de la base (`@bg/domain`)

- `packages/domain/src/catalog/starter/`:
  - `trades.ts`: `StarterTrade { id, name, description, illustration, chapterIds }`.
  - `chapters/*.ts`: un fichero por capítulo con `StarterItem { code, summary, unit, price, cost, longText? }`. Códigos estables (`ELE010`, `FON020`…) para conservar `~X`/códigos al exportar BC3 y poder ofrecer actualizaciones de precios en el futuro.
  - `version.ts`: `STARTER_CATALOG_VERSION` y fecha de referencia de precios.
- `buildStarterCatalog({ tradeIds, excludedChapterIds, excludedItemCodes, priceAdjustment })` → `ConstructionDocument` (base de precios) más resumen (capítulos, partidas, rango de precios). Puro, sin I/O, redondeo con `budgetMath`. Límite de tamaño comprobado por test frente a `CONTENT_CHUNK_BYTES × MAX_CONTENT_CHUNKS`.
- Test de ida y vuelta: el documento de cada oficio se serializa a `.bc3` con `serializeBc3`, se vuelve a leer con `parseBc3` y coincide (la base se puede descargar como BC3 desde Catálogo con el export ya existente).

### Estado compartido (`@bg/app-core`)

- `createSetupStore` sobre `zustand/vanilla` (patrón de BG-014): paso, oficios, exclusiones, ajuste, estado de importación y error. Persistencia del borrador con el puerto de almacenamiento offline por UID (`localStorage` en web, MMKV de la cuenta en móvil; se borra en `resetSession`).
- `completeSetup()`: comprueba conexión y sesión, llama a `catalogStore.importDocument(buildStarterCatalog(...))`, guarda en el perfil `trades` y `setup = { status: 'completed', version, completedAt }` y limpia el borrador. `skipSetup()` guarda `setup = { status: 'skipped' }`. Protección contra doble ejecución y revisión de sesión como en el asistente de BG-008.
- `needsSetup(profile, catalog)`: selector puro con la condición común.

### Siembra y perfil

- `loadCatalogs` deja de sembrar «Reforma integral»: `ensureCatalog` crea `main` vacío para cuentas nuevas (D4). Un cliente antiguo aún en caché podría sembrarla; el asistente fusiona sin duplicar, así que es aceptable.
- `CompanyProfile` añade `trades?: string[]` y `setup?: { status: 'completed' | 'skipped'; version?: number; completedAt?: Timestamp }`. Repositorio de perfil y store aceptan los campos nuevos.
- `validProfile` en `firestore.rules` admite `trades` (lista ≤ 20 cadenas de ≤ 40 caracteres) y `setup` (claves cerradas, `status` en la lista, `version` entero). Cambio con la skill `rules-change` y casos en `pnpm test:rules`: dueño escribe válido, claves extra rechazadas, lista demasiado larga rechazada, otro UID rechazado.

### Web

- `src/pages/setup/` con la página y sus pasos; feature `src/features/company-setup/` con los componentes reutilizables (tarjeta de oficio, revisión de capítulos) que también usa el importador de Catálogo.
- `AuthGuard`/`ProtectedLayout` redirigen a `/setup` cuando `needsSetup`; `/setup` redirige a `/budgets` si ya no aplica. El tour se marca pendiente al terminar u omitir el asistente, no al registrarse.
- Ilustraciones en `src/shared/assets/trades/` (D6); el resto con primitivas de `src/shared/ui` y tokens.

### App Expo

- Rutas en `apps/mobile/app/(app)/setup/`, componentes en `apps/mobile/src/features/setup/`, mismo store de `@bg/app-core`. PNG de ilustraciones generados por script desde los SVG de la web.

## Criterios de aceptación

- [ ] Una cuenta nueva (web o app) ve el asistente al entrar por primera vez; una cuenta existente nunca lo ve sin pedirlo.
- [ ] Se pueden elegir varios oficios; el catálogo propuesto es la unión sin capítulos ni partidas duplicados.
- [ ] Desmarcar capítulos o partidas y cambiar el nivel de precios se refleja en la vista previa y en lo importado; coste y precio escalan juntos.
- [ ] Tras importar, «Mi catálogo» contiene exactamente lo revisado, con precios distintos de 0, y el alta guiada de presupuestos los usa.
- [ ] Repetir la importación (desde Catálogo o con doble pulsación) no duplica nada ni cambia precios ya personalizados.
- [ ] Omitir deja el catálogo vacío, marca `setup.status = 'skipped'` y el asistente se puede abrir desde Catálogo y Ayuda.
- [ ] Recargar la web o cerrar la app a mitad recupera el paso y la selección.
- [ ] Sin conexión no se puede importar y no se pierde la selección.
- [ ] El catálogo importado se exporta a `.bc3` y se reimporta sin diferencias.
- [ ] Reglas: sólo el dueño escribe `trades` y `setup` válidos; claves y tamaños inválidos se rechazan en el emulador.
- [ ] Web: flujo completo con teclado y lector de pantalla, a 320 px, 390 px y escritorio; movimiento reducido respetado. El tour arranca tras el asistente.
- [ ] App: flujo completo en el simulador de iOS y en Android con VoiceOver/TalkBack; háptica y animaciones no bloquean.
- [ ] El aviso de precios orientativos y su fecha de referencia se ven en el paso 3 y en el resumen.
- [ ] Un electricista sin configuración previa abre `/quote-estimator` y ve sus servicios propuestos con precios; publica sin tener que crear estancias.
- [ ] El formulario público de una empresa con varios oficios muestra sólo sus servicios activos y calcula la horquilla para servicios y estancias mezclados.
- [ ] Los enlaces con esquema 1 y 2 publicados antes siguen calculando y recibiendo solicitudes igual que hoy (tests de Functions con sus datos).
- [ ] La respuesta pública no incluye precios unitarios, costes ni códigos de partida.
- [ ] Las solicitudes nuevas se ven bien en Solicitudes (web), en el detalle de la app y en el aviso push; las antiguas no cambian.
- [ ] La anonimización a 12 meses borra el texto libre.

## Riesgos

- **Precios de referencia erróneos o desfasados.** Pueden acabar en presupuestos reales. Mitigación: aviso visible, fecha de referencia, revisión del propietario (D1) y versión de la base para ofrecer actualizaciones más adelante.
- **Licencia de los datos.** Copiar una base comercial expone a reclamaciones. Mitigación: base propia y fuentes anotadas en el fichero de datos.
- **Cuenta creada con un cliente antiguo** que todavía siembra «Reforma integral»: el catálogo ya tiene partidas y el asistente no se abre. Mitigación: en Catálogo, banner «Configura tu catálogo por oficio» mientras `setup` falte.
- **Tamaño del catálogo.** Elegir todos los oficios no debe acercarse al límite de trozos; test de tamaño con todos los oficios.
- **Divergencia web/app.** Toda la lógica (construcción, condición de entrada, completar/omitir) vive en paquetes compartidos; las apps sólo pintan.
- **Romper enlaces publicados del formulario.** Hay empresas con enlaces de esquema 1 y 2 repartidos. Mitigación: esquema 3 aditivo, sin migración, y tests de Functions con configuraciones y solicitudes de cada esquema.
- **Texto libre en solicitudes públicas.** Puede traer datos personales o spam. Mitigación: límite de longitud, mismos guardas anti-abuso y borrado en la anonimización.
- **Clientes web antiguos en caché** que no saben pintar solicitudes de servicio: el texto de respaldo de `describeLeadSelection` y la actualización explícita de la PWA lo limitan; la app necesita versión nueva antes de que lleguen solicitudes de servicio a usuarios de la app.
- **Dependencia de BG-014 fase 2** para ver el catálogo en la app: el asistente funciona sin esa pantalla.

## Tests

- Unitarios (Vitest, `packages/domain`): unión de oficios sin duplicados, exclusiones, ajuste y redondeo, códigos únicos, tamaño máximo, ida y vuelta BC3, todos los precios > 0 y coste ≤ precio.
- Unitarios (`packages/app-core`): `needsSetup`, `completeSetup` (conexión, sesión obsoleta, doble ejecución, error con selección conservada), `skipSetup`, persistencia del borrador y limpieza en `resetSession`.
- Reglas: casos de `validProfile` con `trades` y `setup` en `pnpm test:rules`.
- Formulario: unitarios del cálculo con servicios y estancias mezclados, validación del esquema 3, propuesta de configuración desde `trades` y `describeLeadSelection`; integración de Functions (`pnpm test:integration`) para esquemas 1, 2 y 3, límites, respuesta pública sin datos internos y anonimización de `details`; E2E de configurar como electricista, publicar, enviar una solicitud y verla en Solicitudes.
- Web (Vitest + Testing Library): pasos, contador, accesibilidad de tarjetas. E2E Playwright con emuladores: alta → asistente → importación → presupuesto con precios; omitir y reabrir desde Catálogo; recarga a mitad; móvil 390 px.
- App (Jest + RNTL): pantallas y guard. Flujo Maestro `setup-wizard` contra emuladores `demo-*`.

## Plan

Estimación: 8–10 semanas de un desarrollador. Cada fase en una PR.

### Fase 0 — Decisiones y datos (1,5–2 semanas)

- [x] Resolver D1–D8 (14-11-2026).
- [x] Resolver D9–D12 y aprobar la spec (15-11-2026).
- [ ] Taxonomía de oficios → capítulos y partidas con códigos (unas 350–450 partidas).
- [ ] Precios y costes de referencia con fuentes anotadas; revisión del propietario.
- [ ] Servicios públicos de cada oficio con su medida y sus códigos de partida.
- [ ] Ilustraciones (D6).

### Fase 1 — Núcleo compartido (1 semana)

- [ ] `catalog/starter` y `buildStarterCatalog` en `@bg/domain` con sus tests.
- [ ] `trades` y `setup` en `CompanyProfile`, repositorio y store; `validProfile` y `test:rules` (skill `rules-change`).
- [ ] `createSetupStore`, `needsSetup`, `completeSetup` y `skipSetup` en `@bg/app-core`.
- [ ] Siembra vacía en `loadCatalogs` para cuentas nuevas.

### Fase 2 — PWA (1,5–2 semanas)

- [ ] `/setup` con los cuatro pasos, versiones de escritorio y móvil.
- [ ] Redirección desde el guard, encadenar el tour y quitar la parada del importador para quien viene del asistente.
- [ ] Entrada «Catálogo base por oficio» y banner en Catálogo; enlace en Ayuda.
- [ ] Tests de componentes y E2E; capturas en `docs/testing-evidence/bg015-*`.

### Fase 3 — App Expo (1,5 semanas)

- [ ] Rutas `(app)/setup/*`, guard y pantallas con Liquid Glass / Material 3, háptica y animaciones.
- [ ] Ilustraciones PNG generadas por script.
- [ ] Jest, flujo Maestro y prueba manual en simulador iOS y Android.

### Fase 4 — Formulario de solicitudes por oficio (2,5–3 semanas)

- [ ] Esquema 3, cálculo y `describeLeadSelection` en `@bg/domain` con sus tests.
- [ ] Functions: lectura, cálculo, envío, push y anonimización con el esquema 3; integración con emuladores para los tres esquemas.
- [ ] Configuración en `/quote-estimator` con la propuesta desde `trades`.
- [ ] Formulario público por servicios en escritorio y móvil, con textos neutros.
- [ ] Solicitudes en web y en la app (detalle y push).
- [ ] E2E y capturas `docs/testing-evidence/bg015-form-*`.

### Fase 5 — Cierre

- [ ] Actualizar `docs/product.md` (el formulario ya no es sólo de reformas), `docs/firebase.md` (esquema 3 y Functions), `docs/state-and-cache.md`, el plan y esta spec con resultados reales (skill `doc-sync`, `verify`).
