// referral-agents: staff-only Fast Forward agent options near a referral location.
// Auth: caller JWT -> public.is_staff(). No API key. The agent cache is ffm-agents.json
// (public FFM map + GeoNames ZIP centroids). A background refresh re-reads the public KML.
import { createClient } from "npm:@supabase/supabase-js@2";
import { geocodePlace, geocodeUsZip } from "./geocode.ts";
import {
  FFM_KML_URL, buildLookup, locateAgents, parseFfmKml, zipIndex,
  type FfmAgent,
} from "./logic.ts";
import cache from "./ffm-agents.json" with { type: "json" };

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const UA = "BlyTeamReferralHub/1.0 (FFM map refresh)";
const TTL_MS = 12 * 60 * 60 * 1000;

const j = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

type CacheFile = { generatedAt?: string; agents?: FfmAgent[] };

function bundled(): { agents: FfmAgent[]; asOf: string } {
  const file = cache as CacheFile;
  return {
    agents: Array.isArray(file.agents) ? file.agents : [],
    asOf: typeof file.generatedAt === "string" ? file.generatedAt : "",
  };
}

let memory: { at: number; agents: FfmAgent[] } | null = null;
let refreshing = false;

async function refreshKml(base: FfmAgent[]): Promise<FfmAgent[]> {
  const res = await fetch(FFM_KML_URL, {
    headers: { "User-Agent": UA, Accept: "application/xml,text/xml,*/*" },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`kml ${res.status}`);
  const parsed = parseFfmKml(await res.text());
  if (parsed.length < 100) throw new Error("kml short");
  const located = locateAgents(parsed, zipIndex(base));
  const missing = [...new Set(located.filter((a) => a.lat == null && /^\d{5}$/.test(a.zip)).map((a) => a.zip))].slice(0, 8);
  if (!missing.length) return located;
  const found = new Map<string, { lat: number; lng: number; city: string; region: string }>();
  await Promise.all(missing.map(async (zip) => {
    const hit = await geocodeUsZip(zip);
    if (hit) found.set(zip, { lat: hit.lat, lng: hit.lng, city: hit.city, region: hit.region });
  }));
  return locateAgents(located, found);
}

function scheduleRefresh(base: FfmAgent[]): void {
  if (refreshing || (memory && Date.now() - memory.at < TTL_MS)) return;
  refreshing = true;
  const job = refreshKml(base).then((agents) => {
    memory = { at: Date.now(), agents };
  }).catch(() => {
    /* The committed cache still answers this lookup. */
  }).finally(() => {
    refreshing = false;
  });
  const waitUntil = (globalThis as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } }).EdgeRuntime?.waitUntil;
  if (waitUntil) waitUntil(job);
}

function agentsNow(): { agents: FfmAgent[]; live: boolean; asOf: string } {
  const file = bundled();
  if (memory && Date.now() - memory.at < TTL_MS) {
    return { agents: memory.agents, live: true, asOf: new Date(memory.at).toISOString() };
  }
  scheduleRefresh(file.agents);
  return { agents: file.agents, live: false, asOf: file.asOf };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return j({ error: "POST a JSON body { location }." }, 405);

  const auth = req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return j({ error: "unauthorized" }, 401);
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
  const { data: u, error: ue } = await sb.auth.getUser(auth.slice(7));
  if (ue || !u?.user) return j({ error: "unauthorized" }, 401);
  const { data: staff } = await sb.rpc("is_staff");
  if (!staff) return j({ error: "forbidden" }, 403);

  let body: { location?: unknown };
  try { body = await req.json(); } catch { return j({ error: "bad json" }, 400); }
  const location = typeof body?.location === "string" ? body.location.trim() : "";
  if (!location) return j({ error: "Add a city, state, or ZIP so agent options can be ranked." }, 400);
  if (location.length > 500) return j({ error: "Location is too long." }, 400);

  const { agents, live, asOf } = agentsNow();
  let origin: { lat: number; lng: number; label: string } | null = null;
  try {
    origin = await geocodePlace(location);
  } catch {
    origin = null;
  }
  return j(buildLookup({ query: location, origin, agents, live, asOf }));
});
