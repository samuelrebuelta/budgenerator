# Rendimiento

Las rutas se importan mediante lazy. Firebase Auth, Firestore y React tienen grupos de chunks propios, y el generador PDF se importa al solicitarlo. El build no depende de fuentes o traducciones remotas: solo incluye los subsets latinos de Manrope y Fraunces y el español de i18n.

Las ediciones de presupuestos y catálogos se agrupan durante 700 ms por documento y se serializan. La búsqueda de tarifas usa 200 ms de debounce. La lista de presupuestos tiene búsqueda y paginación local de ocho filas; sigue recuperándose la colección completa del usuario, por lo que una paginación remota sería el siguiente cambio si crece el volumen.

Se usan selectores de Zustand, memo en filas y memoización de agrupaciones. El selector de catálogo todavía depende del presupuesto activo; medir antes de añadir más memoización o virtualizar. Los catálogos mantienen arrays embebidos: la cola reduce escrituras, pero un modelo por tarifa podría ser adecuado si aumenta la edición simultánea entre dispositivos.

En detalle de presupuesto, los capítulos y sus partidas permanecen montados aunque se cierre el desplegable: `.collapsible` los oculta mediante una fila CSS de tamaño cero. En detalle de proyecto, las partidas de todos los capítulos activos también se montan mientras la sección de capítulos está abierta. Además, el avance de cada capítulo vuelve a recorrer sus partidas en cada render de la página. Esto hace que DOM y cálculo crezcan con el contenido del presupuesto/proyecto; por sí solo no confirma que sea la causa del lag reportado. Antes de optimizar, medir recuento de nodos y rendimiento de scroll con documentos grandes representativos. No añadir carga diferida ni virtualización sin esa medición.

El worker precachea los assets del build para que las rutas lazy y el PDF no dependan de recuperar un chunk borrado tras un despliegue. Mantiene la versión anterior y sirve sus chunks a pestañas antiguas. No cachea llamadas a Firebase. Hosting da caché inmutable a assets con hash y evita caché persistente del worker, index y manifest.

Los tamaños exactos se imprimen en cada build. Se deben comparar los chunks que se cargan inicialmente en conjunto, no solo el pequeño entry principal, para no atribuir ahorros ficticios al cambio de nombres o separación.
