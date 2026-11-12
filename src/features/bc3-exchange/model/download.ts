import {
  bc3FileName,
  serializeBc3,
  type Bc3ExportResult,
} from '@/entities/construction-document/bc3';
import type { ConstructionDocument } from '@/entities/construction-document/model';

export interface PreparedExport extends Bc3ExportResult {
  fileName: string;
}

/** Serializes locally; nothing is uploaded. */
export function prepareBc3Export(document: ConstructionDocument, name: string): PreparedExport {
  return { ...serializeBc3(document), fileName: bc3FileName(name) };
}

/** Saves the bytes through a temporary object URL that is always released. */
export function downloadBytes(bytes: Uint8Array, fileName: string) {
  const blob = new Blob([bytes as BlobPart], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.rel = 'noopener';
    document.body.append(link);
    link.click();
    link.remove();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

export async function readFileBytes(file: File): Promise<Uint8Array> {
  return new Uint8Array(await file.arrayBuffer());
}
