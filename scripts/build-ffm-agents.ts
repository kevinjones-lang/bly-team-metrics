// Refresh the FFM agent cache committed for the referral-agents Edge Function.
// Usage: node --experimental-strip-types scripts/build-ffm-agents.ts
// No API keys. Reads the public Google My Map KML and GeoNames postal centroids (CC-BY 4.0).
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  FFM_KML_URL, FFM_MAP_ID, locateAgents, normalizeZip, parseFfmKml,
  type FfmAgent, type ZipPoint,
} from "../supabase/functions/referral-agents/logic.ts";

const OUT = new URL("../supabase/functions/referral-agents/ffm-agents.json", import.meta.url);
const UA = "BlyTeamReferralHub/1.0 (FFM agent cache; https://kevinjones-lang.github.io/bly-team-metrics/)";

async function text(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "*/*" } });
  if (!res.ok) throw new Error(`${url} returned ${res.status}`);
  return res.text();
}

async function downloadZip(url: string, dir: string, name: string): Promise<void> {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`${url} returned ${res.status}`);
  const file = join(dir, name);
  writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  execFileSync("unzip", ["-o", file, "-d", dir], { stdio: "ignore" });
}

/** GeoNames postal dump: country, postal, place, admin name, admin code, ..., lat, lng, accuracy. */
function readGeoNames(dir: string): Map<string, ZipPoint & { accuracy: number }> {
  const out = new Map<string, ZipPoint & { accuracy: number }>();
  const files = readdirSync(dir).filter((f) => f === "US.txt" || f === "CA.txt");
  for (const file of files) {
    const lines = readFileSync(join(dir, file), "utf8").split(/\n/);
    for (const line of lines) {
      if (!line.trim()) continue;
      const col = line.split("\t");
      const postal = normalizeZip(col[1] ?? "");
      const lat = Number(col[9]);
      const lng = Number(col[10]);
      if (!postal || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      const accuracy = Number(col[11]);
      const point = {
        lat,
        lng,
        city: (col[2] ?? "").trim(),
        region: (col[4] ?? "").trim(),
        accuracy: Number.isFinite(accuracy) ? accuracy : 0,
      };
      const prev = out.get(postal);
      if (!prev || point.accuracy > prev.accuracy) out.set(postal, point);
    }
  }
  return out;
}

async function lookupZip(zip: string): Promise<ZipPoint | null> {
  if (/^\d{5}$/.test(zip)) {
    const res = await fetch(`https://api.zippopotam.us/us/${zip}`, { headers: { Accept: "application/json", "User-Agent": UA } });
    if (!res.ok) return null;
    const body = await res.json() as { places?: { latitude?: string; longitude?: string; "place name"?: string; "state abbreviation"?: string }[] };
    const p = body.places?.[0];
    const lat = Number(p?.latitude);
    const lng = Number(p?.longitude);
    if (!p || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng, city: p["place name"] ?? "", region: p["state abbreviation"] ?? "" };
  }
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("postalcode", zip);
  url.searchParams.set("country", "Canada");
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  const res = await fetch(url, { headers: { Accept: "application/json", "User-Agent": UA } });
  if (!res.ok) return null;
  const body = await res.json() as { lat?: string; lon?: string; display_name?: string }[];
  const hit = body[0];
  const lat = Number(hit?.lat);
  const lng = Number(hit?.lon);
  if (!hit || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const bits = (hit.display_name ?? "").split(",").map((s) => s.trim());
  return { lat, lng, city: bits[0] ?? "", region: bits.length > 2 ? bits[bits.length - 2] ?? "" : "" };
}

async function fillGaps(agents: FfmAgent[]): Promise<FfmAgent[]> {
  const out: FfmAgent[] = [];
  for (const agent of agents) {
    if (agent.lat != null || !agent.zip) { out.push(agent); continue; }
    const hit = await lookupZip(agent.zip);
    if (/[A-Z]/.test(agent.zip)) await new Promise((r) => setTimeout(r, 1100));
    out.push(hit ? { ...agent, lat: hit.lat, lng: hit.lng, city: agent.city || hit.city, region: agent.region || hit.region } : agent);
  }
  return out;
}

function stripAccuracy(points: Map<string, ZipPoint & { accuracy: number }>): Map<string, ZipPoint> {
  const out = new Map<string, ZipPoint>();
  for (const [zip, p] of points) out.set(zip, { lat: p.lat, lng: p.lng, city: p.city, region: p.region });
  return out;
}

const xml = await text(FFM_KML_URL);
const parsed = parseFfmKml(xml);
if (parsed.length < 100) throw new Error(`FFM KML parsed ${parsed.length} agents; expected the public map.`);

const dir = mkdtempSync(join(tmpdir(), "ffm-zip-"));
await downloadZip("https://download.geonames.org/export/zip/US.zip", dir, "US.zip");
await downloadZip("https://download.geonames.org/export/zip/CA.zip", dir, "CA.zip");
const located = await fillGaps(locateAgents(parsed, stripAccuracy(readGeoNames(dir))));
const withPoint = located.filter((a) => a.lat != null && a.lng != null);
const missing = located.filter((a) => a.lat == null).map((a) => `${a.name} ${a.zip || "(no zip)"}`);

located.sort((a, b) => a.name.localeCompare(b.name) || a.zip.localeCompare(b.zip));

const body = {
  generatedAt: new Date().toISOString(),
  mapId: FFM_MAP_ID,
  kmlUrl: FFM_KML_URL,
  attribution: "Agent rows from the public Fast Forward Movement Google My Map. ZIP city and centroid from GeoNames (https://www.geonames.org/) under CC-BY 4.0 when the KML pin is missing.",
  agentCount: located.length,
  withPoint: withPoint.length,
  agents: located satisfies FfmAgent[],
};

writeFileSync(OUT, `${JSON.stringify(body, null, 2)}\n`);
console.log(`wrote ${located.length} agents (${withPoint.length} with a point) to ${OUT.pathname}`);
if (missing.length) console.log("no point:", missing.join("; "));
