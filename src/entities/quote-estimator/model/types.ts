import type { Unit } from '../../../shared/types/index.js';
import type { LeadContact, LeadStartTiming } from './leads.js';

export const ESTIMATOR_ROOMS = [
  {
    id: 'bathroom',
    label: 'Baño',
    pluralLabel: 'Baños',
    quantityLabel: 'Número de baños',
  },
  {
    id: 'kitchen',
    label: 'Cocina',
    pluralLabel: 'Cocinas',
    quantityLabel: 'Número de cocinas',
  },
  {
    id: 'livingRoom',
    label: 'Salón',
    pluralLabel: 'Salones',
    quantityLabel: 'Número de salones',
  },
  {
    id: 'bedroom',
    label: 'Dormitorio',
    pluralLabel: 'Dormitorios',
    quantityLabel: 'Número de dormitorios',
  },
  {
    id: 'outdoor',
    label: 'Exterior o terraza',
    pluralLabel: 'Exteriores o terrazas',
    quantityLabel: 'Número de exteriores o terrazas',
  },
  // Kept for schema-1 links created before integral renovations selected rooms individually.
  {
    id: 'fullHome',
    label: 'Vivienda completa',
    pluralLabel: 'Viviendas completas',
    quantityLabel: 'Número de viviendas',
  },
] as const;

export const CONFIGURABLE_ESTIMATOR_ROOMS = [
  ESTIMATOR_ROOMS[0],
  ESTIMATOR_ROOMS[1],
  ESTIMATOR_ROOMS[2],
  ESTIMATOR_ROOMS[3],
  ESTIMATOR_ROOMS[4],
] as const;

export const ESTIMATOR_SCOPES = [
  { id: 'partial', label: 'Reforma parcial' },
  { id: 'integral', label: 'Reforma integral' },
] as const;

export const ESTIMATOR_QUALITIES = [
  { id: 'medium', label: 'Media' },
  { id: 'high', label: 'Alta' },
  { id: 'luxury', label: 'Lujo' },
] as const;

export const MAX_ESTIMATOR_ROOM_QUANTITY = 20;
export const MAX_ESTIMATOR_SELECTIONS =
  CONFIGURABLE_ESTIMATOR_ROOMS.length * MAX_ESTIMATOR_ROOM_QUANTITY;

const estimateInstanceIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidEstimateInstanceId(value: unknown): value is string {
  return typeof value === 'string' && estimateInstanceIdPattern.test(value);
}

export const LEGACY_ESTIMATOR_QUALITIES = [
  { id: 'basic', label: 'Básica' },
  { id: 'standard', label: 'Estándar' },
  { id: 'high', label: 'Alta' },
] as const;

export type EstimateRoom = (typeof ESTIMATOR_ROOMS)[number]['id'];
export type ConfigurableEstimateRoom = Exclude<EstimateRoom, 'fullHome'>;
export type EstimateScope = (typeof ESTIMATOR_SCOPES)[number]['id'];
export type EstimateQuality = (typeof ESTIMATOR_QUALITIES)[number]['id'];
export type LegacyEstimateQuality = (typeof LEGACY_ESTIMATOR_QUALITIES)[number]['id'];
export type AnyEstimateQuality = EstimateQuality | LegacyEstimateQuality;

export interface EstimateLine {
  conceptId: string;
  minimumQuantity: number;
  maximumQuantity: number;
}

export interface EstimateService {
  room: EstimateRoom;
  scope: EstimateScope;
  quality: LegacyEstimateQuality;
  lines: EstimateLine[];
}

export interface LegacyQuoteEstimatorSettings {
  schemaVersion?: 1;
  services: EstimateService[];
  contact: {
    sharePhone: boolean;
    shareEmail: boolean;
  };
}

export interface RoomEstimateRate {
  room: ConfigurableEstimateRoom;
  minimumCentsPerM2: number;
  maximumCentsPerM2: number;
  qualityStepCentsPerM2: number;
}

export interface SimpleQuoteEstimatorSettings {
  schemaVersion: 2;
  rooms: RoomEstimateRate[];
  contact: {
    sharePhone: boolean;
    shareEmail: boolean;
  };
}

export type QuoteEstimatorSettings = LegacyQuoteEstimatorSettings | SimpleQuoteEstimatorSettings;

export function isSimpleQuoteEstimatorSettings(
  settings: QuoteEstimatorSettings | null | undefined,
): settings is SimpleQuoteEstimatorSettings {
  return settings?.schemaVersion === 2;
}

export interface EstimateSelection {
  room: EstimateRoom;
  scope: EstimateScope;
  quality: AnyEstimateQuality;
  areaM2: number;
  /** Stable ID for a physical room; absent in legacy grouped submissions. */
  instanceId?: string;
  /** Missing in historical requests and leads; treated as one room. */
  quantity?: number;
}

export interface EstimateServiceOption {
  room: EstimateRoom;
  scope: EstimateScope;
  quality: AnyEstimateQuality;
}

export interface PublicEstimatorInfo {
  schemaVersion: 1 | 2;
  companyName: string;
  phone?: string;
  email?: string;
  leadCaptureEnabled: boolean;
  privacyPolicyUrl?: string;
  services: EstimateServiceOption[];
}

export interface QuoteEstimate {
  minimumCents: number;
  maximumCents: number;
  currency: 'EUR';
  includesVat: false;
}

export interface PublicLeadSubmission {
  token: string;
  idempotencyKey: string;
  contact: LeadContact;
  selections: EstimateSelection[];
  startTiming: LeadStartTiming;
  consent: boolean;
  privacyPolicyUrl: string;
}

export interface QuoteLead {
  id: string;
  schemaVersion: 1 | 2;
  contact: LeadContact;
  selections: EstimateSelection[];
  startTiming: LeadStartTiming;
  estimate: QuoteEstimate;
  createdAt: string;
  consentAt: string;
  privacyPolicyUrl: string;
  budgetId?: string;
}

export function serviceKey(
  service: Pick<EstimateService, 'room' | 'scope'> & { quality: AnyEstimateQuality },
) {
  return `${service.room}:${service.scope}:${service.quality}`;
}

export function isMeasuredUnit(unit: Unit) {
  return unit === 'm2' || unit === 'm3' || unit === 'ml';
}
