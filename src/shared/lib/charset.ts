/**
 * Legacy DOS code pages used by FIEBDC (850, 437) are not part of the WHATWG Encoding
 * standard, so `TextDecoder` cannot decode them. These tables map bytes 0x80–0xFF.
 */
const CP437_HIGH =
  'ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜ¢£¥₧ƒáíóúñÑªº¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ ';
const CP850_HIGH =
  'ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜø£Ø×ƒáíóúñÑªº¿®¬½¼¡«»░▒▓│┤ÁÂÀ©╣║╗╝¢¥┐└┴┬├─┼ãÃ╚╔╩╦╠═╬¤ðÐÊËÈıÍÎÏ┘┌█▄¦Ì▀ÓßÔÒõÕµþÞÚÛÙýÝ¯´­±‗¾¶§÷¸°¨·¹³²■ ';

const DOS_TABLES: Record<'850' | '437', string> = { '850': CP850_HIGH, '437': CP437_HIGH };

export type FiebdcCharset = 'ANSI' | '850' | '437' | 'UTF-8';

/** Decodes bytes in a FIEBDC character set. Throws on invalid UTF-8. */
export function decodeBytes(bytes: Uint8Array, charset: FiebdcCharset): string {
  if (charset === 'UTF-8') return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  if (charset === 'ANSI') return new TextDecoder('windows-1252').decode(bytes);
  const table = DOS_TABLES[charset];
  let text = '';
  for (let index = 0; index < bytes.length; index += 8192) {
    const slice = bytes.subarray(index, index + 8192);
    text += Array.from(slice, (byte) =>
      byte < 0x80 ? String.fromCharCode(byte) : table[byte - 0x80]!,
    ).join('');
  }
  return text;
}

const WINDOWS_1252_EXTRA = new Map<number, number>([
  [0x20ac, 0x80],
  [0x201a, 0x82],
  [0x0192, 0x83],
  [0x201e, 0x84],
  [0x2026, 0x85],
  [0x2020, 0x86],
  [0x2021, 0x87],
  [0x02c6, 0x88],
  [0x2030, 0x89],
  [0x0160, 0x8a],
  [0x2039, 0x8b],
  [0x0152, 0x8c],
  [0x017d, 0x8e],
  [0x2018, 0x91],
  [0x2019, 0x92],
  [0x201c, 0x93],
  [0x201d, 0x94],
  [0x2022, 0x95],
  [0x2013, 0x96],
  [0x2014, 0x97],
  [0x02dc, 0x98],
  [0x2122, 0x99],
  [0x0161, 0x9a],
  [0x203a, 0x9b],
  [0x0153, 0x9c],
  [0x017e, 0x9e],
  [0x0178, 0x9f],
]);

/**
 * Encodes text as Windows-1252. Characters outside the code page become `?` and are
 * reported so the export can warn instead of silently changing text.
 */
export function encodeWindows1252(text: string): { bytes: Uint8Array; replaced: string[] } {
  const bytes: number[] = [];
  const replaced = new Set<string>();
  for (const character of text) {
    const codePoint = character.codePointAt(0)!;
    const byte =
      WINDOWS_1252_EXTRA.get(codePoint) ??
      (codePoint < 0x80 || (codePoint >= 0xa0 && codePoint <= 0xff) ? codePoint : undefined);
    if (byte === undefined) {
      replaced.add(character);
      bytes.push(0x3f);
    } else bytes.push(byte);
  }
  return { bytes: new Uint8Array(bytes), replaced: [...replaced] };
}
