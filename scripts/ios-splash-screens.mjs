/** Portrait iPhone screens (CSS px and device pixel ratio) that get an apple-touch-startup-image. */
export const IOS_SPLASH_SCREENS = [
  { width: 440, height: 956, ratio: 3 }, // 16 Pro Max
  { width: 402, height: 874, ratio: 3 }, // 16 Pro
  { width: 430, height: 932, ratio: 3 }, // 14 Pro Max, 15 Plus/Pro Max, 16 Plus
  { width: 393, height: 852, ratio: 3 }, // 14 Pro, 15, 15 Pro, 16
  { width: 390, height: 844, ratio: 3 }, // 12, 13, 14
  { width: 375, height: 812, ratio: 3 }, // X, XS, 11 Pro, 12/13 mini
  { width: 414, height: 896, ratio: 2 }, // XR, 11
  { width: 375, height: 667, ratio: 2 }, // SE (2.ª y 3.ª gen.), 8
];

export function splashFileName({ width, height, ratio }) {
  return `splash-${width * ratio}x${height * ratio}.png`;
}

export function splashMedia({ width, height, ratio }) {
  return `(device-width: ${width}px) and (device-height: ${height}px) and (-webkit-device-pixel-ratio: ${ratio}) and (orientation: portrait)`;
}
