import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import type { ImageNormalizer } from '@bg/app-core/ports';
import { fitWithin, LOGO_MAX_DATA_URL_LENGTH } from '@bg/domain/lib/logoImage';

/** Image chosen with `expo-image-picker` (its asset has `uri`, `width` and `height`). */
export interface PickedImage {
  uri: string;
  width: number;
  height: number;
}

/** Same order as the web's `encodeLogo`: WebP first, then JPEG, lowering the quality. */
const ATTEMPTS = [SaveFormat.WEBP, SaveFormat.JPEG].flatMap((format) =>
  [0.9, 0.8, 0.7, 0.55, 0.4].map((compress) => ({ format, compress })),
);

/**
 * `ImageNormalizer` of the profile logo on mobile: resizes with `expo-image-manipulator` to the
 * web's 400 px box and keeps the first encoding under the data URL budget (Rules allow 200.000).
 */
export const manipulatorLogoNormalizer: ImageNormalizer<PickedImage> = async (image) => {
  const size = fitWithin(image.width, image.height);
  const rendered = await ImageManipulator.manipulate(image.uri).resize(size).renderAsync();
  for (const { format, compress } of ATTEMPTS) {
    const { base64 } = await rendered.saveAsync({ format, compress, base64: true });
    if (!base64) continue;
    const dataUrl = `data:image/${format};base64,${base64}`;
    if (dataUrl.length <= LOGO_MAX_DATA_URL_LENGTH) return dataUrl;
  }
  throw new Error('El logo es demasiado grande incluso comprimido. Prueba con otra imagen.');
};
