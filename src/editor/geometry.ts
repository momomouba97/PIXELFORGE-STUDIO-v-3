import type { Doc, Layer } from './types';

export interface Pt { x: number; y: number }

const rad = (d: number): number => (d * Math.PI) / 180;

/** Document point -> layer-local point (origin = layer top-left, unrotated, unflipped). */
export function toLocal(l: Layer, p: Pt): Pt {
  const a = -rad(l.rotation);
  const dx = p.x - l.x, dy = p.y - l.y;
  const rx = dx * Math.cos(a) - dy * Math.sin(a);
  const ry = dx * Math.sin(a) + dy * Math.cos(a);
  return { x: (l.flipX ? -rx : rx) + l.w / 2, y: (l.flipY ? -ry : ry) + l.h / 2 };
}

/** Layer offset from center (unflipped) -> document point. */
export function fromOffset(l: Layer, ox: number, oy: number): Pt {
  const a = rad(l.rotation);
  return { x: l.x + ox * Math.cos(a) - oy * Math.sin(a), y: l.y + ox * Math.sin(a) + oy * Math.cos(a) };
}

export function corners(l: Layer): Pt[] {
  const hw = l.w / 2, hh = l.h / 2;
  return [fromOffset(l, -hw, -hh), fromOffset(l, hw, -hh), fromOffset(l, hw, hh), fromOffset(l, -hw, hh)];
}

export function rotateHandle(l: Layer, zoom: number): Pt {
  return fromOffset(l, 0, -l.h / 2 - 28 / zoom);
}

export function hitTest(doc: Doc, p: Pt): Layer | null {
  for (let i = doc.layers.length - 1; i >= 0; i--) {
    const l = doc.layers[i];
    if (!l.visible || l.locked || l.kind === 'draw') continue;
    const q = toLocal(l, p);
    if (q.x >= 0 && q.y >= 0 && q.x <= l.w && q.y <= l.h) return l;
  }
  return null;
}

export function aabb(l: Layer): { minX: number; minY: number; maxX: number; maxY: number } {
  const c = corners(l);
  const xs = c.map((q) => q.x), ys = c.map((q) => q.y);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}
