/** ylopo.v1 helpers. Null is missing. Zero is a real zero. History and daily rows are append-only; use the newest row per period or date. */

export type DateRange = { from?: string | null; to?: string | null };

export type CostPer = {
  all_in?: number | null;
  ad_spend_only?: number | null;
  denominator?: string | null;
  closings_unit?: string | null;
  dashboard_spend_basis_unconfirmed?: number | null;
  note?: string | null;
};

export type InvoiceBlock = {
  invoice_count?: number | null;
  all_in_cost?: number | null;
  ad_spend?: number | null;
  ad_spend_components?: Record<string, number | null> | null;
  category_breakdown?: Record<string, number | null> | null;
};

export type FubMonth = {
  new_leads?: number | null;
  appointments_set?: number | null;
  leads_with_first_appt?: number | null;
  closings?: number | null;
  closings_unit?: string | null;
  range?: DateRange | null;
};

export type MissionControl = {
  range_label?: string | null;
  total_leads?: number | null;
  priority_leads?: number | null;
  engaged_leads?: number | null;
  handraisers?: number | null;
};

export type DashboardMonth = {
  as_of?: string | null;
  range_label?: string | null;
  range?: DateRange | null;
  total_spent?: number | null;
  total_marketing_budget?: number | null;
  generated_leads?: number | null;
  distributed_leads?: number | null;
  avg_cost_per_distributed_lead_displayed?: number | null;
  mission_control_last_30d?: MissionControl | null;
};

export type HistoryRow = {
  period?: string | null;
  period_type?: string | null;
  from?: string | null;
  to?: string | null;
  status?: string | null;
  recorded_at?: string | null;
  invoices?: InvoiceBlock | null;
  fub?: FubMonth | null;
  ylopo_dashboard?: DashboardMonth | null;
  cost_per?: { lead?: CostPer | null; appointment?: CostPer | null; closing?: CostPer | null } | null;
  flags?: string[] | null;
};

export type BudgetChannel = { budget?: number | null; remaining?: number | null; remaining_pct?: number | null };

export type BrandStat = { value?: number | null; range_label?: string | null; range_note?: string | null };

export type DailySnapshot = {
  date?: string | null;
  read_at?: string | null;
  source?: string | null;
  mission_control?: MissionControl | null;
  marketing_snapshot?: {
    view?: string | null;
    range_label?: string | null;
    month?: string | null;
    total_spent?: number | null;
    total_spent_pct_of_budget?: number | null;
    total_marketing_budget?: number | null;
    budgets?: Record<string, BudgetChannel | null> | null;
    generated_leads?: number | null;
    distributed_leads?: number | null;
    avg_cost_per_distributed_lead_displayed?: number | null;
    avg_cost_per_distributed_lead_note?: string | null;
  } | null;
  campaigns?: Record<string, number | null> | null;
  listing_rocket_statuses?: Record<string, number | null> | null;
  brand_awareness?: Record<string, BrandStat | null> | null;
  ppc_performance?: {
    trailing_12_months_ppc_spend?: number | null;
    note?: string | null;
    no_ppc_spend_trailing_12m?: boolean | null;
    no_campaign_data_current_month?: boolean | null;
  } | null;
  admin_users?: number | null;
};

export type FubWindow = {
  from?: string | null;
  to?: string | null;
  new_leads?: number | null;
  appointments_set?: number | null;
  leads_with_first_appt?: number | null;
  closings?: number | null;
};

export type YlopoData = {
  schema?: string;
  as_of?: string | null;
  timezone?: string | null;
  assumptions?: Record<string, string | null> | null;
  history_policy?: string | null;
  agents_note?: string | null;
  totals?: {
    ytd?: {
      year?: number | null;
      fub_range?: DateRange | null;
      invoice_months_covered?: string[] | null;
      all_in_cost?: number | null;
      ad_spend?: number | null;
      category_breakdown?: Record<string, number | null> | null;
      invoice_count?: number | null;
      fub_new_leads?: number | null;
      fub_appointments_set?: number | null;
      fub_closings?: number | null;
      closings_unit?: string | null;
    } | null;
    cost_per_matched_months?: {
      note?: string | null;
      months?: string[] | null;
      all_in_cost?: number | null;
      ad_spend?: number | null;
      fub_new_leads?: number | null;
      fub_appointments_set?: number | null;
      fub_closings?: number | null;
      ylopo_distributed_leads?: number | null;
      lead?: CostPer | null;
      appointment?: CostPer | null;
      closing?: CostPer | null;
    } | null;
    current_month?: {
      period?: string | null;
      status?: string | null;
      invoices?: InvoiceBlock | null;
      fub?: FubMonth | null;
      ylopo_dashboard?: DashboardMonth | null;
      cost_per?: { lead?: CostPer | null; appointment?: CostPer | null; closing?: CostPer | null } | null;
      flags?: string[] | null;
    } | null;
    fub_windows?: Record<string, FubWindow | null> | null;
  } | null;
  history?: HistoryRow[] | null;
  daily_snapshots?: DailySnapshot[] | null;
};

export type Read =
  | { kind: "empty" }
  | { kind: "schema"; schema: string }
  | { kind: "ok"; data: YlopoData };

const SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const FULL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const FLAG_NOTES: Record<string, string> = {
  no_invoices_in_register: "No invoices in the register.",
  no_ylopo_dashboard_reading: "No Ylopo dashboard reading.",
  month_in_progress: "Month in progress.",
  closings_unit_unconfirmed: "Closings units are unconfirmed vs eXp units.",
  ylopo_displayed_avg_cost_per_distributed_lead_0_inconsistent_with_spend:
    "Ylopo's displayed average cost per distributed lead is $0, which does not match the spend.",
};

const DENOMS: Record<string, string> = {
  ylopo_distributed_leads: "Ylopo distributed leads",
  fub_ylopo_appointments_set: "FUB Ylopo appointments set",
  fub_ylopo_closings: "FUB Ylopo closings",
};

const ACRONYMS = new Set(["ppc", "fub", "lsa", "mls", "idx", "ai", "ytd"]);

export const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

export function moneyText(v: unknown, empty: "No data" | "—" = "—"): string {
  if (!isNum(v)) return empty;
  return v.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function countText(v: unknown, empty: "No data" | "—" = "—"): string {
  if (!isNum(v)) return empty;
  return v.toLocaleString("en-US");
}

export function pctText(v: unknown, empty: "No data" | "—" = "—"): string {
  if (!isNum(v)) return empty;
  return `${v.toLocaleString("en-US")}%`;
}

export function stamp(iso: string | null | undefined): string {
  if (!iso) return "—";
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(iso);
  return m ? `${m[1]} ${m[2]} CT` : iso;
}

export function rangeText(r: DateRange | null | undefined): string | null {
  if (!r?.from && !r?.to) return null;
  if (r.from && r.to) return `${r.from} to ${r.to}`;
  return r.from || r.to || null;
}

export function monthList(months: readonly string[] | null | undefined): string {
  if (!months?.length) return "No data";
  return months.join(", ");
}

export function monthTick(period: string): string {
  const name = SHORT[Number(period.slice(5, 7)) - 1];
  return name ?? period;
}

export function monthLong(period: string | null | undefined): string {
  if (!period) return "No data";
  const name = FULL[Number(period.slice(5, 7)) - 1];
  return name ? `${name} ${period.slice(0, 4)}` : period;
}

export function words(key: string): string {
  if (key.includes(" ") || key.includes("/")) return key;
  return key.split("_").map((w) => (ACRONYMS.has(w) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1))).join(" ");
}

export function flagNote(flag: string): string {
  return FLAG_NOTES[flag] ?? flag.replace(/_/g, " ");
}

export function closingsUnitNote(unit: string | null | undefined): string | null {
  if (!unit) return null;
  if (unit === "fub_deals_unconfirmed_vs_exp_units") return "Closings units are unconfirmed vs eXp units.";
  return unit;
}

export function denomLabel(d: string | null | undefined): string {
  if (!d) return "No data";
  return DENOMS[d] ?? d.replace(/_/g, " ");
}

export function latestBy<T>(
  rows: readonly T[] | null | undefined,
  key: (row: T) => string | null | undefined,
  when: (row: T) => string | null | undefined,
): T[] {
  const best = new Map<string, T>();
  for (const row of rows ?? []) {
    const id = key(row);
    if (!id) continue;
    const prev = best.get(id);
    if (!prev || String(when(row) ?? "") >= String(when(prev) ?? "")) best.set(id, row);
  }
  return [...best.values()];
}

export function latestHistory(rows: readonly HistoryRow[] | null | undefined): HistoryRow[] {
  return latestBy(rows, (row) => row.period, (row) => row.recorded_at).sort((a, b) => String(a.period).localeCompare(String(b.period)));
}

export function latestDaily(rows: readonly DailySnapshot[] | null | undefined): DailySnapshot[] {
  return latestBy(rows, (row) => row.date, (row) => row.read_at).sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

export function readYlopo(data: unknown): Read {
  if (data == null || typeof data !== "object" || Array.isArray(data)) return { kind: "empty" };
  const schema = "schema" in data && typeof data.schema === "string" ? data.schema : "";
  if (schema && schema !== "ylopo.v1") return { kind: "schema", schema };
  return { kind: "ok", data: data as YlopoData };
}

export function labeledRange(label: string | null | undefined, range: DateRange | null | undefined, fallback = "No data"): string {
  const bits = [label || null, rangeText(range)].filter((x): x is string => Boolean(x));
  return bits.length ? bits.join(" · ") : fallback;
}
