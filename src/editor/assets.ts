import { uid } from './types';

const images = new Map<string, HTMLImageElement>();
const urls = new Map<string, string>();

export const MAX_IMPORT_BYTES = 200 * 1024 * 1024;
const MAX_SIDE = 4096;

export function sniff(b: Uint8Array): 'jpeg' | 'png' | 'webp' | 'bmp' | 'tiff' | null {
  if (b.length < 12) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'png';
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'webp';
  if (b[0] === 0x42 && b[1] === 0x4d) return 'bmp';
  if ((b[0] === 0x49 && b[1] === 0x49 && b[2] === 0x2a) || (b[0] === 0x4d && b[1] === 0x4d && b[3] === 0x2a)) return 'tiff';
  return null;
}

function decode(url: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => rej(new Error('decode failed'));
    im.src = url;
  });
}

export async function registerAsset(id: string, dataUrl: string): Promise<HTMLImageElement> {
  const im = await decode(dataUrl);
  images.set(id, im);
  urls.set(id, dataUrl);
  return im;
}
export const getAsset = (id: string): HTMLImageElement | undefined => images.get(id);
export const allAssets = (usedIds: string[]): Record<string, string> => {
  const o: Record<string, string> = {};
  usedIds.forEach((id) => { const u = urls.get(id); if (u) o[id] = u; });
  return o;
};

function toDataUrl(blob: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(String(fr.result));
    fr.onerror = () => rej(new Error('read failed'));
    fr.readAsDataURL(blob);
  });
}

/** Validates (size + magic bytes), decodes and registers an image. Large images are downscaled to 4096px. */
export async function loadImageFile(file: File): Promise<{ id: string; w: number; h: number }> {
  if (file.size > MAX_IMPORT_BYTES) throw new Error('File too large (max 200 MB)');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = sniff(bytes);
  if (!kind) throw new Error('Unsupported or invalid image file');
  if (kind === 'tiff') throw new Error('TIFF cannot be decoded by this version (Chromium has no TIFF decoder)');
  const mime = kind === 'jpeg' ? 'image/jpeg' : kind === 'png' ? 'image/png' : kind === 'webp' ? 'image/webp' : 'image/bmp';
  let dataUrl = await toDataUrl(new Blob([bytes], { type: mime }));
  let im = await decode(dataUrl);
  const longest = Math.max(im.naturalWidth, im.naturalHeight);
  if (longest > MAX_SIDE) {
    const k = MAX_SIDE / longest;
    const c = document.createElement('canvas');
    c.width = Math.round(im.naturalWidth * k);
    c.height = Math.round(im.naturalHeight * k);
    c.getContext('2d')!.drawImage(im, 0, 0, c.width, c.height);
    dataUrl = c.toDataURL(kind === 'jpeg' ? 'image/jpeg' : 'image/png', 0.95);
    im = await decode(dataUrl);
  }
  const id = uid();
  images.set(id, im);
  urls.set(id, dataUrl);
  return { id, w: im.naturalWidth, h: im.naturalHeight };
}
