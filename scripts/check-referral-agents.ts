import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  FFM_LIMIT, FFM_RADIUS_MILES, FALLBACK_LIMIT, buildLookup, formatMiles, levelShort, milesBetween,
  parseFfmKml, parseMoney, parseUnits, rankAgents, sourceLinks,
  type FfmAgent,
} from "../supabase/functions/referral-agents/logic.ts";

const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"><Document><Folder>
<Placemark>
  <name>Ada Lovelace </name>
  <description>Email Address: ada@exp.com&lt;br&gt;Primary Zip Code: 80301</description>
  <ExtendedData>
    <Data name="Email Address"><value>ada@exp.com</value></Data>
    <Data name="Cell"><value>303-555-0100</value></Data>
    <Data name="Primary Zip Code"><value>80301</value></Data>
    <Data name="Fast Forward Movement Level"><value>Generals ($50M+ or 100+ Units) {Boulder and the north metro. https://ada.example/profile}</value></Data>
    <Data name="Trailing 12 Months Closed Volume"><value>$16M</value></Data>
    <Data name="Trailing 12 Months Closed Units"><value>33 units</value></Data>
  </ExtendedData>
  <Point><coordinates>-105.27,40.01,0</coordinates></Point>
</Placemark>
<Placemark>
  <name>Ada Lovelace</name>
  <ExtendedData>
    <Data name="Email Address"><value>Ada@exp.com</value></Data>
    <Data name="Primary Zip Code"><value>80301</value></Data>
    <Data name="Fast Forward Movement Level"><value>Lieutenants ($15M+ or 30+ Units)</value></Data>
  </ExtendedData>
</Placemark>
<Placemark>
  <name>480-555-0100</name>
  <ExtendedData><Data name="Primary Zip Code"><value>85326</value></Data></ExtendedData>
</Placemark>
<Placemark>
  <name>Grace Hopper</name>
  <ExtendedData>
    <Data name="Email Address"><value>grace@exp.com</value></Data>
    <Data name="Primary Zip Code"><value>10001</value></Data>
    <Data name="Fast Forward Movement Level"><value>Lieutenants ($15M+ or 30+ Units)</value></Data>
    <Data name="Trailing 12 Months Closed Volume"><value>$23,597,000.00</value></Data>
    <Data name="Trailing 12 Months Closed Units"><value>97 units</value></Data>
  </ExtendedData>
</Placemark>
</Folder></Document></kml>`;

const parsed = parseFfmKml(kml);
assert.equal(parsed.length, 2);
const ada = parsed.find((a) => a.email === "ada@exp.com");
assert.ok(ada);
assert.equal(ada.level, "Generals");
assert.equal(ada.volume, 16_000_000);
assert.equal(ada.units, 33);
assert.equal(ada.lat, 40.01);
assert.equal(ada.lng, -105.27);
assert.equal(ada.profileUrl, "https://ada.example/profile");
assert.match(ada.market, /Boulder/);
assert.equal(parseMoney("$30M+"), 30_000_000);
assert.equal(parseUnits("97 units"), 97);
assert.equal(levelShort("General ($50M+ or 100+ units)"), "Generals");
assert.equal(parseFfmKml("<html>nope</html>").length, 0);
const maps = parseFfmKml(`<Placemark><name>Pat Maps</name><ExtendedData>
  <Data name="Email Address"><value>pat@exp.com</value></Data>
  <Data name="Fast Forward Movement Level"><value>Lieutenants ($15M+ or 30+ Units) {See https://www.google.com/maps/d/edit?mid=abc and https://pat.example/about}</value></Data>
</ExtendedData></Placemark>`);
assert.equal(maps[0]?.profileUrl, "https://pat.example/about");

function agent(p: Partial<FfmAgent> & { name: string; lat: number | null; lng: number | null }): FfmAgent {
  return {
    email: "", phone: "", zip: "", city: "", region: "", level: "", volumeLabel: "", volume: null,
    unitsLabel: "", units: null, market: "", profileUrl: "", ...p,
  };
}

const origin = { lat: 40, lng: -105 };
const near = agent({ name: "Near", lat: 40.05, lng: -105, volume: 1 });
const mid = agent({ name: "Mid", lat: 40.2, lng: -105, volume: 5 });
const edge = agent({ name: "Edge", lat: 40.27, lng: -105, volume: 9 });
const far = agent({ name: "Far", lat: 41, lng: -105, volume: 50 });
const blank = agent({ name: "Unplotted", lat: null, lng: null });
assert.ok(milesBetween(origin, near) < FFM_RADIUS_MILES);
assert.ok(milesBetween(origin, edge) < FFM_RADIUS_MILES);
assert.ok(milesBetween(origin, far) > FFM_RADIUS_MILES);

const close = rankAgents([far, blank, edge, near, mid], origin);
assert.equal(close.tier, "ffm");
assert.deepEqual(close.agents.map((a) => a.name), ["Near", "Mid", "Edge"]);
assert.ok(close.agents.length <= FFM_LIMIT);

const high = agent({ name: "High", lat: 40.1, lng: -105, volume: 100 });
const low = agent({ name: "Low", lat: 40.1, lng: -105, volume: 1 });
assert.equal(rankAgents([low, high], origin).agents[0].name, "High");

const away = rankAgents([far, agent({ name: "Farther", lat: 42, lng: -105, volume: 1 })], origin);
assert.equal(away.tier, "ffm_nearest");
assert.equal(away.agents[0].name, "Far");
assert.ok(away.agents.length <= FALLBACK_LIMIT);
assert.equal(formatMiles(6.34), "6.3 mi");
assert.equal(formatMiles(12.4), "12 mi");

const unplaced = buildLookup({ query: "somewhere", origin: null, agents: [near], live: false, asOf: "t" });
assert.equal(unplaced.tier, "unplaced");
assert.equal(unplaced.agents.length, 0);
assert.match(unplaced.links.expDirectory, /location=somewhere/);
assert.equal(unplaced.links.expHub, "https://hub.exprealty.com/connect/group/us-corp-exp-referral-network");
assert.equal(unplaced.links.expGlobal, "https://agents.exprealty.com/");
assert.match(sourceLinks({ location: "", lat: 33.1, lng: -117.3 }).ffmMap, /ll=33\.1%2C-117\.3|ll=33.1,-117.3/);

const cache = JSON.parse(readFileSync(new URL("../supabase/functions/referral-agents/ffm-agents.json", import.meta.url), "utf8")) as { agents: FfmAgent[]; agentCount: number; withPoint: number };
assert.ok(cache.agentCount >= 300);
assert.ok(cache.withPoint >= cache.agentCount - 10);

const carlsbad = { lat: 33.1352045, lng: -117.329126, label: "Carlsbad, California" };
const carlsbadLookup = buildLookup({ query: "Carlsbad, CA", origin: carlsbad, agents: cache.agents, live: false, asOf: "cache" });
assert.equal(carlsbadLookup.tier, "ffm");
assert.ok(carlsbadLookup.agents.length >= 1 && carlsbadLookup.agents.length <= FFM_LIMIT);
assert.ok(carlsbadLookup.agents.every((a) => a.distanceMiles <= FFM_RADIUS_MILES));
assert.ok(carlsbadLookup.agents.every((a) => a.place !== "Houston, TX"));
assert.match(carlsbadLookup.agents[0].directoryUrl, /name=/);
assert.equal(carlsbadLookup.agents[0].source, "ffm");

const boulder = { lat: 40.0149856, lng: -105.270545, label: "Boulder, CO" };
const boulderLookup = buildLookup({ query: "Boulder, CO", origin: boulder, agents: cache.agents, live: false, asOf: "cache" });
assert.equal(boulderLookup.tier, "ffm_nearest");
assert.equal(boulderLookup.agents.length, FALLBACK_LIMIT);
assert.ok(boulderLookup.agents.every((a) => a.distanceMiles > FFM_RADIUS_MILES));
assert.match(boulderLookup.links.expDirectory, /Boulder/);

const self = cache.agents.find((a) => a.lat != null && a.city === "Carlsbad" && a.region === "CA");
assert.ok(self && self.lat != null && self.lng != null);
const aroundSelf = rankAgents(cache.agents, { lat: self.lat, lng: self.lng });
assert.equal(aroundSelf.tier, "ffm");
assert.equal(aroundSelf.agents[0].email, self.email);
assert.ok(aroundSelf.agents[0].distanceMiles < 1);

console.log("referral agents ok");
console.log("Carlsbad, CA:", carlsbadLookup.agents.map((a) => `${a.distanceLabel} ${a.name} (${a.place})`).join("; "));
console.log("Boulder, CO fallback:", boulderLookup.agents.map((a) => `${a.distanceLabel} ${a.name} (${a.place})`).join("; "));
