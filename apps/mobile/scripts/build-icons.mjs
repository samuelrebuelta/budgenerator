// Builds the app icon and splash image from the web brand SVGs (public/brand). Run from the
// repository root with `node apps/mobile/scripts/build-icons.mjs`; the PNGs are versioned.
import { mkdir } from 'node:fs/promises';
import sharp from 'sharp';

const out = 'apps/mobile/assets/images';
await mkdir(out, { recursive: true });

// Full-bleed square: iOS applies its own mask and Android uses it as the adaptive foreground.
await sharp('public/brand/icon-maskable.svg')
  .resize(1024, 1024)
  .flatten({ background: '#183E3B' })
  .png()
  .toFile(`${out}/icon.png`);

// Rounded mark for the splash screen (drawn on `gray-100`, as the web launch images).
await sharp('public/brand/icon.svg').resize(512, 512).png().toFile(`${out}/splash-icon.png`);
