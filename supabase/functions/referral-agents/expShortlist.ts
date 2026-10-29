// eXp top-5 shortlist ranking. No network.
// The public eXp directory search requires a reCAPTCHA token and sorts randomly,
// so this ranks only a directory file or URL the owner supplies. Manual paste stays available.

import { directoryUrlForName, formatMiles, milesBetween } from "./logic.ts";

export const EXP_LIMIT = 5;
export const EXP_DIRECTORY_SEARCH = "https://www.exprealty.com/agents-search";

export type ExpDirectoryAgent = {
  name: string;
  email: string;
  phone: string;
  city: string;
  region: string;
  lat: number | null;
  lng: number | null;
  volume: number | null;
  volumeLabel: string;
  market: string;
};

export type ExpCandidate = {
  id: string;
  name: string;
  email: string;
  phone: string;
  place: string;
  market: string;
  distanceMiles: number;
  distanceLabel: string;
  volumeLabel: string;
  directoryUrl: string;
  source: "exp";
};

export type ExpShortlist = {
  status: "ranked" | "stub";
  source: string;
  note: string;
  searchUrl: string;
  skipped: number;
  agents: ExpCandidate[];
};

const STUB_NOTE = [
  "eXp top 5 is not automated yet.",
  "The public eXp agent directory (the GraphQL search behind exprealty.com/agents-search) requires a reCAPTCHA token and returns a random page, not a production ranking.",
  "There is no credential-free feed of eXp agents with map points in this project.",
  "Paste the receiving agent you choose. That manual choice still wins.",
  "To turn ranking on, set the Edge Function secret EXP_DIRECTORY_JSON_URL to an https JSON file you control, or fill supabase/functions/referral-agents/exp-agents.json and redeploy referral-agents.",
  "Each agent needs a name and lat/lng. Email, phone, city, region, volume, and market are optional. The nearest 5 with map points are shown. Higher volume breaks a distance tie.",
].join(" ");

export function stubExpShortlist(location: string, source = "none"): ExpShortlist {
  const where = location.trim();
  return {
    status: "stub",
    source,
    note: where ? `${STUB_NOTE} Location: ${where}.` : STUB_NOTE,
    searchUrl: directorySearchUrl(where),
    skipped: 0,
    agents: [],
  };
}

export function directorySearchUrl(location: string): string {
  const url = new URL(EXP_DIRECTORY_SEARCH);
  const text = location.trim();
  if (text) url.searchParams.set("location", text);
  url.searchParams.set("country", "US");
  return url.toString();
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function coord(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

function volumeOf(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
  return value;
}

export function parseExpDirectory(value: unknown): ExpDirectoryAgent[] {
  const list = Array.isArray(value)
    ? value
    : value && typeof value === "object" && Array.isArray((value as { agents?: unknown }).agents)
      ? (value as { agents: unknown[] }).agents
      : [];
  const out: ExpDirectoryAgent[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const name = text(row.name);
    if (!name || name.length > 200) continue;
    const lat = coord(row.lat);
    const lng = coord(row.lng);
    const pointOk = lat != null && lng != null && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 && !(lat === 0 && lng === 0);
    out.push({
      name,
      email: text(row.email).slice(0, 320),
      phone: text(row.phone).slice(0, 40),
      city: text(row.city).slice(0, 80),
      region: text(row.region).slice(0, 40),
      lat: pointOk ? lat : null,
      lng: pointOk ? lng : null,
      volume: volumeOf(row.volume),
      volumeLabel: text(row.volumeLabel).slice(0, 80),
      market: text(row.market).slice(0, 180),
    });
    if (out.length >= 5000) break;
  }
  return out;
}

export function rankExpAgents(agents: ExpDirectoryAgent[], origin: { lat: number; lng: number }): { agents: ExpCandidate[]; skipped: number } {
  const placed = agents.filter((agent): agent is ExpDirectoryAgent & { lat: number; lng: number } => agent.lat != null && agent.lng != null);
  const skipped = agents.length - placed.length;
  const ranked = placed
    .map((agent) => ({ ...agent, distanceMiles: milesBetween(origin, { lat: agent.lat, lng: agent.lng }) }))
    .sort((a, b) => a.distanceMiles - b.distanceMiles || (b.volume ?? -1) - (a.volume ?? -1) || a.name.localeCompare(b.name))
    .slice(0, EXP_LIMIT);
  return {
    skipped,
    agents: ranked.map((agent) => {
      const distanceMiles = Math.round(agent.distanceMiles * 10) / 10;
      const place = [agent.city, agent.region].filter(Boolean).join(", ");
      return {
        id: (agent.email || `${agent.name}|${place}`).toLowerCase(),
        name: agent.name,
        email: agent.email,
        phone: agent.phone,
        place,
        market: agent.market,
        distanceMiles,
        distanceLabel: formatMiles(distanceMiles),
        volumeLabel: agent.volumeLabel,
        directoryUrl: directoryUrlForName(agent.name),
        source: "exp" as const,
      };
    }),
  };
}

export function expShortlistFromDirectory(input: {
  location: string;
  origin: { lat: number; lng: number; label: string } | null;
  agents: ExpDirectoryAgent[];
  source: string;
  warning?: string;
}): ExpShortlist {
  const warning = input.warning?.trim();
  if (!input.agents.length) {
    const stub = stubExpShortlist(input.location, input.source);
    return warning ? { ...stub, note: `${warning} ${stub.note}` } : stub;
  }
  if (!input.origin) {
    return {
      status: "stub",
      source: input.source,
      note: `Could not place this location, so the eXp directory was not ranked. ${warning ?? ""}`.trim(),
      searchUrl: directorySearchUrl(input.location),
      skipped: input.agents.length,
      agents: [],
    };
  }
  const ranked = rankExpAgents(input.agents, input.origin);
  if (!ranked.agents.length) {
    return {
      status: "stub",
      source: input.source,
      note: `The eXp directory has ${input.agents.length} people and none have a map point, so no top 5 was ranked. Add lat and lng, or paste an agent. ${warning ?? ""}`.trim(),
      searchUrl: directorySearchUrl(input.location),
      skipped: ranked.skipped,
      agents: [],
    };
  }
  const skipped = ranked.skipped ? ` ${ranked.skipped} without a map point were left out.` : "";
  return {
    status: "ranked",
    source: input.source,
    note: `Nearest ${ranked.agents.length} eXp agents from the supplied directory.${skipped} Paste someone else if none of these is the right agent. ${warning ?? ""}`.trim(),
    searchUrl: directorySearchUrl(input.location),
    skipped: ranked.skipped,
    agents: ranked.agents,
  };
}
