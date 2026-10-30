import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { countText, latestDaily, latestHistory, moneyText, readYlopo, reconciliationNote, uncountedNotes, type HistoryRow } from "../src/ylopoModel.ts";

const raw: unknown = JSON.parse(readFileSync(new URL("../src/dev/ylopo.sample.json", import.meta.url), "utf8"));
const read = readYlopo(raw);
assert.equal(read.kind, "ok");
if (read.kind !== "ok") throw new Error("sample did not read");

assert.equal(read.data.history?.length, 21);
const rows = latestHistory(read.data.history);
assert.equal(rows.length, 10);
assert.equal(rows[0]?.period, "2026-01");
assert.equal(rows[9]?.period, "2026-10");

const byPeriod = new Map<string, HistoryRow[]>();
for (const row of read.data.history ?? []) {
  const period = row.period ?? "";
  byPeriod.set(period, [...(byPeriod.get(period) ?? []), row]);
}
assert.equal(byPeriod.size, 10);
for (const [period, revisions] of byPeriod) {
  const newest = revisions.reduce((a, b) => (String(a.recorded_at ?? "") >= String(b.recorded_at ?? "") ? a : b));
  const shown = rows.find((row) => row.period === period);
  assert.equal(shown?.recorded_at, newest.recorded_at, period);
  assert.equal(shown?.invoices?.all_in_cost ?? null, newest.invoices?.all_in_cost ?? null, period);
  assert.equal(shown?.invoices?.invoice_source ?? null, newest.invoices?.invoice_source ?? null, period);
  assert.equal(shown?.cost_per?.lead?.all_in ?? null, newest.cost_per?.lead?.all_in ?? null, period);
  assert.equal(shown?.invoices_unconfirmed_pdf_only ?? null, newest.invoices_unconfirmed_pdf_only ?? null, period);
}

const march = rows.find((row) => row.period === "2026-03");
const olderMarch = (byPeriod.get("2026-03") ?? []).find((row) => row.recorded_at !== march?.recorded_at);
assert.equal(march?.fub?.closings, 0);
assert.equal(march?.cost_per?.closing?.all_in, null);
assert.equal(march?.invoices?.all_in_cost, 7453.28);
assert.notEqual(olderMarch?.invoices?.all_in_cost, march?.invoices?.all_in_cost);
assert.equal(countText(march?.fub?.closings), "0");
assert.equal(moneyText(march?.cost_per?.closing?.all_in, "No data"), "No data");
assert.equal(moneyText(0), "$0.00");
assert.notEqual(moneyText(null), "$0.00");
assert.equal(moneyText(null, "No data"), "No data");

const octRevs = byPeriod.get("2026-10") ?? [];
assert.equal(octRevs.length, 3);
const oct = rows.find((row) => row.period === "2026-10");
assert.equal(oct?.recorded_at, "2026-10-30T11:14:17-05:00");
assert.equal(oct?.invoices?.all_in_cost, 3305.56);
assert.equal(oct?.invoices?.invoice_source, "pdf");
assert.equal(oct?.invoices?.credits, 0);
assert.equal(oct?.cost_per?.lead?.all_in, 103.3);
assert.equal(oct?.cost_per?.lead?.ad_spend_only, 64.97);
assert.equal(oct?.cost_per?.lead?.all_in_net_of_credits, 103.3);
assert.equal(oct?.invoices_unconfirmed_pdf_only ?? null, null);
assert.ok(octRevs.some((row) => row.invoices == null && row.invoices_unconfirmed_pdf_only != null));
assert.equal(uncountedNotes(rows).length, 0);
assert.ok(uncountedNotes(octRevs.filter((row) => row.recorded_at !== oct?.recorded_at)).some((note) => note.includes("INV508872") && note.startsWith("Not counted")));
assert.equal(oct?.cost_per?.lead?.dashboard_spend_basis_unconfirmed, 45.76);
assert.equal(moneyText(oct?.cost_per?.lead?.all_in), "$103.30");
assert.equal(moneyText(oct?.cost_per?.lead?.ad_spend_only), "$64.97");

const lead = read.data.totals?.cost_per_matched_months?.lead;
assert.deepEqual(lead?.months, ["2026-10"]);
assert.equal(lead?.all_in, 103.3);
assert.equal(lead?.ad_spend_only, 64.97);
assert.equal(lead?.all_in_net_of_credits, 103.3);
assert.equal(read.data.totals?.cost_per_matched_months?.ylopo_distributed_leads, 32);
assert.equal(read.data.totals?.ytd?.gross_invoiced, 56791.66);
assert.equal(read.data.totals?.ytd?.credits, 3561);
assert.equal(read.data.totals?.ytd?.net_of_credits, 53230.66);
assert.equal(read.data.totals?.ytd?.category_breakdown?.Discount, -100);
assert.equal(moneyText(-100), "-$100.00");
const recon = reconciliationNote(read.data.invoice_reconciliation);
assert.ok(recon?.includes("INV508872 is counted"));
assert.ok(!recon?.includes("not counted"));

const days = latestDaily(read.data.daily_snapshots);
assert.equal(days.length, 1);
assert.equal(days[0]?.mission_control?.range_label, "Last 30 days");
assert.equal(days[0]?.marketing_snapshot?.range_label, "This Month");
assert.equal(days[0]?.mission_control?.total_leads, 51677);

const older: HistoryRow = { ...rows[0], recorded_at: "2026-01-01T00:00:00-06:00", invoices: { all_in_cost: 1, ad_spend: 1 } };
const newer: HistoryRow = { ...rows[0], recorded_at: "2026-11-01T00:00:00-05:00", invoices: { all_in_cost: 99, ad_spend: 7 } };
const tied: HistoryRow = { ...rows[0], recorded_at: "2026-11-01T00:00:00-05:00", invoices: { all_in_cost: 50, ad_spend: 3 } };
const again = latestHistory([...(read.data.history ?? []), older, tied, newer]);
assert.equal(again.filter((row) => row.period === "2026-01").length, 1);
assert.equal(again.find((row) => row.period === "2026-01")?.invoices?.all_in_cost, 99);

assert.equal(readYlopo(undefined).kind, "empty");
assert.equal(readYlopo(null).kind, "empty");
const bad = readYlopo({ schema: "other" });
assert.equal(bad.kind, "schema");
if (bad.kind === "schema") assert.equal(bad.schema, "other");

console.log("ylopo checks ok");
