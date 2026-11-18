import { renderDoc, clearRenderCache } from '../editor/render';
import type { Doc } from '../editor/types';

export type ExportFormat = 'png' | 'jpg' | 'jpeg' | 'webp';
const MIME: Record<ExportFormat, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' };
export const MAX_EXPORT_SIDE = 16384;

export async function exportBytes(doc: Doc, fmt: ExportFormat, width: number, height: number, quality: number): Promise<Uint8Array> {
  if (width > MAX_EXPORT_SIDE || height > MAX_EXPORT_SIDE) throw new Error(`Max export size is ${MAX_EXPORT_SIDE}px`);
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(width));
  c.height = Math.max(1, Math.round(height));
  const ctx = c.getContext('2d')!;
  if (fmt === 'jpg' || fmt === 'jpeg') { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, c.width, c.height); } // JPEG has no alpha
  const sx = c.width / doc.width, sy = c.height / doc.height;
  ctx.save();
  ctx.scale(1, sy / sx);
  renderDoc(ctx, doc, sx, { ns: 'export' });
  ctx.restore();
  clearRenderCache('export');
  const blob = await new Promise<Blob | null>((res) => c.toBlob(res, MIME[fmt], quality));
  if (!blob) throw new Error('Export failed (image too large for this device?)');
  return new Uint8Array(await blob.arrayBuffer());
}

/** Saves through the native macOS dialog in Electron, or as a download in a plain browser. */
export async function saveBytes(name: string, ext: string, data: Uint8Array): Promise<boolean> {
  if (window.pf) {
    const r = await window.pf.saveFile({ suggestedName: `${name}.${ext}`, ext, data });
    return r.saved;
  }
  const url = URL.createObjectURL(new Blob([data as BlobPart]));
  const a = document.createElement('a');
  a.href = url; a.download = `${name}.${ext}`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return true;
}
