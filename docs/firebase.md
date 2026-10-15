# Firebase

Servicios utilizados: Authentication con email/contraseña, Firestore y Hosting. No hay Cloud Functions, Storage, servidor propio o pasarela de pagos en este checkout.

## Configuración

`shared/firebase/config.ts` utiliza las variables `VITE_FIREBASE_*` de `.env.example`. Con `VITE_USE_FIREBASE_EMULATORS=true` exige un projectId `demo-` y conecta a Auth local 9199 y Firestore local 8180. El build de pruebas fuerza valores demo; los scripts de deploy rechazan esos valores.

## Documentos

```text
users/{uid}                            Cuenta, plan y contador acumulado
├── budgets/{id}                       Partidas y tareas embebidas
├── tariffCatalogs/{id}                Catálogo con array de tarifas
├── templates/{id}                     Partidas, catálogo, ajuste e IVA
├── profile/data                      Datos de empresa y logo PNG como data URL
└── settings/tariffCatalog             Catálogo activo
sharedBudgets/{token}                  DTO público v2 con propietario y caducidad
```

Los IDs son UUID y las fechas de documentos son ISO strings. El vencimiento premium añade milisegundos para las reglas; el vencimiento público es numérico.

## Autorización y cuota

Las reglas separan la raíz de cuenta de las colecciones editables; no usan un permiso recursivo que pueda reabrir la raíz. Los clientes nuevos solo pueden crear una cuenta free, no-admin y con contador cero. No pueden asignarse un rol, plan o vencimiento. El admin existente está restringido a la identidad designada y al flag protegido. La provisión de roles nuevos requiere una operación de confianza.

La creación de un presupuesto se ejecuta junto al incremento del contador y el último ID creado en una transacción. Las reglas exigen esa relación y aplican la cuota free o el premium vigente usando request.time. Borrar un presupuesto no devuelve cuota. Actualizar un documento existente no consume otra creación.

Los snapshots públicos permiten get individual, deniegan list y exigen propietario autenticado al crear. Caducan, son inmutables y su propietario puede revocarlos. El DTO elimina costes internos y metadatos privados antes de escribirlo. Los enlaces legacy no seguros quedan bloqueados; revisar la transición en stability-and-release.md.

## Migraciones

Se siguen leyendo nombres antiguos de partidas/tareas. El perfil antiguo en settings/profile se traslada a profile/data. Las tarifas antiguas se agrupan en un catálogo determinista legacy-v1. Las cuentas legacy no se promocionan a roles de confianza desde un documento editable: requieren revisión administrativa. Las operaciones de migración no se deben interpretar como una migración global transaccional del proyecto.

## Pruebas y publicación

`pnpm test:integration` ejecuta reglas y navegador sobre emuladores. `pnpm firebase:deploy` publica solo Hosting; `pnpm firebase:deploy:all` publica reglas y Hosting después de validar el entorno y construir. CI no despliega. La cuenta admin de la aplicación no autentica al CLI.
