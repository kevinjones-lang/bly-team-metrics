import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import {
  computeVariance,
  cumulativeArray,
  DASH,
  latestActualMonthIndex,
  lineYtd,
  pctText,
  readBudget,
  usd,
  varianceTone,
  type BudgetLine,
} from "../src/budgetModel.ts";

assert.equal(readBudget(null).kind, "empty");
assert.equal(readBudget({ schema: "budget.v0" }).kind, "schema");

// Missing values always render as "—", never "$0"
assert.equal(usd(null), DASH);
assert.equal(usd(undefined), DASH);
assert.equal(usd(Number.NaN), DASH);
assert.equal(usd(0), "$0");
assert.equal(usd(-1234.4), "-$1,234");
assert.equal(usd(1234.6, true), "+$1,235");
assert.equal(pctText(null), DASH);
assert.equal(pctText(-0.02, 1, true), "-2.0%");
assert.equal(pctText(0.125, 1, true), "+12.5%");

// Favorable = green ("success"), unfavorable = red ("danger")
assert.equal(varianceTone(5000, 1), "success");
assert.equal(varianceTone(-5000, 1), "danger");
// Expense under budget (actual - budget < 0) is favorable
assert.equal(varianceTone(-5000, -1), "success");
assert.equal(varianceTone(5000, -1), "danger");
assert.equal(varianceTone(null, -1), undefined);

const incVar = computeVariance(110000, 100000, 1);
assert.equal(incVar.diff, 10000);
assert.equal(incVar.tone, "success");

const expUnder = computeVariance(45000, 50000, -1);
assert.equal(expUnder.diff, -5000);
assert.equal(expUnder.tone, "success");

const expOver = computeVariance(55000, 50000, -1);
assert.equal(expOver.diff, 5000);
assert.equal(expOver.tone, "danger");

const missingVar = computeVariance(null, 50000, -1);
assert.equal(missingVar.diff, null);
assert.equal(missingVar.pct, null);
assert.equal(missingVar.tone, undefined);

const synthLine: BudgetLine = {
  key: "opex",
  label: "Total Operating Expenses",
  dir: -1,
  m2026: [100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100],
  m2027_budget: [100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100],
  m2027_actual: [90, 95, null, null, null, null, null, null, null, null, null, null],
  ytd_2026_actual: 1000,
  basis_2026: 1200,
  fy_2027_budget: 1200,
};

const ytd = lineYtd(synthLine);
assert.equal(ytd.actualizedCount, 2);
assert.equal(ytd.actual27, 185);
assert.equal(ytd.budget27Actualized, 200);
const ytdVar = computeVariance(ytd.actual27, ytd.budget27Actualized, synthLine.dir);
assert.equal(ytdVar.diff, -15);
assert.equal(ytdVar.tone, "success");

const cum = cumulativeArray(synthLine.m2027_actual);
assert.deepEqual(cum.slice(0, 4), [90, 185, null, null]);

assert.equal(latestActualMonthIndex([null, null, null]), 0);
assert.equal(latestActualMonthIndex(["Actual", "Actual", null]), 1);

// Validate generated budget.json if present locally on the box (never committed to repo)
const localBudgetPath = "/workspace/metrics/data/2026-11-25/budget.json";
if (existsSync(localBudgetPath)) {
  const parsed = readBudget(JSON.parse(readFileSync(localBudgetPath, "utf8")));
  assert.equal(parsed.kind, "ok");
  if (parsed.kind === "ok") {
    assert.equal(parsed.data.months.length, 12);
    assert.equal(parsed.data.status_2026[10], "Estimate");
    assert.equal(parsed.data.status_2026[11], "Estimate");
    assert.equal(parsed.data.actualized_months_2027, 0);
    const inc = parsed.data.major_lines.find((l) => l.key === "income");
    const net = parsed.data.major_lines.find((l) => l.key === "net_income");
    assert.ok(inc && net);
    assert.ok(inc.m2027_actual.every((v) => v === null));
    assert.ok((inc.fy_2027_budget ?? 0) > 0);
    assert.ok((net.fy_2027_budget ?? 0) > 0);
    assert.equal(parsed.data.opex_groups.length, 9);
  }
}

console.log("check-budget: ok");
