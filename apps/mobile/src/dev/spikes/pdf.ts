import { CryptoDigestAlgorithm, digest } from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { buildBudgetDocument } from '@bg/domain/pdf/budgetDocument';
// Same input as the Node reference test (packages/domain/tests/pdf.test.ts).
import { longBudgetPdfInput } from '../../../../../packages/domain/tests/pdfFixtures';
import { SpikeRecorder, type SpikeResult } from './report';

const PDF_NAME = 'long-budget.pdf';

function pdfFile(): File {
  const directory = new Directory(Paths.document, 'spikes');
  if (!directory.exists) directory.create({ intermediates: true });
  return new File(directory, PDF_NAME);
}

/** Drops the volatile parts of a jsPDF file (creation date and file ID) before hashing. */
export function stripVolatile(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  let text = '';
  for (let index = 0; index < bytes.length; index++) text += String.fromCharCode(bytes[index]!);
  const stripped = text
    .replace(/\/CreationDate \(D:[^)]*\)/g, '')
    .replace(/\/ID \[ *<[0-9a-fA-F]+> *<[0-9a-fA-F]+> *\]/g, '');
  const out = new Uint8Array(new ArrayBuffer(stripped.length));
  for (let index = 0; index < stripped.length; index++) out[index] = stripped.charCodeAt(index);
  return out;
}

function hex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Spike PDF: `buildBudgetDocument` (jsPDF) on Hermes with the long document of the tests, timed,
 * written with `expo-file-system` and hashed without CreationDate/ID to compare with Node.
 */
export async function runPdfSpike(): Promise<SpikeResult> {
  const recorder = new SpikeRecorder('pdf-hermes');
  try {
    const { budget, company } = longBudgetPdfInput();
    // Warm-up run (module init, font metrics) so the measured run is the steady cost.
    const coldStart = performance.now();
    buildBudgetDocument(budget, company).output('arraybuffer');
    recorder.check(
      'primera generación (en frío)',
      true,
      `${(performance.now() - coldStart).toFixed(0)} ms`,
    );

    const document = await recorder.step(
      'buildBudgetDocument (documento largo)',
      () => buildBudgetDocument(budget, company),
      (doc) => `${doc.getNumberOfPages()} páginas`,
    );
    const buffer = await recorder.step(
      "output('arraybuffer')",
      () => document.output('arraybuffer'),
      (value) => `${value.byteLength} bytes`,
    );
    const runs: number[] = [];
    for (let run = 0; run < 5; run++) {
      const started = performance.now();
      buildBudgetDocument(budget, company).output('arraybuffer');
      runs.push(performance.now() - started);
    }
    runs.sort((a, b) => a - b);
    recorder.check(
      'generación completa ×5 (mediana)',
      true,
      `${runs[2]!.toFixed(0)} ms (min ${runs[0]!.toFixed(0)}, max ${runs[4]!.toFixed(0)})`,
    );

    const file = pdfFile();
    await recorder.step(
      'escribir con expo-file-system',
      async () => {
        if (file.exists) file.delete();
        file.create();
        await file.write(new Uint8Array(buffer));
        return file.size ?? 0;
      },
      (size) => `${size} bytes · ${file.uri}`,
    );
    const stripped = stripVolatile(new Uint8Array(buffer));
    await recorder.step(
      'SHA-256 sin CreationDate/ID',
      async () => hex(await digest(CryptoDigestAlgorithm.SHA256, stripped)),
      (value) => value,
    );
  } catch {
    // Recorded by the failing step.
  }
  return recorder.finish();
}

/** Opens the native share sheet for the PDF written by `runPdfSpike`. */
export async function sharePdf(): Promise<void> {
  const file = pdfFile();
  if (!file.exists) throw new Error('Genera antes el PDF.');
  if (!(await Sharing.isAvailableAsync())) throw new Error('Compartir no está disponible.');
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/pdf',
    UTI: 'com.adobe.pdf',
    dialogTitle: 'Compartir presupuesto',
  });
}
