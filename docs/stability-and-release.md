# Estabilización y entrega de budgenerator

Fecha: 14 de octubre de 2026; actualizada el 15 de octubre.

## Correcciones aplicadas

| Problema observado | Cambio |
|---|---|
| Arranque que esperaba traducciones por HTTP | Español incluido en el bundle; React no espera la red |
| Blanco o skeleton al recargar editores | Carga de sesión única, guard de datos listo y listas que conservan el draft |
| Stores retenidos entre cuentas | Reset de entidades por UID, revisión de sesión y descarte de respuestas antiguas |
| Edición de un documento cancelaba otro | Cola por UID/documento, solicitudes serializadas y coalescencia |
| Guardado pendiente recreaba un borrado | Cancelación de cola antes del borrado y updateDoc para documentos existentes |
| Doble creación/cuota inconsistente | ID idempotente por intento, bloqueo de envío y transacción presupuesto/contador |
| Precio, cantidad o coste truncados | Valores decimales y política de redondeo compartida |
| Pérdida silenciosa de conceptos incompletos | Se conservan al guardar; para publicar/exportar se pide completarlos o eliminarlos |
| IVA de plantilla no persistido | Campo incluido en modelo, mapper, guardado y creación desde plantilla |
| Cambios de plantilla perdidos al salir | Bloqueo de navegación y draft temporal de sesión |
| Campos undefined al compartir | DTO público explícito sin campos opcionales ausentes |
| Costes internos expuestos | Snapshot público sin costes, catálogo ni metadatos de recargo privado |
| Colección pública enumerable | Solo get individual, sin list; propietario, caducidad y revocación |
| Usuario podía asignarse admin/premium | Raíz protegida, sin wildcard recursivo que conceda permisos; creación siempre free/no-admin |
| PWA sin caché ni recuperación | App shell precacheado por build, fallbacks acotados y recuperación de instalación |
| Actualización rompía la sesión | Worker en espera y actualización explícita tras guardar; sin recarga automática durante un draft |
| Errores silenciosos o botones atascados | Errores y reintento visibles, finally en operaciones y estado de guardado |
| PDF desbordaba descripciones y páginas | Wrapping, bloques partidos con cabeceras repetidas, logo acotado y await de generación |
| Lint roto y estructura débil | Corrección de efectos, editor reutilizable en features y componentes con nombres consistentes |

## Contrato de PWA

El build genera `/sw.js` con una versión derivada del contenido y la lista de recursos estáticos. La instalación cachea el conjunto completo antes de activarse. Una actualización queda en espera y la UI ofrece aplicarla; antes se vacían las escrituras pendientes y se exige guardar o descartar el draft.

El worker solo intercepta recursos estáticos conocidos del mismo origen y navegaciones de la SPA. No cachea peticiones a Firebase, tokens o documentos de usuario. Conserva la versión anterior de caché para los clientes abiertos. Las solicitudes que necesitan red tienen un límite de tiempo y respuesta de error útil. No devuelve HTML como si fuese un módulo JavaScript.

Sin red, la app puede abrir su shell y conservar la sesión ya abierta. Abrir datos nuevos o confirmar escrituras necesita conexión. No se anuncia una base de datos offline completa: Firestore no activa persistencia duradera compartida entre cuentas. Los borradores se guardan temporalmente en sessionStorage bajo el UID y se eliminan al cerrar la sesión. Las escrituras pendientes muestran estado y generan aviso antes de abandonar la página.

Si el módulo de arranque falta o no carga, el HTML ofrece «Reparar instalación y reintentar» a los 12 segundos. Ese control elimina únicamente la instalación del worker del origen y las cachés de la app; no elimina documentos de Firestore ni credenciales de autenticación. En desarrollo se desactiva el worker antiguo para no interferir con Vite.

## Validación reproducible

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm test
pnpm exec playwright install chromium
pnpm test:integration
pnpm build
```

La integración levanta Auth y Firestore locales con proyecto `demo-cimbra`. Las pruebas de reglas usan un proyecto demo aislado; las de navegador crean cuentas y documentos ficticios. El servidor de prueba fuerza las seis variables Firebase a valores demo y se niega a arrancar sin emuladores. La aplicación también rechaza combinar emuladores con un projectId de producción.

La suite de navegador comprueba escritorio/móvil, recargas de editores, draft conservado, IVA de plantilla, guardado decimal, publicación, PDF, revocación, edición de tarifas, cambio de cuenta, arranque offline, actualización del worker y recuperación de un bundle ausente. Las capturas bajo docs/testing-evidence se generan con datos sintéticos. CI ejecuta build, lint y pruebas sin desplegar.

## Consideraciones de despliegue

Este procedimiento publica código y reglas. La limpieza previa de cuentas de prueba se realizó conservando la cuenta administradora; las pruebas automatizadas no modifican datos de producción.

Para una publicación coordinada de esta entrega, con el CLI autenticado:

```bash
pnpm firebase:deploy:all
```

El script comprueba que el entorno no apunta a emuladores, que las variables están completas y que el proyecto del build coincide con Hosting. A continuación construye y publica Hosting y reglas. Firebase no ofrece una transacción entre ambos despliegues: revisar el resultado de ambos. El script `pnpm firebase:deploy` se mantiene para cambios exclusivos de Hosting.

Cambios de seguridad que requieren considerar el estado existente:

1. Los snapshots antiguos no tienen esquema seguro ni propietario. Las reglas nuevas deniegan su lectura para dejar de exponer costes. Se deben volver a compartir los presupuestos que necesiten un enlace público; los enlaces nuevos caducan a los 30 días.
2. Los premium antiguos con vencimiento ISO necesitan el campo numérico `premiumExpiresAtMillis` para comparar con el reloj del servidor. El administrador puede guardar de nuevo la fecha desde el panel, que escribe ambos campos. Sin esa migración se aplica el límite free cuando corresponda, de forma conservadora. Premium sin vencimiento sigue siendo válido.
3. Se conserva el admin existente asociado a `budgenerator@gmail.com` y su documento protegido. Ningún cliente puede asignar roles nuevos. La provisión o recuperación de un rol requiere una operación de confianza en Firebase; los registros nuevos siempre son free/no-admin.
4. Revisar con un registro de confianza los planes y contadores existentes: la versión anterior permitía editarlos desde el cliente. La nueva regla impide cambios futuros, pero no puede distinguir una modificación previa de un dato legítimo.
5. Ya no se promueven datos de cuenta legacy editables a roles de confianza desde el navegador. Las cuentas antiguas que no tengan documento raíz requieren una migración administrativa antes de su uso.

## Límites actuales

Las consultas de presupuestos siguen recuperando la colección del usuario y la paginación es local. Las ediciones del mismo documento desde dispositivos distintos requieren coordinación de producto si se quiere colaboración simultánea; esta entrega garantiza orden dentro de la sesión, sin una UI colaborativa en tiempo real. Las verificaciones de PWA se automatizan en Chromium; antes de distribuir masivamente conviene una prueba física de instalación/reapertura en Safari iOS y Android.

## Resultado de validación de esta entrega

- TypeScript y build de producción correctos. Los chunks actuales quedan por debajo del umbral de aviso de 500 kB.
- ESLint sin errores ni warnings.
- 23 pruebas unitarias correctas, incluidas privacidad, cálculos, stores, edición por ID de catálogo, colas y ciclo del worker.
- 12 pruebas de reglas correctas en Firestore Emulator.
- 7 pruebas de navegador correctas en Chromium con Auth y Firestore emulados.
- PDF largo de 13 páginas renderizado y revisado; exportación de navegador comprobada como PDF real.
- Capturas de diseño obtenidas del build con datos ficticios.
- Pruebas automatizadas sin modificaciones de datos de producción.
