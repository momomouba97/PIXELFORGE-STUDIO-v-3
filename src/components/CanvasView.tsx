import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { aabb, corners, fromOffset, hitTest, rotateHandle, type Pt } from '../editor/geometry';
import { measureText } from '../editor/actions';
import { renderDoc, type Live } from '../editor/render';
import { uid, type Layer } from '../editor/types';
import { makeDrawLayer } from '../editor/actions';
import { useApp } from './ctx';

export interface View { zoom: number; x: number; y: number }

type Drag =
  | { type: 'pan'; sx: number; sy: number; vx: number; vy: number }
  | { type: 'move'; id: string; start: Pt; ox: number; oy: number; moved: boolean }
  | { type: 'resize'; id: string; c: Pt; d0: number; w: number; h: number; size: number; moved: boolean }
  | { type: 'rotate'; id: string; c: Pt; moved: boolean }
  | { type: 'draw'; layerId: string };

const RULER = 18;

export function CanvasView(p: { view: View; setView: (v: View) => void; fitTick: number }) {
  const { store, tool, brush, crop, doc: _d } = useApp();
  useSyncExternalStore(store.subscribe, store.getSnapshot);
  const doc = store.doc;
  const { view, setView } = p;
  const wrap = useRef<HTMLDivElement>(null);
  const cv = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const drag = useRef<Drag | null>(null);
  const live = useRef<Live | null>(null);
  const guides = useRef<{ x: number[]; y: number[] }>({ x: [], y: [] });
  const space = useRef(false);
  const [, force] = useState(0);
  const viewRef = useRef(view);
  viewRef.current = view;

  useEffect(() => {
    const el = wrap.current!;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // fit on request / when document dimensions change
  useEffect(() => {
    const z = Math.min((size.w - RULER - 80) / doc.width, (size.h - RULER - 80) / doc.height, 4);
    const zoom = Math.max(0.02, z);
    setView({ zoom, x: RULER + (size.w - RULER - doc.width * zoom) / 2, y: RULER + (size.h - RULER - doc.height * zoom) / 2 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.fitTick, doc.width, doc.height, size.w, size.h]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => { if (e.code === 'Space' && !/INPUT|TEXTAREA|SELECT/.test((e.target as HTMLElement).tagName)) { space.current = true; e.preventDefault(); } };
    const up = (e: KeyboardEvent) => { if (e.code === 'Space') space.current = false; };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  // wheel: pinch / ctrl = zoom around cursor, otherwise pan
  useEffect(() => {
    const el = cv.current!;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const v = viewRef.current;
      if (e.ctrlKey || e.metaKey) {
        const r = el.getBoundingClientRect();
        const mx = e.clientX - r.left, my = e.clientY - r.top;
        const nz = Math.min(16, Math.max(0.02, v.zoom * Math.exp(-e.deltaY * 0.01)));
        const k = nz / v.zoom;
        setView({ zoom: nz, x: mx - (mx - v.x) * k, y: my - (my - v.y) * k });
      } else {
        setView({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY });
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [setView]);

  const sel: Layer | undefined = doc.layers.find((l) => l.id === doc.selectedId);

  // ---- drawing ----
  useEffect(() => {
    const c = cv.current!;
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.round(size.w * dpr);
    c.height = Math.round(size.h * dpr);
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#0b0c10';
    ctx.fillRect(0, 0, c.width, c.height);
    const z = view.zoom;

    ctx.save();
    ctx.translate(view.x * dpr, view.y * dpr);
    const W = doc.width * z * dpr, H = doc.height * z * dpr;
    ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 24 * dpr;
    ctx.fillStyle = '#1f2127'; ctx.fillRect(0, 0, W, H);
    ctx.shadowColor = 'transparent';
    const cell = 8 * dpr;
    const pc = document.createElement('canvas');
    pc.width = pc.height = cell * 2;
    const pctx = pc.getContext('2d')!;
    pctx.fillStyle = '#2b2e36'; pctx.fillRect(0, 0, cell * 2, cell * 2);
    pctx.fillStyle = '#1f2127'; pctx.fillRect(0, 0, cell, cell); pctx.fillRect(cell, cell, cell, cell);
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
    ctx.fillStyle = ctx.createPattern(pc, 'repeat')!;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
    renderDoc(ctx, doc, z * dpr, { live: live.current, ns: 'view' });
    ctx.restore();

    // overlays in CSS pixels
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const S = (q: Pt): Pt => ({ x: view.x + q.x * z, y: view.y + q.y * z });

    if (tool === 'crop' && crop) {
      const a = S({ x: crop.x, y: crop.y }), b = S({ x: crop.x + crop.w, y: crop.y + crop.h });
      ctx.fillStyle = 'rgba(0,0,0,.55)';
      ctx.fillRect(view.x, view.y, doc.width * z, a.y - view.y);
      ctx.fillRect(view.x, b.y, doc.width * z, view.y + doc.height * z - b.y);
      ctx.fillRect(view.x, a.y, a.x - view.x, b.y - a.y);
      ctx.fillRect(b.x, a.y, view.x + doc.width * z - b.x, b.y - a.y);
      ctx.strokeStyle = '#ff6a3d'; ctx.lineWidth = 2;
      ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);
    }

    if (sel && !sel.locked && tool !== 'draw' && tool !== 'crop') {
      const cs = corners(sel).map(S);
      ctx.strokeStyle = '#ff6a3d'; ctx.lineWidth = 1.5;
      ctx.beginPath();
      cs.forEach((q, i) => (i === 0 ? ctx.moveTo(q.x, q.y) : ctx.lineTo(q.x, q.y)));
      ctx.closePath(); ctx.stroke();
      if (sel.kind !== 'draw') {
        ctx.fillStyle = '#fff';
        cs.forEach((q) => { ctx.fillRect(q.x - 4, q.y - 4, 8, 8); ctx.strokeRect(q.x - 4, q.y - 4, 8, 8); });
        const rh = S(rotateHandle(sel, z)), top = S(fromOffset(sel, 0, -sel.h / 2));
        ctx.beginPath(); ctx.moveTo(top.x, top.y); ctx.lineTo(rh.x, rh.y); ctx.stroke();
        ctx.beginPath(); ctx.arc(rh.x, rh.y, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
    }

    ctx.strokeStyle = '#ff3d9a'; ctx.lineWidth = 1;
    guides.current.x.forEach((gx) => { const a = S({ x: gx, y: 0 }); ctx.beginPath(); ctx.moveTo(a.x, view.y); ctx.lineTo(a.x, view.y + doc.height * z); ctx.stroke(); });
    guides.current.y.forEach((gy) => { const a = S({ x: 0, y: gy }); ctx.beginPath(); ctx.moveTo(view.x, a.y); ctx.lineTo(view.x + doc.width * z, a.y); ctx.stroke(); });

    // rulers
    ctx.fillStyle = '#15171c';
    ctx.fillRect(0, 0, size.w, RULER); ctx.fillRect(0, 0, RULER, size.h);
    ctx.fillStyle = '#8a90a0'; ctx.strokeStyle = '#3a3f4b'; ctx.font = '9px sans-serif'; ctx.textBaseline = 'top';
    const raw = 60 / z, mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
    for (let v = 0; v <= doc.width; v += step) {
      const sx = view.x + v * z; if (sx < RULER || sx > size.w) continue;
      ctx.beginPath(); ctx.moveTo(sx, RULER - 6); ctx.lineTo(sx, RULER); ctx.stroke(); ctx.fillText(String(Math.round(v)), sx + 2, 2);
    }
    for (let v = 0; v <= doc.height; v += step) {
      const sy = view.y + v * z; if (sy < RULER || sy > size.h) continue;
      ctx.beginPath(); ctx.moveTo(RULER - 6, sy); ctx.lineTo(RULER, sy); ctx.stroke();
      ctx.save(); ctx.translate(2, sy + 2); ctx.rotate(Math.PI / 2); ctx.fillText(String(Math.round(v)), 0, -12); ctx.restore();
    }
  });

  const toDoc = (e: React.PointerEvent): Pt => {
    const r = cv.current!.getBoundingClientRect();
    return { x: (e.clientX - r.left - view.x) / view.zoom, y: (e.clientY - r.top - view.y) / view.zoom };
  };
  const toScreen = (q: Pt): Pt => ({ x: view.x + q.x * view.zoom, y: view.y + q.y * view.zoom });
  const dist = (a: Pt, b: Pt): number => Math.hypot(a.x - b.x, a.y - b.y);

  const onDown = (e: React.PointerEvent) => {
    cv.current!.setPointerCapture(e.pointerId);
    if (e.button === 1 || space.current) {
      drag.current = { type: 'pan', sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y };
      return;
    }
    const pt = toDoc(e);
    if (tool === 'crop') return;
    if (tool === 'draw') {
      let target: Layer | undefined = sel && sel.kind === 'draw' && !sel.locked ? sel : undefined;
      let id = target?.id;
      if (!target) {
        const nl = makeDrawLayer(doc);
        store.mutate('Add drawing layer', (d) => { d.layers.push(nl); d.selectedId = nl.id; });
        id = nl.id;
        target = store.doc.layers.find((l) => l.id === id);
      }
      if (!target || !id) return;
      const q = localOf(target, pt);
      live.current = { layerId: id, stroke: { mode: brush.mode, color: brush.color, size: brush.size, opacity: brush.opacity, points: [[q.x, q.y]] } };
      drag.current = { type: 'draw', layerId: id };
      force((n) => n + 1);
      return;
    }
    if (sel && !sel.locked) {
      const sp = { x: e.clientX - cv.current!.getBoundingClientRect().left, y: e.clientY - cv.current!.getBoundingClientRect().top };
      if (sel.kind !== 'draw') {
        if (dist(toScreen(rotateHandle(sel, view.zoom)), sp) < 10) {
          store.begin();
          drag.current = { type: 'rotate', id: sel.id, c: { x: sel.x, y: sel.y }, moved: false };
          return;
        }
        if (corners(sel).some((q) => dist(toScreen(q), sp) < 10)) {
          store.begin();
          drag.current = { type: 'resize', id: sel.id, c: { x: sel.x, y: sel.y }, d0: Math.max(1, dist(pt, { x: sel.x, y: sel.y })), w: sel.w, h: sel.h, size: sel.kind === 'text' ? sel.size : 0, moved: false };
          return;
        }
      }
    }
    const hit = hitTest(doc, pt);
    if (hit) {
      store.select(hit.id);
      store.begin();
      drag.current = { type: 'move', id: hit.id, start: pt, ox: hit.x, oy: hit.y, moved: false };
    } else {
      store.select(null);
    }
  };

  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    if (d.type === 'pan') { setView({ ...view, x: d.vx + e.clientX - d.sx, y: d.vy + e.clientY - d.sy }); return; }
    const pt = toDoc(e);
    if (d.type === 'draw') {
      const l = store.doc.layers.find((x) => x.id === d.layerId);
      if (l && live.current) { const q = localOf(l, pt); live.current.stroke.points.push([q.x, q.y]); force((n) => n + 1); }
    } else if (d.type === 'move') {
      d.moved = true;
      const thr = 6 / view.zoom;
      store.live((doc2) => {
        const l = doc2.layers.find((x) => x.id === d.id);
        if (!l) return;
        l.x = d.ox + pt.x - d.start.x; l.y = d.oy + pt.y - d.start.y;
        guides.current = { x: [], y: [] };
        const b = aabb(l);
        if (Math.abs(l.x - doc2.width / 2) < thr) { l.x = doc2.width / 2; guides.current.x.push(doc2.width / 2); }
        if (Math.abs(l.y - doc2.height / 2) < thr) { l.y = doc2.height / 2; guides.current.y.push(doc2.height / 2); }
        if (Math.abs(b.minX) < thr) { l.x -= b.minX; guides.current.x.push(0); }
        if (Math.abs(b.maxX - doc2.width) < thr) { l.x -= b.maxX - doc2.width; guides.current.x.push(doc2.width); }
        if (Math.abs(b.minY) < thr) { l.y -= b.minY; guides.current.y.push(0); }
        if (Math.abs(b.maxY - doc2.height) < thr) { l.y -= b.maxY - doc2.height; guides.current.y.push(doc2.height); }
      });
    } else if (d.type === 'resize') {
      d.moved = true;
      const k = Math.max(0.02, dist(pt, d.c) / d.d0);
      store.live((doc2) => {
        const l = doc2.layers.find((x) => x.id === d.id);
        if (!l) return;
        if (l.kind === 'text') {
          l.size = Math.max(4, d.size * k);
          const m = measureText(l); l.w = m.w; l.h = m.h;
        } else { l.w = Math.max(2, d.w * k); l.h = Math.max(2, d.h * k); }
      });
    } else if (d.type === 'rotate') {
      d.moved = true;
      let deg = (Math.atan2(pt.y - d.c.y, pt.x - d.c.x) * 180) / Math.PI + 90;
      if (e.shiftKey) deg = Math.round(deg / 15) * 15;
      store.live((doc2) => { const l = doc2.layers.find((x) => x.id === d.id); if (l) l.rotation = ((deg % 360) + 360) % 360; });
    }
  };

  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    guides.current = { x: [], y: [] };
    if (!d) return;
    if (d.type === 'draw') {
      const s = live.current;
      live.current = null;
      if (s) {
        const stroke = s.stroke;
        store.mutate(brush.mode === 'eraser' ? 'Erase' : 'Brush stroke', (doc2) => {
          const l = doc2.layers.find((x) => x.id === d.layerId);
          if (l && l.kind === 'draw') { l.strokes.push(stroke); l.rev = uid(); }
        });
      }
    } else if (d.type === 'move' || d.type === 'resize' || d.type === 'rotate') {
      if (d.moved) store.end(d.type === 'move' ? 'Move layer' : d.type === 'resize' ? 'Resize layer' : 'Rotate layer');
    }
    force((n) => n + 1);
  };

  const cursor = tool === 'draw' ? 'crosshair' : space.current ? 'grab' : 'default';
  return (
    <div ref={wrap} className="relative w-full h-full overflow-hidden">
      <canvas
        ref={cv}
        style={{ width: size.w, height: size.h, cursor }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      />
    </div>
  );
}

function localOf(l: Layer, p: Pt): Pt {
  const a = -(l.rotation * Math.PI) / 180;
  const dx = p.x - l.x, dy = p.y - l.y;
  const rx = dx * Math.cos(a) - dy * Math.sin(a), ry = dx * Math.sin(a) + dy * Math.cos(a);
  return { x: (l.flipX ? -rx : rx) + l.w / 2, y: (l.flipY ? -ry : ry) + l.h / 2 };
}
