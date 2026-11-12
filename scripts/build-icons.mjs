import { copyFile, mkdir } from 'node:fs/promises';
import { IOS_SPLASH_SCREENS, splashFileName } from './ios-splash-screens.mjs';
import sharp from 'sharp';
for (const size of [192, 512])
  await sharp('public/brand/icon.svg').resize(size, size).png().toFile(`public/icon-${size}.png`);
await sharp('public/brand/icon.svg')
  .resize(180, 180)
  .png()
  .toFile('public/brand/apple-touch-icon.png');

await sharp('public/brand/social-preview.svg').png().toFile('public/brand/social-preview.png');

await mkdir('public/brand/licenses', { recursive: true });
for (const name of ['manrope', 'fraunces'])
  await copyFile(
    `node_modules/@fontsource-variable/${name}/LICENSE`,
    `public/brand/licenses/${name}.txt`,
  );

await sharp('public/brand/icon-maskable.svg')
  .resize(512, 512)
  .png()
  .toFile('public/brand/icon-maskable-512.png');

// iOS launch images: the brand mark centred on cal (#F5F2EB), one per portrait screen size.
await mkdir('public/brand/splash', { recursive: true });
for (const screen of IOS_SPLASH_SCREENS) {
  const width = screen.width * screen.ratio;
  const height = screen.height * screen.ratio;
  const iconSize = Math.round(112 * screen.ratio);
  const icon = await sharp('public/brand/icon.svg').resize(iconSize, iconSize).png().toBuffer();
  await sharp({ create: { width, height, channels: 3, background: '#F5F2EB' } })
    .composite([{ input: icon, gravity: 'center' }])
    .png({ compressionLevel: 9, palette: true })
    .toFile(`public/brand/splash/${splashFileName(screen)}`);
}
