import type { ReactNode } from 'react';
import { useApp } from './ctx';

export function Slider(p: { label: string; value: number; min?: number; max?: number; step?: number; onChange: (v: number) => void }) {
  const { t } = useApp();
  return (
    <label className="block mb-2">
      <div className="flex justify-between text-mute text-[11px] mb-0.5">
        <span>{t(p.label)}</span>
        <span className="tabular-nums">{Math.round(p.value * 100) / 100}</span>
      </div>
      <input type="range" min={p.min ?? -100} max={p.max ?? 100} step={p.step ?? 1} value={p.value} onChange={(e) => p.onChange(Number(e.target.value))} />
    </label>
  );
}

export function Btn(p: { children: ReactNode; onClick?: () => void; active?: boolean; disabled?: boolean; title?: string; primary?: boolean; className?: string }) {
  return (
    <button
      type="button"
      title={p.title}
      disabled={p.disabled}
      onClick={p.onClick}
      className={`px-2.5 py-1.5 rounded-md border text-[12px] ${
        p.primary ? 'bg-accent border-accent text-white hover:brightness-110' :
        p.active ? 'bg-bg3 border-accent text-ink' : 'bg-bg2 border-line text-ink hover:bg-bg3'
      } disabled:opacity-40 disabled:cursor-not-allowed ${p.className ?? ''}`}
    >
      {p.children}
    </button>
  );
}

export function Section(p: { title: string; children: ReactNode }) {
  const { t } = useApp();
  return (
    <div className="mb-4">
      <div className="text-[11px] uppercase tracking-wide text-mute mb-2">{t(p.title)}</div>
      {p.children}
    </div>
  );
}

export function Field(p: { label: string; children: ReactNode }) {
  const { t } = useApp();
  return (
    <label className="flex items-center justify-between gap-2 mb-2 text-[12px]">
      <span className="text-mute">{t(p.label)}</span>
      {p.children}
    </label>
  );
}

export const inputCls = 'bg-bg2 border border-line rounded-md px-2 py-1 text-ink w-24 text-[12px] outline-none focus:border-accent';

export function NumberInput(p: { value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number }) {
  return (
    <input
      type="number"
      className={inputCls}
      value={Math.round(p.value * 100) / 100}
      min={p.min}
      max={p.max}
      step={p.step ?? 1}
      onChange={(e) => {
        const v = Number(e.target.value);
        if (Number.isFinite(v)) p.onChange(v);
      }}
    />
  );
}

export function Modal(p: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center" onMouseDown={p.onClose}>
      <div className="bg-bg1 border border-line rounded-xl p-5 w-[420px] max-h-[85vh] overflow-auto" onMouseDown={(e) => e.stopPropagation()}>
        <div className="text-[15px] font-semibold mb-4">{p.title}</div>
        {p.children}
      </div>
    </div>
  );
}
