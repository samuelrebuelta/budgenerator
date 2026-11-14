export * from '@bg/domain/lib/logoImage';

/** Browser encoder for `encodeLogo`: re-encodes the canvas contents as WebP or JPEG. */
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
