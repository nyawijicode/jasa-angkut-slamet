export interface LatLngLike {
  lat: number;
  lng: number;
}

export interface RouteResult {
  /** [lat, lng] pairs following the road network. */
  coordinates: Array<[number, number]>;
  distanceKm: number;
  durationMin: number;
}

const OSRM_SERVERS = [
  "https://router.project-osrm.org/route/v1/driving",
  "https://routing.openstreetmap.de/routed-car/route/v1/driving",
];

function round(value: number): string {
  return value.toFixed(5);
}

function buildUrl(server: string, from: LatLngLike, to: LatLngLike): string {
  const pair = `${round(from.lng)},${round(from.lat)};${round(to.lng)},${round(to.lat)}`;
  return `${server}/${pair}?overview=full&geometries=geojson&alternatives=false&steps=false`;
}

interface OsrmResponse {
  code?: string;
  routes?: Array<{
    distance?: number;
    duration?: number;
    geometry?: { coordinates?: Array<[number, number]> };
  }>;
}

async function requestRoute(
  server: string,
  from: LatLngLike,
  to: LatLngLike,
  signal?: AbortSignal,
): Promise<RouteResult | null> {
  const res = await fetch(buildUrl(server, from, to), { signal });
  if (!res.ok) return null;

  const data = (await res.json()) as OsrmResponse;
  const route = data.routes?.[0];
  const coordinates = route?.geometry?.coordinates;
  if (data.code !== "Ok" || !coordinates || coordinates.length < 2) return null;

  return {
    coordinates: coordinates.map(([lng, lat]) => [lat, lng]),
    distanceKm: (route.distance ?? 0) / 1000,
    durationMin: (route.duration ?? 0) / 60,
  };
}

/**
 * Fetches a driving route that follows the road network. Tries a second
 * public router when the first one fails. Returns null when no route is
 * available so callers can fall back to a straight line.
 */
export async function fetchRoute(
  from: LatLngLike,
  to: LatLngLike,
  signal?: AbortSignal,
): Promise<RouteResult | null> {
  for (const server of OSRM_SERVERS) {
    if (signal?.aborted) return null;
    try {
      const result = await requestRoute(server, from, to, signal);
      if (result) return result;
    } catch {
      if (signal?.aborted) return null;
    }
  }
  return null;
}
