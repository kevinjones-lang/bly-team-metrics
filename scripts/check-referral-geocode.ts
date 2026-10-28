// Live geocode proof for the referral-agents Edge Function.
// Nominatim, then Open-Meteo, then Photon. No API key.
// Usage: node --experimental-strip-types scripts/check-referral-geocode.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { geocodeOpenMeteo, geocodePhoton, geocodePlace } from "../supabase/functions/referral-agents/geocode.ts";
import { FFM_LIMIT, FFM_RADIUS_MILES, FALLBACK_LIMIT, buildLookup, type FfmAgent } from "../supabase/functions/referral-agents/logic.ts";

function nearDallas(hit: { lat: number; lng: number } | null): void {
  assert.ok(hit, "expected a Dallas point");
  assert.ok(Math.abs(hit.lat - 32.78) < 0.25, `lat ${hit.lat}`);
  assert.ok(Math.abs(hit.lng + 96.8) < 0.4, `lng ${hit.lng}`);
}

const cache = JSON.parse(readFileSync(new URL("../supabase/functions/referral-agents/ffm-agents.json", import.meta.url), "utf8")) as { agents: FfmAgent[] };

const meteo = await geocodeOpenMeteo("Dallas, TX");
nearDallas(meteo);
const photon = await geocodePhoton("Dallas, TX");
nearDallas(photon);

const dallasHit = await geocodePlace("Dallas, TX");
nearDallas(dallasHit);
const dallas = buildLookup({ query: "Dallas, TX", origin: dallasHit, agents: cache.agents, live: false, asOf: "geocode" });
assert.equal(dallas.tier, "ffm_nearest");
assert.equal(dallas.agents.length, FALLBACK_LIMIT);
assert.ok(dallas.agents.every((agent) => agent.distanceMiles > FFM_RADIUS_MILES && agent.distanceLabel.endsWith(" mi")));
assert.ok(dallas.agents.some((agent) => /Fort Worth/i.test(agent.place)));

const carlsbadHit = await geocodePlace("Carlsbad, CA");
assert.ok(carlsbadHit);
assert.ok(Math.abs(carlsbadHit.lat - 33.15) < 0.2, `carlsbad lat ${carlsbadHit.lat}`);
assert.ok(Math.abs(carlsbadHit.lng + 117.34) < 0.3, `carlsbad lng ${carlsbadHit.lng}`);
const carlsbad = buildLookup({ query: "Carlsbad, CA", origin: carlsbadHit, agents: cache.agents, live: false, asOf: "geocode" });
assert.equal(carlsbad.tier, "ffm");
assert.ok(carlsbad.agents.length >= 1 && carlsbad.agents.length <= FFM_LIMIT);
assert.ok(carlsbad.agents.every((agent) => agent.distanceMiles <= FFM_RADIUS_MILES && agent.distanceLabel.endsWith(" mi")));

console.log("geocode ok");
console.log("Dallas, TX:", dallasHit?.label, dallas.agents.map((agent) => `${agent.distanceLabel} ${agent.name} (${agent.place})`).join("; "));
console.log("Carlsbad, CA:", carlsbadHit?.label, carlsbad.agents.map((agent) => `${agent.distanceLabel} ${agent.name} (${agent.place})`).join("; "));
