// Multi-Year Trends tab: one year x month table per metric, report-month and scope selectors, print layout.
// Data: payload.myt from myt_build.py (tracker metrics first, Bly Team Metrics Tracker sheet fills gaps). Null = no source coverage, shown as an em dash (never zero-filled).
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import "./myt.css";

type Metric = { k: string; label: string; tag?: string; conflict?: number; src: string; fmt: string; team?: number; missing?: number; why?: string; agg?: string; num?: string; den?: string; fixed?: string; group: string };
type Grid = (number | null)[][];
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function fmt(v: number | null | undefined, f: string): string {
  if (v === null || v === undefined || !isFinite(v)) return "—";
  if (f === "$") return (v < 0 ? "-$" : "$") + Math.round(Math.abs(v)).toLocaleString("en-US");
  if (f === "%") return (v * 100).toFixed(2) + "%";
  if (f === "d") return v.toFixed(2);
  return Number.isInteger(Math.round(v * 100) / 100) ? Math.round(v).toLocaleString("en-US") : v.toFixed(1);
}
function pct(a: number | null, b: number | null): string {
  if (a === null || b === null || !isFinite(a) || !isFinite(b) || b === 0) return "—";
  const p = ((a - b) / Math.abs(b)) * 100; return (p > 0 ? "+" : "") + p.toFixed(1) + "%";
}
const sumN = (xs: (number | null)[]) => { const v = xs.filter((x): x is number => x !== null); return v.length ? v.reduce((a, b) => a + b, 0) : null; };

function engine(D: any, scope: string, v: string) {
  const S = D.scopes[scope] || {};
  const raw = (k: string, fixed?: string): Grid | null => { const g = (S[fixed || v] || {})[k]; return g || null; };
  const isTeam = scope === "team";
  // aggregate a base series over a set of month indexes
  const aggBase = (m: Metric | undefined, k: string, yi: number, months: number[], fixed?: string, mode?: string): number | null => {
    const g = raw(k, fixed); if (!g) return null;
    const xs = months.map((i) => g[yi][i]);
    if (mode === "total" && months.length === 12 && isTeam && !xs.some((x) => x !== null)) {
      const a = (D.ann || {})[k]; const t = a ? a[String(D.years[yi])] : undefined; if (t !== undefined && t !== null) return t;  // annual-only source year
    }
    if (k === "agents" || k === "active") {
      if (k === "agents" && mode === "total" && months.length === 12) return xs.some((x) => x !== null) ? D.agents_tot[String(D.years[yi])] ?? null : null;
      const v2 = xs.filter((x): x is number => x !== null); return v2.length ? v2.reduce((a, b) => a + b, 0) / v2.length : null;
    }
    if (m && m.agg === "last") { for (let i = months.length - 1; i >= 0; i--) if (xs[i] !== null) return xs[i]; return null; }
    return sumN(xs);
  };
  const val = (m: Metric, yi: number, months: number[], mode?: string): number | null => {
    if (m.missing) return null;
    if (m.num && m.den) {
      const n = aggBase(undefined, m.num, yi, months, m.fixed, mode), d = aggBase(undefined, m.den, yi, months, m.fixed, mode);
      return n === null || d === null || d === 0 ? null : n / d;
    }
    return aggBase(m, m.k, yi, months, m.fixed, mode);
  };
  return { val, isTeam, has: (m: Metric) => !m.missing && (m.num ? !!raw(m.num, m.fixed) && !!raw(m.den!, m.fixed) : !!raw(m.k, m.fixed)) };
}

function Spark({ rows, years, cur }: { rows: (number | null)[][]; years: number[]; cur: number }) {
  const W = 220, H = 64, P = 4;
  const show = rows.map((r, i) => ({ r, y: years[i] })).filter((x) => x.y <= cur).slice(-3);
  const all = show.flatMap((x) => x.r).filter((x): x is number => x !== null);
  if (!all.length) return <div className="myt-spark empty">no data</div>;
  const lo = Math.min(0, ...all), hi = Math.max(...all) || 1;
  const X = (i: number) => P + (i * (W - 2 * P)) / 11, Yp = (v: number) => H - P - ((v - lo) * (H - 2 * P)) / (hi - lo || 1);
  const col = ["#B9B4A8", "#C0A062", "#00519B"].slice(-show.length);
  return (
    <figure className="myt-spark" aria-label="Monthly trend, last three years">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img">
        {show.map((s, j) => {
          let d = "", pen = false;
          s.r.forEach((x, i) => { if (x === null) { pen = false; return; } d += (pen ? "L" : "M") + X(i).toFixed(1) + " " + Yp(x).toFixed(1); pen = true; });
          return <path key={s.y} d={d} fill="none" stroke={col[j]} strokeWidth={j === show.length - 1 ? 2 : 1.4} vectorEffect="non-scaling-stroke" />;
        })}
      </svg>
      <figcaption>{show.map((s, j) => <span key={s.y}><i style={{ background: col[j] }} />{s.y}</span>)}</figcaption>
    </figure>
  );
}

function MetricTable({ m, E, D, rep, ry }: { m: Metric; E: any; D: any; rep: number; ry: number }) {
  const years: number[] = D.years.filter((y: number) => y <= ry);
  const yi = (y: number) => D.years.indexOf(y);
  const mi = rep - 1, all = [...Array(12).keys()], ytd = [...Array(rep).keys()];
  const missing = m.missing || !E.has(m);
  const cell = (y: number, i: number) => (missing ? null : E.val(m, yi(y), [i]));
  const rows = years.map((y) => {
    const months = all.map((i) => cell(y, i));
    const tot = missing ? null : E.val(m, yi(y), all, "total");
    const cm = months[mi];
    const pm = mi > 0 ? months[mi - 1] : (yi(y - 1) >= 0 && !missing ? E.val(m, yi(y - 1), [11]) : null);
    const ly = yi(y - 1) >= 0 && !missing ? E.val(m, yi(y - 1), [mi]) : null;
    const yt = missing ? null : E.val(m, yi(y), ytd), lyt = yi(y - 1) >= 0 && !missing ? E.val(m, yi(y - 1), ytd) : null;
    return { y, months, tot, mom: pct(cm, pm), yoy: pct(cm, ly), ytdp: pct(yt, lyt) };
  });
  const isAvg = m.num || m.k === "agents" || m.k === "active" || m.agg === "last";
  return (
    <section className={"myt-metric" + (missing ? " is-missing" : "")}>
      <header className="myt-mh">
        <div>
          <h3 className="serif">{m.label}</h3>
          <p className="myt-src">{missing ? <><b>Missing source.</b> {m.why || "No data for this scope."}</> : m.src}</p>
          {m.tag ? <p className="myt-tags"><span className={"myt-tag " + (m.tag === "Tracker" ? "t" : m.tag === "Bly sheet" ? "s" : "b")}>Source: {m.tag}</span>{m.conflict ? <span className="myt-tag c">Sheet differs &gt;5% (see list above)</span> : null}</p> : null}
        </div>
        {!missing ? <Spark rows={rows.map((r) => r.months)} years={years} cur={ry} /> : null}
      </header>
      <div className="myt-scroll" tabIndex={0} role="region" aria-label={m.label + " by year and month"}>
        <table className="myt-table">
          <thead><tr><th className="yr">Year</th>{MON.map((x, i) => <th key={x} className={i === mi ? "sel" : ""}>{x}</th>)}
            <th className="tot">{isAvg ? (m.agg === "last" ? "Dec / last" : "Year") : "Total"}</th><th className="chg">MOM %<small>{MON[mi]}</small></th><th className="chg">YOY %<small>{MON[mi]}</small></th><th className="chg">YTD %<small>Jan–{MON[mi]}</small></th></tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.y} className={r.y === ry ? "cur" : ""}><th className="yr">{r.y}</th>
              {r.months.map((x, i) => <td key={i} className={i === mi ? "sel" : ""}>{fmt(x, m.fmt)}</td>)}
              <td className="tot">{fmt(r.tot, m.fmt)}</td><td className={"chg " + sign(r.mom)}>{r.mom}</td><td className={"chg " + sign(r.yoy)}>{r.yoy}</td><td className={"chg " + sign(r.ytdp)}>{r.ytdp}</td></tr>))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
const sign = (s: string) => (s.startsWith("+") ? "up" : s.startsWith("-") ? "down" : "");

function Report({ D, scope, v, rep, ry, groups }: { D: any; scope: string; v: string; rep: number; ry: number; groups: string[] }) {
  const E = useMemo(() => engine(D, scope, v), [D, scope, v]);
  const ms: Metric[] = D.metrics.filter((m: Metric) => (scope === "team" || !m.team) && groups.includes(m.group));
  const byG: Record<string, Metric[]> = {};
  ms.forEach((m) => (byG[m.group] = byG[m.group] || []).push(m));
  return (
    <div className="myt-report">
      <div className="myt-head">
        <div className="myt-head-l"><div className="myt-kicker">{scope === "team" ? "Team Multi-Year Trends" : "Multi-Year Trends"}</div>
          <h2 className="serif">{scope === "team" ? "The Bly Team" : scope}</h2>
          <div className="myt-month serif">{MONL[rep - 1]} {ry}</div></div>
        <div className="myt-head-r">
          <div>The Bly Team · eXp Realty</div>
          <div>*MOM = {MON[rep - 1]} vs prior month · YOY = {MON[rep - 1]} vs same month prior year · YTD = Jan–{MON[rep - 1]} vs the same months of the prior year</div>
          <div>Leases &amp; referrals {v === "all" ? "included" : "excluded"} · Data as of {D.generated}{ry === D.cur[0] && rep === D.cur[1] ? " (month to date)" : ""}</div>
        </div>
      </div>
      {Object.entries(byG).map(([g, list]) => (
        <div key={g} className="myt-group"><h2 className="myt-gh serif">{g}</h2>{list.map((m) => <MetricTable key={m.k} m={m} E={E} D={D} rep={rep} ry={ry} />)}</div>))}
    </div>
  );
}

export default function Myt({ data, lrOn = true }: { data: any; lrOn?: boolean }) {
  const D = data;
  const [scope, setScope] = useState("team");
  const [ym, setYm] = useState(D ? `${D.cur[0]}-${String(D.cur[1]).padStart(2, "0")}` : "");
  const groupsAll: string[] = D ? Array.from(new Set(D.metrics.map((m: Metric) => m.group))) : [];
  const [grp, setGrp] = useState("all");
  const [printing, setPrinting] = useState(false);
  useEffect(() => {
    const after = () => { setPrinting(false); document.body.classList.remove("myt-printing"); };
    window.addEventListener("afterprint", after); return () => window.removeEventListener("afterprint", after);
  }, []);
  if (!D) return <div className="section"><h2 className="serif">Multi-Year Trends</h2><p className="caption">Multi-year data is not in this snapshot yet. It is added by the next daily pipeline run.</p></div>;
  const opts: string[] = [];
  for (let y = D.cur[0]; y >= D.years[0]; y--) for (let m = 12; m >= 1; m--) if (y < D.cur[0] || m <= D.cur[1]) opts.push(`${y}-${String(m).padStart(2, "0")}`);
  const ry = +ym.slice(0, 4), rep = +ym.slice(5, 7);
  const scopes = ["team", ...Object.keys(D.scopes).filter((s) => s !== "team")];
  const groups = grp === "all" ? groupsAll : [grp];
  const doPrint = () => { setPrinting(true); document.body.classList.add("myt-printing"); setTimeout(() => window.print(), 60); };
  const conf: any[] = D.conflicts || [], notes: string[] = D.sheet_notes || [];
  const v = lrOn ? "all" : "x";
  return (
    <div className="myt">
      <div className="section myt-controls">
        <h2 className="serif">Multi-Year Trends</h2>
        <p className="caption">One table per metric, a row for each year since {D.years[0]} (as far back as Sisu goes), Jan–Dec, the year total, and MOM, YOY and YTD change for the report month. A dash (—) means no source covers that month. It is not a zero. Leases and referrals follow the global toggle in Filters. Each table is tagged with its source: Tracker (Sisu, FUB, eXp file, P&amp;L), Bly sheet (Bly Team Metrics Tracker, snapshot {D.asof?.sheet}), or both. Tracker numbers win wherever they cover the same month; the sheet fills the rest.</p>
        <div className="myt-ctl">
          <label>Scope<select value={scope} onChange={(e) => setScope(e.target.value)}>{scopes.map((s) => <option key={s} value={s}>{s === "team" ? "The Bly Team (company)" : s}</option>)}</select></label>
          <label>Report month<select value={ym} onChange={(e) => setYm(e.target.value)}>{opts.map((o) => <option key={o} value={o}>{MONL[+o.slice(5) - 1]} {o.slice(0, 4)}</option>)}</select></label>
          <label>Section<select value={grp} onChange={(e) => setGrp(e.target.value)}><option value="all">All sections</option>{groupsAll.map((g) => <option key={g} value={g}>{g}</option>)}</select></label>
          <button className="primary myt-print-btn" onClick={doPrint}>Print / PDF</button>
        </div>
        {scope !== "team" ? <p className="caption">Agent view shows agent-level Sisu metrics and the agent's eXp team share. Team-only metrics (agent count, recruiting, P&amp;L, FUB totals, ISA) appear under The Bly Team.</p> : null}
        {conf.length || notes.length ? <details className="myt-missing"><summary>Tracker vs Bly sheet: {conf.length} differences over 5% · sheet corrections applied ({notes.length})</summary>
          <ul>{notes.map((n: string, i: number) => <li key={"n" + i}>{n}</li>)}</ul>
          <div className="myt-scroll"><table className="myt-table myt-conf"><thead><tr><th className="yr">Metric</th><th>Year</th><th>Months</th><th>Tracker (used)</th><th>Bly sheet</th><th>Diff</th></tr></thead>
            <tbody>{conf.map((c: any, i: number) => { const f = /Volume|GCI|Dollar|Income|Profit|Expenses/.test(c.metric) ? "$" : "n"; return <tr key={i}><th className="yr">{c.metric}</th><td>{c.year}</td><td>{c.months}</td><td>{fmt(c.tracker, f)}</td><td>{fmt(c.sheet, f)}</td><td>{(c.diff_pct > 0 ? "+" : "") + c.diff_pct}%</td></tr>; })}</tbody></table></div></details> : null}
      </div>
      <Report D={D} scope={scope} v={v} rep={rep} ry={ry} groups={groups} />
      {printing ? createPortal(<div className="myt-print"><Report D={D} scope={scope} v={v} rep={rep} ry={ry} groups={groups} /></div>, document.body) : null}
    </div>
  );
}
