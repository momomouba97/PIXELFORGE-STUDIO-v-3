import { describe, expect, it } from 'vitest';
import { applyAdjustments, applyTone, autoEnhance, effectiveAdj, median3 } from '../src/editor/pixel';
import { defaultAdj } from '../src/editor/types';

const buf = (px: number[]) => ({ data: new Uint8ClampedArray(px), width: px.length / 4, height: 1 });

describe('pixel pipeline', () => {
  it('neutral adjustments leave pixels unchanged', () => {
    const b = buf([10, 120, 250, 255, 0, 0, 0, 255]);
    applyAdjustments(b, defaultAdj());
    expect(Array.from(b.data)).toEqual([10, 120, 250, 255, 0, 0, 0, 255]);
  });

  it('positive brightness brightens, negative darkens', () => {
    const up = buf([100, 100, 100, 255]);
    applyAdjustments(up, { ...defaultAdj(), brightness: 40 });
    const down = buf([100, 100, 100, 255]);
    applyAdjustments(down, { ...defaultAdj(), brightness: -40 });
    expect(up.data[0]).toBeGreaterThan(100);
    expect(down.data[0]).toBeLessThan(100);
  });

  it('zero saturation produces equal channels', () => {
    const b = buf([200, 50, 20, 255]);
    applyAdjustments(b, { ...defaultAdj(), saturation: -100 });
    expect(Math.abs(b.data[0] - b.data[1])).toBeLessThanOrEqual(1);
    expect(Math.abs(b.data[1] - b.data[2])).toBeLessThanOrEqual(1);
  });

  it('black & white tone at full strength gives gray', () => {
    const b = buf([200, 50, 20, 255]);
    applyTone(b, 'gray', 100);
    expect(b.data[0]).toBe(b.data[1]);
    expect(b.data[1]).toBe(b.data[2]);
  });

  it('filter strength scales preset adjustments', () => {
    const half = effectiveAdj(defaultAdj(), { name: 'warm', strength: 50 });
    const full = effectiveAdj(defaultAdj(), { name: 'warm', strength: 100 });
    expect(full.temperature).toBeGreaterThan(half.temperature);
  });

  it('median filter removes an isolated bright pixel', () => {
    const w = 3, h = 3;
    const data = new Uint8ClampedArray(w * h * 4).fill(10);
    for (let i = 3; i < data.length; i += 4) data[i] = 255;
    const center = (1 * w + 1) * 4;
    data[center] = data[center + 1] = data[center + 2] = 255;
    median3({ data, width: w, height: h }, 1);
    expect(data[center]).toBe(10);
  });

  it('autoEnhance brightens a dark image', () => {
    const data = new Uint8ClampedArray(64 * 4);
    for (let i = 0; i < data.length; i += 4) { data[i] = data[i + 1] = data[i + 2] = 30; data[i + 3] = 255; }
    const patch = autoEnhance({ data, width: 64, height: 1 });
    expect(patch.exposure ?? 0).toBeGreaterThan(0);
  });
});
