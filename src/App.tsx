import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import {
  Brush, Crop, Download, FilePlus, FolderOpen, Frame, Image as ImageIcon, LayoutTemplate, Maximize, Move, Redo2,
  Save, Settings, Shapes, SlidersHorizontal, Smile, Sparkles, Sticker, Type, Undo2, ZoomIn, ZoomOut, Cpu,
} from 'lucide-react';
import { addLayer, makeImageLayer } from './editor/actions';
import { clearRenderCache } from './editor/render';
import { loadImageFile } from './editor/assets';
import { EditorStore } from './editor/store';
import { newDoc } from './editor/types';
import { loadPrefs, makeT, resolveDir, savePrefs, type DirPref, type Lang } from './i18n';
import { idbGet, idbPut, parseProject, serializeProject } from './storage/projects';
import { saveBytes } from './export/export';
import { AppContext, type AppCtx, type Brush as BrushT, type Rect, type ToolId } from './components/ctx';
import { CanvasView, type View } from './components/CanvasView';
import { ExportDialog, NewProjectDialog, SettingsDialog } from './components/Dialogs';
import { HistoryPanel, LayersPanel } from './components/LayersPanel';
import ToolPanel from './components/ToolPanel';

const TOOLS: { id: ToolId; label: string; icon: typeof Move }[] = [
  { id: 'arrange', label: 'Arrange', icon: Move }, { id: 'crop', label: 'Crop', icon: Crop },
  { id: 'adjust', label: 'Adjust', icon: SlidersHorizontal }, { id: 'filters', label: 'Filters', icon: ImageIcon },
  { id: 'effects', label: 'Effects', icon: Sparkles }, { id: 'retouch', label: 'Retouch', icon: Smile },
  { id: 'ai', label: 'AI Tools', icon: Cpu }, { id: 'text', label: 'Text', icon: Type },
  { id: 'draw', label: 'Draw', icon: Brush }, { id: 'shapes', label: 'Shapes', icon: Shapes },
  { id: 'stickers', label: 'Stickers', icon: Sticker }, { id: 'frames', label: 'Frames', icon: Frame },
  { id: 'templates', label: 'Templates', icon: LayoutTemplate },
];

export default function App() {
  const storeRef = useRef<EditorStore>();
  if (!storeRef.current) storeRef.current = new EditorStore(newDoc(1080, 1080, null));
  const store = storeRef.current;
  const version = useSyncExternalStore(store.subscribe, store.getSnapshot);

  const [prefs, setPrefs] = useState(loadPrefs);
  const lang: Lang = prefs.lang;
  const t = useMemo(() => makeT(lang), [lang]);
  const [tool, setTool] = useState<ToolId>('arrange');
  const [brush, setBrush] = useState<BrushT>({ mode: 'brush', color: '#ff6a3d', size: 16, opacity: 1 });
  const [crop, setCrop] = useState<Rect | null>(null);
  const [view, setView] = useState<View>({ zoom: 0.5, x: 40, y: 40 });
  const [fitTick, setFitTick] = useState(0);
  const [dialog, setDialog] = useState<null | 'new' | 'export' | 'settings'>(null);
  const [menu, setMenu] = useState(false);
  const [bottomTab, setBottomTab] = useState<'layers' | 'history'>('layers');
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [fonts, setFonts] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState(false);

  const doc = store.doc;
  const layer = doc.layers.find((l) => l.id === doc.selectedId);

  const toast = useCallback((m: string) => {
    setToastMsg(m);
    setTimeout(() => setToastMsg(null), 3500);
  }, []);

  // language + direction
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = resolveDir(lang, prefs.dir);
    savePrefs(lang, prefs.dir);
  }, [lang, prefs.dir]);

  const importFiles = useCallback(async (files: File[]) => {
    for (const f of files) {
      try {
        const r = await loadImageFile(f);
        const empty = store.doc.layers.length === 0;
        if (empty) {
          const k = Math.min(1, 4096 / Math.max(r.w, r.h));
          store.mutate('Set canvas size', (d) => { d.width = Math.round(r.w * k); d.height = Math.round(r.h * k); });
        }
        addLayer(store, makeImageLayer(store.doc, r.id, r.w, r.h, f.name), 'Import image');
        if (empty) setFitTick((n) => n + 1);
      } catch (e) {
        toast(`${f.name}: ${(e as Error).message}`);
      }
    }
  }, [store, toast]);

  const openImages = useCallback(async () => {
    if (window.pf) {
      const items = await window.pf.openImages();
      await importFiles(items.map((i) => new File([i.data as BlobPart], i.name)));
    } else {
      const inp = document.createElement('input');
      inp.type = 'file'; inp.multiple = true; inp.accept = '.jpg,.jpeg,.png,.webp,.bmp,.tif,.tiff';
      inp.onchange = () => void importFiles(Array.from(inp.files ?? []));
      inp.click();
    }
  }, [importFiles]);

  const newProject = useCallback((w: number, h: number, bg: string | null) => {
    if (store.doc.layers.length > 0 && !window.confirm('Discard the current project?')) return;
    clearRenderCache();
    store.reset(newDoc(w, h, bg));
    setFitTick((n) => n + 1);
  }, [store]);

  const saveProject = useCallback(async () => {
    const bytes = new TextEncoder().encode(serializeProject(store.doc));
    if (await saveBytes('project', 'pfs', bytes)) toast('Saved');
  }, [store, toast]);

  const openProject = useCallback(async () => {
    try {
      let text: string | null;
      if (window.pf) text = await window.pf.openProject();
      else {
        text = await new Promise<string | null>((res) => {
          const inp = document.createElement('input');
          inp.type = 'file'; inp.accept = '.pfs';
          inp.onchange = async () => res(inp.files?.[0] ? await inp.files[0].text() : null);
          inp.click();
        });
      }
      if (!text) return;
      const d = await parseProject(text);
      clearRenderCache();
      store.reset(d);
      setFitTick((n) => n + 1);
    } catch (e) { toast((e as Error).message); }
  }, [store, toast]);

  // autosave + crash recovery
  useEffect(() => {
    const id = setTimeout(() => {
      if (store.doc.layers.length > 0) void idbPut('autosave', serializeProject(store.doc)).catch(() => undefined);
    }, 3000);
    return () => clearTimeout(id);
  }, [version, store]);

  useEffect(() => {
    const clean = localStorage.getItem('pf.cleanExit');
    localStorage.setItem('pf.cleanExit', '0');
    const onUnload = () => localStorage.setItem('pf.cleanExit', '1');
    window.addEventListener('beforeunload', onUnload);
    if (clean === '0') {
      void idbGet('autosave').then(async (txt) => {
        if (!txt) return;
        if (window.confirm(t('Restore the unsaved project from the last session?'))) {
          try { store.reset(await parseProject(txt)); setFitTick((n) => n + 1); } catch { /* ignore */ }
        }
      }).catch(() => undefined);
    }
    return () => window.removeEventListener('beforeunload', onUnload);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      const typing = tag === 'TEXTAREA' || (tag === 'INPUT' && (e.target as HTMLInputElement).type !== 'range' && (e.target as HTMLInputElement).type !== 'checkbox');
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === 'z' && !typing) { e.preventDefault(); if (e.shiftKey) store.redo(); else store.undo(); }
      else if (meta && e.key.toLowerCase() === 's') { e.preventDefault(); void saveProject(); }
      else if (meta && e.key.toLowerCase() === 'o') { e.preventDefault(); void openImages(); }
      else if (meta && e.key.toLowerCase() === 'e') { e.preventDefault(); setDialog('export'); }
      else if (!typing && (e.key === 'Delete' || e.key === 'Backspace') && store.doc.selectedId) {
        const id = store.doc.selectedId;
        store.mutate('Delete layer', (d) => { d.layers = d.layers.filter((l) => l.id !== id); d.selectedId = null; });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [store, saveProject, openImages]);

  const zoomBy = (k: number) => {
    const cx = 400, cy = 300;
    const nz = Math.min(16, Math.max(0.02, view.zoom * k));
    setView({ zoom: nz, x: cx - (cx - view.x) * (nz / view.zoom), y: cy - (cy - view.y) * (nz / view.zoom) });
  };

  const addFont = useCallback((n: string) => setFonts((f) => (f.includes(n) ? f : [...f, n])), []);

  const ctx: AppCtx = {
    store, doc, layer, t, tool, setTool, brush, setBrush, crop, setCrop, importFiles, newProject, toast, fonts, addFont,
  };

  const IconBtn = (p: { title: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) => (
    <button title={p.title} disabled={p.disabled} onClick={p.onClick} className="p-1.5 rounded-md hover:bg-bg3 disabled:opacity-30">{p.children}</button>
  );

  return (
    <AppContext.Provider value={ctx}>
      <div
        className="h-full flex flex-col bg-bg0 text-ink font-ui"
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); void importFiles(Array.from(e.dataTransfer.files)); }}
      >
        {/* top bar */}
        <header className="h-12 shrink-0 flex items-center gap-2 px-3 bg-bg1 border-b border-line">
          <div className="flex items-center gap-2 me-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-accent to-accent2 flex items-center justify-center text-[11px] font-black text-bg0">PF</div>
            <span className="font-bold tracking-wide text-[13px]">PIXELFORGE STUDIO</span>
          </div>
          <div className="relative">
            <button className="px-2.5 py-1 rounded-md hover:bg-bg3" onClick={() => setMenu((m) => !m)}>{t('File')}</button>
            {menu && (
              <div className="absolute z-40 mt-1 w-56 bg-bg2 border border-line rounded-lg p-1 shadow-xl" onMouseLeave={() => setMenu(false)}>
                {([
                  ['New project', () => setDialog('new')], ['Open image', () => void openImages()], ['Open project', () => void openProject()],
                  ['Save project', () => void saveProject()], ['Export image', () => setDialog('export')],
                ] as [string, () => void][]).map(([k, fn]) => (
                  <button key={k} className="w-full text-start px-3 py-1.5 rounded-md hover:bg-bg3" onClick={() => { setMenu(false); fn(); }}>{t(k)}</button>
                ))}
              </div>
            )}
          </div>
          <IconBtn title={t('New project')} onClick={() => setDialog('new')}><FilePlus size={16} /></IconBtn>
          <IconBtn title={`${t('Open image')} (⌘O)`} onClick={() => void openImages()}><FolderOpen size={16} /></IconBtn>
          <IconBtn title={`${t('Save project')} (⌘S)`} onClick={() => void saveProject()}><Save size={16} /></IconBtn>
          <IconBtn title={`${t('Export image')} (⌘E)`} onClick={() => setDialog('export')}><Download size={16} /></IconBtn>
          <div className="w-px h-5 bg-line mx-1" />
          <IconBtn title={`${t('Undo')} (⌘Z)`} disabled={!store.canUndo()} onClick={() => store.undo()}><Undo2 size={16} /></IconBtn>
          <IconBtn title={`${t('Redo')} (⇧⌘Z)`} disabled={!store.canRedo()} onClick={() => store.redo()}><Redo2 size={16} /></IconBtn>
          <div className="flex-1" />
          <IconBtn title={t('Zoom out')} onClick={() => zoomBy(1 / 1.25)}><ZoomOut size={16} /></IconBtn>
          <span className="w-12 text-center tabular-nums text-mute">{Math.round(view.zoom * 100)}%</span>
          <IconBtn title={t('Zoom in')} onClick={() => zoomBy(1.25)}><ZoomIn size={16} /></IconBtn>
          <IconBtn title={t('Fit to screen')} onClick={() => setFitTick((n) => n + 1)}><Maximize size={16} /></IconBtn>
          <button className="px-2 py-1 rounded-md hover:bg-bg3 text-mute" onClick={() => { if (document.fullscreenElement) void document.exitFullscreen(); else void document.documentElement.requestFullscreen(); }}>{t('Fullscreen')}</button>
          <IconBtn title={t('Settings')} onClick={() => setDialog('settings')}><Settings size={16} /></IconBtn>
        </header>

        <div className="flex-1 min-h-0 flex">
          {/* left rail */}
          <nav className="w-[76px] shrink-0 bg-bg1 border-e border-line overflow-auto py-2">
            {TOOLS.map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => setTool(id)} className={`w-full flex flex-col items-center gap-1 py-2 text-[10px] ${tool === id ? 'text-accent bg-bg2' : 'text-mute hover:text-ink hover:bg-bg2'}`}>
                <Icon size={18} />
                <span className="text-center leading-tight px-1">{t(label)}</span>
              </button>
            ))}
          </nav>

          {/* canvas */}
          <main className="flex-1 min-w-0 relative bg-bg0">
            <CanvasView view={view} setView={setView} fitTick={fitTick} />
            {doc.layers.length === 0 && (
              <div className="absolute inset-0 flex items-end justify-center pb-10 pointer-events-none text-mute">{t('Drop images here')}</div>
            )}
            {dragOver && <div className="absolute inset-3 border-2 border-dashed border-accent rounded-xl pointer-events-none" />}
          </main>

          {/* right panel */}
          <aside className="w-[320px] shrink-0 bg-bg1 border-s border-line flex flex-col">
            <div className="flex-1 min-h-0 overflow-auto p-3 border-b border-line" key={tool}>
              <ToolPanel />
            </div>
            <div className="h-[290px] shrink-0 flex flex-col">
              <div className="flex border-b border-line">
                {(['layers', 'history'] as const).map((k) => (
                  <button key={k} onClick={() => setBottomTab(k)} className={`flex-1 py-2 text-[12px] ${bottomTab === k ? 'text-accent border-b-2 border-accent' : 'text-mute'}`}>{t(k === 'layers' ? 'Layers' : 'History')}</button>
                ))}
              </div>
              <div className="flex-1 min-h-0 pt-1">{bottomTab === 'layers' ? <LayersPanel /> : <HistoryPanel />}</div>
            </div>
          </aside>
        </div>

        {toastMsg && <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-bg3 border border-line rounded-lg px-4 py-2 z-50 shadow-xl">{toastMsg}</div>}
        {dialog === 'new' && <NewProjectDialog onClose={() => setDialog(null)} />}
        {dialog === 'export' && <ExportDialog onClose={() => setDialog(null)} />}
        {dialog === 'settings' && <SettingsDialog lang={prefs.lang} dir={prefs.dir} onChange={(l, d) => setPrefs({ lang: l, dir: d })} onClose={() => setDialog(null)} />}
      </div>
    </AppContext.Provider>
  );
}
