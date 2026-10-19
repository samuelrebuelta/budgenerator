import type { CatalogPart, Tariff } from '../../../shared/types/index.js';
import {
  CONFIGURABLE_ESTIMATOR_ROOMS,
  ESTIMATOR_QUALITIES,
  ESTIMATOR_ROOMS,
  ESTIMATOR_SCOPES,
  LEGACY_ESTIMATOR_QUALITIES,
  MAX_ESTIMATOR_ROOM_QUANTITY,
  MAX_ESTIMATOR_SELECTIONS,
  isValidEstimateInstanceId,
  isSimpleQuoteEstimatorSettings,
} from './types.js';
import type {
  EstimateSelection,
  EstimateRoom,
  EstimateService,
  EstimateServiceOption,
  LegacyQuoteEstimatorSettings,
  QuoteEstimate,
  QuoteEstimatorSettings,
  SimpleQuoteEstimatorSettings,
} from './types.js';
import { isMeasuredUnit, serviceKey } from './types.js';

const measuredUnits = new Set(['m2', 'm3', 'ml']);
const fixedUnits = new Set(['unit', 'hour']);
const MAX_AREA_M2 = 1000;
const MAX_RATE_CENTS_PER_M2 = 10_000_000;

export function flattenEstimatorCatalog(parts: CatalogPart[], legacyTariffs: Tariff[] = []) {
  const catalog = parts.flatMap((part) => part.concepts);
  return catalog.length ? catalog : legacyTariffs;
}

export function getAvailableEstimatorServices(
  settings: LegacyQuoteEstimatorSettings,
  catalogParts: CatalogPart[],
  legacyTariffs: Tariff[] = [],
): EstimateService[] {
  const catalog = new Map(
    flattenEstimatorCatalog(catalogParts, legacyTariffs).map((concept) => [concept.id, concept]),
  );
  return settings.services.filter((service) =>
    service.lines.every((line) => {
      const concept = catalog.get(line.conceptId);
      return (
        !!concept &&
        Number.isFinite(concept.basePrice) &&
        concept.basePrice > 0 &&
        isKnownUnit(concept.unit)
      );
    }),
  );
}

export function getSimpleEstimatorServices(
  settings: SimpleQuoteEstimatorSettings,
): EstimateServiceOption[] {
  return settings.rooms.flatMap((room) =>
    ESTIMATOR_SCOPES.flatMap((scope) =>
      ESTIMATOR_QUALITIES.map((quality) => ({
        room: room.room,
        scope: scope.id,
        quality: quality.id,
      })),
    ),
  );
}

function isCompatibleLegacyRoomScope(
  room: EstimateService['room'],
  scope: EstimateService['scope'],
) {
  return room === 'fullHome' ? scope === 'integral' : scope === 'partial';
}

function validateContactSettings(settings: QuoteEstimatorSettings) {
  if (
    !settings.contact ||
    typeof settings.contact.sharePhone !== 'boolean' ||
    typeof settings.contact.shareEmail !== 'boolean'
  )
    throw new Error('Revisa las opciones de contacto.');
}

function validateLegacySettings(settings: LegacyQuoteEstimatorSettings) {
  if (!Array.isArray(settings.services) || settings.services.length === 0)
    throw new Error('Añade al menos una combinación estimable.');
  if (settings.services.length > 36) throw new Error('Hay demasiadas combinaciones estimables.');
  const keys = new Set<string>();
  for (const service of settings.services) {
    if (
      !ESTIMATOR_ROOMS.some((option) => option.id === service.room) ||
      !ESTIMATOR_SCOPES.some((option) => option.id === service.scope) ||
      !LEGACY_ESTIMATOR_QUALITIES.some((option) => option.id === service.quality)
    )
      throw new Error('Hay una combinación de estancia, alcance o calidad no válida.');
    if (!isCompatibleLegacyRoomScope(service.room, service.scope))
      throw new Error('La reforma integral debe configurarse para la vivienda completa.');
    const key = serviceKey(service);
    if (keys.has(key)) throw new Error('No repitas la misma combinación de estimación.');
    keys.add(key);
    if (!Array.isArray(service.lines) || service.lines.length === 0 || service.lines.length > 30)
      throw new Error('Cada combinación necesita entre 1 y 30 partidas.');
    const conceptIds = new Set<string>();
    for (const line of service.lines) {
      if (!line.conceptId || line.conceptId.length > 120 || conceptIds.has(line.conceptId))
        throw new Error('Cada partida debe ser válida y aparecer una sola vez por combinación.');
      conceptIds.add(line.conceptId);
      if (
        !Number.isFinite(line.minimumQuantity) ||
        !Number.isFinite(line.maximumQuantity) ||
        line.minimumQuantity <= 0 ||
        line.maximumQuantity < line.minimumQuantity ||
        line.maximumQuantity > 10000
      )
        throw new Error('Revisa las cantidades mínimas y máximas de cada partida.');
    }
  }
}

function validateSimpleSettings(settings: SimpleQuoteEstimatorSettings) {
  if (!Array.isArray(settings.rooms) || settings.rooms.length === 0)
    throw new Error('Selecciona al menos una estancia para estimar.');
  if (settings.rooms.length > CONFIGURABLE_ESTIMATOR_ROOMS.length)
    throw new Error('Hay demasiadas estancias configuradas.');
  const rooms = new Set<string>();
  for (const room of settings.rooms) {
    if (!CONFIGURABLE_ESTIMATOR_ROOMS.some((option) => option.id === room.room))
      throw new Error('Hay una estancia configurada no válida.');
    if (rooms.has(room.room)) throw new Error('No repitas una estancia.');
    rooms.add(room.room);
    if (
      !Number.isSafeInteger(room.minimumCentsPerM2) ||
      !Number.isSafeInteger(room.maximumCentsPerM2) ||
      !Number.isSafeInteger(room.qualityStepCentsPerM2) ||
      room.minimumCentsPerM2 <= 0 ||
      room.maximumCentsPerM2 < room.minimumCentsPerM2 ||
      room.qualityStepCentsPerM2 < 0 ||
      room.maximumCentsPerM2 + room.qualityStepCentsPerM2 * 2 > MAX_RATE_CENTS_PER_M2
    )
      throw new Error('Revisa el precio por m² y el incremento entre calidades.');
  }
}

export function validateEstimatorSettings(settings: QuoteEstimatorSettings) {
  if (!settings || typeof settings !== 'object') throw new Error('Revisa la configuración.');
  validateContactSettings(settings);
  if (isSimpleQuoteEstimatorSettings(settings)) {
    validateSimpleSettings(settings);
    return;
  }
  if (settings.schemaVersion !== undefined && settings.schemaVersion !== 1)
    throw new Error('La versión de la configuración no es válida.');
  validateLegacySettings(settings);
}

function validateSelections(selections: EstimateSelection[]) {
  if (
    !Array.isArray(selections) ||
    selections.length === 0 ||
    selections.length > MAX_ESTIMATOR_SELECTIONS
  )
    throw new Error('Selecciona al menos una estancia.');
  if (
    selections.some(
      (selection) =>
        !Number.isFinite(selection.areaM2) ||
        selection.areaM2 < 1 ||
        selection.areaM2 > MAX_AREA_M2,
    )
  )
    throw new Error('La superficie debe estar entre 1 y 1000 m².');
  if (
    selections.some((selection) => {
      const quantity = selection.quantity ?? 1;
      return (
        !Number.isSafeInteger(quantity) ||
        quantity < 1 ||
        quantity > MAX_ESTIMATOR_ROOM_QUANTITY ||
        (selection.room === 'fullHome' && quantity !== 1) ||
        (selection.instanceId !== undefined &&
          (!isValidEstimateInstanceId(selection.instanceId) || quantity !== 1))
      );
    })
  )
    throw new Error(`El número de estancias debe estar entre 1 y ${MAX_ESTIMATOR_ROOM_QUANTITY}.`);
  if (selections.some((selection) => !ESTIMATOR_ROOMS.some((room) => room.id === selection.room)))
    throw new Error('Hay una estancia no válida.');
  const instanceIds = selections.flatMap((selection) =>
    selection.instanceId ? [selection.instanceId] : [],
  );
  if (new Set(instanceIds).size !== instanceIds.length)
    throw new Error('Cada estancia debe tener un identificador distinto.');
  const roomSelections = new Map<EstimateRoom, EstimateSelection[]>();
  for (const selection of selections) {
    roomSelections.set(selection.room, [...(roomSelections.get(selection.room) ?? []), selection]);
  }
  if (
    Array.from(roomSelections.values()).some(
      (items) => items.length > 1 && items.some((selection) => !selection.instanceId),
    )
  )
    throw new Error('Configura cada estancia por separado.');
}

function validateLegacySelections(selections: EstimateSelection[]) {
  if (selections.some((selection) => selection.room === 'fullHome') && selections.length > 1)
    throw new Error('La vivienda completa no se puede combinar con otras estancias.');
  if (
    selections.some(
      (selection) =>
        !ESTIMATOR_SCOPES.some((scope) => scope.id === selection.scope) ||
        !LEGACY_ESTIMATOR_QUALITIES.some((quality) => quality.id === selection.quality) ||
        !isCompatibleLegacyRoomScope(selection.room, selection.scope),
    )
  )
    throw new Error('La selección no está disponible para estimación.');
}

function calculateLegacyQuoteRange(
  settings: LegacyQuoteEstimatorSettings,
  catalogParts: CatalogPart[],
  selections: EstimateSelection[],
  legacyTariffs: Tariff[],
): QuoteEstimate {
  validateLegacySelections(selections);
  const catalog = new Map(
    flattenEstimatorCatalog(catalogParts, legacyTariffs).map((concept) => [concept.id, concept]),
  );
  let minimum = 0;
  let maximum = 0;

  for (const selection of selections) {
    const service = settings.services.find(
      (candidate) => serviceKey(candidate) === serviceKey(selection),
    );
    if (!service) throw new Error('La selección no está disponible para estimación.');
    for (const line of service.lines) {
      const concept = catalog.get(line.conceptId);
      if (
        !concept ||
        !Number.isFinite(concept.basePrice) ||
        concept.basePrice <= 0 ||
        !isKnownUnit(concept.unit)
      )
        throw new Error('Hay una partida sin precio válido en el catálogo.');
      const quantity = selection.quantity ?? 1;
      const scale = (isMeasuredUnit(concept.unit) ? selection.areaM2 : 1) * quantity;
      minimum += concept.basePrice * line.minimumQuantity * scale;
      maximum += concept.basePrice * line.maximumQuantity * scale;
    }
  }
  return toQuoteEstimate(minimum * 100, maximum * 100);
}

function calculateSimpleQuoteRange(
  settings: SimpleQuoteEstimatorSettings,
  selections: EstimateSelection[],
): QuoteEstimate {
  if (
    selections.some(
      (selection) =>
        selection.room === 'fullHome' ||
        !ESTIMATOR_SCOPES.some((scope) => scope.id === selection.scope) ||
        !ESTIMATOR_QUALITIES.some((quality) => quality.id === selection.quality),
    )
  )
    throw new Error('La selección no está disponible para estimación.');
  if (new Set(selections.map((selection) => selection.scope)).size !== 1)
    throw new Error('Elige un único tipo de reforma para el cálculo.');

  let minimumCents = 0;
  let maximumCents = 0;
  for (const selection of selections) {
    const roomRate = settings.rooms.find((item) => item.room === selection.room);
    const qualityIndex = ESTIMATOR_QUALITIES.findIndex(
      (quality) => quality.id === selection.quality,
    );
    if (!roomRate || qualityIndex < 0)
      throw new Error('La selección no está disponible para estimación.');
    const increment = roomRate.qualityStepCentsPerM2 * qualityIndex;
    const totalAreaM2 = selection.areaM2 * (selection.quantity ?? 1);
    minimumCents += Math.round((roomRate.minimumCentsPerM2 + increment) * totalAreaM2);
    maximumCents += Math.round((roomRate.maximumCentsPerM2 + increment) * totalAreaM2);
  }
  return toQuoteEstimate(minimumCents, maximumCents);
}

function toQuoteEstimate(minimumCents: number, maximumCents: number): QuoteEstimate {
  const roundedMinimum = Math.round(minimumCents);
  const roundedMaximum = Math.round(maximumCents);
  if (!Number.isSafeInteger(roundedMinimum) || !Number.isSafeInteger(roundedMaximum))
    throw new Error('El importe supera el límite de cálculo.');
  return {
    minimumCents: roundedMinimum,
    maximumCents: roundedMaximum,
    currency: 'EUR',
    includesVat: false,
  };
}

export function calculateQuoteRange(
  settings: QuoteEstimatorSettings,
  catalogParts: CatalogPart[],
  selections: EstimateSelection[],
  legacyTariffs: Tariff[] = [],
): QuoteEstimate {
  validateEstimatorSettings(settings);
  validateSelections(selections);
  return isSimpleQuoteEstimatorSettings(settings)
    ? calculateSimpleQuoteRange(settings, selections)
    : calculateLegacyQuoteRange(settings, catalogParts, selections, legacyTariffs);
}

function isKnownUnit(value: unknown): value is 'm2' | 'm3' | 'ml' | 'unit' | 'hour' {
  return typeof value === 'string' && (measuredUnits.has(value) || fixedUnits.has(value));
}
