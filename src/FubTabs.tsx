import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Overview, num, mins } from "./FubAudit";
import { useAgent, TeamOnly, AgentBanner, pickAgent, usePersist } from "./agent";

const AI = "Jesse Jones";
const pc = (v: any) => (typeof v === "number" && isFinite(v) ? `${v.toFixed(1)}%` : "—");
const usd = (v: any) => (typeof v === "number" && isFinite(v) ? (v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : `$${Math.round(v).toLocaleString("en-US")}`) : "—");
const asof = (v?: string) => (v ? `${v.slice(0, 10)} ${v.slice(11, 16)} CT` : "—");
const Head = ({ v, t }: { v?: any; t: string }) => <div className="ft-head"><h2 className="serif">{t}</h2><span className="asof">As of {asof(v?.as_of)}</span></div>;
const Def = ({ t }: { t?: string }) => (t ? <details className="ft-def"><summary>Definition</summary><p>{t}</p></details> : null);
const Missing = ({ t }: { t: string }) => <div className="gatecard"><h1 className="serif">{t}</h1><p className="rule" /><p>— Not in this snapshot yet.</p></div>;
const AIRow = () => <span className="fa-tag">Fello AI dialer</span>;

type C = { k: string; l: string; f?: (v: any) => string; n?: boolean };
function STable({ cols, rows, initial, filter = true, rowClass }: { cols: C[]; rows: any[]; initial?: string; filter?: boolean; rowClass?: (r: any) => string }) {
  const [q, setQ] = useState(""); const [sort, setSort] = useState<{ k: string; d: number }>({ k: initial ?? cols[0].k, d: initial ? -1 : 1 });
  const shown = rows.filter((r) => !q || String(r[cols[0].k]).toLowerCase().includes(q.toLowerCase())).sort((a, b) => {
    const x = a[sort.k], y = b[sort.k]; const nx = x == null, ny = y == null; if (nx !== ny) return nx ? 1 : -1; return (x > y ? 1 : x < y ? -1 : 0) * sort.d; });
  return <>{filter ? <div className="fa-filters"><input type="search" placeholder={`Filter ${cols[0].l.toLowerCase()}`} value={q} onChange={(e) => setQ(e.target.value)} aria-label="Filter" /><span className="caption">{shown.length} of {rows.length}</span></div> : null}
    <div className="tablewrap"><table className="fa-agents"><thead><tr>{cols.map((c) => <th key={c.k} className={(c.n ? "r " : "") + "sortable"} onClick={() => setSort({ k: c.k, d: sort.k === c.k ? -sort.d : c.n ? -1 : 1 })}>{c.l}{sort.k === c.k ? (sort.d === 1 ? " ▲" : " ▼") : ""}</th>)}</tr></thead>
      <tbody>{shown.map((r, i) => <tr key={i} className={rowClass?.(r) ?? ""}>{cols.map((c) => <td key={c.k} className={c.n ? "r" : ""}>{c.k === cols[0].k && r._ai ? <>{r[c.k]}<AIRow /></> : c.f ? c.f(r[c.k]) : num(r[c.k])}</td>)}</tr>)}</tbody></table></div></>;
}
const Card = ({ l, v, h }: { l: string; v: ReactNode; h?: string }) => <div className="fa-card"><div className="fa-v serif">{v}</div><div className="fa-l">{l}</div>{h ? <div className="fa-h">{h}</div> : null}</div>;

function LineChart({ pts, label, fmt = (v: number) => String(v), color = "var(--blue)" }: { pts: { x: string; y: number | null }[]; label: string; fmt?: (v: number) => string; color?: string }) {
  const W = 640, H = 180, P = 32; const ys = pts.map((p) => p.y).filter((v): v is number => typeof v === "number"); const mx = Math.max(1, ...ys);
  const X = (i: number) => P + (i * (W - 2 * P)) / Math.max(1, pts.length - 1), Y = (v: number) => H - P - (v * (H - 2 * P)) / mx;
  const seg = pts.map((p, i) => (p.y == null ? null : `${X(i)},${Y(p.y)}`)).filter(Boolean).join(" ");
  return <svg className="ft-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
    <line x1={P} x2={W - P} y1={H - P} y2={H - P} stroke="var(--line)" />
    <polyline points={seg} fill="none" stroke={color} strokeWidth="2.5" />
    {pts.map((p, i) => p.y == null ? null : <g key={i}><circle cx={X(i)} cy={Y(p.y)} r="3.5" fill={color} /><text x={X(i)} y={Y(p.y) - 8} textAnchor="middle" fontSize="11" fill="#3a3a3a">{fmt(p.y)}</text></g>)}
    {pts.map((p, i) => (i % Math.ceil(pts.length / 8) === 0 || i === pts.length - 1) ? <text key={"x" + i} x={X(i)} y={H - 10} textAnchor="middle" fontSize="11" fill="#6B6B6B">{p.x.slice(5)}</text> : null)}
  </svg>;
}
function Bars({ pts, label }: { pts: { x: string; a: number | null; b?: number | null }[]; label: string }) {
  const W = 640, H = 180, P = 28; const mx = Math.max(1, ...pts.map((p) => Math.max(p.a ?? 0, p.b ?? 0))); const bw = (W - 2 * P) / Math.max(1, pts.length);
  return <svg className="ft-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
    {pts.map((p, i) => { const h1 = ((p.a ?? 0) * (H - 2 * P)) / mx, h2 = ((p.b ?? 0) * (H - 2 * P)) / mx; const x = P + i * bw;
      return <g key={i}><rect x={x + bw * 0.12} y={H - P - h1} width={bw * 0.36} height={h1} fill="var(--blue)" />{p.b != null ? <rect x={x + bw * 0.5} y={H - P - h2} width={bw * 0.36} height={h2} fill="var(--gold)" /> : null}
        {(i % Math.ceil(pts.length / 8) === 0 || i === pts.length - 1) ? <text x={x + bw / 2} y={H - 8} textAnchor="middle" fontSize="11" fill="#6B6B6B">{p.x.slice(5)}</text> : null}</g>; })}
    <line x1={P} x2={W - P} y1={H - P} y2={H - P} stroke="var(--line)" /></svg>;
}

const BK = ["0-7", "8-30", "31-90", "90+", "never"];
function Heat({ rows, stages }: { rows: Record<string, any>; stages: string[] }) {
  const mx = Math.max(1, ...stages.flatMap((s) => BK.map((b) => rows?.[s]?.[b] ?? 0)));
  return <div className="tablewrap"><table className="ft-heat"><thead><tr><th>Stage</th>{BK.map((b) => <th key={b} className="r">{b === "never" ? "Never" : `${b} d`}</th>)}<th className="r">Total</th></tr></thead>
    <tbody>{stages.filter((s) => rows?.[s]).map((s) => <tr key={s}><td>{s}</td>{BK.map((b) => { const v = rows[s]?.[b]; const a = typeof v === "number" ? Math.sqrt(v / mx) : 0;
      return <td key={b} className="r" style={{ background: `rgba(0,81,155,${(a * 0.85).toFixed(3)})`, color: a > 0.5 ? "#fff" : "inherit" }}>{num(v)}</td>; })}<td className="r"><b>{num(rows[s]?.total)}</b></td></tr>)}</tbody></table></div>;
}

function Speed({ v, agent }: { v?: any; agent?: string | null }) {
  if (!v) return <Missing t="Speed to Lead" />;
  const j = v.last_30_days?.jesse_ai_book ?? {}; const cu = v.current_uncontacted_new_leads ?? {};
  const t = agent ? (pickAgent(v.last_30_days?.by_agent, agent) ?? {}) : (v.last_30_days?.team_excl_jesse ?? {});
  const cuA = agent ? (pickAgent(cu.by_agent, agent) ?? {}) : (cu.team ?? {});
  const rows = Object.entries(v.last_30_days?.by_agent ?? {}).map(([name, s]: any) => ({ name, ...s, u7: cu.by_agent?.[name]?.uncontacted_7d ?? null, u30: cu.by_agent?.[name]?.uncontacted_30d ?? null, _ai: name === AI }))
    .filter((r) => !agent || pickAgent({ [r.name]: 1 }, agent));
  const wk = (v.weekly ?? []).map((w: any) => ({ x: w.week_start + (w.partial_week ? "*" : ""), y: w.team?.median_min ?? null, a: w.team?.leads ?? null, b: w.team?.called_by_human ?? null }));
  return <div className="page-body"><Head v={v} t="Speed to lead" /><AgentBanner note="Last 30 days, this agent's leads" />
    <div className="fa-cards ft-4"><Card l="Median, last 30 days" v={mins(t.median_min)} h={agent ? "Agent's leads; first human call" : "Human-owned leads; first human call"} /><Card l="Called within 5 min" v={pc(t.pct_within_5min)} h={`${num(t.leads)} leads`} />
      <Card l="Called within 60 min" v={pc(t.pct_within_60min)} /><Card l="Uncontacted, 7d / 30d" v={`${num(cuA.uncontacted_7d)} / ${num(cuA.uncontacted_30d)}`} h="New non-bulk leads, excl. AI dialer" /></div>
    {agent ? <TeamOnly what="The weekly speed-to-lead trend and the Fello AI dialer book" /> : <><div className="fa-note">Fello AI dialer (Jesse Jones) book, shown separately: {num(j.leads)} leads, median {mins(j.median_min)} to a human call, {num(j.uncontacted)} uncontacted.</div>
    <section className="section"><h2 className="serif">Weekly median (team, human)</h2><LineChart pts={wk} label="Weekly median minutes to first human call" fmt={(x) => (x < 60 ? `${Math.round(x)}m` : `${(x / 60).toFixed(1)}h`)} />
      <h3 className="serif">Leads vs called by a human</h3><Bars pts={wk} label="Weekly leads and human-called" /><div className="rc-legend"><span><i className="a" /> Leads</span><span><i className="h" /> Called by human</span></div>
      <p className="caption">* partial week. Weeks start Monday CT.</p></section></>}
    <section className="section"><h2 className="serif">{agent ? "Agent row, last 30 days" : "Agent leaderboard, last 30 days"}</h2>
      <STable initial="leads" rows={rows} rowClass={(r) => (r._ai ? "ai" : "")} cols={[{ k: "name", l: "Agent" }, { k: "leads", l: "Leads", n: true }, { k: "called_by_human", l: "Called", n: true }, { k: "median_min", l: "Median", f: mins, n: true },
        { k: "pct_within_5min", l: "≤5 min", f: pc, n: true }, { k: "pct_within_60min", l: "≤60 min", f: pc, n: true }, { k: "uncontacted", l: "Uncontacted (cohort)", n: true }, { k: "u7", l: "Uncontacted 7d", n: true }, { k: "u30", l: "Uncontacted 30d", n: true }]} />
      <Def t={v.definition} /></section></div>;
}

const STEPS: [string, string][] = [["leads", "Leads"], ["contacted_by_human", "Contacted"], ["conversations", "Conversation"], ["appointments_set", "Appt set"], ["appointments_met", "Appt met"], ["deals_created", "Deal"], ["deals_closed", "Closed"]];
function Funnel({ v, agent }: { v?: any; agent?: string | null }) {
  const [p, setP] = usePersist<"last_90_days" | "ytd">("fp", "last_90_days");
  if (agent) return <div className="page-body"><Head v={v} t="Source funnel" /><TeamOnly what="The source funnel" /></div>;
  if (!v) return <Missing t="Source Funnel" />;
  const b = v[p] ?? {}; const t = b.total ?? {}; const mx = Math.max(1, t.leads ?? 0);
  const rows = Object.entries(b.by_source ?? {}).map(([source, s]: any) => ({ source, ...s, close: s.rates_pct?.["closed/leads"] ?? null, contactR: s.rates_pct?.["contacted/leads"] ?? null }));
  return <div className="page-body"><Head v={v} t="Source funnel" />
    <div className="seg ft-seg">{[["last_90_days", "Last 90 days"], ["ytd", "Year to date"]].map(([k, l]) => <button key={k} className={p === k ? "on active" : ""} onClick={() => setP(k as any)}>{l}</button>)}</div>
    <section className="section"><h2 className="serif">All sources{b.since ? `, since ${b.since}` : ""}</h2>
      <div className="rc-funnel">{STEPS.map(([k, l]) => <div className="rc-step" key={k}><span className="rc-sl">{l}</span><span className="rc-track"><i style={{ width: `${(100 * (t[k] ?? 0)) / mx}%` }} /></span><b className="serif">{num(t[k])}</b></div>)}</div>
      <p className="caption">Closed volume {usd(t.closed_volume)}. Rates: {Object.entries(t.rates_pct ?? {}).map(([k, r]) => `${k} ${pc(r)}`).join(" · ") || "—"}</p></section>
    <section className="section"><h2 className="serif">By source</h2>
      <STable initial="leads" rows={rows} cols={[{ k: "source", l: "Source" }, ...STEPS.map(([k, l]) => ({ k, l, n: true })), { k: "closed_volume", l: "Volume", f: usd, n: true }, { k: "contactR", l: "Contacted %", f: pc, n: true }, { k: "close", l: "Closed / leads", f: pc, n: true }]} />
      <Def t={v.definition} /><p className="caption">Steps are not strict subsets (a deal can exist without a logged appointment). Bulk imports excluded.</p></section></div>;
}

function Stale({ v, agent }: { v?: any; agent?: string | null }) {
  const [who0, setWho] = usePersist("sw", "__team");
  if (!v) return <Missing t="Stale Pipeline" />;
  const stages: string[] = v.stages ?? Object.keys(v.team_excl_jesse ?? {});
  const agents = Object.keys(v.by_agent ?? {}).filter((a) => a !== AI && (!agent || pickAgent({ [a]: 1 }, agent))).sort();
  const who = agent ? (agents[0] ?? "__none") : who0;
  const rows = who === "__team" ? v.team_excl_jesse : who === "__ai" ? v.jesse_ai_book : v.by_agent?.[who];
  const per = agents.map((a) => { const r = v.by_agent[a] ?? {}; const tot = (b: string) => stages.reduce((s, st) => s + (r[st]?.[b] ?? 0), 0); const total = stages.reduce((s, st) => s + (r[st]?.total ?? 0), 0);
    return { name: a, total, never: tot("never"), d90: tot("90+"), fresh: tot("0-7"), pctStale: total ? (100 * (tot("never") + tot("90+"))) / total : null }; });
  return <div className="page-body"><Head v={v} t="Stale pipeline" /><AgentBanner note="This agent's active book" />
    <section className="section"><h2 className="serif">Active stage × days since last human call</h2>
      {agent ? null : <div className="fa-filters"><select value={who} onChange={(e) => setWho(e.target.value)} aria-label="Whose book"><option value="__team">Team (excl. AI dialer)</option><option value="__ai">Fello AI dialer book (Jesse Jones)</option>{agents.map((a) => <option key={a} value={a}>{a}</option>)}</select></div>}
      {rows ? <Heat rows={rows} stages={stages} /> : <p className="caption">—</p>}
      <Def t={v.definition} /><p className="caption">"Never" = no human call since Jul 1, 2025. Texts and emails are not counted.</p></section>
    <section className="section"><h2 className="serif">By agent</h2>
      <STable initial="total" rows={per} cols={[{ k: "name", l: "Agent" }, { k: "total", l: "Active people", n: true }, { k: "fresh", l: "Called ≤7d", n: true }, { k: "d90", l: "90+ d", n: true }, { k: "never", l: "Never", n: true }, { k: "pctStale", l: "% 90+ or never", f: pc, n: true }]} /></section></div>;
}

function Hygiene({ v, hist, agent }: { v?: any; hist?: any[]; agent?: string | null }) {
  if (!v) return <Missing t="Hygiene" />;
  const t = agent ? (pickAgent(v.by_agent, agent) ?? {}) : (v.team_excl_jesse ?? {});
  const rows = Object.entries(v.by_agent ?? {}).map(([name, s]: any) => ({ name, ...s, _ai: name === AI })).filter((r) => !agent || pickAgent({ [r.name]: 1 }, agent));
  const K: [string, string][] = [["open_tasks", "Open tasks"], ["overdue_tasks", "Overdue tasks"], ["appts_30d_no_outcome", "Appts 30d, no outcome"], ["open_deals_past_projected_close", "Deals past projected close"], ["contacts_no_phone_no_email", "No phone or email"]];
  const h = hist ?? [];
  return <div className="page-body"><Head v={v} t="Hygiene" /><AgentBanner note="Tasks, appointments and deals assigned to this agent" />
    <div className="fa-cards ft-5">{K.map(([k, l]) => <Card key={k} l={l} v={num(t[k])} h={agent ? "This agent" : "Team, excl. AI dialer"} />)}</div>
    {agent ? <TeamOnly what="The hygiene trend" /> : <section className="section"><h2 className="serif">Trend</h2>
      {h.length > 1 ? <LineChart pts={h.map((r: any) => ({ x: r.date, y: r.overdue_tasks ?? null }))} label="Overdue tasks by day" /> : <p className="caption">Trend starts building with daily runs: {h.length} day{h.length === 1 ? "" : "s"} recorded so far ({h.map((r: any) => r.date).join(", ") || "—"}). History of task and appointment states can't be pulled from the API.</p>}</section>}
    <section className="section"><h2 className="serif">By agent</h2>
      <STable initial="overdue_tasks" rows={rows} rowClass={(r) => (r._ai ? "ai" : "")} cols={[{ k: "name", l: "Agent" }, ...K.map(([k, l]) => ({ k, l, n: true }))]} />
      <p className="caption">The AI dialer's tasks are AI tasks and are not in the team totals.</p><Def t={v.definition} /></section></div>;
}

function Handoff({ v, agent }: { v?: any; agent?: string | null }) {
  if (agent) return <div className="page-body"><Head v={v} t="AI handoff (Fello → human)" /><TeamOnly what="AI handoff" /></div>;
  if (!v) return <Missing t="AI Handoff" />;
  const y = v.ytd_total ?? {}; const wk = (v.weekly ?? []).map((w: any) => ({ ...w, x: w.week_start }));
  return <div className="page-body"><Head v={v} t="AI handoff (Fello → human)" />
    <div className="fa-cards ft-5"><Card l="Handoffs YTD" v={num(y.handoffs)} h={`${num(y.unique_people)} people`} /><Card l="Called by a human" v={num(y.human_called)} /><Card l="Median to human call" v={mins(y.median_min_to_human_call)} />
      <Card l="Human call within 1 h" v={pc(y.pct_human_call_within_1h)} h="Of all handoffs" /><Card l="Led to appt / deal" v={`${num(y.led_to_appointment)} / ${num(y.led_to_deal)}`} /></div>
    <section className="section"><h2 className="serif">Weekly handoffs vs human-called</h2><Bars pts={wk.map((w: any) => ({ x: w.x, a: w.handoffs, b: w.human_called }))} label="Weekly handoffs and human-called" />
      <div className="rc-legend"><span><i className="a" /> Handoffs</span><span><i className="h" /> Called by human</span></div>
      <STable filter={false} initial="week_start" rows={wk} cols={[{ k: "week_start", l: "Week", f: (x) => x ?? "—" }, { k: "handoffs", l: "Handoffs", n: true }, { k: "human_called", l: "Human called", n: true }, { k: "median_min_to_human_call", l: "Median to call", f: mins, n: true },
        { k: "pct_human_call_within_1h", l: "≤1 h", f: pc, n: true }, { k: "led_to_appointment", l: "Appt", n: true }, { k: "led_to_deal", l: "Deal", n: true }]} />
      <p className="caption">Cross-check: {num(v.people_with_tag_now)} people currently carry the FELIX AI HANDOFF tag.</p><Def t={v.definition} /></section></div>;
}

function Kevin({ v, agent }: { v?: any; agent?: string | null }) {
  if (agent && agent !== "Kevin Jones") return <div className="page-body"><Head v={v} t="Kevin's database" /><TeamOnly what="This tab covers Kevin Jones's own database only, so it" /></div>;
  if (!v) return <Missing t="Kevin's Database" />;
  const st = Object.entries(v.by_stage ?? {}).sort((a: any, b: any) => b[1] - a[1]);
  const S = ({ o, t }: { o?: any; t: string }) => { const mx = Math.max(1, ...BK.map((b) => o?.[b] ?? 0)); return <div><h3 className="serif">{t}</h3><div className="fa-bars">{BK.map((b) => <div className="fa-bar" key={b}><span>{b === "never" ? "Never" : `${b} days`}</span><i style={{ width: `${(100 * (o?.[b] ?? 0)) / mx}%` }} /><b>{num(o?.[b])}</b></div>)}</div></div>; };
  return <div className="page-body"><Head v={v} t="Kevin's database" />
    <div className="fa-cards ft-4"><Card l="Contacts" v={num(v.total_contacts)} /><Card l="Touched this month" v={num(v.touched_this_month)} /><Card l="Call-today list" v={num(v.call_today_list_size)} h="List itself is private, not shown" /><Card l="Active-stage, never contacted" v={num(v.staleness_active_stages?.never)} /></div>
    <section className="section"><h2 className="serif">Last contact</h2><div className="fa-grid2"><S o={v.staleness_all} t="All contacts" /><S o={v.staleness_active_stages} t="Active stages" /></div><Def t={v.definition} /></section>
    <section className="section"><h2 className="serif">By stage</h2><table><tbody>{st.map(([k, n]: any) => <tr key={k}><td>{k}</td><td className="r">{num(n)}</td></tr>)}</tbody></table></section></div>;
}

export const FUB_TABS: { id: string; label: string; render: (d: any, a: string | null) => ReactNode }[] = [
  { id: "overview", label: "Overview", render: (d, a) => <Overview data={d} agent={a} /> },
  { id: "speed", label: "Speed to Lead", render: (d, a) => <Speed v={d?.views?.speed_to_lead} agent={a} /> },
  { id: "funnel", label: "Source Funnel", render: (d, a) => <Funnel v={d?.views?.source_funnel} agent={a} /> },
  { id: "stale", label: "Stale Pipeline", render: (d, a) => <Stale v={d?.views?.stale_pipeline} agent={a} /> },
  { id: "hygiene", label: "Hygiene", render: (d, a) => <Hygiene v={d?.views?.hygiene} hist={d?.views?.hygiene_history} agent={a} /> },
  { id: "handoff", label: "AI Handoff", render: (d, a) => <Handoff v={d?.views?.ai_handoff} agent={a} /> },
  { id: "kevin", label: "Kevin's Database", render: (d, a) => <Kevin v={d?.views?.kevin_personal_summary} agent={a} /> },
];
const sub = () => { const t = window.location.hash.replace(/^#\/?/, "").split("?")[0].split("/")[1]; return FUB_TABS.some((x) => x.id === t) ? t : "overview"; };

export default function FubSection({ data }: { data?: any }) {
  const { agent, href } = useAgent();
  const [tab, setTab] = useState(sub());
  useEffect(() => { const f = () => setTab(sub()); window.addEventListener("hashchange", f); return () => window.removeEventListener("hashchange", f); }, []);
  const cur = useMemo(() => FUB_TABS.find((t) => t.id === tab)!, [tab]);
  return <div className="fubaudit fubtabs">
    <nav className="ft-tabs" aria-label="FUB views">{FUB_TABS.map((t) => <a key={t.id} href={href(`#/fub-audit/${t.id}`)} className={t.id === tab ? "on" : ""} aria-current={t.id === tab ? "page" : undefined}>{t.label}</a>)}</nav>
    {cur.render(data, agent)}
  </div>;
}
