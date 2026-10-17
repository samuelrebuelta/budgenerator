# Estado, sesión y guardado

## Stores

Hay seis stores Zustand: auth, budget, catalog, template, profile y user. Los datos de cuenta y listas residen en memoria. Un coordinador de sesión carga las entidades una vez por UID, ofrece reintento y reinicia todos los stores al cerrar sesión o cambiar de cuenta.

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
