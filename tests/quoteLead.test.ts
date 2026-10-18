import { describe, expect, it } from 'vitest';
import {
  isValidPrivacyPolicyUrl,
  validateLeadContact,
  validateLeadStartTiming,
} from '../src/entities/quote-estimator/model/leads';

describe('public lead contact validation', () => {
  it('trims contact fields and accepts a phone number without assuming a country code', () => {
    expect(
      validateLeadContact({
        name: '  Lucía Martín  ',
        email: ' lucia@example.com ',
        phone: ' 600 123 456 ',
      }),
    ).toEqual({
      name: 'Lucía Martín',
      email: 'lucia@example.com',
      phone: '600 123 456',
    });
  });

  it('accepts an international prefix and rejects malformed or oversized contact data', () => {
    expect(
      validateLeadContact({ name: 'Lucía', email: 'lucia@example.com', phone: '+34 (600) 123-456' })
        .phone,
    ).toBe('+34 (600) 123-456');
    expect(() =>
      validateLeadContact({ name: '', email: 'lucia@example.com', phone: '600123456' }),
    ).toThrow('nombre');
    expect(() =>
      validateLeadContact({ name: 'Lucía', email: 'no-es-email', phone: '600123456' }),
    ).toThrow('email');
    expect(() =>
      validateLeadContact({ name: 'Lucía', email: 'lucia@example.com', phone: 'abc' }),
    ).toThrow('teléfono');
    expect(() =>
      validateLeadContact({
        name: 'x'.repeat(121),
        email: 'lucia@example.com',
        phone: '600123456',
      }),
    ).toThrow('nombre');
  });
});

describe('company privacy policy URL validation', () => {
  it('accepts HTTPS URLs only', () => {
    expect(isValidPrivacyPolicyUrl('https://example.com/privacidad')).toBe(true);
    expect(isValidPrivacyPolicyUrl('http://example.com/privacidad')).toBe(false);
    expect(isValidPrivacyPolicyUrl('javascript:alert(1)')).toBe(false);
    expect(isValidPrivacyPolicyUrl('not a url')).toBe(false);
  });
});

describe('public lead start timing validation', () => {
  it('accepts the four declared planning horizons', () => {
    expect(validateLeadStartTiming('asap')).toBe('asap');
    expect(validateLeadStartTiming('oneToThreeMonths')).toBe('oneToThreeMonths');
    expect(validateLeadStartTiming('threeToSixMonths')).toBe('threeToSixMonths');
    expect(validateLeadStartTiming('later')).toBe('later');
  });

  it('rejects missing or unexpected planning horizons', () => {
    expect(() => validateLeadStartTiming(undefined)).toThrow('plazo');
    expect(() => validateLeadStartTiming('nextWeek')).toThrow('plazo');
  });
});
