# Estado, sesión y guardado

## Stores

Hay siete stores Zustand: auth, budget, catalog, template, profile, project y user. Los datos de cuenta y listas residen en memoria. Un coordinador de sesión carga las entidades una vez por UID, ofrece reintento y reinicia todos los stores al cerrar sesión o cambiar de cuenta.

Cada respuesta asíncrona se comprueba contra la revisión de sesión que la originó. Esto evita que una petición de A vuelva a poblar el estado después de entrar como B. El catálogo conserva la jerarquía `parts[]` y conceptos anidados; también mantiene una proyección `tariffs` para componentes que todavía usan la vista plana. El store se reinicia con el resto de entidades.

## Cola de escrituras

`WriteQueue` agrupa cambios por UID y documento durante 700 ms. Cada documento tiene su propia secuencia; A no cancela B. Una escritura nueva espera a la anterior y utiliza el snapshot más reciente. Los errores conservan el valor para reintentar y se muestran en el shell.

Los presupuestos guardados usan updateDoc, de forma que una escritura tardía no recrea un documento borrado. Antes de borrar se cancela la cola y se espera una solicitud ya iniciada. Antes de cerrar sesión o actualizar la PWA se vacían las colas. Al abandonar la página con cambios pendientes se muestra el aviso del navegador.

No hay resolución colaborativa en tiempo real entre dispositivos. La cola ordena las solicitudes de esta sesión; el mismo documento debe coordinarse si se edita desde varios dispositivos.

## Drafts

Los borradores no se escriben en Firestore hasta guardar. Se recuerdan temporalmente en sessionStorage bajo el UID y la clave de presupuesto/plantilla para soportar una recarga. Se eliminan al descartar, guardar o cerrar sesión. Las preferencias de secciones colapsadas usan localStorage.

Los conceptos incompletos se conservan al guardar; publicar o exportar pide completar o borrar esas filas. Un precio cero es válido si el concepto tiene descripción y cantidad positiva.

## Red y caché

Firestore usa lecturas puntuales y no se activa persistencia duradera de sus documentos en IndexedDB. La PWA cachea el código y recursos estáticos, no las respuestas privadas. Una sesión abierta puede continuar mostrando lo ya cargado, pero guardar y recuperar datos nuevos requiere red. Los errores de carga no dejan un skeleton permanente: hay timeout y reintento.

BG-008: el catálogo único se prepara durante la carga de sesión; sólo se publica `loaded` tras confirmar destino y limpieza. Las respuestas obsoletas no pueblan otra cuenta. El estado del asistente de estructura es local y cancelarlo no edita el documento. Su confirmación crea una sola edición con IDs de presupuesto nuevos, conserva los IDs de origen del catálogo, cliente/IVA/ajustes y activa la recuperación habitual del borrador. Un snapshot de presupuesto, sesión o catálogo obsoleto exige reabrir el asistente. Las sugerencias usan el historial que ya reside en memoria, sin nuevas lecturas. El aviso de instalación sólo recuerda su descarte en sessionStorage; no cachea documentos ni historial.

La importación por categoría fusiona una categoría, partida o concepto con el snapshot cargado del catálogo y sólo encola una escritura cuando añade conceptos nuevos. Los reintentos de la misma base no duplican elementos ni reescriben precios actuales.

El tour se marca como pendiente al completar un registro mediante un UID en `sessionStorage`; el acceso normal no lo activa. Al omitirlo o terminarlo, se borra el marcador y `localStorage` recuerda la finalización por UID. Si el navegador bloquea el almacenamiento, el estado en memoria mantiene el flujo de registro disponible. “Ver guía interactiva” puede iniciar otra visita sin modificar datos de cuenta.

BG-005: el wizard privado guarda `quoteEstimator/settings` como esquema 2 con precios desde/hasta por m² e incremento de calidad; la versión 1 basada en catálogo sigue vigente hasta que el propietario la reemplaza. El visitante mantiene temporalmente en React el alcance, una selección con `instanceId` por estancia física, m² y calidad independientes, plazo y contacto; `submitPublicLead` valida consentimiento, plazo y límites (hasta 20 instancias de cada tipo), resuelve el token, recalcula en servidor con la versión de configuración y guarda idempotentemente mediante Admin SDK. Los leads antiguos con `quantity` agrupada siguen leyéndose; si falta, se interpreta como una estancia. El esquema 1 lee el catálogo actual; el esquema 2 no necesita cargarlo. La bandeja lee leads solo desde la sesión del titular; no se cachean en localStorage/IndexedDB y permanecen hasta borrado manual. Crear presupuesto usa el borrador local `budget:lead:<id>` y crea presupuesto, incrementa cuota y enlaza el lead en una transacción; solo copia el nombre y carga el contexto privado bajo demanda, incluido el plazo elegido. Publicación/revocación e índices de límite permanecen server-only; el navegador no puede leerlos ni crear leads. `schemaVersion` en cada lead conserva las etiquetas históricas de calidad. Borrar la configuración desde su resumen revoca el enlace antes de borrar `quoteEstimator/settings`, sin tocar leads.

BG-009: `project` carga resúmenes con la sesión y sólo trae partidas, suplementos y anulaciones al abrir el detalle; `resetSession` limpia ambos estados. Las cargas y mutaciones aplican al store sólo si sigue vigente la revisión de sesión que las inició. Marcar/reabrir conceptos, completar partidas, corregir sus fechas o añadir/anular suplementos actualiza las subcolecciones y el resumen en transacciones. Los suplementos y anulaciones se conservan como historial; las anulaciones justificadas salen de los importes y trabajo activos. Corregir una fecha mueve el punto de la gráfica sin cambiar el avance actual. El presupuesto fuente aceptado queda bloqueado. Crear una copia para editar genera IDs nuevos para partidas y conceptos y no copia `acceptedAt` ni `projectId`.

BG-010: las preferencias de aviso se leen por callable; la dirección se toma de Auth en servidor. El FID no se guarda en la UI ni en `localStorage`: allí sólo vive un UUID de instalación y, si falla logout sin red, una cola acotada de `{uid, installationId}` para reconciliar al volver esa cuenta. El navegador registra/sincroniza el FID con FCM sólo tras sesión, permiso concedido y una instalación ya activada en servidor; si FCM invalida un FID, el servidor lo borra y marca `recoveryRequired` sin conservar credenciales. La recuperación automática limpia el registro FCM en IndexedDB y siempre elimina la Firebase Installation antes de volver a registrar, incluso cuando `unregister()` responde correctamente; la baja intencional no revoca la fila recuperable en servidor. La revocación explícita elimina el registro y no dispara recuperación. Cerrar sesión primero revoca el dispositivo y luego llama a `unregister`. La cola servidor no contiene email/FID ni payload de contacto. El payload FCM sólo lleva el hash determinista del job y el ID de lead. El SW puede cachear el bundle `fcm-sw.js` como recurso estático, pero no almacena mensajes, leads ni respuestas privadas.
