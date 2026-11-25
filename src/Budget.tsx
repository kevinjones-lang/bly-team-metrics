// 2027 Budget vs Actual view (schema budget.v1). Staff-only via Layout/Nav gate.
// Missing 2027 actuals always render as "—" (never $0). Nov–Dec 2026 are labeled Est.
import "./budget.css";
import { ColumnSeries, Page, Section, Segmented, Select, Table, Text, useMemo, useState, type Ratios } from "./kit";
import {
  computeVariance,
  cumulativeArray,
  DASH,
  isNum,
  latestActualMonthIndex,
  lineYtd,
  pctText,
  readBudget,
  usd,
  usdK,
  type BudgetAccountLine,
  type BudgetData,
  type BudgetLine,
  type Tone,
} from "./budgetModel";

function Empty() {
  return (
    <div className="gatecard">
      <h1 className="serif">2027 Budget vs Actual</h1>
      <p className="rule" />
      <p>— No budget data in this snapshot yet. It loads with the next pipeline run.</p>
    </div>
  );
}

function SchemaNote({ schema }: { schema: string }) {
  return (
    <Page title="2027 Budget vs Actual">
      <div className="bg-banner">
        <span>This snapshot uses schema {schema}. This view reads budget.v1.</span>
      </div>
    </Page>
  );
}

function StatusPill({ status, label }: { status: "Actual" | "Estimate" | null; label?: string }) {
  if (status === "Actual") return <span className="bg-pill is-actual">{label || "Actual"}</span>;
  if (status === "Estimate") return <span className="bg-pill is-est">{label || "Est."}</span>;
  return <span className="bg-pill is-pending">{label || "Pending"}</span>;
}

function toneCell(text: string, tone: Tone, sort?: number | null) {
  return {
    text,
    tone,
    ...(sort !== undefined ? { sort } : {}),
  };
}

function numCell(v: number | null | undefined, signed = false) {
  if (!isNum(v)) return DASH;
  return { text: usd(v, signed), sort: v };
}

function varAmtCell(diff: number | null, tone: Tone) {
  if (!isNum(diff)) return DASH;
  return toneCell(usd(diff, true), tone, diff);
}

function varPctCell(pct: number | null, tone: Tone) {
  if (!isNum(pct)) return DASH;
  return toneCell(pctText(pct, 1, true), tone, pct * 100);
}

function findLine(lines: BudgetLine[], key: string): BudgetLine {
  return lines.find((l) => l.key === key) || lines[0];
}

function KpiCard({
  label,
  value,
  sub,
  variant,
}: {
  label: string;
  value: string;
  sub: React.ReactNode;
  variant?: "gold" | "charcoal";
}) {
  return (
    <div className={"bg-card" + (variant ? " is-" + variant : "")}>
      <div className="bg-k">{label}</div>
      <div className="bg-v serif">{value}</div>
      <div className="bg-sub">{sub}</div>
    </div>
  );
}

function BudgetView({ data }: { data: BudgetData }) {
  const income = findLine(data.major_lines, "income");
  const cogs = findLine(data.major_lines, "cogs");
  const gp = findLine(data.major_lines, "gross_profit");
  const opex = findLine(data.major_lines, "opex");
  const net = findLine(data.major_lines, "net_income");

  const [selectedLineKey, setSelectedLineKey] = useState<string>("income");
  const [seriesMode, setSeriesMode] = useState<"monthly" | "cumulative">("monthly");
  const [monthScope, setMonthScope] = useState<"all" | "actualized">("all");
  const [selectedMonthIdx, setSelectedMonthIdx] = useState<string>(
    String(latestActualMonthIndex(data.status_2027))
  );
  const [acctType, setAcctType] = useState<"EXP" | "INC" | "COGS" | "OI" | "ALL">("EXP");

  const selectedLine = useMemo(
    () => findLine(data.major_lines, selectedLineKey),
    [data.major_lines, selectedLineKey]
  );

  const actualizedCount = data.actualized_months_2027;
  const incYtd = lineYtd(income);
  const netYtd = lineYtd(net);
  const incVarYtd = computeVariance(incYtd.actual27, incYtd.budget27Actualized, 1);
  const netVarYtd = computeVariance(netYtd.actual27, netYtd.budget27Actualized, 1);

  const netVs26 = computeVariance(net.fy_2027_budget, net.basis_2026, 1);
  const opexVs26 = computeVariance(opex.fy_2027_budget, opex.basis_2026, -1);
  const gpVs26 = computeVariance(gp.fy_2027_budget, gp.basis_2026, 1);

  // Table 1: Major P&L Lines Overview (overlapping subtotals -> noTotals per kit.tsx)
  const majorCols = [
    "P&L Line",
    "2027 YTD Actual",
    "2027 YTD Budget",
    "YTD Var $",
    "YTD Var %",
    "2027 FY Budget",
    "2026 Jan–Oct Actual",
    "2026 Full-Year Basis (Nov–Dec Est.)",
    "2027 vs 2026 $",
    "2027 vs 2026 %",
  ];
  const majorRows = data.major_lines.map((line) => {
    const ytd = lineYtd(line);
    const vYtd = computeVariance(ytd.actual27, ytd.budget27Actualized, line.dir);
    const v26 = computeVariance(line.fy_2027_budget, line.basis_2026, line.dir);
    return [
      line.label,
      numCell(ytd.actual27),
      numCell(ytd.budget27Actualized),
      varAmtCell(vYtd.diff, vYtd.tone),
      varPctCell(vYtd.pct, vYtd.tone),
      numCell(line.fy_2027_budget),
      numCell(line.ytd_2026_actual),
      numCell(line.basis_2026),
      varAmtCell(v26.diff, v26.tone),
      varPctCell(v26.pct, v26.tone),
    ];
  });

  // Monthly comparison chart & Table 2 for selected major line
  const m26Series = seriesMode === "cumulative" ? cumulativeArray(selectedLine.m2026) : selectedLine.m2026;
  const b27Series =
    seriesMode === "cumulative" ? cumulativeArray(selectedLine.m2027_budget) : selectedLine.m2027_budget;
  const a27Series =
    seriesMode === "cumulative" ? cumulativeArray(selectedLine.m2027_actual) : selectedLine.m2027_actual;

  const chartSeries = useMemo(() => {
    const s: { name: string; values: number[] }[] = [
      { name: "2026 Basis (Nov–Dec Est.)", values: m26Series.map((v) => (isNum(v) ? v : 0)) },
      { name: "2027 Budget", values: b27Series.map((v) => (isNum(v) ? v : 0)) },
    ];
    if (actualizedCount > 0) {
      s.push({ name: "2027 Actual", values: a27Series.map((v) => (isNum(v) ? v : 0)) });
    }
    return s;
  }, [m26Series, b27Series, a27Series, actualizedCount]);

  const monthIndices = useMemo(() => {
    const all = data.months.map((_, i) => i);
    if (monthScope === "actualized" && actualizedCount > 0) {
      return all.filter((i) => data.status_2027[i] === "Actual");
    }
    return all;
  }, [data.months, data.status_2027, monthScope, actualizedCount]);

  const monthlyCols = [
    "Month",
    "2027 Status",
    "2027 Budget",
    "2027 Actual",
    "Var $",
    "Var %",
    "2026 Basis",
    "2026 Status",
    "vs 2026 $",
    "vs 2026 %",
  ];
  const monthlyRows = monthIndices.map((i) => {
    const b27 = b27Series[i];
    const a27 = a27Series[i];
    const b26 = m26Series[i];
    const vBud = computeVariance(a27, b27, selectedLine.dir);
    const vPrior = computeVariance(isNum(a27) ? a27 : b27, b26, selectedLine.dir);
    const st27 = data.status_2027[i];
    const st26 = data.status_2026[i];
    return [
      { text: data.months[i], sort: i },
      { text: st27 || "Pending", node: <StatusPill status={st27} /> },
      numCell(b27),
      numCell(a27),
      varAmtCell(vBud.diff, vBud.tone),
      varPctCell(vBud.pct, vBud.tone),
      {
        text: isNum(b26) ? usd(b26) : DASH,
        sort: isNum(b26) ? b26 : undefined,
        node:
          st26 === "Estimate" ? (
            <span className="bg-cell-est">
              <span>{isNum(b26) ? usd(b26) : DASH}</span>
              <StatusPill status="Estimate" />
            </span>
          ) : (
            <span>{isNum(b26) ? usd(b26) : DASH}</span>
          ),
      },
      { text: st26, node: <StatusPill status={st26} label={st26 === "Estimate" ? "Est." : "Actual"} /> },
      varAmtCell(vPrior.diff, vPrior.tone),
      varPctCell(vPrior.pct, vPrior.tone),
    ];
  });

  const monthlyRatios: Ratios = {
    "Var %": ["Var $", "2027 Budget"],
    "vs 2026 %": ["vs 2026 $", "2026 Basis"],
  };

  // Month tracker (Month + YTD for picked month) & Opex by Group
  const mIdx = Math.max(0, Math.min(11, parseInt(selectedMonthIdx, 10) || 0));
  const mStatus27 = data.status_2027[mIdx];
  const mStatus26 = data.status_2026[mIdx];

  const opexTotalBudget = opex.fy_2027_budget || 0;
  const opexGroupCols = [
    "Operating Expense Group",
    "2027 FY Budget",
    "Share %",
    "2027 YTD Actual",
    "2027 YTD Budget",
    "Var $",
    "Var %",
    "2026 Full-Year Basis",
    "vs 2026 $",
    "vs 2026 %",
  ];
  const opexGroupRows = data.opex_groups.map((g) => {
    const ytd = lineYtd(g);
    const vBud = computeVariance(ytd.actual27, ytd.budget27Actualized, -1);
    const v26 = computeVariance(g.fy_2027_budget, g.basis_2026, -1);
    const share = opexTotalBudget > 0 && isNum(g.fy_2027_budget) ? g.fy_2027_budget / opexTotalBudget : null;
    return [
      g.label,
      numCell(g.fy_2027_budget),
      { text: pctText(share, 1), sort: isNum(share) ? share * 100 : undefined },
      numCell(ytd.actual27),
      numCell(ytd.budget27Actualized),
      varAmtCell(vBud.diff, vBud.tone),
      varPctCell(vBud.pct, vBud.tone),
      numCell(g.basis_2026),
      varAmtCell(v26.diff, v26.tone),
      varPctCell(v26.pct, v26.tone),
    ];
  });
  const opexGroupRatios: Ratios = {
    "Share %": ["2027 FY Budget", "2027 FY Budget"],
    "Var %": ["Var $", "2027 YTD Budget"],
    "vs 2026 %": ["vs 2026 $", "2026 Full-Year Basis"],
  };

  // Selected-month Opex Group snapshot (shows monthly numbers + YTD for picked month)
  const monthOpexCols = [
    "Operating Expense Group",
    `${data.month_labels[mIdx]} 2027 Budget`,
    `${data.month_labels[mIdx]} 2027 Actual`,
    "Month Var $",
    "Month Var %",
    `${data.month_labels[mIdx]} 2026`,
    "vs 2026 $",
    "vs 2026 %",
    `YTD Budget (Jan–${data.month_labels[mIdx]})`,
    "YTD Actual",
  ];
  const monthOpexRows = data.opex_groups.map((g) => {
    const b27 = g.m2027_budget[mIdx];
    const a27 = g.m2027_actual[mIdx];
    const b26 = g.m2026[mIdx];
    const vBud = computeVariance(a27, b27, -1);
    const v26 = computeVariance(isNum(a27) ? a27 : b27, b26, -1);
    const ytdThrough = lineYtd(g, mIdx);
    return [
      g.label,
      numCell(b27),
      numCell(a27),
      varAmtCell(vBud.diff, vBud.tone),
      varPctCell(vBud.pct, vBud.tone),
      numCell(b26),
      varAmtCell(v26.diff, v26.tone),
      varPctCell(v26.pct, v26.tone),
      numCell(ytdThrough.budget27Through),
      numCell(ytdThrough.actual27),
    ];
  });
  const monthOpexRatios: Ratios = {
    "Month Var %": ["Month Var $", `${data.month_labels[mIdx]} 2027 Budget`],
    "vs 2026 %": ["vs 2026 $", `${data.month_labels[mIdx]} 2026`],
  };

  // Account detail table
  const filteredAccounts = useMemo(() => {
    if (acctType === "ALL") return data.accounts;
    return data.accounts.filter((a: BudgetAccountLine) => a.type === acctType);
  }, [data.accounts, acctType]);

  const acctCols = [
    "Account",
    "Category",
    "Spread",
    "2027 FY Budget",
    "2027 YTD Actual",
    "2027 YTD Budget",
    "Var $",
    "Var %",
    "2026 Jan–Oct Actual",
    "2026 Full-Year Basis",
    "vs 2026 $",
    "vs 2026 %",
  ];
  const acctRows = filteredAccounts.map((a) => {
    const ytd = lineYtd(a);
    const vBud = computeVariance(ytd.actual27, ytd.budget27Actualized, a.dir);
    const v26 = computeVariance(a.fy_2027_budget, a.basis_2026, a.dir);
    return [
      a.label,
      a.group || a.type,
      a.spread || DASH,
      numCell(a.fy_2027_budget),
      numCell(ytd.actual27),
      numCell(ytd.budget27Actualized),
      varAmtCell(vBud.diff, vBud.tone),
      varPctCell(vBud.pct, vBud.tone),
      numCell(a.ytd_2026_actual),
      numCell(a.basis_2026),
      varAmtCell(v26.diff, v26.tone),
      varPctCell(v26.pct, v26.tone),
    ];
  });
  const acctRatios: Ratios = {
    "Var %": ["Var $", "2027 YTD Budget"],
    "vs 2026 %": ["vs 2026 $", "2026 Full-Year Basis"],
  };

  return (
    <Page
      title="2027 Budget vs Actual"
      summary="Monthly and YTD budget tracking against Tax In-House P&L actuals. Favorable variances show green (expenses under budget count as favorable); unfavorable variances show red."
    >
      <div className="bg-banner">
        <div className="bg-banner-meta">
          <span>
            <strong>Source:</strong> {data.sheet.source_label || data.sheet.name}
          </span>
          <span>
            <strong>P&amp;L actuals through:</strong> {data.pnl_source.through}
          </span>
          <span>
            <strong>2027 actualized:</strong> {actualizedCount} of 12 months
          </span>
          <span>
            <strong>Generated:</strong> {data.generated}
          </span>
        </div>
        <a className="bg-sheet-link" href={data.sheet.url} target="_blank" rel="noopener noreferrer">
          Open {data.sheet.name} (owner-only) ↗
        </a>
      </div>

      <div className="bg-kpis">
        <KpiCard
          label="2027 Budget Income"
          value={usd(income.fy_2027_budget)}
          sub={
            <>
              {data.assumptions.income_method} ({pctText(data.assumptions.income_growth_pct, 1, true)}) ·{" "}
              {data.assumptions.closed_unit_goal ?? DASH} units target · 2026 basis {usd(income.basis_2026)}
            </>
          }
        />
        <KpiCard
          label="2027 Budget Gross Profit"
          value={usd(gp.fy_2027_budget)}
          sub={
            <>
              Margin {pctText(data.margins.gross_2027_budget)} · COGS {usd(cogs.fy_2027_budget)} ·{" "}
              <span className={gpVs26.tone === "success" ? "good" : gpVs26.tone === "danger" ? "bad" : ""}>
                {isNum(gpVs26.diff) && Math.abs(gpVs26.diff) >= 1 ? `${usd(gpVs26.diff, true)} vs 2026` : "Flat vs 2026 basis"}
              </span>
            </>
          }
          variant="charcoal"
        />
        <KpiCard
          label="2027 Budget Opex"
          value={usd(opex.fy_2027_budget)}
          sub={
            <>
              2026 basis {usd(opex.basis_2026)} ·{" "}
              <span className={opexVs26.tone === "success" ? "good" : opexVs26.tone === "danger" ? "bad" : ""}>
                {usd(opexVs26.diff, true)} ({pctText(opexVs26.pct, 1, true)})
              </span>{" "}
              (Ask My Acct → $0)
            </>
          }
        />
        <KpiCard
          label="2027 Budget Net Income"
          value={usd(net.fy_2027_budget)}
          sub={
            <>
              Margin {pctText(data.margins.net_2027_budget)} ·{" "}
              <span className={netVs26.tone === "success" ? "good" : netVs26.tone === "danger" ? "bad" : ""}>
                {usd(netVs26.diff, true)} ({pctText(netVs26.pct, 1, true)}) vs 2026 basis
              </span>
            </>
          }
          variant="gold"
        />
        <KpiCard
          label="2027 YTD Actuals"
          value={actualizedCount > 0 ? usd(netYtd.actual27) : DASH}
          sub={
            actualizedCount > 0 ? (
              <>
                Income {usd(incYtd.actual27)}{" "}
                <span className={incVarYtd.tone === "success" ? "good" : incVarYtd.tone === "danger" ? "bad" : ""}>
                  ({usd(incVarYtd.diff, true)})
                </span>{" "}
                · Net{" "}
                <span className={netVarYtd.tone === "success" ? "good" : netVarYtd.tone === "danger" ? "bad" : ""}>
                  ({usd(netVarYtd.diff, true)})
                </span>
              </>
            ) : (
              <>No 2027 P&amp;L months closed yet ({data.pnl_source.through} latest)</>
            )
          }
        />
      </div>

      <Section
        heading="Major P&L Lines — 2027 Budget vs Actual & 2026 Basis"
        caption="2026 Jan–Oct figures are closed Tax In-House P&L actuals; Nov–Dec 2026 are estimates (labeled Est.). Months without 2027 actuals show — rather than $0. Summary subtotals overlap, so this table omits a summed top row."
      >
        <div className="bg-monthstrip" aria-label="2026 and 2027 month close status">
          {data.month_labels.map((lbl, i) => (
            <div key={lbl} className="bg-mchip">
              <strong>{lbl}</strong>
              <span>26: {data.status_2026[i] === "Estimate" ? "Est." : "Act."}</span>
              <span>27: {data.status_2027[i] === "Actual" ? "Act." : DASH}</span>
            </div>
          ))}
        </div>
        <Table columns={majorCols} rows={majorRows} noTotals />
      </Section>

      <Section
        heading="Monthly Budget vs Actual"
        caption={
          seriesMode === "monthly"
            ? "Monthly breakdown for the selected P&L line. Top Total row sums dollar columns and computes % columns as ratios."
            : "Cumulative year-to-date progression through the year (months without 2027 actuals show —)."
        }
      >
        <div className="bg-controls">
          <Select
            label="P&L Line"
            value={selectedLine.key}
            onChange={setSelectedLineKey}
            options={data.major_lines.map((l) => ({ value: l.key, label: l.label }))}
          />
          <Segmented
            value={seriesMode}
            onChange={(v) => setSeriesMode(v)}
            options={[
              { value: "monthly", label: "Monthly" },
              { value: "cumulative", label: "Cumulative YTD" },
            ]}
          />
          {actualizedCount > 0 && actualizedCount < 12 ? (
            <Segmented
              value={monthScope}
              onChange={(v) => setMonthScope(v)}
              options={[
                { value: "all", label: "All 12 months" },
                { value: "actualized", label: `Actualized (${actualizedCount})` },
              ]}
            />
          ) : null}
        </div>
        <ColumnSeries labels={data.month_labels} series={chartSeries} format={usdK} />
        <Table
          columns={monthlyCols}
          rows={monthlyRows}
          ratios={monthlyRatios}
          noTotals={seriesMode === "cumulative"}
        />
      </Section>

      <Section
        heading="Month Tracker & Operating Expense Groups"
        caption={`Inspect any month alongside cumulative YTD budget, or compare full-year Operating Expense groups (${data.opex_groups.length} groups totaling ${usd(opex.fy_2027_budget)}).`}
      >
        <div className="bg-controls">
          <Select
            label="Month Focus"
            value={selectedMonthIdx}
            onChange={setSelectedMonthIdx}
            options={data.months.map((m, i) => ({
              value: String(i),
              label: `${data.month_labels[i]} 2027 (${m})`,
            }))}
          />
          <div className="bg-legend-note">
            2027 status: <StatusPill status={mStatus27} /> · 2026 baseline:{" "}
            <StatusPill status={mStatus26} label={mStatus26 === "Estimate" ? "Estimate" : "Actual"} />
          </div>
        </div>
        <Table columns={monthOpexCols} rows={monthOpexRows} ratios={monthOpexRatios} />
        <Text>
          <strong>Full-Year Operating Expense Groups (2027 Budget vs 2026 Basis)</strong>
        </Text>
        <Table columns={opexGroupCols} rows={opexGroupRows} ratios={opexGroupRatios} />
      </Section>

      <Section
        heading="Line-by-Line Account Detail"
        caption="All 51 P&L accounts from the Bly Team 2027 Budget workbook. Filter to a category to see additive category totals at the top."
      >
        <div className="bg-controls">
          <Segmented
            value={acctType}
            onChange={(v) => setAcctType(v)}
            options={[
              { value: "EXP", label: "Operating Expenses" },
              { value: "INC", label: "Income" },
              { value: "COGS", label: "COGS" },
              { value: "OI", label: "Other Income" },
              { value: "ALL", label: "All Accounts" },
            ]}
          />
        </div>
        <Table
          columns={acctCols}
          rows={acctRows}
          ratios={acctRatios}
          noTotals={acctType === "ALL"}
        />
      </Section>

      <Section heading="Assumptions & Methodology">
        <ul className="bg-notes">
          <li>
            <strong>Income method:</strong> {data.assumptions.income_method} (
            {pctText(data.assumptions.income_growth_pct, 1, true)}) · Closed unit goal:{" "}
            {data.assumptions.closed_unit_goal ?? DASH} · Nov–Dec 2026 baseline:{" "}
            {data.assumptions.nov_dec_method}.
          </li>
          <li>
            <strong>Expense growth:</strong> {pctText(data.assumptions.opex_growth_pct, 1, true)} · Other Income
            growth: {pctText(data.assumptions.other_income_growth_pct, 1, true)} · Ask My Accountant:{" "}
            {usd(data.assumptions.ask_my_accountant_2027)} in 2027 (vs{" "}
            {usd(data.assumptions.ask_my_accountant_2026)} in 2026).
          </li>
          {data.assumptions.notes.map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ul>
      </Section>
    </Page>
  );
}

export default function Budget({ data }: { data: unknown }) {
  const res = readBudget(data);
  if (res.kind === "empty") return <Empty />;
  if (res.kind === "schema") return <SchemaNote schema={res.schema} />;
  return <BudgetView data={res.data} />;
}
