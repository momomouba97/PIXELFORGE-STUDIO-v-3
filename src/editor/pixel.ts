import type { Adjustments, FilterName } from './types';

export interface PixelBuf { data: Uint8ClampedArray; width: number; height: number }

const clamp = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);

/** Per-pixel tonal / colour adjustments. All sliders are in -100..100 and 0 is neutral. */
export function applyAdjustments(img: PixelBuf, a: Adjustments): void {
  const d = img.data;
  const exp = Math.pow(2, a.exposure / 50);
  const br = a.brightness * 1.5;
  const cAmt = clamp(a.contrast, -99, 99) * 2.55;
  const cf = (259 * (cAmt + 255)) / (255 * (259 - cAmt));
  const invGamma = 1 / Math.pow(2, a.gamma / 50);
  const sat = 1 + a.saturation / 100;
  const vib = a.vibrance / 100;
  const tr = a.temperature * 0.6;
  const tg = -a.tint * 0.5;
  const sh = a.shadows / 100, hl = a.highlights / 100, wh = a.whites / 100, bk = a.blacks / 100;
  const doTone = sh !== 0 || hl !== 0 || wh !== 0 || bk !== 0;
  const hueOn = a.hue !== 0;
  const h = (a.hue * Math.PI) / 180, c = Math.cos(h), s = Math.sin(h);
  const m0 = 0.213 + c * 0.787 - s * 0.213, m1 = 0.715 - c * 0.715 - s * 0.715, m2 = 0.072 - c * 0.072 + s * 0.928;
  const m3 = 0.213 - c * 0.213 + s * 0.143, m4 = 0.715 + c * 0.285 + s * 0.14, m5 = 0.072 - c * 0.072 - s * 0.283;
  const m6 = 0.213 - c * 0.213 - s * 0.787, m7 = 0.715 - c * 0.715 + s * 0.715, m8 = 0.072 + c * 0.928 + s * 0.072;
  const hasSat = a.saturation !== 0 || a.vibrance !== 0;

  for (let i = 0; i < d.length; i += 4) {
    let r = d[i], g = d[i + 1], b = d[i + 2];
    if (hueOn) {
      const nr = m0 * r + m1 * g + m2 * b;
      const ng = m3 * r + m4 * g + m5 * b;
      const nb = m6 * r + m7 * g + m8 * b;
      r = nr; g = ng; b = nb;
    }
    r = r * exp + br; g = g * exp + br; b = b * exp + br;
    r += tr; b -= tr; g += tg;
    if (doTone) {
      const l = clamp((0.2126 * r + 0.7152 * g + 0.0722 * b) / 255, 0, 1);
      const il = 1 - l;
      const delta = sh * 60 * il * il + hl * 60 * l * l + wh * 40 * l * l * l * l + bk * 40 * il * il * il * il;
      r += delta; g += delta; b += delta;
    }
    if (a.contrast !== 0) {
      r = cf * (r - 128) + 128; g = cf * (g - 128) + 128; b = cf * (b - 128) + 128;
    }
    if (a.gamma !== 0) {
      r = 255 * Math.pow(clamp(r, 0, 255) / 255, invGamma);
      g = 255 * Math.pow(clamp(g, 0, 255) / 255, invGamma);
      b = 255 * Math.pow(clamp(b, 0, 255) / 255, invGamma);
    }
    if (hasSat) {
      const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      let k = sat;
      if (vib !== 0) {
        const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
        const cs = mx > 0 ? (mx - mn) / mx : 0;
        k += vib * (1 - clamp(cs, 0, 1));
      }
      r = gray + (r - gray) * k; g = gray + (g - gray) * k; b = gray + (b - gray) * k;
    }
    d[i] = r; d[i + 1] = g; d[i + 2] = b; // Uint8ClampedArray clamps
  }
}

export type ToneMode = 'gray' | 'sepia' | 'duotone';

/** Filter presets: slider offsets (scaled by strength) plus an optional tone-mapping mode. */
export const FILTERS: Record<FilterName, { adj: Partial<Adjustments>; tone?: ToneMode }> = {
  vintage: { adj: { temperature: 20, saturation: -20, contrast: -10, blacks: 15 } },
  cinematic: { adj: { contrast: 20, saturation: -10, temperature: -10, shadows: 10, tint: 6 } },
  bw: { adj: { contrast: 10 }, tone: 'gray' },
  sepia: { adj: {}, tone: 'sepia' },
  hdr: { adj: { clarity: 60, contrast: 20, saturation: 20, shadows: 30, highlights: -30 } },
  warm: { adj: { temperature: 35 } },
  cool: { adj: { temperature: -35 } },
  retro: { adj: { temperature: 15, saturation: -30, contrast: 15, blacks: 20 } },
  dramatic: { adj: { contrast: 40, saturation: -20, shadows: -20, clarity: 30 } },
  film: { adj: { contrast: 10, saturation: -10, temperature: 8, blacks: 10 } },
  fade: { adj: { contrast: -20, blacks: 25, saturation: -15 } },
  matte: { adj: { contrast: -15, blacks: 30, highlights: -10 } },
  duotone: { adj: { contrast: 10 }, tone: 'duotone' },
};

export function effectiveAdj(adj: Adjustments, filter: { name: FilterName | null; strength: number }): Adjustments {
  if (!filter.name) return adj;
  const k = filter.strength / 100;
  const out = { ...adj };
  const preset = FILTERS[filter.name].adj;
  (Object.keys(preset) as (keyof Adjustments)[]).forEach((key) => {
    out[key] = clamp(out[key] + (preset[key] ?? 0) * k, -100, 100);
  });
  return out;
}

export function applyTone(img: PixelBuf, mode: ToneMode, strength: number): void {
  const k = clamp(strength, 0, 100) / 100;
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    let nr: number, ng: number, nb: number;
    if (mode === 'gray') {
      nr = ng = nb = lum;
    } else if (mode === 'sepia') {
      nr = 0.393 * r + 0.769 * g + 0.189 * b;
      ng = 0.349 * r + 0.686 * g + 0.168 * b;
      nb = 0.272 * r + 0.534 * g + 0.131 * b;
    } else {
      const t = lum / 255; // dark #1b1b3a -> light #ffb36b
      nr = 27 + (255 - 27) * t; ng = 27 + (179 - 27) * t; nb = 58 + (107 - 58) * t;
    }
    d[i] = r + (nr - r) * k; d[i + 1] = g + (ng - g) * k; d[i + 2] = b + (nb - b) * k;
  }
}

/** 3x3 median filter blended by `amount` (0..1) - real noise reduction. */
export function median3(img: PixelBuf, amount: number): void {
  if (amount <= 0) return;
  const { width: w, height: h } = img;
  const d = img.data;
  const src = new Uint8ClampedArray(d);
  const win = new Array<number>(9);
  const cmp = (p: number, q: number): number => p - q;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      for (let c = 0; c < 3; c++) {
        let n = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) win[n++] = src[((y + dy) * w + x + dx) * 4 + c];
        win.sort(cmp);
        const i = (y * w + x) * 4 + c;
        d[i] = src[i] + (win[4] - src[i]) * amount;
      }
    }
  }
}

/** Horizontal channel shift (chromatic aberration). */
export function applyChromatic(img: PixelBuf, shift: number): void {
  const s = Math.round(shift);
  if (s === 0) return;
  const { width: w, height: h } = img;
  const d = img.data;
  const src = new Uint8ClampedArray(d);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const xr = clamp(x - s, 0, w - 1), xb = clamp(x + s, 0, w - 1);
      d[i] = src[(y * w + xr) * 4];
      d[i + 2] = src[(y * w + xb) * 4 + 2];
    }
  }
}

/** Deterministic film grain (stable between redraws). */
export function applyGrain(img: PixelBuf, amount: number): void {
  if (amount <= 0) return;
  const d = img.data;
  const k = amount * 0.9;
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    let n = Math.imul(p + 1, 1103515245) + 12345;
    n ^= n >>> 15;
    const v = ((n >>> 0) % 256) / 255 - 0.5;
    d[i] += v * k; d[i + 1] += v * k; d[i + 2] += v * k;
  }
}

/** Classical auto-enhance: derives slider values from the luminance histogram (no ML model). */
export function autoEnhance(img: PixelBuf): Partial<Adjustments> {
  const d = img.data;
  const hist = new Uint32Array(256);
  let n = 0, sum = 0;
  for (let i = 0; i < d.length; i += 16) {
    if (d[i + 3] < 8) continue;
    const l = Math.round(0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]);
    hist[l]++; n++; sum += l;
  }
  if (n === 0) return {};
  const mean = sum / n / 255;
  const pct = (p: number): number => {
    let acc = 0;
    for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc >= n * p) return v / 255; }
    return 1;
  };
  const spread = pct(0.98) - pct(0.02);
  return {
    exposure: Math.round(clamp((0.45 - mean) * 100, -30, 30)),
    contrast: Math.round(clamp((0.85 - spread) * 80, 0, 35)),
    vibrance: 15,
    sharpness: 15,
  };
}
