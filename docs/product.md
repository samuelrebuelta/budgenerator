# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Usuario principal:** empresas de reformas que preparan presupuestos y mantienen su catálogo, plantillas y datos de empresa. La aplicación autenticada implementa estos flujos; el tamaño o segmento de empresa no está definido.
- **Usuario del estimador público:** persona interesada en una reforma que accede desde un enlace de una empresa y solicita una orientación de precio. Este público está recogido en BG-005; no hay investigación de usuarios documentada.

## Product Purpose

BudGenerator permite a empresas de reformas gestionar un catálogo de precios, preparar presupuestos y plantillas, exportar presupuestos y recibir solicitudes del estimador público. Proyectos reúne el trabajo posterior a la aceptación: conserva el presupuesto original, registra suplementos por imprevistos y muestra la evolución por fecha.

**Hipótesis de propósito, pendiente de validación explícita:** reducir el trabajo manual al preparar presupuestos y conservar la información que la empresa necesita para dar seguimiento a cada solicitud. No hay una métrica de éxito acordada.

## Positioning

El estimador público calcula en Firebase Cloud Functions una horquilla orientativa con precios por m² que configura la empresa. La configuración antigua basada en conceptos de catálogo se conserva para enlaces existentes. El visitante no consulta directamente el catálogo ni recibe precios unitarios internos. Es un mecanismo implementado; no hay una afirmación documentada de diferenciación frente a competidores. Proyectos es la entrada operativa principal: el presupuesto aceptado se conserva como referencia inmutable y el proyecto permite registrar suplementos y seguir el avance por concepto y fecha. El plan Free limita a tres plazas compartidas entre presupuestos y proyectos; convertir conserva la plaza ya ocupada por el presupuesto.

## Operating Context

- La gestión de empresa, catálogo, presupuestos y solicitudes requiere iniciar sesión.
- El estimador se abre desde un enlace público específico de una empresa, previsto para enlazarse desde su landing. El token de la URL resuelve la empresa y puede revocarse.
- La empresa revisa las solicitudes en la pestaña **Solicitudes**. Se conservan hasta que la empresa las borra manualmente; desde una solicitud se puede crear un presupuesto.
- **Web Factory Lite** es una herramienta complementaria para producir webs con un starter personalizable y Codex; mantiene repositorio y despliegue independientes. Su documentación prevé un CMS editable en Sanity y despliegue en Cloudflare. Una web allí puede enlazar al estimador público; no se define integrar ambos productos en un monorepo.

## Capabilities and Constraints

- El formulario público pide nombre, email y teléfono, además de información general de la reforma: tipo de alcance (integral o parcial), estancias, superficie aproximada y calidad de materiales para cada estancia física, y cuándo le gustaría empezar. Por ejemplo, cada baño tiene sus propios m² y calidad; una reforma integral suma las horquillas de las estancias indicadas. Los leads históricos agrupados por cantidad siguen mostrándose como tales.
- La empresa configura por estancia un precio mínimo/máximo por m² para calidad media y un incremento por nivel para calcular alta y lujo. La horquilla se muestra sin IVA y no es una oferta final. La configuración anterior basada en catálogo sigue disponible para enlaces existentes hasta que se reemplace.
- La empresa puede revocar el enlace, revisar los datos de contacto y la información de la reforma, borrar manualmente la solicitud o crear un presupuesto desde ella. No hay borrado automático.
- Se propone una landing sencilla para cada empresa, redactada con ayuda de IA a partir de información pública de la empresa y sus servicios, y editable por la empresa. El formulario de contacto generaría solicitudes en su perfil; el seguimiento seguiría siendo manual, por teléfono y con estados básicos.
- Para definir el estilo de esa landing, el flujo deseado es preguntar antes por tipo de empresa, colores, nombre, ubicación y cliente objetivo; afinar las respuestas y presentar una propuesta visual para revisión antes de programarla. Esta landing y su flujo de creación no están implementados y no implican integrar Web Factory Lite en este repositorio.
- Las solicitudes no requieren un CRM completo, campañas ni automatizaciones. Los precios y partidas se calculan con reglas deterministas y tarifas del catálogo, no con IA; la generación de presupuestos con IA está fuera del roadmap activo.
- La propuesta comercial documentada contempla Free con hasta 3 plazas compartidas entre presupuestos y proyectos, sin límites de catálogos o plantillas, y BudGenerator Pro a 19,99 €/mes + IVA mediante Stripe. La conversión conserva la plaza del presupuesto y borrar un documento no devuelve cuota; los detalles de facturación siguen abiertos.
- Las cuentas `premium` y la administración manual deben conservarse hasta que se defina su transición. Los documentos BG-004, BG-005 y BG-009 son base de sus planes, no autorización de despliegue.
- Los proyectos son una vista operativa del avance, no un sistema de facturación ni una herramienta completa de gestión de obras.

## Brand Commitments

- El nombre vigente es **BudGenerator** (no Tavio).
- La interfaz y documentación del producto están en español; los identificadores de código, en inglés.
- Web Factory Lite mantiene independencia de código y despliegue.

## Evidence on Hand

- El código, las rutas y la documentación del repositorio, incluida la especificación BG-005, describen el comportamiento actual.
- `docs/testing-evidence/bg005-public-form.png` es una captura con datos sintéticos; no constituye investigación de clientes ni un caso de éxito real.
- No hay testimonios aprobados, métricas de clientes, casos de estudio ni benchmarks documentados. No deben inventarse.

## BG-011 — gestión de equipo

`/team` es la tercera tab principal, después de Presupuestos y Proyectos y antes de Solicitudes. Muestra únicamente la planificación semanal: permite revisar qué personas/cuadrillas van a cada proyecto, editar asignaciones por día y filtrar por uno o varios recursos. Un botón de edición junto al título abre `/team/manage`, donde se registran y organizan personas y cuadrillas; el retorno vuelve al calendario conservando la semana y el filtro. Las semanas navegan con swipe o controles y usan transiciones horizontales. Las asignaciones diarias son independientes de los snapshots permanentes del proyecto y avisan si alguien figura en varios proyectos el mismo día. Una persona incluida en una cuadrilla asignada no se puede añadir también de forma individual al proyecto. Cada proyecto puede tener una fecha estimada de fin local; el calendario lo muestra hasta ese día inclusive y señala los proyectos aún sin fecha, que siguen visibles hasta configurarla. No incluye cuentas para trabajadores ni agenda de hitos de capítulos. Las fechas y el progreso de capítulos siguen siendo parte del seguimiento de proyectos BG-009.

Cada tarjeta diaria ofrece un control circular para editar las personas/cuadrillas de ese proyecto y otro para abrir su detalle.

Desde cualquier día se puede registrar un trabajo puntual con una o más personas/cuadrillas, opcionalmente ligado a un proyecto pendiente, en curso o finalizado. El título es obligatorio y la descripción opcional, también si no se enlaza un proyecto. Desde el alta del trabajo se puede registrar una persona activa por su nombre; al guardarla queda asignada al trabajo sin salir de la pantalla. Enlazar una obra finalizada no la reabre ni cambia sus datos; los trabajos se muestran y filtran junto con las asignaciones semanales.

## Intercambio BC3 (FIEBDC-3)

Catálogo, presupuestos y plantillas usan internamente el formato estándar FIEBDC. La empresa puede importar una base de precios BC3 en Catálogo (elige capítulos; no duplica partidas existentes ni cambia sus precios), importar una obra BC3 como presupuesto nuevo desde Presupuestos (vista previa con total y avisos; se bloquea si el total, las mediciones o las referencias no cuadran o si el archivo es una certificación) o como plantilla, y exportar `.bc3` desde Catálogo, el detalle de un presupuesto y el de una plantilla. Las unidades son libres (kg, pa, m²…). Cliente, número, ajuste y costes internos no tienen campo FIEBDC y no se exportan. El alta de partidas sigue siendo descripción, cantidad, unidad y precio; las mediciones por dimensiones y la descomposición del precio son un detalle opcional. La compatibilidad con Presto, Arquímedes o TCQ no está validada con archivos reales.

## Product Principles

Principios derivados de decisiones expresas de producto y restricciones implementadas:

- Calcular las estimaciones con reglas deterministas y tarifas orientativas que la empresa configura por estancia; conservar el cálculo de catálogo para configuraciones anteriores.
- Proteger los precios internos y los datos de solicitudes frente al acceso público.
- Mantener las solicitudes hasta que la empresa elija borrarlas.
- Presentar claramente la estimación como orientativa, separada de una oferta final.
- Priorizar claridad, rapidez y corrección de importes; mantener el uso móvil y evitar acciones duplicadas en escritorio.
