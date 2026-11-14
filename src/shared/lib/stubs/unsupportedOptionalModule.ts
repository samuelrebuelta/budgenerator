// jsPDF loads html2canvas, DOMPurify and canvg lazily for `.html()` and SVG rendering.
// BudGenerator never uses those APIs, so vite.config.ts aliases them here to keep
// ~370 kB out of the bundle and the service worker precache.
const unsupported = () => {
  throw new Error('Esta función de exportación PDF no está disponible.');
};
export default unsupported;
export const sanitize = unsupported;
export const Canvg = { fromString: unsupported };
