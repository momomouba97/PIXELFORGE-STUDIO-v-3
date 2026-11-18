import { allAssets, registerAsset } from '../editor/assets';
import type { Doc } from '../editor/types';

export interface ProjectFile { format: 'pixelforge'; version: 1; doc: Doc; assets: Record<string, string> }

export function serializeProject(doc: Doc): string {
  const ids = doc.layers.flatMap((l) => (l.kind === 'image' ? [l.assetId] : []));
  const p: ProjectFile = { format: 'pixelforge', version: 1, doc, assets: allAssets(ids) };
  return JSON.stringify(p);
}

export async function parseProject(text: string): Promise<Doc> {
  const p = JSON.parse(text) as Partial<ProjectFile>;
  if (p.format !== 'pixelforge' || p.version !== 1 || !p.doc || !Array.isArray(p.doc.layers) || !p.assets) {
    throw new Error('Not a valid PIXELFORGE project');
  }
  for (const [id, url] of Object.entries(p.assets)) {
    if (typeof url !== 'string' || !url.startsWith('data:image/')) throw new Error('Invalid asset in project');
    await registerAsset(id, url);
  }
  return p.doc;
}

// ---- IndexedDB (autosave / crash recovery) ----
const DB = 'pixelforge';
const STORE = 'kv';

function open(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

export async function idbPut(key: string, value: string): Promise<void> {
  const db = await open();
  await new Promise<void>((res, rej) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
  db.close();
}

export async function idbGet(key: string): Promise<string | null> {
  const db = await open();
  const v = await new Promise<string | null>((res, rej) => {
    const r = db.transaction(STORE).objectStore(STORE).get(key);
    r.onsuccess = () => res((r.result as string | undefined) ?? null);
    r.onerror = () => rej(r.error);
  });
  db.close();
  return v;
}
