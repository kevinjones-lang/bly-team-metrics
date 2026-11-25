// Pure helpers and types for the 2027 Budget vs Actual view (schema budget.v1).
// Null / missing values always format as "—" (never $0). Favorable variance = "success", unfavorable = "danger".

export type MonthStatus2026 = "Actual" | "Estimate";
export type MonthStatus2027 = "Actual" | null;
export type Tone = "success" | "danger" | undefined;

export type BudgetLine = {
  key: string;
  label: string;
  dir: 1 | -1;
  m2026: (number | null)[];
  m2027_budget: (number | null)[];
  m2027_actual: (number | null)[];
  ytd_2026_actual: number | null;
  basis_2026: number | null;
  fy_2027_budget: number | null;
};

export type BudgetAccountLine = BudgetLine & {
  type: "INC" | "COGS" | "EXP" | "OI";
  group?: string;
  spread?: string;
  note?: string;
};

export type BudgetData = {
  schema: "budget.v1";
  generated: string;
  generated_iso?: string;
  sheet: {
    id: string;
    name: string;
    url: string;
    owner_only: boolean;
    read_at: string;
    source_label?: string;
  };
  pnl_source: {
    source: string;
    through: string;
  };
  assumptions: {
    income_method: string;
    income_growth_pct: number | null;
    closed_unit_goal: number | null;
    nov_dec_method: string;
    opex_growth_pct: number | null;
    other_income_growth_pct: number | null;
    ask_my_accountant_2027: number;
    ask_my_accountant_2026: number;
    notes: string[];
  };
  months: string[];
  month_labels: string[];
  status_2026: MonthStatus2026[];
  status_2027: MonthStatus2027[];
  actualized_months_2027: number;
  major_lines: BudgetLine[];
  opex_groups: BudgetLine[];
  accounts: BudgetAccountLine[];
  margins: {
    gross_2026_ytd_actual: number | null;
    gross_2026_basis: number | null;
    gross_2027_budget: number | null;
    gross_2027_ytd_actual: number | null;
    net_2026_ytd_actual: number | null;
    net_2026_basis: number | null;
    net_2027_budget: number | null;
    net_2027_ytd_actual: number | null;
  };
};

export type ReadBudgetResult =
  | { kind: "empty" }
  | { kind: "schema"; schema: string }
  | { kind: "ok"; data: BudgetData };

export const DASH = "—";

export function isNum(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

export function readBudget(raw: unknown): ReadBudgetResult {
  if (!raw || typeof raw !== "object") return { kind: "empty" };
  const obj = raw as Record<string, unknown>;
  if (obj.schema !== "budget.v1") {
    return { kind: "schema", schema: String(obj.schema ?? "unknown") };
  }
  return { kind: "ok", data: obj as unknown as BudgetData };
}

/** Formats USD with -$X for negatives (compatible with kit.tsx cellNum/columnTotals) and "—" when missing. */
export function usd(v: unknown, signed = false): string {
  if (!isNum(v)) return DASH;
  const rounded = Math.round(v);
  if (Object.is(rounded, -0) || rounded === 0) return "$0";
  const abs = Math.abs(rounded).toLocaleString("en-US");
  if (rounded < 0) return `-$${abs}`;
  return signed ? `+$${abs}` : `$${abs}`;
}

export function usdK(v: unknown): string {
  if (!isNum(v)) return DASH;
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${sign}$${Math.round(abs / 1e3)}K`;
  return usd(v);
}

export function pctText(v: unknown, dec = 1, signed = false): string {
  if (!isNum(v)) return DASH;
  const p = v * 100;
  const rounded = Number(p.toFixed(dec));
  if (Object.is(rounded, -0) || rounded === 0) return (0).toFixed(dec) + "%";
  const prefix = signed && rounded > 0 ? "+" : "";
  return `${prefix}${rounded.toFixed(dec)}%`;
}

/**
 * Computes favorable/unfavorable tone from a difference (actual - budget, or new - prior).
 * dir = 1 (income/profit): higher is favorable (green), lower is unfavorable (red).
 * dir = -1 (COGS/expenses): lower is favorable (green), higher is unfavorable (red).
 */
export function varianceTone(diff: number | null, dir: 1 | -1): Tone {
  if (!isNum(diff) || Math.abs(diff) < 0.5) return undefined;
  const favorable = dir === 1 ? diff > 0 : diff < 0;
  return favorable ? "success" : "danger";
}

export type Variance = {
  diff: number | null;
  pct: number | null;
  tone: Tone;
};

export function computeVariance(current: number | null | undefined, baseline: number | null | undefined, dir: 1 | -1): Variance {
  if (!isNum(current) || !isNum(baseline)) {
    return { diff: null, pct: null, tone: undefined };
  }
  const diff = current - baseline;
  const pct = baseline !== 0 ? diff / Math.abs(baseline) : null;
  return { diff, pct, tone: varianceTone(diff, dir) };
}

export function sumNums(arr: (number | null | undefined)[]): number | null {
  let sum = 0;
  let any = false;
  for (const x of arr) {
    if (isNum(x)) {
      sum += x;
      any = true;
    }
  }
  return any ? sum : null;
}

export function lineYtd(line: BudgetLine, upToMonthIdx?: number): {
  actual27: number | null;
  budget27Actualized: number | null;
  budget27Through: number | null;
  basis26Actualized: number | null;
  basis26Through: number | null;
  actualizedCount: number;
} {
  const limit = upToMonthIdx === undefined ? 11 : Math.max(0, Math.min(11, upToMonthIdx));
  let actual27 = 0;
  let budget27Actualized = 0;
  let budget27Through = 0;
  let basis26Actualized = 0;
  let basis26Through = 0;
  let actualizedCount = 0;
  let hasB27 = false;
  let hasB26 = false;

  for (let i = 0; i <= limit; i++) {
    const a27 = line.m2027_actual[i];
    const b27 = line.m2027_budget[i];
    const b26 = line.m2026[i];
    if (isNum(b27)) {
      budget27Through += b27;
      hasB27 = true;
    }
    if (isNum(b26)) {
      basis26Through += b26;
      hasB26 = true;
    }
    if (isNum(a27)) {
      actualizedCount += 1;
      actual27 += a27;
      if (isNum(b27)) budget27Actualized += b27;
      if (isNum(b26)) basis26Actualized += b26;
    }
  }

  return {
    actual27: actualizedCount > 0 ? actual27 : null,
    budget27Actualized: actualizedCount > 0 ? budget27Actualized : null,
    budget27Through: hasB27 ? budget27Through : null,
    basis26Actualized: actualizedCount > 0 ? basis26Actualized : null,
    basis26Through: hasB26 ? basis26Through : null,
    actualizedCount,
  };
}

export function cumulativeArray(arr: (number | null)[]): (number | null)[] {
  let run = 0;
  let any = false;
  return arr.map((v) => {
    if (!isNum(v)) return null;
    run += v;
    any = true;
    return any ? run : null;
  });
}

export function latestActualMonthIndex(status2027: MonthStatus2027[]): number {
  for (let i = status2027.length - 1; i >= 0; i--) {
    if (status2027[i] === "Actual") return i;
  }
  return 0;
}
