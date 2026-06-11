import { describe, expect, it } from 'vitest';
import { Rng, hashStr } from './rng';

describe('Rng', () => {
  it('same seed produces the same sequence', () => {
    const a = new Rng(42);
    const b = new Rng(42);
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
  });

  it('different streams from one master seed are independent', () => {
    const a = Rng.stream(7, 'sim');
    const b = Rng.stream(7, 'events');
    expect(a.state).not.toBe(b.state);
    const seqA = Array.from({ length: 5 }, () => a.next());
    const seqB = Array.from({ length: 5 }, () => b.next());
    expect(seqA).not.toEqual(seqB);
  });

  it('serialized state resumes identically', () => {
    const a = new Rng(123);
    for (let i = 0; i < 17; i++) a.next();
    const resumed = new Rng(0);
    resumed.state = a.state;
    for (let i = 0; i < 50; i++) expect(resumed.next()).toBe(a.next());
  });

  it('outputs are within [0,1) and reasonably distributed', () => {
    const r = new Rng(99);
    let sum = 0;
    for (let i = 0; i < 10_000; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      sum += v;
    }
    expect(sum / 10_000).toBeGreaterThan(0.47);
    expect(sum / 10_000).toBeLessThan(0.53);
  });

  it('gauss stays near the requested mean/sd', () => {
    const r = new Rng(5);
    const xs = Array.from({ length: 5_000 }, () => r.gauss(10, 2));
    const mean = xs.reduce((s, x) => s + x, 0) / xs.length;
    expect(Math.abs(mean - 10)).toBeLessThan(0.15);
  });

  it('hashStr is stable', () => {
    expect(hashStr('worldgen')).toBe(hashStr('worldgen'));
    expect(hashStr('worldgen')).not.toBe(hashStr('sim'));
  });
});
