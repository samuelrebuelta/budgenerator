import { createHash, randomBytes } from 'node:crypto';
import { initializeApp, getApps } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import type {
  CatalogPart,
  CompanyProfile,
  Tariff,
  TariffCatalog,
} from '../../src/shared/types/index.js';
import {
  calculateQuoteRange,
  getAvailableEstimatorServices,
  getSimpleEstimatorServices,
  validateEstimatorSettings,
} from '../../src/entities/quote-estimator/model/estimate.js';
import {
  ESTIMATOR_ROOMS,
  ESTIMATOR_SCOPES,
  ESTIMATOR_QUALITIES,
  LEGACY_ESTIMATOR_QUALITIES,
  MAX_ESTIMATOR_ROOM_QUANTITY,
  MAX_ESTIMATOR_SELECTIONS,
  isValidEstimateInstanceId,
  isSimpleQuoteEstimatorSettings,
  serviceKey,
} from '../../src/entities/quote-estimator/model/types.js';
import {
  isValidPrivacyPolicyUrl,
  validateLeadContact,
  validateLeadStartTiming,
} from '../../src/entities/quote-estimator/model/leads.js';
import type { PublicLeadSubmission } from '../../src/entities/quote-estimator/model/types.js';
import type {
  EstimateSelection,
  LegacyQuoteEstimatorSettings,
  PublicEstimatorInfo,
  QuoteEstimate,
  QuoteEstimatorSettings,
} from '../../src/entities/quote-estimator/model/types.js';

if (getApps().length === 0) initializeApp();
const firestore = getFirestore();
const functionRegion = 'europe-west1';
const tokenPattern = /^[A-Za-z0-9_-]{32}$/;
const perTokenLimit = 20;
const rateWindowMs = 60_000;

interface StoredPublicEstimatorToken {
  ownerUid: string;
  active: boolean;
}

interface StoredRateLimit {
  windowStartedAt: number;
  count: number;
}

interface PublicEstimatorRequest {
  token: string;
}

interface CalculatePublicEstimateRequest extends PublicEstimatorRequest {
  selections: EstimateSelection[];
}

interface StoredLeadRateLimit {
  windowStartedAt: number;
  count: number;
}

function invalidToken(): never {
  throw new HttpsError('not-found', 'Este enlace no está disponible.');
}

function validateToken(token: unknown): asserts token is string {
  if (typeof token !== 'string' || !tokenPattern.test(token)) invalidToken();
}

function settingsRef(uid: string) {
  return firestore.doc(`users/${uid}/quoteEstimator/settings`);
}

function profileRef(uid: string) {
  return firestore.doc(`users/${uid}/profile/data`);
}

function catalogRef(uid: string) {
  return firestore.doc(`users/${uid}/tariffCatalogs/main-v1`);
}

function tokenRef(token: string) {
  return firestore.doc(`publicQuoteTokens/${token}`);
}

function ownerLinkRef(uid: string) {
  return firestore.doc(`quoteEstimatorLinks/${uid}`);
}

function rateLimitRef(token: string) {
  return firestore.doc(`quoteEstimateRateLimits/${token}`);
}

function leadRateLimitRef(token: string) {
  return firestore.doc(`quoteLeadRateLimits/${token}`);
}

function asSettings(value: unknown): QuoteEstimatorSettings {
  const settings = value as QuoteEstimatorSettings;
  try {
    validateEstimatorSettings(settings);
  } catch {
    throw new HttpsError('failed-precondition', 'La configuración de estimación no es válida.');
  }
  return settings;
}

function getCatalogValues(value: unknown) {
  const catalog = value as TariffCatalog | undefined;
  if (!catalog) throw new HttpsError('failed-precondition', 'No hay un catálogo disponible.');
  const parts: CatalogPart[] = Array.isArray(catalog.parts) ? catalog.parts : [];
  const legacyTariffs: Tariff[] = Array.isArray(catalog.tariffs) ? catalog.tariffs : [];
  return { parts, legacyTariffs };
}

function validateMappedPrices(
  settings: LegacyQuoteEstimatorSettings,
  parts: CatalogPart[],
  legacyTariffs: Tariff[],
) {
  if (
    getAvailableEstimatorServices(settings, parts, legacyTariffs).length !==
    settings.services.length
  )
    throw new HttpsError('failed-precondition', 'Hay conceptos sin precio válido.');
}

function publicProfile(
  profile: Partial<CompanyProfile> | undefined,
  settings: QuoteEstimatorSettings,
): Omit<
  PublicEstimatorInfo,
  'schemaVersion' | 'services' | 'leadCaptureEnabled' | 'privacyPolicyUrl'
> {
  const companyName = typeof profile?.name === 'string' ? profile.name.trim().slice(0, 100) : '';
  if (!companyName)
    throw new HttpsError('failed-precondition', 'Completa el nombre de empresa en tu perfil.');

  const phone =
    settings.contact.sharePhone && typeof profile?.phone === 'string'
      ? profile.phone.trim().slice(0, 40)
      : '';
  const email =
    settings.contact.shareEmail && typeof profile?.email === 'string'
      ? profile.email.trim().slice(0, 254)
      : '';
  const safePhone = phone && /^[+()0-9 .-]{6,40}$/.test(phone) ? phone : undefined;
  const safeEmail = email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : undefined;
  return {
    companyName,
    ...(safePhone ? { phone: safePhone } : {}),
    ...(safeEmail ? { email: safeEmail } : {}),
  };
}

function validateSelections(value: unknown): EstimateSelection[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_ESTIMATOR_SELECTIONS)
    throw new HttpsError('invalid-argument', 'Selecciona al menos una estancia.');
  const selections: EstimateSelection[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object')
      throw new HttpsError('invalid-argument', 'Selección no válida.');
    const item = raw as Record<string, unknown>;
    if (
      Object.keys(item).some(
        (key) => !['room', 'scope', 'quality', 'areaM2', 'quantity', 'instanceId'].includes(key),
      )
    )
      throw new HttpsError('invalid-argument', 'Selección no válida.');
    const quantity = item.quantity === undefined ? 1 : item.quantity;
    const instanceId = item.instanceId;
    if (
      !ESTIMATOR_ROOMS.some((room) => room.id === item.room) ||
      !ESTIMATOR_SCOPES.some((scope) => scope.id === item.scope) ||
      (!ESTIMATOR_QUALITIES.some((quality) => quality.id === item.quality) &&
        !LEGACY_ESTIMATOR_QUALITIES.some((quality) => quality.id === item.quality)) ||
      typeof item.areaM2 !== 'number' ||
      !Number.isFinite(item.areaM2) ||
      item.areaM2 < 1 ||
      item.areaM2 > 1000 ||
      typeof quantity !== 'number' ||
      !Number.isSafeInteger(quantity) ||
      quantity < 1 ||
      quantity > MAX_ESTIMATOR_ROOM_QUANTITY ||
      (item.room === 'fullHome' && quantity !== 1) ||
      (instanceId !== undefined && (!isValidEstimateInstanceId(instanceId) || quantity !== 1))
    )
      throw new HttpsError(
        'invalid-argument',
        'Revisa la estancia, el alcance, la calidad y la superficie.',
      );
    if (item.room === 'fullHome' && item.scope !== 'integral')
      throw new HttpsError(
        'invalid-argument',
        'La vivienda completa debe seleccionarse como reforma integral.',
      );
    selections.push({ ...item, quantity } as unknown as EstimateSelection);
  }
  const instanceIds = selections.flatMap((selection) =>
    selection.instanceId ? [selection.instanceId] : [],
  );
  if (new Set(instanceIds).size !== instanceIds.length)
    throw new HttpsError('invalid-argument', 'Cada estancia debe tener un identificador distinto.');
  const roomSelections = new Map<string, EstimateSelection[]>();
  for (const selection of selections) {
    roomSelections.set(selection.room, [...(roomSelections.get(selection.room) ?? []), selection]);
  }
  if (
    Array.from(roomSelections.values()).some(
      (items) => items.length > 1 && items.some((selection) => !selection.instanceId),
    )
  )
    throw new HttpsError('invalid-argument', 'Configura cada estancia por separado.');
  if (selections.some((selection) => selection.room === 'fullHome') && selections.length > 1)
    throw new HttpsError(
      'invalid-argument',
      'La vivienda completa no se combina con otras estancias.',
    );
  return selections;
}

async function getActiveOwner(token: string) {
  const snapshot = await tokenRef(token).get();
  const tokenData = snapshot.data() as StoredPublicEstimatorToken | undefined;
  if (!snapshot.exists || !tokenData?.active || !tokenData.ownerUid) invalidToken();
  return tokenData.ownerUid;
}

export async function publishPublicEstimator(uid: string) {
  const [settingsSnapshot, profileSnapshot] = await Promise.all([
    settingsRef(uid).get(),
    profileRef(uid).get(),
  ]);
  if (!settingsSnapshot.exists)
    throw new HttpsError('failed-precondition', 'Guarda la configuración antes de publicar.');
  const settings = asSettings(settingsSnapshot.data());
  const profileData = profileSnapshot.data() as Partial<CompanyProfile> | undefined;
  if (!isValidPrivacyPolicyUrl(profileData?.privacyPolicyUrl))
    throw new HttpsError(
      'failed-precondition',
      'Añade una URL HTTPS al aviso de privacidad en Mi empresa antes de publicar.',
    );
  if (!isSimpleQuoteEstimatorSettings(settings)) {
    const catalogSnapshot = await catalogRef(uid).get();
    const { parts, legacyTariffs } = getCatalogValues(catalogSnapshot.data());
    validateMappedPrices(settings, parts, legacyTariffs);
  }
  publicProfile(profileData, settings);

  const link = ownerLinkRef(uid);
  const linkSnapshot = await link.get();
  const current = linkSnapshot.data() as { token?: string } | undefined;
  if (current?.token && tokenPattern.test(current.token)) {
    const currentTokenRef = tokenRef(current.token);
    const currentTokenSnapshot = await currentTokenRef.get();
    const storedToken = currentTokenSnapshot.data() as StoredPublicEstimatorToken | undefined;
    if (currentTokenSnapshot.exists && storedToken?.active && storedToken.ownerUid === uid)
      return { token: current.token };
  }

  const token = randomBytes(24).toString('base64url');
  const oldToken = current?.token && tokenPattern.test(current.token) ? current.token : null;
  await firestore.runTransaction(async (transaction) => {
    const [freshLink, newTokenSnapshot] = await Promise.all([
      transaction.get(link),
      transaction.get(tokenRef(token)),
    ]);
    if (newTokenSnapshot.exists) throw new HttpsError('aborted', 'Vuelve a publicar el enlace.');
    const fresh = freshLink.data() as { token?: string } | undefined;
    const previous = fresh?.token && tokenPattern.test(fresh.token) ? fresh.token : oldToken;
    transaction.set(tokenRef(token), {
      ownerUid: uid,
      active: true,
      createdAt: FieldValue.serverTimestamp(),
    });
    transaction.set(link, { token, updatedAt: FieldValue.serverTimestamp() });
    if (previous && previous !== token) transaction.delete(tokenRef(previous));
  });
  return { token };
}

export async function revokePublicEstimator(uid: string) {
  const link = ownerLinkRef(uid);
  await firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(link);
    const data = snapshot.data() as { token?: string } | undefined;
    transaction.delete(link);
    if (data?.token && tokenPattern.test(data.token)) {
      transaction.delete(tokenRef(data.token));
      transaction.delete(rateLimitRef(data.token));
    }
  });
  return { revoked: true };
}

export async function getOwnerEstimatorStatus(uid: string) {
  const linkSnapshot = await ownerLinkRef(uid).get();
  const token = (linkSnapshot.data() as { token?: string } | undefined)?.token;
  if (!linkSnapshot.exists || !token || !tokenPattern.test(token)) return { published: false };
  const tokenSnapshot = await tokenRef(token).get();
  const data = tokenSnapshot.data() as StoredPublicEstimatorToken | undefined;
  return data?.active && data.ownerUid === uid ? { published: true, token } : { published: false };
}

export async function getPublicEstimator(
  data: PublicEstimatorRequest,
): Promise<PublicEstimatorInfo> {
  validateToken(data?.token);
  const ownerUid = await getActiveOwner(data.token);
  await enforceRateLimit(data.token);
  const [settingsSnapshot, profileSnapshot] = await Promise.all([
    settingsRef(ownerUid).get(),
    profileRef(ownerUid).get(),
  ]);
  if (!settingsSnapshot.exists) invalidToken();
  const settings = asSettings(settingsSnapshot.data());
  let availableServices: PublicEstimatorInfo['services'];
  if (isSimpleQuoteEstimatorSettings(settings)) {
    availableServices = getSimpleEstimatorServices(settings);
  } else {
    const catalogSnapshot = await catalogRef(ownerUid).get();
    const { parts, legacyTariffs } = getCatalogValues(catalogSnapshot.data());
    availableServices = getAvailableEstimatorServices(settings, parts, legacyTariffs).map(
      ({ room, scope, quality }) => ({ room, scope, quality }),
    );
  }
  if (availableServices.length === 0) invalidToken();
  const company = publicProfile(
    profileSnapshot.data() as Partial<CompanyProfile> | undefined,
    settings,
  );
  const privacyPolicyUrl = (profileSnapshot.data() as Partial<CompanyProfile> | undefined)
    ?.privacyPolicyUrl;
  return {
    ...company,
    schemaVersion: isSimpleQuoteEstimatorSettings(settings) ? 2 : 1,
    leadCaptureEnabled: isValidPrivacyPolicyUrl(privacyPolicyUrl),
    ...(isValidPrivacyPolicyUrl(privacyPolicyUrl) ? { privacyPolicyUrl } : {}),
    services: availableServices,
  };
}

async function enforceRateLimit(token: string) {
  const now = Date.now();
  const ref = rateLimitRef(token);
  await firestore.runTransaction(async (transaction) => {
    const [tokenSnapshot, rateSnapshot] = await Promise.all([
      transaction.get(tokenRef(token)),
      transaction.get(ref),
    ]);
    const tokenData = tokenSnapshot.data() as StoredPublicEstimatorToken | undefined;
    if (!tokenSnapshot.exists || !tokenData?.active) invalidToken();
    const rate = rateSnapshot.data() as StoredRateLimit | undefined;
    const isNewWindow = !rate || now - rate.windowStartedAt >= rateWindowMs;
    if (!isNewWindow && rate.count >= perTokenLimit)
      throw new HttpsError(
        'resource-exhausted',
        'Se ha alcanzado el límite temporal de estimaciones.',
      );
    transaction.set(ref, {
      windowStartedAt: isNewWindow ? now : rate.windowStartedAt,
      count: isNewWindow ? 1 : rate.count + 1,
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
}

export async function calculatePublicEstimate(
  data: CalculatePublicEstimateRequest,
): Promise<QuoteEstimate> {
  validateToken(data?.token);
  const selections = validateSelections(data?.selections);
  const ownerUid = await getActiveOwner(data.token);
  await enforceRateLimit(data.token);
  const settingsSnapshot = await settingsRef(ownerUid).get();
  if (!settingsSnapshot.exists) invalidToken();
  const settings = asSettings(settingsSnapshot.data());
  const { parts, legacyTariffs } = isSimpleQuoteEstimatorSettings(settings)
    ? { parts: [], legacyTariffs: [] }
    : getCatalogValues((await catalogRef(ownerUid).get()).data());
  try {
    return calculateQuoteRange(settings, parts, selections, legacyTariffs);
  } catch {
    throw new HttpsError('failed-precondition', 'No se puede calcular esta combinación.');
  }
}

function validatePublicLeadRequest(value: unknown): PublicLeadSubmission {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new HttpsError('invalid-argument', 'La solicitud no es válida.');
  const input = value as Record<string, unknown>;
  if (
    Object.keys(input).some(
      (key) =>
        ![
          'token',
          'idempotencyKey',
          'contact',
          'selections',
          'startTiming',
          'consent',
          'privacyPolicyUrl',
        ].includes(key),
    )
  )
    throw new HttpsError('invalid-argument', 'La solicitud contiene campos no permitidos.');
  validateToken(input.token);
  if (
    typeof input.idempotencyKey !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      input.idempotencyKey,
    )
  )
    throw new HttpsError('invalid-argument', 'La clave de envío no es válida.');
  if (input.consent !== true)
    throw new HttpsError('failed-precondition', 'Confirma que la empresa puede contactarte.');
  if (!isValidPrivacyPolicyUrl(input.privacyPolicyUrl))
    throw new HttpsError('invalid-argument', 'El enlace de privacidad no es válido.');
  let contact;
  try {
    contact = validateLeadContact(input.contact);
  } catch (error) {
    throw new HttpsError(
      'invalid-argument',
      error instanceof Error ? error.message : 'Revisa los datos de contacto.',
    );
  }
  let startTiming;
  try {
    startTiming = validateLeadStartTiming(input.startTiming);
  } catch (error) {
    throw new HttpsError(
      'invalid-argument',
      error instanceof Error ? error.message : 'Selecciona un plazo aproximado.',
    );
  }
  return {
    token: input.token,
    idempotencyKey: input.idempotencyKey,
    contact,
    selections: validateSelections(input.selections),
    startTiming,
    consent: true,
    privacyPolicyUrl: input.privacyPolicyUrl,
  };
}

export async function submitPublicLead(value: unknown) {
  const data = validatePublicLeadRequest(value);
  const ownerUid = await getActiveOwner(data.token);
  await enforceRateLimit(data.token);
  const [settingsSnapshot, profileSnapshot] = await Promise.all([
    settingsRef(ownerUid).get(),
    profileRef(ownerUid).get(),
  ]);
  if (!settingsSnapshot.exists || !profileSnapshot.exists) invalidToken();
  const privacyPolicyUrl = (profileSnapshot.data() as Partial<CompanyProfile> | undefined)
    ?.privacyPolicyUrl;
  if (!isValidPrivacyPolicyUrl(privacyPolicyUrl))
    throw new HttpsError('failed-precondition', 'La empresa todavía no puede recibir solicitudes.');
  if (privacyPolicyUrl !== data.privacyPolicyUrl)
    throw new HttpsError(
      'failed-precondition',
      'El aviso de privacidad ha cambiado. Recarga el formulario antes de enviarlo.',
    );
  const settings = asSettings(settingsSnapshot.data());
  const { parts, legacyTariffs } = isSimpleQuoteEstimatorSettings(settings)
    ? { parts: [], legacyTariffs: [] }
    : getCatalogValues((await catalogRef(ownerUid).get()).data());
  let estimate: QuoteEstimate;
  try {
    estimate = calculateQuoteRange(settings, parts, data.selections, legacyTariffs);
  } catch {
    throw new HttpsError('failed-precondition', 'No se puede calcular esta combinación.');
  }

  const leadId = createHash('sha256')
    .update(`${ownerUid}:${data.token}:${data.idempotencyKey}`)
    .digest('hex');
  const leadRef = firestore.doc(`users/${ownerUid}/leads/${leadId}`);
  const rateRef = leadRateLimitRef(data.token);
  const now = Date.now();
  const requestHash = createHash('sha256')
    .update(
      JSON.stringify({
        contact: data.contact,
        selections: data.selections,
        startTiming: data.startTiming,
        consent: data.consent,
        privacyPolicyUrl,
      }),
    )
    .digest('hex');
  const storedEstimate = await firestore.runTransaction<QuoteEstimate>(async (transaction) => {
    const [existing, rateSnapshot] = await Promise.all([
      transaction.get(leadRef),
      transaction.get(rateRef),
    ]);
    if (existing.exists) {
      if (existing.get('requestHash') !== requestHash)
        throw new HttpsError('already-exists', 'Esta solicitud ya se había enviado.');
      const priorEstimate = existing.get('estimate') as QuoteEstimate | undefined;
      if (!priorEstimate) throw new HttpsError('internal', 'La solicitud guardada no es válida.');
      return priorEstimate;
    }
    const current = rateSnapshot.data() as StoredLeadRateLimit | undefined;
    const isNewWindow = !current || now - current.windowStartedAt >= 60 * 60 * 1000;
    if (!isNewWindow && current.count >= 10)
      throw new HttpsError(
        'resource-exhausted',
        'Este formulario ha recibido varias solicitudes recientemente. Prueba más tarde.',
      );
    transaction.set(leadRef, {
      schemaVersion: isSimpleQuoteEstimatorSettings(settings) ? 2 : 1,
      contact: data.contact,
      selections: data.selections,
      startTiming: data.startTiming,
      estimate,
      currency: estimate.currency,
      includesVat: estimate.includesVat,
      privacyPolicyUrl,
      requestHash,
      createdAt: FieldValue.serverTimestamp(),
      consentAt: FieldValue.serverTimestamp(),
    });
    transaction.set(rateRef, {
      windowStartedAt: isNewWindow ? now : current.windowStartedAt,
      count: isNewWindow ? 1 : current.count + 1,
      updatedAt: FieldValue.serverTimestamp(),
    });
    return estimate;
  });
  return { received: true as const, estimate: storedEstimate };
}

export const quoteEstimatorFunctionOptions = {
  region: functionRegion,
  invoker: 'public',
  maxInstances: 10,
  minInstances: 0,
} as const;

export function requireOwnerUid(uid: string | undefined) {
  if (!uid) throw new HttpsError('unauthenticated', 'Inicia sesión para gestionar el enlace.');
  return uid;
}

export function estimatorSettingsKey(
  service: Pick<EstimateSelection, 'room' | 'scope' | 'quality'>,
) {
  return serviceKey(service);
}
