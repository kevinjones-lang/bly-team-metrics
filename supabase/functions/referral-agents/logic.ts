// Pure FFM ranking. No Deno, no network, no secrets.
// The KML is the public Fast Forward Movement referral map (mid 1JtTrRiy5GKmzXhCLsLwTaFG4GfR2W51c).
// Distance uses map pins when the KML has them, otherwise the primary ZIP centroid baked into ffm-agents.json.

export const FFM_MAP_ID = "1JtTrRiy5GKmzXhCLsLwTaFG4GfR2W51c";
export const FFM_KML_URL = `https://www.google.com/maps/d/kml?mid=${FFM_MAP_ID}&forcekml=1`;
export const FFM_RADIUS_MILES = 20;
export const FFM_LIMIT = 3;
export const FALLBACK_LIMIT = 5;

export const EXP_DIRECTORY_URL = "https://www.exprealty.com/agents-search";
export const EXP_HUB_REFERRAL_URL = "https://hub.exprealty.com/connect/group/us-corp-exp-referral-network";
export const EXP_GLOBAL_REFERRAL_URL = "https://agents.exprealty.com/";

export const TIERS = ["ffm", "ffm_nearest", "unplaced"] as const;
export type AgentTier = (typeof TIERS)[number];

export type FfmAgent = {
  name: string;
  email: string;
  phone: string;
  zip: string;
  city: string;
  region: string;
  level: string;
  volumeLabel: string;
  volume: number | null;
  unitsLabel: string;
  units: number | null;
  /** Service-area note from the map form, not the city. */
  market: string;
  profileUrl: string;
  lat: number | null;
  lng: number | null;
};

export type ZipPoint = { lat: number; lng: number; city: string; region: string };

export type PublicAgent = {
  id: string;
  name: string;
  email: string;
  phone: string;
  market: string;
  place: string;
  level: string;
  volumeLabel: string;
  unitsLabel: string;
  distanceMiles: number;
  distanceLabel: string;
  profileUrl: string;
  directoryUrl: string;
  mapUrl: string;
  source: "ffm";
};

export type AgentLinks = {
  ffmMap: string;
  expDirectory: string;
  expHub: string;
  expGlobal: string;
};

export type AgentLookup = {
  tier: AgentTier;
  radiusMiles: number;
  query: string;
  place: string;
  lat: number | null;
  lng: number | null;
  note: string;
  live: boolean;
  asOf: string;
  agents: PublicAgent[];
  links: AgentLinks;
};

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

export function milesBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (n: number) => (n * Math.PI) / 180;
  const earth = 3958.7613;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * earth * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function formatMiles(miles: number): string {
  if (!Number.isFinite(miles) || miles < 0) return "";
  if (miles < 10) return `${miles.toFixed(1)} mi`;
  return `${Math.round(miles)} mi`;
}

export function parseMoney(raw: string): number | null {
  const t = raw.replace(/[$,\s]/g, "").replace(/usd/ig, "").toUpperCase();
  const m = t.match(/^(\d+(?:\.\d+)?)([KMB])?\+?$/);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return null;
  const unit = m[2];
  const mult = unit === "B" ? 1e9 : unit === "M" ? 1e6 : unit === "K" ? 1e3 : 1;
  return n * mult;
}

export function parseUnits(raw: string): number | null {
  const m = raw.replace(/,/g, "").match(/(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

export function normalizeZip(raw: string): string {
  const t = raw.trim().toUpperCase().replace(/\s+/g, "");
  const us = t.match(/^(\d{5})(?:-\d{4})?$/);
  if (us) return us[1];
  const ca = t.match(/^([A-Z]\d[A-Z])(\d[A-Z]\d)$/);
  if (ca) return ca[1] + ca[2];
  const digits = t.match(/(\d{5})/);
  return digits ? digits[1] : "";
}

export function levelShort(raw: string): string {
  const head = raw.split("{")[0]?.trim() ?? "";
  if (/general/i.test(head)) return "Generals";
  if (/lieutenant/i.test(head)) return "Lieutenants";
  if (!head) return "";
  return head.length > 48 ? head.slice(0, 48).trim() : head;
}

export function sourceLinks(p: { location: string; lat?: number | null; lng?: number | null }): AgentLinks {
  const ffm = new URL(`https://www.google.com/maps/d/viewer`);
  ffm.searchParams.set("mid", FFM_MAP_ID);
  if (p.lat != null && p.lng != null && Number.isFinite(p.lat) && Number.isFinite(p.lng)) {
    ffm.searchParams.set("ll", `${p.lat},${p.lng}`);
    ffm.searchParams.set("z", "10");
  }
  const dir = new URL(EXP_DIRECTORY_URL);
  const location = p.location.trim();
  if (location) dir.searchParams.set("location", location);
  dir.searchParams.set("country", "US");
  return {
    ffmMap: ffm.toString(),
    expDirectory: dir.toString(),
    expHub: EXP_HUB_REFERRAL_URL,
    expGlobal: EXP_GLOBAL_REFERRAL_URL,
  };
}

export function directoryUrlForName(name: string): string {
  const dir = new URL(EXP_DIRECTORY_URL);
  const who = name.trim();
  if (who) dir.searchParams.set("name", who);
  dir.searchParams.set("country", "US");
  return dir.toString();
}

export function mapUrlForPoint(a: { lat: number | null; lng: number | null; zip: string }): string {
  if (a.lat != null && a.lng != null && Number.isFinite(a.lat) && Number.isFinite(a.lng)) {
    return `https://www.google.com/maps/search/?api=1&query=${a.lat},${a.lng}`;
  }
  if (a.zip) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(a.zip)}`;
  return "";
}

export function optionsNote(tier: AgentTier): string {
  switch (tier) {
    case "ffm":
      return `Fast Forward Movement agents within ${FFM_RADIUS_MILES} miles, closest first. Pick a card to set the receiving agent.`;
    case "ffm_nearest":
      return `No Fast Forward Movement agents within ${FFM_RADIUS_MILES} miles. These are the nearest people on the FFM map. For a closer eXp agent, open the directory links and paste that person if you choose them. The public directory blocks automated lookup, so those profiles stay as links.`;
    case "unplaced":
      return "Could not place this location on a map, so no agent cards were ranked. Try City, ST or a ZIP code, or paste an agent below.";
    default: {
      const _n: never = tier;
      return _n;
    }
  }
}

export function formatShortlistLine(a: { name: string; email: string; place?: string; distanceLabel?: string; level?: string }): string {
  const name = a.name.trim();
  const email = a.email.trim();
  const who = email ? `${name} <${email}>` : name;
  const bits = [a.place?.trim() ?? "", a.distanceLabel?.trim() ?? "", a.level?.trim() ? `FFM ${a.level.trim()}` : ""].filter(Boolean);
  return bits.length ? `${who} — ${bits.join(" · ")}` : who;
}

function decodeXml(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)));
}

function clean(s: string): string {
  return decodeXml(s).replace(/\u00a0/g, " ").replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function firstUrl(text: string): string {
  const re = /https?:\/\/[^\s<>"']+|\bwww\.[^\s<>"']+/gi;
  for (const m of text.matchAll(re)) {
    let url = m[0].replace(/[),.;}]+$/g, "");
    if (url.startsWith("www.")) url = `https://${url}`;
    try {
      const u = new URL(url);
      if (u.protocol !== "http:" && u.protocol !== "https:") continue;
      const host = u.hostname.replace(/^www\./, "");
      if (host === "google.com" || host.endsWith(".google.com") || host === "goo.gl" || host.endsWith(".goo.gl")) continue;
      return u.toString();
    } catch {
      continue;
    }
  }
  return "";
}

function braceNote(text: string): string {
  const m = text.match(/\{([\s\S]+)\}/);
  if (!m) return "";
  const note = m[1].replace(/\s+/g, " ").trim();
  return note.length > 180 ? `${note.slice(0, 177).trim()}…` : note;
}

function fieldMap(block: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /<Data\b[^>]*\bname="([^"]+)"[^>]*>[\s\S]*?<value>([\s\S]*?)<\/value>/gi;
  for (const m of block.matchAll(re)) out[m[1].trim().toLowerCase()] = clean(m[2]);
  return out;
}

function validPoint(lat: number, lng: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat === 0 && lng === 0) return false;
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

function emptyAgent(name: string): FfmAgent {
  return {
    name, email: "", phone: "", zip: "", city: "", region: "", level: "",
    volumeLabel: "", volume: null, unitsLabel: "", units: null, market: "", profileUrl: "",
    lat: null, lng: null,
  };
}

function agentFromPlacemark(block: string): FfmAgent | null {
  const nameMatch = block.match(/<name>([\s\S]*?)<\/name>/i);
  const name = clean(nameMatch?.[1] ?? "");
  if (!name || !/[A-Za-z]/.test(name)) return null;
  const fields = fieldMap(block);
  const descMatch = block.match(/<description>([\s\S]*?)<\/description>/i);
  const description = clean(descMatch?.[1] ?? "");
  const emailRaw = fields["email address"] || description.match(EMAIL_RE)?.[0] || "";
  const email = EMAIL_RE.test(emailRaw) ? (emailRaw.match(EMAIL_RE)?.[0] ?? "") : "";
  const levelRaw = fields["fast forward movement level"] || "";
  const volumeLabel = fields["trailing 12 months closed volume"] || "";
  const unitsLabel = fields["trailing 12 months closed units"] || "";
  const note = braceNote(levelRaw) || braceNote(description);
  const blob = `${levelRaw} ${description}`;
  const coord = block.match(/<coordinates>\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/i);
  const lng = coord ? Number(coord[1]) : NaN;
  const lat = coord ? Number(coord[2]) : NaN;
  const agent = emptyAgent(name);
  agent.email = email;
  agent.phone = fields["cell"] || "";
  agent.zip = normalizeZip(fields["primary zip code"] || description);
  agent.level = levelShort(levelRaw);
  agent.volumeLabel = volumeLabel;
  agent.volume = volumeLabel ? parseMoney(volumeLabel) : null;
  agent.unitsLabel = unitsLabel;
  agent.units = unitsLabel ? parseUnits(unitsLabel) : null;
  agent.market = note;
  agent.profileUrl = firstUrl(blob);
  if (validPoint(lat, lng)) {
    agent.lat = lat;
    agent.lng = lng;
  }
  return agent;
}

function score(a: FfmAgent): number {
  return (a.lat != null ? 8 : 0) + (a.profileUrl ? 4 : 0) + (a.volume != null ? 2 : 0) + (a.market ? 1 : 0) + (a.phone ? 1 : 0);
}

function prefer(a: FfmAgent, b: FfmAgent): FfmAgent {
  const best = score(a) >= score(b) ? a : b;
  const other = best === a ? b : a;
  return {
    ...best,
    email: best.email || other.email,
    phone: best.phone || other.phone,
    zip: best.zip || other.zip,
    city: best.city || other.city,
    region: best.region || other.region,
    level: best.level || other.level,
    volumeLabel: best.volumeLabel || other.volumeLabel,
    volume: best.volume ?? other.volume,
    unitsLabel: best.unitsLabel || other.unitsLabel,
    units: best.units ?? other.units,
    market: best.market || other.market,
    profileUrl: best.profileUrl || other.profileUrl,
    lat: best.lat ?? other.lat,
    lng: best.lng ?? other.lng,
  };
}

function dedupeKey(a: FfmAgent): string {
  if (a.email) return `e:${a.email.toLowerCase()}`;
  return `n:${a.name.toLowerCase()}|${a.zip}`;
}

/** Placemarks from the public FFM KML, one row per email. */
export function parseFfmKml(xml: string): FfmAgent[] {
  if (!xml || !/<Placemark\b/i.test(xml)) return [];
  const byKey = new Map<string, FfmAgent>();
  for (const m of xml.matchAll(/<Placemark\b[^>]*>([\s\S]*?)<\/Placemark>/gi)) {
    const agent = agentFromPlacemark(m[1]);
    if (!agent) continue;
    const key = dedupeKey(agent);
    const prev = byKey.get(key);
    byKey.set(key, prev ? prefer(prev, agent) : agent);
  }
  return [...byKey.values()];
}

export function locateAgents(agents: FfmAgent[], points: Map<string, ZipPoint>): FfmAgent[] {
  return agents.map((a) => {
    const hit = a.zip ? points.get(a.zip) : undefined;
    if (!hit) return a;
    return {
      ...a,
      lat: a.lat ?? hit.lat,
      lng: a.lng ?? hit.lng,
      city: a.city || hit.city,
      region: a.region || hit.region,
    };
  });
}

export function zipIndex(agents: FfmAgent[]): Map<string, ZipPoint> {
  const out = new Map<string, ZipPoint>();
  for (const a of agents) {
    if (!a.zip || a.lat == null || a.lng == null || out.has(a.zip)) continue;
    out.set(a.zip, { lat: a.lat, lng: a.lng, city: a.city, region: a.region });
  }
  return out;
}

export function rankAgents(agents: FfmAgent[], origin: { lat: number; lng: number }): { tier: "ffm" | "ffm_nearest"; agents: (FfmAgent & { distanceMiles: number })[] } {
  const ranked = agents
    .filter((a): a is FfmAgent & { lat: number; lng: number } => a.lat != null && a.lng != null && validPoint(a.lat, a.lng))
    .map((a) => ({ ...a, distanceMiles: milesBetween(origin, { lat: a.lat, lng: a.lng }) }));
  ranked.sort((a, b) => a.distanceMiles - b.distanceMiles || (b.volume ?? -1) - (a.volume ?? -1) || (b.units ?? -1) - (a.units ?? -1) || a.name.localeCompare(b.name));
  const near = ranked.filter((a) => a.distanceMiles <= FFM_RADIUS_MILES);
  if (near.length) return { tier: "ffm", agents: near.slice(0, FFM_LIMIT) };
  return { tier: "ffm_nearest", agents: ranked.slice(0, FALLBACK_LIMIT) };
}

export function placeOf(a: FfmAgent): string {
  const city = [a.city, a.region].filter(Boolean).join(", ");
  if (city) return city;
  if (a.zip) return `ZIP ${a.zip}`;
  return "";
}

export function toPublicAgent(a: FfmAgent & { distanceMiles: number }): PublicAgent {
  const distanceMiles = Math.round(a.distanceMiles * 10) / 10;
  return {
    id: (a.email || `${a.name}|${a.zip}`).toLowerCase(),
    name: a.name,
    email: a.email,
    phone: a.phone,
    market: a.market,
    place: placeOf(a),
    level: a.level,
    volumeLabel: a.volumeLabel,
    unitsLabel: a.unitsLabel,
    distanceMiles,
    distanceLabel: formatMiles(distanceMiles),
    profileUrl: a.profileUrl,
    directoryUrl: directoryUrlForName(a.name),
    mapUrl: mapUrlForPoint(a),
    source: "ffm",
  };
}

export function buildLookup(p: {
  query: string;
  origin: { lat: number; lng: number; label: string } | null;
  agents: FfmAgent[];
  live: boolean;
  asOf: string;
}): AgentLookup {
  const links = sourceLinks({ location: p.query, lat: p.origin?.lat ?? null, lng: p.origin?.lng ?? null });
  if (!p.origin) {
    return {
      tier: "unplaced",
      radiusMiles: FFM_RADIUS_MILES,
      query: p.query,
      place: "",
      lat: null,
      lng: null,
      note: `Could not place "${p.query}" on a map, so no agent cards were ranked. Try City, ST or a ZIP code, or paste an agent below.`,
      live: p.live,
      asOf: p.asOf,
      agents: [],
      links,
    };
  }
  const ranked = rankAgents(p.agents, p.origin);
  const empty = ranked.agents.length === 0;
  const note = empty
    ? `Placed "${p.query}" at ${p.origin.label}, but no Fast Forward agents have a map point, so no cards were ranked. Use the directory links or paste an agent.`
    : optionsNote(ranked.tier);
  return {
    tier: empty ? "ffm_nearest" : ranked.tier,
    radiusMiles: FFM_RADIUS_MILES,
    query: p.query,
    place: p.origin.label,
    lat: p.origin.lat,
    lng: p.origin.lng,
    note,
    live: p.live,
    asOf: p.asOf,
    agents: ranked.agents.map(toPublicAgent),
    links,
  };
}
