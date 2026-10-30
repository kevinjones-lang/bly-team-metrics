// Counts on the Listings & Closings tab must match the published TV feed exactly.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  LISTINGS_FEED_URL,
  feedTotals,
  parseClosingsFeed,
  parseListingsFeed,
  parseMoney,
  type ListingsFeed,
} from "../src/listings/feed.ts";

function money(v: unknown): number {
  const n = parseMoney(v);
  assert.ok(n != null, "unparsed price " + JSON.stringify(v));
  return n;
}

function independent(raw: { listings?: unknown[]; leases?: unknown[] }) {
  const listings = raw.listings ?? [];
  const leases = raw.leases ?? [];
  const active = listings.filter((row) => row && typeof row === "object" && (row as { status?: string }).status === "Active");
  const under = listings.filter((row) => row && typeof row === "object" && /contract|pending|option/i.test(String((row as { status?: string }).status ?? "")));
  const activeLeases = leases.filter((row) => row && typeof row === "object" && (row as { status?: string }).status === "Active");
  const pendingLeases = leases.filter((row) => row && typeof row === "object" && /contract|pending|option/i.test(String((row as { status?: string }).status ?? "")));
  const sum = (rows: unknown[], key: "price" | "rent" = "price") => rows.reduce((s, row) => s + money((row as Record<string, unknown>)[key] ?? (row as Record<string, unknown>).price), 0);
  return {
    activeCount: active.length,
    underContractCount: under.length,
    leaseCount: leases.length,
    activeLeaseCount: activeLeases.length,
    pendingLeaseCount: pendingLeases.length,
    activeListVolume: sum(active),
    underContractVolume: sum(under),
    leaseRent: sum(leases, "rent"),
  };
}

const dirty = parseClosingsFeed({
  asOf: "2026-10-30T08:00:00-05:00",
  closings: [
    {
      address: "920 Bruce Ave, League City",
      price: "$45,000",
      expectedClose: "11/06",
      status: "Pending",
      agent: "Kevin Jones",
      url: "https://www.har.com/homedetail/example/1",
      buyer: "Secret Client",
      seller: "Other Client",
      email: "buyer@example.com",
      phone: "281-555-0100",
      meeting: "https://zoom.us/j/123",
    },
    { address: "buyer@example.com", price: "$1", expectedClose: "soon" },
    { address: "4830 Houston Drive, Galveston", price: "$231,390", expectedClose: "https://zoom.us/j/9", agent: "Ada <ada@example.com>" },
    { address: "3108 Rey Avenue, Baytown", price: "$153,000", expectedClose: "10/28", agent: "281-555-0199" },
  ],
});
assert.equal(dirty.closings.length, 3);
assert.equal(dirty.closings[2].agent, "");
assert.equal(dirty.closings[0].address, "920 Bruce Ave, League City");
assert.equal(dirty.closings[0].agent, "Kevin Jones");
assert.equal(dirty.closings[0].priceValue, 45000);
assert.equal(dirty.closings[1].expectedClose, "");
assert.equal(dirty.closings[1].agent, "");
const dumped = JSON.stringify(dirty);
assert.equal(dumped.includes("Secret"), false);
assert.equal(dumped.includes("buyer@"), false);
assert.equal(dumped.includes("zoom.us"), false);
assert.equal(dumped.includes("281-555"), false);
assert.equal(dumped.includes("ada@example"), false);

const hub = readFileSync(new URL("../src/Hub.tsx", import.meta.url), "utf8");
const nav = readFileSync(new URL("../src/nav.tsx", import.meta.url), "utf8");
assert.match(hub, /id: "listings", label: "Listings & Closings"/);
assert.match(nav, /id: "listings", label: "Listings & Closings"/);

const res = await fetch(LISTINGS_FEED_URL, { cache: "no-store" });
assert.equal(res.ok, true, "listings.json " + res.status);
const raw = await res.json() as { asOf?: string; listings?: unknown[]; leases?: unknown[] };
const feed: ListingsFeed = parseListingsFeed(raw);
const totals = feedTotals(feed);
const side = independent(raw);

assert.equal(feed.sales.length, (raw.listings ?? []).length);
assert.equal(feed.leases.length, (raw.leases ?? []).length);
assert.equal(totals.activeCount + totals.underContractCount + totals.otherCount, feed.sales.length);
assert.equal(totals.activeLeaseCount + totals.pendingLeaseCount + totals.otherLeaseCount, feed.leases.length);
assert.deepEqual(
  {
    activeCount: totals.activeCount,
    underContractCount: totals.underContractCount,
    leaseCount: totals.leaseCount,
    activeLeaseCount: totals.activeLeaseCount,
    pendingLeaseCount: totals.pendingLeaseCount,
    activeListVolume: totals.activeListVolume,
    underContractVolume: totals.underContractVolume,
    leaseRent: totals.leaseRent,
  },
  side,
);

console.log("asOf", raw.asOf);
console.log("ACTIVE", totals.activeCount);
console.log("UNDER_CONTRACT", totals.underContractCount);
console.log("LEASES", totals.leaseCount);
console.log("ACTIVE_LEASES", totals.activeLeaseCount);
console.log("PENDING_LEASES", totals.pendingLeaseCount);
console.log("ACTIVE_LIST_VOLUME", totals.activeListVolume);
console.log("UNDER_CONTRACT_VOLUME", totals.underContractVolume);
console.log("LEASE_RENT", totals.leaseRent);
console.log("listings feed check ok");
