import { describe, expect, it } from 'vitest';
import { billableKm, calculateQuote, floorFee } from './pricing';

describe('pricing', () => {
  it('example: 12.3 km, dalam kota, sopir, lantai 1 / 3 -> total 214500', () => {
    const quote = calculateQuote({
      service: 'dalam-kota',
      distances: { loadToUnload: 12.3 },
      helper: 'driver',
      loadFloor: 1,
      unloadFloor: 3,
    });
    expect(quote.billableKm).toBe(13);
    expect(quote.transport).toBe(134500);
    expect(quote.helper).toBe(50000);
    expect(quote.loadFloor).toBe(0);
    expect(quote.unloadFloor).toBe(30000);
    expect(quote.total).toBe(214500);
  });

  it('floor fees', () => {
    expect(floorFee(1)).toBe(0);
    expect(floorFee(2)).toBe(20000);
    expect(floorFee(3)).toBe(30000);
    expect(floorFee(4)).toBe(40000);
    expect(floorFee(10)).toBe(100000);
  });

  it('luar kota sums three legs', () => {
    const km = billableKm('luar-kota', {
      garageToLoad: 5,
      loadToUnload: 10,
      unloadToGarage: 7,
    });
    expect(km).toBe(22);
  });

  it('dalam kota ignores garage', () => {
    const km = billableKm('dalam-kota', { loadToUnload: 10 });
    expect(km).toBe(10);
  });

  it('ceil up', () => {
    expect(billableKm('dalam-kota', { loadToUnload: 12.3 })).toBe(13);
    expect(billableKm('dalam-kota', { loadToUnload: 10 })).toBe(10);
  });

  it('sums floor fees for every stop', () => {
    const q = calculateQuote({
      service: 'dalam-kota',
      distances: { loadToUnload: 10 },
      helper: 'none',
      loadFloor: 1,
      unloadFloor: 1,
      loadFloors: [1, 2],
      unloadFloors: [1, 3],
    });
    expect(q.loadFloor).toBe(20000);
    expect(q.unloadFloor).toBe(30000);
    expect(q.total).toBe(165000);
  });

  it('throws on invalid floor', () => {
    expect(() => floorFee(0)).toThrow();
    expect(() => floorFee(1.5)).toThrow();
  });

  it('no setoran property', () => {
    const q = calculateQuote({
      service: 'dalam-kota',
      distances: { loadToUnload: 5 },
      helper: 'none',
      loadFloor: 1,
      unloadFloor: 1,
    });
    expect((q as unknown as Record<string, unknown>).setoran).toBeUndefined();
  });

  it('adds priority fee 50000 when priority is true', () => {
    const q = calculateQuote({
      service: 'dalam-kota',
      distances: { loadToUnload: 10 },
      helper: 'none',
      loadFloor: 1,
      unloadFloor: 1,
      priority: true,
    });
    expect(q.priority).toBe(50000);
    expect(q.total).toBe(115000 + 50000);
  });
});
