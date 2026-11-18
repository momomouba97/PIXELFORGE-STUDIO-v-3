import { useEffect, useRef } from 'react';
import {
  addLayer, align, cropDoc, makeFrameLayer, makeImageLayer, makeShapeLayer, makeTextLayer,
  rotateDoc90, updateLayer, updateText,
} from '../editor/actions';
import { sniff, loadImageFile } from '../editor/assets';
import { autoEnhance } from '../editor/pixel';
import { getAsset } from '../editor/assets';
import {
  ADJ_SLIDERS, defaultAdj, FILTER_NAMES, SIZE_PRESETS,
  type Adjustments, type Effects, type ShapeKind,
} from '../editor/types';
import { AI_TOOLS } from '../ai/registry';
import { useApp } from './ctx';
import { Btn, Field, inputCls, NumberInput, Section, Slider } from './ui';

const EMOJI = ['⭐', '❤️', '🔥', '✨', '🎉', '😀', '😎', '👍', '🌈', '🌟', '💡', '🎵', '🏆', '📷', '🌸', '☀️', '🌙', '⚡', '🍕', '🚀', '🎯', '💎', '🦋', '🔔'];
const ASPECTS: { label: string; r: number | null }[] = [
  { label: 'Free', r: null }, { label: '1:1', r: 1 }, { label: '4:3', r: 4 / 3 }, { label: '3:2', r: 3 / 2 },
  { label: '16:9', r: 16 / 9 }, { label: '9:16', r: 9 / 16 }, { label: '4:5', r: 4 / 5 },
];
const BASE_FONTS = ['Helvetica Neue', 'Arial', 'Georgia', 'Impact', 'Courier New', 'Geeza Pro', 'Damascus', 'Al Bayan', 'Baghdad', 'Times New Roman'];

function NeedLayer() {
  const { t } = useApp();
  return <div className="text-mute text-[12px]">{t('Select a layer first')}</div>;
}

export default function ToolPanel() {
  const a = useApp();
  const { store, doc, layer, tool, t } = a;
  const fileRef = useRef<HTMLInputElement>(null);
  const fontRef = useRef<HTMLInputElement>(null);

  // initialise crop rect when entering the crop tool
  useEffect(() => {
    if (tool === 'crop') a.setCrop({ x: 0, y: 0, w: doc.width, h: doc.height });
    else a.setCrop(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool, doc.width, doc.height]);

  const upd = (label: string, fn: Parameters<typeof updateLayer>[3], key?: string) => {
    if (layer) updateLayer(store, layer.id, label, fn, key);
  };

  // ---------- ARRANGE ----------
  if (tool === 'arrange') {
    if (!layer) return <NeedLayer />;
    const ratio = layer.w / layer.h;
    return (
      <div>
        <Section title="Arrange">
          <Field label="X"><NumberInput value={layer.x} onChange={(v) => upd('Position', (l) => { l.x = v; }, `x${layer.id}`)} /></Field>
          <Field label="Y"><NumberInput value={layer.y} onChange={(v) => upd('Position', (l) => { l.y = v; }, `y${layer.id}`)} /></Field>
          {layer.kind !== 'text' && layer.kind !== 'draw' && (
            <>
              <Field label="Width"><NumberInput min={2} value={layer.w} onChange={(v) => upd('Resize', (l) => { l.w = Math.max(2, v); if (lockRef.on) l.h = l.w / ratio; }, `w${layer.id}`)} /></Field>
              <Field label="Height"><NumberInput min={2} value={layer.h} onChange={(v) => upd('Resize', (l) => { l.h = Math.max(2, v); if (lockRef.on) l.w = l.h * ratio; }, `h${layer.id}`)} /></Field>
              <Field label="Lock aspect ratio"><input type="checkbox" defaultChecked onChange={(e) => { lockRef.on = e.target.checked; }} /></Field>
            </>
          )}
          <Slider label="Rotation" min={-180} max={180} value={layer.rotation > 180 ? layer.rotation - 360 : layer.rotation} onChange={(v) => upd('Rotate', (l) => { l.rotation = (v + 360) % 360; }, `r${layer.id}`)} />
          <div className="flex gap-2 mb-3">
            <Btn onClick={() => upd('Flip horizontal', (l) => { l.flipX = !l.flipX; })}>{t('Flip horizontal')}</Btn>
            <Btn onClick={() => upd('Flip vertical', (l) => { l.flipY = !l.flipY; })}>{t('Flip vertical')}</Btn>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {(['left', 'hcenter', 'right', 'top', 'vcenter', 'bottom'] as const).map((w, i) => (
              <Btn key={w} onClick={() => align(store, layer.id, w)}>{t(['Left', 'Center', 'Right', 'Top', 'Middle', 'Bottom'][i])}</Btn>
            ))}
          </div>
        </Section>
      </div>
    );
  }

  // ---------- CROP ----------
  if (tool === 'crop') {
    const c = a.crop ?? { x: 0, y: 0, w: doc.width, h: doc.height };
    const setAspect = (r: number | null) => {
      if (r === null) return;
      let w = doc.width, h = w / r;
      if (h > doc.height) { h = doc.height; w = h * r; }
      a.setCrop({ x: (doc.width - w) / 2, y: (doc.height - h) / 2, w, h });
    };
    return (
      <div>
        <Section title="Crop">
          <div className="grid grid-cols-4 gap-1.5 mb-3">
            {ASPECTS.map((x) => <Btn key={x.label} onClick={() => (x.r === null ? a.setCrop({ x: 0, y: 0, w: doc.width, h: doc.height }) : setAspect(x.r))}>{t(x.label)}</Btn>)}
          </div>
          <Field label="X"><NumberInput value={c.x} min={0} onChange={(v) => a.setCrop({ ...c, x: Math.min(Math.max(0, v), doc.width - 1), w: Math.min(c.w, doc.width - Math.max(0, v)) })} /></Field>
          <Field label="Y"><NumberInput value={c.y} min={0} onChange={(v) => a.setCrop({ ...c, y: Math.min(Math.max(0, v), doc.height - 1), h: Math.min(c.h, doc.height - Math.max(0, v)) })} /></Field>
          <Field label="Width"><NumberInput value={c.w} min={1} onChange={(v) => a.setCrop({ ...c, w: Math.max(1, Math.min(v, doc.width - c.x)) })} /></Field>
          <Field label="Height"><NumberInput value={c.h} min={1} onChange={(v) => a.setCrop({ ...c, h: Math.max(1, Math.min(v, doc.height - c.y)) })} /></Field>
          <div className="flex gap-2">
            <Btn primary onClick={() => { cropDoc(store, c); a.setCrop(null); }}>{t('Apply crop')}</Btn>
            <Btn onClick={() => rotateDoc90(store)}>{t('Rotate canvas 90°')}</Btn>
          </div>
        </Section>
        {layer && (
          <Section title="Rotation">
            <Slider label="Rotation" min={-45} max={45} step={0.5} value={layer.rotation > 180 ? layer.rotation - 360 : layer.rotation} onChange={(v) => upd('Straighten', (l) => { l.rotation = (v + 360) % 360; }, `r${layer.id}`)} />
          </Section>
        )}
      </div>
    );
  }

  // ---------- ADJUST ----------
  if (tool === 'adjust') {
    if (!layer) return <NeedLayer />;
    return (
      <Section title="Adjust">
        {ADJ_SLIDERS.map((k) => (
          <Slider key={k} label={k[0].toUpperCase() + k.slice(1)} value={layer.adj[k]} onChange={(v) => upd(`Adjust ${k}`, (l) => { l.adj[k] = v; }, `adj${layer.id}${k}`)} />
        ))}
        <Btn onClick={() => upd('Reset adjustments', (l) => { l.adj = { ...defaultAdj(), smooth: l.adj.smooth, denoise: l.adj.denoise }; })}>{t('Reset')}</Btn>
      </Section>
    );
  }

  // ---------- FILTERS ----------
  if (tool === 'filters') {
    if (!layer) return <NeedLayer />;
    return (
      <Section title="Filters">
        <div className="grid grid-cols-3 gap-1.5 mb-3">
          <Btn active={!layer.filter.name} onClick={() => upd('Remove filter', (l) => { l.filter.name = null; })}>{t('None')}</Btn>
          {FILTER_NAMES.map((n) => (
            <Btn key={n} active={layer.filter.name === n} onClick={() => upd(`Filter ${n}`, (l) => { l.filter.name = n; })}>{t(n)}</Btn>
          ))}
        </div>
        <Slider label="Strength" min={0} max={100} value={layer.filter.strength} onChange={(v) => upd('Filter strength', (l) => { l.filter.strength = v; }, `fs${layer.id}`)} />
      </Section>
    );
  }

  // ---------- EFFECTS ----------
  if (tool === 'effects') {
    if (!layer) return <NeedLayer />;
    const fxs: [keyof Effects, string, number][] = [
      ['blur', 'Blur', 40], ['vignette', 'Vignette', 100], ['grain', 'Film grain', 100],
      ['chromatic', 'Chromatic aberration', 20], ['glow', 'Glow', 100], ['shadow', 'Shadow', 60],
    ];
    return (
      <Section title="Effects">
        {fxs.map(([k, label, max]) => (
          <Slider key={k} label={label} min={0} max={max} value={layer.fx[k] as number} onChange={(v) => upd(`Effect ${k}`, (l) => { (l.fx as unknown as Record<string, number>)[k] = v; }, `fx${layer.id}${k}`)} />
        ))}
        <Field label="Color overlay"><input type="color" value={layer.fx.overlayColor} onChange={(e) => upd('Overlay color', (l) => { l.fx.overlayColor = e.target.value; }, `oc${layer.id}`)} /></Field>
        <Slider label="Amount" min={0} max={100} value={layer.fx.overlayAmount} onChange={(v) => upd('Overlay amount', (l) => { l.fx.overlayAmount = v; }, `oa${layer.id}`)} />
        <div className="text-mute text-[11px]">{t('Not implemented yet')}: Motion Blur, Background Blur, Glitch, Light Leak</div>
      </Section>
    );
  }

  // ---------- RETOUCH ----------
  if (tool === 'retouch') {
    if (!layer) return <NeedLayer />;
    const set = (k: keyof Adjustments, label: string) => (v: number) => upd(label, (l) => { l.adj[k] = v; }, `rt${layer.id}${k}`);
    return (
      <Section title="Retouch">
        <Slider label="Skin smoothing" min={0} max={100} value={layer.adj.smooth} onChange={set('smooth', 'Skin smoothing')} />
        <Slider label="Denoise" min={0} max={100} value={layer.adj.denoise} onChange={set('denoise', 'Denoise')} />
        <Slider label="Sharpness" min={0} max={100} value={layer.adj.sharpness} onChange={set('sharpness', 'Sharpness')} />
        <div className="text-mute text-[11px]">{t('Not implemented yet')}: blemish / spot removal, red-eye correction (need a region-selection tool)</div>
      </Section>
    );
  }

  // ---------- AI ----------
  if (tool === 'ai') {
    const runClassical = (id: string) => {
      if (!layer || layer.kind !== 'image') { a.toast(t('Select a layer first')); return; }
      if (id === 'denoise') { upd('AI: Denoise', (l) => { l.adj.denoise = 60; }); return; }
      const im = getAsset(layer.assetId);
      if (!im) return;
      const c = document.createElement('canvas');
      const k = Math.min(1, 512 / Math.max(im.naturalWidth, im.naturalHeight));
      c.width = Math.max(1, Math.round(im.naturalWidth * k)); c.height = Math.max(1, Math.round(im.naturalHeight * k));
      const ctx = c.getContext('2d', { willReadFrequently: true })!;
      ctx.drawImage(im, 0, 0, c.width, c.height);
      const patch = autoEnhance(ctx.getImageData(0, 0, c.width, c.height));
      upd('AI: Enhance', (l) => { Object.assign(l.adj, patch); });
    };
    return (
      <Section title="AI Tools">
        <div className="space-y-2">
          {AI_TOOLS.map((x) => (
            <div key={x.id} className="border border-line rounded-lg p-2 bg-bg2">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-medium">{t(x.name)}</span>
                {x.status === 'classical' ? (
                  <Btn primary onClick={() => runClassical(x.id)}>{t('Apply')}</Btn>
                ) : (
                  <Btn disabled title={x.note}>{t('Not implemented yet')}</Btn>
                )}
              </div>
              <div className="text-[11px] text-mute mt-1">
                {x.status === 'classical' ? t('Classical algorithm, no AI model') : t('Needs an AI model download (not bundled)')}
              </div>
              <div className="text-[11px] text-mute">{x.note}</div>
            </div>
          ))}
        </div>
      </Section>
    );
  }

  // ---------- TEXT ----------
  if (tool === 'text') {
    const tl = layer && layer.kind === 'text' ? layer : null;
    const fonts = [...BASE_FONTS, ...a.fonts];
    const up = (label: string, patch: Parameters<typeof updateText>[3], key?: string) => tl && updateText(store, tl.id, label, patch, key);
    return (
      <div>
        <Section title="Text">
          <div className="flex gap-2 mb-3">
            <Btn primary onClick={() => addLayer(store, makeTextLayer(doc, 'Text / نص'), 'Add text')}>{t('Add text')}</Btn>
            <Btn onClick={() => fontRef.current?.click()}>{t('Import font')}</Btn>
            <input ref={fontRef} type="file" accept=".ttf,.otf,.woff,.woff2" className="hidden" onChange={async (e) => {
              const f = e.target.files?.[0]; e.target.value = '';
              if (!f) return;
              try {
                const name = f.name.replace(/\.[^.]+$/, '');
                const face = new FontFace(name, await f.arrayBuffer());
                await face.load(); document.fonts.add(face); a.addFont(name);
              } catch { a.toast('Font could not be loaded'); }
            }} />
          </div>
          {tl ? (
            <>
              <textarea dir="auto" className={`${inputCls} w-full h-20 mb-2`} value={tl.text} onChange={(e) => up('Edit text', { text: e.target.value }, `tx${tl.id}`)} />
              <Field label="Font">
                <select className={`${inputCls} w-40`} value={tl.font.replace(/^"?([^",]+)"?.*$/, '$1')} onChange={(e) => up('Font', { font: `"${e.target.value}", "Geeza Pro", Arial, sans-serif` })}>
                  {fonts.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </Field>
              <Slider label="Size" min={6} max={600} value={tl.size} onChange={(v) => up('Font size', { size: v }, `ts${tl.id}`)} />
              <Slider label="Weight" min={100} max={900} step={100} value={tl.weight} onChange={(v) => up('Font weight', { weight: v }, `tw${tl.id}`)} />
              <Slider label="Letter spacing" min={-5} max={40} value={tl.letterSpacing} onChange={(v) => up('Letter spacing', { letterSpacing: v }, `tl${tl.id}`)} />
              <Slider label="Line height" min={0.8} max={3} step={0.05} value={tl.lineHeight} onChange={(v) => up('Line height', { lineHeight: v }, `th${tl.id}`)} />
              <Field label="Color"><input type="color" value={tl.color} onChange={(e) => up('Text color', { color: e.target.value }, `tc${tl.id}`)} /></Field>
              <Field label="Background"><input type="color" value={tl.bg === 'transparent' ? '#000000' : tl.bg} onChange={(e) => up('Text background', { bg: e.target.value }, `tb${tl.id}`)} /><Btn onClick={() => up('Text background', { bg: 'transparent' })}>{t('None')}</Btn></Field>
              <Field label="Outline"><input type="color" value={tl.stroke} onChange={(e) => up('Outline color', { stroke: e.target.value }, `to${tl.id}`)} /></Field>
              <Slider label="Outline width" min={0} max={30} value={tl.strokeWidth} onChange={(v) => up('Outline width', { strokeWidth: v }, `tow${tl.id}`)} />
              <div className="flex gap-1.5">
                {(['left', 'center', 'right'] as const).map((al, i) => <Btn key={al} active={tl.align === al} onClick={() => up('Text align', { align: al })}>{t(['Left', 'Center', 'Right'][i])}</Btn>)}
              </div>
              <div className="text-mute text-[11px] mt-2">{t('Not implemented yet')}: curved text</div>
            </>
          ) : <NeedLayer />}
        </Section>
      </div>
    );
  }

  // ---------- DRAW ----------
  if (tool === 'draw') {
    const b = a.brush;
    return (
      <Section title="Draw">
        <div className="flex gap-1.5 mb-3">
          {(['brush', 'pen', 'eraser'] as const).map((m) => (
            <Btn key={m} active={b.mode === m} onClick={() => a.setBrush({ ...b, mode: m, size: m === 'pen' ? 3 : m === 'eraser' ? 30 : 16 })}>{t(m[0].toUpperCase() + m.slice(1))}</Btn>
          ))}
        </div>
        <Field label="Color"><input type="color" value={b.color} onChange={(e) => a.setBrush({ ...b, color: e.target.value })} /></Field>
        <Slider label="Size" min={1} max={200} value={b.size} onChange={(v) => a.setBrush({ ...b, size: v })} />
        <Slider label="Opacity" min={0.05} max={1} step={0.05} value={b.opacity} onChange={(v) => a.setBrush({ ...b, opacity: v })} />
      </Section>
    );
  }

  // ---------- SHAPES ----------
  if (tool === 'shapes') {
    const sl = layer && layer.kind === 'shape' ? layer : null;
    const shapes: [ShapeKind, string][] = [['rect', 'Rectangle'], ['ellipse', 'Circle'], ['triangle', 'Triangle'], ['hexagon', 'Hexagon'], ['star', 'Star'], ['line', 'Line']];
    return (
      <Section title="Shapes">
        <div className="grid grid-cols-3 gap-1.5 mb-3">
          {shapes.map(([k, label]) => <Btn key={k} onClick={() => addLayer(store, makeShapeLayer(doc, k), `Add ${k}`)}>{t(label)}</Btn>)}
        </div>
        {sl && (
          <>
            <Field label="Fill"><input type="color" value={sl.fill === 'transparent' ? '#000000' : sl.fill} onChange={(e) => upd('Fill color', (l) => { if (l.kind === 'shape') l.fill = e.target.value; }, `sf${sl.id}`)} /><Btn onClick={() => upd('Fill none', (l) => { if (l.kind === 'shape') l.fill = 'transparent'; })}>{t('None')}</Btn></Field>
            <Field label="Stroke"><input type="color" value={sl.stroke} onChange={(e) => upd('Stroke color', (l) => { if (l.kind === 'shape') l.stroke = e.target.value; }, `ss${sl.id}`)} /></Field>
            <Slider label="Stroke width" min={0} max={80} value={sl.strokeWidth} onChange={(v) => upd('Stroke width', (l) => { if (l.kind === 'shape') l.strokeWidth = v; }, `sw${sl.id}`)} />
          </>
        )}
      </Section>
    );
  }

  // ---------- STICKERS ----------
  if (tool === 'stickers') {
    return (
      <Section title="Stickers">
        <div className="grid grid-cols-6 gap-1.5 mb-3">
          {EMOJI.map((e) => (
            <button key={e} className="text-2xl bg-bg2 border border-line rounded-md py-1 hover:bg-bg3" onClick={() => {
              const l = makeTextLayer(doc, e, Math.round(Math.min(doc.width, doc.height) / 5));
              l.name = 'Sticker'; l.font = '"Apple Color Emoji", sans-serif';
              addLayer(store, l, 'Add sticker');
            }}>{e}</button>
          ))}
        </div>
        <Btn onClick={() => fileRef.current?.click()}>{t('Import PNG')}</Btn>
        <input ref={fileRef} type="file" accept="image/png" className="hidden" onChange={async (e) => {
          const f = e.target.files?.[0]; e.target.value = '';
          if (!f) return;
          try {
            const bytes = new Uint8Array(await f.arrayBuffer());
            if (sniff(bytes) !== 'png') throw new Error('Not a PNG');
            const r = await loadImageFile(f);
            addLayer(store, makeImageLayer(doc, r.id, r.w, r.h, f.name), 'Add sticker');
          } catch (err) { a.toast((err as Error).message); }
        }} />
      </Section>
    );
  }

  // ---------- FRAMES ----------
  if (tool === 'frames') {
    const t0 = Math.round(Math.min(doc.width, doc.height) / 60);
    const presets: [string, string, number][] = [['Thin white', '#ffffff', t0], ['Thick white', '#ffffff', t0 * 4], ['Black frame', '#000000', t0 * 3], ['Accent frame', '#ff6a3d', t0 * 3]];
    return (
      <Section title="Frames">
        <div className="grid grid-cols-2 gap-1.5">
          {presets.map(([n, c, w]) => <Btn key={n} onClick={() => addLayer(store, makeFrameLayer(doc, c, w * 2), 'Add frame')}>{t(n)}</Btn>)}
        </div>
      </Section>
    );
  }

  // ---------- TEMPLATES ----------
  return (
    <Section title="Templates">
      <div className="text-mute text-[11px] mb-2">{t('Start a project with a size and background')}</div>
      <div className="space-y-1.5">
        {SIZE_PRESETS.map((s) => (
          <div key={s.name} className="flex items-center justify-between bg-bg2 border border-line rounded-md px-2 py-1.5">
            <span>{s.name} <span className="text-mute">{s.w}×{s.h}</span></span>
            <div className="flex gap-1">
              <Btn onClick={() => a.newProject(s.w, s.h, null)}>{t('Transparent')}</Btn>
              <Btn onClick={() => a.newProject(s.w, s.h, '#ffffff')}>{t('White')}</Btn>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

const lockRef = { on: true };
