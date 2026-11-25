#!/usr/bin/env node
/**
 * Builds the 2027 Budget vs Actual JSON payload (schema budget.v1) for the Bly Team metrics site.
 * Sources (no secrets / no API keys):
 *   1. Cached Google Sheet snapshot (/workspace/metrics/bly_sheet/budget2027_latest.json,
 *      refreshed from Google Sheet 1XxXvaGRpa5DlAJ4bxbTQrnN4SIu0y2rV9_w9Jj0clgQ via refresh_bly_sheet.py --budget)
 *      or fallback to /workspace/budget2027/out_tsv/*.tsv
 *   2. Tax In-House P&L (/workspace/metrics/pnl/pnl.json) for actuals as monthly P&Ls arrive on the 15th.
 *
 * Usage:
 *   node scripts/gen-budget.mjs [--sheet path] [--pnl path] [--out path]
 */
import fs from "node:fs";
import path from "node:path";

const SHEET_ID = "1XxXvaGRpa5DlAJ4bxbTQrnN4SIu0y2rV9_w9Jj0clgQ";
const SHEET_NAME = "Bly Team 2027 Budget";
const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit`;

const args = process.argv.slice(2);
const arg = (flag, def) => {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
};

function chicagoNowParts() {
  const now = new Date();
  const dateFmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const timeFmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(now);
  return {
    date: dateFmt,
    label: `${dateFmt} ${timeFmt} CT`,
    iso: now.toISOString(),
  };
}

const ct = chicagoNowParts();
const sheetPath = arg("--sheet", "/workspace/metrics/bly_sheet/budget2027_latest.json");
const pnlPath = arg("--pnl", "/workspace/metrics/pnl/pnl.json");
const outPath = arg("--out", `/workspace/metrics/data/${ct.date}/budget.json`);

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQ = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQ = true;
    } else if (ch === ",") {
      row.push(cur);
      cur = "";
    } else if (ch === "\n") {
      row.push(cur);
      rows.push(row);
      row = [];
      cur = "";
    } else if (ch !== "\r") {
      cur += ch;
    }
  }
  if (cur.length || row.length) {
    row.push(cur);
    rows.push(row);
  }
  return rows;
}

function parseTsv(text) {
  return text.split(/\r?\n/).filter((l) => l.length > 0).map((l) => l.split("\t"));
}

function num(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = String(v).trim();
  if (!s || s === "-" || s === "–" || s === "—") return null;
  const neg = s.startsWith("(") && s.endsWith(")");
  const cleaned = s.replace(/[(),$\s]/g, "");
  const isPct = cleaned.endsWith("%");
  const n = Number(isPct ? cleaned.slice(0, -1) : cleaned);
  if (!Number.isFinite(n)) return null;
  const val = isPct ? n / 100 : n;
  return neg ? -val : val;
}

function loadTabs() {
  if (fs.existsSync(sheetPath)) {
    const raw = JSON.parse(fs.readFileSync(sheetPath, "utf8"));
    const tabs = {};
    for (const r of raw.ranges || []) {
      tabs[r.sheet] = parseCsv(r.content || "");
    }
    return {
      tabs,
      readAt: raw.read_at || ct.date,
      origin: "google-sheet-cache",
    };
  }
  const tsvDir = "/workspace/budget2027/out_tsv";
  if (fs.existsSync(tsvDir)) {
    const map = {
      Summary: "Summary.tsv",
      Assumptions: "Assumptions.tsv",
      "2027 Budget": "2027_Budget.tsv",
      "2026 Actuals": "2026_Actuals.tsv",
      "2027 Actuals": "2027_Actuals.tsv",
    };
    const tabs = {};
    for (const [k, f] of Object.entries(map)) {
      const p = path.join(tsvDir, f);
      if (fs.existsSync(p)) tabs[k] = parseTsv(fs.readFileSync(p, "utf8"));
    }
    return { tabs, readAt: ct.date, origin: "local-tsv-fallback" };
  }
  throw new Error(`Neither sheet cache (${sheetPath}) nor TSV fallback exists.`);
}

const MAJOR_DEFS = [
  { type: "tot", label: "Total Income", key: "income", dir: 1 },
  { type: "tot", label: "Total Cost of Sales", key: "cogs", dir: -1 },
  { type: "key", label: "GROSS PROFIT", key: "gross_profit", dir: 1 },
  { type: "tot", label: "Total Operating Expenses", key: "opex", dir: -1 },
  { type: "key", label: "NET OPERATING INCOME", key: "noi", dir: 1 },
  { type: "tot", label: "Total Other Income", key: "other_income", dir: 1 },
  { type: "key", label: "NET INCOME", key: "net_income", dir: 1 },
];

const GROUP_KEYS = {
  "Payroll & Staffing (61000)": "opex_61000",
  "Lead Generation & Marketing (62000)": "opex_62000",
  "Occupancy (63000)": "opex_63000",
  "Technology & Communication (64000)": "opex_64000",
  "Education, Coaching & Dues (65000)": "opex_65000",
  "Automobile (66000)": "opex_66000",
  "Equipment & Office (67000 / 68000)": "opex_67000_68000",
  "Insurance & Other (69000)": "opex_69000",
  "Unclassified (Ask My Accountant)": "opex_unclassified",
};

const { tabs, readAt } = loadTabs();
const budRows = tabs["2027 Budget"] || [];
const act26Rows = tabs["2026 Actuals"] || [];
const act27Rows = tabs["2027 Actuals"] || [];
const assumpRows = tabs["Assumptions"] || [];

const findRow = (rows, type, label) =>
  rows.find((r) => (r[0] || "").trim() === type && (r[1] || "").trim() === label);

const status26Row = act26Rows.find((r) => (r[1] || "").trim() === "Status →") || [];
const status27Row = act27Rows.find((r) => (r[1] || "").trim() === "Status →") || [];

const status2026 = Array.from({ length: 12 }, (_, i) =>
  (status26Row[2 + i] || "").trim() === "Actual" ? "Actual" : "Estimate",
);
const status2027 = Array.from({ length: 12 }, (_, i) =>
  (status27Row[2 + i] || "").trim() === "Actual" ? "Actual" : null,
);

const monthArr = (row, allowZeroIfMissing = false, statusMask = null) =>
  Array.from({ length: 12 }, (_, i) => {
    if (statusMask && statusMask[i] !== "Actual") return null;
    const v = num(row?.[2 + i]);
    if (v === null) return allowZeroIfMissing ? 0 : null;
    return Math.round(v * 100) / 100;
  });

const round2 = (v) => (v === null || v === undefined ? null : Math.round(v * 100) / 100);
const sumArr = (arr) => {
  const vals = arr.filter((x) => x !== null && x !== undefined);
  return vals.length ? round2(vals.reduce((a, b) => a + b, 0)) : null;
};

// Parse Assumptions metadata + line-level spread/notes
const findAssump = (label) => assumpRows.find((r) => (r[0] || "").trim() === label);
const spreadByAcct = {};
const noteByAcct = {};
for (const r of assumpRows) {
  const t = (r[0] || "").trim();
  const acct = (r[1] || "").trim();
  if (["INC", "COGS", "EXP", "OI"].includes(t) && acct) {
    if (r[11]) spreadByAcct[acct] = String(r[11]).trim();
    if (r[12]) noteByAcct[acct] = String(r[12]).trim();
  }
}

function buildLine(key, label, dir, type, budRow, a26Row, a27Row) {
  const m2026 = monthArr(a26Row, true);
  const m2027_budget = monthArr(budRow, true);
  const m2027_actual = monthArr(a27Row, true, status2027);
  const ytd26 = sumArr(m2026.filter((_, i) => status2026[i] === "Actual"));
  const basis26 = round2(num(a26Row?.[15])) ?? sumArr(m2026);
  const fy27 = round2(num(budRow?.[14])) ?? sumArr(m2027_budget);
  return {
    key,
    label,
    dir,
    m2026,
    m2027_budget,
    m2027_actual,
    ytd_2026_actual: ytd26,
    basis_2026: basis26,
    fy_2027_budget: fy27,
  };
}

const majorLines = MAJOR_DEFS.map((d) =>
  buildLine(
    d.key,
    d.label,
    d.dir,
    d.type,
    findRow(budRows, d.type, d.label),
    findRow(act26Rows, d.type, d.label),
    findRow(act27Rows, d.type, d.label),
  ),
);

const opexGroups = Object.entries(GROUP_KEYS).map(([label, key]) =>
  buildLine(
    key,
    label,
    -1,
    "grp",
    findRow(budRows, "grp", label),
    findRow(act26Rows, "grp", label),
    findRow(act27Rows, "grp", label),
  ),
);

const accounts = [];
let currentGroup = undefined;
for (const r of budRows) {
  const t = (r[0] || "").trim();
  const acct = (r[1] || "").trim();
  if (t === "grp") {
    currentGroup = acct;
    continue;
  }
  if (!["INC", "COGS", "EXP", "OI"].includes(t) || !acct) continue;
  const dir = t === "INC" || t === "OI" ? 1 : -1;
  const a26 = findRow(act26Rows, t, acct);
  const a27 = findRow(act27Rows, t, acct);
  const base = buildLine(acct, acct, dir, t, r, a26, a27);
  accounts.push({
    ...base,
    type: t,
    ...(t === "EXP" && currentGroup ? { group: currentGroup } : {}),
    ...(spreadByAcct[acct] ? { spread: spreadByAcct[acct] } : {}),
    ...(noteByAcct[acct] || a26?.[17] ? { note: String(noteByAcct[acct] || a26?.[17]).trim() } : {}),
  });
}

// Overlay Tax In-House P&L (pnl.json) for any months closed in pnl.json after the sheet snapshot
let pnlSource = { source: "Tax In-House P&L", through: "2026-10" };
if (fs.existsSync(pnlPath)) {
  const pnl = JSON.parse(fs.readFileSync(pnlPath, "utf8"));
  const rep = (pnl.reports || []).slice(-1)[0];
  pnlSource = {
    source: pnl.source || "Tax In-House P&L",
    through: rep?.through || (pnl.canvas?.ms || []).slice(-1)[0] || "2026-10",
  };
  const pnlRows = rep?.rows || {};
  const PNL_MAJOR_MAP = {
    income: "Total for Income",
    cogs: "Total for Cost of Goods Sold",
    gross_profit: "Gross Profit",
    opex: "Total for Expenses",
    noi: "Net Operating Income",
    other_income: "Total for Other Income",
    net_income: "Net Income",
  };
  // Check 2026-11 and 2026-12 if closed in pnl.json while sheet still says Estimate
  for (const mIdx of [10, 11]) {
    const mk = `2026-${String(mIdx + 1).padStart(2, "0")}`;
    const hasMonth = Object.values(pnlRows).some((row) => mk in row);
    if (hasMonth && status2026[mIdx] !== "Actual") {
      status2026[mIdx] = "Actual";
      for (const ml of majorLines) {
        const pLabel = PNL_MAJOR_MAP[ml.key];
        if (pLabel && pnlRows[pLabel] && mk in pnlRows[pLabel]) {
          ml.m2026[mIdx] = round2(pnlRows[pLabel][mk]);
        }
      }
      for (const acc of accounts) {
        if (pnlRows[acc.label]) {
          acc.m2026[mIdx] = round2(pnlRows[acc.label][mk] ?? 0);
        }
      }
    }
  }
  // Check 2027-01..2027-12 if closed in pnl.json while sheet 2027 Actuals doesn't have them yet
  for (let mIdx = 0; mIdx < 12; mIdx++) {
    const mk = `2027-${String(mIdx + 1).padStart(2, "0")}`;
    const hasMonth = Object.values(pnlRows).some((row) => mk in row);
    if (hasMonth && status2027[mIdx] !== "Actual") {
      status2027[mIdx] = "Actual";
      for (const ml of majorLines) {
        const pLabel = PNL_MAJOR_MAP[ml.key];
        if (pLabel && pnlRows[pLabel]) {
          ml.m2027_actual[mIdx] = round2(pnlRows[pLabel][mk] ?? 0);
        }
      }
      for (const acc of accounts) {
        if (pnlRows[acc.label]) {
          acc.m2027_actual[mIdx] = round2(pnlRows[acc.label][mk] ?? 0);
        }
      }
      // Recompute Opex groups from EXP accounts when pnl.json supplies a 2027 month
      for (const grp of opexGroups) {
        const children = accounts.filter((a) => a.type === "EXP" && a.group === grp.label);
        const s = sumArr(children.map((c) => c.m2027_actual[mIdx]));
        if (s !== null) grp.m2027_actual[mIdx] = s;
      }
    }
  }
  // Recompute ytd_2026_actual and basis_2026 in case 2026-11/12 flipped to Actual
  for (const list of [majorLines, opexGroups, accounts]) {
    for (const ln of list) {
      ln.ytd_2026_actual = sumArr(ln.m2026.filter((_, i) => status2026[i] === "Actual"));
      ln.basis_2026 = sumArr(ln.m2026);
    }
  }
}

// Tie-out sanity check
const byKey = Object.fromEntries(majorLines.map((l) => [l.key, l]));
const opexSum27 = round2(opexGroups.reduce((s, g) => s + (g.fy_2027_budget || 0), 0));
if (Math.abs(opexSum27 - (byKey.opex?.fy_2027_budget || 0)) > 0.05) {
  throw new Error(`Opex groups sum ${opexSum27} !== Total Opex ${byKey.opex?.fy_2027_budget}`);
}

const actualized2027 = status2027.filter((s) => s === "Actual").length;
const ratio = (a, b) => (a !== null && b !== null && b !== 0 ? a / b : null);

const inc = byKey.income;
const gp = byKey.gross_profit;
const net = byKey.net_income;
const inc27Ytd = sumArr(inc.m2027_actual);
const gp27Ytd = sumArr(gp.m2027_actual);
const net27Ytd = sumArr(net.m2027_actual);

const amaAcc = accounts.find((a) => a.label === "Ask My Accountant");

const payload = {
  schema: "budget.v1",
  generated: ct.label,
  generated_iso: ct.iso,
  sheet: {
    id: SHEET_ID,
    name: SHEET_NAME,
    url: SHEET_URL,
    owner_only: true,
    read_at: readAt,
    source_label: `${SHEET_NAME} Google Sheet (owner-only) + Tax In-House P&L`,
  },
  pnl_source: pnlSource,
  assumptions: {
    income_method: String(findAssump("Income method")?.[1] ?? "Growth %"),
    income_growth_pct: num(findAssump("2027 income growth vs 2026 basis")?.[1]),
    closed_unit_goal: num(findAssump("2027 closed-unit goal (units method)")?.[1]),
    nov_dec_method: String(findAssump("Nov–Dec 2026 income estimate method")?.[1] ?? "10-month average"),
    opex_growth_pct: num(findAssump("Default 2027 growth: operating expenses & fixed COGS")?.[1]),
    other_income_growth_pct: num(findAssump("Default 2027 growth: other income")?.[1]),
    ask_my_accountant_2027: amaAcc?.fy_2027_budget ?? 0,
    ask_my_accountant_2026: amaAcc?.basis_2026 ?? 0,
    notes: [
      "2026 Jan–Oct actuals tie to $0 difference against the Tax In-House P&L by Month (Oct 2026 close).",
      "2026 Nov–Dec figures are estimates until closed P&L actuals arrive and are labeled Est.",
      "Unclassified Ask My Accountant ($22,368 in Sep–Oct 2026) is set to $0 in the default 2027 budget.",
      "Fixed annual fees (eXp $16,000 cap, $750 liability fee, $9,915 property tax) carry no Nov–Dec run-rate and keep their 2026 pattern in 2027.",
    ],
  },
  months: Array.from({ length: 12 }, (_, i) => `2027-${String(i + 1).padStart(2, "0")}`),
  month_labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  status_2026: status2026,
  status_2027: status2027,
  actualized_months_2027: actualized2027,
  major_lines: majorLines,
  opex_groups: opexGroups,
  accounts,
  margins: {
    gross_2026_ytd_actual: ratio(gp.ytd_2026_actual, inc.ytd_2026_actual),
    gross_2026_basis: ratio(gp.basis_2026, inc.basis_2026),
    gross_2027_budget: ratio(gp.fy_2027_budget, inc.fy_2027_budget),
    gross_2027_ytd_actual: ratio(gp27Ytd, inc27Ytd),
    net_2026_ytd_actual: ratio(net.ytd_2026_actual, inc.ytd_2026_actual),
    net_2026_basis: ratio(net.basis_2026, inc.basis_2026),
    net_2027_budget: ratio(net.fy_2027_budget, inc.fy_2027_budget),
    net_2027_ytd_actual: ratio(net27Ytd, inc27Ytd),
  },
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(payload, null, 2));
console.log(
  `gen-budget: wrote ${outPath} | 2027 budget income $${Math.round(inc.fy_2027_budget).toLocaleString("en-US")} | net $${Math.round(net.fy_2027_budget).toLocaleString("en-US")} | 2027 actualized ${actualized2027}/12`,
);
