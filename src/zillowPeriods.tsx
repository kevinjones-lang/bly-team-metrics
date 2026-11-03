// Period views for the Zillow page: agent-board period picker helpers and the months-as-columns tables
// (Team Details / Funnel) with a Total column and YoY. Numbers come from payload.periods only (Tableau captures);
// totals are computed by the normalizer (Tableau Grand Total, sum of months, verified ratio, or none -> dash).
import { useMemo } from "react";
import { SortableAgentTable, type Col } from "./zillowTable";

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fin = (v: any) => typeof v === "number" && isFinite(v);

/** Parse a month label ("2026-04", "Apr 2026", "April 2026", "Apr '26", "Apr") to { y, m } (m 0–11; y null when absent). */
export function parseMonth(label: any): { y: number | null; m: number } | null {
  const s = String(label ?? "").trim();
  let x = /^(\d{4})-(\d{1,2})(?:-\d{1,2})?$/.exec(s);
  if (x && +x[2] >= 1 && +x[2] <= 12) return { y: +x[1], m: +x[2] - 1 };
  x = /^(\d{1,2})\/(\d{4})$/.exec(s);
  if (x && +x[1] >= 1 && +x[1] <= 12) return { y: +x[2], m: +x[1] - 1 };
  x = /^([A-Za-z]{3,})\.?(?:[\s,'-]+(\d{2}|\d{4}))?$/.exec(s);
  if (!x) return null;
  const m = MON.findIndex((n) => n.toLowerCase() === x![1].slice(0, 3).toLowerCase());
  if (m < 0) return null;
  const y = x[2] ? (x[2].length === 2 ? 2000 + +x[2] : +x[2]) : null;
  return { y, m };
}

/** Short axis tick for a month label: "2026-04" / "Apr 2026" / "April" -> "Apr"; other labels are cut to 3 chars. */
export function monthTick(label: any): string {
  const p = parseMonth(label);
  return p ? MON[p.m] : String(label ?? "").slice(0, 3);
}

/**
 * Month labels in calendar order (year, then month), whatever order the payload object came in
 * (Postgres jsonb stores object keys by length then bytes, so { Apr, May, Jun, … } comes back Apr, Aug, Jul, …).
 * Labels without a year are a rolling window: the window starts after the largest gap in the 12-month cycle,
 * so Nov, Dec, Jan stays Nov → Jan. Unparseable labels keep their relative order after the months.
 */
export function chronoMonths<T>(items: T[], labelOf: (t: T) => any = (t) => t): T[] {
  const parsed = items.map((t, i) => ({ t, i, p: parseMonth(labelOf(t)) }));
  const ok = parsed.filter((x) => x.p);
  const bad = parsed.filter((x) => !x.p);
  let start = 0;
  const yearless = ok.filter((x) => x.p!.y == null).map((x) => x.p!.m);
  if (yearless.length) {
    const ms = [...new Set(yearless)].sort((a, b) => a - b);
    let gap = -1;
    ms.forEach((m, k) => {
      const next = k + 1 < ms.length ? ms[k + 1] : ms[0] + 12;
      if (next - m > gap) { gap = next - m; start = ms[(k + 1) % ms.length]; }
    });
  }
  const key = (p: { y: number | null; m: number }) =>
    p.y != null ? p.y * 12 + p.m : ((p.m - start + 12) % 12);
  ok.sort((a, b) => {
    const ay = a.p!.y, by = b.p!.y;
    if ((ay == null) !== (by == null)) return a.i - b.i; // mixed styles: leave as given
    return key(a.p!) - key(b.p!) || a.i - b.i;
  });
  return [...ok, ...bad].map((x) => x.t);
}

/** "October 28, 2026" -> "Oct 28, 2026" (label as Tableau shows it, shortened). */
export function shortDate(label?: string | null): string {
  if (!label) return "—";
  const m = /^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})$/.exec(label.trim());
  return m ? `${m[1].slice(0, 3)} ${m[2]}, ${m[3]}` : label;
}

/** "10/1/2026 to 10/30/2026" -> "Oct 1 – Oct 30, 2026"; anything else is returned as-is. */
export function shortRange(rr?: string | null): string | null {
  if (!rr) return null;
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+to\s+(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(rr.trim());
  if (!m) return rr;
  const a = `${MON[+m[1] - 1]} ${+m[2]}`, b = `${MON[+m[4] - 1]} ${+m[5]}`;
  return m[3] === m[6] ? `${a} – ${b}, ${m[6]}` : `${a}, ${m[3]} – ${b}, ${m[6]}`;
}

export type PeriodId = "mtd" | "prev_month" | "l3m" | "ytd";
export const PERIOD_LABEL: Record<PeriodId, string> = { mtd: "Month to date", prev_month: "Last month", l3m: "Last 3 months", ytd: "Year to date" };
export const PERIOD_ORDER: PeriodId[] = ["mtd", "prev_month", "l3m", "ytd"];

/** Board for a period: L3M is the default block already in the payload; the others come from payload.periods. */
export function boardFor(data: any, cat: "buyer_connections" | "zhl", p: PeriodId): any {
  if (p === "l3m") return data.agents?.by_metric_category?.[cat];
  return data.periods?.agent_boards?.[cat]?.[p] ?? null;
}
export function periodsAvailable(data: any, cat: "buyer_connections" | "zhl"): PeriodId[] {
  return PERIOD_ORDER.filter((p) => !!boardFor(data, cat, p));
}

function fmtVal(kind: string, v: any): string {
  if (!fin(v)) return "—";
  if (kind === "rate") return `${(Math.round(v * 10) / 10).toFixed(1)}%`;
  return Number.isInteger(v) ? v.toLocaleString("en-US") : (Math.round(v * 10) / 10).toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}
const TOTAL_TITLE: Record<string, string> = {
  tableau: "Tableau Grand Total", sum: "Sum of the months shown", ratio: "Ratio of summed numerator and denominator", none: "No valid total for this row",
};

/** Months-as-columns table with a Total column; every column header sorts the rows (metric A–Z, numbers high–low then low–high). */
export function MonthlyTable({ table, refresh, yoyNote, extraNote }: { table: any; refresh?: string; yoyNote?: string | null; extraNote?: React.ReactNode }) {
  const months: string[] = table?.months || [];
  const labels: string[] = table?.month_labels || months;
  const partial: string | null = table?.partial_month || null;
  const rows = useMemo(
    () => (table?.rows || []).map((r: any) => {
      const o: any = { metric: r.metric, _r: r, total: fin(r.total) ? r.total : null };
      months.forEach((m, i) => { o[m] = fin(r.values?.[i]) ? r.values[i] : null; });
      return o;
    }),
    [table],
  );
  const cols: Col[] = useMemo(() => [
    { key: "metric", label: "Metric", kind: "text", style: { whiteSpace: "normal", minWidth: 130 } },
    // Columns in calendar order; values stay keyed by month, so a reordered payload still lines up.
    ...chronoMonths(months.map((m, i) => ({ m, i })), (x) => x.m).map(({ m, i }): Col => ({
      key: m, label: m === partial ? `${labels[i]} · MTD` : labels[i], kind: "count",
      render: (row: any) => fmtVal(row._r.kind, row[m]),
    })),
    {
      key: "total", label: "Total", kind: "count", style: { fontWeight: 600, background: "#F8F6F0" },
      render: (row: any) => {
        const r = row._r;
        const t = TOTAL_TITLE[r.total_source] + (r.total_note ? ` · ${r.total_note}` : "");
        return <span title={t}>{fmtVal(r.kind, r.total)}{r.total_source === "ratio" ? <sup className="zl-dagger">‡</sup> : null}{r.total_note && r.total_source === "sum" ? <sup className="zl-dagger">*</sup> : null}</span>;
      },
    },
  ], [table]);
  if (!table || !months.length) return null;
  const blanksNotes = (table.rows || []).filter((r: any) => r.total_source === "sum" && r.total_note);
  const ratioNotes = (table.rows || []).filter((r: any) => r.total_source === "ratio");
  const hasDash = (table.rows || []).some((r: any) => r.total_source === "none");
  const yoy = table.yoy || {};
  return (
    <div className="zl-monthly-wrap">
      <p className="zl-cap">
        By month · {table.coverage}{partial ? ` · ${labels[months.indexOf(partial)]} is a partial month (month to date)` : ""}
        {refresh ? ` · Tableau refresh ${refresh}` : ""}. Click any column to sort.
      </p>
      {table.carried_note ? <p className="zl-cap zl-muted">{table.carried_note}</p> : null}
      {extraNote ? <p className="zl-cap">{extraNote}</p> : null}
      <SortableAgentTable cols={cols} rows={rows} rowKey="metric" pinned={[]} className="zl-monthly" />
      <p className="zl-cap zl-muted">
        Total: {table.has_grand_total ? "Tableau's Grand Total (month sums match it)" : "sum of the months shown for count rows"}
        {ratioNotes.length ? <>; ‡ {ratioNotes.map((r: any) => `${r.metric} = ${String(r.total_note).replace(/\.$/, "")}`).join("; ")}</> : null}
        {blanksNotes.length ? <>; * {blanksNotes.map((r: any) => `${r.metric}: ${String(r.total_note).replace(/\.$/, "")}`).join("; ")}</> : null}
        {hasDash ? <>; — means no valid total (rolling windows, or rates without a Tableau aggregate or clear numerator/denominator)</> : null}.
        {" "}Blank cells show —.
      </p>
      <YoyBlock yoy={yoy} fallback={yoyNote} />
    </div>
  );
}

/** Year-over-year: only months whose same month one year earlier is in the data. Never shown otherwise. */
export function YoyBlock({ yoy, fallback }: { yoy: any; fallback?: string | null }) {
  const by: any[] = yoy?.by_month || [];
  if (!yoy?.available || !by.length) {
    const note = yoy?.note || fallback;
    return note ? <p className="zl-cap zl-muted">{note}</p> : null;
  }
  const lab = (m: string) => `${MON[+m.slice(5) - 1]} ${m.slice(0, 4)}`;
  return (
    <div style={{ marginTop: 12 }}>
      <h4 className="serif" style={{ fontSize: 16, margin: "8px 0" }}>Year over year</h4>
      {by.map((b) => (
        <div key={b.month} className="tablewrap" style={{ marginBottom: 8 }}>
          <table className="zl-table">
            <thead>
              <tr><th>{lab(b.month)}{b.partial ? " · MTD" : ""} vs {lab(b.prior_month)}</th><th className="r">{lab(b.month)}</th><th className="r">{lab(b.prior_month)}</th><th className="r">Change</th></tr>
            </thead>
            <tbody>
              {b.rows.map((r: any) => (
                <tr key={r.metric}>
                  <td>{r.metric}</td>
                  <td className="r">{fmtVal(r.kind, r.value)}</td>
                  <td className="r">{fmtVal(r.kind, r.prior_value)}</td>
                  <td className="r">
                    {r.kind === "rate" ? `${r.change >= 0 ? "+" : ""}${(Math.round(r.change * 10) / 10).toFixed(1)} pts`
                      : `${r.change >= 0 ? "+" : ""}${fmtVal("count", r.change)}${fin(r.change_pct) ? ` (${r.change_pct >= 0 ? "+" : ""}${Math.round(r.change_pct)}%)` : ""}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {b.partial ? <p className="zl-cap zl-muted">{lab(b.month)} is month to date; {lab(b.prior_month)} is a full month.</p> : null}
        </div>
      ))}
    </div>
  );
}
