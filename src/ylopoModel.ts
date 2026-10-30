/** ylopo.v1 helpers. Null is missing. Zero is a real zero. History and daily rows are append-only; use the newest row per period or date. */

export type DateRange = { from?: string | null; to?: string | null };

export type CostPer = {
  all_in?: number | null;
  ad_spend_only?: number | null;
  all_in_net_of_credits?: number | null;
  denominator?: string | null;
  months?: string[] | null;
  closings_unit?: string | null;
  dashboard_spend_basis_unconfirmed?: number | null;
  note?: string | null;
  pdf_only_invoice_basis_unconfirmed?: { all_in?: number | null; ad_spend_only?: number | null } | null;
};

export type InvoiceRef = {
  invoice?: string | null;
  date?: string | null;
  type?: string | null;
  status?: string | null;
  total?: number | null;
  ad_spend?: number | null;
  seen_in?: string[] | null;
  included_because?: string | null;
};

export type UnconfirmedInvoices = {
  label?: string | null;
  invoices?: InvoiceRef[] | null;
  all_in_cost?: number | null;
  ad_spend?: number | null;
};

export type InvoiceBlock = {
  invoice_count?: number | null;
  all_in_cost?: number | null;
  ad_spend?: number | null;
  ad_spend_components?: Record<string, number | null> | null;
  category_breakdown?: Record<string, number | null> | null;
  invoice_source?: string | null;
  invoice_sources_seen?: string[] | null;
  invoices_by_source?: Record<string, number | null> | null;
  gross_invoiced?: number | null;
  credits?: number | null;
  credit_memo_count?: number | null;
  credits_by_category?: Record<string, number | null> | null;
  net_of_credits?: number | null;
  credits_status?: string | null;
  confirmed_pdf_only_invoices?: string[] | null;
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
  invoices_unconfirmed_pdf_only?: UnconfirmedInvoices | null;
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

export type InvoiceReconciliation = {
  invoice_count_by_source?: Record<string, number | null> | null;
  total_by_source?: Record<string, number | null> | null;
  amount_mismatches?: unknown[] | null;
  category_mismatches?: unknown[] | null;
  pdf_only_excluded?: InvoiceRef[] | null;
  pdf_only_included?: InvoiceRef[] | null;
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
  invoice_reconciliation?: InvoiceReconciliation | null;
  totals?: {
    ytd?: {
      year?: number | null;
      fub_range?: DateRange | null;
      invoice_months_covered?: string[] | null;
      all_in_cost?: number | null;
      ad_spend?: number | null;
      category_breakdown?: Record<string, number | null> | null;
      invoice_count?: number | null;
      gross_invoiced?: number | null;
      credits?: number | null;
      net_of_credits?: number | null;
      credits_status?: string | null;
      invoice_source_by_month?: Record<string, string | null> | null;
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
      net_of_credits?: number | null;
      lead?: CostPer | null;
      appointment?: CostPer | null;
      closing?: CostPer | null;
    } | null;
    credits_note?: string | null;
    current_month?: {
      period?: string | null;
      status?: string | null;
      invoices?: InvoiceBlock | null;
      invoices_unconfirmed_pdf_only?: UnconfirmedInvoices | null;
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
  credits_unknown_if_refunded_or_applied: "Unknown whether credits were refunded or applied.",
  pdf_only_invoice_unconfirmed_not_counted: "A PDF-only invoice is unconfirmed and not counted.",
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

const SOURCE_LABEL: Record<string, string> = {
  outlook_export: "Outlook export",
  pdf: "Drive PDF",
  sheet: "sheet",
};

export function sourceLabel(source: string | null | undefined): string {
  if (!source) return "—";
  return source.split(/\s*(?:,|\+|\/)\s*/).map((part) => SOURCE_LABEL[part.trim()] ?? part.trim().replace(/_/g, " ")).join(" · ");
}

export function monthSource(invoices: InvoiceBlock | null | undefined): string | null {
  if (!invoices?.invoice_source) return null;
  const base = sourceLabel(invoices.invoice_source);
  return invoices.confirmed_pdf_only_invoices?.length ? `${base} · confirmed` : base;
}

export function reconciliationNote(rec: InvoiceReconciliation | null | undefined): string | null {
  if (!rec) return null;
  const order = ["outlook_export", "pdf", "sheet"];
  const keys = [...new Set([...order, ...Object.keys(rec.invoice_count_by_source ?? {}), ...Object.keys(rec.total_by_source ?? {})])];
  const parts = keys.filter((src) => isNum(rec.invoice_count_by_source?.[src]) || isNum(rec.total_by_source?.[src])).map((src) => {
    const count = rec.invoice_count_by_source?.[src];
    const total = rec.total_by_source?.[src];
    const bits = [sourceLabel(src)];
    if (isNum(count)) bits.push(`${countText(count)} invoices`);
    if (isNum(total)) bits.push(moneyText(total));
    return bits.join(", ");
  });
  const mismatches = (rec.amount_mismatches?.length ?? 0) + (rec.category_mismatches?.length ?? 0);
  const agree = mismatches === 0
    ? "Amounts agree where an invoice is in more than one source."
    : `${countText(mismatches)} amount or category mismatches.`;
  const excluded = (rec.pdf_only_excluded ?? []).map((inv) => {
    const where = (inv.seen_in ?? []).map((src) => sourceLabel(src)).join(", ");
    return `${inv.invoice ?? "Invoice"}${where ? `, ${where}` : ""}${isNum(inv.total) ? `, ${moneyText(inv.total)}` : ""} is unconfirmed and not counted.`;
  });
  const included = (rec.pdf_only_included ?? []).map((inv) => {
    const where = (inv.seen_in ?? []).map((src) => sourceLabel(src)).join(", ");
    return `${inv.invoice ?? "Invoice"} is counted${where ? ` from ${where}` : ""}${inv.included_because ? ` (${inv.included_because})` : ""}.`;
  });
  const body = [parts.length ? `${parts.join(" · ")}.` : "", agree, ...included, ...excluded].filter(Boolean).join(" ");
  return body || null;
}

/** Uncounted invoices on the rows already chosen for display. Older revisions are ignored. */
export function uncountedNotes(rows: readonly HistoryRow[]): string[] {
  const notes: string[] = [];
  for (const row of rows) {
    const block = row.invoices_unconfirmed_pdf_only;
    if (!block?.invoices?.length) continue;
    for (const inv of block.invoices) {
      const where = (inv.seen_in ?? []).map((src) => sourceLabel(src)).join(", ");
      const bits = [inv.invoice, inv.date ?? row.period, where || null, isNum(inv.total) ? moneyText(inv.total) : null].filter((bit): bit is string => Boolean(bit));
      notes.push(`Not counted · ${bits.join(" · ")}. ${block.label ?? "Unconfirmed and not included in the totals."}`);
    }
  }
  return notes;
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
