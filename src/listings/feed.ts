// Published Bly TV feed. The hub reads this JSON; it does not call HAR or the closing-board sheet.
// https://kevinjones-lang.github.io/bly-tv-listings/listings.json

export const TV_ORIGIN = "https://kevinjones-lang.github.io/bly-tv-listings/";
export const LISTINGS_FEED_URL = TV_ORIGIN + "listings.json";
export const CLOSINGS_FEED_URL = TV_ORIGIN + "closings.json";

export type Sale = {
  id: string;
  street: string;
  city: string;
  price: string;
  priceValue: number | null;
  status: string;
  type: string;
  beds: number | null;
  fullBaths: number | null;
  halfBaths: number | null;
  sqft: number | null;
  lot: string | null;
  url: string;
  photo: string | null;
  pending: boolean;
};

export type Lease = Sale & { monthly: boolean };

export type Closing = {
  address: string;
  price: string;
  priceValue: number | null;
  expectedClose: string;
  status: string;
  agent: string;
  url: string;
};

export type ListingsFeed = {
  asOf: string;
  leaseAsOf: string;
  source: string;
  leaseSource: string;
  sales: Sale[];
  leases: Lease[];
};

export type ClosingsFeed = { asOf: string; closings: Closing[] };

export type FeedTotals = {
  activeCount: number;
  underContractCount: number;
  otherCount: number;
  leaseCount: number;
  activeLeaseCount: number;
  pendingLeaseCount: number;
  otherLeaseCount: number;
  activeListVolume: number;
  underContractVolume: number;
  leaseRent: number;
};

const EMAIL_RE = /\S+@\S+\.\S+/;
const MEETING_RE = /zoom\.us|meet\.google\.com|teams\.microsoft|teams\.live|webex\.com/i;
const PHONE_RE = /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}/;

export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function str(v: unknown): string {
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return "";
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v !== "string") return null;
  const t = v.replace(/,/g, "").trim();
  if (!/^-?\d+(?:\.\d+)?$/.test(t)) return null;
  return Number(t);
}

/** Dollar amount at the start of a feed price such as "$330,000" or "$2,150/mo". */
export function parseMoney(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v !== "string") return null;
  const t = v.replace(/[$,\s]/g, "");
  const m = /^(-?\d+(?:\.\d+)?)/.exec(t);
  return m ? Number(m[1]) : null;
}

export function formatMoney(n: number): string {
  return "$" + Math.round(n).toLocaleString("en-US");
}

export function isPendingStatus(status: string): boolean {
  return /contract|pending|option/i.test(status);
}

export function isActiveStatus(status: string): boolean {
  return /^active$/i.test(status.trim());
}

export function formatAsOf(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-US", {
    timeZone: "America/Chicago",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }) + " CT";
}

/** TV-hosted photo only. Relative paths resolve on the Pages site; HAR hotlinks are not used. */
export function absolutePhoto(photo: unknown): string | null {
  const s = str(photo);
  if (!s || /^javascript:/i.test(s)) return null;
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith("//")) return "https:" + s;
  return TV_ORIGIN + s.replace(/^\//, "");
}

function httpUrl(v: unknown): string {
  const s = str(v);
  if (!/^https?:\/\//i.test(s)) return "";
  if (MEETING_RE.test(s)) return "";
  return s;
}

function cleanLot(lot: string): string {
  return lot.replace(/lot sqft\.?/i, "sf lot").replace(/acres?/i, "ac");
}

function bathsLabel(full: number | null, half: number | null): string {
  if (full == null && half == null) return "";
  if (full == null) return half ? half + " half ba" : "";
  if (half) return full + "/" + half + " ba";
  return full + " ba";
}

export function featureLine(row: Pick<Sale, "beds" | "fullBaths" | "halfBaths" | "sqft" | "lot">): string {
  const parts: string[] = [];
  if (row.beds != null) parts.push(row.beds + " bd");
  const baths = bathsLabel(row.fullBaths, row.halfBaths);
  if (baths) parts.push(baths);
  if (row.sqft != null && row.sqft > 0) parts.push(row.sqft.toLocaleString("en-US") + " sf");
  else if (row.lot) parts.push(cleanLot(row.lot));
  return parts.join(" · ");
}

function leaseBaths(row: Record<string, unknown>): { full: number | null; half: number | null } {
  const full = num(row.fullBaths);
  const half = num(row.halfBaths);
  if (full != null || half != null) return { full, half };
  const baths = str(row.baths);
  const fm = /(\d+)\s*full/i.exec(baths);
  const hm = /(\d+)\s*half/i.exec(baths);
  return { full: fm ? Number(fm[1]) : null, half: hm ? Number(hm[1]) : null };
}

function parseSale(row: Record<string, unknown>, kind: "sale" | "lease"): Sale {
  const id = str(row.id) || str(row.listingId);
  const price = str(row.price) || str(row.rent);
  const status = str(row.status);
  const sq = num(row.sqft);
  return {
    id,
    street: str(row.street) || (id ? "Listing " + id : "Listing"),
    city: str(row.city),
    price,
    priceValue: parseMoney(price),
    status,
    type: str(row.type) || str(row.propertyType),
    beds: num(row.beds),
    fullBaths: kind === "lease" ? leaseBaths(row).full : num(row.fullBaths),
    halfBaths: kind === "lease" ? leaseBaths(row).half : num(row.halfBaths),
    sqft: sq,
    lot: str(row.lot) || null,
    url: httpUrl(row.url) || httpUrl(row.harUrl),
    photo: absolutePhoto(row.photo),
    pending: isPendingStatus(status),
  };
}

export function parseListingsFeed(raw: unknown): ListingsFeed {
  const rec = isRecord(raw) ? raw : {};
  const listings = Array.isArray(rec.listings) ? rec.listings : [];
  const leases = Array.isArray(rec.leases) ? rec.leases : [];
  const sales = listings.filter(isRecord).filter((row) => row.kind !== "lease").map((row) => parseSale(row, "sale"));
  const fromListings = listings.filter(isRecord).filter((row) => row.kind === "lease").map((row) => parseSale(row, "lease"));
  const leaseRows = leases.filter(isRecord).map((row) => parseSale(row, "lease")).concat(fromListings);
  return {
    asOf: str(rec.asOf),
    leaseAsOf: str(rec.leaseAsOf),
    source: httpUrl(rec.source),
    leaseSource: httpUrl(rec.leaseSource),
    sales,
    leases: leaseRows.map((row) => ({ ...row, monthly: true })),
  };
}

function sensitive(v: string): boolean {
  return EMAIL_RE.test(v) || MEETING_RE.test(v) || PHONE_RE.test(v);
}

/** Whitelist for a future TV closings.json. Buyer, seller, email, phone, and meeting links never pass through. */
export function parseClosingsFeed(raw: unknown): ClosingsFeed {
  if (!isRecord(raw)) return { asOf: "", closings: [] };
  const list = Array.isArray(raw.closings) ? raw.closings : [];
  const closings: Closing[] = [];
  for (const item of list) {
    if (!isRecord(item)) continue;
    const address = str(item.address);
    if (!address || sensitive(address)) continue;
    const agent = str(item.agent);
    const status = str(item.status);
    const expectedClose = str(item.expectedClose);
    const price = str(item.price);
    closings.push({
      address,
      price,
      priceValue: parseMoney(price),
      expectedClose: sensitive(expectedClose) ? "" : expectedClose,
      status: sensitive(status) ? "" : status,
      agent: sensitive(agent) ? "" : agent,
      url: httpUrl(item.url),
    });
  }
  return { asOf: str(raw.asOf), closings };
}

function sumPrices(rows: { priceValue: number | null }[]): number {
  return rows.reduce((s, r) => s + (r.priceValue ?? 0), 0);
}

export function feedTotals(feed: ListingsFeed): FeedTotals {
  const active = feed.sales.filter((r) => isActiveStatus(r.status));
  const under = feed.sales.filter((r) => r.pending);
  const other = feed.sales.filter((r) => !isActiveStatus(r.status) && !r.pending);
  const activeLeases = feed.leases.filter((r) => isActiveStatus(r.status));
  const pendingLeases = feed.leases.filter((r) => r.pending);
  const otherLeases = feed.leases.filter((r) => !isActiveStatus(r.status) && !r.pending);
  return {
    activeCount: active.length,
    underContractCount: under.length,
    otherCount: other.length,
    leaseCount: feed.leases.length,
    activeLeaseCount: activeLeases.length,
    pendingLeaseCount: pendingLeases.length,
    otherLeaseCount: otherLeases.length,
    activeListVolume: sumPrices(active),
    underContractVolume: sumPrices(under),
    leaseRent: sumPrices(feed.leases),
  };
}

export function splitSales(feed: ListingsFeed): { active: Sale[]; underContract: Sale[]; other: Sale[] } {
  return {
    active: feed.sales.filter((r) => isActiveStatus(r.status)),
    underContract: feed.sales.filter((r) => r.pending),
    other: feed.sales.filter((r) => !isActiveStatus(r.status) && !r.pending),
  };
}
