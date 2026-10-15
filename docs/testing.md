# Despliegue y pruebas de Budgenerator

URL de producción: [https://budgenerator.web.app/](https://budgenerator.web.app/).

Cuenta de administración para pruebas: `budgenerator@gmail.com`.

La contraseña está en la [nota local de acceso](testing-access.local.md), excluida expresamente de Git. Esa nota es específica de esta máquina y no se distribuye al clonar el repositorio. Mantener las contraseñas fuera de los documentos versionados.

## Entorno local

Desde la raíz del proyecto:

```bash
pnpm install --frozen-lockfile
pnpm dev
```

La aplicación se abre en [http://localhost:3000/](http://localhost:3000/). Requiere las variables `VITE_FIREBASE_*` descritas en el README. La configuración actual no conecta emuladores; comprobar a qué proyecto apunta `.env` antes de crear o modificar datos durante pruebas locales.

## Validación previa al despliegue

```bash
pnpm lint
pnpm test
pnpm test:integration
pnpm build
```

Comprobar los resultados de las cuatro validaciones. El script de despliegue incluye el build, pero no ejecuta lint ni las pruebas.

## Desplegar en producción

El proyecto de Firebase Hosting configurado en `.firebaserc` es `budgenerator`.

Con el CLI de Firebase autenticado y permisos en ese proyecto:

```bash
pnpm firebase:deploy:all
```

Este comando ejecuta `pnpm build` y despliega Hosting y reglas de Firestore. Después se puede probar el resultado en [Budgenerator](https://budgenerator.web.app/).

La cuenta de administración de la aplicación no autentica al CLI de Firebase. El despliegue requiere la sesión de Google/Firebase del desarrollador con permisos sobre el proyecto.

Para cambios que afecten exclusivamente a Hosting se puede usar:

```bash
pnpm firebase:deploy
```

Los scripts usan el CLI local fijado por el lockfile y comprueban que el entorno no sea de emuladores. Para publicar cambios de reglas, utilizar el despliegue conjunto y revisar las consideraciones de transición en `stability-and-release.md`.

## Comprobación de producción desde el navegador

Abrir la URL pública e iniciar sesión con la cuenta de pruebas permite verificar la aplicación desde Codex. Las rutas de referencia son:

| Ruta | Comprobación |
|---|---|
| `/login` | Formulario e inicio de sesión |
| `/budgets` | Lista, menú y acceso a presupuestos |
| `/catalogs` | Catálogos, selector, búsqueda y tarifas |
| `/templates` | Plantillas y acceso al editor |
| `/profile` | Datos de empresa y logo |
| `/account` | Plan y vencimiento |
| `/admin` | Acceso administrativo y lista de usuarios |
| `/shared/:token` | Lectura de un enlace público existente |

Para una comprobación de acceso y navegación basta con leer estas pantallas y consultar la consola del navegador. La cuenta es administradora del entorno de producción: editar planes, publicar enlaces o borrar datos modifica información real.

Para pruebas con escritura, usar un presupuesto, catálogo o plantilla con nombre identificable de prueba y definir los datos que se pueden crear, modificar y eliminar. Verificar guardado después de recargar, PDF, totales y publicación. Los fallos de aislamiento o permisos se reproducen preferiblemente con el emulador y datos ficticios.

## Estado de la última comprobación

Comprobación del 4 de octubre de 2026: acceso admin y pantallas principales confirmados; recargar `/templates/new` queda en skeleton y abrir `/budget/new` directamente queda en blanco. Se cerró la sesión al finalizar. No se realizaron acciones de guardar datos de prueba ni cambios de plan.

Consultar el [informe de análisis del proyecto](project-analysis.md) para las comprobaciones locales y de producción realizadas, sus resultados y los límites de la revisión. La fecha y el alcance de cada prueba deben quedar registrados; el código local y lo desplegado pueden corresponder a revisiones distintas.

## Comprobaciones de la entrega (15 de octubre de 2026)

La revisión posterior y sus correcciones se validan con tests unitarios, reglas en emulador y navegador automatizado: `pnpm test` y `pnpm test:integration`. Las pruebas no utilizan la cuenta de producción; crean cuentas y datos ficticios en `demo-cimbra`.
