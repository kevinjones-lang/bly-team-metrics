// One geocode per staff lookup. Nominatim's usage policy allows this with a identifying User-Agent.
// ZIP codes use Zippopotam. No API key.
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

async function geocodeNominatim(query: string): Promise<GeocodeHit | null> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "us,ca");
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": UA },
    signal: AbortSignal.timeout(8000),
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

export async function geocodePlace(query: string): Promise<GeocodeHit | null> {
  const q = query.trim();
  if (!q || q.length > 500) return null;
  if (/^\d{5}(?:-\d{4})?$/.test(q)) {
    const zip = await geocodeUsZip(q.slice(0, 5));
    if (zip) return { lat: zip.lat, lng: zip.lng, label: zip.label };
  }
  const named = await geocodeNominatim(q);
  if (named) return named;
  const embedded = q.match(/\b(\d{5})(?:-\d{4})?\b/);
  if (!embedded) return null;
  const zip = await geocodeUsZip(embedded[1]);
  return zip ? { lat: zip.lat, lng: zip.lng, label: zip.label } : null;
}
