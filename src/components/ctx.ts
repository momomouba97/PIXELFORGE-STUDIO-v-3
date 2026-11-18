import { createContext, useContext } from 'react';
import type { EditorStore } from '../editor/store';
import type { Doc, Layer } from '../editor/types';

export type ToolId =
  | 'arrange' | 'crop' | 'adjust' | 'filters' | 'effects' | 'retouch' | 'ai' | 'text' | 'draw'
  | 'shapes' | 'stickers' | 'frames' | 'templates';

export interface Brush { mode: 'brush' | 'pen' | 'eraser'; color: string; size: number; opacity: number }
export interface Rect { x: number; y: number; w: number; h: number }

export interface AppCtx {
  store: EditorStore;
  doc: Doc;
  layer: Layer | undefined;
  t: (s: string) => string;
  tool: ToolId;
  setTool: (t: ToolId) => void;
  brush: Brush;
  setBrush: (b: Brush) => void;
  crop: Rect | null;
  setCrop: (r: Rect | null) => void;
  importFiles: (files: File[]) => Promise<void>;
  newProject: (w: number, h: number, bg: string | null) => void;
  toast: (m: string) => void;
  fonts: string[];
  addFont: (name: string) => void;
}

export const AppContext = createContext<AppCtx>(null as unknown as AppCtx);
export const useApp = (): AppCtx => useContext(AppContext);
