import { File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as Sharing from 'expo-sharing';
import { assertBudget } from '@bg/domain';
import { buildBudgetDocument, type BudgetPdfLogo } from '@bg/domain/pdf/budgetDocument';
import type { Budget, CompanyProfile } from '@bg/domain/types';

/**
 * Profile logo (a WebP or JPEG data URL, already within 400 px) decoded to PNG for jsPDF, which the
 * web does with a canvas. `expo-image-manipulator` reads the data URL and returns the PNG with its
 * real width and height. A logo that cannot be read is left out, like the web.
 */
export async function pdfLogo(dataUrl: string | undefined): Promise<BudgetPdfLogo | null> {
  if (!dataUrl?.startsWith('data:image/')) return null;
  try {
    const image = await ImageManipulator.manipulate(dataUrl).renderAsync();
    const { base64 } = await image.saveAsync({ format: SaveFormat.PNG, base64: true });
    if (!base64) return null;
    return { data: `data:image/png;base64,${base64}`, width: image.width, height: image.height };
  } catch {
    return null;
  }
}

/** File name of the web's download: `presupuesto-{número}.pdf`. */
export function pdfFileName(budget: Pick<Budget, 'info'>) {
  const number = budget.info.budgetNumber.trim().replace(/[^\w.-]+/g, '-') || 'budgenerator';
  return `presupuesto-${number}.pdf`;
}

/**
 * PDF of the web (`buildBudgetDocument` of `@bg/domain`, jsPDF on Hermes) written to the cache with
 * `expo-file-system` and handed to the native share sheet (`expo-sharing`): Mail, WhatsApp, Files,
 * Print… Validation is the web's `assertBudget(budget, true)`, so the errors are the same.
 */
export async function shareBudgetPdf(budget: Budget, company: CompanyProfile) {
  assertBudget(budget, true);
  const logo = await pdfLogo(company.logo);
  const bytes = buildBudgetDocument(budget, company, logo).output('arraybuffer');
  const file = new File(Paths.cache, pdfFileName(budget));
  if (file.exists) file.delete();
  file.create();
  await file.write(new Uint8Array(bytes));
  if (!(await Sharing.isAvailableAsync()))
    throw new Error('Este dispositivo no permite compartir archivos.');
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/pdf',
    UTI: 'com.adobe.pdf',
    dialogTitle: 'Compartir presupuesto',
  });
  return file.uri;
}
