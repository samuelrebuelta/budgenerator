export interface LeadContact {
  name: string;
  email: string;
  phone: string;
}

export const LEAD_START_TIMINGS = [
  { id: 'asap', label: 'Lo antes posible' },
  { id: 'oneToThreeMonths', label: 'En 1–3 meses' },
  { id: 'threeToSixMonths', label: 'En 3–6 meses' },
  { id: 'later', label: 'Más adelante' },
] as const;

export type LeadStartTiming = (typeof LEAD_START_TIMINGS)[number]['id'];

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^[+()0-9 .-]{6,40}$/;

export function validateLeadContact(value: unknown): LeadContact {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Revisa el nombre, email y teléfono.');
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some((key) => !['name', 'email', 'phone'].includes(key)))
    throw new Error('Revisa el nombre, email y teléfono.');
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  const email = typeof input.email === 'string' ? input.email.trim() : '';
  const phone = typeof input.phone === 'string' ? input.phone.trim() : '';
  if (!name || name.length > 120) throw new Error('El nombre debe tener entre 1 y 120 caracteres.');
  if (email.length > 254 || !emailPattern.test(email))
    throw new Error('Introduce un email válido.');
  if (!phonePattern.test(phone) || phone.replace(/\D/g, '').length < 6)
    throw new Error('Introduce un teléfono válido.');
  return { name, email, phone };
}

export function validateLeadStartTiming(value: unknown): LeadStartTiming {
  const timing = LEAD_START_TIMINGS.find((option) => option.id === value);
  if (!timing) throw new Error('Selecciona un plazo aproximado para empezar la reforma.');
  return timing.id;
}

export function isValidPrivacyPolicyUrl(value: unknown): value is string {
  if (typeof value !== 'string' || !value.trim() || value.length > 2048) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && Boolean(url.hostname) && !url.username && !url.password;
  } catch {
    return false;
  }
}
