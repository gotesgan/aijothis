export interface GeocodeResult {
  place: string;
  lat: number;
  lng: number;
  timezone: string;
}

/** Open-Meteo geocoding — free, no API key required. */
export async function geocodePlace(query: string): Promise<GeocodeResult[]> {
  if (!query.trim()) return [];
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
    query.trim()
  )}&count=6&language=en&format=json`;

  const res = await fetch(url, { next: { revalidate: 86400 } });
  if (!res.ok) return [];

  const data = await res.json();
  const results = data?.results ?? [];
  return results.map(
    (r: {
      name: string;
      admin1?: string;
      country?: string;
      latitude: number;
      longitude: number;
      timezone?: string;
    }) => ({
      place: [r.name, r.admin1, r.country].filter(Boolean).join(", "),
      lat: r.latitude,
      lng: r.longitude,
      timezone: r.timezone ?? "Asia/Kolkata",
    })
  );
}

/** Resolve the IANA timezone for a coordinate via Open-Meteo (free, no key). */
export async function resolveTimezone(
  lat: number,
  lng: number
): Promise<string> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m&timezone=auto`;
    const res = await fetch(url);
    const data = await res.json();
    return data?.timezone ?? "Asia/Kolkata";
  } catch {
    return "Asia/Kolkata";
  }
}
