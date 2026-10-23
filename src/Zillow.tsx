// Zillow tab: Zillow Preferred sheet totals (from-zillow-data/zillow.json via zillow_build.py) + FUB's Zillow Preferred leads, shown separately.
import { useAgent, sameAgent, AgentBanner, TeamOnly, usePersist } from "./agent";
import "./fubaudit.css";

const ok = (v: any) => typeof v === "number" && isFinite(v);
const num = (v: any) => (ok(v) ? v.toLocaleString("en-US") : "—");
const pc = (v: any) => (ok(v) ? `${Math.round(v * 1000) / 10}%` : "—");
const usd = (v: any) => (ok(v) ? "$" + Math.round(v).toLocaleString("en-US") : "—");
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const Card = ({ l, v, h }: { l: string; v: string; h?: string }) => <div className="fa-card"><div className="fa-v serif">{v}</div><div className="fa-l">{l}</div>{h ? <div className="fa-h">{h}</div> : null}</div>;

function Funnel({ steps }: { steps: [string, any, string?][] }) {
  const mx = Math.max(1, ...steps.map((s) => (ok(s[1]) ? s[1] : 0)));
  return <div className="fl-funnel">{steps.map(([l, v, h], i) => <div className="fl-step" key={l}>
    <div className="fl-l"><b>{l}</b>{h ? <span>{h}</span> : null}</div>
    <div className="fl-track"><i style={{ width: ok(v) ? `${Math.max(1.5, (100 * v) / mx)}%` : "0%" }} /></div>
    <div className="fl-v serif">{num(v)}{i > 0 && ok(v) && ok(steps[i - 1][1]) && steps[i - 1][1] ? <em>{Math.round((100 * v) / steps[i - 1][1])}% of prior</em> : null}</div></div>)}</div>;
}

function MonthlyChart({ mt, k, title }: { mt: any; k: string; title: string }) {
  const s25 = MONTHS.map((m) => mt?.["2025"]?.[k]?.[m] ?? null), s26 = MONTHS.map((m) => mt?.["2026"]?.[k]?.[m] ?? null);
  const W = 640, H = 200, P = 30, bw = (W - 2 * P) / 12, mx = Math.max(1, ...[...s25, ...s26].filter(ok) as number[]);
  const Y = (v: number) => H - P - (v * (H - 2 * P)) / mx;
  const tot = (a: any[]) => (a.some(ok) ? a.reduce((x, y) => x + (ok(y) ? y : 0), 0) : null);
  return <figure className="zl-chart"><figcaption className="serif">{title}</figcaption>
    <svg className="ft-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}, 2025 vs 2026 by month`}>
      <line x1={P} x2={W - P} y1={H - P} y2={H - P} stroke="#D6D0C2" />
      {MONTHS.map((m, i) => { const x = P + i * bw; return <g key={m}>
        {ok(s25[i]) ? <rect x={x + bw * 0.12} y={Y(s25[i])} width={bw * 0.36} height={H - P - Y(s25[i])} fill="#B9B4A8" /> : null}
        {ok(s26[i]) ? <rect x={x + bw * 0.52} y={Y(s26[i])} width={bw * 0.36} height={H - P - Y(s26[i])} fill="#00519B" /> : null}
        {ok(s26[i]) ? <text x={x + bw * 0.7} y={Y(s26[i]) - 4} textAnchor="middle" fontSize="10" fill="#12151C">{s26[i]}</text> : null}
        <text x={x + bw / 2} y={H - 10} textAnchor="middle" fontSize="11" fill="#6B6B6B">{m.slice(0, 3)}</text></g>; })}
    </svg>
    <div className="fl-legend"><span><i style={{ background: "#B9B4A8" }} />2025 · {num(tot(s25))}</span><span><i style={{ background: "#00519B" }} />2026 · {num(tot(s26))} so far</span></div></figure>;
}

const F40: [string, string, ((v: any) => string)?][] = [["leads_received_buyer_connections", "Connections"], ["pickups", "Pickups"], ["pickup_rate", "Pickup rate", pc], ["appointments", "Appts"], ["meetings", "Met with"], ["showings", "Showings"], ["offers", "Offers"], ["pending_plus_closed", "Pending + closed"], ["raw_cvr", "Raw CVR", pc], ["csat", "CSAT"], ["predicted_cvr", "Predicted CVR", pc]];

function AgentTable({ rows, win }: { rows: any[]; win: "l40d" | "l6m" }) {
  const [sk, setSk] = usePersist<string>("zs", "leads_received_buyer_connections");
  const rs = [...rows].filter((a) => a[win]).sort((a, b) => (b[win]?.[sk] ?? -1) - (a[win]?.[sk] ?? -1));
  return <div className="tablewrap"><table className="fa-agents"><thead><tr><th>Agent</th>{F40.map(([k, l]) => <th key={k} className="r sortable" onClick={() => setSk(k)}>{l}{sk === k ? " ▼" : ""}</th>)}</tr></thead>
    <tbody>{rs.map((a) => <tr key={a.agent}><td>{a.agent}</td>{F40.map(([k, , f]) => <td key={k} className="r">{(f ?? num)(a[win]?.[k])}</td>)}</tr>)}</tbody></table></div>;
}

function Flags({ a }: { a: any }) {
  return <div className="zl-coach"><h3 className="serif">{a.agent} <span>{num(a.l6m?.leads_received_buyer_connections)} connections, last 6 months{a.low_sample ? " · small sample" : ""}</span></h3>
    {a.flags?.length ? a.flags.slice(0, 4).map((f: any) => <div className="zl-flag" key={f.k}><b>{f.label}</b> ({f.src}): {pc(f.v)} vs team {pc(f.team)}</div>)
      : <div className="zl-flag ok">At or above the team rate on every tracked rate.</div>}</div>;
}

const pcv = (v: any) => (ok(v) ? `${v}%` : "—");
const minf = (m: any) => (!ok(m) ? "—" : m < 120 ? `${Math.round(m)} min` : m < 2880 ? `${(m / 60).toFixed(1)} h` : `${(m / 1440).toFixed(1)} d`);
const FC: [string, string, (v: any) => string][] = [["leads", "Leads", num], ["stl_median_min", "Median to 1st human call", minf], ["stl_pct_within_5min", "≤5 min", pcv], ["stl_pct_within_1hr", "≤60 min", pcv],
  ["pct_uncontacted", "Uncontacted", pcv], ["leads_with_appt_set", "Appt set", num], ["leads_with_appt_met", "Appt met", num]];
function FubZp({ z, agent }: { z?: any; agent?: string | null }) {
  const [w, setW] = usePersist<"last_90d" | "ytd_2026">("zf", "last_90d");
  if (!z) return <section className="section"><h2 className="serif">FUB · Zillow Preferred leads</h2><p className="caption">— Not in this snapshot.</p></section>;
  const W = z[w] ?? {}; const byA = W.by_agent ?? {};
  const key = agent ? Object.keys(byA).find((k) => sameAgent(k, agent)) : undefined;
  const t = agent ? (key ? byA[key] : null) : W.total;
  const weeks = Object.entries(W.by_iso_week ?? {}).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  const rows = Object.entries(byA).filter(([k]) => !agent || k === key).sort((a: any, b: any) => (b[1].leads ?? 0) - (a[1].leads ?? 0));
  const tbl = (rs: [string, any][], first: string) => <div className="tablewrap"><table className="fa-agents"><thead><tr><th>{first}</th>{FC.map(([k, l]) => <th key={k} className="r">{l}</th>)}</tr></thead>
    <tbody>{rs.map(([n, r]) => <tr key={n}><td>{n}</td>{FC.map(([k, , f]) => <td key={k} className="r">{f(r?.[k])}</td>)}</tr>)}</tbody></table></div>;
  return <section className="section zl-fub"><h2 className="serif">FUB · Zillow Preferred leads</h2>
    <div className="seg ft-seg">{([["last_90d", "Last 90 days"], ["ytd_2026", "2026 year to date"]] as const).map(([k, l]) => <button key={k} className={w === k ? "on active" : ""} onClick={() => setW(k)}>{l}</button>)}</div>
    {agent && !t ? <p className="caption">— No FUB Zillow Preferred leads owned by {agent} in this window.</p> :
      <div className="fa-cards ft-4">{FC.map(([k, l, f]) => <Card key={k} l={`FUB · ${l}`} v={f(t?.[k])} h={k === "stl_median_min" ? "Jesse Jones (Fello AI dialer) calls excluded" : k === "pct_uncontacted" ? `${num(t?.uncontacted)} leads, no human call or text` : undefined} />)}</div>}
    <h3 className="serif">{agent ? "Agent row" : "By agent"} (current lead owner)</h3>{rows.length ? tbl(rows as any, "Agent") : <p className="caption">—</p>}
    {agent ? <p className="caption">The weekly breakdown is team-level only.</p> : <><h3 className="serif">By ISO week</h3>{tbl(weeks as any, "Week")}</>}
    <ul className="fl-notes zl-caveats"><li>FUB call history starts Jul 1, 2025 and appointment history starts Dec 18, 2025.</li><li>Per-agent numbers use the lead's current owner in FUB, not who owned it when it arrived.</li>
      <li>FUB deal dollars are not shown as closings: every user on a deal gets credit, so they overlap. Closings come from Sisu and the Zillow sheet.</li>
      <li>Spend: — (not in FUB). Source: FUB Manager, {z.snapshot ?? "—"}.</li></ul></section>;
}

export default function Zillow({ data }: { data?: any }) {
  const { agent } = useAgent();
  const [win, setWin] = usePersist<"l40d" | "l6m">("zw", "l40d");
  if (!data) return <div className="gatecard"><h1 className="serif">Zillow</h1><p className="rule" /><p>— Not in this snapshot yet. It loads with the next pipeline run.</p></div>;
  const T = data.team_totals ?? {}, T4 = T.l40d ?? {}, T6 = T.l6m ?? {}, TZ = T.l90d_zhl ?? {}, W = data.windows ?? {}, FZ = data.fub_zillow_preferred ?? {}, F90 = FZ.last_90_days ?? {};
  const agents: any[] = data.agents ?? []; const A = agent ? agents.find((a) => sameAgent(a.agent, agent)) : null;
  const winL = win === "l40d" ? (W.l40d?.replace(/\s*Agent Name$/, "") || "Last 40 days") : (W.l6m || "Last 6 months");
  const head = <><div className="asof">Zillow sheet updated {data.sheet_last_update ?? "—"} · built {data.as_of ?? "—"}</div><h1 className="page-title serif">Zillow Preferred</h1></>;
  const seg = <div className="seg ft-seg">{([["l40d", "Last 40 days"], ["l6m", "Last 6 months"]] as const).map(([k, l]) => <button key={k} className={win === k ? "on active" : ""} onClick={() => setWin(k)}>{l}</button>)}</div>;
  const nulls = (o: any) => <table><tbody>{[["Spend", usd(o?.spend)], ["Cost per closing", usd(o?.cost_per_closing)], ["Speed to first response", num(o?.speed_to_first_response)], ["Weekly numbers", num(data.weekly_totals)]].map(([l, v]) => <tr key={l}><td>{l}</td><td className="r">{v}</td></tr>)}</tbody></table>;

  if (agent) {
    if (!A) return <div className="fubaudit page zillow">{head}<div className="page-body"><AgentBanner />
      <div className="teamonly"><div className="teamonly-k">No Zillow data for {agent}</div><p>{agent} does not appear on any per-agent tab of the Zillow Preferred sheet (updated {data.sheet_last_update ?? "—"}).</p></div>
      <FubZp z={data.fub_zp} agent={agent} />
      <TeamOnly what="Team monthly PA transactions and ZHL funded loans" /></div></div>;
    const s = A[win] ?? {}, z = A.l90d_zhl ?? {}, c = A.closings_by_year ?? {};
    return <div className="fubaudit page zillow">{head}<div className="page-body"><AgentBanner note="From the Zillow Preferred sheet, per-agent tabs" />
      {seg}
      <section className="section"><h2 className="serif">Agent funnel, {winL}</h2>
        {A[win] ? <Funnel steps={[["Buyer connections", s.leads_received_buyer_connections], ["Appointments", s.appointments], ["Met with", s.meetings], ["Showings", s.showings], ["Offers", s.offers], ["Pending + closed", s.pending_plus_closed]]} /> : <p className="caption">— No rows for this agent in this window.</p>}
        <p className="caption">Pickups {num(s.pickups)} · pickup rate {pc(s.pickup_rate)} · raw CVR {pc(s.raw_cvr)} · CSAT {num(s.csat)} · predicted CVR {pc(s.predicted_cvr)}. Blank cells in Zillow's sheet show as —.</p></section>
      <section className="section"><h2 className="serif">ZHL funnel, last 90 days</h2>
        <Funnel steps={[["Preferred buyer connections", z.preferred_buyer_connections], ["Met with", z.met_with_connections], ["ZHL transfers", z.zhl_transfers], ["Pre-approvals", z.preapprovals], ["Locks", z.locks], ["Funded", z.funded]]} />
        <p className="caption">Transfer rate {pc(z.transfer_rate)} · pre-approval rating {z.preapproval_rating ?? "—"} · PA transactions {num(z.pa_transactions)}.</p></section>
      <section className="section"><h2 className="serif">Closings credited</h2><div className="fa-cards ft-4"><Card l="2024" v={num(c["2024"])} /><Card l="2025" v={num(c["2025"])} /><Card l="2026" v={num(c["2026"])} /><Card l="Total" v={num(c["Grand Total"])} /></div>
        <p className="caption">Zillow "Closes Preferred" tab. Transactions logged Mar 5 – Sep 2, 2026: {num(A.transactions_logged_mar_sep_2026)}.</p></section>
      <section className="section"><h2 className="serif">Coaching flags</h2><Flags a={A} /></section>
      <section className="section"><h2 className="serif">Not in the sheet</h2>{nulls(A)}</section>
      <FubZp z={data.fub_zp} agent={agent} />
      <TeamOnly what="Team monthly PA transactions and ZHL funded loans" /></div></div>;
  }

  const closers = agents.filter((a) => a.closings_by_year?.["Grand Total"]).sort((a, b) => b.closings_by_year["Grand Total"] - a.closings_by_year["Grand Total"]);
  const coach = agents.filter((a) => (a.l6m?.leads_received_buyer_connections ?? 0) > 0).sort((a, b) => (b.l6m.leads_received_buyer_connections ?? 0) - (a.l6m.leads_received_buyer_connections ?? 0));
  const cl = data.monthly_closes_2025_team ?? {};
  return <div className="fubaudit page zillow">{head}<div className="page-body">
    <div className="fa-cards ft-4">
      <Card l="Buyer connections, last 40 days" v={num(T4["Buyer Connections"])} h={`Pickups ${num(T4.Pickups)} · pickup rate ${pc(T4["Pickup Rate"])}`} />
      <Card l="Appointments / met with, 40 days" v={`${num(T4.Appointments)} / ${num(T4.Meetings)}`} h={`Pending + closed ${num(T4["Buyer Pending + Closed"])}`} />
      <Card l="Buyer connections, last 6 months" v={num(T6["Buyer Connections"])} h={`Pending + closed ${num(T6["Buyer Pending + Closed"])} · raw CVR ${pc(T6["Raw CVR"])}`} />
      <Card l="ZHL pre-approvals, 90 days" v={num(TZ["ZHL Pre-Approvals"])} h={`Monthly target ${num(TZ["Pre Approval Target Monthly"])}`} /></div>
    <section className="section"><h2 className="serif">Two sources, two definitions</h2>
      <div className="fa-grid2">
        <div className="fa-mini"><div className="fa-l">Zillow · Preferred buyer connections, last 90 days</div><div className="fa-v serif">{num(TZ["Preferred Buyer Connections"])}</div><div className="fa-h">Zillow Preferred sheet, ZHL Agent Opptys tab (updated {data.sheet_last_update ?? "—"})</div></div>
        <div className="fa-mini"><div className="fa-l">FUB · "Zillow Preferred" leads created since {F90.since ?? "—"}</div><div className="fa-v serif">{num(F90.leads)}</div><div className="fa-h">FUB Manager source funnel, bulk imports excluded · {num(F90.deals_closed)} closed</div></div></div>
      <p className="caption">Zillow counts connections; FUB counts lead records by source and creation date. The definitions differ, so these are shown side by side, not reconciled.</p></section>
    <section className="section"><h2 className="serif">Team monthly, 2025 vs 2026</h2><div className="zl-charts"><MonthlyChart mt={data.monthly_team} k="PA Transactions" title="PA transactions" /><MonthlyChart mt={data.monthly_team} k="ZHL Funded Loans" title="ZHL funded loans" /></div>
      <p className="caption">Zillow Premier Agent transactions and Zillow Home Loans funded loans, from the sheet's Dashboard tab. Team closings 2025: {num(cl.total_2025)}; 2026 column: {num(cl["2026"])}.</p></section>
    <section className="section"><h2 className="serif">Agent funnels</h2>{seg}<p className="caption">{winL}. Tap a header to sort. Blank cells in Zillow's sheet show as —.</p><AgentTable rows={agents} win={win} />
      <p className="caption">Team {winL}: {num((win === "l40d" ? T4 : T6)["Buyer Connections"])} connections → {num((win === "l40d" ? T4 : T6).Appointments)} appointments → {num((win === "l40d" ? T4 : T6).Meetings)} met with → {num((win === "l40d" ? T4 : T6).Offers)} offers → {num((win === "l40d" ? T4 : T6)["Buyer Pending + Closed"])} pending + closed.</p></section>
    <section className="section"><h2 className="serif">ZHL funnel, last 90 days</h2>
      <Funnel steps={[["Preferred buyer connections", TZ["Preferred Buyer Connections"]], ["Eligible met-with", TZ["Eligible Met-with Connections ZHL"]], ["ZHL transfers", TZ["ZHL Total Transfers"]], ["Connected with LO", TZ["Connected with LO"]], ["Credit pulls", TZ["Credit Pulls"]], ["Pre-approvals", TZ["ZHL Pre-Approvals"]]]} />
      <p className="caption">Transfer rate {pc(TZ["Overall Transfer Rate"])} · met-to-transfer {pc(TZ["Overall Met to Transfer Rate"])} · LO contact rate {pc(TZ["60%+      Contact Rate"])} (Zillow target 60%+).</p></section>
    <section className="section"><h2 className="serif">Closings by agent</h2>
      <div className="tablewrap"><table><thead><tr><th>Agent</th><th className="r">2024</th><th className="r">2025</th><th className="r">2026</th><th className="r">Total</th></tr></thead>
        <tbody>{closers.map((a) => <tr key={a.agent}><td>{a.agent}</td>{["2024", "2025", "2026", "Grand Total"].map((y) => <td key={y} className="r">{num(a.closings_by_year[y])}</td>)}</tr>)}</tbody></table></div>
      <p className="caption">Zillow "Closes Preferred" tab.</p></section>
    <section className="section"><h2 className="serif">Coaching flags</h2><p className="caption">Each agent's last-6-month rates (from counts) and ZHL transfer rate vs the team Grand Total. Up to four lowest gaps shown.</p>
      <div className="zl-coachgrid">{coach.map((a) => <Flags key={a.agent} a={a} />)}</div></section>
    <FubZp z={data.fub_zp} />
    <section className="section"><h2 className="serif">Not in the sheet</h2>{nulls({})}<p className="caption">Zillow's sheet has no spend, cost per closing, speed to first response or weekly data. No buyer details are used on this page.</p></section>
  </div></div>;
}
