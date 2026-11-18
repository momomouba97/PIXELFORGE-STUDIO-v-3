export type BlendMode =
  | 'normal' | 'multiply' | 'screen' | 'overlay' | 'darken' | 'lighten' | 'color-dodge' | 'color-burn'
  | 'hard-light' | 'soft-light' | 'difference' | 'exclusion' | 'hue' | 'saturation' | 'color' | 'luminosity';

export const BLEND_MODES: BlendMode[] = [
  'normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'color-burn',
  'hard-light', 'soft-light', 'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity',
];

export interface Adjustments {
  brightness: number; contrast: number; exposure: number; saturation: number; vibrance: number;
  temperature: number; tint: number; highlights: number; shadows: number; whites: number; blacks: number;
  gamma: number; sharpness: number; clarity: number; hue: number;
  smooth: number; denoise: number;
}

export const ADJ_SLIDERS: (keyof Adjustments)[] = [
  'brightness', 'contrast', 'exposure', 'saturation', 'vibrance', 'temperature', 'tint',
  'highlights', 'shadows', 'whites', 'blacks', 'gamma', 'sharpness', 'clarity', 'hue',
];

export const defaultAdj = (): Adjustments => ({
  brightness: 0, contrast: 0, exposure: 0, saturation: 0, vibrance: 0, temperature: 0, tint: 0,
  highlights: 0, shadows: 0, whites: 0, blacks: 0, gamma: 0, sharpness: 0, clarity: 0, hue: 0,
  smooth: 0, denoise: 0,
});

export type FilterName =
  | 'vintage' | 'cinematic' | 'bw' | 'sepia' | 'hdr' | 'warm' | 'cool' | 'retro' | 'dramatic'
  | 'film' | 'fade' | 'matte' | 'duotone';

export const FILTER_NAMES: FilterName[] = [
  'vintage', 'cinematic', 'bw', 'sepia', 'hdr', 'warm', 'cool', 'retro', 'dramatic', 'film', 'fade', 'matte', 'duotone',
];

export interface FilterState { name: FilterName | null; strength: number }

export interface Effects {
  blur: number; vignette: number; grain: number; chromatic: number; glow: number; shadow: number;
  overlayColor: string; overlayAmount: number;
}
export const defaultFx = (): Effects => ({
  blur: 0, vignette: 0, grain: 0, chromatic: 0, glow: 0, shadow: 0, overlayColor: '#ff6a3d', overlayAmount: 0,
});

export interface Stroke {
  mode: 'brush' | 'pen' | 'eraser';
  color: string; size: number; opacity: number;
  points: [number, number][];
}

interface Base {
  id: string; name: string; visible: boolean; locked: boolean; opacity: number; blend: BlendMode;
  x: number; y: number; w: number; h: number; rotation: number; flipX: boolean; flipY: boolean;
  adj: Adjustments; filter: FilterState; fx: Effects;
}
export interface ImageLayer extends Base { kind: 'image'; assetId: string }
export interface TextLayer extends Base {
  kind: 'text'; text: string; font: string; size: number; weight: number; color: string;
  align: 'left' | 'center' | 'right'; letterSpacing: number; lineHeight: number;
  stroke: string; strokeWidth: number; bg: string;
}
export type ShapeKind = 'rect' | 'ellipse' | 'triangle' | 'hexagon' | 'star' | 'line';
export interface ShapeLayer extends Base {
  kind: 'shape'; shape: ShapeKind; fill: string; stroke: string; strokeWidth: number;
}
export interface DrawLayer extends Base { kind: 'draw'; strokes: Stroke[]; rev: string }
export type Layer = ImageLayer | TextLayer | ShapeLayer | DrawLayer;

export interface Doc {
  width: number; height: number; background: string | null; layers: Layer[]; selectedId: string | null;
}

let counter = 0;
export const uid = (): string => `${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export const newDoc = (width: number, height: number, background: string | null = null): Doc => ({
  width, height, background, layers: [], selectedId: null,
});

export const SIZE_PRESETS: { name: string; w: number; h: number }[] = [
  { name: 'Instagram Square', w: 1080, h: 1080 },
  { name: 'Instagram Portrait', w: 1080, h: 1350 },
  { name: 'Instagram Story', w: 1080, h: 1920 },
  { name: 'YouTube Thumbnail', w: 1280, h: 720 },
  { name: 'YouTube Banner', w: 2560, h: 1440 },
  { name: 'Full HD', w: 1920, h: 1080 },
];
