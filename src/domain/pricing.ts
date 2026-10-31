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
}

export interface Quote {
  billableKm: number;
  transport: number;
  helper: number;
  loadFloor: number;
  unloadFloor: number;
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

export function billableKm(service: Service, d: Distances): number {
  const raw =
    service === 'luar-kota'
      ? (d.garageToLoad ?? 0) + d.loadToUnload + (d.unloadToGarage ?? 0)
      : d.loadToUnload;
  return Math.ceil(raw - 1e-9);
}

export function calculateQuote(i: QuoteInput): Quote {
  const { perKm, setoran, helper } = BUSINESS.pricing;
  const km = billableKm(i.service, i.distances);
  const transport = km * perKm + setoran;
  const h = helper[i.helper];
  const lf =
    i.loadFloors && i.loadFloors.length > 0
      ? i.loadFloors.reduce((total, floor) => total + floorFee(floor), 0)
      : floorFee(i.loadFloor);
  const uf =
    i.unloadFloors && i.unloadFloors.length > 0
      ? i.unloadFloors.reduce((total, floor) => total + floorFee(floor), 0)
      : floorFee(i.unloadFloor);
  return {
    billableKm: km,
    transport,
    helper: h,
    loadFloor: lf,
    unloadFloor: uf,
    total: transport + h + lf + uf,
  };
}
