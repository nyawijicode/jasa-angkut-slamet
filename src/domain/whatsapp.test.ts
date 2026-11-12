import { describe, expect, it } from 'vitest';
import { calculateQuote } from './pricing';
import { buildWhatsAppMessage } from './whatsapp';

const quote = calculateQuote({
  service: 'dalam-kota',
  distances: { loadToUnload: 10 },
  helper: 'none',
  loadFloor: 1,
  unloadFloor: 1,
});

describe('whatsapp message', () => {
  it('lists every load and unload stop with its label', () => {
    const message = buildWhatsAppMessage({
      name: 'Budi',
      phone: '081327623942',
      serviceLabel: 'Dalam Kota',
      loads: [
        { label: 'M1', address: 'Alamat A', lat: -7.1, lng: 110.4, floor: 1 },
        { label: 'M2', address: 'Alamat B', lat: -7.2, lng: 110.5, floor: 2 },
      ],
      unloads: [
        { label: 'B1', address: 'Alamat C', lat: -7.3, lng: 110.6, floor: 3 },
      ],
      helperLabel: 'Tanpa bantuan',
      distanceKm: 10,
      note: 'Pakai terpal',
      quote,
    });

    expect(message).toContain('M1: Alamat A');
    expect(message).toContain('M2: Alamat B');
    expect(message).toContain('B1: Alamat C');
    expect(message).toContain('Lantai: 2');
    expect(message).toContain('Lantai: 3');
    expect(message).toContain('*Titik Muat:*');
    expect(message).toContain('*Titik Bongkar:*');
  });

  it('includes out of town surcharge in message when applicable', () => {
    const luarKotaQuote = calculateQuote({
      service: 'luar-kota',
      distances: { loadToUnload: 89 },
      helper: 'none',
      loadFloor: 1,
      unloadFloor: 1,
    });

    const message = buildWhatsAppMessage({
      name: 'Agus',
      phone: '081327623942',
      serviceLabel: 'Luar Kota',
      loads: [{ label: 'M1', address: 'Demak', lat: -7.0, lng: 110.5, floor: 1 }],
      unloads: [{ label: 'B1', address: 'Kudus', lat: -6.8, lng: 110.8, floor: 1 }],
      helperLabel: 'Tanpa bantuan',
      distanceKm: 89,
      quote: luarKotaQuote,
    });

    expect(message).toContain('Ongkos angkut dasar: Rp 628.500');
    expect(message).toContain('Tambahan luar kota (+50%): Rp 314.250');
    expect(message).toContain('Total ongkos angkut: Rp 942.750');
  });

  it('includes waiting time fee and label in message', () => {
    const waitingQuote = calculateQuote({
      service: 'dalam-kota',
      distances: { loadToUnload: 10 },
      helper: 'none',
      loadFloor: 1,
      unloadFloor: 1,
      waitingTime: 'min90',
    });

    const message = buildWhatsAppMessage({
      name: 'Budi',
      phone: '081327623942',
      serviceLabel: 'Dalam Kota',
      loads: [{ label: 'M1', address: 'Demak', lat: -7.0, lng: 110.5, floor: 1 }],
      unloads: [{ label: 'B1', address: 'Semarang', lat: -6.9, lng: 110.4, floor: 1 }],
      helperLabel: 'Tanpa bantuan',
      waitingLabel: '90 menit',
      distanceKm: 10,
      quote: waitingQuote,
    });

    expect(message).toContain('Waktu tunggu (90 menit): Rp 72.000');
    expect(message).toContain('*TOTAL: Rp 187.000*');
  });
});
