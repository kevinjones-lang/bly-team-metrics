// Field mapping for the flat Universal eXp-to-eXp referral PDF.
// Coordinates are measured from the top-left of a 612×792 page (PyMuPDF / the rendered form).
// pdf-lib draws from the bottom, so fillers convert with pdfBaseline().
import { chicagoToday, isEmail, type Side } from "./logic.ts";

export const PDF_PAGE = { width: 612, height: 792 } as const;

export const ORIGINATING = {
  brokerage: "The Bly Team / eXp Realty, LLC",
  agentName: "Deborah G. Bly",
  phone: "281-782-5313",
  email: "team@agentbly.com",
} as const;

export const DEFAULT_FEE_PERCENT = "25";
export const DEFAULT_RECEIVING_BROKERAGE = "eXp Realty, LLC";
export const DEFAULT_GOVERNING_LAW = "the State of Texas";

/** Underscore blank. `top` is the text baseline distance from the top of the page. */
export type LineBlank = { page: 0 | 1 | 2; x: number; top: number; right: number };

export type Box = { x: number; top: number; size: number };

export const BLANKS = {
  originatingBrokerage: { page: 0, x: 159.6, top: 118.7, right: 531.7 },
  originatingAgent: { page: 0, x: 177.1, top: 139.7, right: 530.9 },
  originatingPhone: { page: 0, x: 221.6, top: 160.7, right: 532.7 },
  originatingEmail: { page: 0, x: 221, top: 181.7, right: 532.1 },
  receivingBrokerage: { page: 0, x: 154.7, top: 237.2, right: 526.8 },
  receivingAgent: { page: 0, x: 172.2, top: 258.9, right: 526 },
  receivingPhone: { page: 0, x: 219, top: 280.7, right: 530.1 },
  receivingEmail: { page: 0, x: 219.1, top: 302.4, right: 530.3 },
  opportunityId: { page: 0, x: 165.7, top: 365.4, right: 531.7 },
  clientName: { page: 0, x: 126, top: 385.7, right: 534.8 },
  clientPhone: { page: 0, x: 126.7, top: 405.9, right: 535.4 },
  clientEmail: { page: 0, x: 126, top: 426.2, right: 534.8 },
  termStart: { page: 0, x: 309.8, top: 465.6, right: 358.6 },
  termEnd: { page: 0, x: 431.2, top: 465.6, right: 480 },
  feePercent: { page: 0, x: 130.8, top: 704.7, right: 167.4 },
  feeFlat: { page: 0, x: 169.2, top: 719.2, right: 218 },
  governingLaw: { page: 1, x: 40, top: 210, right: 560 },
  paymentTo: { page: 1, x: 236, top: 573.7, right: 394 },
  originatingSignBrokerage: { page: 2, x: 41.5, top: 223.5, right: 255.1 },
  receivingSignBrokerage: { page: 2, x: 317.5, top: 223.5, right: 531.1 },
} as const satisfies Record<string, LineBlank>;

/** Additional Terms block. `top` and `bottom` are baselines measured from the top of page 2. */
export const ADDITIONAL_TERMS_BOX = { page: 1 as const, x: 40, top: 86, right: 560, bottom: 136 };

export const BOXES = {
  buy: { x: 42.48, top: 567.31, size: 10.12 },
  sell: { x: 42.48, top: 582.5, size: 10.12 },
  lease: { x: 42.48, top: 597.5, size: 10.12 },
  other: { x: 42.48, top: 612.5, size: 10.12 },
  percent: { x: 114.48, top: 695.51, size: 10.12 },
  flat: { x: 114.48, top: 710, size: 10.12 },
} as const satisfies Record<string, Box>;

export type Contract = "buy" | "sell" | "lease" | "other";
export type ContractChoice = Contract | "";
export type FeeKind = "percent" | "flat";

export type ReferralForm = {
  originatingBrokerage: string;
  originatingAgent: string;
  originatingPhone: string;
  originatingEmail: string;
  receivingBrokerage: string;
  receivingAgent: string;
  receivingPhone: string;
  receivingEmail: string;
  opportunityId: string;
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  contract: ContractChoice;
  termStart: string;
  termEnd: string;
  feeKind: FeeKind;
  feePercent: string;
  feeFlat: string;
  governingLaw: string;
  additionalTerms: string;
  paymentTo: string;
  /** Bly Team agent who owns the Follow Up Boss lead. Email only — not the PDF originating agent. */
  blyAgent: string;
};

export type FormSeed = {
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  location?: string | null;
  side?: Side | null;
  timeline?: string | null;
  notes?: string | null;
  fubPersonId?: string | null;
  referralId?: string | null;
  receivingAgent?: string | null;
  receivingEmail?: string | null;
  receivingPhone?: string | null;
  receivingBrokerage?: string | null;
  blyAgent?: string | null;
};

export function pdfBaseline(top: number, pageHeight = PDF_PAGE.height): number {
  return pageHeight - top;
}

export function pdfBox(box: Box, pageHeight = PDF_PAGE.height): { x: number; y: number; size: number } {
  return { x: box.x, y: pageHeight - (box.top + box.size), size: box.size };
}

export function addYearsIso(iso: string, years: number): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return iso;
  const dt = new Date(Date.UTC(y + years, m - 1, d));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/** Short date for the term blanks (about 49pt wide). */
export function shortUsDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  if (!y || !m || !d) return "";
  return `${m}/${d}/${y.slice(-2)}`;
}

export function contractFromSide(side: Side | null | undefined): ContractChoice {
  switch (side) {
    case "buyer": return "buy";
    case "seller": return "sell";
    case "lease": return "lease";
    case null:
    case undefined:
      return "";
    default: {
      const _n: never = side;
      return _n;
    }
  }
}

export function sideForContract(contract: ContractChoice): Side | null {
  switch (contract) {
    case "buy": return "buyer";
    case "sell": return "seller";
    case "lease": return "lease";
    case "other":
    case "":
      return null;
    default: {
      const _n: never = contract;
      return _n;
    }
  }
}

export function opportunityId(seed: FormSeed): string {
  const fub = seed.fubPersonId?.trim();
  if (fub) return `FUB ${fub}`;
  const id = seed.referralId?.trim();
  return id ? id.slice(0, 8) : "";
}

export function defaultAdditionalTerms(seed: FormSeed): string {
  const lines = [
    "List Agent ID BLY. TREC 0383205. http://www.AgentBly.com",
    "Office: 2600 South Shore Blvd #300, League City, TX 77573. Office phone 888-519-7431.",
    "Broker TREC 603392. Licensed supervisor KAREN E. RICHARDS.",
    "Brokerage ID 153525992. eXp ID EXPD12.",
  ];
  const bits = [seed.location?.trim() ? `Location: ${seed.location.trim()}` : "", seed.timeline?.trim() ? `Timeline: ${seed.timeline.trim()}` : ""].filter(Boolean);
  if (bits.length) lines.push(`${bits.join(". ")}.`);
  if (seed.notes?.trim()) lines.push(seed.notes.trim());
  return lines.join("\n");
}

export function defaultReferralForm(seed: FormSeed, now = new Date()): ReferralForm {
  const termStart = chicagoToday(now);
  return {
    originatingBrokerage: ORIGINATING.brokerage,
    originatingAgent: ORIGINATING.agentName,
    originatingPhone: ORIGINATING.phone,
    originatingEmail: ORIGINATING.email,
    receivingBrokerage: seed.receivingBrokerage?.trim() || DEFAULT_RECEIVING_BROKERAGE,
    receivingAgent: seed.receivingAgent?.trim() ?? "",
    receivingPhone: seed.receivingPhone?.trim() ?? "",
    receivingEmail: seed.receivingEmail?.trim() ?? "",
    opportunityId: opportunityId(seed),
    clientName: seed.clientName.trim(),
    clientPhone: seed.clientPhone.trim(),
    clientEmail: seed.clientEmail.trim(),
    contract: contractFromSide(seed.side),
    termStart,
    termEnd: addYearsIso(termStart, 1),
    feeKind: "percent",
    feePercent: DEFAULT_FEE_PERCENT,
    feeFlat: "",
    governingLaw: DEFAULT_GOVERNING_LAW,
    additionalTerms: defaultAdditionalTerms(seed),
    paymentTo: ORIGINATING.brokerage,
    blyAgent: seed.blyAgent?.trim() ?? "",
  };
}

export function checkedBoxes(form: ReferralForm): Array<keyof typeof BOXES> {
  const boxes: Array<keyof typeof BOXES> = [];
  switch (form.contract) {
    case "buy":
    case "sell":
    case "lease":
    case "other":
      boxes.push(form.contract);
      break;
    case "":
      break;
    default: {
      const _n: never = form.contract;
      return _n;
    }
  }
  switch (form.feeKind) {
    case "percent":
      boxes.push("percent");
      break;
    case "flat":
      boxes.push("flat");
      break;
    default: {
      const _n: never = form.feeKind;
      return _n;
    }
  }
  return boxes;
}

export type HandoffCheck = "preview" | "draft";

/** Preview checks the PDF fields. The Follow Up Boss owner is required only when creating the Outlook draft. */
export function validateHandoff(form: ReferralForm, purpose: HandoffCheck = "draft"): string | null {
  if (!form.originatingAgent.trim()) return "Originating agent name is required. Paperwork uses Deborah G. Bly.";
  if (!form.originatingBrokerage.trim()) return "Originating brokerage is required.";
  if (form.originatingEmail.trim() && !isEmail(form.originatingEmail)) return "Originating agent email is not valid.";
  if (!form.receivingAgent.trim()) return "Receiving agent name is required.";
  if (!isEmail(form.receivingEmail)) return "Receiving agent email is required.";
  if (form.receivingPhone.trim().length > 40) return "Receiving agent phone is too long.";
  if (form.receivingBrokerage.trim().length > 200) return "Receiving brokerage is too long.";
  if (!form.clientName.trim()) return "Client name is required.";
  if (form.clientName.trim().length > 200) return "Client name is too long.";
  if (!isEmail(form.clientEmail)) return "Client email is required.";
  if (form.clientPhone.replace(/\D/g, "").length < 7) return "Client phone is required.";
  switch (purpose) {
    case "preview":
      if (form.blyAgent.trim().length > 200) return "Bly Team agent name is too long.";
      break;
    case "draft":
      if (!form.blyAgent.trim()) return "Name the Bly Team agent who owns this lead in Follow Up Boss. That name goes in the email, not on the originating-agent line.";
      if (form.blyAgent.trim().length > 200) return "Bly Team agent name is too long.";
      break;
    default: {
      const _n: never = purpose;
      return _n;
    }
  }
  switch (form.contract) {
    case "buy":
    case "sell":
    case "lease":
    case "other":
      break;
    case "":
      return "Choose buy, sell, or lease.";
    default: {
      const _n: never = form.contract;
      return _n;
    }
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(form.termStart) || !/^\d{4}-\d{2}-\d{2}$/.test(form.termEnd)) return "Term start and end are required.";
  if (form.termEnd < form.termStart) return "Term end is before the start.";
  switch (form.feeKind) {
    case "percent": {
      const n = Number(form.feePercent);
      if (!Number.isFinite(n) || n <= 0 || n > 100) return "Referral fee percent must be between 1 and 100.";
      break;
    }
    case "flat":
      if (!form.feeFlat.trim()) return "Enter the flat referral fee.";
      break;
    default: {
      const _n: never = form.feeKind;
      return _n;
    }
  }
  return null;
}

/** WinAnsi-safe text for pdf-lib standard fonts. */
export function toWinAnsi(text: string): string {
  const cleaned = text.normalize("NFKD").replace(/\p{M}/gu, "");
  let out = "";
  for (const ch of cleaned) {
    const code = ch.codePointAt(0) ?? 0;
    if ((code >= 32 && code <= 126) || (code >= 160 && code <= 255)) out += ch;
    else if (ch === "\n" || ch === "\t") out += ch;
    else out += " ";
  }
  return out.replace(/[ \t]+\n/g, "\n").replace(/[ ]{2,}/g, " ");
}
