// Ylopo tab. Totals only, from the daily metrics snapshot (schema ylopo.v1). Null renders as "No data" or an em dash, never as zero.
import { useAgent, AgentBanner } from "./agent";
import "./ylopo.css";
import {
  closingsUnitNote,
  countText,
  denomLabel,
  flagNote,
  isNum,
  labeledRange,
  latestDaily,
  latestHistory,
  moneyText,
  monthList,
  monthLong,
  monthTick,
  pctText,
  rangeText,
  readYlopo,
  stamp,
  words,
  type CostPer,
  type DailySnapshot,
  type HistoryRow,
  type YlopoData,
} from "./ylopoModel";

const NAVY = "#00519B";
const GOLD = "#C0A062";
const GREEN = "#2E7D4F";
const MIST = "#9DB8D6";

const FUB_WINDOWS: { key: string; label: string }[] = [
  { key: "last_7d", label: "FUB last 7 days" },
  { key: "last_30d", label: "FUB last 30 days" },
  { key: "last_90d", label: "FUB last 90 days" },
];

function Empty() {
  return (
    <div className="gatecard">
      <h1 className="serif">Ylopo</h1>
      <p className="rule" />
      <p>— No data. Not in this snapshot yet. It loads with the next pipeline run.</p>
    </div>
  );
}

function SchemaNote({ schema }: { schema: string }) {
  return (
    <div className="page ylopo">
      <h1 className="page-title serif">Ylopo</h1>
      <div className="page-body">
        <div className="yp-banner">This snapshot is schema {schema}. This tab reads ylopo.v1, so these figures are left as no data.</div>
      </div>
    </div>
  );
}

function MoneyCard({ k, period, value, hint }: { k: string; period: string; value: unknown; hint?: string | null }) {
  const missing = !isNum(value);
  return (
    <div className={"yp-card" + (missing ? " is-empty" : "")}>
      <div className="yp-k">{k}</div>
      <div className="yp-period">{period}</div>
      <div className="yp-v serif">{missing ? "No data" : moneyText(value)}</div>
      {hint ? <div className="yp-meta">{hint}</div> : null}
    </div>
  );
}

function CountCard({ k, period, value, hint }: { k: string; period: string; value: unknown; hint?: string | null }) {
  const missing = !isNum(value);
  return (
    <div className={"yp-card" + (missing ? " is-empty" : "")}>
      <div className="yp-k">{k}</div>
      <div className="yp-period">{period}</div>
      <div className="yp-v serif">{missing ? "No data" : countText(value)}</div>
      {hint ? <div className="yp-meta">{hint}</div> : null}
    </div>
  );
}

function Notes({ lines }: { lines: (string | null | undefined)[] }) {
  const shown = lines.filter((line): line is string => Boolean(line));
  if (!shown.length) return null;
  return (
    <>
      {shown.map((line) => (
        <p className="yp-note" key={line}>{line}</p>
      ))}
    </>
  );
}

function PairCard({
  title,
  period,
  pair,
  count,
  notes,
}: {
  title: string;
  period: string;
  pair?: CostPer | null;
  count?: number | null;
  notes?: (string | null | undefined)[];
}) {
  const unconfirmed = pair?.dashboard_spend_basis_unconfirmed;
  return (
    <div className="yp-card">
      <div className="yp-k">{title}</div>
      <div className="yp-period">{period}</div>
      <div className="yp-pair">
        <div>
          <div className="yp-sub">All-in</div>
          <div className="yp-v serif">{isNum(pair?.all_in) ? moneyText(pair.all_in) : "No data"}</div>
        </div>
        <div>
          <div className="yp-sub">Ad spend only</div>
          <div className="yp-v serif">{isNum(pair?.ad_spend_only) ? moneyText(pair.ad_spend_only) : "No data"}</div>
        </div>
      </div>
      <div className="yp-meta">
        Denominator: {denomLabel(pair?.denominator)}
        {isNum(count) ? ` · ${countText(count)}` : " · No data"}
      </div>
      {isNum(unconfirmed) ? <p className="yp-note">Unconfirmed · {moneyText(unconfirmed)}</p> : null}
      <Notes lines={[pair?.note, ...(notes ?? [])]} />
    </div>
  );
}

function Header({ data, days }: { data: YlopoData; days: DailySnapshot[] }) {
  const ytd = data.totals?.ytd;
  const matched = data.totals?.cost_per_matched_months;
  const cur = data.totals?.current_month;
  const snap = days.length ? days[days.length - 1] : null;
  const brand = brandSummary(snap?.brand_awareness);
  return (
    <>
      <div className="asof">As of {stamp(data.as_of)}{data.timezone ? ` · ${data.timezone}` : ""}</div>
      <h1 className="page-title serif">Ylopo</h1>
      <p className="yp-source">Totals only. “No data” and — mean the source has no number. A shown 0 is a real zero.</p>
      <ul className="yp-ranges">
        <li><b>YTD {isNum(ytd?.year) ? ytd.year : "—"} FUB</b> {rangeText(ytd?.fub_range) ?? "No data"}</li>
        <li><b>Invoices</b> {monthList(ytd?.invoice_months_covered)}{isNum(ytd?.invoice_count) ? ` · ${countText(ytd.invoice_count)} invoices` : ""}</li>
        <li><b>Cost per, matched months</b> {monthList(matched?.months)}</li>
        <li>
          <b>{monthLong(cur?.period)}</b> {cur?.status || "No data"}
          {cur?.fub?.range ? ` · FUB ${rangeText(cur.fub.range)}` : ""}
          {cur?.ylopo_dashboard ? ` · ${labeledRange(cur.ylopo_dashboard.range_label, cur.ylopo_dashboard.range)}` : ""}
        </li>
        <li><b>Mission Control</b> {snap?.mission_control?.range_label || "No data"}</li>
        <li><b>Marketing</b> {labeledRange(snap?.marketing_snapshot?.range_label, null, "No data")}{snap?.marketing_snapshot?.view ? ` · ${snap.marketing_snapshot.view}` : ""}{snap?.marketing_snapshot?.month ? ` · ${snap.marketing_snapshot.month}` : ""}</li>
        <li><b>Brand awareness</b> {brand}</li>
        {FUB_WINDOWS.map((w) => {
          const row = data.totals?.fub_windows?.[w.key];
          return <li key={w.key}><b>{w.label}</b> {rangeText(row) ?? "No data"}</li>;
        })}
      </ul>
    </>
  );
}

function brandSummary(brand: DailySnapshot["brand_awareness"]): string {
  if (!brand) return "No data";
  const groups = new Map<string, string[]>();
  for (const [key, item] of Object.entries(brand)) {
    if (!item) continue;
    const label = item.range_label ?? item.range_note ?? "No data";
    const names = groups.get(label) ?? [];
    names.push(words(key));
    groups.set(label, names);
  }
  if (!groups.size) return "No data";
  return [...groups.entries()].map(([label, names]) => `${label} (${names.join(", ")})`).join(" · ");
}

function Costs({ data }: { data: YlopoData }) {
  const ytd = data.totals?.ytd;
  const matched = data.totals?.cost_per_matched_months;
  const cur = data.totals?.current_month;
  const invoices = monthList(ytd?.invoice_months_covered);
  const fubRange = rangeText(ytd?.fub_range) ?? "No data";
  const matchedPeriod = monthList(matched?.months);
  const dash = cur?.ylopo_dashboard;
  const curPeriod = cur ? labeledRange(dash?.range_label, dash?.range, monthLong(cur.period)) : "No data";
  const leadUnconfirmed = cur?.cost_per?.lead?.dashboard_spend_basis_unconfirmed;
  const closingNote = closingsUnitNote(matched?.closing?.closings_unit ?? ytd?.closings_unit);
  return (
    <section className="section">
      <h2 className="serif">Cost</h2>
      <p className="yp-cap">YTD all-in cost and ad spend cover the invoice months. FUB counts below use the FUB range, which runs past the last invoice month.</p>
      <div className="yp-grid cols-2">
        <MoneyCard k="YTD all-in Ylopo cost" period={invoices} value={ytd?.all_in_cost} hint={isNum(ytd?.invoice_count) ? `${countText(ytd.invoice_count)} invoices` : null} />
        <MoneyCard k="YTD ad spend" period={invoices} value={ytd?.ad_spend} hint="Digital Advertising + Google LSA Spend" />
      </div>
      <div className="yp-grid cols-3">
        <CountCard k="FUB Ylopo leads" period={fubRange} value={ytd?.fub_new_leads} />
        <CountCard k="FUB appointments set" period={fubRange} value={ytd?.fub_appointments_set} />
        <CountCard k="FUB closings" period={fubRange} value={ytd?.fub_closings} hint={closingsUnitNote(ytd?.closings_unit)} />
      </div>
      <h3 className="serif yp-h3">Cost per outcome</h3>
      <p className="yp-cap">{matched?.note || "Cost and counts over the months that have invoices."}</p>
      <div className="yp-grid cols-3">
        <PairCard title="Cost per lead" period={matchedPeriod} pair={matched?.lead} count={matched?.ylopo_distributed_leads} />
        <PairCard title="Cost per appointment" period={matchedPeriod} pair={matched?.appointment} count={matched?.fub_appointments_set} />
        <PairCard title="Cost per closing" period={matchedPeriod} pair={matched?.closing} count={matched?.fub_closings} notes={[closingNote]} />
      </div>
      <h3 className="serif yp-h3">{monthLong(cur?.period)}</h3>
      <p className="yp-cap">{cur?.status === "partial" ? "Month in progress." : cur?.status === "complete" ? "Month complete." : "No data"}</p>
      <div className="yp-grid cols-2">
        <MoneyCard k="All-in cost" period={monthLong(cur?.period)} value={cur?.invoices?.all_in_cost} />
        <MoneyCard k="Ad spend" period={monthLong(cur?.period)} value={cur?.invoices?.ad_spend} />
      </div>
      <div className="yp-grid cols-3">
        <PairCard
          title="Cost per lead"
          period={curPeriod}
          pair={cur?.cost_per?.lead}
          count={dash?.distributed_leads}
          notes={[isNum(leadUnconfirmed) ? `${monthLong(cur?.period)} cost per lead is unconfirmed. The figure above divides Ylopo's displayed month-to-date Total Spent by distributed leads. It is not invoice-based.` : null]}
        />
        <PairCard title="Cost per appointment" period={rangeText(cur?.fub?.range) ?? monthLong(cur?.period)} pair={cur?.cost_per?.appointment} count={cur?.fub?.appointments_set} />
        <PairCard title="Cost per closing" period={rangeText(cur?.fub?.range) ?? monthLong(cur?.period)} pair={cur?.cost_per?.closing} count={cur?.fub?.closings} notes={[closingsUnitNote(cur?.cost_per?.closing?.closings_unit)]} />
      </div>
      <Notes lines={(cur?.flags ?? []).map(flagNote)} />
      <h3 className="serif yp-h3">FUB windows</h3>
      <div className="yp-grid cols-3">
        {FUB_WINDOWS.map((w) => {
          const row = data.totals?.fub_windows?.[w.key];
          const period = rangeText(row) ?? "No data";
          return (
            <div className="yp-card" key={w.key}>
              <div className="yp-k">{w.label}</div>
              <div className="yp-period">{period}</div>
              <div className="yp-meta">Leads {countText(row?.new_leads, "No data")}</div>
              <div className="yp-meta">Appointments {countText(row?.appointments_set, "No data")}</div>
              <div className="yp-meta">First appointment {countText(row?.leads_with_first_appt, "No data")}</div>
              <div className="yp-meta">Closings {countText(row?.closings, "No data")}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

type Series = { name: string; color: string; values: (number | null)[] };

function chartPeak(series: Series[]): number {
  const finite = series.flatMap((s) => s.values.filter(isNum));
  if (!finite.length) return 0;
  return Math.max(...finite);
}

function GroupedBars({ title, caption, labels, series, format, money }: {
  title: string;
  caption?: string;
  labels: string[];
  series: Series[];
  format: (v: number) => string;
  money?: boolean;
}) {
  const peak = chartPeak(series);
  if (!labels.length || !series.some((s) => s.values.some(isNum))) {
    return (
      <figure className="yp-chart">
        <figcaption className="serif">{title}</figcaption>
        {caption ? <p className="yp-cap">{caption}</p> : null}
        <p className="yp-empty">No data</p>
      </figure>
    );
  }
  const W = 720;
  const H = 230;
  const PL = 52;
  const PR = 12;
  const PT = 16;
  const PB = 32;
  const top = peak > 0 ? peak * 1.12 : 1;
  const innerW = W - PL - PR;
  const innerH = H - PT - PB;
  const groupW = innerW / labels.length;
  const barW = Math.min(16, (groupW * 0.7) / series.length);
  const yOf = (v: number) => PT + innerH - (v / top) * innerH;
  const ticks = [0, top / 2, top];
  return (
    <figure className="yp-chart">
      <figcaption className="serif">{title}</figcaption>
      {caption ? <p className="yp-cap">{caption}</p> : null}
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title}>
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={PL} x2={W - PR} y1={yOf(tick)} y2={yOf(tick)} stroke="#E6E2D8" />
            <text x={PL - 6} y={yOf(tick) + 3} textAnchor="end" fontSize="10" fill="#6B6B6B">{axisTick(tick, Boolean(money))}</text>
          </g>
        ))}
        {labels.map((label, i) => {
          const gx = PL + i * groupW;
          return (
            <g key={label + i}>
              {series.map((s, si) => {
                const v = s.values[i];
                if (!isNum(v)) return null;
                const h = v > 0 ? (v / top) * innerH : 0;
                const x = gx + (groupW - series.length * barW) / 2 + si * barW;
                return (
                  <g key={s.name}>
                    {h > 0 ? <rect x={x} y={yOf(v)} width={Math.max(1, barW - 2)} height={h} fill={s.color} rx="1"><title>{`${s.name} ${label}: ${format(v)}`}</title></rect> : null}
                    {v === 0 ? <text x={x + barW / 2} y={PT + innerH - 3} textAnchor="middle" fontSize="10" fill="#6B6B6B">0</text> : null}
                  </g>
                );
              })}
              <text x={gx + groupW / 2} y={H - 10} textAnchor="middle" fontSize="11" fill="#6B6B6B">{label}</text>
            </g>
          );
        })}
      </svg>
      <Legend series={series} />
    </figure>
  );
}

function Lines({ title, caption, labels, series, format }: {
  title: string;
  caption?: string;
  labels: string[];
  series: Series[];
  format: (v: number) => string;
}) {
  const peak = chartPeak(series);
  if (!labels.length || !series.some((s) => s.values.some(isNum))) {
    return (
      <figure className="yp-chart">
        <figcaption className="serif">{title}</figcaption>
        {caption ? <p className="yp-cap">{caption}</p> : null}
        <p className="yp-empty">No data</p>
      </figure>
    );
  }
  const W = 720;
  const H = 200;
  const PL = 46;
  const PR = 12;
  const PT = 18;
  const PB = 28;
  const top = peak > 0 ? peak * 1.18 : 1;
  const innerW = W - PL - PR;
  const innerH = H - PT - PB;
  const xOf = (i: number) => labels.length === 1 ? PL + innerW / 2 : PL + (i * innerW) / (labels.length - 1);
  const yOf = (v: number) => PT + innerH - (v / top) * innerH;
  return (
    <figure className="yp-chart">
      <figcaption className="serif">{title}</figcaption>
      {caption ? <p className="yp-cap">{caption}</p> : null}
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title}>
        <line x1={PL} x2={W - PR} y1={PT + innerH} y2={PT + innerH} stroke="#D6D0C2" />
        <text x={PL - 6} y={PT + 8} textAnchor="end" fontSize="10" fill="#6B6B6B">{axisTick(top, false)}</text>
        {series.map((s) => (
          <g key={s.name}>
            {segments(s.values).map((run, ri) => (
              <polyline key={ri} points={run.map((i) => `${xOf(i)},${yOf(s.values[i] as number)}`).join(" ")} fill="none" stroke={s.color} strokeWidth="2.5" />
            ))}
            {s.values.map((v, i) => isNum(v) ? (
              <g key={i}>
                <circle cx={xOf(i)} cy={yOf(v)} r="4" fill={s.color}><title>{`${s.name} ${labels[i]}: ${format(v)}`}</title></circle>
                {labels.length <= 6 ? <text x={xOf(i)} y={yOf(v) - 8} textAnchor="middle" fontSize="11" fill="#12151C">{format(v)}</text> : null}
              </g>
            ) : null)}
          </g>
        ))}
        {labels.map((label, i) => (
          <text key={label + i} x={xOf(i)} y={H - 8} textAnchor="middle" fontSize="11" fill="#6B6B6B">{label}</text>
        ))}
      </svg>
      <Legend series={series} />
    </figure>
  );
}

function segments(values: (number | null)[]): number[][] {
  const runs: number[][] = [];
  let cur: number[] = [];
  values.forEach((v, i) => {
    if (isNum(v)) cur.push(i);
    else if (cur.length) { runs.push(cur); cur = []; }
  });
  if (cur.length) runs.push(cur);
  return runs;
}

function Legend({ series }: { series: Series[] }) {
  return (
    <div className="yp-legend">
      {series.map((s) => <span key={s.name}><i style={{ background: s.color }} />{s.name}</span>)}
    </div>
  );
}

function axisTick(v: number, money: boolean): string {
  const abs = Math.abs(v);
  const body = abs >= 1000 ? `${(v / 1000).toLocaleString("en-US", { maximumFractionDigits: 1 })}k` : String(Math.round(v));
  return money ? `$${body}` : body;
}

function Trends({ rows, policy }: { rows: HistoryRow[]; policy?: string | null }) {
  const labels = rows.map((r) => `${monthTick(String(r.period ?? ""))}${r.status === "partial" ? "*" : ""}`);
  const num = (pick: (row: HistoryRow) => unknown) => rows.map((row) => (isNum(pick(row)) ? pick(row) as number : null));
  return (
    <section className="section">
      <h2 className="serif">Trends</h2>
      <p className="yp-cap">Each month is the newest history row, the latest recorded_at for that period. A gap is no data, not zero. * is a month still in progress.</p>
      {policy ? <p className="yp-cap">{policy}</p> : null}
      {!rows.length ? <p className="yp-empty">No data</p> : (
        <>
          <GroupedBars
            title="Monthly all-in cost and ad spend"
            labels={labels}
            money
            format={(v) => moneyText(v)}
            series={[
              { name: "All-in", color: NAVY, values: num((r) => r.invoices?.all_in_cost) },
              { name: "Ad spend", color: GOLD, values: num((r) => r.invoices?.ad_spend) },
            ]}
          />
          <div className="yp-grid cols-2">
            <GroupedBars title="FUB Ylopo leads" labels={labels} format={countText} series={[{ name: "Leads", color: NAVY, values: num((r) => r.fub?.new_leads) }]} />
            <GroupedBars
              title="FUB appointments and closings"
              labels={labels}
              format={countText}
              series={[
                { name: "Appointments", color: GOLD, values: num((r) => r.fub?.appointments_set) },
                { name: "Closings", color: GREEN, values: num((r) => r.fub?.closings) },
              ]}
            />
          </div>
          <div className="yp-grid cols-2">
            <GroupedBars
              title="Cost per appointment"
              labels={labels}
              money
              format={(v) => moneyText(v)}
              series={[
                { name: "All-in", color: NAVY, values: num((r) => r.cost_per?.appointment?.all_in) },
                { name: "Ad spend", color: MIST, values: num((r) => r.cost_per?.appointment?.ad_spend_only) },
              ]}
            />
            <GroupedBars
              title="Cost per closing"
              labels={labels}
              money
              format={(v) => moneyText(v)}
              series={[
                { name: "All-in", color: GREEN, values: num((r) => r.cost_per?.closing?.all_in) },
                { name: "Ad spend", color: GOLD, values: num((r) => r.cost_per?.closing?.ad_spend_only) },
              ]}
            />
          </div>
          <HistoryTable rows={rows} />
        </>
      )}
    </section>
  );
}

function HistoryTable({ rows }: { rows: HistoryRow[] }) {
  const money = (v: unknown) => moneyText(v, "—");
  const count = (v: unknown) => countText(v, "—");
  return (
    <div className="tablewrap">
      <table className="yp-table">
        <thead>
          <tr>
            <th>Month</th>
            <th>Status</th>
            <th className="r">All-in</th>
            <th className="r">Ad spend</th>
            <th className="r">Leads</th>
            <th className="r">Appts</th>
            <th className="r">Closings</th>
            <th className="r">CPL all-in</th>
            <th className="r">CPL ad spend</th>
            <th className="r">CPL unconfirmed</th>
            <th className="r">CPA all-in</th>
            <th className="r">CPA ad spend</th>
            <th className="r">CPC all-in</th>
            <th className="r">CPC ad spend</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={String(r.period)}>
              <td>{r.period || "—"}</td>
              <td>{r.status || "—"}</td>
              <td className="r">{money(r.invoices?.all_in_cost)}</td>
              <td className="r">{money(r.invoices?.ad_spend)}</td>
              <td className="r">{count(r.fub?.new_leads)}</td>
              <td className="r">{count(r.fub?.appointments_set)}</td>
              <td className="r">{count(r.fub?.closings)}</td>
              <td className="r">{money(r.cost_per?.lead?.all_in)}</td>
              <td className="r">{money(r.cost_per?.lead?.ad_spend_only)}</td>
              <td className="r">{money(r.cost_per?.lead?.dashboard_spend_basis_unconfirmed)}</td>
              <td className="r">{money(r.cost_per?.appointment?.all_in)}</td>
              <td className="r">{money(r.cost_per?.appointment?.ad_spend_only)}</td>
              <td className="r">{money(r.cost_per?.closing?.all_in)}</td>
              <td className="r">{money(r.cost_per?.closing?.ad_spend_only)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="yp-cap">
        CPL, CPA, and CPC are cost per lead, appointment, and closing. — is no data, not zero.
        {rows.some((r) => r.fub?.closings_unit === "fub_deals_unconfirmed_vs_exp_units" || r.cost_per?.closing?.closings_unit === "fub_deals_unconfirmed_vs_exp_units" || r.flags?.includes("closings_unit_unconfirmed"))
          ? " Closings units are unconfirmed vs eXp units."
          : ""}
      </p>
    </div>
  );
}

function Daily({ days }: { days: DailySnapshot[] }) {
  const labels = days.map((d) => (d.date ? d.date.slice(5) : "—"));
  const range = [...new Set(days.map((d) => d.mission_control?.range_label).filter((x): x is string => Boolean(x)))].join(" · ") || "No data";
  const pick = (key: keyof NonNullable<DailySnapshot["mission_control"]>) => days.map((d) => {
    const v = d.mission_control?.[key];
    return isNum(v) ? v : null;
  });
  return (
    <section className="section">
      <h2 className="serif">Mission Control, daily</h2>
      <p className="yp-cap">{range}. {days.length === 1 ? "One reading so far. Each new dashboard day appends a point." : `${countText(days.length)} readings.`}</p>
      {!days.length ? <p className="yp-empty">No data</p> : (
        <div className="yp-grid cols-2">
          <Lines title="Total leads" labels={labels} format={countText} series={[{ name: "Total", color: NAVY, values: pick("total_leads") }]} />
          <Lines title="Priority leads" labels={labels} format={countText} series={[{ name: "Priority", color: GOLD, values: pick("priority_leads") }]} />
          <Lines title="Engaged leads" labels={labels} format={countText} series={[{ name: "Engaged", color: GREEN, values: pick("engaged_leads") }]} />
          <Lines title="Handraisers" labels={labels} format={countText} series={[{ name: "Handraisers", color: NAVY, values: pick("handraisers") }]} />
        </div>
      )}
    </section>
  );
}

function Dashboard({ day }: { day: DailySnapshot | null }) {
  const mc = day?.mission_control;
  const mk = day?.marketing_snapshot;
  const mcRange = mc?.range_label || "No data";
  const mkRange = labeledRange(mk?.range_label, null, "No data");
  return (
    <section className="section">
      <h2 className="serif">Ylopo dashboard</h2>
      <p className="yp-cap">{day?.date ? `Reading ${day.date}` : "No data"}{day?.read_at ? ` · ${stamp(day.read_at)}` : ""}</p>
      {!day ? <p className="yp-empty">No data</p> : (
        <>
          <h3 className="serif yp-h3">Mission Control</h3>
          <div className="yp-grid cols-4">
            <CountCard k="Total leads" period={mcRange} value={mc?.total_leads} />
            <CountCard k="Priority leads" period={mcRange} value={mc?.priority_leads} />
            <CountCard k="Engaged leads" period={mcRange} value={mc?.engaged_leads} />
            <CountCard k="Handraisers" period={mcRange} value={mc?.handraisers} />
          </div>
          <h3 className="serif yp-h3">Marketing budget and spend</h3>
          <p className="yp-cap">{mk?.view ? `${mk.view} · ` : ""}{mkRange}{mk?.month ? ` · ${mk.month}` : ""}</p>
          <div className="yp-grid cols-4">
            <MoneyCard k="Total spent" period={mkRange} value={mk?.total_spent} hint={isNum(mk?.total_spent_pct_of_budget) ? `${pctText(mk.total_spent_pct_of_budget)} of budget` : null} />
            <MoneyCard k="Total marketing budget" period={mkRange} value={mk?.total_marketing_budget} />
            <CountCard k="Generated leads" period={mkRange} value={mk?.generated_leads} />
            <CountCard k="Distributed leads" period={mkRange} value={mk?.distributed_leads} />
          </div>
          <div className="yp-grid cols-2">
            <MoneyCard k="Avg. cost per distributed lead" period={mkRange} value={mk?.avg_cost_per_distributed_lead_displayed} hint={mk?.avg_cost_per_distributed_lead_note} />
          </div>
          <div className="yp-grid cols-3">
            {Object.entries(mk?.budgets ?? {}).map(([key, channel]) => (
              <div className="yp-card" key={key}>
                <div className="yp-k">{words(key)}</div>
                <div className="yp-period">{mkRange}</div>
                <div className="yp-v serif">{isNum(channel?.budget) ? moneyText(channel.budget) : "No data"}</div>
                <div className="yp-meta">Budget</div>
                {channel && "remaining" in channel ? <div className="yp-meta">Remaining {isNum(channel.remaining) ? moneyText(channel.remaining) : "No data"}{isNum(channel.remaining_pct) ? ` · ${pctText(channel.remaining_pct)}` : ""}</div> : null}
              </div>
            ))}
          </div>
          <h3 className="serif yp-h3">Campaigns</h3>
          <div className="yp-grid cols-3">
            {Object.entries(day.campaigns ?? {}).map(([key, value]) => (
              <CountCard key={key} k={words(key)} period={day.date || "No data"} value={value} />
            ))}
            {!day.campaigns ? <p className="yp-empty">No data</p> : null}
          </div>
          <h3 className="serif yp-h3">Listing Rocket status</h3>
          <div className="yp-grid cols-4">
            {Object.entries(day.listing_rocket_statuses ?? {}).map(([key, value]) => (
              <CountCard key={key} k={words(key)} period={day.date || "No data"} value={value} />
            ))}
          </div>
          <h3 className="serif yp-h3">Brand awareness</h3>
          <div className="yp-grid cols-3">
            {Object.entries(day.brand_awareness ?? {}).map(([key, item]) => (
              <CountCard key={key} k={words(key)} period={item?.range_label || item?.range_note || "No data"} value={item?.value} />
            ))}
          </div>
          <h3 className="serif yp-h3">PPC</h3>
          <div className="yp-grid cols-2">
            <MoneyCard k="Trailing 12 months PPC spend" period="Trailing 12 months" value={day.ppc_performance?.trailing_12_months_ppc_spend} hint={day.ppc_performance?.note} />
            <CountCard k="Admin users" period={day.date || "No data"} value={day.admin_users} />
          </div>
        </>
      )}
    </section>
  );
}

function Categories({ ytd }: { ytd?: NonNullable<NonNullable<YlopoData["totals"]>["ytd"]> | null }) {
  const entries = Object.entries(ytd?.category_breakdown ?? {}).sort((a, b) => (isNum(b[1]) ? b[1] : Number.NEGATIVE_INFINITY) - (isNum(a[1]) ? a[1] : Number.NEGATIVE_INFINITY));
  const peak = Math.max(0, ...entries.map(([, v]) => (isNum(v) ? Math.abs(v) : 0)));
  return (
    <section className="section">
      <h2 className="serif">Cost categories</h2>
      <p className="yp-cap">Invoice line items · {monthList(ytd?.invoice_months_covered)}</p>
      {!entries.length ? <p className="yp-empty">No data</p> : (
        <div className="bars">
          {entries.map(([name, value]) => (
            <div className="bar" key={name}>
              <div className="blabel">{name}</div>
              <div className="btrack">
                {isNum(value) && peak > 0 ? <div className="bfill" style={{ width: `${(Math.abs(value) / peak) * 100}%`, background: value < 0 ? GOLD : NAVY }} /> : null}
              </div>
              <div className="bval">{isNum(value) ? moneyText(value) : "No data"}</div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function Body({ data }: { data: YlopoData }) {
  const { agent } = useAgent();
  const history = latestHistory(data.history);
  const days = latestDaily(data.daily_snapshots);
  return (
    <div className="page ylopo">
      <Header data={data} days={days} />
      <div className="page-body">
        {agent ? <AgentBanner note="Ylopo figures are team totals. This snapshot has no per-agent numbers." /> : null}
        <Costs data={data} />
        <Trends rows={history} policy={data.history_policy} />
        <Daily days={days} />
        <Dashboard day={days.length ? days[days.length - 1] : null} />
        <Categories ytd={data.totals?.ytd} />
        {data.agents_note ? <p className="yp-cap">{data.agents_note}</p> : null}
      </div>
    </div>
  );
}

export default function Ylopo({ data }: { data?: unknown }) {
  const read = readYlopo(data);
  switch (read.kind) {
    case "empty":
      return <Empty />;
    case "schema":
      return <SchemaNote schema={read.schema} />;
    case "ok":
      return <Body data={read.data} />;
    default: {
      const _n: never = read;
      return _n;
    }
  }
}
