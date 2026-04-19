# Budgenerator

Aplicación web para generar y gestionar presupuestos de reformas de viviendas. Permite crear presupuestos detallados por partidas, aplicar tarifas de un catálogo personalizable, calcular márgenes de beneficio, gestionar descuentos/recargos y exportar a PDF profesional con datos de empresa.

## Funcionalidades

- **Gestión de presupuestos**: Crear, editar y eliminar presupuestos con información de cliente, partidas y filas de trabajo.
- **Catálogo de tarifas**: +250 tarifas predefinidas organizadas en 28 categorías de reformas. Totalmente personalizable (añadir, editar, eliminar, restaurar por defecto).
- **Cálculos automáticos**: Subtotales por partida, subtotal general, IVA (10%), total. Margen de beneficio por fila y global.
- **Descuentos y recargos**: Aplicar un multiplicador porcentual antes del IVA. Se oculta del PDF (solo el precio final es visible para el cliente).
- **Perfil de empresa**: Nombre, CIF, dirección, teléfono, email y logo. Los datos aparecen en la cabecera del PDF.
- **Exportación PDF**: Impresión directa del navegador con layout A4 apaisado. Inputs ocultos, company info visible, diseño limpio.
- **Autenticación**: Email + contraseña con Firebase Auth. Registro con indicador de seguridad de contraseña.
- **Multi-tenant**: Cada usuario tiene sus propios presupuestos, tarifas y perfil, aislados por UID.
- **Mobile-first**: Layout responsive con cards en móvil y tablas en escritorio. Touch targets de 44px mínimo.
- **Internacionalización**: Todos los textos extraídos a claves i18n. Español por defecto, preparado para añadir idiomas.

## Stack tecnológico

| Tecnología | Versión | Uso |
|---|---|---|
| **React** | 19.2 | UI con componentes funcionales y hooks |
| **TypeScript** | 6.0 | Tipado estricto (strict + noUncheckedIndexedAccess) |
| **Vite** | 8.0 | Bundler y servidor de desarrollo |
| **Zustand** | 5.0 | Estado global (budgets, tariffs, auth, profile) |
| **Firebase** | 12.12 | Auth (email/password) + Firestore (base de datos) |
| **Tailwind CSS** | 4.2 | Estilos utility-first con plugin Vite nativo |
| **React Router** | 7.14 | Enrutamiento SPA con guards de autenticación |
| **Lucide React** | 1.8 | Iconos SVG |
| **clsx + tailwind-merge** | — | Composición de clases CSS condicionales |
| **pnpm** | 10.x | Gestor de paquetes |

## Arquitectura

Feature-Sliced Design (FSD) adaptado:

```
src/
├── app/                  # App shell, router, AuthGuard
├── entities/             # Dominio: stores y modelos de negocio
│   ├── auth/             #   Autenticación (Firebase Auth)
│   ├── budget/           #   Presupuestos (CRUD + cálculos)
│   ├── tariff/           #   Tarifas y catálogo
│   └── profile/          #   Perfil de empresa
├── pages/                # Páginas (una por ruta)
│   ├── login/
│   ├── budget-list/
│   ├── budget/
│   ├── catalog/
│   └── profile/
└── shared/               # Código compartido
    ├── firebase/         #   Configuración y servicios Firebase
    ├── i18n/             #   Traducciones (es.ts) y helper t
    ├── types/            #   TypeScript interfaces
    ├── lib/              #   Utilidades (cn, formatCurrency, generateId)
    └── ui/               #   Componentes UI reutilizables (Button, Input, Select, Modal)
```

## Inicio rápido

```bash
# Instalar dependencias
pnpm install

# Desarrollo local
pnpm dev

# Build de producción
pnpm build

# Deploy a Firebase Hosting
pnpm deploy
```

## Variables de entorno

La configuración de Firebase está hardcodeada en `src/shared/firebase/config.ts`. Para usar tu propio proyecto Firebase:

1. Crea un proyecto en [Firebase Console](https://console.firebase.google.com)
2. Activa **Authentication** (proveedor Email/Password)
3. Activa **Cloud Firestore** (modo producción, reglas según tu necesidad)
4. Activa **Hosting** si vas a desplegar
5. Sustituye las credenciales en `config.ts`

## Modelo de datos (Firestore)

```
users/{uid}/
├── budgets/{budgetId}     # Documento Budget completo
├── tariffs/{tariffId}     # Una tarifa del catálogo
└── settings/
    └── profile            # CompanyProfile (incluye logo en base64)
```

## Documentación

Consulta la carpeta [`/docs`](docs/) para documentación técnica detallada:

- [Arquitectura](docs/architecture.md) — Estructura del proyecto y flujo de datos
- [Estado y caché](docs/state-and-cache.md) — Stores Zustand, sincronización con Firestore, caché
- [Rendimiento](docs/performance.md) — Memoización, debounce, optimizaciones
- [Estilos y responsive](docs/styles-and-responsive.md) — Tailwind CSS, mobile-first, print styles
- [Backend Firebase](docs/firebase.md) — Auth, Firestore, modelo de datos, reglas de seguridad
- [Exportación PDF](docs/pdf-export.md) — Configuración de impresión, layout A4, estilos print

## Licencia

Proyecto privado.
