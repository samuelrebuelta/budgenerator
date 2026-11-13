/** Path of a privacy notice hosted by BudGenerator, to open it in this app. */
export function hostedNoticePath(url: string | undefined) {
  if (!url) return null;
  try {
    const { pathname } = new URL(url);
    return /^\/aviso-privacidad\/[A-Za-z0-9_-]{22}$/.test(pathname) ? pathname : null;
  } catch {
    return null;
  }
}

export interface EstimatorRequirements {
  emailVerified: boolean;
  companyName: boolean;
  privacyNotice: boolean;
}

export function missingRequirements(requirements: EstimatorRequirements) {
  return [
    !requirements.emailVerified && 'verifica tu email',
    !requirements.companyName && 'añade el nombre de tu empresa',
    !requirements.privacyNotice && 'añade un aviso de privacidad',
  ].filter((item): item is string => Boolean(item));
}

export function shortLinkUrl(slug: string) {
  return `${window.location.origin}/p/${slug}`;
}

export function formUrl(token: string) {
  return `${window.location.origin}/solicitar-presupuesto/${token}`;
}

/** Button for the company website: plain HTML with inline styles, no scripts. */
export function websiteButtonHtml(url: string) {
  return `<a href="${url}" target="_blank" rel="noopener" style="display:inline-block;padding:12px 22px;border-radius:999px;background:#1f3f37;color:#ffffff;font-family:system-ui,sans-serif;font-weight:600;text-decoration:none">Pide tu presupuesto</a>`;
}

export function whatsappShareUrl(companyName: string, url: string) {
  const text = `Pide un presupuesto orientativo de tu reforma a ${companyName || 'nuestra empresa'}: ${url}`;
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
