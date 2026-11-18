import { useState } from 'react';
import { Copy, Eye, EyeOff, Lock, Trash2, Unlock } from 'lucide-react';
import { deleteLayer, duplicateLayer, moveLayer, updateLayer } from '../editor/actions';
import { BLEND_MODES, type BlendMode } from '../editor/types';
import { useApp } from './ctx';
import { Slider } from './ui';

export function LayersPanel() {
  const { store, doc, layer, t } = useApp();
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const rows = doc.layers.map((l, i) => ({ l, i })).reverse(); // top layer first

  return (
    <div className="flex flex-col h-full">
      {layer && (
        <div className="px-3 pt-2">
          <Slider label="Opacity" min={0} max={1} step={0.01} value={layer.opacity} onChange={(v) => updateLayer(store, layer.id, 'Layer opacity', (l) => { l.opacity = v; }, `op${layer.id}`)} />
          <select className="bg-bg2 border border-line rounded-md px-2 py-1 w-full mb-2 text-[12px]" value={layer.blend} onChange={(e) => updateLayer(store, layer.id, 'Blend mode', (l) => { l.blend = e.target.value as BlendMode; })}>
            {BLEND_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      )}
      <div className="flex-1 overflow-auto px-2 pb-2">
        {rows.map(({ l, i }) => (
          <div
            key={l.id}
            draggable
            onDragStart={() => setDragFrom(i)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => { if (dragFrom !== null) moveLayer(store, dragFrom, i); setDragFrom(null); }}
            onClick={() => store.select(l.id)}
            className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md mb-1 border cursor-pointer ${l.id === doc.selectedId ? 'bg-bg3 border-accent' : 'bg-bg2 border-line hover:bg-bg3'}`}
          >
            <button title={t('Visible')} onClick={(e) => { e.stopPropagation(); updateLayer(store, l.id, l.visible ? 'Hide layer' : 'Show layer', (x) => { x.visible = !x.visible; }); }}>
              {l.visible ? <Eye size={14} /> : <EyeOff size={14} className="text-mute" />}
            </button>
            <button title={t('Locked')} onClick={(e) => { e.stopPropagation(); updateLayer(store, l.id, l.locked ? 'Unlock layer' : 'Lock layer', (x) => { x.locked = !x.locked; }); }}>
              {l.locked ? <Lock size={14} className="text-accent" /> : <Unlock size={14} className="text-mute" />}
            </button>
            {editing === l.id ? (
              <input
                autoFocus
                dir="auto"
                className="flex-1 min-w-0 bg-bg0 border border-accent rounded px-1 text-[12px] outline-none"
                defaultValue={l.name}
                onBlur={(e) => { updateLayer(store, l.id, 'Rename layer', (x) => { x.name = e.target.value || x.name; }); setEditing(null); }}
                onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
              />
            ) : (
              <span className="flex-1 min-w-0 truncate text-[12px]" onDoubleClick={() => setEditing(l.id)}>{l.name}</span>
            )}
            <span className="text-[10px] text-mute">{l.kind}</span>
            <button title={t('Duplicate')} onClick={(e) => { e.stopPropagation(); duplicateLayer(store, l.id); }}><Copy size={14} /></button>
            <button title={t('Delete')} onClick={(e) => { e.stopPropagation(); deleteLayer(store, l.id); }}><Trash2 size={14} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

export function HistoryPanel() {
  const { store } = useApp();
  return (
    <div className="overflow-auto h-full px-2 pb-2">
      {store.states.map((s, i) => ({ s, i })).reverse().map(({ s, i }) => (
        <button
          key={i}
          onClick={() => store.goto(i)}
          className={`w-full text-start px-2 py-1 rounded-md mb-1 border text-[12px] ${i === store.cursor ? 'bg-bg3 border-accent' : i > store.cursor ? 'bg-bg1 border-line text-mute' : 'bg-bg2 border-line hover:bg-bg3'}`}
        >
          {i}. {s.label}
        </button>
      ))}
    </div>
  );
}
