// Shared per-agent table for the Zillow page: click-to-sort headers and a pinned Total row.
// Totals never invent numbers: counts are column sums (checked against Tableau's grand total),
// rates use Tableau's grand total, or an explicit numerator/denominator ratio, otherwise blank.
import { useMemo, useState, type ReactNode } from "react";

export type ColKind = "text" | "count" | "rate" | "rating";

export type Col = {
  key: string;
  label: string;
  kind: ColKind;
  /** Grand-total keys to look up in Tableau's grand_total (first finite value wins). Defaults to [key]. */
  gt?: string[];
  /** Rate fallback when Tableau has no grand total: sum(num) / sum(den) * 100, used only when both sums are present and den > 0. */
  ratio?: [string, string];
  /** Count column whose Total is Tableau's own grand total (Tableau calculates it separately, so rows need not sum to it). */
  totalFrom?: "tableau";
  /** Short note shown when such a Tableau total differs from the row sum. */
  totalNote?: string;
  /** Cell renderer; defaults by kind. */
  render?: (row: any) => ReactNode;
  style?: React.CSSProperties;
};

const fin = (v: any) => typeof v === "number" && isFinite(v);
const fmtNum = (v: any) => (fin(v) ? Math.round(v).toLocaleString("en-US") : "—");
const fmtPct = (v: any) => (fin(v) ? `${Math.round(v * 10) / 10}%` : "—");
const RANK: Record<string, number> = { High: 3, Fair: 2, Low: 1 };

/** Numeric sort key for a cell, or null when blank / N/A. Handles numbers, "67%" / "1,234" strings and High/Fair/Low. */
export function sortKey(v: any, kind: ColKind): number | string | null {
  if (v == null) return null;
  if (kind === "rating") {
    const r = RANK[String(v).trim()];
    return r ?? null;
  }
  if (typeof v === "number") return isFinite(v) ? v : null;
  const s = String(v).trim();
  if (!s || /^(n\/?a|—|-|null)$/i.test(s)) return null;
  if (kind === "text") return s.toLowerCase();
  const n = Number(s.replace(/[,%$\s]/g, ""));
  return isFinite(n) ? n : null;
}

export type SortState = { key: string; dir: "asc" | "desc" } | null;

/** First click: A–Z for text, high–low for numbers and ratings. Next click reverses. Blanks always last; ties keep default order. */
export function useSort(rows: any[], cols: Col[]) {
  const [sort, setSort] = useState<SortState>(null);
  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = cols.find((c) => c.key === sort.key);
    if (!col) return rows;
    const mul = sort.dir === "asc" ? 1 : -1;
    return rows
      .map((r, i) => ({ r, i, k: sortKey(r[col.key], col.kind) }))
      .sort((a, b) => {
        if (a.k == null && b.k == null) return a.i - b.i;
        if (a.k == null) return 1;
        if (b.k == null) return -1;
        const c = typeof a.k === "string" || typeof b.k === "string"
          ? String(a.k).localeCompare(String(b.k), "en-US")
          : (a.k as number) - (b.k as number);
        return c !== 0 ? c * mul : a.i - b.i;
      })
      .map((x) => x.r);
  }, [rows, cols, sort]);
  const toggle = (key: string) => {
    const col = cols.find((c) => c.key === key);
    const first: "asc" | "desc" = col?.kind === "text" ? "asc" : "desc";
    setSort((s) => (s && s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: first }));
  };
  return { sorted, sort, toggle };
}

export type TotalCell = {
  value: number | null;
  source: "sum" | "tableau" | "ratio" | "blank";
  tableau: number | null;
  mismatch: boolean;
  /** Set when the Total is Tableau's separately calculated grand total: the agent-row sum, for the note. */
  rowsSum?: number | null;
};

function gtValue(col: Col, gt: any): number | null {
  if (!gt) return null;
  for (const k of col.gt ?? [col.key]) {
    const v = sortKey(gt[k], "count");
    if (typeof v === "number") return v;
  }
  return null;
}

function colSum(rows: any[], key: string): number | null {
  let any = false, t = 0;
  for (const r of rows) {
    const v = sortKey(r[key], "count");
    if (typeof v === "number") { any = true; t += v; }
  }
  return any ? t : null;
}

export function computeTotals(cols: Col[], rows: any[], gt: any): Record<string, TotalCell> {
  const out: Record<string, TotalCell> = {};
  for (const c of cols) {
    const tableau = c.kind === "count" || c.kind === "rate" ? gtValue(c, gt) : null;
    if (c.kind === "count" && c.totalFrom === "tableau" && tableau != null) {
      out[c.key] = { value: tableau, source: "tableau", tableau, mismatch: false, rowsSum: colSum(rows, c.key) };
    } else if (c.kind === "count") {
      const s = colSum(rows, c.key);
      out[c.key] = { value: s, source: s == null ? "blank" : "sum", tableau, mismatch: s != null && tableau != null && Math.abs(s - tableau) > 1e-9 };
    } else if (c.kind === "rate") {
      if (tableau != null) out[c.key] = { value: tableau, source: "tableau", tableau, mismatch: false };
      else if (c.ratio) {
        const n = colSum(rows, c.ratio[0]), d = colSum(rows, c.ratio[1]);
        out[c.key] = n != null && d != null && d > 0
          ? { value: (100 * n) / d, source: "ratio", tableau: null, mismatch: false }
          : { value: null, source: "blank", tableau: null, mismatch: false };
      } else out[c.key] = { value: null, source: "blank", tableau: null, mismatch: false };
    } else out[c.key] = { value: null, source: "blank", tableau: null, mismatch: false };
  }
  return out;
}

const isNum = (k: ColKind) => k === "count" || k === "rate";

function defaultCell(c: Col, r: any): ReactNode {
  const v = r[c.key];
  if (c.kind === "count") return fmtNum(v);
  if (c.kind === "rate") return fin(v) ? fmtPct(v) : (v ?? "—");
  if (c.kind === "rating") return v ? <span className={`zl-pill ${v}`}>{v}</span> : "—";
  return v ?? "—";
}

/** Caption line: whether the count columns on the Total row equal Tableau's grand totals. */
export function TotalsCheck({ cols, totals }: { cols: Col[]; totals: Record<string, TotalCell> }) {
  const checked = cols.filter((c) => c.kind === "count" && totals[c.key]?.tableau != null);
  const bad = checked.filter((c) => totals[c.key].mismatch);
  const sep = checked.filter((c) => totals[c.key].rowsSum !== undefined && totals[c.key].rowsSum !== totals[c.key].tableau);
  if (!checked.length) return null;
  const sepNote = sep.length ? (
    <span className="zl-total-sep">
      {" "}† {sep.map((c) => `${c.label} total ${fmtNum(totals[c.key].tableau)} is Tableau's grand total; agent rows sum to ${fmtNum(totals[c.key].rowsSum)}. ${c.totalNote || "Tableau calculates it separately"}`).join(" ")}
    </span>
  ) : null;
  if (!bad.length) return <>Total row: {checked.length} count column{checked.length === 1 ? "" : "s"} equal Tableau's grand totals{sepNote}</>;
  return (
    <span className="zl-total-bad">
      Total row mismatch: {bad.map((c) => `${c.label} sums to ${fmtNum(totals[c.key].value)} vs Tableau ${fmtNum(totals[c.key].tableau)}`).join("; ")}{sepNote}
    </span>
  );
}

export function SortableAgentTable({
  cols, rows, grandTotal, rowKey = "agent", rowStyle, totalLabel = "Total", pinned, totals: totalsIn, className,
}: {
  cols: Col[];
  rows: any[];
  grandTotal?: any;
  rowKey?: string;
  rowStyle?: (row: any) => React.CSSProperties | undefined;
  totalLabel?: string;
  /** Rows pinned above the sorted body instead of a computed Total row (e.g. Tableau's own Grand Total). */
  pinned?: any[];
  totals?: Record<string, TotalCell>;
  /** Extra class on the table (e.g. zl-monthly). */
  className?: string;
}) {
  const { sorted, sort, toggle } = useSort(rows, cols);
  const totals = useMemo(() => totalsIn ?? computeTotals(cols, rows, grandTotal), [totalsIn, cols, rows, grandTotal]);
  return (
    <div className="tablewrap">
      <table className={`zl-table zl-sortable${className ? ` ${className}` : ""}`}>
        <thead>
          <tr>
            {cols.map((c) => {
              const on = sort?.key === c.key;
              const dirLabel = c.kind === "text" ? (on && sort!.dir === "desc" ? "Z–A" : "A–Z") : (on && sort!.dir === "asc" ? "low–high" : "high–low");
              return (
                <th key={c.key} className={isNum(c.kind) ? "r" : undefined} aria-sort={on ? (sort!.dir === "asc" ? "ascending" : "descending") : "none"}>
                  <button type="button" className={`zl-sortbtn${on ? " on" : ""}`} onClick={() => toggle(c.key)} title={`Sort ${on ? "reversed" : dirLabel}`}>
                    <span>{c.label}</span>
                    <i aria-hidden="true">{on ? (sort!.dir === "asc" ? "▲" : "▼") : "↕"}</i>
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {pinned ? pinned.map((p, i) => (
            <tr key={`pin-${i}`} className="zl-total">
              {cols.map((c) => <td key={c.key} className={isNum(c.kind) ? "r" : undefined} style={c.style}>{c.render ? c.render(p) : defaultCell(c, p)}</td>)}
            </tr>
          )) : (
            <tr className="zl-total">
              {cols.map((c, i) => {
                if (i === 0) return <td key={c.key}>{totalLabel}</td>;
                const t = totals[c.key];
                const txt = t.value == null ? "" : c.kind === "rate" ? fmtPct(t.value) : fmtNum(t.value);
                const sepd = t.rowsSum !== undefined && t.rowsSum !== t.tableau;
                const title = t.source === "sum" ? (t.tableau != null ? `Column sum · Tableau grand total ${fmtNum(t.tableau)}` : "Column sum (no Tableau grand total)")
                  : t.source === "tableau" ? (t.rowsSum !== undefined ? `Tableau grand total (calculated separately by Tableau; agent rows sum to ${fmtNum(t.rowsSum)})` : "Tableau grand total")
                  : t.source === "ratio" ? "Ratio of summed columns" : undefined;
                return <td key={c.key} className={`${isNum(c.kind) ? "r" : ""}${t.mismatch ? " zl-total-bad" : ""}`} title={title}>{txt}{t.mismatch ? " ⚠" : ""}{sepd ? <sup className="zl-dagger">†</sup> : null}</td>;
              })}
            </tr>
          )}
          {sorted.map((r, i) => (
            <tr key={r[rowKey] ?? i} style={rowStyle?.(r)}>
              {cols.map((c) => <td key={c.key} className={isNum(c.kind) ? "r" : undefined} style={c.style}>{c.render ? c.render(r) : defaultCell(c, r)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
