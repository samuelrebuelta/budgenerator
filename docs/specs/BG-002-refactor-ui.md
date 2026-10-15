# BG-002 — Remates del refactor visual (pendientes tras revisión del usuario)

**Estado:** completado y validado el 15-10-2026. **Origen:** revisión del usuario de 14-10-2026.

## Objetivo
Terminar el refinamiento visual existente sin alterar reglas de negocio, cálculos, persistencia, autenticación ni exportación PDF. Inventariar primero las rutas y los skeletons existentes; no rehacer trabajo completado.

## Pendientes y aceptación
1. **Skeletons en todas las páginas:** reemplazar las pantallas o textos genéricos de carga por skeletons con geometría próxima al contenido real; reutilizar `src/shared/ui/Skeleton*` y componentes de página existentes. Cubrir autenticación, administración, cuenta, presupuestos, detalle, catálogo, plantillas y demás rutas reales cuando haya esperas relevantes. Carga ≠ vacío ≠ error; evitar skeleton infinito, datos ficticios y saltos fuertes.
2. **Eliminar frases «marketinianas»:** auditar todos los textos visibles en rutas y locales; sustituir claims grandilocuentes, subtítulos promocionales y mensajes de relleno por microcopy directo, funcional y consistente. Preservar textos legales, errores, accesibilidad y mensajes de acción útiles. Evitar borrar contenido informativo por coincidencia de palabras.
3. **Navegación desktop:** Administración, Cuenta y Cerrar sesión deben mostrarse exclusivamente en el panel lateral de escritorio; retirar su duplicado de la esquina superior derecha. En móvil deben permanecer accesibles en el menú superior actual. Verificar permisos (Administración sólo para autorizados), responsive, teclado y accesibilidad.
4. **Indicador «✅ Al día»:** identificar qué condición alimenta el indicador y qué estado garantiza realmente. Opciones evaluadas:
   - Eliminarlo si es puramente decorativo o equivale a «sin noticias».
   - Sustituirlo por estado de sincronización real: Guardando / Guardado / Error, sólo si se puede demostrar confirmación remota y sin dar falso éxito por debounce.
   - Reservarlo para avisos accionables pendientes, con nombre semántico y no como badge permanente.
   Registrar recomendación y semántica de cada estado antes de implementar.

**Decisión tras auditar `useSyncStore`:** `pending` expresa escrituras en la cola local y `error` un fallo recuperable. La ausencia de ambos no prueba una sincronización remota permanente ni la vigencia de los datos en otros dispositivos. Se eliminó «Al día»; el indicador sólo aparece como «Guardando…» mientras hay escrituras pendientes o como acción «Reintentar guardado» ante un fallo. No se muestra un éxito permanente.

## Exclusiones
No añadir dashboard nuevo, nuevos sistemas de notificaciones, sincronización propia, backend adicional ni cambios de identidad/branding. No tocar Firestore Rules fuera de BG-001.

## Comprobación
Revisar todas las rutas a 375/390 px y desktop, navegación por teclado, estados de carga/red/error, sesión admin y no admin, logout y reflujo. Ejecutar lint/build y documentar cobertura real. La suite automatizada cubre escritorio, móvil, teclado, guardado y PWA con emuladores; la comprobación física en iOS/Android sigue pendiente. El usuario autorizó el merge y despliegue de esta entrega el 15-10-2026.
