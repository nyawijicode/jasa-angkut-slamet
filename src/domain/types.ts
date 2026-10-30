export type Service = 'dalam-kota' | 'luar-kota';
export type Helper = 'none' | 'driver' | 'driverAndAssistant';

export interface LatLng {
  lat: number;
  lng: number;
}

export interface Point {
  lat: number;
  lng: number;
  address?: string;
}
