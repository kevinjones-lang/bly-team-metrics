// One geocode per staff lookup. No API key.
// Order: ZIP via Zippopotam; otherwise Nominatim, then Open-Meteo, then Photon.
// Nominatim often times out from Supabase Edge, so a failure there must not become "unplaced".
import type { ZipPoint } from "./logic.ts";

const UA = "BlyTeamReferralHub/1.0 (staff referral geocode; https://kevinjones-lang.github.io/bly-team-metrics/)";

export type GeocodeHit = { lat: number; lng: number; label: string };

function finitePoint(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

export async function geocodeUsZip(zip: string): Promise<(ZipPoint & { label: string }) | null> {
  const res = await fetch(`https://api.zippopotam.us/us/${zip}`, {
    headers: { Accept: "application/json", "User-Agent": UA },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return null;
  const body = await res.json() as { places?: { latitude?: string; longitude?: string; "place name"?: string; "state abbreviation"?: string }[] };
  const place = body.places?.[0];
  const lat = Number(place?.latitude);
  const lng = Number(place?.longitude);
  if (!place || !finitePoint(lat, lng)) return null;
  const city = place["place name"] ?? "";
  const region = place["state abbreviation"] ?? "";
  const label = [city, region].filter(Boolean).join(", ");
  return { lat, lng, city, region, label: label ? `${label} ${zip}` : zip };
}

type NominatimHit = {
  lat?: string;
  lon?: string;
  display_name?: string;
  address?: { city?: string; town?: string; village?: string; hamlet?: string; state?: string; country?: string };
};

const REGIONS: Record<string, string> = {
  AL: "alabama", AK: "alaska", AZ: "arizona", AR: "arkansas", CA: "california", CO: "colorado", CT: "connecticut",
  DE: "delaware", DC: "district of columbia", FL: "florida", GA: "georgia", HI: "hawaii", ID: "idaho", IL: "illinois",
  IN: "indiana", IA: "iowa", KS: "kansas", KY: "kentucky", LA: "louisiana", ME: "maine", MD: "maryland",
  MA: "massachusetts", MI: "michigan", MN: "minnesota", MS: "mississippi", MO: "missouri", MT: "montana",
  NE: "nebraska", NV: "nevada", NH: "new hampshire", NJ: "new jersey", NM: "new mexico", NY: "new york",
  NC: "north carolina", ND: "north dakota", OH: "ohio", OK: "oklahoma", OR: "oregon", PA: "pennsylvania",
  RI: "rhode island", SC: "south carolina", SD: "south dakota", TN: "tennessee", TX: "texas", UT: "utah",
  VT: "vermont", VA: "virginia", WA: "washington", WV: "west virginia", WI: "wisconsin", WY: "wyoming",
  AB: "alberta", BC: "british columbia", MB: "manitoba", NB: "new brunswick", NL: "newfoundland and labrador",
  NS: "nova scotia", NT: "northwest territories", NU: "nunavut", ON: "ontario", PE: "prince edward island",
  QC: "quebec", SK: "saskatchewan", YT: "yukon",
};

export type PlaceCandidate = {
  lat: number;
  lng: number;
  label: string;
  country: string;
  admin1: string;
  population: number;
  kind: string;
};

/** Two-letter region at the end of a location, or a full state/province name inside it. */
export function regionHint(query: string): { abbr: string; name: string } | null {
  const abbr = query.trim().toUpperCase().match(/(?:^|[\s,])([A-Z]{2})\s*(?:\d{5}(?:-\d{4})?)?\s*$/);
  if (abbr && REGIONS[abbr[1]]) return { abbr: abbr[1], name: REGIONS[abbr[1]] };
  const lower = query.toLowerCase();
  const byLength = Object.entries(REGIONS).sort((a, b) => b[1].length - a[1].length);
  for (const [code, name] of byLength) {
    if (lower.includes(name)) return { abbr: code, name };
  }
  return null;
}

function populated(kind: string): boolean {
  const k = kind.toUpperCase();
  return k.startsWith("PPL") || k === "CITY" || k === "TOWN" || k === "VILLAGE" || k === "HAMLET" || k === "MUNICIPALITY";
}

/** Prefer a US/CA hit, then the state named in the query, then a city over an airport or park. */
export function choosePlace(query: string, rows: PlaceCandidate[]): GeocodeHit | null {
  const hint = regionHint(query);
  const allowed = rows.filter((row) => finitePoint(row.lat, row.lng) && (row.country === "US" || row.country === "CA"));
  if (!allowed.length) return null;
  const ranked = allowed.map((row) => {
    const admin = row.admin1.trim().toLowerCase();
    const stateMatch = hint != null && (admin === hint.name || admin === hint.abbr.toLowerCase());
    const score = (stateMatch ? 100 : 0) + (populated(row.kind) ? 25 : 0) + Math.min(Math.max(row.population, 0), 5_000_000) / 1_000_000;
    return { row, score };
  });
  ranked.sort((a, b) => b.score - a.score || b.row.population - a.row.population);
  const best = ranked[0].row;
  return { lat: best.lat, lng: best.lng, label: best.label || query };
}

/** First geocoder that returns a point wins. A throw or a null tries the next one. */
export async function firstGeocodeHit(steps: Array<() => Promise<GeocodeHit | null>>): Promise<GeocodeHit | null> {
  for (const step of steps) {
    try {
      const hit = await step();
      if (hit && finitePoint(hit.lat, hit.lng)) return hit;
    } catch {
      /* Nominatim often times out from Supabase Edge. Keep going. */
    }
  }
  return null;
}

async function geocodeNominatim(query: string): Promise<GeocodeHit | null> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "us,ca");
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": UA },
    signal: AbortSignal.timeout(4000),
  });
  if (!res.ok) return null;
  const body = await res.json() as NominatimHit[];
  const hit = body[0];
  const lat = Number(hit?.lat);
  const lng = Number(hit?.lon);
  if (!hit || !finitePoint(lat, lng)) return null;
  const addr = hit.address ?? {};
  const city = addr.city || addr.town || addr.village || addr.hamlet || "";
  const label = [city, addr.state].filter(Boolean).join(", ") || (hit.display_name ?? query).split(",").slice(0, 2).join(",").trim();
  return { lat, lng, label };
}

type MeteoHit = {
  name?: string;
  latitude?: number;
  longitude?: number;
  country_code?: string;
  admin1?: string;
  population?: number;
  feature_code?: string;
};

/** Open-Meteo geocoding. No key. Used when Nominatim does not answer from Edge. */
export async function geocodeOpenMeteo(query: string): Promise<GeocodeHit | null> {
  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", query);
  url.searchParams.set("count", "10");
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": UA },
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) return null;
  const body = await res.json() as { results?: MeteoHit[] };
  const rows: PlaceCandidate[] = (body.results ?? []).map((row) => ({
    lat: Number(row.latitude),
    lng: Number(row.longitude),
    label: [row.name, row.admin1].filter(Boolean).join(", "),
    country: (row.country_code ?? "").toUpperCase(),
    admin1: row.admin1 ?? "",
    population: Number(row.population ?? 0),
    kind: row.feature_code ?? "",
  }));
  return choosePlace(query, rows);
}

type PhotonFeature = {
  geometry?: { coordinates?: number[] };
  properties?: { name?: string; state?: string; countrycode?: string; osm_value?: string; type?: string };
};

/** Photon (Komoot) geocoding. No key. Second fallback after Open-Meteo. */
export async function geocodePhoton(query: string): Promise<GeocodeHit | null> {
  const url = new URL("https://photon.komoot.io/api/");
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "8");
  url.searchParams.set("lang", "en");
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": UA },
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) return null;
  const body = await res.json() as { features?: PhotonFeature[] };
  const rows: PlaceCandidate[] = (body.features ?? []).map((feature) => {
    const [lng, lat] = feature.geometry?.coordinates ?? [];
    const props = feature.properties ?? {};
    return {
      lat: Number(lat),
      lng: Number(lng),
      label: [props.name, props.state].filter(Boolean).join(", "),
      country: (props.countrycode ?? "").toUpperCase(),
      admin1: props.state ?? "",
      population: 0,
      kind: props.osm_value || props.type || "",
    };
  });
  return choosePlace(query, rows);
}

async function geocodeZipHit(zip: string): Promise<GeocodeHit | null> {
  const hit = await geocodeUsZip(zip);
  return hit ? { lat: hit.lat, lng: hit.lng, label: hit.label } : null;
}

export async function geocodePlace(query: string): Promise<GeocodeHit | null> {
  const q = query.trim();
  if (!q || q.length > 500) return null;
  if (/^\d{5}(?:-\d{4})?$/.test(q)) {
    const zip = await firstGeocodeHit([() => geocodeZipHit(q.slice(0, 5))]);
    if (zip) return zip;
  }
  const named = await firstGeocodeHit([
    () => geocodeNominatim(q),
    () => geocodeOpenMeteo(q),
    () => geocodePhoton(q),
  ]);
  if (named) return named;
  const embedded = q.match(/\b(\d{5})(?:-\d{4})?\b/);
  if (!embedded) return null;
  return firstGeocodeHit([() => geocodeZipHit(embedded[1])]);
}
