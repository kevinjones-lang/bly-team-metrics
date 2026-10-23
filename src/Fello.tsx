// Fello (Felix AI) tab. Sources: Fello Manager's fello.json (UI-read totals), FUB Manager ai_handoff.json, tracker (Sisu contract/closing). Totals only; "—" when missing.
import { useAgent, pickAgent, AgentBanner } from "./agent";
import "./fubaudit.css";

const ok = (v: any) => typeof v === "number" && isFinite(v);
const num = (v: any) => (ok(v) ? v.toLocaleString("en-US") : "—");
const usd = (v: any) => (ok(v) ? "$" + Math.round(v).toLocaleString("en-US") : "—");
const pc = (v: any) => (ok(v) ? `${Number.isInteger(v) ? v : v.toFixed(1)}%` : "—");
const mins = (m: any) => (ok(m) ? `${Math.round(m).toLocaleString("en-US")} min` : "—");
const MN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const mlab = (m: string) => MN[+m.slice(5, 7) - 1] ?? m;
const Card = ({ l, v, h }: { l: string; v: string; h?: string }) => <div className="fa-card"><div className="fa-v serif">{v}</div><div className="fa-l">{l}</div>{h ? <div className="fa-h">{h}</div> : null}</div>;

function WaitTrend({ rows }: { rows: any[] }) {
  const pts = rows.filter((r) => ok(r.median_min)); if (!pts.length) return <p className="caption">—</p>;
  const W = 640, H = 200, P = 36, mx = Math.max(...pts.map((r) => r.median_min)) * 1.15;
  const X = (i: number) => P + (i * (W - 2 * P)) / Math.max(1, pts.length - 1), Y = (v: number) => H - P - (v * (H - 2 * P)) / mx;
  return <svg className="ft-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Monthly median minutes from handoff to a human call">
    <line x1={P} x2={W - P} y1={H - P} y2={H - P} stroke="#D6D0C2" /><line x1={P} x2={W - P} y1={Y(60)} y2={Y(60)} stroke="#C0A062" strokeDasharray="5 4" />
    <text x={W - P} y={Y(60) - 5} textAnchor="end" fontSize="11" fill="#8a7440">1 hour</text>
    <polyline points={pts.map((r, i) => `${X(i)},${Y(r.median_min)}`).join(" ")} fill="none" stroke="#00519B" strokeWidth="2.5" />
    {pts.map((r, i) => <g key={r.month}><circle cx={X(i)} cy={Y(r.median_min)} r="4" fill="#00519B" />
      <text x={X(i)} y={Y(r.median_min) - 10} textAnchor="middle" fontSize="12" fill="#12151C">{Math.round(r.median_min).toLocaleString("en-US")}</text>
      <text x={X(i)} y={H - 12} textAnchor="middle" fontSize="12" fill="#6B6B6B">{mlab(r.month)}{r.partial ? " (to date)" : ""}</text></g>)}
  </svg>;
}

const PER: [string, string][] = [["last30", "Last 30 days"], ["last60", "Last 60 days"], ["last90", "Last 90 days"], ["last180", "Last 180 days"], ["ytd", "Year to date"], ["last_month_2026_09", "Sep"], ["this_month_2026_10_01_to_23", "Oct 1–23"]];
function MonthlyBars({ rows }: { rows: any[] }) {
  if (!rows.length) return <p className="caption">—</p>;
  const W = 640, H = 220, P = 40, bw = (W - 2 * P) / rows.length;
  const mxA = Math.max(1, ...rows.flatMap((r) => [r.calls ?? 0, r.sms ?? 0])), mxH = Math.max(1, ...rows.map((r) => r.fub_handoffs ?? 0));
  const Y = (v: number, m: number) => H - P - (v * (H - 2 * P)) / m;
  const hp = rows.map((r, i) => (ok(r.fub_handoffs) ? `${P + i * bw + bw / 2},${Y(r.fub_handoffs, mxH)}` : null)).filter(Boolean).join(" ");
  return <><svg className="ft-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Monthly Felix calls, texts and handoffs">
    <line x1={P} x2={W - P} y1={H - P} y2={H - P} stroke="#D6D0C2" />
    {rows.map((r, i) => { const x = P + i * bw; return <g key={r.month}>
      {ok(r.calls) ? <rect x={x + bw * 0.14} y={Y(r.calls, mxA)} width={bw * 0.32} height={H - P - Y(r.calls, mxA)} fill="#00519B" /> : null}
      {ok(r.sms) ? <rect x={x + bw * 0.5} y={Y(r.sms, mxA)} width={bw * 0.32} height={H - P - Y(r.sms, mxA)} fill="#9DB8D6" /> : null}
      <text x={x + bw / 2} y={H - 14} textAnchor="middle" fontSize="12" fill="#6B6B6B">{mlab(r.month)}{r.partial ? "*" : ""}</text></g>; })}
    <polyline points={hp} fill="none" stroke="#C0A062" strokeWidth="2.5" />
    {rows.map((r, i) => ok(r.fub_handoffs) ? <g key={"h" + i}><circle cx={P + i * bw + bw / 2} cy={Y(r.fub_handoffs, mxH)} r="4" fill="#C0A062" /><text x={P + i * bw + bw / 2} y={Y(r.fub_handoffs, mxH) - 9} textAnchor="middle" fontSize="12" fill="#12151C">{r.fub_handoffs}</text></g> : null)}
  </svg><div className="rc-legend fl-legend"><span><i style={{ background: "#00519B" }} /> AI calls</span><span><i style={{ background: "#9DB8D6" }} /> AI texts</span><span><i style={{ background: "#C0A062" }} /> Handoffs (FUB, own scale)</span><span>* to date</span></div></>;
}

export default function Fello({ data }: { data?: any }) {
  const { agent } = useAgent();
  if (!data) return <div className="gatecard"><h1 className="serif">Fello</h1><p className="rule" /><p>— Not in this snapshot yet. It loads with the next pipeline run.</p></div>;
  const F = data.felix ?? {}, Y = F.ytd ?? {}, L = F.last30 ?? {}, SN = F.snapshot ?? {}, U = data.fub ?? {}, S = data.sisu ?? {}, M: any[] = data.monthly ?? [];
  const steps: [string, any, string][] = [
    ["Felix first touch", SN.enrolled, "Contacts enrolled now (Fello)"], ["Engaging", SN.engaging, "Replying to Felix now (Fello)"],
    ["Handoff", U.handoffs, "FUB \"Felix AI Handoff\" events, YTD"], ["Human call", U.human_called, "Called by a person after handoff"],
    ["Appointment", U.appointments, "FUB appointment after handoff"], ["FUB deals created (any stage)", U.deals_any_stage, "FUB"],
    ["Under contract", S.under_contract, `Sisu, ${data.year}`], ["Closed", S.closed, `Sisu · ${usd(S.closed_gci)} GCI · ${usd(S.closed_vol)} volume`]];
  const mx = Math.max(1, ...steps.map((s) => (ok(s[1]) ? s[1] : 0)));
  const byA = agent ? pickAgent(F.per_agent_handoffs, agent) : undefined;
  const asof = (s: any) => (s ? String(s).slice(0, 16).replace("T", " ") : "—");
  return <div className="fubaudit page fello">
    <div className="asof">Fello as of {asof(F.as_of)} · FUB as of {asof(U.as_of)} CT</div>
    <h1 className="page-title serif">Fello · Felix AI</h1>
    <div className="page-body">
      {agent ? <><AgentBanner note="Fello per-agent data is limited to handoff counts" />
        <div className="fa-cards ft-4"><Card l="Felix handoffs to this agent" v={num(byA)} h={F.per_agent_handoffs ? "Fello" : "Not supplied by Fello yet"} /></div>
        <p className="caption">Everything below is team-level only: Felix works the whole database, not one agent's book.</p></> : null}
      <div className="fa-cards ft-4">
        <Card l="AI calls, YTD" v={num(Y.calls)} h={`Last 30 days ${num(L.calls)}`} /><Card l="AI texts, YTD" v={num(Y.sms)} h={`Last 30 days ${num(L.sms)}`} />
        <Card l="Response rate, YTD" v={`${pc(Y.call_resp_pct)} / ${pc(Y.sms_resp_pct)}`} h="Calls / texts" /><Card l="Conversations" v={num(F.conversations)} />
        <Card l="Handoffs YTD" v={num(U.handoffs)} h={`Call ${num(U.call)} · Text ${num(U.text)}`} /><Card l="Median wait for a human call" v={mins(U.median_min)} h="After handoff, YTD" />
        <Card l="Human call within 1 hour" v={pc(U.pct_1h)} h="Share of handoffs" /><Card l="Handoffs never called" v={num(U.never_called)} h="No human call yet, YTD (FUB)" /><Card l={`Closed ${data.year ?? ""}`} v={num(S.closed)} h={`${usd(S.closed_gci)} GCI · ${num(S.under_contract)} under contract (Sisu)`} /></div>
      <section className="section"><h2 className="serif">Felix by period</h2>
        <div className="tablewrap"><table><thead><tr><th>Period</th><th className="r">AI calls</th><th className="r">AI texts</th><th className="r">Handoffs</th><th className="r">Call response</th><th className="r">Text response</th></tr></thead>
          <tbody>{PER.map(([k, l]) => { const p = (F.periods ?? {})[k] ?? {}; return <tr key={k}><td>{l}</td><td className="r">{num(p.calls)}</td><td className="r">{num(p.sms)}</td><td className="r">{num(p.handoffs)}</td>
            <td className="r">{pc(p.call_resp_pct)}{ok(p.call_resp_n) ? ` · ${num(p.call_resp_n)}` : ""}</td><td className="r">{pc(p.sms_resp_pct)}{ok(p.sms_resp_n) ? ` · ${num(p.sms_resp_n)}` : ""}</td></tr>; })}</tbody></table></div>
        <p className="caption">Fello Reports, read from the Fello UI. Response = rate · leads responding.</p></section>
      <section className="section"><h2 className="serif">Monthly calls, texts and handoffs</h2><MonthlyBars rows={M} /></section>
      <section className="section"><h2 className="serif">Nurture and Living Database, last 30 days</h2>
        <div className="fa-cards ft-4">
          <Card l="Nurture engaged" v={num(F.nurture?.engaged)} h={`${pc(F.nurture?.engaged_pct)} of ${num(F.nurture?.engaged_of)}`} /><Card l="Nurture emails sent" v={num(F.nurture?.sent)} h={`${num(F.nurture?.opens)} opens · ${num(F.nurture?.clicks)} clicks`} />
          <Card l="Dashboard views / forms" v={`${num(F.nurture?.dashboard_views)} / ${num(F.nurture?.form_submissions)}`} h={`Nurture enrolled ${num(F.nurture?.enrolled)}`} /><Card l="Influenced pipeline" v={num(F.nurture?.influenced_pipeline)} h="Fello's count" />
          <Card l="Living Database contacts" v={num(F.living?.total_contacts)} h={`${num(F.living?.changes)} changes`} /><Card l="Moves" v={num(F.living?.moves)} />
          <Card l="Listed / sold" v={`${num(F.living?.listed)} / ${num(F.living?.sold)}`} /><Card l="Purchased" v={num(F.living?.purchased)} /></div></section>
      <section className="section"><h2 className="serif">From Felix's first touch to closing</h2>
        <div className="fl-funnel">{steps.map(([l, v, h], i) => <div className="fl-step" key={l}>
          <div className="fl-l"><b>{l}</b><span>{h}</span></div>
          <div className="fl-track"><i style={{ width: ok(v) ? `${Math.max(1.5, (100 * v) / mx)}%` : "0%" }} /></div>
          <div className="fl-v serif">{num(v)}{i > 1 && ok(v) && ok(steps[i - 1][1]) && steps[i - 1][1] ? <em>{Math.round((100 * v) / steps[i - 1][1])}% of prior</em> : null}</div></div>)}</div>
        <p className="caption">Enrolled and engaging are Fello's current snapshot; handoff through deals are FUB, YTD; contract and closing are Sisu. Sources count differently, so step rates are approximate.</p></section>
      <section className="section"><h2 className="serif">Median wait for a human call after a handoff</h2><WaitTrend rows={M} />
        <p className="caption">Minutes from FUB "Felix AI Handoff" to the first human call, by month. Gold line = 1 hour.</p></section>
      <section className="section"><h2 className="serif">Monthly</h2>
        <div className="tablewrap"><table><thead><tr><th>Month</th><th className="r">AI calls</th><th className="r">AI texts</th><th className="r">Handoffs</th><th className="r">Call / text</th><th className="r">Human called</th><th className="r">Median wait</th><th className="r">≤1 h</th><th className="r">Appt</th><th className="r">FUB deals created (any stage)</th></tr></thead>
          <tbody>{M.map((m) => <tr key={m.month}><td>{mlab(m.month)} {m.month.slice(0, 4)}{m.partial ? " (to date)" : ""}</td><td className="r">{num(m.calls)}</td><td className="r">{num(m.sms)}</td><td className="r">{num(m.fub_handoffs)}</td>
            <td className="r">{num(m.call)} / {num(m.text)}</td><td className="r">{num(m.human_called)}</td><td className="r">{mins(m.median_min)}</td><td className="r">{pc(m.pct_1h)}</td><td className="r">{num(m.appts)}</td><td className="r">{num(m.deals)}</td></tr>)}</tbody></table></div>
        <p className="caption">Calls and texts: Fello. Handoffs and later steps: FUB. {F.reconciliation_note ?? ""}</p></section>
      <section className="section"><h2 className="serif">Data notes</h2><ul className="fl-notes">
        <li>Felix figures: {F.source ?? "—"}, as of {asof(F.as_of)}. Fello's public API has no activity endpoints, so numbers are read from the Fello UI.</li>
        <li>Handoff follow-up (human call, wait, appointment, FUB deals): FUB Manager, "Felix AI Handoff" events, as of {asof(U.as_of)} CT.</li>
        <li>Under contract, closings, volume and GCI: Sisu, live from the daily tracker build.</li>
        {F.reconciliation_note ? <li>{F.reconciliation_note}</li> : null}
        <li>Not available (shown —): weekly Felix activity, per-campaign results, per-agent handoff credit, conversation counts.</li></ul></section>
      <section className="section"><h2 className="serif">Weekly, campaigns, conversations</h2>
        <table><tbody><tr><td>Weekly Felix numbers</td><td className="r">{F.weekly ? "see Fello" : "—"}</td></tr><tr><td>Handoffs by campaign</td><td className="r">{F.per_campaign ? Object.entries(F.per_campaign).map(([k, v]) => `${k} ${num(v)}`).join(" · ") : "—"}</td></tr>
          <tr><td>Conversations</td><td className="r">{num(F.conversations)}</td></tr><tr><td>Per-agent handoffs</td><td className="r">{F.per_agent_handoffs ? "available" : "—"}</td></tr></tbody></table>
        <p className="caption">Not supplied by Fello yet (its API has no activity endpoints). Jesse Jones in FUB is the Fello AI dialer account. No contact details are shown on this page.</p></section>
    </div></div>;
}
