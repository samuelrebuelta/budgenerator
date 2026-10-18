# BG-005 — Formulario público de estimación

**Estado:** alcance acotado para esta entrega; no incluye landing ni generación de textos con IA.
**Fecha:** 2026-10-18.

**Refinamiento posterior:** la configuración y el cálculo nuevos por estancia y precio por m² se especifican en `2026-10-18-bg-005-estimador-configuracion-simple-design.md`. El contrato anterior de catálogo sigue siendo esquema 1 para no romper enlaces activos.

## Intención

Permitir que una empresa comparta desde cualquier landing un enlace de BudGenerator a un formulario público. El visitante describe la reforma con preguntas cotidianas y recibe una horquilla orientativa calculada con los precios de venta del catálogo de esa empresa.

## Objetivos

- La empresa configura qué combinaciones de estancia, alcance y calidad puede estimar, vinculándolas a conceptos del catálogo y a cantidades mínimas y máximas.
- El propietario publica o revoca un enlace aleatorio que puede copiar en una landing externa.
- El visitante puede elegir una o varias estancias, indicar si la reforma es parcial o integral, seleccionar calidad de materiales e indicar una superficie aproximada.
- El formulario devuelve una horquilla reproducible y no vinculante.
- Sólo el backend lee el catálogo privado para calcular. La página pública recibe el importe total, nunca costes internos, precios unitarios, UID ni el documento privado del catálogo.
- El visitante puede contactar con la empresa desde los datos que ésta autorice mostrar.

## No objetivos de esta entrega

- Crear o editar la landing de la empresa, integrar Web Factory Lite o generar contenido con IA.
- Guardar datos personales ni solicitudes de clientes en BudGenerator. Esta versión calcula y permite llamar o abrir un correo; el almacenamiento privado de solicitudes requiere el endpoint, controles de abuso y política de retención definidos por BG-005.
- Publicar precios unitarios o permitir que el enlace consulte directamente `users/{uid}/tariffCatalogs/main-v1`.
- Decidir la elegibilidad Free/Pro de BG-004, desplegar Functions o cambiar datos de producción.

## Experiencia y cálculo

La ruta pública es `/solicitar-presupuesto/:token`. El token es un identificador opaco, aleatorio y revocable, no una credencial que dé acceso al catálogo. Una landing externa sólo enlaza a esa URL.

La empresa añade configuraciones estimables para combinaciones de estancia, alcance (parcial o integral) y calidad (básica, estándar o alta). Para cada combinación elige conceptos de `main-v1`. Por cada concepto configura cantidad mínima y máxima por m² para unidades de superficie/longitud/volumen, o cantidad mínima y máxima por estancia para unidades/hora. Sólo se publican combinaciones completas con conceptos válidos.

El formulario ofrece estas estancias: baño, cocina, salón, dormitorio, vivienda completa y exterior/terraza. Para cada estancia seleccionada pide alcance, calidad y superficie aproximada (1–1000 m²). Las opciones se limitan a combinaciones configuradas por la empresa. La cantidad por superficie se multiplica por los m² indicados; la cantidad por estancia no escala. La horquilla suma `basePrice × cantidad mínima/máxima` por concepto. No se aplica un multiplicador comercial ni un porcentaje de error arbitrario. Se presenta en euros sin IVA y con aviso de que no sustituye una visita ni un presupuesto final.

La configuración privada guarda IDs y parámetros de cantidad. El backend obtiene las tarifas actuales del catálogo en cada cálculo, valida referencias y responde únicamente con el rango y los datos de contacto que la empresa habilitó. Si falta un concepto o el precio no es válido, el servicio no se ofrece para estimación hasta corregirlo.

La respuesta no contiene precios unitarios ni permite descargar el catálogo. Aun así, un visitante puede comparar horquillas con muchas combinaciones y aproximar algunos precios subyacentes; el límite por token válido reduce esa clase de consultas, pero la estimación pública no puede impedir toda inferencia matemática sobre sus totales. Los tokens inválidos también consumen invocaciones y lecturas para rechazarlos, por lo que el límite por token no es una defensa frente a ráfagas globales ni un techo de coste. Antes del despliegue hay que valorar controles globales y alertas de presupuesto.

## Acceso y seguridad

- Configuración: `users/{uid}/quoteEstimator/settings`, legible y editable sólo por su titular.
- Índice privado de tokens: `publicQuoteTokens/{token}`, administrado por Cloud Functions; las reglas de Firestore deniegan lectura y escritura de clientes.
- El formulario llama a una función para resolver el token y calcular. La función no devuelve UID, catálogo, descripción interna, tarifas unitarias ni costes.
- La página no escribe datos del visitante. El CTA abre `tel:` o `mailto:` con las respuestas y el rango si la empresa habilitó teléfono o email.
- La función limita instancias y frecuencia por token válido. No habrá instancias mínimas; tokens inválidos todavía generan una invocación y una lectura de índice, y `maxInstances` no limita el total de invocaciones. Antes del despliegue hay que valorar controles globales y alertas de presupuesto.
- La región inicial será `europe-west1`. Antes de desplegar se debe confirmar el plan de Firebase y la ubicación de Firestore; no se despliega en esta entrega.

## Acceso comercial y publicación

La configuración no añade una regla Free/Pro. Esa elegibilidad sigue pendiente de concretar con BG-004. El enlace sólo existe tras una acción explícita de publicación; revocarlo invalida el token. El documento de solicitudes privadas, su retención y el borrado/exportación quedan para una fase posterior antes de aceptar datos personales.

## Criterios de aceptación

- Un titular puede configurar, publicar, copiar y revocar un enlace sin incluir su UID en la URL.
- Un token válido sólo permite obtener el cálculo autorizado; un token inexistente o revocado no revela información de empresa ni de catálogo.
- Las reglas impiden a una sesión pública y a otra cuenta leer o modificar configuraciones e índices privados.
- Los cálculos usan sólo `basePrice`; `cost` nunca aparece en el resultado de la función ni en la interfaz pública.
- Los casos parcial/integral, calidad y superficie seleccionan la regla configurada; las horquillas suman mínimos y máximos y son reproducibles.
- La interfaz pública no guarda respuestas ni datos personales; ofrece estimación sin IVA y un CTA de contacto autorizado.
- Se prueban reglas en emuladores y se verifican lint, formato, build, unitarias y navegación E2E disponible.

## Pendientes antes de producción

- Confirmar el plan de Firebase que habilita el despliegue de Cloud Functions y estimar su coste operativo.
- Confirmar región real de Firestore y ajustar `europe-west1` si corresponde.
- Decidir la elegibilidad Free/Pro junto con BG-004.
- Definir endpoint seguro, controles de abuso, privacidad, consentimiento y retención si la siguiente fase guarda solicitudes de clientes.
