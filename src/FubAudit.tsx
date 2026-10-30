import { useMemo, useState } from "react";
import "./fubaudit.css";
import { Table } from "./kit";
import { AgentBanner, TeamOnly, pickAgent, sameAgent, usePersist } from "./agent";
export { num, mins };

const AI = "Jesse Jones";
const num = (v: any) => (v === null || v === undefined || v === "" || (typeof v === "number" && (v < 0 || !isFinite(v))) ? "—" : typeof v === "number" ? v.toLocaleString("en-US") : String(v));
const mins = (v: any) => (typeof v !== "number" || v < 0 ? "—" : v < 60 ? `${v.toFixed(1)} min` : v < 600 ? `${v.toFixed(1)} min` : `${(v / 60).toFixed(1)} h`);
const minSort = (v: any) => (typeof v === "number" && v >= 0 ? v : null);
// Scorecard cell for the shared kit Table: text drives sort/totals, raw numbers sort numerically, name keeps the AI tag.
const colCell = (c: Col, r: any) => { const v = r[c.k]; const text = c.f ? c.f(v) : num(v);
  if (c.k === "name") return r.isAI ? { text: r.name, node: <>{r.name}<span className="fa-tag">Fello AI dialer</span></> } : r.name;
  return { text, sort: typeof v === "number" ? (isFinite(v) && v >= 0 ? v : null) : undefined }; };
const T = ({ t }: { t?: string | null }) => (t ? <p className="caption">{t}</p> : null);

type Col = { k: string; l: string; f?: (v: any) => string; n?: boolean };
const COLS: Col[] = [
  { k: "name", l: "Agent" }, { k: "role", l: "Role" }, { k: "lastSeen", l: "Last seen" },
  { k: "people", l: "People", n: true }, { k: "activeLeads", l: "Active leads", n: true },
  { k: "newLeads", l: "New leads 30d", n: true }, { k: "medianFirstHumanCallMin", l: "Median first call", f: mins, n: true },
  { k: "unc30", l: "Uncontacted 30d", n: true }, { k: "unc7", l: "Uncontacted 7d (tracker)", n: true },
  { k: "callsOut", l: "Calls out", n: true }, { k: "calls60s", l: "Calls 60s+", n: true }, { k: "textsNewLeads", l: "Texts*", n: true },
  { k: "notes", l: "Notes", n: true }, { k: "appts", l: "Appts", n: true }, { k: "openTasks", l: "Open tasks", n: true }, { k: "overdue", l: "Overdue", n: true },
];

export function Overview({ data, agent }: { data?: any; agent?: string | null }) {
  const [q, setQ] = useState(""); const [role, setRole] = usePersist("or", "All"); const [hideAI0, setHideAI0] = usePersist<string>("oh", "0"); const hideAI = hideAI0 === "1"; const setHideAI = (b: boolean) => setHideAI0(b ? "1" : "0");
  const sort: { k: string; d: 1 | -1 } = { k: "people", d: -1 }; // starting order; header clicks re-sort in the kit Table
  const s = data?.site ?? {}; const u = data?.uncontacted ?? {}; const stl = s.speedToLead ?? {};
  const rows = useMemo(() => {
    const ext: Record<string, any> = {}; for (const a of data?.agents ?? []) ext[a.agent] = a;
    return (s.agents ?? []).map((a: any) => ({ ...a, isAI: a.isAI || a.name === AI, unc30: ext[a.name]?.uncontacted ?? (a.neverTouched ?? null), unc7: ext[a.name]?.unc7 ?? (u.tracker_7d != null ? 0 : null) }));
  }, [data]);
  const roles = ["All", ...Array.from(new Set(rows.map((r: any) => r.role).filter(Boolean))) as string[]];
  const shown = rows.filter((r: any) => (role === "All" || r.role === role) && (!hideAI || !r.isAI) && r.name.toLowerCase().includes(q.toLowerCase()))
    .sort((a: any, b: any) => { const x = a[sort.k], y = b[sort.k]; const nx = x == null || x < 0, ny = y == null || y < 0; if (nx !== ny) return nx ? 1 : -1; return (x > y ? 1 : x < y ? -1 : 0) * sort.d; });
  if (!data) return <div className="gatecard"><h1 className="serif">FUB Audit</h1><p className="rule" /><p>No audit data in this snapshot yet. It loads with the next pipeline run.</p></div>;
  if (agent) return <AgentOverview data={data} agent={agent} rows={rows.filter((r: any) => sameAgent(r.name, agent))} />;
  const sum = s.summary ?? {}; const tk = s.tasks ?? {}; const ov = data.overview; const hy = data.views?.hygiene?.team_excl_jesse;
  const cards: [string, any, string?][] = [
    ["People in FUB", sum.people], ["Users", sum.users], ["Deals", sum.deals],
    ...(ov ? [[ov.median_label ?? "Median speed to lead", mins(ov.median_min), "First human call, excl. Fello AI dialer"], ["Uncontacted, 7-day", ov.unc7, "New leads, human-owned"], ["Uncontacted, 30-day", ov.unc30, "New leads, human-owned"]] as [string, any, string?][]
      : [["Median speed to lead", mins(stl.exclAI?.median), "First human call, excl. Fello AI dialer"], ["Uncontacted, 30-day", u.fubm_30d ?? stl.exclAI?.uncontacted, "FUB Manager definition"], ["Uncontacted, 7-day", u.tracker_7d, "Metrics Tracker definition"]] as [string, any, string?][]),
    ["Overdue human tasks", hy?.overdue_tasks ?? tk.humanOverdue, (hy?.open_tasks ?? tk.humanOpen) != null ? `of ${num(hy?.open_tasks ?? tk.humanOpen)} open` : undefined],
  ];
  return (
    <div className="fubaudit page">
      <div className="asof">As of {s.asOfLabel ?? data.as_of ?? "—"}{s.source ? ` · ${s.source}` : ""}</div>
      <h1 className="page-title serif">FUB Audit</h1>
      {!ov && s.text?.topCallout ? <p className="summary">{s.text.topCallout}</p> : null}
      <div className="page-body">
        <div className="fa-cards">{cards.map(([l, v, h]) => <div className="fa-card" key={l}><div className="fa-v serif">{typeof v === "string" ? v : num(v)}</div><div className="fa-l">{l}</div>{h ? <div className="fa-h">{h}</div> : null}</div>)}</div>
        <div className="fa-note"><strong>Jesse Jones is the Fello AI dialer</strong>, not a person. His leads, calls, texts and tasks are AI activity, shown separately and excluded from human totals.</div>

        <section className="section"><h2 className="serif">Key findings</h2>
          <table><tbody>{(s.kpis ?? []).filter((k: any) => !(ov ? /^(Uncontacted|Speed to lead|New leads)/ : /^Uncontacted/).test(k[0])).map((k: any) => <tr key={k[0]}><td>{k[0]}</td><td className="r">{k[1] ?? "—"}</td></tr>)}</tbody></table></section>

        {ov ? <p className="caption">Speed to lead and uncontacted counts use FUB Manager's current cohort (bulk imports excluded), as of {ov.as_of?.slice(0, 16).replace("T", " ") ?? "—"} CT. Detail is on the Speed to Lead tab.</p> : <section className="section"><h2 className="serif">Speed to lead</h2><T t={s.notes?.speedToLead} />
          <div className="fa-grid3">{[["Human-owned leads", stl.exclAI], ["All new leads", stl.all], ["Owned by Fello AI dialer", stl.aiOwned]].map(([l, o]: any) =>
            <div className="fa-mini" key={l}><div className="fa-l">{l}</div><div className="fa-v serif">{mins(o?.median)}</div><div className="fa-h">{num(o?.n)} leads · {num(o?.uncontacted)} uncontacted</div></div>)}</div>
          <h3 className="serif">First human call</h3>
          <div className="fa-bars">{(() => { const b = stl.buckets ?? []; const mx = Math.max(1, ...b.map((x: any) => x[1] ?? 0)); return b.map((x: any) => <div className="fa-bar" key={x[0]}><span>{x[0]}</span><i style={{ width: `${(100 * (x[1] ?? 0)) / mx}%` }} /><b>{num(x[1])}</b></div>); })()}</div>
          <h3 className="serif">By source</h3>
          <Table columns={["Source", "Leads", "Median first call", "Uncontacted"]} tdClass={["", "r", "r", "r"]}
            rows={(stl.bySource ?? []).map((r: any) => [r[0], num(r[1]), { text: mins(r[2]), sort: minSort(r[2]) }, num(r[3])])} wrapClass="" />
          <T t={s.text?.speed} /></section>}

        <section className="section"><h2 className="serif">Uncontacted leads</h2>
          {ov ? <div className="fa-grid2">
            <div className="fa-mini"><div className="fa-l">7-day</div><div className="fa-v serif">{num(ov.unc7)}</div><div className="fa-h">{ov.unc_def ?? "—"}</div></div>
            <div className="fa-mini"><div className="fa-l">30-day</div><div className="fa-v serif">{num(ov.unc30)}</div><div className="fa-h">{ov.unc_def ?? "—"}</div></div>
          </div> : null}
          {ov ? <p className="caption">Cross-check: the Metrics Tracker's own 7-day alert list shows {num(u.tracker_7d)}{u.tracker_asof ? ` as of ${u.tracker_asof}` : ""} (excl. AI dialer).</p> : <><div className="fa-grid2">
            <div className="fa-mini"><div className="fa-l">30-day · FUB Manager</div><div className="fa-v serif">{num(u.fubm_30d)}</div><div className="fa-h">{u.fubm_def ?? "—"}</div></div>
            <div className="fa-mini"><div className="fa-l">7-day · Metrics Tracker</div><div className="fa-v serif">{num(u.tracker_7d)}</div><div className="fa-h">{u.tracker_def ?? "—"}{u.tracker_asof ? ` · as of ${u.tracker_asof}` : ""}</div></div>
          </div><p className="caption">Two windows, two definitions; the counts are not expected to match. Including the AI dialer's leads, the 30-day count is {num(u.fubm_30d_all)}.</p></>}</section>

        <section className="section"><h2 className="serif">Data hygiene</h2>
          <table><tbody>{(s.hygiene ?? []).map((h: any) => <tr key={h[0]}><td>{h[0]}</td><td className="r">{h[1] ?? "—"}</td></tr>)}
            <tr><td>Unassigned people</td><td className="r">{num(data.hygiene?.unassigned)}</td></tr>
            <tr><td>New leads (30d) with unspecified source</td><td className="r">{num(data.hygiene?.new30_unspecified_source)}</td></tr>
            <tr><td>Active-stage people, no activity 90+ days</td><td className="r">{num(data.hygiene?.act_lastact_gt90)}</td></tr></tbody></table>
          <T t={s.text?.hygiene} />
          {s.dormant?.length ? <><h3 className="serif">Dormant users</h3><Table columns={["User", "Last sign-in", "People", "Active", "Open tasks"]} tdClass={["", "", "r", "r", "r"]} wrapClass=""
            rows={s.dormant.map((d: any) => [d[0], d[1] ?? "", num(d[2]), num(d[3]), num(d[4])])} /></> : null}</section>

        <section className="section"><h2 className="serif">Pipeline staleness</h2><T t={s.text?.staleness} />
          <Table columns={["Stage", "Total", "<7d", "7–30d", "30–90d", "90d+", "Never"]} tdClass={["", "r", "r", "r", "r", "r", "r"]}
            rows={(s.staleness ?? []).map((r: any) => [r.stage, ...["total", "lt7", "d7_30", "d30_90", "gt90", "never"].map((k) => num(r[k]))])} /></section>

        <section className="section"><h2 className="serif">Agent scorecard</h2><T t={s.text?.scorecard2} />
          <div className="fa-filters">
            <input type="search" placeholder="Filter by name" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Filter agents by name" />
            <select value={role} onChange={(e) => setRole(e.target.value)} aria-label="Role">{roles.map((r) => <option key={r}>{r}</option>)}</select>
            <label><input type="checkbox" checked={hideAI} onChange={(e) => setHideAI(e.target.checked)} /> Hide AI dialer</label>
            <span className="caption">{shown.length} of {rows.length}</span>
          </div>
          <Table className="fa-agents" columns={COLS.map((c) => c.l)} tdClass={COLS.map((c) => (c.n ? "r" : ""))} rows={shown.map((r: any) => COLS.map((c) => colCell(c, r)))}
            rowClass={(_, i) => (shown[i].isAI ? "ai" : undefined)} inTotal={(_, i) => !shown[i].isAI} totalLabel={shown.some((r: any) => r.isAI) ? "Total (excl. AI dialer)" : undefined} />
          <T t={s.text?.scorecard1} /></section>

        {s.recommendations?.length ? <section className="section"><h2 className="serif">Recommendations</h2><ol className="fa-recs">{s.recommendations.map((r: string) => <li key={r}>{r}</li>)}</ol></section> : null}
        {s.text?.method ? <section className="section"><h2 className="serif">Method</h2><p className="text">{s.text.method}</p></section> : null}
      </div>
    </div>
  );
}

/** Overview for one agent: FUB Manager 30-day per-agent numbers; team-wide sections are labelled team-level only. */
function AgentOverview({ data, agent, rows }: { data: any; agent: string; rows: any[] }) {
  const V = data.views ?? {}; const o = pickAgent(V.overview_totals?.agents, agent) as any;
  const sp = pickAgent(V.speed_to_lead?.last_30_days?.by_agent, agent) as any; const cu = pickAgent(V.speed_to_lead?.current_uncontacted_new_leads?.by_agent, agent) as any;
  const hy = pickAgent(V.hygiene?.by_agent, agent) as any;
  const cards: [string, any, string?][] = [
    ["People assigned", o?.people], ["Active leads", o?.activeLeads], ["Calls out, 30 days", o?.callsOut, o ? `${num(o.calls60s)} over 60 s` : undefined],
    ["Notes, 30 days", o?.notes], ["Appointments, 30 days", o?.appts],
    ["Median speed to lead", mins(sp?.median_min), sp ? `${num(sp.leads)} new leads, last 30 days` : "No new leads in window"],
    ["Uncontacted, 7 / 30 day", cu ? `${num(cu.uncontacted_7d)} / ${num(cu.uncontacted_30d)}` : "—", "New non-bulk leads"],
    ["Overdue tasks", hy?.overdue_tasks, hy ? `of ${num(hy.open_tasks)} open` : undefined]];
  return (<div className="fubaudit page">
    <div className="asof">As of {V.overview_totals?.as_of?.slice(0, 16).replace("T", " ") ?? data.as_of ?? "—"} CT · FUB Manager</div>
    <h1 className="page-title serif">FUB Audit</h1>
    <div className="page-body"><AgentBanner note="Last 30 days where noted; counts are this agent's FUB book" />
      {!o && !sp && !hy && !rows.length ? <p className="caption">— No FUB numbers for this agent in this snapshot (not a FUB user, or a different FUB name).</p> : null}
      <div className="fa-cards">{cards.map(([l, v, h]) => <div className="fa-card" key={l}><div className="fa-v serif">{typeof v === "string" ? v : num(v)}</div><div className="fa-l">{l}</div>{h ? <div className="fa-h">{h}</div> : null}</div>)}</div>
      {rows.length ? <section className="section"><h2 className="serif">Agent scorecard row</h2>
        <Table className="fa-agents" columns={COLS.map((c) => c.l)} tdClass={COLS.map((c) => (c.n ? "r" : ""))} rows={rows.map((r: any) => COLS.map((c) => colCell(c, r)))} /></section> : null}
      <TeamOnly what="Key findings, data hygiene totals, pipeline staleness by stage and recommendations" />
    </div></div>);
}
