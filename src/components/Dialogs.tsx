import { useState } from 'react';
import { exportBytes, saveBytes, type ExportFormat } from '../export/export';
import type { DirPref, Lang } from '../i18n';
import { SIZE_PRESETS } from '../editor/types';
import { useApp } from './ctx';
import { Btn, Field, inputCls, Modal, NumberInput, Slider } from './ui';

export function NewProjectDialog(p: { onClose: () => void }) {
  const { t, newProject } = useApp();
  const [w, setW] = useState(1080);
  const [h, setH] = useState(1080);
  const [bg, setBg] = useState<'transparent' | 'white' | 'black'>('transparent');
  return (
    <Modal title={t('New project')} onClose={p.onClose}>
      <Field label="Custom">
        <select className={`${inputCls} w-48`} onChange={(e) => { const s = SIZE_PRESETS[Number(e.target.value)]; if (s) { setW(s.w); setH(s.h); } }} defaultValue="">
          <option value="" disabled>—</option>
          {SIZE_PRESETS.map((s, i) => <option key={s.name} value={i}>{s.name} ({s.w}×{s.h})</option>)}
        </select>
      </Field>
      <Field label="Width"><NumberInput min={16} max={8192} value={w} onChange={setW} /></Field>
      <Field label="Height"><NumberInput min={16} max={8192} value={h} onChange={setH} /></Field>
      <Field label="Background">
        <select className={`${inputCls} w-32`} value={bg} onChange={(e) => setBg(e.target.value as typeof bg)}>
          <option value="transparent">{t('Transparent')}</option>
          <option value="white">{t('White')}</option>
          <option value="black">{t('Black')}</option>
        </select>
      </Field>
      <div className="flex justify-end gap-2 mt-4">
        <Btn onClick={p.onClose}>{t('Cancel')}</Btn>
        <Btn primary onClick={() => { newProject(Math.min(8192, Math.max(16, w)), Math.min(8192, Math.max(16, h)), bg === 'transparent' ? null : bg === 'white' ? '#ffffff' : '#000000'); p.onClose(); }}>{t('Create')}</Btn>
      </div>
    </Modal>
  );
}

export function ExportDialog(p: { onClose: () => void }) {
  const { t, store, toast } = useApp();
  const doc = store.doc;
  const [fmt, setFmt] = useState<ExportFormat>('png');
  const [w, setW] = useState(doc.width);
  const [h, setH] = useState(doc.height);
  const [keep, setKeep] = useState(true);
  const [q, setQ] = useState(0.92);
  const [name, setName] = useState('pixelforge-export');
  const [busy, setBusy] = useState(false);
  const ratio = doc.width / doc.height;

  const go = async () => {
    setBusy(true);
    try {
      const bytes = await exportBytes(doc, fmt, w, h, q);
      const ok = await saveBytes(name || 'export', fmt, bytes);
      if (ok) { toast('Saved'); p.onClose(); }
    } catch (e) { toast((e as Error).message); }
    setBusy(false);
  };

  return (
    <Modal title={t('Export image')} onClose={p.onClose}>
      <Field label="File name"><input className={`${inputCls} w-48`} value={name} onChange={(e) => setName(e.target.value)} /></Field>
      <Field label="Format">
        <select className={`${inputCls} w-32`} value={fmt} onChange={(e) => setFmt(e.target.value as ExportFormat)}>
          <option value="png">PNG</option><option value="jpg">JPG</option><option value="jpeg">JPEG</option><option value="webp">WEBP</option>
        </select>
      </Field>
      {fmt !== 'png' && <Slider label="Quality" min={0.1} max={1} step={0.01} value={q} onChange={setQ} />}
      <Field label="Width"><NumberInput min={1} max={16384} value={w} onChange={(v) => { setW(v); if (keep) setH(Math.round(v / ratio)); }} /></Field>
      <Field label="Height"><NumberInput min={1} max={16384} value={h} onChange={(v) => { setH(v); if (keep) setW(Math.round(v * ratio)); }} /></Field>
      <Field label="Keep ratio"><input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} /></Field>
      {(fmt === 'jpg' || fmt === 'jpeg') && <div className="text-mute text-[11px]">JPEG has no transparency: transparent areas become white. Use PNG/WEBP to keep transparency.</div>}
      <div className="flex justify-end gap-2 mt-4">
        <Btn onClick={p.onClose}>{t('Cancel')}</Btn>
        <Btn primary disabled={busy} onClick={go}>{busy ? '…' : t('Export')}</Btn>
      </div>
    </Modal>
  );
}

export function SettingsDialog(p: { lang: Lang; dir: DirPref; onChange: (l: Lang, d: DirPref) => void; onClose: () => void }) {
  const { t } = useApp();
  return (
    <Modal title={t('Settings')} onClose={p.onClose}>
      <Field label="Language">
        <select className={`${inputCls} w-32`} value={p.lang} onChange={(e) => p.onChange(e.target.value as Lang, p.dir)}>
          <option value="en">English</option><option value="ar">العربية</option>
        </select>
      </Field>
      <Field label="Direction">
        <select className={`${inputCls} w-32`} value={p.dir} onChange={(e) => p.onChange(p.lang, e.target.value as DirPref)}>
          <option value="auto">{t('Auto')}</option><option value="ltr">LTR</option><option value="rtl">RTL</option>
        </select>
      </Field>
      <div className="flex justify-end mt-4"><Btn onClick={p.onClose}>OK</Btn></div>
    </Modal>
  );
}
