import { getAsset } from './assets';
import {
  applyAdjustments, applyChromatic, applyGrain, applyTone, effectiveAdj, FILTERS, median3,
} from './pixel';
import type { Adjustments, Doc, Layer, Stroke } from './types';

export interface Live { layerId: string; stroke: Stroke }
export interface RenderOpts { live?: Live | null; ns?: string }

const cache = new Map<string, { key: string; canvas: HTMLCanvasElement }>();

const hasAdj = (a: Adjustments): boolean => (Object.keys(a) as (keyof Adjustments)[]).some((k) => a[k] !== 0);

function needsProcessing(l: Layer): boolean {
  const f = l.fx;
  return hasAdj(effectiveAdj(l.adj, l.filter)) || !!(l.filter.name && FILTERS[l.filter.name].tone) ||
    f.blur > 0 || f.vignette > 0 || f.grain > 0 || f.chromatic > 0 || f.glow > 0 || f.overlayAmount > 0;
}

const isRtl = (s: string): boolean => /[֐-ࣿ]/.test(s);

function drawContent(ctx: CanvasRenderingContext2D, l: Layer, live: Live | null): void {
  if (l.kind === 'image') {
    const im = getAsset(l.assetId);
    if (im) ctx.drawImage(im, 0, 0, l.w, l.h);
  } else if (l.kind === 'text') {
    if (l.bg && l.bg !== 'transparent') { ctx.fillStyle = l.bg; ctx.fillRect(0, 0, l.w, l.h); }
    ctx.font = `${l.weight} ${l.size}px ${l.font}`;
    ctx.textBaseline = 'top';
    ctx.fillStyle = l.color;
    (ctx as unknown as { letterSpacing: string }).letterSpacing = `${l.letterSpacing}px`;
    const lh = l.size * l.lineHeight;
    l.text.split('\n').forEach((ln, i) => {
      ctx.direction = isRtl(ln) ? 'rtl' : 'ltr';
      ctx.textAlign = l.align;
      const x = l.align === 'left' ? 0 : l.align === 'center' ? l.w / 2 : l.w;
      const y = i * lh + (lh - l.size) / 2;
      if (l.strokeWidth > 0) {
        ctx.lineWidth = l.strokeWidth; ctx.strokeStyle = l.stroke; ctx.lineJoin = 'round';
        ctx.strokeText(ln, x, y);
      }
      ctx.fillText(ln, x, y);
    });
  } else if (l.kind === 'shape') {
    const sw = l.strokeWidth, p = sw / 2, w = l.w, h = l.h;
    ctx.fillStyle = l.fill; ctx.strokeStyle = l.stroke; ctx.lineWidth = sw; ctx.lineJoin = 'round';
    ctx.beginPath();
    if (l.shape === 'rect') ctx.rect(p, p, w - sw, h - sw);
    else if (l.shape === 'ellipse') ctx.ellipse(w / 2, h / 2, Math.max(0, (w - sw) / 2), Math.max(0, (h - sw) / 2), 0, 0, Math.PI * 2);
    else if (l.shape === 'triangle') { ctx.moveTo(w / 2, p); ctx.lineTo(w - p, h - p); ctx.lineTo(p, h - p); ctx.closePath(); }
    else if (l.shape === 'hexagon' || l.shape === 'star') {
      const n = l.shape === 'hexagon' ? 6 : 10;
      for (let i = 0; i < n; i++) {
        const ang = (Math.PI * 2 * i) / n - Math.PI / 2;
        const k = l.shape === 'star' && i % 2 === 1 ? 0.45 : 1;
        const px = w / 2 + Math.cos(ang) * ((w - sw) / 2) * k, py = h / 2 + Math.sin(ang) * ((h - sw) / 2) * k;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
    } else { ctx.moveTo(p, h / 2); ctx.lineTo(w - p, h / 2); }
    if (l.shape !== 'line' && l.fill && l.fill !== 'transparent') ctx.fill();
    if (l.shape === 'line' || sw > 0) ctx.stroke();
  } else {
    const strokes = live && live.layerId === l.id ? [...l.strokes, live.stroke] : l.strokes;
    for (const s of strokes) {
      ctx.save();
      ctx.globalCompositeOperation = s.mode === 'eraser' ? 'destination-out' : 'source-over';
      ctx.globalAlpha = s.opacity; ctx.strokeStyle = s.color; ctx.fillStyle = s.color;
      ctx.lineWidth = s.size; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      if (s.points.length === 1) {
        ctx.beginPath(); ctx.arc(s.points[0][0], s.points[0][1], s.size / 2, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.beginPath();
        s.points.forEach((pt, i) => (i === 0 ? ctx.moveTo(pt[0], pt[1]) : ctx.lineTo(pt[0], pt[1])));
        ctx.stroke();
      }
      ctx.restore();
    }
  }
}

function copyCanvas(c: HTMLCanvasElement): HTMLCanvasElement {
  const t = document.createElement('canvas');
  t.width = c.width; t.height = c.height;
  t.getContext('2d')!.drawImage(c, 0, 0);
  return t;
}

function unsharp(c: HTMLCanvasElement, radius: number, amount: number): void {
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  const b = document.createElement('canvas');
  b.width = c.width; b.height = c.height;
  const bctx = b.getContext('2d', { willReadFrequently: true })!;
  bctx.filter = `blur(${radius}px)`;
  bctx.drawImage(c, 0, 0);
  const a = ctx.getImageData(0, 0, c.width, c.height);
  const bd = bctx.getImageData(0, 0, c.width, c.height).data;
  const d = a.data;
  for (let i = 0; i < d.length; i += 4) {
    d[i] += (d[i] - bd[i]) * amount; d[i + 1] += (d[i + 1] - bd[i + 1]) * amount; d[i + 2] += (d[i + 2] - bd[i + 2]) * amount;
  }
  ctx.putImageData(a, 0, 0);
}

/** Edge-preserving smoothing: blends toward a blurred copy only where local contrast is low (skin smoothing). */
function smoothEdge(c: HTMLCanvasElement, amount: number, s: number): void {
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  const b = document.createElement('canvas');
  b.width = c.width; b.height = c.height;
  const bctx = b.getContext('2d', { willReadFrequently: true })!;
  bctx.filter = `blur(${Math.max(1, 3 * s)}px)`;
  bctx.drawImage(c, 0, 0);
  const a = ctx.getImageData(0, 0, c.width, c.height);
  const bd = bctx.getImageData(0, 0, c.width, c.height).data;
  const d = a.data;
  for (let i = 0; i < d.length; i += 4) {
    const la = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
    const lb = 0.2126 * bd[i] + 0.7152 * bd[i + 1] + 0.0722 * bd[i + 2];
    const diff = Math.abs(la - lb) / 18;
    const k = amount * Math.exp(-diff * diff);
    d[i] += (bd[i] - d[i]) * k; d[i + 1] += (bd[i + 1] - d[i + 1]) * k; d[i + 2] += (bd[i + 2] - d[i + 2]) * k;
  }
  ctx.putImageData(a, 0, 0);
}

function process(c: HTMLCanvasElement, l: Layer, s: number): void {
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  const w = c.width, h = c.height;
  const adj = effectiveAdj(l.adj, l.filter);
  const tone = l.filter.name ? FILTERS[l.filter.name].tone : undefined;
  const f = l.fx;
  if (hasAdj({ ...adj, sharpness: 0, clarity: 0, smooth: 0 }) || tone || f.chromatic || f.grain) {
    const img = ctx.getImageData(0, 0, w, h);
    applyAdjustments(img, adj);
    if (tone) applyTone(img, tone, l.filter.strength);
    if (adj.denoise > 0) median3(img, adj.denoise / 100);
    if (f.chromatic) applyChromatic(img, f.chromatic * s);
    if (f.grain) applyGrain(img, f.grain);
    ctx.putImageData(img, 0, 0);
  }
  if (adj.smooth > 0) smoothEdge(c, adj.smooth / 100, s);
  if (adj.sharpness !== 0) unsharp(c, Math.max(0.6, 1.2 * s), (adj.sharpness / 100) * 1.5);
  if (adj.clarity !== 0) unsharp(c, Math.max(2, 12 * s), (adj.clarity / 100) * 0.8);
  if (f.blur > 0) {
    const t = copyCanvas(c);
    ctx.clearRect(0, 0, w, h);
    ctx.filter = `blur(${f.blur * s}px)`;
    ctx.drawImage(t, 0, 0);
    ctx.filter = 'none';
  }
  if (f.glow > 0) {
    const t = copyCanvas(c);
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = f.glow / 100;
    ctx.filter = `blur(${12 * s}px) brightness(1.4)`;
    ctx.drawImage(t, 0, 0);
    ctx.restore();
  }
  if (f.vignette > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.25, w / 2, h / 2, Math.hypot(w, h) / 2);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, `rgba(0,0,0,${(f.vignette / 100) * 0.9})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
  if (f.overlayAmount > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    ctx.globalAlpha = f.overlayAmount / 100;
    ctx.fillStyle = f.overlayColor;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
}

function contentKey(l: Layer, cw: number, ch: number, live: Live | null): string {
  const common = { w: l.w, h: l.h, adj: l.adj, filter: l.filter, fx: l.fx, cw, ch };
  let content: unknown;
  if (l.kind === 'image') content = l.assetId;
  else if (l.kind === 'text') content = [l.text, l.font, l.size, l.weight, l.color, l.align, l.letterSpacing, l.lineHeight, l.stroke, l.strokeWidth, l.bg];
  else if (l.kind === 'shape') content = [l.shape, l.fill, l.stroke, l.strokeWidth];
  else content = [l.rev, live && live.layerId === l.id ? live.stroke.points.length : 0];
  return JSON.stringify([common, content]);
}

function layerSource(l: Layer, scale: number, live: Live | null, ns: string): CanvasImageSource | null {
  if (l.kind === 'image' && !needsProcessing(l)) return getAsset(l.assetId) ?? null;
  let cs = Math.min(scale, 3);
  const area = l.w * l.h * cs * cs;
  if (area > 16e6) cs = Math.sqrt(16e6 / (l.w * l.h));
  const cw = Math.max(1, Math.ceil(l.w * cs)), ch = Math.max(1, Math.ceil(l.h * cs));
  const key = contentKey(l, cw, ch, live);
  const ck = `${ns}:${l.id}`;
  const hit = cache.get(ck);
  if (hit && hit.key === key) return hit.canvas;
  const c = document.createElement('canvas');
  c.width = cw; c.height = ch;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.save();
  ctx.scale(cw / l.w, ch / l.h);
  drawContent(ctx, l, live);
  ctx.restore();
  if (needsProcessing(l)) process(c, l, cw / l.w);
  cache.set(ck, { key, canvas: c });
  return c;
}

/** Renders the document at `scale` pixels per document unit into ctx (origin = top-left of the document). */
export function renderDoc(ctx: CanvasRenderingContext2D, doc: Doc, scale: number, opts: RenderOpts = {}): void {
  const ns = opts.ns ?? 'view';
  const live = opts.live ?? null;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, doc.width * scale, doc.height * scale);
  ctx.clip();
  if (doc.background) {
    ctx.fillStyle = doc.background;
    ctx.fillRect(0, 0, doc.width * scale, doc.height * scale);
  }
  for (const l of doc.layers) {
    if (!l.visible) continue;
    const src = layerSource(l, scale, live, ns);
    if (!src) continue;
    ctx.save();
    ctx.globalAlpha = l.opacity;
    ctx.globalCompositeOperation = (l.blend === 'normal' ? 'source-over' : l.blend) as GlobalCompositeOperation;
    ctx.translate(l.x * scale, l.y * scale);
    ctx.rotate((l.rotation * Math.PI) / 180);
    ctx.scale(l.flipX ? -1 : 1, l.flipY ? -1 : 1);
    if (l.fx.shadow > 0) {
      ctx.shadowColor = 'rgba(0,0,0,0.55)';
      ctx.shadowBlur = l.fx.shadow * scale;
      ctx.shadowOffsetY = l.fx.shadow * 0.4 * scale;
    }
    ctx.drawImage(src, (-l.w * scale) / 2, (-l.h * scale) / 2, l.w * scale, l.h * scale);
    ctx.restore();
  }
  ctx.restore();
  const ids = new Set(doc.layers.map((x) => `${ns}:${x.id}`));
  for (const k of cache.keys()) if (k.startsWith(ns + ':') && !ids.has(k)) cache.delete(k);
}

export function clearRenderCache(ns?: string): void {
  for (const k of cache.keys()) if (!ns || k.startsWith(ns + ':')) cache.delete(k);
}
