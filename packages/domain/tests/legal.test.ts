import { describe, expect, it } from 'vitest';
import { LEGAL_TERMS_VERSION, markLegalAcceptance, takeLegalAcceptance } from '../src/lib/legal';

describe('legal acceptance', () => {
  it('hands the accepted version to the account creation once', () => {
    expect(takeLegalAcceptance()).toBeNull();
    markLegalAcceptance();
    expect(takeLegalAcceptance()).toBe(LEGAL_TERMS_VERSION);
    expect(takeLegalAcceptance()).toBeNull();
  });
});
