// Main Team screen: Snapshot / Pacing / CEO (Sisu-style layouts in The Bly Team brand). Hand-written; contains no data.
import { useMemo, useState } from "react";
import "./mainscreen.css";
import { usePersist } from "./agent";

const C = { charcoal: "#12151C", ink: "#1A1A1A", ivory: "#F3F1EB", blue: "#00519B", gold: "#C0A062", grey: "#8C8A84", line: "#D6D0C2" };
const MN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DASH = "—";
const ok = (v: any) => v !== null && v !== undefined && !Number.isNaN(v);
const n0 = (v: any) => (ok(v) ? (Math.abs(v % 1) > 0.001 ? v.toFixed(1) : Math.round(v).toLocaleString("en-US")) : DASH);
const usd = (v: any) => (ok(v) ? (v < 0 ? "-$" : "$") + Math.round(Math.abs(v)).toLocaleString("en-US") : DASH);
const usdK = (v: any) => (!ok(v) ? DASH : Math.abs(v) >= 1e6 ? `$${(v / 1e6).toFixed(2)}M` : Math.abs(v) >= 1e3 ? `$${(v / 1e3).toFixed(0)}K` : usd(v));
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : DASH);
const sum = (a: any[]) => a.reduce((s: number, x: any) => s + (ok(x) ? x : 0), 0);
const add = (a: number[], b: number[]) => a.map((x, i) => x + b[i]);

const STAT = ["Not on pace", "On pace", "Goal achieved"], STC = [C.grey, C.gold, C.blue];
/** period goal from the 2027 annual target: target for the full period, plus pace target for elapsed days */
function perGoal(d: any, per: string, annual: number | null | undefined) {
  if (!annual) return null;
  const [a, b] = d.periods[per].map((x: string) => new Date(x + "T12:00:00"));
  const elapsed = Math.round((+b - +a) / 864e5) + 1;
  let full = elapsed;
  if (per === "mtd") full = d.dim; else if (per === "ytd") full = d.goals?.ndy || 365;
  const ndy = d.goals?.ndy || 365;
  return { full: (annual * full) / ndy, pace: (annual * elapsed) / ndy };
}
const status = (val: number, g: { full: number; pace: number } | null) => (!g ? -1 : val >= g.full ? 2 : val >= g.pace ? 1 : 0);
type P = { data: any; lrOn: boolean; tab: string; setTab: (t: string) => void; agent?: string | null };
const lkey = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");
/** One agent's slice of main.json in the same shape as the team payload. Goals: the agent's own (if any in data), never the team goal. */
function agentData(data: any, agent: string) {
  const A = data.by_agent?.[agent]; if (!A) return null;
  const key = Object.keys(data.agents || {}).find((k) => lkey(k) === lkey(agent));
  return { ...data, series: A.series, vol: A.vol, gci: A.gci, pend: A.pend, cash: A.cash, pmon: A.pmon, conv: A.conv, codollar: A.codollar || { all: [0,0,0,0,0,0,0,0,0,0,0,0], x: [0,0,0,0,0,0,0,0,0,0,0,0] }, goals: null, agoal: A.goal, agent, agentKey: key };
}
export const MAIN_TABS = [{ value: "snapshot", label: "Snapshot" }, { value: "pacing", label: "Pacing" }, { value: "ceo", label: "CEO" }, { value: "details", label: "Details" }];

export default function MainScreen({ data: data0, lrOn, tab, setTab, agent }: P) {
  if (!data0) return <div className="mx-note">Main screen data is not in this snapshot yet. It appears after the next daily pipeline run.</div>;
  const data = agent ? agentData(data0, agent) : data0;
  const bar = <div className="mx-sub" role="tablist">{MAIN_TABS.map((t) => <button key={t.value} role="tab" aria-selected={tab === t.value} className={tab === t.value ? "on" : ""} onClick={() => setTab(t.value)}>{t.label}</button>)}</div>;
  if (!data) return <div className="mx">{bar}<div className="agentbanner"><b className="serif">{agent}</b><span>— No Sisu production recorded for this agent in this snapshot.</span></div></div>;
  return (<div className="mx">
    {bar}
    {agent && tab !== "details" ? <div className="agentbanner"><b className="serif">{agent}</b><span>Sisu units credited to this agent (co-agented deals split; team-leader share stays team-only). {data.agoal ? "Goal from the agent's own Sisu goal." : "No goal for this agent in the data, so no goal line."}</span></div> : null}
    {tab === "snapshot" ? <Snapshot d={data} v={lrOn ? "all" : "x"} /> : null}
    {tab === "pacing" ? <Pacing d={data} v={lrOn ? "all" : "x"} /> : null}
    {tab === "ceo" ? <Ceo d={data} v={lrOn ? "all" : "x"} lrOn={lrOn} /> : null}
    {tab !== "details" ? <p className="mx-note">{`Units are transactions: Sisu buyer and seller records at the same address on the same date count once (volume once, GCI from both sides kept), eXp .1/.2 files are one deal, co-agented deals are split, and the Fello AI dialer (Jesse Jones) is excluded. Our totals can differ from Sisu's own dashboards for these reasons. Leases & referrals ${lrOn ? "included" : "excluded"} (global switch). ${DASH} = no data.`}</p> : null}
  </div>);
}

/* ---------------- Snapshot ---------------- */
function Snapshot({ d, v }: { d: any; v: string }) {
  const [mode, setMode] = usePersist<"m" | "a">("sm", "m");
  const Y = d.years[2], m = d.month - 1, S = d.series[v];
  const yt = (k: string, s: "b" | "s") => sum(S[k][Y][s].slice(0, m + 1));
  const mt = (k: string) => S[k][Y].b[m] + S[k][Y].s[m];
  const card = (title: string, k: string) => (
    <div className="mx-kpi"><div className="mx-kpi-t">{title}</div><div className="mx-kpi-v serif">{n0(yt(k, "b") + yt(k, "s"))}</div>
      <div className="mx-kpi-row"><span>Total MTD</span><b>{n0(mt(k))}</b></div>
      <div className="mx-kpi-row"><span>Buyers</span><b>{n0(yt(k, "b"))}</b></div><div className="mx-kpi-row"><span>Sellers</span><b>{n0(yt(k, "s"))}</b></div></div>);
  const pb = d.pend[v].b.units, ps = d.pend[v].s.units;
  const tot = (k: string) => Object.fromEntries(d.years.map((y: number) => [y, add(S[k][y].b, S[k][y].s)]));
  const tot2 = (o: any) => Object.fromEntries(d.years.map((y: number) => [y, add(o[y].b, o[y].s)]));
  const charts: [string, Record<string, (number | null)[]>][] = [
    ["Under Contract Units", tot("uc")], ["Closed Units", tot("closed")], ["Signed Units", tot("signed")],
    ["Appointments Met", tot("met")], ["Appointments Set", tot("set")], ["Conversations", d.conv]];
  return (<div className="mx-stack">
    <div className="mx-kpis">{card("YTD Signed", "signed")}{card("YTD Under Contract", "uc")}{card("YTD Closed", "closed")}
      <div className="mx-kpi"><div className="mx-kpi-t">Units Pending</div><div className="mx-kpi-v serif">{n0(pb + ps)}</div>
        <div className="mx-kpi-row"><span>Buyers</span><b>{n0(pb)}</b></div><div className="mx-kpi-row"><span>Sellers</span><b>{n0(ps)}</b></div><div className="mx-kpi-row muted"><span>Sisu, open now</span><b /></div></div></div>
    <div className="mx-bar"><div className="mx-seg">{[["m", "Monthly"], ["a", "Annually"]].map(([k, l]) => <button key={k} className={mode === k ? "on" : ""} aria-pressed={mode === k} onClick={() => setMode(k as any)}>{l}</button>)}</div>
      <span className="mx-hint">{mode === "a" ? "Running total through each month" : "Units per month"} · dotted = {MN[m]} projected from month to date{d.goals ? ` · gold dashed = ${d.goals.year} monthly goal` : d.agoal ? " · gold dashed = agent goal" : d.agent ? " · No agent goal in data" : " · Goals not set"}</span></div>
    <div className="mx-charts">
      {d.goals || d.agent ? <><LineChart title="Closed Volume" s={tot2(d.vol[v])} d={d} cum={mode === "a"} money goal={d.goals ? d.goals.monthly.volume : d.agoal?.volume ? d.agoal.volume / 12 : null} goalNote={d.agent ? "no agent goal in data" : undefined} />
        <LineChart title="Closed GCI (gross)" s={tot2(d.gci[v])} d={d} cum={mode === "a"} money goal={d.goals ? d.goals.monthly.gci : d.agoal?.gci ? d.agoal.gci / 12 : null} goalNote={d.agent ? "no agent goal in data" : undefined} /></> : null}
      {charts.map(([t, s]) => <LineChart key={t} title={t} s={s} d={d} cum={mode === "a"} goalNote={d.goals ? `no ${d.goals.year} unit goal in plan` : d.agent ? "no agent goal in data" : undefined} />)}</div>
    <p className="mx-note">Appointments set/met in Sisu are only sparsely dated before 2026, and Sisu activity (conversations = Sisu "contacts") was barely logged from Oct 2024 to Jul 2026; those months show as gaps, not zeros.</p>
  </div>);
}

function LineChart({ title, s, d, cum, money, goal, goalNote }: { title: string; s: Record<string, (number | null)[]>; d: any; cum: boolean; money?: boolean; goal?: number | null; goalNote?: string }) {
  const fm = money ? usdK : n0;
  const [Y0, Y1, Y2] = d.years; const m = d.month - 1;
  const proj = d.day < d.dim ? (s[Y2][m] ?? null) !== null ? (s[Y2][m] as number) * d.dim / d.day : null : null;
  const mk = (a: (number | null)[], cut?: number) => { let r = 0; return a.map((x, i) => (cut !== undefined && i > cut ? null : !ok(x) ? (cum ? null : null) : cum ? (r += x as number) : x)); };
  const cur = mk(s[Y2], d.day < d.dim ? m - 1 : m);
  const curFull = mk(s[Y2], m);
  const pv = proj === null ? null : cum ? (ok(cur[m - 1]) ? (cur[m - 1] as number) : 0) + proj : proj;
  const lines = [{ y: Y0, c: C.grey, a: mk(s[Y0]) }, { y: Y1, c: C.gold, a: mk(s[Y1]) }, { y: Y2, c: C.blue, a: d.day < d.dim ? cur : curFull }];
  const ytd = (a: (number | null)[]) => { const xs = a.slice(0, m + 1); return xs.some(ok) ? sum(xs) : null; };
  const yoy = (y: number, prev: number) => { const a = ytd(s[y]), b = ytd(s[prev]); return a === null || b === null || !b ? DASH : `${a >= b ? "+" : ""}${Math.round(((a - b) / b) * 100)}%`; };
  const ga = goal ? MN.map((_, i) => (cum ? goal * (i + 1) : goal)) : null;
  const all = [...lines.flatMap((l) => l.a), pv, ...(ga || [])].filter(ok) as number[];
  const max = Math.max(1, ...all) * 1.1; const W = 320, H = 150, pl = money ? 40 : 30, pr = 8, pt = 8, pb = 20;
  const X = (i: number) => pl + (i * (W - pl - pr)) / 11, Yp = (v: number) => pt + (H - pt - pb) * (1 - v / max);
  const path = (a: (number | null)[]) => a.reduce((p: string, v, i) => (ok(v) ? p + `${p && ok(a[i - 1]) ? "L" : "M"}${X(i).toFixed(1)},${Yp(v as number).toFixed(1)}` : p), "");
  const ticks = [0, max / 2, max].map((t) => Math.round(t));
  const prevPt = m > 0 && ok(cur[m - 1]) ? [X(m - 1), Yp(cur[m - 1] as number)] : null;
  return (<figure className="mx-chart">
    <figcaption className="serif">{title}</figcaption>
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title} by month, ${Y2} vs ${Y1} vs ${Y0}`}>
      {ticks.map((t) => <g key={t}><line x1={pl} x2={W - pr} y1={Yp(t)} y2={Yp(t)} stroke="#E6E2D8" /><text x={pl - 4} y={Yp(t) + 3} textAnchor="end" className="mx-ax">{money ? usdK(t) : t.toLocaleString()}</text></g>)}
      {MN.map((n, i) => (i % 2 === 0 ? <text key={n} x={X(i)} y={H - 6} textAnchor="middle" className="mx-ax">{n}</text> : null))}
      {ga ? <path d={path(ga)} fill="none" stroke={C.gold} strokeWidth={1.5} strokeDasharray="6 4" /> : null}
      {lines.map((l) => <path key={l.y} d={path(l.a)} fill="none" stroke={l.c} strokeWidth={l.y === Y2 ? 2.5 : 1.75} />)}
      {pv !== null ? (<g>{prevPt ? <line x1={prevPt[0]} y1={prevPt[1]} x2={X(m)} y2={Yp(pv)} stroke={C.blue} strokeWidth={2} strokeDasharray="4 3" /> : null}
        <circle cx={X(m)} cy={Yp(pv)} r={3.5} fill="#fff" stroke={C.blue} strokeWidth={2} /></g>) : null}
      {lines.map((l) => l.a.map((v, i) => (ok(v) && l.y === Y2 ? <circle key={l.y + "-" + i} cx={X(i)} cy={Yp(v as number)} r={2.2} fill={l.c} /> : null)))}
    </svg>
    <div className="mx-legend">
      <span><i style={{ background: C.blue }} />{Y2} <b>{fm(ytd(s[Y2]))}</b> <em>{yoy(Y2, Y1)}</em></span>
      <span><i style={{ background: C.gold }} />{Y1} <b>{fm(ytd(s[Y1]))}</b> <em>{yoy(Y1, Y0)}</em></span>
      <span><i style={{ background: C.grey }} />{Y0} <b>{fm(ytd(s[Y0]))}</b></span>
      {goal ? <span><i className="dash gold" />{d.goals ? d.goals.year : "Agent"} goal <b>{fm(goal)}/mo</b></span> : <span className="muted"><i className="dash" />Goals: {goalNote || "not set"}</span>}
    </div>
    {pv !== null ? <div className="mx-proj">{MN[m]} projected: {fm(Math.round(proj as number))} (month to date {fm(s[Y2][m])})</div> : null}
  </figure>);
}

/* ---------------- Pacing (circles) ---------------- */
const PERS = [{ value: "mtd", label: "This Month" }, { value: "lm", label: "Last Month" }, { value: "t90", label: "Last 90 Days" }, { value: "ytd", label: "Year to Date" }];
function Pacing({ d, v }: { d: any; v: string }) {
  const [per, setPer] = usePersist("pp", "mtd"); const [who0, setWho] = usePersist("pw", "team");
  const who = d.agent ? (d.agentKey ?? "__none") : who0;
  const names = useMemo(() => Object.keys(d.agents).filter((k) => k !== "team" && k !== "Unknown").sort(), [d]);
  const AZ = { b: {}, s: {} }; const A = d.agent ? (d.agents[who]?.[v]?.[per] ?? AZ) : (d.agents[who] || d.agents.team)[v][per]; const g = (s: string, k: string) => (A[s] && A[s][k]) || 0;
  const both = (k: string) => g("b", k) + g("s", k);
  const conv = (d.convA[who] || {})[per];
  const m = d.month - 1, Y = d.years[2];
  const fcOk = (who === "team" || !!d.agent) && per === "mtd";
  const forecast = fcOk ? d.pmon[v].units[m] : null;
  const fvol = fcOk ? d.pmon[v].vol[m] : null;
  const G = who === "team" && !d.agent ? d.goals : null; const runMode = G && G.mode === "runrate";
  const gv = perGoal(d, per, d.agent ? d.agoal?.volume : G?.annual.volume);
  const top: any[] = [["Closed Volume", usdK(both("vol")), "", both("vol"), gv], ["Closed Units", n0(both("closed"))],
    ["Closed & Forecasted", forecast === null ? DASH : n0(both("closed") + forecast), forecast === null ? (d.agent ? "This Month only" : "This Month, whole team or selected agent") : `${n0(forecast)} pending forecast to close in ${MN[m]}`],
    ["Closed & Forecasted Volume", fvol === null ? DASH : usdK(both("vol") + fvol), fvol === null ? (d.agent ? "This Month only" : "This Month, whole team or selected agent") : "", fvol === null ? null : both("vol") + fvol, fvol === null ? null : gv], ["U/C Volume", usdK(both("ucvol"))]];
  const ST = [["set", "Appointments Set"], ["met", "Appointments Met"], ["signed", "Signed"], ["uc", "Under Contract"], ["closed", "Closed"]];
  const row = (s: "b" | "s") => (<div className="mx-ringrow">
    <div className="mx-side">{s === "b" ? "Buyer" : "Seller"}</div>
    {ST.map(([k, l], i) => (<div className="mx-ringcell" key={k}>
      {i > 0 ? <div className="mx-conv" title={`${ST[i - 1][1]} to ${l}`}>{pct(g(s, k), g(s, ST[i - 1][0]))}</div> : null}
      <Ring value={g(s, k)} label={`${s === "b" ? "Buyer" : "Seller"} ${l}`} /></div>))}
  </div>);
  return (<div className="mx-stack">
    <div className="mx-filters">
      <label className="mx-field"><span>Period</span><select value={per} onChange={(e) => setPer(e.target.value)}>{PERS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</select></label>
      {d.agent ? null : <label className="mx-field"><span>Scope</span><select value={who} onChange={(e) => setWho(e.target.value)}><option value="team">Whole team</option>{names.map((n) => <option key={n} value={n}>{n}</option>)}</select></label>}
      <span className="mx-hint">{d.periods[per][0]} to {d.periods[per][1]} · Sisu dates</span>
    </div>
    {G ? <GoalBanner d={d} v={v} /> : null}
    <div className="mx-tops">{top.map(([t, val, sub, raw, gg]) => { const st = status(raw || 0, gg); const f = gg ? Math.min(1, (raw || 0) / gg.full) : 0;
      return (<div className="mx-top" key={t}><div className="mx-kpi-t">{Y} {t}</div><div className="mx-top-v serif">{val}</div>
      <div className="mx-prog"><div className="mx-prog-track" />{gg ? <><div className="mx-prog-fill" style={{ width: `${f * 100}%`, background: STC[st] }} /><div className="mx-prog-mark" style={{ left: `${Math.min(1, gg.pace / gg.full) * 100}%` }} /></> : null}</div>
      <div className="mx-prog-l"><span>{gg ? `${STAT[st]} · ${pct(raw || 0, gg.full)}` : sub || (who === "team" && !d.agent ? "No 2027 goal for this" : "No goal for this agent in data")}</span><span>{gg ? `${runMode ? "2027 rate" : "Goal"} ${usdK(gg.full)}` : ""}</span></div></div>); })}</div>
    <div className="mx-legend mx-c"><span><i style={{ background: C.grey }} />Not on pace</span><span><i style={{ background: C.gold }} />On pace</span><span><i style={{ background: C.blue }} />Goal achieved</span><span className="muted">{G ? `${runMode ? `Run-rate vs ${G.year} goal: ${Y} actuals vs the same period at the ${G.year} target rate (annual ÷ 365 per day). ` : ""}Volume has a goal; the ${G.year} plan has no unit or appointment goals, so rings show actuals only. Tick = pace for days elapsed.` : d.agent ? (d.agoal ? "Volume uses the agent's own goal. Tick = pace for days elapsed." : "No per-agent goal in the data, so no goal line; rings show actuals.") : "Goals are team-level only; rings show actuals."}</span></div>
    <div className="mx-circles">
      <div className="mx-convcol"><Ring value={conv} label="Conversations" big /><div className="mx-hint">Sisu contacts logged</div></div>
      <div className="mx-rows">{row("b")}{row("s")}</div>
    </div>
  </div>);
}
function Ring({ value, goal, label, big }: { value: any; goal?: number | null; label: string; big?: boolean }) {
  const r = 42, c = 2 * Math.PI * r; const f = goal ? Math.min(1, (value || 0) / goal) : 0;
  return (<div className={"mx-ring" + (big ? " big" : "")}>
    <div className="mx-ring-l serif">{label}</div>
    <svg viewBox="0 0 100 100" aria-label={`${label}: ${n0(value)}, goal not set`}>
      <circle cx="50" cy="50" r={r} fill={C.charcoal} stroke="#2C313B" strokeWidth="7" />
      {goal ? <circle cx="50" cy="50" r={r} fill="none" stroke={f >= 1 ? C.blue : C.gold} strokeWidth="7" strokeDasharray={`${c * f} ${c}`} transform="rotate(-90 50 50)" /> : null}
      <text x="50" y="47" textAnchor="middle" className="mx-ring-v">{n0(value)}</text>
      <line x1="32" x2="68" y1="55" y2="55" stroke="#5A606B" />
      <text x="50" y="69" textAnchor="middle" className="mx-ring-g">{goal ? n0(goal) : DASH}</text>
    </svg></div>);
}

/* ---------------- CEO ---------------- */
function Ceo({ d, v, lrOn }: { d: any; v: string; lrOn: boolean }) {
  const Y = d.years[2], m = d.month - 1, S = d.series[v], P = d.pnl;
  const ys = (o: any, s: "b" | "s") => sum(o[Y][s].slice(0, m + 1));
  const closedGci = ys(d.gci[v], "b") + ys(d.gci[v], "s");
  const pend = d.pend[v]; const pendGci = pend.b.gci + pend.s.gci;
  const plY = (k: string) => (P[k].some(ok) ? sum(P[k]) : null);
  const plM = P.months.length ? `${MN[0]}–${MN[Number(P.months[P.months.length - 1].slice(5, 7)) - 1]} ${Y}` : "";
  const coY = sum((d.codollar?.[v] || d.codollar?.all || []).slice(0, m + 1));
  const closedU = ys(S.closed, "b") + ys(S.closed, "s");
  const owner = !!d.agent && /^(deborah.*bly|kevin jones)$/i.test(String(d.agent).replace(/\s+/g, " ").trim());
  const agentGciY = owner ? 0 : closedGci - coY;
  const cards: [string, string, string][] = [
    ["Total GCI (Sisu gross)", usd(closedGci), "Sisu, YTD by close date"], ["Pending GCI (gross)", usd(pendGci), "Sisu, open pending deals"],
    ["Company dollar", usd(coY), "eXp: 100% Deb + Kevin Team Revenue"], ["Agent GCI", usd(agentGciY), owner ? "Deb/Kevin: $0 (commission is company dollar)" : "Total GCI − Company dollar"],
    ["Company dollar / unit", closedU ? usd(coY / closedU) : DASH, "Company dollar ÷ Sisu closed units"],
    ["Team share (all eXp)", usd(sum(d.xrev[v].slice(0, m + 1))), "eXp report, YTD by close date"], ["Deposited income", usd(plY("income")), `P&L (Tax In-House), ${plM}`],
    ["Net income", usd(plY("net")), `P&L, ${plM}`], ["Projected net income", DASH, "No projection model yet"],
    ["Referrals", usd(d.xref[1]), `${n0(d.xref[0])} eXp referral files YTD (P&L referral income ${usd(plY("referral"))})`],
    ["Deductions & agent income", usd(plY("cogs")), `P&L cost of goods sold, ${plM}`], ["Expenses", usd(plY("expenses")), `P&L operating expenses, ${plM}`]];
  const side = (s: "b" | "s") => { const u = ys(S.closed, s), vo = ys(d.vol[v], s), g = ys(d.gci[v], s); return { u, vo, g, asp: u ? vo / u : null, ac: u ? g / u : null }; };
  const L = side("s"), B = side("b");
  const AG = !!d.agent; const TO = "Team-level only";
  const cardsShown: [string, string, string][] = AG ? cards.map(([t, val, sub]) => (/^(Total GCI|Pending GCI|Company dollar|Agent GCI)/.test(t) ? [t, val, sub] : [t, TO, "eXp full team share / P&L have no per-agent split"]) as [string, string, string]) : cards;
  const info = (s: "b" | "s", x: any) => [["Units", n0(x.u + pend[s].units), n0(pend[s].units), n0(x.u)], ["Volume", usd(x.vo + pend[s].vol), usd(pend[s].vol), usd(x.vo)], ["GCI", usd(x.g + pend[s].gci), usd(pend[s].gci), usd(x.g)]];
  const CB = d.cash[v]; const buckets: [string, string][] = [["overdue", "Past forecast date"], ["15", "0–15 days"], ["30", "16–30 days"], ["60", "31–60 days"], ["90", "61–90 days"], ["120", "91–120 days"], ["later", "120+ days"]];
  let run = 0; const cum: Record<string, number> = {}; ["15", "30", "60", "90", "120"].forEach((k) => { run += CB[k][1]; cum[k] = run; });
  return (<div className="mx-stack">
    {d.goals ? <GoalBanner d={d} v={v} ceo /> : null}
    <h3 className="serif mx-h">GCI and income</h3><p className="mx-hint">Total GCI = Sisu gross. Company dollar = eXp Team Revenue to Deb + Kevin. Agent GCI = Total GCI − Company dollar (Deb/Kevin = $0). Different systems; not a paycheck figure. No broker-review fee in Sisu/eXp feeds.</p>
    <div className="mx-kpis three">{cardsShown.map(([t, val, sub]) => <div className="mx-kpi" key={t}><div className="mx-kpi-t">{t}</div><div className="mx-kpi-v sm serif">{val}</div><div className="mx-kpi-sub">{sub}</div></div>)}</div>
    <div className="mx-kpis">{[["Listing avg sales price", usd(L.asp)], ["Listing avg commission", usd(L.ac)], ["Buyer avg sales price", usd(B.asp)], ["Buyer avg commission", usd(B.ac)]].map(([t, val]) =>
      <div className="mx-kpi" key={t}><div className="mx-kpi-t">{t}</div><div className="mx-kpi-v sm serif">{val}</div><div className="mx-kpi-sub">Sisu closed YTD, gross GCI</div></div>)}</div>
    <div className="mx-two">
      {([["Seller info", "s", L], ["Buyer info", "b", B]] as any[]).map(([t, s, x]) => (<div key={t} className="mx-card"><h3 className="serif mx-h">{t}</h3>
        <SortTable cols={["", "Total", "Pending", "Closed YTD"]} rows={info(s, x)} plain /></div>))}
    </div>
    <div className="mx-card"><h3 className="serif mx-h">Cash flow</h3><p className="mx-hint">Gross pending GCI by Sisu forecasted close date (from {d.generated}). Cumulative: 15 days {usd(cum["15"])} · 30 {usd(cum["30"])} · 60 {usd(cum["60"])} · 90 {usd(cum["90"])} · 120 {usd(cum["120"])}</p>
      <div className="mx-cash">{buckets.map(([k, l]) => { const mx = Math.max(1, ...buckets.map(([q]) => CB[q][1])); return (<div className="mx-cashrow" key={k}><span className="l">{l}</span>
        <span className="bar"><i style={{ width: `${(CB[k][1] / mx) * 100}%`, background: k === "overdue" ? C.gold : C.blue }} /></span><span className="v">{usd(CB[k][1])}<em>{n0(CB[k][0])} deals</em></span></div>); })}</div></div>
    <div className="mx-card"><h3 className="serif mx-h">Monthly breakdown {Y}</h3>
      <SortTable cols={["Month", "Closed Units", "Volume", "GCI (gross)", "Listings", "Buyers", "Pending Units", "Pending Volume", "Pending GCI", "Expenses", "Net Profit", "Projected Net Profit"].slice(0, AG ? 9 : 12)}
        rows={MN.map((n, i) => { const fut = i > m; const cu = S.closed[Y].b[i] + S.closed[Y].s[i]; const ex = ok(P.expenses[i]) && ok(P.cogs[i]) ? P.expenses[i] + P.cogs[i] : null;
          return [n, fut ? DASH : n0(cu), fut ? DASH : usd(d.vol[v][Y].b[i] + d.vol[v][Y].s[i]), fut ? DASH : usd(d.gci[v][Y].b[i] + d.gci[v][Y].s[i]), fut ? DASH : n0(S.closed[Y].s[i]), fut ? DASH : n0(S.closed[Y].b[i]),
            d.pmon[v].units[i] ? n0(d.pmon[v].units[i]) : DASH, d.pmon[v].units[i] ? usd(d.pmon[v].vol[i]) : DASH, d.pmon[v].units[i] ? usd(d.pmon[v].gci[i]) : DASH, usd(ex), usd(P.net[i]), DASH].slice(0, AG ? 9 : 12); })} />
      {AG ? <p className="mx-hint">Expenses and net profit are team-level only (P&L has no per-agent split). Pending by forecasted close month. Tap a header to sort.</p> : <p className="mx-hint">Expenses = P&L operating expenses + cost of goods sold (agent payouts); net profit = P&L net income. P&L is by deposit date and covers {plM || "no months yet"}; it does not follow the leases & referrals switch{lrOn ? "" : " (switch is off)"}. Pending by forecasted close month. Tap a header to sort.</p>}</div>
  </div>);
}

function SortTable({ cols, rows, plain }: { cols: string[]; rows: string[][]; plain?: boolean }) {
  const [sk, setSk] = useState<number>(-1); const [dir, setDir] = useState(1);
  const num = (s: string) => { const x = parseFloat(String(s).replace(/[$,]/g, "")); return Number.isNaN(x) ? -Infinity : x; };
  const rs = sk < 0 ? rows : [...rows].sort((a, b) => (sk === 0 && !plain ? 0 : (num(a[sk]) - num(b[sk])) * dir));
  return (<div className="mx-tw"><table className="mx-t"><thead><tr>{cols.map((c, i) => <th key={c + i}>{plain || i === 0 ? c : <button onClick={() => { if (sk === i) setDir(-dir); else { setSk(i); setDir(-1); } }}>{c}{sk === i ? (dir < 0 ? " ▼" : " ▲") : ""}</button>}</th>)}</tr></thead>
    <tbody>{rs.map((r, j) => <tr key={j}>{r.map((c, i) => <td key={i}>{c}</td>)}</tr>)}</tbody></table></div>);
}

/* ---------------- 2027 goal banner (Pacing + CEO) ---------------- */
function GoalBanner({ d, v, ceo }: { d: any; v: string; ceo?: boolean }) {
  const G = d.goals, R = G.runrate[v], Y = d.years[2];
  const row = (k: string, lbl: string) => { const x = R[k]; const st = x.ann >= x.goal ? 2 : x.ann >= x.goal * 0.95 ? 1 : 0;
    return (<div className="mx-goal" key={k}><div className="mx-kpi-t">{lbl}: {G.year} goal {usdK(x.goal)}</div>
      <div className="mx-goal-v serif">{usdK(x.ann)} <em>{Y} annualized · {pct(x.ann, x.goal)}</em></div>
      <div className="mx-prog"><div className="mx-prog-track" /><div className="mx-prog-fill" style={{ width: `${Math.min(1, x.ann / x.goal) * 100}%`, background: STC[st] }} /></div>
      <div className="mx-prog-l"><span>Trailing 12 mo {usdK(x.t12)} · {pct(x.t12, x.goal)}</span><span>Gap {usdK(Math.max(0, x.goal - x.ann))}</span></div>
      {ceo ? <div className="mx-kpi-sub">{Y} YTD actual {usd(x.ytd)} · monthly goal {usd(G.monthly[k])}</div> : null}</div>); };
  return (<div className="mx-card"><h3 className="serif mx-h">{G.mode === "runrate" ? `Run-rate vs ${G.year} goal` : `${G.year} goal pacing`}</h3>
    <div className="mx-two">{row("volume", "Closed volume")}{row("gci", "GCI (gross)")}</div>
    <p className="mx-hint">{G.year} one-year plan (EOS kickoff, Sep 30 2026): $125M volume × 2.75% = $3.44M GCI; company dollar {usdK(G.annual.company_dollar)}; profit {usdK(G.annual.profit)}; mortgage JV 4 closings/month. Sisu GCI is gross. Not in plan: {G.year} unit, appointment and per-agent goals.</p></div>);
}
