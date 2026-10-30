import { useEffect, useState, type ReactNode } from "react";
import { Segmented, Table } from "../kit";
import "./listings.css";
import {
  CLOSINGS_FEED_URL,
  LISTINGS_FEED_URL,
  featureLine,
  feedTotals,
  formatAsOf,
  formatMoney,
  parseClosingsFeed,
  parseListingsFeed,
  splitSales,
  type Closing,
  type ClosingsFeed,
  type Lease,
  type ListingsFeed,
  type Sale,
} from "./feed";

type SectionId = "active" | "contract" | "leases" | "closings";
type ClosingsState = { kind: "missing" } | { kind: "ready"; feed: ClosingsFeed };
type Load =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "ready"; listings: ListingsFeed; closings: ClosingsState };

function bust(url: string): string {
  return url + (url.includes("?") ? "&" : "?") + "_=" + Date.now();
}

async function loadFeed(): Promise<{ listings: ListingsFeed; closings: ClosingsState }> {
  const [listingsRes, closingsRes] = await Promise.all([
    fetch(bust(LISTINGS_FEED_URL), { cache: "no-store" }),
    fetch(bust(CLOSINGS_FEED_URL), { cache: "no-store" }),
  ]);
  if (!listingsRes.ok) throw new Error("listings " + listingsRes.status);
  const listings = parseListingsFeed(await listingsRes.json());
  if (!closingsRes.ok) return { listings, closings: { kind: "missing" } };
  try {
    return { listings, closings: { kind: "ready", feed: parseClosingsFeed(await closingsRes.json()) } };
  } catch {
    return { listings, closings: { kind: "missing" } };
  }
}

function Photo({ src, alt, label, compact }: { src: string | null; alt: string; label: string; compact?: boolean }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  const cls = "lc-photo" + (compact ? " lc-thumb" : "");
  if (!src || failed) return <div className={cls + " lc-photo-empty"} aria-hidden="true">{label}</div>;
  return <img className={cls} src={src} alt={alt} onError={() => setFailed(true)} />;
}

function priceNode(price: string, monthly: boolean): ReactNode {
  if (!price) return "—";
  const hasMo = /\/\s*mo|per\s+month|\/\s*month/i.test(price);
  if (!monthly || hasMo) return price;
  return <>{price}<span className="lc-mo">/mo</span></>;
}

function PropertyCard({ row, monthly, placeholder }: { row: Sale | Lease; monthly: boolean; placeholder: string }) {
  const meta = [featureLine(row), row.type].filter(Boolean).join(" · ");
  return (
    <li className={"lc-card" + (row.pending ? " pending" : "")}>
      <Photo src={row.photo} alt="" label={placeholder} />
      <div className="lc-body">
        <h3 className="serif lc-street">{row.street}</h3>
        {row.city ? <p className="lc-city">{row.city}</p> : null}
        <div className="lc-row">
          <span className="lc-price">{priceNode(row.price, monthly)}</span>
          <span className={"lc-status" + (row.pending ? " pending" : "")}>{row.status || "—"}</span>
        </div>
        {meta ? <p className="lc-meta">{meta}</p> : null}
        {row.url ? <a className="lc-link" href={row.url} target="_blank" rel="noopener noreferrer">View on HAR</a> : null}
      </div>
    </li>
  );
}

function propertyRows(rows: Array<Sale | Lease>, monthly: boolean, placeholder: string) {
  return rows.map((row) => {
    const meta = [featureLine(row), row.type].filter(Boolean).join(" · ");
    const sub = [row.city, meta].filter(Boolean).join(" · ");
    return [
      {
        text: row.street + (row.city ? ", " + row.city : ""),
        sort: (row.street + " " + row.city).toLowerCase(),
        node: (
          <div className="lc-line">
            <Photo src={row.photo} alt="" label={placeholder} compact />
            <div className="lc-line-copy">
              <div className="lc-line-title">{row.street}</div>
              {sub ? <div className="lc-line-sub">{sub}</div> : null}
              {row.url ? <a className="lc-link" href={row.url} target="_blank" rel="noopener noreferrer">View on HAR</a> : null}
            </div>
          </div>
        ),
      },
      { text: row.price || "—", sort: row.priceValue ?? undefined, node: <span className="lc-price">{priceNode(row.price, monthly)}</span> },
      { text: row.status || "—", node: <span className={"lc-status" + (row.pending ? " pending" : "")}>{row.status || "—"}</span> },
    ];
  });
}

function PropertySection({ rows, monthly, placeholder }: { rows: Array<Sale | Lease>; monthly: boolean; placeholder: string }) {
  if (!rows.length) return <p className="caption">None in this feed.</p>;
  return (
    <>
      <Table
        columns={["Listing", monthly ? "Rent" : "List price", "Status"]}
        tdClass={["", "num", ""]}
        rows={propertyRows(rows, monthly, placeholder)}
      />
      <p className="caption">{monthly
        ? "Tap a header to sort. The total row sums monthly rent. Rent is not part of active list volume."
        : "Tap a header to sort. The total row sums list price. Order before a sort is the HAR feed order."}</p>
      <ul className="lc-board">
        {rows.map((row) => <PropertyCard key={(monthly ? "lease:" : "sale:") + row.id + ":" + row.street} row={row} monthly={monthly} placeholder={placeholder} />)}
      </ul>
    </>
  );
}

function closingRows(rows: Closing[]) {
  return rows.map((row) => {
    const bits = [row.status, row.agent].filter(Boolean);
    return [
      {
        text: row.address,
        sort: row.address.toLowerCase(),
        node: (
          <div className="lc-line-copy">
            <div className="lc-line-title">{row.address}</div>
            {bits.length ? <div className="lc-line-sub">{bits.join(" · ")}</div> : null}
            {row.url ? <a className="lc-link" href={row.url} target="_blank" rel="noopener noreferrer">View on HAR</a> : null}
          </div>
        ),
      },
      { text: row.price || "—", sort: row.priceValue ?? undefined },
      row.expectedClose || "—",
    ];
  });
}

function ClosingsSection({ state }: { state: ClosingsState }) {
  if (state.kind === "missing") {
    return <p className="caption">The TV feed does not publish the closing board yet. Pending closings show up here after that refresh writes closings.json. HAR under-contract listings stay on the Under contract tab.</p>;
  }
  const rows = state.feed.closings;
  if (!rows.length) return <p className="caption">No pending closings in the feed.</p>;
  return (
    <>
      <Table columns={["Address", "Price", "Expected close"]} tdClass={["", "num", ""]} rows={closingRows(rows)} />
      <p className="caption">Tap a header to sort. The total row sums price. Buyer and seller names are not shown.</p>
      <ul className="lc-board">
        {rows.map((row) => (
          <li className="lc-card pending" key={row.address + row.price}>
            <div className="lc-photo lc-photo-empty" aria-hidden="true">Pending</div>
            <div className="lc-body">
              <h3 className="serif lc-street">{row.address}</h3>
              <div className="lc-row">
                <span className="lc-price">{row.price || "—"}</span>
                <span className="lc-status pending">{row.status || "Pending"}</span>
              </div>
              <p className="lc-meta">{row.expectedClose ? "Expected close " + row.expectedClose : "Expected close —"}{row.agent ? " · " + row.agent : ""}</p>
              {row.url ? <a className="lc-link" href={row.url} target="_blank" rel="noopener noreferrer">View on HAR</a> : null}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

export default function Listings() {
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [section, setSection] = useState<SectionId>("active");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancel = false;
    setLoad({ kind: "loading" });
    loadFeed().then(
      (data) => { if (!cancel) setLoad({ kind: "ready", ...data }); },
      () => { if (!cancel) setLoad({ kind: "error" }); },
    );
    return () => { cancel = true; };
  }, [tick]);

  if (load.kind === "loading") {
    return (
      <div className="page-body listings">
        <h1 className="page-title serif">Listings &amp; Closings</h1>
        <div className="center"><div className="spinner" /><p className="caption">Loading the TV feed…</p></div>
      </div>
    );
  }
  if (load.kind === "error") {
    return (
      <div className="page-body listings">
        <h1 className="page-title serif">Listings &amp; Closings</h1>
        <div className="gatecard">
          <h1 className="serif">Feed unavailable</h1>
          <p className="rule" />
          <p>The listings feed did not load. This page reads the office TV feed when it opens.</p>
          <button className="ghost dark" type="button" onClick={() => setTick((n) => n + 1)}>Try again</button>
        </div>
      </div>
    );
  }

  const { listings, closings } = load;
  const totals = feedTotals(listings);
  const parts = splitSales(listings);
  const salesAsOf = formatAsOf(listings.asOf);
  const leaseAsOf = formatAsOf(listings.leaseAsOf);
  const closeAsOf = closings.kind === "ready" ? formatAsOf(closings.feed.asOf) : "";
  const asOf = [
    salesAsOf ? "Sales " + salesAsOf : "",
    leaseAsOf ? "Leases " + leaseAsOf : "",
    closeAsOf ? "Closings " + closeAsOf : "",
  ].filter(Boolean).join(" · ");
  const leaseHint = totals.pendingLeaseCount
    ? totals.activeLeaseCount + " active · " + totals.pendingLeaseCount + " under contract"
    : totals.activeLeaseCount + " active";

  let body: ReactNode;
  switch (section) {
    case "active":
      body = <PropertySection key="active" rows={parts.active} monthly={false} placeholder="No photo" />;
      break;
    case "contract":
      body = <PropertySection key="contract" rows={parts.underContract} monthly={false} placeholder="No photo" />;
      break;
    case "leases":
      body = <PropertySection key="leases" rows={listings.leases} monthly placeholder="Lease" />;
      break;
    case "closings":
      body = <ClosingsSection key="closings" state={closings} />;
      break;
    default: {
      const _n: never = section;
      body = _n;
    }
  }

  return (
    <div className="page-body listings">
      {asOf ? <div className="asof">As of {asOf}</div> : null}
      <h1 className="page-title serif">Listings &amp; Closings</h1>
      <p className="summary">Active HAR listings and leases from the office TV feed. Pending closings appear when that same refresh publishes them. This page reads the feed when it opens.</p>
      <div
        className="fa-cards ft-4 lc-kpis"
        data-lc-active={totals.activeCount}
        data-lc-under-contract={totals.underContractCount}
        data-lc-leases={totals.leaseCount}
        data-lc-volume={totals.activeListVolume}
        data-lc-uc-volume={totals.underContractVolume}
      >
        <div className="fa-card"><div className="fa-v serif">{totals.activeCount.toLocaleString("en-US")}</div><div className="fa-l">Active listings</div><div className="fa-h">HAR sales · status Active</div></div>
        <div className="fa-card"><div className="fa-v serif">{totals.underContractCount.toLocaleString("en-US")}</div><div className="fa-l">Under contract</div><div className="fa-h">{formatMoney(totals.underContractVolume)} list volume</div></div>
        <div className="fa-card"><div className="fa-v serif">{totals.leaseCount.toLocaleString("en-US")}</div><div className="fa-l">Leases</div><div className="fa-h">{leaseHint}</div></div>
        <div className="fa-card"><div className="fa-v serif">{formatMoney(totals.activeListVolume)}</div><div className="fa-l">Active list volume</div><div className="fa-h">Sum of Active sale prices</div></div>
      </div>
      {totals.otherCount ? <p className="caption">{totals.otherCount} sale listing{totals.otherCount === 1 ? "" : "s"} with another status {totals.otherCount === 1 ? "is" : "are"} omitted from these counts.</p> : null}
      <Segmented
        options={[
          { value: "active", label: "Active (" + totals.activeCount + ")" },
          { value: "contract", label: "Under contract (" + totals.underContractCount + ")" },
          { value: "leases", label: "Leases (" + totals.leaseCount + ")" },
          { value: "closings", label: "Closings" + (closings.kind === "ready" ? " (" + closings.feed.closings.length + ")" : "") },
        ]}
        value={section}
        onChange={(v: string) => {
          if (v === "active" || v === "contract" || v === "leases" || v === "closings") setSection(v);
        }}
      />
      <section className="section">
        <h2 className="serif">{section === "active" ? "Active listings" : section === "contract" ? "Under contract" : section === "leases" ? "Leases" : "Pending closings"}</h2>
        {body}
      </section>
    </div>
  );
}
