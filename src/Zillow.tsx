// Zillow tab v1: mirror of Kahla FUB Tableau Zillow Reporting (normalized staging schema).
// Sheet-based funnel/L40d/L6m removed. Top 10 teams reserved for Kahla Google Sheet only (null until present).
import { useMemo, useState } from "react";
import { useAgent, sameAgent, AgentBanner, usePersist } from "./agent";
import "./fubaudit.css";
import "./zillow.css";

type Rating = "High" | "Fair" | "Low" | null | undefined;
type TabId = "performance" | "team" | "funnel" | "agents" | "details" | "glossary" | "top10";

const TABS: { id: TabId; label: string }[] = [
  { id: "performance", label: "Performance" },
  { id: "team", label: "Team Details" },
  { id: "funnel", label: "Funnel" },
  { id: "agents", label: "Agent" },
  { id: "details", label: "Detail Reports" },
  { id: "glossary", label: "Glossary" },
  { id: "top10", label: "Top 10" },
];

const ok = (v: any) => typeof v === "number" && isFinite(v);
const num = (v: any) => (ok(v) ? Math.round(v).toLocaleString("en-US") : "—");
const num1 = (v: any) => (ok(v) ? (Math.round(v * 10) / 10).toLocaleString("en-US") : "—");
const pct = (v: any) => (ok(v) ? `${Math.round(v * 10) / 10}%` : "—");
const usd = (v: any) => (ok(v) ? "$" + Math.round(v).toLocaleString("en-US") : "—");
const isTableau = (d: any) => !!(d && (d.schema === "tableau-v1" || d._schema === "fub-tableau-normalized/v1" || d.performance));

function tipFor(metric: string, rating: Rating): string {
  const r = rating || "empty";
  const tips: Record<string, Record<string, string>> = {
    buyer: {
      High: "Strong buyer conversion — keep pickup speed and appointment asks consistent so the L6M bar stays above target.",
      Fair: "Buyer conversion is near the line. Focus on live-answer pickup and getting more appointments from connections this month.",
      Low: "Buyer conversion is below target. Prioritize same-day contact on new Preferred connections and tighten the appointment ask.",
      empty: "Buyer Connections data is not in this snapshot yet.",
    },
    zhl: {
      High: "ZHL pre-approvals are on track. Keep transferring eligible met-with buyers to the loan officer promptly.",
      Fair: "ZHL pre-approvals are short of the L3M target. Review eligible met-withs that have not transferred or pulled credit.",
      Low: "ZHL pre-approvals are below the bar. Coach transfers on every eligible met-with and clear stalled pre-approval files.",
      empty: "ZHL Pre-Approval data is not in this snapshot yet.",
    },
    seller: {
      High: "Seller conversion is strong — keep showcase and follow-through habits.",
      Fair: "Seller conversion needs attention — tighten listing conversations and showcase follow-up.",
      Low: "Seller conversion is below target — rebuild seller pipeline activity this month.",
      empty: "No data in Zillow Reporting yet — Seller Connections are blank in Tableau for this refresh.",
    },
    fub: {
      High: "FUB compliance is solid — keep logging activity the same way.",
      Fair: "A few FUB compliance gaps remain — clean up missing fields before month end.",
      Low: "FUB compliance is below target — fix open compliance items this week.",
      empty: "FUB Compliance is not in this snapshot.",
    },
    pay: {
      High: "Pay-on-time is fully met — keep invoice timing as-is.",
      Fair: "Some pay-on-time items are late — clear outstanding Zillow invoices.",
      Low: "Pay-on-time is below target — resolve overdue invoices immediately.",
      empty: "Pay on Time is not in this snapshot.",
    },
    docs: {
      High: "Closing docs are submitting on time — keep the TC handoff cadence.",
      Fair: "Closing doc submission is a bit short of target — push pending files through this week.",
      Low: "Closing docs are behind — clear the submission backlog before the next snapshot.",
      empty: "Closing Doc Submission is not in this snapshot.",
    },
    agent: {
      High: "Overall performance is High — protect volume and conversion; watch for overload if insights flag it.",
      Fair: "Overall performance is Fair — improve pickup rate and next-step asks so conversion climbs before the next snapshot.",
      Low: "Overall performance is Low — focus on first contact speed, appointments from connections, and ZHL transfers where eligible.",
      empty: "No overall performance rating for this agent in the L90D board.",
    },
  };
  return (tips[metric] || tips.agent)[r] || tips.agent.empty;
}

function tipFromInsights(insights: string | null | undefined, rating: Rating): string {
  const base = tipFor("agent", rating);
  if (!insights) return base;
  const i = insights.toLowerCase();
  if (i.includes("overload")) return `${base} Tableau insight: agent may be overloaded — consider redistributing new Preferred leads.`;
  if (i.includes("falling")) return `${base} Tableau insight: at risk of falling below target — tighten daily follow-up.`;
  if (i.includes("cvr") && i.includes("minimum")) return `${base} Tableau insight: CVR is below the minimum — coach appointment-to-offer conversion.`;
  if (i.includes("cvr")) return `${base} Tableau insight: CVR at risk — raise showing and offer activity on active buyers.`;
  if (i.includes("preapproval")) return `${base} Tableau insight: below pre-approval target — push eligible met-withs to ZHL.`;
  return `${base}${insights ? ` Tableau insight: ${insights}` : ""}`;
}

function fmtActual(m: any): string {
  if (!m) return "—";
  if (m.unit === "usd") return `${usd(m.actual)} / ${usd(m.target)}`;
  if (ok(m.actual) || ok(m.target)) return `${num(m.actual)} / ${num(m.target)}`;
  return "—";
}

function barPct(m: any): number {
  if (!m || !ok(m.target) || m.target === 0) return ok(m.attainment_pct) ? Math.min(100, m.attainment_pct) : 0;
  if (!ok(m.actual)) return 0;
  return Math.max(0, Math.min(120, (100 * m.actual) / m.target));
}

function MetricCard({ m, tipKey, emptyNote }: { m: any; tipKey: string; emptyNote?: string }) {
  const rating = (m?.rating as Rating) || null;
  const empty = !m || (!ok(m.attainment_pct) && !ok(m.actual) && !rating);
  if (empty) {
    return (
      <div className="zl-card rating-empty">
        <div className="zl-card-k">{m?.label || "Metric"}</div>
        <div className="zl-card-period">{m?.period ? `${m.period}${m.period_label ? ` · ${m.period_label}` : ""}` : "—"}</div>
        <div className="zl-card-v">—</div>
        <span className="zl-rating empty">No data</span>
        <div className="zl-tip">{emptyNote || tipFor(tipKey, null)}</div>
      </div>
    );
  }
  const rClass = rating || "empty";
  return (
    <div className={`zl-card rating-${rClass}`}>
      <div className="zl-card-k">{m.label}</div>
      <div className="zl-card-period">{m.period}{m.period_label ? ` · ${m.period_label}` : ""}</div>
      <div className="zl-card-v serif">{pct(m.attainment_pct)}{rating ? <small>{rating}</small> : null}</div>
      {rating ? <span className={`zl-rating ${rating}`}>{rating}</span> : <span className="zl-rating empty">Unrated</span>}
      <div className="zl-barwrap">
        <div className="zl-barlab"><span>Actual / target</span><span>{fmtActual(m)}</span></div>
        <div className={`zl-bar ${rClass}`}><i style={{ width: `${Math.min(100, barPct(m))}%` }} /></div>
      </div>
      <div className="zl-tip">{tipFor(tipKey, rating)}</div>
      {(ok(m.october_attainment_pct) || ok(m.l6m_attainment_pct) || ok(m.next_snapshot_attainment_pct) || ok(m.eligible_met_with)) && (
        <div className="zl-meta">
          {ok(m.october_attainment_pct) ? <>Oct attainment {pct(m.october_attainment_pct)}. </> : null}
          {ok(m.l6m_attainment_pct) ? <>L6M attainment {pct(m.l6m_attainment_pct)}. </> : null}
          {ok(m.next_snapshot_attainment_pct) ? <>Next snapshot {pct(m.next_snapshot_attainment_pct)}. </> : null}
          {ok(m.eligible_met_with) ? <>Eligible met-with {num(m.eligible_met_with)}{m.target_rule ? ` · target ${m.target_rule}` : ""}. </> : null}
          {ok(m.transactions_to_hit_target) ? <>Trx to hit target {num1(m.transactions_to_hit_target)}. </> : null}
          {ok(m.preapprovals_to_hit_target) ? <>Pre-approvals to hit target {num(m.preapprovals_to_hit_target)}. </> : null}
        </div>
      )}
    </div>
  );
}

function MonthBars({ bars, title }: { bars?: Record<string, number> | null; title: string }) {
  if (!bars || !Object.keys(bars).length) return null;
  const entries = Object.entries(bars);
  const mx = Math.max(1, ...entries.map(([, v]) => (ok(v) ? v : 0)));
  const W = 420, H = 110, P = 24, bw = (W - 2 * P) / entries.length;
  const Y = (v: number) => H - P - (v * (H - 2 * P)) / mx;
  return (
    <figure className="zl-chart" style={{ marginTop: 8 }}>
      <figcaption className="serif" style={{ fontSize: 15 }}>{title}</figcaption>
      <svg className="zl-mini" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title}>
        <line x1={P} x2={W - P} y1={H - P} y2={H - P} stroke="#D6D0C2" />
        {entries.map(([m, v], i) => {
          const x = P + i * bw;
          const h = ok(v) ? H - P - Y(v) : 0;
          return (
            <g key={m}>
              {ok(v) ? <rect x={x + bw * 0.15} y={Y(v)} width={bw * 0.7} height={h} fill={i === entries.length - 1 ? "#2E7D4F" : "#00519B"} /> : null}
              {ok(v) ? <text x={x + bw / 2} y={Y(v) - 3} textAnchor="middle" fontSize="10" fill="#12151C">{v}</text> : null}
              <text x={x + bw / 2} y={H - 8} textAnchor="middle" fontSize="11" fill="#6B6B6B">{m.slice(0, 3)}</text>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}


function Seg({ options, value, onChange }: { options: { id: string; label: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="seg ft-seg" style={{ margin: "8px 0 12px" }}>
      {options.map((o) => (
        <button key={o.id} type="button" className={value === o.id ? "on active" : ""} onClick={() => onChange(o.id)}>{o.label}</button>
      ))}
    </div>
  );
}

function FunnelViz({ stages }: { stages: { stage: string; value: number; pct_of_prev?: number | null }[] }) {
  const mx = Math.max(1, ...stages.map((s) => (ok(s.value) ? s.value : 0)));
  return (
    <div className="zl-funnel">
      {stages.map((s, i) => (
        <div className="zl-fstep" key={s.stage}>
          <div><b>{s.stage}</b>{i > 0 && ok(s.pct_of_prev) ? <div className="zl-meta">{pct(s.pct_of_prev)} of prior</div> : null}</div>
          <div className="tr"><i style={{ width: `${Math.max(2, (100 * (s.value || 0)) / mx)}%` }} /></div>
          <div className="serif" style={{ textAlign: "right", fontSize: 18 }}>{num(s.value)}</div>
        </div>
      ))}
    </div>
  );
}

function PerformanceTab({ data, agentRow }: { data: any; agentRow: any | null }) {
  const P = data.performance || {};
  const ops = P.ops_health || {};
  return (
    <>
      {agentRow ? (
        <div className="zl-myscore">
          <h2 className="serif">My score · {agentRow.agent}</h2>
          <div className="zl-sub">Last 90 Day Funnel Metrics (Tableau Agent board){data.agents?.period ? ` · ${data.agents.period}` : ""}</div>
          <div style={{ marginBottom: 10 }}>
            {agentRow.overall_performance ? <span className={`zl-rating ${agentRow.overall_performance}`}>{agentRow.overall_performance}</span> : <span className="zl-rating empty">Unrated</span>}
            {agentRow.zhl_preapproval_target_rating ? <span className={`zl-rating ${agentRow.zhl_preapproval_target_rating}`} style={{ marginLeft: 8 }}>ZHL {agentRow.zhl_preapproval_target_rating}</span> : null}
          </div>
          <div className="zl-myscore-grid">
            <div className="zl-stat"><div className="k">Pickup rate</div><div className="v serif">{pct(agentRow.pickup_rate_l90d)}</div></div>
            <div className="zl-stat"><div className="k">Buyer L90D</div><div className="v serif">{num(agentRow.total_buyer_l90d)}</div></div>
            <div className="zl-stat"><div className="k">Closed / pending</div><div className="v serif">{num(agentRow.total_closed_trx_l90d)} / {num(agentRow.pending_trx_l90d)}</div></div>
            <div className="zl-stat"><div className="k">Predicted CVR</div><div className="v serif">{pct(agentRow.predicted_cvr)}</div></div>
            <div className="zl-stat"><div className="k">Eligible met-with</div><div className="v serif">{num(agentRow.eligible_met_withs_l90d)}</div></div>
            <div className="zl-stat"><div className="k">Elig. pre-approvals</div><div className="v serif">{num(agentRow.eligible_preapprovals_l90d)}</div></div>
            <div className="zl-stat"><div className="k">ZHL target</div><div className="v serif">{num(agentRow.zhl_preapproval_target)}</div></div>
            <div className="zl-stat"><div className="k">Funded</div><div className="v serif">{num(agentRow.total_funded_l90d)}</div></div>
          </div>
          <div className={`zl-tip ${agentRow.overall_performance || ""}`}>{tipFromInsights(agentRow.insights, agentRow.overall_performance)}</div>
        </div>
      ) : null}

      <section className="section">
        <h2 className="serif">{agentRow ? "Team Performance (context)" : "Team Performance"}</h2>
        <p className="zl-cap">Windows in this pull: Buyer Connections <b>L6M</b>, ZHL Pre-Approval <b>L3M</b>, Ops Health MTD/L3M. Seller is blank in Tableau.</p>
        <div className="zl-grid cols-2" style={{ marginTop: 12 }}>
          <div>
            <MetricCard m={P.buyer_connections_l6m} tipKey="buyer" />
            <MonthBars bars={P.buyer_connections_l6m?.monthly_bars} title="Buyer connections · monthly logged trx" />
          </div>
          <div>
            <MetricCard m={P.zhl_preapproval_l3m} tipKey="zhl" />
            <MonthBars bars={P.zhl_preapproval_l3m?.monthly_bars} title="ZHL pre-approvals · monthly" />
          </div>
        </div>
        <div className="zl-grid cols-2" style={{ marginTop: 12 }}>
          <MetricCard m={P.seller_connections} tipKey="seller" emptyNote="No data in Zillow Reporting yet. Seller Connections are blank in Tableau for this refresh (no rating or target)." />
        </div>
      </section>

      <section className="section">
        <h2 className="serif">Ops Health</h2>
        <div className="zl-grid cols-3" style={{ marginTop: 12 }}>
          <MetricCard m={ops.fub_compliance_october} tipKey="fub" />
          <MetricCard m={ops.pay_on_time_l3m} tipKey="pay" />
          <MetricCard m={ops.closing_doc_submission_l3m} tipKey="docs" />
        </div>
      </section>
    </>
  );
}

function TeamDetailsTab({ data }: { data: any }) {
  const by = data.team_details?.by_category || {};
  const opts = [
    by.buyer_connections ? { id: "buyer_connections", label: "Buyer Connections" } : null,
    by.zhl ? { id: "zhl", label: "ZHL" } : null,
    by.seller_connections ? { id: "seller_connections", label: "Seller Connections" } : null,
    by.ops_health ? { id: "ops_health", label: "Ops Health" } : null,
  ].filter(Boolean) as { id: string; label: string }[];
  const [cat, setCat] = usePersist<string>("ztd", opts[0]?.id || "buyer_connections");
  const active = opts.some((o) => o.id === cat) ? cat : (opts[0]?.id || "buyer_connections");
  const block = by[active];
  if (!opts.length || !block) {
    return <div className="zl-banner">Team Details not in this snapshot.</div>;
  }
  return (
    <section className="section">
      <h2 className="serif">Team Details</h2>
      <p className="zl-cap">Performance Category · windows available in this pull (Buyer L6M, ZHL L6M/L3M, Seller blank, Ops monthly).</p>
      <Seg options={opts} value={active} onChange={setCat} />
      {active === "buyer_connections" ? <TeamBuyer block={block} /> : null}
      {active === "zhl" ? <TeamZhl block={block} /> : null}
      {active === "seller_connections" ? (
        <div className="zl-banner"><b>No data in Zillow Reporting yet.</b> Seller Connections are blank in Tableau for this refresh.
          {block.row_labels?.length ? <div className="zl-meta" style={{ marginTop: 8 }}>Row labels: {block.row_labels.join(" · ")}</div> : null}
        </div>
      ) : null}
      {active === "ops_health" ? <TeamOps block={block} /> : null}
    </section>
  );
}

function TeamBuyer({ block }: { block: any }) {
  const rows = block.by_month || [];
  return (
    <>
      <p className="zl-cap">Filter: {block.date_window || "Last 6 months"}.</p>
      <div className="tablewrap" style={{ marginTop: 12 }}>
        <table className="zl-table">
          <thead>
            <tr>
              <th>Month</th>
              <th className="r">Logged trx</th>
              <th className="r">Target</th>
              <th className="r">% to target</th>
              <th className="r">Cancelled</th>
              <th className="r">L6M logged</th>
              <th className="r">L6M target</th>
              <th className="r">L6M %</th>
              <th className="r">Needed</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r: any) => (
              <tr key={r.month}>
                <td>{r.month} {r.year || ""}</td>
                <td className="r">{num(r["Monthly Logged Trx"])}</td>
                <td className="r">{num1(r["Monthly Trx Target Real"])}</td>
                <td className="r">{r["Monthly TRX % to Target"] ?? "—"}</td>
                <td className="r">{num(r["Cancelled Trx"])}</td>
                <td className="r">{num(r["L6M Logged Trx"])}</td>
                <td className="r">{num(r["L6M Trx Target"])}</td>
                <td className="r">{r["L6M % to Trx Target"] ?? "—"}</td>
                <td className="r">{num(r["Trx Needed to Achieve 100% A.."])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <MonthBars
        bars={Object.fromEntries((block.series?.monthly_logged_trx || []).map((x: any) => [x.month, x.value]))}
        title="Monthly logged transactions"
      />
    </>
  );
}

function TeamZhl({ block }: { block: any }) {
  const windows = block.performance_managed_by_window || [];
  const months = block.supporting_by_month || [];
  return (
    <>
      <p className="zl-cap">{block.performance_managed_note || "ZHL · Last 6 months"}. {block.caveat ? `Caveat: ${block.caveat}` : ""}</p>
      <h3 className="serif" style={{ fontSize: 18, marginTop: 12 }}>L3M performance-managed</h3>
      <div className="tablewrap">
        <table className="zl-table">
          <thead>
            <tr>
              <th>Window</th>
              <th className="r">Elig. met-with</th>
              <th className="r">Elig. pre-approvals</th>
              <th className="r">Target</th>
              <th className="r">Needed</th>
              <th>Rating</th>
            </tr>
          </thead>
          <tbody>
            {windows.map((r: any) => (
              <tr key={r.window}>
                <td>{r.window}</td>
                <td className="r">{num(r["L3M Total Eligible Met with Cxns"])}</td>
                <td className="r">{num(r["L3M Total Eligible ZHL Pre-Approvals"])}</td>
                <td className="r">{num(r["L3M ZHL Pre-Approval Targets"])}</td>
                <td className="r">{num(r["L3M ZHL Pre-Approval(s) Needed to Reach Target"])}</td>
                <td>{r["L3M ZHL-Pre-Approval Target Rating"] ? <span className={`zl-pill ${r["L3M ZHL-Pre-Approval Target Rating"]}`}>{r["L3M ZHL-Pre-Approval Target Rating"]}</span> : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h3 className="serif" style={{ fontSize: 18, marginTop: 16 }}>Supporting metrics by month</h3>
      <div className="tablewrap">
        <table className="zl-table">
          <thead>
            <tr>
              <th>Month</th>
              <th className="r">Buyer cxns</th>
              <th className="r">Transfer rate</th>
              <th className="r">Elig. met-with</th>
              <th className="r">Elig. PA</th>
              <th className="r">PA target</th>
              <th className="r">Credit pulls</th>
              <th className="r">Pre-approvals</th>
              <th className="r">Locks</th>
              <th className="r">Funded</th>
            </tr>
          </thead>
          <tbody>
            {months.map((r: any) => (
              <tr key={r.month}>
                <td>{r.month}</td>
                <td className="r">{num(r["Total Buyer Connections"])}</td>
                <td className="r">{r["Overall Transfer Rate"] ?? "—"}</td>
                <td className="r">{num(r["Total Eligible Met with Cxns"])}</td>
                <td className="r">{num(r["Total Eligible ZHL Pre-Approvals"])}</td>
                <td className="r">{num(r["ZHL Pre-Approval Target"])}</td>
                <td className="r">{num(r["Total ZHL Credit Pulls"])}</td>
                <td className="r">{num(r["Total ZHL Pre-Approvals"])}</td>
                <td className="r">{num(r["Total ZHL Locks"])}</td>
                <td className="r">{num(r["Total ZHL Funded Loans"])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <MonthBars bars={block.chart_l3m_eligible_preapprovals} title="L3M eligible pre-approvals" />
    </>
  );
}

function TeamOps({ block }: { block: any }) {
  const rows = block.by_month || [];
  return (
    <>
      <p className="zl-cap">Ops Health · {block.date_window || "Last 6 months"}.{block.caveat ? ` ${block.caveat}` : ""}</p>
      <div className="tablewrap" style={{ marginTop: 12 }}>
        <table className="zl-table">
          <thead>
            <tr>
              <th>Month</th>
              <th className="r">FUB Partner Compliance</th>
              <th className="r">Ops L3M Pay on Time</th>
              <th className="r">Ops Closing Doc</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r: any) => (
              <tr key={r.month}>
                <td>{r.month}</td>
                <td className="r">{r["FUB Partner Compliance"] ?? "—"}</td>
                <td className="r">{r["Ops L3M Pay on Time"] ?? "—"}</td>
                <td className="r">{r["Ops Closing Doc"] ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function FunnelTab({ data }: { data: any }) {
  const by = data.funnel?.by_category || {};
  const opts = [
    by.buyer_connections ? { id: "buyer_connections", label: "Buyer Connections" } : null,
    by.zhl ? { id: "zhl", label: "ZHL" } : null,
    by.seller ? { id: "seller", label: "Seller Connections" } : null,
  ].filter(Boolean) as { id: string; label: string }[];
  const [cat, setCat] = usePersist<string>("zfn", opts[0]?.id || "buyer_connections");
  const active = opts.some((o) => o.id === cat) ? cat : (opts[0]?.id || "buyer_connections");
  const block = by[active];
  if (!block) return <div className="zl-banner">Funnel data not in this snapshot.</div>;

  if (active === "seller") {
    return (
      <section className="section">
        <h2 className="serif">Funnel</h2>
        <Seg options={opts} value={active} onChange={setCat} />
        <div className="zl-banner"><b>No data in Zillow Reporting yet.</b> The Seller Connections funnel is blank in Tableau for this refresh.
          {block.stages?.length ? <div className="zl-meta" style={{ marginTop: 8 }}>Stages: {block.stages.map((s: any) => s.stage).join(" → ")}</div> : null}
        </div>
      </section>
    );
  }

  const table = block.table_2026;
  const months = (table?.months || []).filter((m: string) => m !== "Grand Total");
  return (
    <section className="section">
      <h2 className="serif">Funnel · {active === "zhl" ? "ZHL" : "Buyer Connections"}</h2>
      <Seg options={opts} value={active} onChange={setCat} />
      <p className="zl-cap">
        {block.date_window || "Last 6 months"} · Agent {block.agent_name || "(All)"}.
      </p>
      <div style={{ marginTop: 12 }}><FunnelViz stages={block.stages || []} /></div>
      {block.donut_pct_of_live_cxs ? (
        <p className="zl-cap">Share of live connections: {Object.entries(block.donut_pct_of_live_cxs).map(([k, v]) => `${k} ${pct(v)}`).join(" · ")}</p>
      ) : null}
      {table ? (
        <div className="tablewrap" style={{ marginTop: 16 }}>
          <table className="zl-table">
            <thead>
              <tr>
                <th>Metric</th>
                {table.months.map((m: string) => <th key={m} className="r">{m}</th>)}
              </tr>
            </thead>
            <tbody>
              {(table.metrics || []).map((metric: string) => (
                <tr key={metric}>
                  <td>{metric}</td>
                  {table.by_month.map((r: any) => <td key={r.month} className="r">{num(r[metric])}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {active === "zhl" && block.opportunities?.rows?.length ? (
        <>
          <h3 className="serif" style={{ fontSize: 18, marginTop: 16 }}>ZHL opportunities (agent counts)</h3>
          <p className="zl-cap">{block.opportunities.rows.length} agents · counts only, no consumer details.{block.opportunities.rows_complete === false ? " Roster incomplete in this pull." : ""}</p>
          <OppsCheck o={block.opportunities} />
          <div className="tablewrap">
            <table className="zl-table">
              <thead>
                <tr>
                  <th>Agent</th>
                  <th className="r">Elig. PA</th>
                  <th className="r">Not transferred</th>
                  <th className="r">Not engaged</th>
                  <th className="r">Engaged no CP</th>
                  <th className="r">CP not PA</th>
                  <th className="r">PA not locked</th>
                  <th className="r">Locked not funded</th>
                  <th className="r">Funded</th>
                </tr>
              </thead>
              <tbody>
                {(block.opportunities.grand_total ? [block.opportunities.grand_total, ...block.opportunities.rows] : block.opportunities.rows).map((r: any) => (
                  <tr key={r.agent} style={r.agent === "Grand Total" ? { fontWeight: 600 } : undefined}>
                    <td>{r.agent}</td>
                    <td className="r">{num(r.eligible_preapprovals)}</td>
                    <td className="r">{num(r.eligible_transfers_not_transferred)}</td>
                    <td className="r">{num(r.transfers_not_engaged)}</td>
                    <td className="r">{num(r.engaged_transfers_no_credit_pulls)}</td>
                    <td className="r">{num(r.credit_pulls_not_preapproved)}</td>
                    <td className="r">{num(r.preapproved_not_locked)}</td>
                    <td className="r">{num(r.locked_loans_not_funded)}</td>
                    <td className="r">{num(r.funded_loans)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
      {months.length ? <p className="zl-cap">Monthly columns {months[0]}–{months[months.length - 1]} plus Grand Total.</p> : null}
    </section>
  );
}

const OPP_LABEL: Record<string, string> = {
  eligible_preapprovals: "Elig. PA", eligible_transfers_not_transferred: "Not transferred", transfers_not_engaged: "Not engaged",
  engaged_transfers_no_credit_pulls: "Engaged no CP", credit_pulls_not_preapproved: "CP not PA", preapproved_not_locked: "PA not locked",
  locked_loans_not_funded: "Locked not funded", funded_loans: "Funded",
};

// Agent rows vs Tableau grand total, per column. Shows any gap and the blank cell(s) it can sit in; never fills a value.
function OppsCheck({ o }: { o: any }) {
  const rows: any[] = o.rows || [];
  const gt = o.grand_total || {};
  const gaps = Object.keys(OPP_LABEL)
    .filter((k) => ok(gt[k]))
    .map((k) => ({ k, sum: rows.reduce((t, r) => t + (ok(r[k]) ? r[k] : 0), 0), total: gt[k] }))
    .filter((g) => g.sum !== g.total);
  if (!gaps.length) return <p className="zl-cap">Agent rows reconcile to the Tableau grand total in every column.</p>;
  const unres: any[] = o.unresolved_cells || [];
  return (
    <div className="zl-banner" style={{ margin: "8px 0" }}>
      {gaps.map((g) => (
        <div key={g.k}>
          <b>{OPP_LABEL[g.k]}:</b> agent rows sum to {num(g.sum)}; Tableau grand total is {num(g.total)}. Grand total shown as Tableau reports it.
          {unres.filter((u) => u.column === g.k).map((u) => (
            <span key={u.agent}> Unresolved cell: {u.agent} (blank in the pull; {u.likely ? "sort order suggests it is the missing count" : "not visible in captured screenshots"}).</span>
          ))}
        </div>
      ))}
    </div>
  );
}

function AgentsTab({ data, focus }: { data: any; focus: string | null }) {
  const rows: any[] = data.agents?.agents || [];
  const gt = data.agents?.grand_total || {};
  const byCat = data.agents?.by_metric_category || {};
  const opts = [
    { id: "summary", label: "Summary" },
    byCat.buyer_connections ? { id: "buyer_connections", label: "Buyer" } : null,
    byCat.zhl ? { id: "zhl", label: "ZHL" } : null,
    byCat.seller_connections ? { id: "seller_connections", label: "Seller" } : null,
  ].filter(Boolean) as { id: string; label: string }[];
  const [cat, setCat] = usePersist<string>("zag", "summary");
  const active = opts.some((o) => o.id === cat) ? cat : "summary";
  const sorted = useMemo(() => {
    const order = { High: 0, Fair: 1, Low: 2 } as Record<string, number>;
    return [...rows].sort((a, b) => {
      const ra = order[a.overall_performance] ?? 9;
      const rb = order[b.overall_performance] ?? 9;
      if (ra !== rb) return ra - rb;
      return (b.predicted_cvr ?? -1) - (a.predicted_cvr ?? -1);
    });
  }, [rows]);

  return (
    <section className="section">
      <h2 className="serif">Agent board</h2>
      <Seg options={opts} value={active} onChange={setCat} />
      {active === "summary" ? (
        <>
          <p className="zl-cap">
            {data.agents?.period || "Last 90 Day Funnel Metrics"}.
            {data.agents?.rows_complete === false ? " Roster may be partial." : ""}
            {focus ? ` Highlighting ${focus}.` : " Use the top Agent picker for my-score on Performance."}
          </p>
          <div className="zl-myscore-grid" style={{ margin: "12px 0" }}>
            <div className="zl-stat"><div className="k">Team buyer L90D</div><div className="v serif">{num(gt.total_buyer_l90d)}</div></div>
            <div className="zl-stat"><div className="k">Eligible met-with</div><div className="v serif">{num(gt.eligible_met_withs_l90d)}</div></div>
            <div className="zl-stat"><div className="k">Closed / pending</div><div className="v serif">{num(gt.total_closed_trx_l90d)} / {num(gt.pending_trx_l90d)}</div></div>
            <div className="zl-stat"><div className="k">Funded</div><div className="v serif">{num(gt.total_funded_l90d)}</div></div>
          </div>
          <div className="tablewrap">
            <table className="zl-table">
              <thead>
                <tr>
                  <th>Agent</th>
                  <th>Overall</th>
                  <th>ZHL</th>
                  <th className="r">Pickup</th>
                  <th className="r">Buyer</th>
                  <th className="r">Met-with</th>
                  <th className="r">Pre-appr</th>
                  <th className="r">Closed</th>
                  <th className="r">Pending</th>
                  <th className="r">Funded</th>
                  <th className="r">Pred. CVR</th>
                  <th>Insights</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((a) => {
                  const on = focus && sameAgent(a.agent, focus);
                  return (
                    <tr key={a.agent} style={on ? { background: "#EAF2FA" } : undefined}>
                      <td>{a.agent}</td>
                      <td>{a.overall_performance ? <span className={`zl-pill ${a.overall_performance}`}>{a.overall_performance}</span> : "—"}</td>
                      <td>{a.zhl_preapproval_target_rating ? <span className={`zl-pill ${a.zhl_preapproval_target_rating}`}>{a.zhl_preapproval_target_rating}</span> : "—"}</td>
                      <td className="r">{pct(a.pickup_rate_l90d)}</td>
                      <td className="r">{num(a.total_buyer_l90d)}</td>
                      <td className="r">{num(a.eligible_met_withs_l90d)}</td>
                      <td className="r">{num(a.eligible_preapprovals_l90d)}</td>
                      <td className="r">{num(a.total_closed_trx_l90d)}</td>
                      <td className="r">{num(a.pending_trx_l90d)}</td>
                      <td className="r">{num(a.total_funded_l90d)}</td>
                      <td className="r">{pct(a.predicted_cvr)}</td>
                      <td style={{ whiteSpace: "normal", minWidth: 140, maxWidth: 220 }}>{a.insights || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
      {active === "buyer_connections" ? <AgentBuyerBoard block={byCat.buyer_connections} focus={focus} /> : null}
      {active === "zhl" ? <AgentZhlBoard block={byCat.zhl} focus={focus} /> : null}
      {active === "seller_connections" ? (
        <div className="zl-banner"><b>No data in Zillow Reporting yet.</b> Seller Connections are blank for every agent in Tableau (0 offered / 0 failed live transfers; all other columns empty).</div>
      ) : null}
    </section>
  );
}

function AgentBuyerBoard({ block, focus }: { block: any; focus: string | null }) {
  if (!block) return null;
  const g = block.grand_total || {};
  const rows: any[] = block.rows || [];
  return (
    <>
      <p className="zl-cap">{block.date_window || "Last 3 months"} · {rows.length} agents · {block.column_sum_check || ""}.</p>
      <div className="zl-myscore-grid" style={{ margin: "12px 0" }}>
        <div className="zl-stat"><div className="k">Buyer cxns</div><div className="v serif">{num(g.buyer_connections)}</div></div>
        <div className="zl-stat"><div className="k">Pickup rate</div><div className="v serif">{pct(g.pickup_rate)}</div></div>
        <div className="zl-stat"><div className="k">Appt rate</div><div className="v serif">{pct(g.appointment_rate)}</div></div>
        <div className="zl-stat"><div className="k">Raw CVR</div><div className="v serif">{pct(g.raw_cvr)}</div></div>
      </div>
      <div className="tablewrap">
        <table className="zl-table">
          <thead>
            <tr>
              <th>Agent</th>
              <th className="r">Pickups</th>
              <th className="r">Pickup %</th>
              <th className="r">Buyer</th>
              <th className="r">Appts</th>
              <th className="r">Appt %</th>
              <th className="r">Met</th>
              <th className="r">Offers</th>
              <th className="r">Pend+Closed</th>
              <th className="r">Raw CVR</th>
              <th className="r">Pred. CVR</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a: any) => (
              <tr key={a.agent} style={focus && sameAgent(a.agent, focus) ? { background: "#EAF2FA" } : undefined}>
                <td>{a.agent}</td>
                <td className="r">{num(a.pickups)}</td>
                <td className="r">{pct(a.pickup_rate)}</td>
                <td className="r">{num(a.buyer_connections)}</td>
                <td className="r">{num(a.appointments)}</td>
                <td className="r">{pct(a.appointment_rate)}</td>
                <td className="r">{num(a.meetings)}</td>
                <td className="r">{num(a.offers)}</td>
                <td className="r">{num(a.buyer_pending_closed)}</td>
                <td className="r">{pct(a.raw_cvr)}</td>
                <td className="r">{pct(a.avg_predicted_cvr)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function AgentZhlBoard({ block, focus }: { block: any; focus: string | null }) {
  if (!block) return null;
  const g = block.grand_total || {};
  const rows: any[] = block.rows || [];
  return (
    <>
      <p className="zl-cap">{block.date_window || "Last 3 months"} · {rows.length} agents · {block.column_sum_check || ""}.</p>
      <div className="zl-myscore-grid" style={{ margin: "12px 0" }}>
        <div className="zl-stat"><div className="k">Preferred buyer</div><div className="v serif">{num(g.preferred_buyer_connections)}</div></div>
        <div className="zl-stat"><div className="k">Transfers</div><div className="v serif">{num(g.total_transfers)}</div></div>
        <div className="zl-stat"><div className="k">Transfer rate</div><div className="v serif">{pct(g.overall_transfer_rate)}</div></div>
        <div className="zl-stat"><div className="k">Pre-approvals</div><div className="v serif">{num(g.preapprovals)}</div></div>
      </div>
      <div className="tablewrap">
        <table className="zl-table">
          <thead>
            <tr>
              <th>Agent</th>
              <th>PA rating</th>
              <th className="r">Preferred</th>
              <th className="r">Elig. met</th>
              <th className="r">Transfers</th>
              <th className="r">Xfer %</th>
              <th className="r">Connected LO</th>
              <th className="r">Credit pulls</th>
              <th className="r">Pre-appr</th>
              <th className="r">Target</th>
              <th className="r">Funded</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a: any) => (
              <tr key={a.agent} style={focus && sameAgent(a.agent, focus) ? { background: "#EAF2FA" } : undefined}>
                <td>{a.agent}</td>
                <td>{a.preapproval_rating ? <span className={`zl-pill ${a.preapproval_rating}`}>{a.preapproval_rating}</span> : "—"}</td>
                <td className="r">{num(a.preferred_buyer_connections)}</td>
                <td className="r">{num(a.eligible_met_with_connections)}</td>
                <td className="r">{num(a.zhl_total_transfers)}</td>
                <td className="r">{pct(a.overall_transfer_rate)}</td>
                <td className="r">{num(a.connected_with_lo)}</td>
                <td className="r">{num(a.credit_pulls)}</td>
                <td className="r">{num(a.zhl_preapprovals)}</td>
                <td className="r">{num(a.preapproval_target_monthly)}</td>
                <td className="r">{num(a.funded_loans)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function DetailsTab({ data }: { data: any }) {
  const d = data.detail_reports || {};
  const a = d.aggregates || {};
  const views = d.views || {};
  const zhl = a.zhl_status || views["ZHL Status"]?.aggregates || {};
  const review = a.transactions_for_review || views["Transactions for Review"]?.aggregates || {};
  const credit = a.transaction_target_credit || views["Transaction Target Credit"]?.aggregates || {};
  const alloc = views["Connection Allocation"];
  const rtt = views["RTT Performance"];
  if (d.not_captured || (!Object.keys(a).length && !Object.keys(views).length)) {
    return (
      <section className="section">
        <h2 className="serif">Detail Reports</h2>
        <div className="zl-banner" style={{ marginTop: 8 }}>
          <b>No data in Zillow Reporting yet for this mirror.</b> Detail Reports were not pulled for this refresh because those views list contact names; only team and agent totals are mirrored.
        </div>
      </section>
    );
  }
  return (
    <section className="section">
      <h2 className="serif">Detail Reports</h2>
      <div className="zl-banner" style={{ marginTop: 8 }}>
        <b>Aggregates only where views contain lead/contact PII.</b> Dropdown options: {(d.detail_dropdown_options || []).join(" · ") || "—"}.
      </div>
      <h3 className="serif" style={{ fontSize: 18, marginTop: 16 }}>Transaction Details</h3>
      <div className="zl-grid cols-2" style={{ marginTop: 8 }}>
        <div className="zl-card">
          <div className="zl-card-k">Pending &amp; closed transactions</div>
          <div className="zl-card-v serif">{num(a.pending_and_closed_transactions)}</div>
        </div>
        <div className="zl-card">
          <div className="zl-card-k">Total transaction price</div>
          <div className="zl-card-v serif">{usd(a.total_transaction_price_usd)}</div>
        </div>
      </div>
      <h3 className="serif" style={{ fontSize: 18, marginTop: 16 }}>ZHL Status (aggregates)</h3>
      <div className="zl-grid cols-3" style={{ marginTop: 8 }}>
        {Object.entries(zhl).map(([k, v]) => (
          <div className="zl-card" key={k}>
            <div className="zl-card-k">{k}</div>
            <div className="zl-card-v serif">{num(v as any)}</div>
          </div>
        ))}
        {!Object.keys(zhl).length ? <div className="zl-empty">No ZHL Status aggregates in this snapshot.</div> : null}
      </div>
      <h3 className="serif" style={{ fontSize: 18, marginTop: 16 }}>Transactions for Review / Target Credit</h3>
      <div className="zl-grid cols-3" style={{ marginTop: 8 }}>
        {Object.entries(review).map(([k, v]) => (
          <div className="zl-card" key={k}>
            <div className="zl-card-k">{k}</div>
            <div className="zl-card-v serif">{v == null ? "—" : num(v as any)}</div>
          </div>
        ))}
        {Object.entries(credit).map(([k, v]) => (
          <div className="zl-card" key={"c-" + k}>
            <div className="zl-card-k">{k}</div>
            <div className="zl-card-v serif">{v == null ? "—" : num(v as any)}</div>
          </div>
        ))}
      </div>
      {alloc?.rows?.length ? (
        <>
          <h3 className="serif" style={{ fontSize: 18, marginTop: 16 }}>Connection Allocation</h3>
          <p className="zl-cap">Total allocation {num(alloc.aggregates?.total_allocation)} · {num(alloc.rows.length)} zip rows (no lead PII).</p>
          <div className="tablewrap">
            <table className="zl-table">
              <thead><tr><th>Zip</th><th>City</th><th>County</th><th className="r">Allocation</th><th className="r">Agents</th><th className="r">Cxns/agent</th></tr></thead>
              <tbody>
                {alloc.rows.slice(0, 40).map((r: any) => (
                  <tr key={r.zip}><td>{r.zip}</td><td>{r.city}</td><td>{r.county}</td><td className="r">{num1(r.allocation)}</td><td className="r">{num(r.agent_count)}</td><td className="r">{num1(r.cxns_per_agent)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          {alloc.rows.length > 40 ? <p className="zl-cap">Showing first 40 of {alloc.rows.length} zips.</p> : null}
        </>
      ) : null}
      {rtt?.team_by_month?.length ? (
        <>
          <h3 className="serif" style={{ fontSize: 18, marginTop: 16 }}>RTT Performance (team)</h3>
          <div className="tablewrap">
            <table className="zl-table">
              <thead>
                <tr>
                  <th>Month</th>
                  <th className="r">Connection attempts</th>
                  <th className="r">RTT connections</th>
                  <th className="r">Accept rate</th>
                  <th className="r">Met rate</th>
                  <th className="r">Show rate</th>
                  <th className="r">Trx</th>
                </tr>
              </thead>
              <tbody>
                {rtt.team_by_month.map((r: any) => (
                  <tr key={r.month}>
                    <td>{r.month}</td>
                    <td className="r">{num(r["Team Connection Attempts"])}</td>
                    <td className="r">{num(r["RTT Connections"])}</td>
                    <td className="r">{r["Team Accept Rate"] ?? "—"}</td>
                    <td className="r">{r["RTT Met Rate"] ?? "—"}</td>
                    <td className="r">{r["RTT Show Rate"] ?? "—"}</td>
                    <td className="r">{num(r["RTT Transactions"])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
      {(views["Lost Listings"]?.empty || views["Team Listings Showcased"]?.empty) ? (
        <p className="zl-cap" style={{ marginTop: 12 }}>Lost Listings and Team Listings Showcased are empty in Tableau for this refresh.</p>
      ) : null}
    </section>
  );
}

function GlossaryTab({ data }: { data: any }) {
  const g = data.glossary || {};
  const terms: any[] = g.terms || [];
  const [q, setQ] = useState("");
  const filtered = !q ? terms : terms.filter((t) => `${t.metric_name} ${t.metric_category} ${t.definition}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <section className="section">
      <h2 className="serif">Glossary</h2>
      <p className="zl-cap">
        {g.partial ? `Partial capture through “${g.captured_through || "—"}”.` : `Full glossary · ${g.term_count || terms.length} terms.`}
      </p>
      <label className="agentsel" style={{ margin: "8px 0 12px", maxWidth: 420 }}>
        <span>Filter</span>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search metrics…" style={{ flex: 1, minHeight: 40, padding: "8px 10px", border: "1px solid #D6D0C2", borderRadius: 4 }} />
      </label>
      <div className="zl-gloss" style={{ marginTop: 12 }}>
        {filtered.map((t) => (
          <div className="zl-gloss-item" key={t.metric_name}>
            <b>{t.metric_name}</b>
            {t.metric_category ? <div className="cat">{t.metric_category}</div> : null}
            <p>{t.definition || "—"}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Top10Tab({ data }: { data: any }) {
  if (data.top10_teams) {
    return (
      <section className="section">
        <h2 className="serif">Top 10 teams</h2>
        <p className="zl-cap">From Kahla Google Sheet only (not Tableau).</p>
        <pre style={{ fontSize: 12, overflow: "auto" }}>{JSON.stringify(data.top10_teams, null, 2)}</pre>
      </section>
    );
  }
  return (
    <section className="section">
      <h2 className="serif">Top 10 teams</h2>
      <div className="zl-banner" style={{ marginTop: 8 }}>
        <b>No data in Zillow Reporting yet.</b> Top 10 teams come only from Kahla's Google Sheet, and that sheet has no rankings block yet. This section fills in once it does.
      </div>
    </section>
  );
}

export default function Zillow({ data }: { data?: any }) {
  const { agent } = useAgent();
  const [tab, setTab] = usePersist<TabId>("zt", "performance");
  if (!data) {
    return <div className="gatecard"><h1 className="serif">Zillow</h1><p className="rule" /><p>— Not in this snapshot yet. It loads with the next pipeline run.</p></div>;
  }
  if (!isTableau(data)) {
    return (
      <div className="fubaudit page zillow">
        <div className="asof">Snapshot format outdated</div>
        <h1 className="page-title serif">Zillow Preferred</h1>
        <div className="page-body">
          <div className="zl-banner">
            This snapshot is still the old Zillow Preferred <b>sheet</b> payload. The site now expects Kahla FUB Tableau data (schema tableau-v1). Re-run the metrics pipeline after the Tableau normalize is wired into <code>zillow_build.py</code>, or open preview with the updated <code>preview-zillow.json</code>.
          </div>
        </div>
      </div>
    );
  }

  const agentList: any[] = data.agents?.agents || [];
  const agentRow = agent ? agentList.find((a) => sameAgent(a.agent, agent)) : null;
  const refresh = data.last_refresh_label || data.last_refresh || "—";

  return (
    <div className="fubaudit page zillow">
      <div className="asof">Zillow Reporting mirror</div>
      <h1 className="page-title serif">Zillow Preferred</h1>
      <p className="zl-source">Last Tableau refresh {refresh} · mirrored from Kahla FUB Zillow Reporting{data.pulled_at ? ` · pulled ${data.pulled_at}` : ""}</p>
      <div className="page-body">
        {agent ? <AgentBanner note={agentRow ? "My-score from Tableau Agent board (L90D)" : "No row for this agent on the Tableau Agent board in this pull"} /> : null}
        <div className="zl-tabs" role="tablist" aria-label="Zillow Reporting sections">
          {TABS.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={tab === t.id ? "on" : ""} onClick={() => setTab(t.id)}>{t.label}</button>
          ))}
        </div>
        {tab === "performance" ? <PerformanceTab data={data} agentRow={agentRow} /> : null}
        {tab === "team" ? <TeamDetailsTab data={data} /> : null}
        {tab === "funnel" ? <FunnelTab data={data} /> : null}
        {tab === "agents" ? <AgentsTab data={data} focus={agent} /> : null}
        {tab === "details" ? <DetailsTab data={data} /> : null}
        {tab === "glossary" ? <GlossaryTab data={data} /> : null}
        {tab === "top10" ? <Top10Tab data={data} /> : null}
      </div>
    </div>
  );
}
