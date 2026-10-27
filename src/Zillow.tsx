// Zillow tab v1: mirror of Kahla FUB Tableau Zillow Reporting (normalized staging schema).
// Sheet-based funnel/L40d/L6m removed. Top 10 teams reserved for Kahla Google Sheet only (null until present).
import { useMemo } from "react";
import { useAgent, sameAgent, AgentBanner, usePersist } from "./agent";
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
      empty: "Seller Connections are blank in Tableau for this refresh — nothing to coach on yet.",
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
          <MetricCard m={P.seller_connections} tipKey="seller" emptyNote="Seller Connections are blank in this Tableau refresh — no rating or targets to show." />
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
  const cat = data.team_details?.by_category?.buyer_connections;
  if (!cat) {
    return <div className="zl-banner">Team Details for other Performance Categories were not captured in this pull. Only Buyer Connections · Last 6 months is available.</div>;
  }
  const rows = cat.by_month || [];
  return (
    <section className="section">
      <h2 className="serif">Team Details · Buyer Connections</h2>
      <p className="zl-cap">Filter in pull: {cat.date_window || "Last 6 months"}. Other Performance Category toggles (ZHL / Seller / Ops) are not in this snapshot yet.</p>
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
        bars={Object.fromEntries((cat.series?.monthly_logged_trx || []).map((x: any) => [x.month, x.value]))}
        title="Monthly logged transactions"
      />
    </section>
  );
}

function FunnelTab({ data }: { data: any }) {
  const cat = data.funnel?.by_category?.buyer_connections;
  if (!cat) return <div className="zl-banner">Funnel data not in this snapshot.</div>;
  const table = cat.table_2026;
  const months = (table?.months || []).filter((m: string) => m !== "Grand Total");
  return (
    <section className="section">
      <h2 className="serif">Funnel · Buyer Connections</h2>
      <p className="zl-cap">
        {cat.date_window || "Last 6 months"} · Agent {cat.agent_name || "(All)"}. Other categories (ZHL / Seller) not captured in this pull.
      </p>
      <div style={{ marginTop: 12 }}><FunnelViz stages={cat.stages || []} /></div>
      {cat.donut_pct_of_live_cxs ? (
        <p className="zl-cap">Share of live connections: {Object.entries(cat.donut_pct_of_live_cxs).map(([k, v]) => `${k} ${pct(v)}`).join(" · ")}</p>
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
      {months.length ? <p className="zl-cap">Monthly columns {months[0]}–{months[months.length - 1]} plus Grand Total from Tableau Funnel tab.</p> : null}
    </section>
  );
}

function AgentsTab({ data, focus }: { data: any; focus: string | null }) {
  const rows: any[] = data.agents?.agents || [];
  const gt = data.agents?.grand_total || {};
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
      <p className="zl-cap">
        {data.agents?.period || "Last 90 Day Funnel Metrics"}.
        {data.agents?.rows_complete === false ? " Roster may be partial (scroll below last captured row not confirmed in pull)." : ""}
        {focus ? ` Highlighting ${focus}.` : " Use the top Agent picker for a my-score view on Performance."}
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
    </section>
  );
}

function DetailsTab({ data }: { data: any }) {
  const d = data.detail_reports || {};
  const a = d.aggregates || {};
  return (
    <section className="section">
      <h2 className="serif">Detail Reports</h2>
      <div className="zl-banner" style={{ marginTop: 8 }}>
        <b>Aggregates only.</b> Lead-level Transaction Details rows are skipped (PII). Other Detail dropdown views were not explored in this pull.
      </div>
      <div className="zl-grid cols-2" style={{ marginTop: 14 }}>
        <div className="zl-card">
          <div className="zl-card-k">Pending &amp; closed transactions</div>
          <div className="zl-card-v serif">{num(a.pending_and_closed_transactions)}</div>
        </div>
        <div className="zl-card">
          <div className="zl-card-k">Total transaction price</div>
          <div className="zl-card-v serif">{usd(a.total_transaction_price_usd)}</div>
        </div>
      </div>
      {d.column_headers?.length ? <p className="zl-cap">Tableau columns (not shown): {d.column_headers.join(" · ")}</p> : null}
    </section>
  );
}

function GlossaryTab({ data }: { data: any }) {
  const g = data.glossary || {};
  const terms: any[] = g.terms || [];
  return (
    <section className="section">
      <h2 className="serif">Glossary</h2>
      <p className="zl-cap">
        {g.partial ? `Partial capture through “${g.captured_through || "—"}”. Remaining Tableau glossary rows not in this pull.` : "Full glossary."}
      </p>
      <div className="zl-gloss" style={{ marginTop: 12 }}>
        {terms.map((t) => (
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
        <b>No Top 10 data yet.</b> Kevin locked the Kahla Google Sheet as the only source for this block. The current sheet export has no Top 10 structure, so this section stays empty until that feed exists.
        {data.top10_teams_note ? <div className="zl-meta" style={{ marginTop: 8 }}>{data.top10_teams_note}</div> : null}
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
