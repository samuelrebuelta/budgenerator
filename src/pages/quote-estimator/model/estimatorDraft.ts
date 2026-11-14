import type { SimpleQuoteEstimatorSettings } from '@/entities/quote-estimator';

/**
 * Unsaved estimator configuration of the current tab. It survives a reload or a visit to
 * Mi empresa and is cleared once saved. `sessionStorage` keeps it out of other tabs and
 * devices; storage can be unavailable (private mode), so every access is guarded.
 */
export interface EstimatorDraft {
  settings: SimpleQuoteEstimatorSettings;
  step: number;
}

const draftKey = (uid: string) => `budgenerator:estimator-draft:${uid}`;

function isDraft(value: unknown): value is EstimatorDraft {
  const draft = value as EstimatorDraft | null;
  return (
    !!draft &&
    typeof draft.step === 'number' &&
    draft.settings?.schemaVersion === 2 &&
    Array.isArray(draft.settings.rooms) &&
    typeof draft.settings.contact?.sharePhone === 'boolean' &&
    typeof draft.settings.contact?.shareEmail === 'boolean'
  );
}

export function readEstimatorDraft(uid: string): EstimatorDraft | null {
  try {
    const raw = sessionStorage.getItem(draftKey(uid));
    const draft: unknown = raw ? JSON.parse(raw) : null;
    return isDraft(draft) ? { ...draft, step: Math.min(Math.max(draft.step, 0), 2) } : null;
  } catch {
    return null;
  }
}

export function writeEstimatorDraft(uid: string, draft: EstimatorDraft) {
  try {
    sessionStorage.setItem(draftKey(uid), JSON.stringify(draft));
  } catch {
    // Without storage the draft only lives in memory.
  }
}

export function clearEstimatorDraft(uid: string) {
  try {
    sessionStorage.removeItem(draftKey(uid));
  } catch {
    // Nothing to clear.
  }
}
