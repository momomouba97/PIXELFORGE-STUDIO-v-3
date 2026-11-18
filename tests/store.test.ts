import { describe, expect, it } from 'vitest';
import { EditorStore } from '../src/editor/store';
import { newDoc } from '../src/editor/types';

describe('EditorStore history', () => {
  it('undo / redo restores document state without corrupting it', () => {
    const s = new EditorStore(newDoc(100, 100));
    s.mutate('size 1', (d) => { d.width = 200; });
    s.mutate('size 2', (d) => { d.width = 300; });
    expect(s.doc.width).toBe(300);
    s.undo();
    expect(s.doc.width).toBe(200);
    s.undo();
    expect(s.doc.width).toBe(100);
    s.redo();
    expect(s.doc.width).toBe(200);
  });

  it('a new edit after undo discards the redo branch', () => {
    const s = new EditorStore(newDoc(100, 100));
    s.mutate('a', (d) => { d.width = 1; });
    s.mutate('b', (d) => { d.width = 2; });
    s.undo();
    s.mutate('c', (d) => { d.width = 3; });
    expect(s.canRedo()).toBe(false);
    expect(s.states.map((x) => x.label)).toEqual(['Initial', 'a', 'c']);
  });

  it('coalesces rapid edits that share a key', () => {
    const s = new EditorStore(newDoc(100, 100));
    s.mutate('slider', (d) => { d.width = 1; }, 'k');
    s.mutate('slider', (d) => { d.width = 2; }, 'k');
    s.mutate('slider', (d) => { d.width = 3; }, 'k');
    expect(s.states.length).toBe(2);
    expect(s.doc.width).toBe(3);
  });

  it('goto jumps to any earlier state', () => {
    const s = new EditorStore(newDoc(100, 100));
    s.mutate('a', (d) => { d.width = 1; });
    s.mutate('b', (d) => { d.width = 2; });
    s.goto(1);
    expect(s.doc.width).toBe(1);
  });

  it('drag edits (begin/live/end) become one history entry', () => {
    const s = new EditorStore(newDoc(100, 100));
    s.begin();
    s.live((d) => { d.width = 5; });
    s.live((d) => { d.width = 6; });
    s.end('drag');
    expect(s.states.length).toBe(2);
    s.undo();
    expect(s.doc.width).toBe(100);
  });
});
