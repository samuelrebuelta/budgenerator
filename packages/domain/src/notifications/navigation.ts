const SAFE_LEAD_ID = /^[a-zA-Z0-9_-]{1,128}$/;
const APP_ORIGIN = 'https://budgenerator.invalid';
const LEADS_PATH = '/profile/solicitudes';

export function notificationPathFromLeadId(leadId: unknown) {
  if (typeof leadId !== 'string' || !SAFE_LEAD_ID.test(leadId)) return null;
  const query = new URLSearchParams({ leadId });
  return `${LEADS_PATH}?${query.toString()}`;
}

export function safeNotificationLoginReturnPath(value: unknown) {
  if (
    typeof value !== 'string' ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('\\')
  ) {
    return null;
  }
  let url: URL;
  try {
    url = new URL(value, APP_ORIGIN);
  } catch {
    return null;
  }
  if (
    url.origin !== APP_ORIGIN ||
    url.pathname !== LEADS_PATH ||
    url.hash ||
    url.searchParams.getAll('leadId').length !== 1 ||
    [...url.searchParams.keys()].some((key) => key !== 'leadId')
  ) {
    return null;
  }
  const path = notificationPathFromLeadId(url.searchParams.get('leadId'));
  return path === `${url.pathname}${url.search}` ? path : null;
}
