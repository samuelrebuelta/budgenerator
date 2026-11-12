/**
 * Company logos are stored as data URLs inside `users/{uid}/profile/data` and
 * copied into each public budget snapshot. To keep both documents far from the
 * 1 MiB Firestore limit the logo is resized to 400 px and encoded as WebP (or
 * JPEG when the browser cannot encode WebP). Firestore Rules reject logos
 * longer than 200.000 characters; the client aims well below that.
 */
export const LOGO_MAX_SIDE = 400;
export const LOGO_MAX_DATA_URL_LENGTH = 150_000;
const QUALITIES = [0.9, 0.8, 0.7, 0.55, 0.4];

export function fitWithin(width: number, height: number, maxSide = LOGO_MAX_SIDE) {
  const ratio = Math.min(1, maxSide / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  };
}

/** Picks the first encoding that fits the size budget, preferring WebP. */
export function encodeLogo(
  encode: (type: 'image/webp' | 'image/jpeg', quality: number) => string,
  maxLength = LOGO_MAX_DATA_URL_LENGTH,
) {
  for (const type of ['image/webp', 'image/jpeg'] as const) {
    for (const quality of QUALITIES) {
      const dataUrl = encode(type, quality);
      // Browsers without WebP encoding silently return PNG; skip to JPEG.
      if (!dataUrl.startsWith(`data:${type};`)) break;
      if (dataUrl.length <= maxLength) return dataUrl;
    }
  }
  throw new Error('El logo es demasiado grande incluso comprimido. Prueba con otra imagen.');
}

export function canvasLogoEncoder(canvas: HTMLCanvasElement, context: CanvasRenderingContext2D) {
  const source = context.getImageData(0, 0, canvas.width, canvas.height);
  return (type: 'image/webp' | 'image/jpeg', quality: number) => {
    context.putImageData(source, 0, 0);
    if (type === 'image/jpeg') {
      // JPEG has no transparency: paint white behind the logo.
      context.globalCompositeOperation = 'destination-over';
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.globalCompositeOperation = 'source-over';
    }
    return canvas.toDataURL(type, quality);
  };
}
