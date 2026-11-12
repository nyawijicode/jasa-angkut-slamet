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

  it('luar kota uses delivery route distance and adds 50% surcharge', () => {
    const km = billableKm('luar-kota', {
      loadToUnload: 89,
    });
    expect(km).toBe(89);

    const q = calculateQuote({
      service: 'luar-kota',
      distances: { loadToUnload: 89 },
      helper: 'none',
      loadFloor: 1,
      unloadFloor: 1,
    });
    // 89 km * 6.500 + 50.000 (jasa sopir) = 578.500 + 50.000 = 628.500
    // +50% luar kota = 314.250
    // Total ongkos angkut luar kota = 628.500 + 314.250 = 942.750
    expect(q.billableKm).toBe(89);
    expect(q.baseTransport).toBe(628500);
    expect(q.outOfTownSurcharge).toBe(314250);
    expect(q.transport).toBe(942750);
    expect(q.total).toBe(942750);
  });

  it('counts garage, load-to-unload, and return-to-garage legs', () => {
    const km = billableKm('dalam-kota', {
      garageToLoad: 4.2,
      loadToUnload: 10,
      unloadToGarage: 4.2,
    });
    expect(km).toBe(19);

    const q = calculateQuote({
      service: 'dalam-kota',
      distances: {
        garageToLoad: 4.2,
        loadToUnload: 10,
        unloadToGarage: 4.2,
      },
      helper: 'none',
      loadFloor: 1,
      unloadFloor: 1,
    });
    // 19 km * 6.500 + 50.000 = 173.500
    expect(q.billableKm).toBe(19);
    expect(q.baseTransport).toBe(173500);
    expect(q.total).toBe(173500);
  });

  it('adds waiting time fee per selected tier', () => {
    const base = {
      service: 'dalam-kota' as const,
      distances: { loadToUnload: 10 },
      helper: 'none' as const,
      loadFloor: 1,
      unloadFloor: 1,
    };
    expect(calculateQuote(base).waitingTime).toBe(0);
    expect(calculateQuote({ ...base, waitingTime: 'none' }).waitingTime).toBe(0);
    expect(calculateQuote({ ...base, waitingTime: 'over30' }).waitingTime).toBe(18000);
    expect(calculateQuote({ ...base, waitingTime: 'min60' }).waitingTime).toBe(36000);
    expect(calculateQuote({ ...base, waitingTime: 'min90' }).waitingTime).toBe(72000);

    const q = calculateQuote({ ...base, waitingTime: 'min60' });
    expect(q.total).toBe(115000 + 36000);
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
