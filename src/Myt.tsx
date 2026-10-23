// Multi-Year Trends tab: one year x month table per metric, report-month and scope selectors, print layout.
// Data: payload.myt from myt_build.py (tracker metrics first, Bly Team Metrics Tracker sheet fills gaps). Null = no source coverage, shown as an em dash (never zero-filled).
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import "./myt.css";

type Metric = { k: string; label: string; tag?: string; conflict?: number; src: string; fmt: string; team?: number; missing?: number; why?: string; agg?: string; num?: string; den?: string; fixed?: string; group: string; flag?: Record<string, string> };
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

function tableRows(m: Metric, E: any, D: any, rep: number, ry: number) {
  const years: number[] = D.years.filter((y: number) => y <= ry);
  const yi = (y: number) => D.years.indexOf(y);
  const mi = rep - 1, all = [...Array(12).keys()], ytd = [...Array(rep).keys()];
  const missing = m.missing || !E.has(m);
  return years.map((y) => {
    const months = all.map((i) => (missing ? null : E.val(m, yi(y), [i])));
    const tot = missing ? null : E.val(m, yi(y), all, "total");
    const pm = mi > 0 ? months[mi - 1] : (yi(y - 1) >= 0 && !missing ? E.val(m, yi(y - 1), [11]) : null);
    const ly = yi(y - 1) >= 0 && !missing ? E.val(m, yi(y - 1), [mi]) : null;
    const yt = missing ? null : E.val(m, yi(y), ytd), lyt = yi(y - 1) >= 0 && !missing ? E.val(m, yi(y - 1), ytd) : null;
    return { y, months, tot, mom: pct(months[mi], pm), yoy: pct(months[mi], ly), ytdp: pct(yt, lyt) };
  });
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
          {m.tag ? <p className="myt-tags"><span className={"myt-tag " + (m.tag === "Tracker" ? "t" : m.tag === "Bly sheet" ? "s" : m.tag === "Recruiting sheet" ? "r" : "b")}>Source: {m.tag}</span>{m.conflict ? <span className="myt-tag c">Sheet differs &gt;5% (see list above)</span> : null}</p> : null}
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
              <td className="tot">{fmt(r.tot, m.fmt)}{m.flag && m.flag[String(r.y)] ? <sup className="myt-flag" title={m.flag[String(r.y)]}>*</sup> : null}</td><td className={"chg " + sign(r.mom)}>{r.mom}</td><td className={"chg " + sign(r.yoy)}>{r.yoy}</td><td className={"chg " + sign(r.ytdp)}>{r.ytdp}</td></tr>))}
          </tbody>
        </table>
      </div>
      {m.flag ? Object.entries(m.flag).map(([y, t]) => <p key={y} className="myt-flagnote">* {y}: {t}</p>) : null}
    </section>
  );
}
const sign = (s: string) => (s.startsWith("+") ? "up" : s.startsWith("-") ? "down" : "");

function Report({ D, scope, v, rep, ry, groups, sel }: { D: any; scope: string; v: string; rep: number; ry: number; groups: string[]; sel: Set<string> }) {
  const E = useMemo(() => engine(D, scope, v), [D, scope, v]);
  const ms: Metric[] = D.metrics.filter((m: Metric) => (scope === "team" || !m.team) && groups.includes(m.group) && sel.has(m.k));
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
          <div>{sel.size >= D.metrics.length ? "All metrics" : `${ms.length} selected metrics · ${Object.keys(byG).join(", ") || "none"}`}</div>
          <div>Leases &amp; referrals {v === "all" ? "included" : "excluded"} · Data as of {D.generated}{ry === D.cur[0] && rep === D.cur[1] ? " (month to date)" : ""}</div>
        </div>
      </div>
      {Object.entries(byG).map(([g, list]) => (
        <div key={g} className="myt-group"><h2 className="myt-gh serif">{g}</h2>{list.map((m) => <MetricTable key={m.k} m={m} E={E} D={D} rep={rep} ry={ry} />)}</div>))}
    </div>
  );
}

const PRESETS: { id: string; label: string; groups?: string[] }[] = [
  { id: "all", label: "All" },
  { id: "production", label: "Production", groups: ["Pipeline", "Production"] },
  { id: "money", label: "Money", groups: ["GCI & company dollar", "P&L"] },
  { id: "recruiting", label: "Recruiting", groups: ["Agents & recruiting"] },
  { id: "activity", label: "Activity", groups: ["Leads & activity"] },
];
const LS = "myt.metrics.v1";
function initialSel(D: any): Set<string> {
  const all: string[] = D ? D.metrics.map((m: Metric) => m.k) : [];
  try {
    const q = new URLSearchParams(window.location.search).get("myt");
    if (q) return new Set(q.split(",").filter((k) => all.includes(k)));
    const ls = localStorage.getItem(LS);
    if (ls) { const v = JSON.parse(ls); if (Array.isArray(v)) return new Set(v.filter((k: string) => all.includes(k))); }
  } catch { /* ignore */ }
  return new Set(all);
}
function saveBlob(blob: Blob, name: string) {
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
const fileBase = (scope: string, ry: number, rep: number) => `Bly_Team_MYT_${(scope === "team" ? "Team" : scope).replace(/[^A-Za-z0-9]+/g, "_")}_${ry}-${String(rep).padStart(2, "0")}`;
function exportRows(D: any, scope: string, v: string, rep: number, ry: number, list: Metric[]) {
  const E = engine(D, scope, v);
  return list.map((m) => ({ m, rows: tableRows(m, E, D, rep, ry) }));
}
const raw2 = (x: number | null, f: string) => (x === null || x === undefined || !isFinite(x) ? null : f === "%" ? Math.round(x * 10000) / 10000 : Math.round(x * 100) / 100);

function Picker({ D, scopeMetrics, sel, setSel, onClose }: { D: any; scopeMetrics: Metric[]; sel: Set<string>; setSel: (s: Set<string>) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const groups: string[] = Array.from(new Set(scopeMetrics.map((m) => m.group)));
  const shown = (m: Metric) => !q || (m.label + " " + m.group).toLowerCase().includes(q.toLowerCase());
  const setMany = (ks: string[], on: boolean) => { const n = new Set(sel); ks.forEach((k) => (on ? n.add(k) : n.delete(k))); setSel(n); };
  const preset = (p: typeof PRESETS[number]) => setSel(new Set(D.metrics.filter((m: Metric) => !p.groups || p.groups.includes(m.group)).map((m: Metric) => m.k)));
  const nSel = scopeMetrics.filter((m) => sel.has(m.k)).length;
  return (
    <div className="myt-pick-wrap" role="dialog" aria-modal="true" aria-label="Choose metrics" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="myt-pick">
        <div className="myt-pick-h"><b className="serif">Choose metrics</b><span>{nSel} of {scopeMetrics.length} selected</span><button className="myt-x" onClick={onClose} aria-label="Close">×</button></div>
        <input className="myt-search" type="search" placeholder="Search metrics" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="myt-presets">{PRESETS.map((p) => <button key={p.id} onClick={() => preset(p)}>{p.label}</button>)}
          <button onClick={() => setMany(scopeMetrics.map((m) => m.k), false)}>None</button></div>
        <div className="myt-pick-list">
          {groups.map((g) => { const gm = scopeMetrics.filter((m) => m.group === g && shown(m)); if (!gm.length) return null; return (
            <fieldset key={g} className="myt-pick-g"><legend>{g}<span><button onClick={() => setMany(gm.map((m) => m.k), true)}>All</button><button onClick={() => setMany(gm.map((m) => m.k), false)}>None</button></span></legend>
              {gm.map((m) => <label key={m.k} className="myt-pick-i"><input type="checkbox" checked={sel.has(m.k)} onChange={(e) => setMany([m.k], e.target.checked)} />{m.label}</label>)}
            </fieldset>); })}
        </div>
        <div className="myt-pick-f"><button className="primary" onClick={onClose}>Show {nSel} metrics</button></div>
      </div>
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
  const [sel, setSelRaw] = useState<Set<string>>(() => initialSel(D));
  const [pick, setPick] = useState(false);
  const [dl, setDl] = useState(false);
  const [msg, setMsg] = useState("");
  const setSel = (n: Set<string>) => { setSelRaw(n); try { localStorage.setItem(LS, JSON.stringify([...n])); } catch { /* ignore */ } };
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
  const scopeMetrics: Metric[] = D.metrics.filter((m: Metric) => scope === "team" || !m.team);
  const chosen = scopeMetrics.filter((m) => sel.has(m.k) && groups.includes(m.group));
  const shareLink = () => {
    const u = new URL(window.location.href); u.searchParams.set("myt", [...sel].join(","));
    navigator.clipboard?.writeText(u.toString()).then(() => setMsg("View link copied"), () => setMsg(u.toString())); setDl(false);
  };
  const doCsv = () => {
    const esc = (x: any) => { const t = x === null || x === undefined ? "" : String(x); return /[",\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; };
    const out: string[] = [`The Bly Team - Multi-Year Trends,${esc(scope === "team" ? "The Bly Team" : scope)},${MONL[rep - 1]} ${ry},Data as of ${D.generated}`, ""];
    exportRows(D, scope, v, rep, ry, chosen).forEach(({ m, rows }) => {
      out.push(esc(m.label) + "," + esc(m.group) + "," + esc("Source: " + (m.tag || "")));
      out.push(["Year", ...MON, "Total", "MOM %", "YOY %", "YTD %"].join(","));
      rows.forEach((r) => out.push([r.y, ...r.months.map((x) => raw2(x, m.fmt)), raw2(r.tot, m.fmt), r.mom, r.yoy, r.ytdp].map(esc).join(",")));
      if (m.flag) Object.entries(m.flag).forEach(([y, t]) => out.push(esc(`* ${y}: ${t}`)));
      out.push("");
    });
    saveBlob(new Blob(["\ufeff" + out.join("\r\n")], { type: "text/csv;charset=utf-8" }), fileBase(scope, ry, rep) + ".csv"); setDl(false);
  };
  const doXlsx = async () => {
    setDl(false); setMsg("Preparing Excel file…");
    const { default: writeExcelFile } = await import("write-excel-file/browser");
    const used = new Set<string>();
    const sheets = exportRows(D, scope, v, rep, ry, chosen).map(({ m, rows }) => {
      let name = m.label.replace(/[\\/?*[\]:]/g, " ").replace(/\s+/g, " ").slice(0, 31).trim(); let i = 2; while (used.has(name)) name = name.slice(0, 28) + " " + i++; used.add(name);
      const fm = m.fmt === "$" ? "$#,##0;-$#,##0" : m.fmt === "%" ? "0.00%" : m.fmt === "d" ? "0.00" : "#,##0.##";
      const head = (t: string) => ({ value: t, fontWeight: "bold", backgroundColor: "#F3EFE6" });
      const data: any[] = [
        [{ value: "The Bly Team · Multi-Year Trends", fontWeight: "bold", color: "#00519B" }],
        [{ value: `${m.label} · ${scope === "team" ? "The Bly Team" : scope} · ${MONL[rep - 1]} ${ry} · data as of ${D.generated}` }],
        [{ value: `Source: ${m.tag || ""}. ${m.src || ""}`.slice(0, 900) }],
        [],
        ["Year", ...MON, "Total", "MOM %", "YOY %", "YTD %"].map(head),
        ...rows.map((r) => [{ value: r.y, fontWeight: "bold" }, ...r.months.map((x) => { const v2 = raw2(x, m.fmt); return v2 === null ? null : { value: v2, type: Number, format: fm }; }), (() => { const v2 = raw2(r.tot, m.fmt); return v2 === null ? null : { value: v2, type: Number, format: fm, fontWeight: "bold" }; })(), { value: r.mom }, { value: r.yoy }, { value: r.ytdp }]),
        ...(m.flag ? Object.entries(m.flag).map(([y, t]) => [{ value: `* ${y}: ${t}`, color: "#A3332B" }]) : []),
      ];
      return { data, sheet: name, columns: [{ width: 8 }, ...MON.map(() => ({ width: 12 })), { width: 14 }, { width: 9 }, { width: 9 }, { width: 9 }], stickyRowsCount: 5 };
    });
    if (!sheets.length) { setMsg("No metrics selected"); return; }
    try { const blob = await (writeExcelFile as any)(sheets).toBlob(); saveBlob(blob, fileBase(scope, ry, rep) + ".xlsx"); setMsg(""); }
    catch (e: any) { setMsg("Excel export failed: " + (e?.message || e)); }
  };
  const doPrint = () => { setPrinting(true); document.body.classList.add("myt-printing"); setTimeout(() => window.print(), 60); };
  const conf: any[] = D.conflicts || [], notes: string[] = D.sheet_notes || [];
  const v = lrOn ? "all" : "x";
  return (
    <div className="myt">
      <div className="section myt-controls">
        <h2 className="serif">Multi-Year Trends</h2>
        <p className="caption">One table per metric, a row for each year since {D.years[0]} (as far back as Sisu goes), Jan–Dec, the year total, and MOM, YOY and YTD change for the report month. A dash (—) means no source covers that month. It is not a zero. Leases and referrals follow the global toggle in Filters. Each table is tagged with its source: Tracker (Sisu, FUB, eXp file, P&amp;L), Recruiting sheet (By The Numbers, snapshot {D.asof?.recruiting}), Bly sheet (Bly Team Metrics Tracker, snapshot {D.asof?.sheet}), or a combination. Tracker numbers win wherever they cover the same month; for recruiting, the recruiting sheet wins over the Bly sheet; the Bly sheet fills the rest. Recruiting tables show counts only.</p>
        <div className="myt-ctl">
          <label>Scope<select value={scope} onChange={(e) => setScope(e.target.value)}>{scopes.map((s) => <option key={s} value={s}>{s === "team" ? "The Bly Team (company)" : s}</option>)}</select></label>
          <label>Report month<select value={ym} onChange={(e) => setYm(e.target.value)}>{opts.map((o) => <option key={o} value={o}>{MONL[+o.slice(5) - 1]} {o.slice(0, 4)}</option>)}</select></label>
          <label>Section<select value={grp} onChange={(e) => setGrp(e.target.value)}><option value="all">All sections</option>{groupsAll.map((g) => <option key={g} value={g}>{g}</option>)}</select></label>
          <button className="myt-pick-btn" onClick={() => setPick(true)} aria-haspopup="dialog">Metrics · {chosen.length} of {scopeMetrics.filter((m) => groups.includes(m.group)).length}</button>
          <div className="myt-dl">
            <button className="primary myt-print-btn" onClick={() => setDl(!dl)} aria-haspopup="menu" aria-expanded={dl}>Download ▾</button>
            {dl ? <div className="myt-dl-menu" role="menu">
              <button role="menuitem" onClick={() => { setDl(false); doPrint(); }}>PDF (print view)</button>
              <button role="menuitem" onClick={doXlsx}>Excel (.xlsx, one sheet per metric)</button>
              <button role="menuitem" onClick={doCsv}>CSV</button>
              <button role="menuitem" onClick={shareLink}>Copy link to this view</button>
            </div> : null}
          </div>
        </div>
        {msg ? <p className="caption myt-msg" role="status">{msg}</p> : null}
        {scope !== "team" ? <p className="caption">Agent view shows agent-level Sisu metrics and the agent's eXp team share. Team-only metrics (agent count, recruiting, P&amp;L, FUB totals, ISA) appear under The Bly Team.</p> : null}
        {conf.length || notes.length ? <details className="myt-missing"><summary>Tracker vs Bly sheet: {conf.length} differences over 5% · sheet corrections applied ({notes.length})</summary>
          <ul>{notes.map((n: string, i: number) => <li key={"n" + i}>{n}</li>)}</ul>
          <div className="myt-scroll"><table className="myt-table myt-conf"><thead><tr><th className="yr">Metric</th><th>Year</th><th>Months</th><th>Tracker (used)</th><th>Bly sheet</th><th>Diff</th></tr></thead>
            <tbody>{conf.map((c: any, i: number) => { const f = /Volume|GCI|Dollar|Income|Profit|Expenses/.test(c.metric) ? "$" : "n"; return <tr key={i}><th className="yr">{c.metric}</th><td>{c.year}</td><td>{c.months}</td><td>{fmt(c.tracker, f)}</td><td>{fmt(c.sheet, f)}</td><td>{(c.diff_pct > 0 ? "+" : "") + c.diff_pct}%</td></tr>; })}</tbody></table></div></details> : null}
      </div>
      <Report D={D} scope={scope} v={v} rep={rep} ry={ry} groups={groups} sel={sel} />
      {pick ? createPortal(<Picker D={D} scopeMetrics={scopeMetrics} sel={sel} setSel={setSel} onClose={() => setPick(false)} />, document.body) : null}
      {printing ? createPortal(<div className="myt-print"><Report D={D} scope={scope} v={v} rep={rep} ry={ry} groups={groups} sel={sel} /></div>, document.body) : null}
    </div>
  );
}
