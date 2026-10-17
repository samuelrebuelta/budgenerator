const PENDING_KEY = 'budgenerator:welcome-tour:pending-uid';
const COMPLETED_PREFIX = 'budgenerator:welcome-tour:completed:';

type StorageReader = Pick<Storage, 'getItem'>;
type StorageWriter = Pick<Storage, 'setItem' | 'removeItem'>;

let memoryPendingUid: string | null = null;

export function markWelcomeTourPending(uid: string, storage?: StorageWriter) {
  memoryPendingUid = uid;
  try {
    (storage ?? window.sessionStorage).setItem(PENDING_KEY, uid);
  } catch {
    // In-memory fallback covers the registration flow in restricted browsers.
  }
}

export function isWelcomeTourPending(
  uid: string,
  session?: StorageReader,
  local?: StorageReader,
): boolean {
  let completed = false;
  try {
    completed = (local ?? window.localStorage).getItem(`${COMPLETED_PREFIX}${uid}`) === 'true';
  } catch {
    // A blocked localStorage must not hide a valid session marker.
  }
  let pending: string | null = null;
  try {
    pending = (session ?? window.sessionStorage).getItem(PENDING_KEY);
  } catch {
    // In-memory state covers the immediate registration flow in restricted browsers.
  }
  return !completed && (pending === uid || memoryPendingUid === uid);
}

export function markWelcomeTourComplete(
  uid: string,
  session?: StorageWriter,
  local?: StorageWriter,
) {
  if (memoryPendingUid === uid) memoryPendingUid = null;
  try {
    (session ?? window.sessionStorage).removeItem(PENDING_KEY);
  } catch {
    // Storage may be unavailable in private browsing.
  }
  try {
    (local ?? window.localStorage).setItem(`${COMPLETED_PREFIX}${uid}`, 'true');
  } catch {
    // The session marker is still cleared, so the tour will not loop in this tab.
  }
}
