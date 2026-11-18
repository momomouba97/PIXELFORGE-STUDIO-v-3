import type { EditorStore } from './store';
import {
  defaultAdj, defaultFx, uid,
  type Doc, type DrawLayer, type ImageLayer, type Layer, type ShapeKind, type ShapeLayer, type TextLayer,
} from './types';

const base = (name: string, x: number, y: number, w: number, h: number) => ({
  id: uid(), name, visible: true, locked: false, opacity: 1, blend: 'normal' as const,
  x, y, w, h, rotation: 0, flipX: false, flipY: false,
  adj: defaultAdj(), filter: { name: null, strength: 100 }, fx: defaultFx(),
});

let measureCtx: CanvasRenderingContext2D | null = null;
export function measureText(l: Pick<TextLayer, 'text' | 'font' | 'size' | 'weight' | 'letterSpacing' | 'lineHeight'>): { w: number; h: number } {
  if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d')!;
  const ctx = measureCtx;
  ctx.font = `${l.weight} ${l.size}px ${l.font}`;
  (ctx as unknown as { letterSpacing: string }).letterSpacing = `${l.letterSpacing}px`;
  const lines = l.text.split('\n');
  const w = Math.max(10, ...lines.map((s) => ctx.measureText(s).width)) + 4;
  return { w, h: Math.max(l.size, lines.length * l.size * l.lineHeight) };
}

export function makeImageLayer(doc: Doc, assetId: string, nw: number, nh: number, name: string): ImageLayer {
  const k = Math.min(1, (doc.width * 0.9) / nw, (doc.height * 0.9) / nh);
  return { ...base(name, doc.width / 2, doc.height / 2, nw * k, nh * k), kind: 'image', assetId };
}

export function makeTextLayer(doc: Doc, text: string, size = Math.round(doc.height / 12)): TextLayer {
  const t = {
    text, font: '"Helvetica Neue", "Geeza Pro", Arial, sans-serif', size, weight: 700, color: '#ffffff',
    align: 'center' as const, letterSpacing: 0, lineHeight: 1.2, stroke: '#000000', strokeWidth: 0, bg: 'transparent',
  };
  const m = measureText(t);
  return { ...base('Text', doc.width / 2, doc.height / 2, m.w, m.h), kind: 'text', ...t };
}

export function makeShapeLayer(doc: Doc, shape: ShapeKind): ShapeLayer {
  const s = Math.round(Math.min(doc.width, doc.height) * 0.3);
  return {
    ...base(shape[0].toUpperCase() + shape.slice(1), doc.width / 2, doc.height / 2, shape === 'line' ? s * 1.5 : s, shape === 'line' ? 12 : s),
    kind: 'shape', shape, fill: '#ff6a3d', stroke: shape === 'line' ? '#ff6a3d' : '#ffffff', strokeWidth: shape === 'line' ? 8 : 0,
  };
}

export function makeFrameLayer(doc: Doc, stroke: string, width: number): ShapeLayer {
  return {
    ...base('Frame', doc.width / 2, doc.height / 2, doc.width, doc.height),
    kind: 'shape', shape: 'rect', fill: 'transparent', stroke, strokeWidth: width,
  };
}

export function makeDrawLayer(doc: Doc): DrawLayer {
  return { ...base('Drawing', doc.width / 2, doc.height / 2, doc.width, doc.height), kind: 'draw', strokes: [], rev: uid() };
}

export function addLayer(store: EditorStore, layer: Layer, label: string): void {
  store.mutate(label, (d) => { d.layers.push(layer); d.selectedId = layer.id; });
}

export function updateLayer(store: EditorStore, id: string, label: string, fn: (l: Layer) => void, key?: string): void {
  store.mutate(label, (d) => { const l = d.layers.find((x) => x.id === id); if (l) fn(l); }, key);
}

export function updateText(store: EditorStore, id: string, label: string, patch: Partial<TextLayer>, key?: string): void {
  updateLayer(store, id, label, (l) => {
    if (l.kind !== 'text') return;
    Object.assign(l, patch);
    const m = measureText(l);
    l.w = m.w; l.h = m.h;
  }, key);
}

export function duplicateLayer(store: EditorStore, id: string): void {
  store.mutate('Duplicate layer', (d) => {
    const i = d.layers.findIndex((x) => x.id === id);
    if (i < 0) return;
    const c = structuredClone(d.layers[i]);
    c.id = uid(); c.name = `${c.name} copy`; c.x += 20; c.y += 20;
    if (c.kind === 'draw') c.rev = uid();
    d.layers.splice(i + 1, 0, c);
    d.selectedId = c.id;
  });
}

export function deleteLayer(store: EditorStore, id: string): void {
  store.mutate('Delete layer', (d) => {
    d.layers = d.layers.filter((x) => x.id !== id);
    if (d.selectedId === id) d.selectedId = null;
  });
}

export function moveLayer(store: EditorStore, from: number, to: number): void {
  if (from === to) return;
  store.mutate('Reorder layers', (d) => {
    const [l] = d.layers.splice(from, 1);
    d.layers.splice(to, 0, l);
  });
}

export function align(store: EditorStore, id: string, where: 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom'): void {
  updateLayer(store, id, 'Align layer', (l) => {
    if (where === 'left') l.x = l.w / 2;
    if (where === 'right') l.x = store.doc.width - l.w / 2;
    if (where === 'hcenter') l.x = store.doc.width / 2;
    if (where === 'top') l.y = l.h / 2;
    if (where === 'bottom') l.y = store.doc.height - l.h / 2;
    if (where === 'vcenter') l.y = store.doc.height / 2;
  });
}

/** Crops the canvas to the rectangle (document coordinates) and shifts all layers. */
export function cropDoc(store: EditorStore, r: { x: number; y: number; w: number; h: number }): void {
  const x = Math.max(0, Math.round(r.x)), y = Math.max(0, Math.round(r.y));
  const w = Math.max(1, Math.round(r.w)), h = Math.max(1, Math.round(r.h));
  store.mutate('Crop', (d) => {
    d.width = w; d.height = h;
    d.layers.forEach((l) => { l.x -= x; l.y -= y; });
  });
}

/** Rotates the whole canvas 90 degrees clockwise. */
export function rotateDoc90(store: EditorStore): void {
  store.mutate('Rotate 90°', (d) => {
    const H = d.height;
    d.layers.forEach((l) => {
      const nx = H - l.y, ny = l.x;
      l.x = nx; l.y = ny;
      l.rotation = (l.rotation + 90) % 360;
    });
    const w = d.width; d.width = d.height; d.height = w;
  });
}

export function resizeCanvas(store: EditorStore, w: number, h: number): void {
  store.mutate('Resize canvas', (d) => {
    const dx = (w - d.width) / 2, dy = (h - d.height) / 2;
    d.layers.forEach((l) => { l.x += dx; l.y += dy; });
    d.width = w; d.height = h;
  });
}
