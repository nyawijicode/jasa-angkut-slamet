import { BUSINESS } from '../config/business';
import type { Quote } from './pricing';
import { formatSchedule } from './schedule';

export interface WaPayload {
  name: string;
  phone: string;
  pickupDate?: string;
  pickupTime?: string;
  serviceLabel: string;
  loadAddress: string;
  loadLat: number;
  loadLng: number;
  loadFloor: number;
  unloadAddress: string;
  unloadLat: number;
  unloadLng: number;
  unloadFloor: number;
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
  lines.push(
    '',
    `*Layanan:* ${p.serviceLabel}`,
    `*Titik Muat:* ${p.loadAddress}`,
    `Peta: https://www.google.com/maps?q=${p.loadLat},${p.loadLng}`,
    `Lantai: ${p.loadFloor}`,
    `*Titik Bongkar:* ${p.unloadAddress}`,
    `Peta: https://www.google.com/maps?q=${p.unloadLat},${p.unloadLng}`,
    `Lantai: ${p.unloadFloor}`,
    '',
    `*Bantuan:* ${p.helperLabel}`,
    `*Jarak:* ${p.distanceKm} km`,
  );
  if (p.note && p.note.trim()) {
    lines.push(`*Catatan:* ${p.note.trim()}`);
  }
  lines.push('');
  lines.push('*Rincian Harga (estimasi)*');
  lines.push(`Ongkos angkut: Rp ${p.quote.transport.toLocaleString('id-ID')}`);
  if (p.quote.helper > 0) {
    lines.push(`Bantuan bongkar muat: Rp ${p.quote.helper.toLocaleString('id-ID')}`);
  }
  if (p.quote.loadFloor > 0) {
    lines.push(`Lantai muat: Rp ${p.quote.loadFloor.toLocaleString('id-ID')}`);
  }
  if (p.quote.unloadFloor > 0) {
    lines.push(`Lantai bongkar: Rp ${p.quote.unloadFloor.toLocaleString('id-ID')}`);
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
