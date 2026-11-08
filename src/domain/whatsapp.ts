import { BUSINESS } from '../config/business';
import type { Quote } from './pricing';
import { formatSchedule } from './schedule';

export interface WaStop {
  label: string;
  address: string;
  lat: number;
  lng: number;
  floor: number;
}

export interface WaPayload {
  name: string;
  phone: string;
  pickupDate?: string;
  pickupTime?: string;
  serviceLabel: string;
  loads: WaStop[];
  unloads: WaStop[];
  helperLabel: string;
  distanceKm: number;
  note?: string;
  quote: Quote;
}

export function buildWhatsAppMessage(p: WaPayload): string {
  const schedule = formatSchedule(p.pickupDate, p.pickupTime);
  const lines = [
    '*PESANAN JASA ANGKUT SLAMET*',
    '',
    `Nama: ${p.name}`,
    `No. HP: ${p.phone}`,
  ];
  if (schedule) {
    lines.push(`Jadwal angkut: ${schedule}`);
  }

  const appendStops = (title: string, stops: WaStop[]) => {
    lines.push('', `*${title}:*`);
    stops.forEach((stop) => {
      lines.push(`${stop.label}: ${stop.address}`);
      lines.push(`Peta: https://www.google.com/maps?q=${stop.lat},${stop.lng}`);
      lines.push(`Lantai: ${stop.floor}`);
    });
  };

  lines.push('', `*Layanan:* ${p.serviceLabel}`);
  appendStops('Titik Muat', p.loads);
  appendStops('Titik Bongkar', p.unloads);
  lines.push('', `*Bantuan:* ${p.helperLabel}`, `*Jarak:* ${p.distanceKm} km`);
  if (p.note && p.note.trim()) {
    lines.push(`*Catatan:* ${p.note.trim()}`);
  }
  lines.push('');
  lines.push('*Rincian Harga (estimasi)*');
  if (p.quote.outOfTownSurcharge > 0) {
    lines.push(`Ongkos angkut dasar: Rp ${p.quote.baseTransport.toLocaleString('id-ID')}`);
    lines.push(`Tambahan luar kota (+50%): Rp ${p.quote.outOfTownSurcharge.toLocaleString('id-ID')}`);
    lines.push(`Total ongkos angkut: Rp ${p.quote.transport.toLocaleString('id-ID')}`);
  } else {
    lines.push(`Ongkos angkut: Rp ${p.quote.transport.toLocaleString('id-ID')}`);
  }
  if (p.quote.helper > 0) {
    lines.push(`Bantuan bongkar muat: Rp ${p.quote.helper.toLocaleString('id-ID')}`);
  }
  if (p.quote.loadFloor > 0) {
    lines.push(`Lantai muat: Rp ${p.quote.loadFloor.toLocaleString('id-ID')}`);
  }
  if (p.quote.unloadFloor > 0) {
    lines.push(`Lantai bongkar: Rp ${p.quote.unloadFloor.toLocaleString('id-ID')}`);
  }
  if (p.quote.priority > 0) {
    lines.push(`Prioritas langsung: Rp ${p.quote.priority.toLocaleString('id-ID')}`);
  }
  lines.push(`*TOTAL: Rp ${p.quote.total.toLocaleString('id-ID')}*`);
  lines.push('');
  lines.push('Mohon konfirmasi ketersediaan dan jadwal. Terima kasih.');
  return lines.join('\n');
}

export function buildWhatsAppUrl(p: WaPayload): string {
  const msg = buildWhatsAppMessage(p);
  const url = `https://wa.me/${BUSINESS.whatsapp}?text=${encodeURIComponent(msg)}`;
  return url;
}
