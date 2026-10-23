import { useState } from "react";
import "./recruiting.css";

const STAGES: [string, string][] = [["applied", "Applied"], ["contacted", "Contacted"], ["interview_set", "Interview set"], ["interview_kept", "Interview kept"], ["offer", "Offer"], ["hired", "Hired"], ["onboarded", "Onboarded"], ["joined", "Joined"]];
const num = (v: any) => (typeof v === "number" && isFinite(v) ? v.toLocaleString("en-US") : "—");
const pct = (v: any) => (typeof v === "number" && isFinite(v) ? `${Math.round(v * 100)}%` : "—");
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const mlabel = (m: string) => { const [y, mm] = (m || "").split("-"); return mm ? `${MON[+mm - 1]} ${y.slice(2)}` : m || "—"; };

function Pipelines({ r }: { r?: any }) {
  const pls: any[] = r?.pipelines ?? [{ name: "Pipeline 1" }, { name: "Pipeline 2" }];
  const SK = ["Active", "Appointment", "Cultivate", "Committed"];
  return (
    <div className="page-body rc-res">
      <div className="rc-resflag">Resource: not counted in metrics. These pipeline totals are for reference only and are excluded from the funnel, conversion rates, recruiting totals, Multi-Year Trends and goals.</div>
      <div className="rc-banner"><div><span className="rc-k">Source</span> Bly Recruiting Pipeline (refreshed after each Monday pull)</div><div><span className="rc-k">As of</span> {r?.as_of ?? (r?.file_updated ? `file updated ${r.file_updated}` : "—")}</div></div>
      <div className="rc-pl">{pls.map((p) => <section className="section" key={p.name}><h2 className="serif">{p.name}</h2>
        <div className="rc-pltot"><span className="serif">{num(p.total)}</span> total</div>
        <table><tbody>{SK.map((k) => <tr key={k}><td>{k}</td><td className="r">{num(p.stages?.[k])}</td></tr>)}</tbody></table></section>)}</div>
      <section className="section"><h2 className="serif">Pipeline board</h2>
        <p className="text">The full board is private. <a href={r?.board_url ?? "https://bly-recruiting.pages.dev"} target="_blank" rel="noopener noreferrer">Open bly-recruiting.pages.dev</a>. It needs its own one-time PIN sign-in, separate from this site's Slack sign-in.</p></section>
    </div>);
}

export default function Recruiting({ data }: { data?: any }) {
  const [tab, setTab] = useState<"dyn" | "pipes">("dyn");
  const tabs = <div className="rc-tabs" role="tablist"><button role="tab" aria-selected={tab === "dyn"} className={tab === "dyn" ? "on" : ""} onClick={() => setTab("dyn")}>Recruiting Dynamics</button><button role="tab" aria-selected={tab === "pipes"} className={"res" + (tab === "pipes" ? " on" : "")} onClick={() => setTab("pipes")}>Recruit Pipelines <span>Resource</span></button></div>;
  if (tab === "pipes") return <div className="recruiting page"><h1 className="page-title serif">Recruiting Dynamics</h1>{tabs}<Pipelines r={data?.pipelines_resource} /></div>;
  if (!data) return <div className="recruiting page">{tabs}<div className="gatecard"><h1 className="serif">Recruiting Dynamics</h1><p className="rule" /><p>No recruiting data in this snapshot yet. It loads with the next pipeline run.</p></div></div>;
  const f = data.funnel ?? {}; const months: any[] = data.funnel_by_month ?? []; const py = data.prior_year;
  const top = Math.max(1, ...STAGES.map(([k]) => (typeof f[k] === "number" ? f[k] : 0)));
  const hs: any[] = data.hires_by_source ?? []; const hmax = Math.max(1, ...hs.map((h) => h.hires ?? 0));
  const tk = ["applied", "contacted", "interview_set", "interview_kept", "hired", "onboarded"];
  const mmax = Math.max(1, ...months.map((m) => m.applied ?? 0));
  const mbs: any[] = data.funnel_by_month_by_source ?? [];
  if (mbs.length) for (const m of months) m.by_source = mbs.filter((x) => x.month === m.month);
  const srcCols: string[] = Array.from(new Set(months.flatMap((m) => (m.by_source ?? []).map((s: any) => s.source))));
  const fy = data.first_year_results; const ghl: any[] = data.ghl_pipeline_summary ?? []; const sp: any[] = data.hires_by_sponsor ?? [];
  return (
    <div className="recruiting page">
      <div className="rc-banner"><div><span className="rc-k">Source</span> {data.source ?? "—"}</div><div><span className="rc-k">As of</span> {data.as_of ?? "—"}{data.period_label ? ` · ${data.period_label}` : ""}</div></div>
      <h1 className="page-title serif">Recruiting Dynamics</h1>
      {tabs}
      <p className="summary">Agent recruiting funnel from first application to joining the team. {data._origin === "recruiter-boss" ? "Fed by Recruiter Boss." : "Interim view from the Bly recruiting sheet until Recruiter Boss's feed arrives."}</p>
      <div className="page-body">
        <section className="section"><h2 className="serif">Funnel{data.period_label ? `, ${data.period_label}` : ""}</h2>
          <div className="rc-funnel">{STAGES.map(([k, l]) => <div className="rc-step" key={k}><span className="rc-sl">{l}</span><span className="rc-track"><i style={{ width: typeof f[k] === "number" ? `${(100 * f[k]) / top}%` : 0 }} /></span><b className="serif">{num(f[k])}</b>{py?.funnel ? <span className="rc-py">{py.label}: {num(py.funnel[k])}</span> : null}</div>)}</div></section>

        <section className="section"><h2 className="serif">Conversion rates</h2>
          <div className="rc-rates">{(data.conversion_rates ?? []).map((r: any) => <div className="rc-rate" key={r.label ?? `${r.from}-${r.to}`}><div className="serif rc-v">{pct(r.rate)}</div><div className="rc-l">{r.label ?? `${r.to} from ${r.from}`}</div>
            {py?.conversion_rates ? <div className="rc-h">{py.label}: {pct(py.conversion_rates.find((p: any) => p.label?.replace(/^% /, "").split(" from ")[1] === r.label?.split(" from ")[1])?.rate)}</div> : null}</div>)}
            {!(data.conversion_rates ?? []).length ? <p className="caption">—</p> : null}</div></section>

        <section className="section"><h2 className="serif">Monthly trend</h2>
          <div className="rc-chart" role="img" aria-label="Applied and hired by month">{months.map((m) => <div className="rc-col" key={m.month}>
            <div className="rc-bars"><i className="a" style={{ height: `${(100 * (m.applied ?? 0)) / mmax}%` }} title={`Applied ${num(m.applied)}`} /><i className="h" style={{ height: `${(100 * (m.hired ?? 0)) / mmax}%` }} title={`Hired ${num(m.hired)}`} /></div>
            <span>{mlabel(m.month)}</span></div>)}</div>
          <div className="rc-legend"><span><i className="a" /> Applied</span><span><i className="h" /> Hired</span></div>
          <div className="tablewrap"><table><thead><tr><th>Month</th>{tk.map((k) => <th className="r" key={k}>{STAGES.find((s) => s[0] === k)![1]}</th>)}</tr></thead>
            <tbody>{months.map((m) => <tr key={m.month}><td>{mlabel(m.month)}</td>{tk.map((k) => <td className="r" key={k}>{num(m[k])}</td>)}</tr>)}</tbody></table></div>
          {srcCols.length ? <><h3 className="serif">Applicants by source, by month{mbs.length ? " (applied / hired)" : ""}</h3><div className="tablewrap"><table><thead><tr><th>Month</th>{srcCols.map((s) => <th className="r" key={s}>{s}</th>)}</tr></thead>
            <tbody>{months.map((m) => <tr key={m.month}><td>{mlabel(m.month)}</td>{srcCols.map((s) => <td className="r" key={s}>{(() => { const x = (m.by_source ?? []).find((x: any) => x.source === s); return mbs.length ? `${num(x?.applied)} / ${num(x?.hired)}` : num(x?.applied); })()}</td>)}</tr>)}</tbody></table></div></> : null}</section>

        <section className="section"><h2 className="serif">Hires by source</h2>
          <div className="rc-hs">{hs.map((h) => <div className="rc-step" key={h.source}><span className="rc-sl">{h.source}</span><span className="rc-track"><i style={{ width: `${(100 * (h.hires ?? 0)) / hmax}%` }} /></span><b className="serif">{num(h.hires)}</b>{h.hires_all_time != null ? <span className="rc-py">all-time {num(h.hires_all_time)}</span> : null}</div>)}{!hs.length ? <p className="caption">—</p> : null}</div>
          {(data.funnel_by_source ?? []).length ? <><h3 className="serif">Funnel by source</h3><div className="tablewrap"><table><thead><tr><th>Source</th>{STAGES.map(([k, l]) => <th className="r" key={k}>{l}</th>)}</tr></thead>
            <tbody>{data.funnel_by_source.map((r: any) => <tr key={r.source}><td>{r.source}</td>{STAGES.map(([k]) => <td className="r" key={k}>{num(r[k])}</td>)}</tr>)}</tbody></table></div></> : null}</section>

        {fy ? <section className="section"><h2 className="serif">First-year results</h2>
          <div className="rc-rates">{([["Agents tracked", num(fy.agents_tracked)], ["With a first closing", num(fy.agents_with_first_closing)], ["Avg days to first closing", num(fy.avg_days_to_first_closing)], ["Closing within 90 days", pct(fy.share_closing_within_90_days)],
            ["First-year closings", num(fy.total_first_year_closings)], ["Closings per agent", typeof fy.avg_first_year_closings_per_agent === "number" ? fy.avg_first_year_closings_per_agent.toFixed(2) : "—"], ["Inactive agents", num(fy.agents_inactive)]] as [string, string][]).map(([l, v]) =>
            <div className="rc-rate" key={l}><div className="serif rc-v">{v}</div><div className="rc-l">{l}</div></div>)}</div></section> : null}

        {sp.length ? <section className="section"><h2 className="serif">Hires by sponsor</h2><p className="caption">Sponsors are anonymized.</p><div className="tablewrap"><table><thead><tr><th>Sponsor</th><th className="r">2026 hires</th><th className="r">All-time</th><th className="r">Still on team</th></tr></thead>
          <tbody>{sp.map((r) => <tr key={r.sponsor}><td>{r.sponsor}</td><td className="r">{num(r.hires)}</td><td className="r">{num(r.hires_all_time)}</td><td className="r">{num(r.still_on_team)}</td></tr>)}</tbody></table></div></section> : null}

        {ghl.length ? <section className="section"><h2 className="serif">Go High Level pipelines</h2><p className="caption">Current open records by stage. Only pipelines marked "in tracker" feed the funnel above.</p>
          <div className="rc-ghl">{ghl.map((g) => <div className="rc-rate" key={g.pipeline}><div className="rc-l">{g.pipeline}{g.imported_to_tracker ? <span className="fa-tag">in tracker</span> : null}</div>
            <div className="caption">{num(g.total)} total · {num(g.open)} open · {num(g.stale_over_30_days)} stale 30d+</div>
            <table><tbody>{(g.stages ?? []).map((st: any) => <tr key={st.stage}><td>{st.stage}</td><td className="r">{num(st.count)}</td></tr>)}</tbody></table></div>)}</div></section> : null}

        {(data.recruiter_activity ?? []).length ? <section className="section"><h2 className="serif">Recruiter activity</h2><div className="tablewrap"><table><thead><tr><th>Recruiter</th><th>Period</th><th className="r">Calls</th><th className="r">Texts</th><th className="r">Interviews held</th><th className="r">Offers</th></tr></thead>
          <tbody>{data.recruiter_activity.map((r: any, i: number) => <tr key={i}><td>{r.recruiter ?? "—"}</td><td>{r.period ?? "—"}</td>{["calls", "texts", "interviews_held", "offers"].map((k) => <td className="r" key={k}>{num(r[k])}</td>)}</tr>)}</tbody></table></div></section> : null}

        <section className="section rc-dq"><h2 className="serif">Data quality</h2><ul>{[...(data.data_quality ?? []), ...(data.notes ?? [])].map((t: string) => <li key={t}>{t}</li>)}</ul></section>
      </div>
    </div>
  );
}
