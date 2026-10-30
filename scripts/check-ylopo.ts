import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { countText, latestDaily, latestHistory, moneyText, readYlopo, type HistoryRow } from "../src/ylopoModel.ts";

const raw: unknown = JSON.parse(readFileSync(new URL("../src/dev/ylopo.sample.json", import.meta.url), "utf8"));
const read = readYlopo(raw);
assert.equal(read.kind, "ok");
if (read.kind !== "ok") throw new Error("sample did not read");

const rows = latestHistory(read.data.history);
assert.equal(rows.length, 10);
assert.equal(rows[0]?.period, "2026-01");
assert.equal(rows[9]?.period, "2026-10");

const march = rows.find((row) => row.period === "2026-03");
assert.equal(march?.fub?.closings, 0);
assert.equal(march?.cost_per?.closing?.all_in, null);
assert.equal(countText(march?.fub?.closings), "0");
assert.equal(moneyText(march?.cost_per?.closing?.all_in, "No data"), "No data");
assert.equal(moneyText(0), "$0.00");
assert.notEqual(moneyText(null), "$0.00");
assert.equal(moneyText(null, "No data"), "No data");

const oct = rows.find((row) => row.period === "2026-10");
assert.equal(oct?.invoices, null);
assert.equal(oct?.cost_per?.lead?.all_in, null);
assert.equal(oct?.cost_per?.lead?.dashboard_spend_basis_unconfirmed, 45.76);
assert.equal(moneyText(oct?.cost_per?.lead?.dashboard_spend_basis_unconfirmed), "$45.76");

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
