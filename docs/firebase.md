# Backend Firebase

## Servicios utilizados

| Servicio | Uso |
|---|---|
| **Firebase Authentication** | Login/registro con email y contraseña |
| **Cloud Firestore** | Base de datos NoSQL para presupuestos, tarifas y perfil |
| **Firebase Hosting** | Hosting estático para la SPA |

> **Nota**: No se usa Firebase Storage. El logo de empresa se almacena como data URL base64 directamente en el documento de perfil en Firestore.

## Configuración

La configuración Firebase está en `src/shared/firebase/config.ts`:

```typescript
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
```

Los servicios se exportan desde `src/shared/firebase/index.ts` como barrel.

## Autenticación

### Módulo: `src/shared/firebase/auth.ts`

Expone 4 funciones wrapper sobre Firebase Auth:

| Función | Firebase API |
|---|---|
| `signInWithEmail(email, password)` | `signInWithEmailAndPassword` |
| `signUpWithEmail(email, password)` | `createUserWithEmailAndPassword` |
| `signOut()` | `firebaseSignOut` |
| `onAuthChange(callback)` | `onAuthStateChanged` |

### Flujo de autenticación

1. `AuthGuard` llama a `init()` que suscribe a `onAuthStateChanged`
2. Firebase devuelve `user` (sesión existente) o `null`
3. Si `null` → redirige a `/login`
4. Si `user` → carga datos y renderiza la app
5. `LoginPage` también llama a `init()` para saber si ya hay sesión

### Seguridad de contraseña

En registro, se muestra un indicador de 4 checks:
- Mínimo 6 caracteres
- Una letra mayúscula
- Una letra minúscula
- Un número

Todos los checks deben cumplirse para habilitar el botón de registro.

## Firestore: modelo de datos

### Estructura de documentos

```
users/{uid}/
├── budgets/
│   └── {budgetId}          → Budget (documento completo)
├── tariffs/
│   └── {tariffId}          → Tariff
└── settings/
    └── profile             → CompanyProfile
```

Cada usuario tiene su propio subárbol bajo `users/{uid}/`. Esto facilita las reglas de seguridad y el aislamiento multi-tenant.

### Tipos de documentos

#### Budget

```typescript
interface Budget {
  id: string;
  info: {
    clientName: string;
    address: string;
    date: string;         // ISO date string "2026-04-19"
    budgetNumber: string;
  };
  workItems: WorkItem[];     // Array de partidas embebidas
  adjustment?: {
    multiplier: number;    // 0.9 = -10%, 1.15 = +15%
    reason: string;
  };
  createdAt: string;       // ISO datetime
}
```

Las secciones y conceptos están **embebidos** dentro del documento del presupuesto (no son subcollecciones). Esto simplifica las lecturas/escrituras a costa de un documento más grande, pero es adecuado dado que un presupuesto típico tiene 5-15 secciones con 3-10 filas cada una.

#### Tariff

```typescript
interface Tariff {
  id: string;
  description: string;
  unit: 'm2' | 'm3' | 'ml' | 'unit' | 'hour';
  basePrice: number;    // PVP (precio de venta)
  cost: number;         // Coste (para cálculo de margen)
  category: string;     // Categoría (e.g. "Electricidad")
}
```

#### CompanyProfile

```typescript
interface CompanyProfile {
  name: string;
  cif: string;
  address: string;
  phone: string;
  email: string;
  logo?: string;    // Data URL base64 (max ~500KB)
}
```

El logo se almacena como string base64 directamente en el documento. Límite de 500KB en la UI para mantener el documento dentro del límite de 1MB de Firestore.

### Operaciones CRUD

El módulo `src/shared/firebase/firestore.ts` expone funciones CRUD tipadas:

| Función | Operación | Firestore API |
|---|---|---|
| `fetchBudgets(uid)` | Leer todos los presupuestos | `getDocs` |
| `saveBudget(uid, budget)` | Crear/actualizar presupuesto | `setDoc` |
| `updateBudget(uid, id, data)` | Actualizar campos parciales | `updateDoc` |
| `deleteBudgetDoc(uid, id)` | Eliminar presupuesto | `deleteDoc` |
| `fetchTariffs(uid)` | Leer todas las tarifas | `getDocs` |
| `saveTariff(uid, tariff)` | Crear/actualizar tarifa | `setDoc` |
| `seedTariffs(uid, tariffs)` | Insertar batch de tarifas | `writeBatch` |
| `deleteAllTariffs(uid)` | Eliminar todas las tarifas | `writeBatch` |
| `fetchProfile(uid)` | Leer perfil | `getDoc` |
| `saveProfile(uid, profile)` | Crear/actualizar perfil | `setDoc` |

### Seed de tarifas

Cuando un usuario nuevo carga sus tarifas por primera vez y no hay ninguna, se ejecuta automáticamente un seed con 252 tarifas predefinidas:

```typescript
loadTariffs: async (uid) => {
  const tariffs = await fetchTariffs(uid);
  if (tariffs.length === 0) {
    await seedTariffs(uid, DEFAULT_TARIFFS);  // writeBatch
    set({ tariffs: DEFAULT_TARIFFS, loaded: true });
  }
},
```

El seed usa `writeBatch` para insertar todas las tarifas en una sola operación atómica.

### Restaurar catálogo

El usuario puede restaurar las tarifas por defecto desde la página del catálogo. Esto:

1. Elimina todas las tarifas existentes con `deleteAllTariffs` (writeBatch)
2. Inserta las tarifas por defecto con `seedTariffs` (writeBatch)

Ambas operaciones usan batch writes para atomicidad.

## Reglas de seguridad recomendadas

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

Esta regla garantiza que cada usuario solo pueda leer/escribir sus propios datos.

## Hosting

Configuración en `firebase.json`:

```json
{
  "hosting": {
    "public": "dist",
    "rewrites": [{ "source": "**", "destination": "/index.html" }],
    "headers": [{
      "source": "/assets/**",
      "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }]
    }]
  }
}
```

- **SPA rewrite**: Todas las rutas redirigen a `index.html` (React Router maneja el routing)
- **Cache de assets**: Los archivos en `/assets/` se cachean 1 año (Vite genera hashes en los nombres)
- **Deploy**: `pnpm deploy` ejecuta build + firebase deploy

## Límites y consideraciones

| Aspecto | Límite | Estado actual |
|---|---|---|
| Tamaño documento Firestore | 1 MB | OK (presupuestos ~10-50KB, perfil con logo ~500KB max) |
| Lecturas gratuitas/día | 50,000 | OK para uso personal/pequeña empresa |
| Escrituras gratuitas/día | 20,000 | OK con debounce de 1s |
| Almacenamiento gratuito | 1 GB | OK (~500KB por usuario) |
