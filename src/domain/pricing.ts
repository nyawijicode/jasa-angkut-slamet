import { BUSINESS } from '../config/business';
import type { Service } from './types';

export type Helper = keyof typeof BUSINESS.pricing.helper;

export interface Distances {
  garageToLoad?: number;
  loadToUnload: number;
  unloadToGarage?: number;
}

export interface QuoteInput {
  service: Service;
  distances: Distances;
  helper: Helper;
  loadFloor: number;
  unloadFloor: number;
  loadFloors?: number[];
  unloadFloors?: number[];
  priority?: boolean;
}

export interface Quote {
  billableKm: number;
  baseTransport: number;
  outOfTownSurcharge: number;
  transport: number;
  helper: number;
  loadFloor: number;
  unloadFloor: number;
  priority: number;
  total: number;
}

export const floorFee = (floor: number): number => {
  const { first, next } = BUSINESS.pricing.floor;
  if (!Number.isInteger(floor) || floor < 1) {
    throw new RangeError('Lantai minimal 1');
  }
  if (floor === 1) return 0;
  return first + (floor - 2) * next;
};

export function billableKm(_service: Service, d: Distances): number {
  return Math.ceil(d.loadToUnload - 1e-9);
}

export function calculateQuote(i: QuoteInput): Quote {
  const { perKm, setoran, helper } = BUSINESS.pricing;
  const km = billableKm(i.service, i.distances);
  const baseTransport = km * perKm + setoran;
  const outOfTownSurcharge =
    i.service === 'luar-kota'
      ? Math.round(baseTransport * (BUSINESS.pricing.outOfTownSurchargeRate ?? 0.5))
      : 0;
  const transport = baseTransport + outOfTownSurcharge;
  const h = helper[i.helper];
  const lf =
    i.loadFloors && i.loadFloors.length > 0
      ? i.loadFloors.reduce((total, floor) => total + floorFee(floor), 0)
      : floorFee(i.loadFloor);
  const uf =
    i.unloadFloors && i.unloadFloors.length > 0
      ? i.unloadFloors.reduce((total, floor) => total + floorFee(floor), 0)
      : floorFee(i.unloadFloor);
  const priorityFee = i.priority ? 50000 : 0;
  return {
    billableKm: km,
    baseTransport,
    outOfTownSurcharge,
    transport,
    helper: h,
    loadFloor: lf,
    unloadFloor: uf,
    priority: priorityFee,
    total: transport + h + lf + uf + priorityFee,
  };
}
