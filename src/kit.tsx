// Branded drop-in for the dashboard's component kit (The Bly Team brand).
import { Fragment, createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
export { Fragment, useMemo, useState };

export const BRAND = { charcoal: "#12151C", ink: "#1A1A1A", ivory: "#F3F1EB", paper: "#FFFFFF", blue: "#00519B", gold: "#C0A062" };
const THEME = {
  kind: "light" as const,
  bg: { base: BRAND.paper, subtle: BRAND.ivory, elevated: BRAND.paper },
  text: { primary: BRAND.ink, secondary: "#4A4A4A", tertiary: "#6B6B6B", accent: BRAND.blue, success: "#2E6B3F", warning: "#8A5A00", danger: "#A3272B" },
  fill: { hover: "rgba(18,21,28,0.06)", accent: BRAND.blue },
  border: { subtle: "#E6E2D8", weak: "#DDD8CC", default: "#D6D0C2", strong: "#9C9686" },
  font: { family: "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif", serif: "Canela, Cambria, Georgia, 'Times New Roman', serif" },
  radius: { sm: 4, md: 8, lg: 12, xl: 16 },
  dataviz: { categorical: [BRAND.charcoal, BRAND.gold, BRAND.blue], other: "#B5B0A4", negative: "#A3272B" },
};
export const useGrokTheme = () => THEME;

type Tone = "success" | "warning" | "danger";
const toneColor = (t?: Tone) => (t ? THEME.text[t] : undefined);
const Depth = createContext(0);
const cellText = (c: any): string => (c == null ? "" : typeof c === "string" || typeof c === "number" ? String(c) : typeof c === "object" && "text" in c ? String(c.text) : "");
const cellNum = (c: any): number | null => {
  const t = cellText(c).trim().replace(/[$,%\s]/g, "").split("(")[0];
  const m = /^([+-]?\d+(?:\.\d+)?)([KM]?)/.exec(t);
  return m ? parseFloat(m[1]) * (m[2] === "M" ? 1e6 : m[2] === "K" ? 1e3 : 1) : null;
};

export function Page(p: { title: string; summary?: string; width?: string; children?: ReactNode }) {
  return (<div className="page">
    <h1 className="serif page-title">{p.title}</h1>
    {p.summary ? <p className="summary">{p.summary}</p> : null}
    <div className="page-body">{p.children}</div>
  </div>);
}
export function Section(p: { heading?: string; caption?: string; children?: ReactNode }) {
  const d = useContext(Depth);
  const H = d === 0 ? "h2" : "h3";
  return (<Depth.Provider value={d + 1}>
    <section className={d === 0 ? "section" : "subsection"}>
      {p.heading ? <H className="serif">{p.heading}</H> : null}
      {p.caption ? <p className="caption">{p.caption}</p> : null}
      <div className="stack">{p.children}</div>
    </section>
  </Depth.Provider>);
}
export const Text = (p: { children?: ReactNode }) => <p className="text">{p.children}</p>;
export function Grid(p: { columns?: number; plain?: boolean; children?: ReactNode }) {
  return <div className={"grid" + (p.plain ? " plain" : "")} style={{ ["--cols" as any]: p.columns || 2, ["--cols2" as any]: Math.min(2, p.columns || 2) }}>{p.children}</div>;
}
export function Segmented(p: { options: any[]; value: string; onChange: (v: any) => void }) {
  return (<div className="seg" role="tablist">{p.options.map((o: any) => { const v = typeof o === "string" ? o : o.value; const l = typeof o === "string" ? o : o.label;
    return <button key={v} role="tab" aria-selected={v === p.value} className={v === p.value ? "on" : ""} onClick={() => p.onChange(v)}>{l}</button>; })}</div>);
}
export function Select(p: { label?: string; options: any[]; value: string; onChange: (v: any) => void }) {
  return (<label className="field"><span>{p.label}</span>
    <select value={p.value} onChange={(e) => p.onChange(e.target.value)}>{p.options.map((o: any) => { const v = typeof o === "string" ? o : o.value; return <option key={v} value={v}>{typeof o === "string" ? o : o.label}</option>; })}</select></label>);
}
export function Toggle(p: { label?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (<label className="toggle"><input type="checkbox" checked={p.value} onChange={(e) => p.onChange(e.target.checked)} /><span className="knob" /><span>{p.label}</span></label>);
}

// Totals row (Kevin 2026-10-30): every table shows column totals at the top. Rate/average/date columns
// (%, per-unit, median, avg, speed, rank, date) are not additive, so they show a dash instead of a sum,
// unless the table declares the column's parts via `ratios` (then total = sum(numerator) / sum(denominator),
// the same rule the Zillow boards use in zillowTable.tsx).
const NON_ADDITIVE = /%|\S\/\S|\bper\b|\bavg\b|average|median|\bmean\b|\brate\b|speed|\brank|#|score|date|\byear\b|\btime\b|\bage\b|\bdays?\b|\bhours?\b|waiting|\bmin\b|\bconv\b|conversion|ratio/i;
// Period phrases like "last 30 days" / "all time" / "in period" name the window, not the measure.
const PERIOD_WORDS = /\b(last|past|next)\s+\d+\s+(days?|months?|weeks?|years?)\b|\ball[- ]time\b|\bin period\b|\bthis year\b|\b20\d\d\b/gi;
const isBlank = (c: any) => { const t = cellText(c).trim(); return t === "" || t === "—" || t === "-" || /^n\/?a$/i.test(t) || /^—\s*\/\s*—$/.test(t); };
const DATE_RE = /^(\d{4}-\d{2}(-\d{2})?|\d{1,2}\/\d{1,2}(\/\d{2,4})?)([ T]\d{1,2}:\d{2}(:\d{2})?(\s?[AP]M)?)?$/i;
const isDate = (c: any) => DATE_RE.test(cellText(c).trim());
const pnum = (x: string) => (x === "—" ? 0 : parseFloat(x.replace(/,/g, "")) || 0);
const PAIR_RE = /^\s*(-?[\d,.]+|—)\s*\/\s*(-?[\d,.]+|—)\s*$/; // "applied / hired" style cells; a dash side counts as 0
/** Sort key: explicit `sort`, else dates as yyyymmdd(hhmm), else numbers, else lowercase text; null = blank (always last). */
export function sortValue(c: any): number | string | null {
  if (c && typeof c === "object" && "sort" in c && c.sort !== undefined) return c.sort;
  if (isBlank(c)) return null;
  const t = cellText(c).trim();
  let m = /^(\d{4})-(\d{2})(?:-(\d{2}))?(?:[ T](\d{1,2}):(\d{2}))?/.exec(t);
  if (m && DATE_RE.test(t)) return +m[1] * 1e8 + +m[2] * 1e6 + +(m[3] || 0) * 1e4 + +(m[4] || 0) * 100 + +(m[5] || 0);
  m = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?(?:[ T](\d{1,2}):(\d{2})(?::\d{2})?\s?([AP]M)?)?$/i.exec(t);
  if (m) { const y = m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : 0; let h = +(m[4] || 0); if (m[6]) h = (h % 12) + (/p/i.test(m[6]) ? 12 : 0);
    return y * 1e8 + +m[1] * 1e6 + +m[2] * 1e4 + h * 100 + +(m[5] || 0); }
  const n = cellNum(c);
  return n != null ? n : t.toLowerCase();
}
function fmtLike(sum: number, sample: string, cells: any[]): string {
  const money = sample.startsWith("$") || sample.startsWith("-$");
  const short = /\d[KM]\b/.test(sample);
  if (short) return (sum < 0 ? "-" : "") + (money ? "$" : "") + (Math.abs(sum) >= 1e6 ? (Math.abs(sum) / 1e6).toFixed(2) + "M" : (Math.abs(sum) / 1e3).toFixed(1) + "K");
  let dec = Math.min(2, Math.max(0, ...cells.map((c) => (/\.(\d+)/.exec(cellText(c).replace(/[^\d.]/g, "")) || ["", ""])[1].length)));
  if (!money && Math.abs(sum - Math.round(sum)) < 1e-9) dec = 0; // split units like 0.5 can still add up to a whole number
  const v = Math.abs(sum).toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec });
  return (sum < 0 ? "-" : "") + (money ? "$" : "") + v;
}
export type Ratios = Record<string, [string | string[], string]>;
export function columnTotals(columns: string[], rows: any[][], ratios?: Ratios): (string | null)[] {
  const sumOf = (k: number) => { let s = 0, any = false; for (const r of rows) { const n = cellNum(r[k]); if (n != null) { s += n; any = true; } } return any ? s : null; };
  return columns.map((h, k) => {
    if (k === 0) return "Total";
    const cells = rows.map((r) => r[k]);
    const filled = cells.filter((c) => !isBlank(c));
    const sample = cellText(filled.find((c) => cellNum(c) != null)).trim();
    const rq = ratios?.[h];
    if (rq) {
      const parts = (Array.isArray(rq[0]) ? rq[0] : [rq[0]]).map((l) => { const a = columns.indexOf(l); return a >= 0 ? sumOf(a) : null; });
      const b = columns.indexOf(rq[1]);
      const n = parts.some((x) => x == null) ? null : (parts as number[]).reduce((x, y) => x + y, 0), d = b >= 0 ? sumOf(b) : null;
      if (n == null || d == null || !d) return "—";
      if (/%/.test(sample) || !sample) { const dec = Math.max(0, ...filled.map((c) => (/\.(\d+)%/.exec(cellText(c)) || ["", ""])[1].length)); return ((100 * n) / d).toFixed(Math.min(dec, 2)) + "%"; }
      return fmtLike(n / d, sample, filled);
    }
    if (!filled.length) return null;
    if (filled.some(isDate)) return "—";
    const nonAdd = NON_ADDITIVE.test(h.replace(PERIOD_WORDS, " "));
    if (filled.every((c) => PAIR_RE.test(cellText(c)))) {
      if (nonAdd) return "—";
      const sa = filled.reduce((s, c) => s + pnum(PAIR_RE.exec(cellText(c))![1]), 0);
      const sb = filled.reduce((s, c) => s + pnum(PAIR_RE.exec(cellText(c))![2]), 0);
      return sa.toLocaleString("en-US") + " / " + sb.toLocaleString("en-US");
    }
    const nums = cells.map(cellNum).filter((x): x is number => x != null);
    if (!nums.length) return null;
    if (nonAdd || /%/.test(sample)) return "—";
    if (nums.length < filled.length) return null;
    return fmtLike(nums.reduce((a, b) => a + b, 0), sample, filled);
  });
}
/** Sort state for any table (Kevin 2026-10-30): header click cycles descending → ascending → off; numbers and dates
 *  compare numerically, text A–Z, blanks always last, ties keep the original order. `order` is row indexes. */
export function useSorted<R>(rows: R[], key: (r: R, col: number) => any) {
  const [sort, setSort] = useState<[number, number]>([-1, 1]);
  const order = useMemo(() => {
    const ix = rows.map((_, i) => i);
    if (sort[0] < 0) return ix;
    const c = sort[0], s = sort[1];
    const keys = rows.map((r) => sortValue(key(r, c)));
    return ix.sort((a, b) => { const x = keys[a], y = keys[b];
      if (x == null || y == null) return x == null && y == null ? a - b : x == null ? 1 : -1;
      if (typeof x === "number" && typeof y === "number") return (x - y) * s || a - b;
      if (typeof x === "number") return -1; if (typeof y === "number") return 1;
      return String(x).localeCompare(String(y), "en-US") * s || a - b; });
  }, [rows, sort]);
  const head = (k: number) => ({ onClick: () => setSort(sort[0] === k ? (sort[1] === -1 ? [k, 1] : [-1, 1]) : [k, -1]), title: "Sort",
    "aria-sort": (sort[0] === k ? (sort[1] === -1 ? "descending" : "ascending") : "none") as "descending" | "ascending" | "none" });
  const mark = (k: number) => <span className="sorti">{sort[0] === k ? (sort[1] === -1 ? " ▼" : " ▲") : " ↕"}</span>;
  return { order, head, mark };
}
/** A table cell: plain text/number, a React node, or { text, node?, sort?, tone?, className?, style? }.
 *  `text` drives sorting and totals; `node` (links, pills, tags) is what renders. */
const cellNode = (c: any) => (c && typeof c === "object" && !("$$typeof" in c) ? ("node" in c ? c.node : "text" in c ? c.text : null) : c);
export type ColSpec = string | { label: string; head?: ReactNode; className?: string };
/** Shared sortable table with a totals row at the top (Kevin 2026-10-30). Headers toggle descending → ascending → off;
 *  numbers/dates sort numerically, text A–Z, blanks last. `noTotals` for key/value lists, overlapping rows, or tables that
 *  already carry a total row; `ratios` declares percent / per-unit columns whose total is a ratio of two summed columns. */
export function Table(p: { columns: ColSpec[]; rows: any[][]; align?: string[]; noTotals?: boolean; ratios?: Ratios;
  className?: string; wrapClass?: string; tdClass?: string[]; rowClass?: (row: any[], i: number) => string | undefined; sortCols?: boolean[];
  /** Rows counted in the totals row (default all), e.g. to leave the AI dialer out of human totals. */ inTotal?: (row: any[], i: number) => boolean; totalLabel?: string }) {
  const labels = p.columns.map((c) => (typeof c === "string" ? c : c.label));
  const { order: idx, head, mark } = useSorted(p.rows, (r, k) => r[k]);
  const totRows = p.inTotal ? p.rows.filter(p.inTotal) : p.rows;
  const tot = useMemo(() => { const t = columnTotals(labels, totRows, p.ratios); if (p.totalLabel) t[0] = p.totalLabel; return t; }, [labels.join("\u0001"), p.rows, p.ratios, p.inTotal, p.totalLabel]);
  const al = (k: number) => p.tdClass ? p.tdClass[k] || "" : (p.align && p.align[k] === "end") || (!p.align && k > 0 && p.rows.length && cellNum(p.rows[0][k]) != null) ? "num" : "";
  const thCls = (k: number) => { const c = p.columns[k]; return [al(k), typeof c === "string" ? "" : c.className || ""].filter(Boolean).join(" ") || undefined; };
  const showTot = !p.noTotals && totRows.length > 1 && tot.some((t, k) => k > 0 && t && t !== "—");
  const table = (<table className={p.className}>
    <thead><tr>{p.columns.map((c, k) => (p.sortCols && p.sortCols[k] === false)
      ? <th key={k} className={thCls(k)}>{typeof c === "string" ? c : c.head ?? c.label}</th>
      : <th key={k} className={thCls(k)} {...head(k)}>{typeof c === "string" ? c : c.head ?? c.label}{mark(k)}</th>)}</tr>
      {showTot ? <tr className="totrow">{tot.map((t, k) => <td key={k} className={al(k) || undefined}>{t ?? ""}</td>)}</tr> : null}</thead>
    <tbody>{idx.map((i) => { const r = p.rows[i]; return <tr key={i} className={p.rowClass?.(r, i)}>{r.map((c: any, k: number) => { const o = c && typeof c === "object" && !("$$typeof" in c) ? c : null;
      return <td key={k} className={[al(k), o?.className].filter(Boolean).join(" ") || undefined} style={o ? { color: "tone" in o ? toneColor(o.tone) : undefined, ...o.style } : undefined}>{cellNode(c)}</td>; })}</tr>; })}</tbody>
  </table>);
  return p.wrapClass === "" ? table : <div className={p.wrapClass || "tablewrap"}>{table}</div>;
}
export function Rows(p: { rows: { title: string; detail?: string }[] }) {
  return <div className="rows">{p.rows.map((r, i) => <div key={i} className="row"><div className="rtitle">{r.title}</div>{r.detail ? <div className="rdetail">{r.detail}</div> : null}</div>)}</div>;
}
export function Properties(p: { items: { label: string; value: ReactNode }[] }) {
  return <dl className="props">{p.items.map((it, i) => <Fragment key={i}><dt>{it.label}</dt><dd>{it.value}</dd></Fragment>)}</dl>;
}
export function Legend(p: { names: string[] }) {
  return <div className="legend">{p.names.map((n, i) => <span key={n}><i style={{ background: THEME.dataviz.categorical[i] || THEME.dataviz.other }} />{n}</span>)}</div>;
}
function useTip() {
  const [tip, setTip] = useState<{ x: number; y: number; lines: string[] } | null>(null);
  const el = tip ? <div className="tip" style={{ left: tip.x, top: tip.y }}>{tip.lines.map((l, i) => <div key={i} className={i === 0 ? "tiph" : ""}>{l}</div>)}</div> : null;
  const on = (lines: string[]) => (e: React.MouseEvent) => { const r = (e.currentTarget as Element).closest(".chart")!.getBoundingClientRect(); const x = e.clientX - r.left; setTip({ x: Math.max(0, Math.min(x + 12, r.width - 200)), y: e.clientY - r.top + 12, lines }); };
  return { el, on, off: () => setTip(null) };
}
export function Bars(p: { bars: { label: string; value: number; display: string; meta?: string }[]; emphasis?: any }) {
  const t = useTip(); const mx = Math.max(1, ...p.bars.map((b) => b.value || 0));
  return (<div className="chart bars">{p.bars.map((b, i) => (
    <div key={i} className="bar" onMouseMove={t.on([b.label, b.display])} onMouseLeave={t.off}>
      <div className="blabel">{b.label}</div>
      <div className="btrack"><div className="bfill" style={{ width: `${Math.max(0, (b.value || 0) / mx) * 100}%`, background: i === 0 && p.emphasis !== "none" ? BRAND.charcoal : "#5A5E66" }} /></div>
      <div className="bval">{b.display}</div>
    </div>))}{t.el}</div>);
}
export function ColumnSeries(p: { labels: string[]; series: { name: string; values: number[] }[]; format?: (v: number) => string }) {
  const t = useTip(); const fmt = p.format || ((v: number) => Math.round(v).toLocaleString("en-US"));
  const ref = useRef<HTMLDivElement>(null); const [cw, setCw] = useState(900);
  useEffect(() => { const el = ref.current; if (!el) return; const ro = new ResizeObserver((es) => { const w = Math.round(es[0].contentRect.width); if (w > 0) setCw(w); }); ro.observe(el); return () => ro.disconnect(); }, []);
  // chart is drawn at its container's pixel width so labels stay legible on phones
  const W = Math.max(280, cw), H = W < 640 ? 220 : 260, L = W < 640 ? 44 : 56, B = 28, T = 10;
  const every = Math.max(1, Math.ceil(p.labels.length / Math.max(2, Math.floor((W - L) / 44)))); const mx = Math.max(1, ...p.series.flatMap((s) => s.values));
  const gw = (W - L - 10) / p.labels.length, bw = (gw * 0.8) / p.series.length;
  const y = (v: number) => T + (1 - v / mx) * (H - T - B);
  return (<div className="chart" ref={ref}><Legend names={p.series.map((s) => s.name)} />
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H}>
      {[0, 0.5, 1].map((f) => <g key={f}><line x1={L} x2={W - 10} y1={y(mx * f)} y2={y(mx * f)} stroke={THEME.border.subtle} /><text x={L - 6} y={y(mx * f) + 4} textAnchor="end" fontSize={12} fill={THEME.text.tertiary}>{fmt(mx * f)}</text></g>)}
      {p.labels.map((lb, k) => (<g key={k} onMouseMove={t.on([lb, ...p.series.map((s) => `${s.name}: ${fmt(s.values[k] || 0)}`)])} onMouseLeave={t.off}>
        <rect x={L + gw * k} y={T} width={gw} height={H - T - B} fill="transparent" className="hov" />
        {p.series.map((s, j) => <rect key={j} x={L + gw * k + gw * 0.1 + bw * j} y={y(s.values[k] || 0)} width={bw - 1} height={Math.max(0, y(0) - y(s.values[k] || 0))} fill={THEME.dataviz.categorical[j] || THEME.dataviz.other} />)}
        <text x={L + gw * k + gw / 2} y={H - 8} textAnchor="middle" fontSize={12} fill={THEME.text.tertiary}>{k % every === 0 || k === p.labels.length - 1 ? lb : ""}</text></g>))}
    </svg>{t.el}</div>);
}
