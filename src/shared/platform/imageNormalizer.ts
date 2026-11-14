import type { ImageNormalizer } from '@bg/app-core/ports';
import { withTimeout } from '@bg/app-core/session';
import { canvasLogoEncoder, encodeLogo, fitWithin } from '@/shared/lib/logoImage';

/** Decodes the picked file, fits it within the logo size and encodes it on a `<canvas>`. */
export const canvasLogoNormalizer: ImageNormalizer<File> = async (file) => {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await withTimeout(image.decode(), 5000);
    const size = fitWithin(image.width, image.height);
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('Imagen no compatible.');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return encodeLogo(canvasLogoEncoder(canvas, context));
  } finally {
    URL.revokeObjectURL(url);
  }
};
