import type { Doc } from './types';

interface Snap { label: string; doc: Doc; key?: string; t: number }
const MAX_STATES = 100;

/**
 * Document store with snapshot history. The document is plain JSON (bitmaps live in assets),
 * so every history state is a structural clone and undo/redo can never corrupt layers.
 */
export class EditorStore {
  doc: Doc;
  states: Snap[];
  cursor = 0;
  private version = 0;
  private listeners = new Set<() => void>();

  constructor(doc: Doc) {
    this.doc = doc;
    this.states = [{ label: 'Initial', doc: structuredClone(doc), t: Date.now() }];
  }

  subscribe = (l: () => void): (() => void) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };
  getSnapshot = (): number => this.version;
  private emit(): void {
    this.version++;
    this.listeners.forEach((l) => l());
  }

  /** Replace the whole document and reset history. */
  reset(doc: Doc): void {
    this.doc = doc;
    this.states = [{ label: 'Initial', doc: structuredClone(doc), t: Date.now() }];
    this.cursor = 0;
    this.emit();
  }

  /** One-shot edit recorded in history. Edits sharing `key` within 1.5s collapse into one state (slider drags). */
  mutate(label: string, fn: (d: Doc) => void, key?: string): void {
    this.doc = structuredClone(this.doc);
    fn(this.doc);
    this.pushState(label, key);
  }

  /** Interactive edits (drag): begin() -> live()* -> end(). */
  begin(): void {
    this.doc = structuredClone(this.doc);
  }
  live(fn: (d: Doc) => void): void {
    fn(this.doc);
    this.emit();
  }
  end(label: string): void {
    this.pushState(label);
  }

  /** Selection changes are not history entries. */
  select(id: string | null): void {
    this.doc.selectedId = id;
    this.emit();
  }

  private pushState(label: string, key?: string): void {
    const now = Date.now();
    const cur = this.states[this.cursor];
    this.states = this.states.slice(0, this.cursor + 1);
    if (key && cur.key === key && now - cur.t < 1500 && this.cursor > 0) {
      this.states[this.cursor] = { label, doc: this.doc, key, t: now };
    } else {
      this.states.push({ label, doc: this.doc, key, t: now });
      this.cursor++;
      if (this.states.length > MAX_STATES) {
        this.states.shift();
        this.cursor--;
      }
    }
    this.emit();
  }

  canUndo(): boolean { return this.cursor > 0; }
  canRedo(): boolean { return this.cursor < this.states.length - 1; }
  undo(): void { if (this.canUndo()) this.goto(this.cursor - 1); }
  redo(): void { if (this.canRedo()) this.goto(this.cursor + 1); }
  goto(i: number): void {
    if (i < 0 || i >= this.states.length) return;
    this.cursor = i;
    this.doc = structuredClone(this.states[i].doc);
    this.emit();
  }
}
