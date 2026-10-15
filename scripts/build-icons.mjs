import { copyFile, mkdir } from 'node:fs/promises';
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
