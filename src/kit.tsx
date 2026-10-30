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
  const m = /^(-?\d+(?:\.\d+)?)([KM]?)/.exec(t);
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
// (%, per-unit, median, avg, speed, rank, date) are not additive, so they show a dash instead of a sum.
const NON_ADDITIVE = /%|\/|per |avg|average|median|mean|rate|speed|rank|#|score|date|year|time|age|days|min\b|conv|ratio/i;
export function columnTotals(columns: string[], rows: any[][]): (string | null)[] {
  return columns.map((h, k) => {
    if (k === 0) return "Total";
    const cells = rows.map((r) => r[k]);
    const nums = cells.map(cellNum).filter((x): x is number => x != null);
    if (!nums.length || nums.length < cells.filter((c) => cellText(c).trim() !== "" && cellText(c).trim() !== "—").length) return null;
    const sample = cellText(cells.find((c) => cellNum(c) != null)).trim();
    if (NON_ADDITIVE.test(h) || /%/.test(sample)) return "—";
    const sum = nums.reduce((a, b) => a + b, 0);
    const money = sample.startsWith("$") || sample.startsWith("-$");
    const short = /\d[KM]\b/.test(sample);
    if (short) return (money ? "$" : "") + (Math.abs(sum) >= 1e6 ? (sum / 1e6).toFixed(2) + "M" : (sum / 1e3).toFixed(1) + "K");
    const dec = Math.max(0, ...cells.map((c) => (/\.(\d+)/.exec(cellText(c).replace(/[^\d.]/g, "")) || ["", ""])[1].length));
    const v = sum.toLocaleString("en-US", { minimumFractionDigits: Math.min(dec, 2), maximumFractionDigits: Math.min(dec, 2) });
    return money ? (sum < 0 ? "-$" + v.replace("-", "") : "$" + v) : v;
  });
}
export function Table(p: { columns: string[]; rows: any[][]; align?: string[]; noTotals?: boolean }) {
  const [sort, setSort] = useState<[number, number]>([-1, 1]);
  const rows = useMemo(() => {
    if (sort[0] < 0) return p.rows;
    const c = sort[0], s = sort[1];
    return [...p.rows].sort((a, b) => { const x = cellNum(a[c]), y = cellNum(b[c]);
      if (x != null && y != null) return (x - y) * s; if (x != null) return -1; if (y != null) return 1;
      return cellText(a[c]).localeCompare(cellText(b[c])) * s; });
  }, [p.rows, sort]);
  const tot = useMemo(() => columnTotals(p.columns, p.rows), [p.columns, p.rows]);
  const al = (k: number) => (p.align && p.align[k] === "end") || (!p.align && k > 0 && p.rows.length && cellNum(p.rows[0][k]) != null) ? "num" : "";
  return (<div className="tablewrap"><table>
    <thead><tr>{p.columns.map((c, k) => <th key={k} className={al(k)} onClick={() => setSort(sort[0] === k ? (sort[1] === -1 ? [k, 1] : [-1, 1]) : [k, -1])} title="Sort">
      {c}<span className="sorti">{sort[0] === k ? (sort[1] === -1 ? " ▼" : " ▲") : " ↕"}</span></th>)}</tr>
      {!p.noTotals && p.rows.length > 1 && tot.some((t, k) => k > 0 && t && t !== "—") ? <tr className="totrow">{tot.map((t, k) => <td key={k} className={al(k)}>{t ?? ""}</td>)}</tr> : null}</thead>
    <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c: any, k: number) => <td key={k} className={al(k)} style={{ color: c && typeof c === "object" && "tone" in c ? toneColor(c.tone) : undefined }}>
      {c && typeof c === "object" && "text" in c && !("$$typeof" in c) ? c.text : c}</td>)}</tr>)}</tbody>
  </table></div>);
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
