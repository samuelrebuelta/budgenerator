# BG-006 — Contratos v1 para implementación local

Archivo histórico desde 18-10-2026: el usuario retiró la integración de IA del roadmap. Estos contratos describen una propuesta no implementada y no son trabajo pendiente ni aprobación para crear endpoints, tipos de runtime o facturación. Se conservan sólo como referencia.

## Petición y fronteras de confianza

Futuro callable autenticado `generateBudgetProposal`:

```ts
type GenerationRequest = {
  schemaVersion: 1;
  requestId: string; // UUID creado una vez por intención; reutilizado al consultar un intento
  source: 'text'; // voz se transcribe y revisa antes; transporte en BG-006.6
  text: string;
  catalogId?: string;
  templateId?: string;
};
```

Validación estricta: sin claves adicionales; máximo 4.000 caracteres de texto no vacío; IDs string no vacío de hasta 128 caracteres, sin `/`; requestId UUID. No aceptar UID, precios, tarifas, plantilla completa, `cost`, plan ni límites suministrados por el navegador. Derivar UID del token verificado y volver a leer catálogo/plantilla bajo ese UID. Un rol admin no permite indicar UID ajeno en esta operación.

Resolución: si hay templateId con catalogId, usar ese catálogo; si el cliente elige otro, error `catalog-conflict` antes de llamar al modelo. Sin catálogo de plantilla: selección explícita, o el activo de `settings/tariffCatalog` leído por servidor. Si no hay catálogo o está vacío/no contiene tarifas válidas, error recuperable y cero llamadas al proveedor. No recuperar un catálogo por ID fuera de `users/{uid}`.

Una tarifa válida requiere ID único, descripción y categoría no vacías, unidad del dominio, basePrice/cost finitos y no negativos. Un catálogo con IDs repetidos se rechaza por ambigüedad; tarifas incompletas se excluyen y se advierte su número sin enviar datos internos al modelo.

## Proyección al modelo

Se mantienen los contratos `NormalizedIntent`, `Candidate`, `ProposedLine` y `GenerationProposal` de la spec. El backend crea mapping de candidateId efímero → tarifa real, exclusivamente para la solicitud. Máximo 30 candidatos por selección; una lista vacía produce preguntas, nunca una búsqueda global ni una tarifa inventada.

Antes de enviar texto, eliminar datos personales estructurados y redactar patrones comunes de email/teléfono/documentos. No enviar BudgetInfo ni CompanyProfile. La redacción automática de texto libre es incompleta: UI advertirá no introducir datos del cliente y el piloto usará datos sintéticos/anonimizados. No prometer detección perfecta de PII.

El modelo sólo recibe `{candidateId,description,unit,basePrice,category}` y, si aplica, secciones/tareas de plantilla minimizadas sin IDs persistidos ni costes. `targetWorkItemKey` es null o una clave efímera del conjunto suministrado; no es un ID arbitrario ni puede crear secciones por nombre. Null agrupa por categoría de tarifa al hidratar. Se preservan las secciones originales.

Salida estricta: exactamente schemaVersion, lines, questions, warnings. Cada línea: exactamente candidateId, targetWorkItemKey, quantity, reason, reviewRequired. No aceptar campos `price`, `cost`, `unit`, totales, instrucciones, IDs de usuario o presupuesto. Nunca extraer JSON por regex desde una respuesta libre: usar JSON estructurado y validación completa.

`quantity` es null o número positivo finito dentro de límites. Null exige reviewRequired=true. Dimensiones de vivienda no equivalen a superficies de pintura; cantidades repetidas sobre un mismo requisito no se suman sin revisión. Para requisitos ambiguos se devuelven preguntas; el modelo no elige silenciosamente una alternativa.

## Respuesta validada e hidratada

```ts
type RevisionRef = { id: string; fingerprint: string };
type GenerationResponse = {
  schemaVersion: 1;
  requestId: string;
  proposalId: string; // opaco, ligado a UID, requestId y revisiones
  catalog: RevisionRef;
  template: RevisionRef | null;
  lines: Array<{
    candidateId: string;
    targetWorkItemKey: string | null;
    description: string;
    unit: 'm2' | 'm3' | 'ml' | 'unit' | 'hour';
    price: number;
    cost: number; // sólo al cliente autenticado, copiado de Firestore; nunca al LLM
    quantity: number | null;
    reviewRequired: boolean;
    reason: string;
  }>;
  questions: string[];
  warnings: string[];
};
```

El backend valida la propuesta antes de hidratar; copia descripción, unidad, basePrice→price y cost de la tarifa autorizada. No confundir esta respuesta privada con GenerationProposal ni exponerla en el visor compartido. No registrar prompts, transcripciones, líneas o coste interno en logs. La telemetría técnica usa sólo conteos/estado/tokens/latencia y coste del proveedor.

Huella = SHA-256 de serialización canónica de los campos relevantes. Objetos con claves ordenadas, arrays con orden preservado, sin undefined; sólo números JSON finitos. Catálogo: id y array de tarifas con todos sus campos de dominio. Plantilla: id, workItems, catalogId, adjustment e ivaRate. Ausencia de opcionales se canoniza como null. No confiar sólo en `updatedAt`: no existe en plantilla y no demuestra integridad del contenido. La implementación tendrá fixtures idénticas de hash servidor/cliente.

Volver a leer antes de devolver; si las huellas cambian durante la generación, rechazar con `source-changed`. No mantener una transacción de Firestore abierta mientras responde el proveedor. En preview, la UI compara huellas con el catálogo y plantilla actualmente cargados y rechaza cambios locales. La operación de aplicación verificará también de nuevo la fuente en servidor sin una segunda llamada de IA; no es posible garantizar datos actuales con un snapshot anterior.

## Aplicación local al editor

API pública futura del store, diseñada en BG-006.5:

```ts
type ApplyGeneratedDraftInput = {
  proposalId: string;
  expectedSession: { uid: string; revision: number };
  expectedDraft: Budget | null; // identidad capturada al comenzar; no se envía al servidor
  selectedLines: Array<{ candidateId: string; quantity: number }>;
  response: GenerationResponse;
};
// Se incorpora al API público de entities/budget; no usar desde shared.
applyGeneratedDraft(input: ApplyGeneratedDraftInput): void;
```

El coordinador deberá verificar la vigencia de fuentes en servidor antes de invocar el store; su resultado está ligado a proposalId y a las líneas seleccionadas. No se acepta un flag booleano arbitrario del componente como prueba de frescura.

La primera UI sólo permite generar un presupuesto nuevo. Si hay un draft sucio o se está guardando, no se sobrescribe: pedir que el usuario continúe o descarte mediante el flujo existente. Las propuestas no se aplican a un presupuesto persistido en MVP. Una propuesta y sus revisiones son inmutables; editar mientras espera invalida expectedDraft. UID y revisión de sesión deben seguir vigentes, incluso si se cierra sesión y se entra otra vez con el mismo UID.

Aplicación atómica: validar selección completa (sin candidatos repetidos, sin null, quantity positiva); clonar tareas de plantilla con nuevos UUID; mantener IVA/ajuste/catalogId; añadir únicamente tareas faltantes tras resolver solapes; crear draft con el flujo existente y marcar sucio. Ninguna escritura Firestore, guardado automático ni incremento de cuota. proposalId aplicado se recuerda sólo durante la sesión para evitar doble click/reaplicación, y se limpia al cambiar UID. Guardado posterior conserva `saveDraft` y su idempotencia actual.

## Idempotencia, reservas y errores

BG-006.1 define colección técnica `users/{uid}/generationRequests/{requestId}` sólo de servidor; hoy las reglas ya deniegan esa ruta al cliente. Clave idempotente: UID + requestId. Fingerprint de petición normalizada (text/source/IDs resueltos/revisiones/configuración) detecta reutilización con otro contenido. Mismo ID+huella en curso devuelve estado sin llamar otra vez; completado devuelve la misma propuesta. Otro contenido devuelve `request-conflict`. Una reserva caducada no se reejecuta a ciegas: conciliar uso/pago o terminar en fallo conocido, para no duplicar cargo.

El ledger requiere pruebas de emulador de exclusión mutua, dos clientes simultáneos, expiración y borrado al vencer retención técnica. No guardar texto, audio o prompt en el documento. El hash de texto no es anonimización: retención corta y acceso exclusivamente de servidor. Si se cachea respuesta hidratada, tratar sus costes internos como datos privados con TTL y política explícita. La fase backend concretará TTL y cleanup antes de desplegar; no asumir TTL activo por añadir un campo.

Errores de dominio previstos (mapeados a estados recuperables, sin detalles del proveedor): `unauthenticated`, `invalid-request`, `catalog-missing`, `catalog-conflict`, `template-missing`, `source-changed`, `request-conflict`, `generation-in-progress`, `quota-exceeded`, `budget-exceeded`, `provider-timeout`, `invalid-proposal`, `provider-unavailable`. Source-changed y conflicto de draft vuelven a revisión/selección; no reintentan con pago automáticamente.

## Orden de implementación siguiente

1. BG-006.1 local: carpeta `functions/` independiente con emulador y proveedor falso identificable, sin añadir SDK de proveedor hasta seleccionarlo. Validar Auth, dominio, repositorio Firestore, ledger y cuotas; pruebas reales contra emulador. Script de deploy independiente permanece desactivado hasta autorización específica.
2. BG-006.2–.4: schemas Zod compartidos entre backend y cliente, normalización, ranking y validador/hidratador con golden tests. No importar stores en backend ni Admin SDK en bundle web. La ubicación definitiva del paquete compartido se fija al crear functions, evitando duplicar contratos.
3. BG-006.5: portar interacción útil del prototipo al UI actual, selección/revisión/aplicación y pruebas E2E de sesión, draft, fuentes y guardado.
4. BG-006.6–.7: voz y operación después de texto evaluado. Calidad/coste reales pendientes de proveedor configurado; las fixtures no permiten aprobar rollout.

## Cambio de alcance posterior — conceptos nuevos

La ampliación del 16-10-2026 en la spec canónica permite proponer conceptos sin tarifa. Este documento y el evaluador v1 siguen siendo contratos de líneas de catálogo, no el contrato completo de esa ampliación. Antes de implementarla, versionar respuesta y schema estructurado a v2 con un array separado `newItems`, sin `candidateId` inventado ni precio/coste generado. La UI mantiene precio/coste como null hasta entrada explícita del usuario; esos null no pasan a BudgetTask. El adaptador exige completar y confirmar cada concepto seleccionado y crea WorkItems cuando falte agrupación. La futura API de aplicación deberá aceptar tanto selección de tarifas autorizadas como conceptos manuales revisados, diferenciando su procedencia. No persistir tarifas de catálogo automáticamente; la ampliación de reutilización permite hacerlo tras selección y guardado explícitos del usuario. El informe v1 no mide cobertura de newItems.

## Reutilización opcional — alcance v2

Planificar `ReuseNewItemSelection` como selección independiente de catálogo, plantilla existente o plantilla nueva. Por concepto: identificador de propuesta, datos manuales confirmados, catálogo de destino opcional y destino de plantilla opcional con partida/cantidad reutilizable. No enviar esta selección al proveedor IA. No reusar cantidades de obra sin confirmación ni aplicar IVA/ajuste al basePrice.

La coordinación de persistencia devolverá estado por destino (`pending | saved | failed | skipped`) y mantendrá IDs estables para reintentos idempotentes. La API de dominio debe verificar sesión, revisiones y duplicados; usar operación aditiva sobre el documento actual. No invocar `updateTemplate` con un snapshot antiguo ni considerar que `addTariff` garantiza que una escritura encolada ya terminó. Diseñar y probar confirmación de persistencia, conflictos y recuperación por destino antes de conectar la UI. No es necesario que el guardado de catálogo y plantilla sea todo-o-nada; sí es obligatorio informar y recuperar fallos parciales sin duplicar ni modificar el borrador.
