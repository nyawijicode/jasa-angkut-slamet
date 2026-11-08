export interface GeocodeResult {
  display_name: string;
  lat: number;
  lon: number;
}

interface NominatimPlace {
  display_name?: string;
  lat?: string;
  lon?: string;
}

export async function searchAddress(query: string, signal?: AbortSignal): Promise<GeocodeResult[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
    q
  )}&countrycodes=id&accept-language=id&limit=5&addressdetails=1`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'jasa-angkut-slamet/1.0',
      Referer: typeof window !== 'undefined' ? window.location.origin : 'http://localhost',
    },
    signal,
  });
  if (!res.ok) {
    throw new Error(`Geocoding failed with status ${res.status}`);
  }
  const data = (await res.json()) as NominatimPlace[];
  return data
    .map((d) => ({
      display_name: d.display_name ?? "",
      lat: parseFloat(d.lat ?? ""),
      lon: parseFloat(d.lon ?? ""),
    }))
    .filter((d) => !Number.isNaN(d.lat) && !Number.isNaN(d.lon));
}
