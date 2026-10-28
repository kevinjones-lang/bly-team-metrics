// Pure referral rules: URLs, handoff copy, shortlist parsing, FUB id parsing.
// Status cadence (14 days, then 30) and the six-month nurture move are enforced in Postgres.
import { EXP_DIRECTORY_URL, EXP_GLOBAL_REFERRAL_URL, EXP_HUB_REFERRAL_URL, FFM_MAP_ID } from "../../supabase/functions/referral-agents/logic.ts";

export const STATUSES = ["new", "shortlist", "awaiting_pick", "sent", "connected", "monthly_check", "closed", "nurture"] as const;
export type Status = (typeof STATUSES)[number];

export const SIDES = ["buyer", "seller", "lease"] as const;
export type Side = (typeof SIDES)[number];

export const REFERRAL_SITE = "https://kevinjones-lang.github.io/bly-team-metrics/";
/** Public Bly addresses. Override at build time with VITE_REFERRAL_CC (comma-separated). These are not API secrets. */
export const DEFAULT_HANDOFF_CC = ["Kevin.Jones@AgentBly.com", "Deb@AgentBly.com"] as const;

export const AGENT_SOURCES: { name: string; detail: string; href?: string }[] = [
  { name: "FFM map", detail: "Fast Forward Movement agents within 20 miles are the cards on the referral. This opens the same public map.", href: `https://www.google.com/maps/d/viewer?mid=${FFM_MAP_ID}` },
  { name: "eXp Agent Directory", detail: "Public directory of eXp Realty agents in the US and Canada. Search here when no Fast Forward agent is close enough. The directory blocks automated lookups, so this stays a link.", href: EXP_DIRECTORY_URL },
  { name: "eXp Hub — US Referral Network", detail: "Workplace group for the US referral network. Sign in, then paste the agent you choose.", href: EXP_HUB_REFERRAL_URL },
  { name: "Global Referral Platform", detail: "eXp agent directory and referral platform. Sign in required.", href: EXP_GLOBAL_REFERRAL_URL },
  { name: "eXp Agent Search", detail: "eXp Agent Portal (sign in with Okta) → Agent Search. Filter by miles, license state, Mentor, and ICON." },
];

export type ShortlistEntry = { name: string; email: string; raw: string };

export function isStatus(v: string): v is Status {
  return (STATUSES as readonly string[]).includes(v);
}

export function statusLabel(s: Status): string {
  switch (s) {
    case "new": return "New";
    case "shortlist": return "Shortlist";
    case "awaiting_pick": return "Awaiting pick";
    case "sent": return "Sent";
    case "connected": return "Connected";
    case "monthly_check": return "Monthly check";
    case "closed": return "Closed";
    case "nurture": return "Nurture";
    default: {
      const _n: never = s;
      return _n;
    }
  }
}

export function sideLabel(s: Side): string {
  switch (s) {
    case "buyer": return "Buyer";
    case "seller": return "Seller";
    case "lease": return "Lease";
    default: {
      const _n: never = s;
      return _n;
    }
  }
}

export function isSide(v: string): v is Side {
  return (SIDES as readonly string[]).includes(v);
}

export function isEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

export function blankToNull(v: string): string | null {
  const t = v.trim();
  return t ? t : null;
}

export type DraftInput = {
  client_name: string;
  client_email: string;
  client_phone: string;
  side: string;
};

/** Returns a staff-facing error, or null when the draft can be saved. */
export function validateDraft(d: DraftInput): string | null {
  if (!d.client_name.trim()) return "Name is required.";
  if (d.client_name.trim().length > 200) return "Name is too long.";
  if (!isEmail(d.client_email)) return "A valid email is required.";
  const digits = d.client_phone.replace(/\D/g, "");
  if (digits.length < 7) return "A phone number is required.";
  if (d.client_phone.trim().length > 40) return "Phone is too long.";
  if (d.side && !isSide(d.side)) return "Side must be buyer, seller, or lease.";
  return null;
}

export function referralRecordUrl(id: string): string {
  return `${REFERRAL_SITE}#/referrals/${id}`;
}

export function referralNewUrl(): string {
  return `${REFERRAL_SITE}#/referrals/new`;
}

/** Normalize a pasted id or URL into the columns we store. */
export function fubFields(raw: string): { fub_person_id: string; fub_url: string } {
  const text = raw.trim();
  if (!text) return { fub_person_id: "", fub_url: "" };
  const id = parseFubPersonId(text) ?? "";
  if (/^https?:\/\//i.test(text)) return { fub_person_id: id, fub_url: text };
  if (id) return { fub_person_id: id, fub_url: `https://agentbly1.followupboss.com/2/people/view/${id}` };
  return { fub_person_id: "", fub_url: text };
}

export function parseFubPersonId(input: string): string | null {
  const s = input.trim();
  if (/^\d{1,20}$/.test(s)) return s;
  try {
    const u = new URL(s);
    const parts = u.pathname.split("/").filter(Boolean);
    const view = parts.lastIndexOf("view");
    if (view >= 0 && /^\d{1,20}$/.test(parts[view + 1] ?? "")) return parts[view + 1];
    const people = parts.lastIndexOf("people");
    if (people >= 0 && /^\d{1,20}$/.test(parts[people + 1] ?? "")) return parts[people + 1];
    const q = u.searchParams.get("personId") || u.searchParams.get("id");
    if (q && /^\d{1,20}$/.test(q)) return q;
  } catch {
    /* not a url */
  }
  const m = s.match(/people\/(?:view\/)?(\d{1,20})/i);
  return m ? m[1] : null;
}

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

/** Showing agent cards moves a new referral onto the shortlist. Later statuses stay put. */
export function statusAfterOptions(status: Status): Status | null {
  switch (status) {
    case "new":
      return "shortlist";
    case "shortlist":
    case "awaiting_pick":
    case "sent":
    case "connected":
    case "monthly_check":
    case "closed":
    case "nurture":
      return null;
    default: {
      const _n: never = status;
      return _n;
    }
  }
}

/** Picking a card (or a pasted line) moves the shortlist to awaiting pick. Mail is the next step, not a status. */
export function statusAfterPick(status: Status): Status | null {
  switch (status) {
    case "new":
    case "shortlist":
      return "awaiting_pick";
    case "awaiting_pick":
    case "sent":
    case "connected":
    case "monthly_check":
    case "closed":
    case "nurture":
      return null;
    default: {
      const _n: never = status;
      return _n;
    }
  }
}

/** Keep a chosen agent on the pasted shortlist without duplicating their email. */
export function ensureShortlistLine(text: string, line: string): string {
  const trimmed = line.trim();
  if (!trimmed) return text;
  const email = parseShortlist(trimmed)[0]?.email.toLowerCase() ?? "";
  if (email && parseShortlist(text).some((entry) => entry.email.toLowerCase() === email)) return text;
  const base = text.trim();
  return base ? `${base}\n${trimmed}` : trimmed;
}

/** One agent per line. "Name <email>", "Name, email", "Name | email | market", or a bare email. */
export function parseShortlist(text: string): ShortlistEntry[] {
  const out: ShortlistEntry[] = [];
  for (const line of text.split(/\n+/)) {
    const raw = line.trim();
    if (!raw || raw.startsWith("#")) continue;
    const found = raw.match(EMAIL_RE);
    const email = found?.[0] ?? "";
    const rest = (email ? raw.replace(email, " ") : raw).replace(/[<>(),|]/g, " ");
    const name = (rest.split(/\s+[—–-]\s+/)[0] ?? "").replace(/\s+/g, " ").trim();
    out.push({ name: name || email, email, raw });
  }
  return out;
}

export function handoffCc(envList: string | undefined, isa: string | null | undefined, to: string): string[] {
  const parsed = (envList ?? "").split(/[,;]+/).map((s) => s.trim()).filter(Boolean);
  const base = parsed.length ? parsed : [...DEFAULT_HANDOFF_CC];
  const toNorm = to.trim().toLowerCase();
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of [...base, isa ?? ""]) {
    const email = raw.trim();
    const key = email.toLowerCase();
    if (!email || !isEmail(email) || key === toNorm || seen.has(key)) continue;
    seen.add(key);
    out.push(email);
  }
  return out;
}

export function handoffSubject(p: { client_name: string; location?: string | null; side?: Side | null }): string {
  const bits = [p.client_name.trim(), p.side ? sideLabel(p.side) : "", p.location?.trim() || ""].filter(Boolean);
  return `Bly Team referral — ${bits.join(" · ")}`;
}

export function handoffBody(p: {
  client_name: string;
  client_email: string;
  client_phone: string;
  location?: string | null;
  side?: Side | null;
  timeline?: string | null;
  notes?: string | null;
  receiving_agent?: string | null;
  /** Bly Team agent who owns the lead in Follow Up Boss. Not the originating agent on the PDF. */
  bly_agent?: string | null;
  recordUrl: string;
}): string {
  const first = p.receiving_agent?.trim().split(/\s+/)[0];
  const owner = p.bly_agent?.trim();
  const who = p.side ? `${p.client_name.trim()}, a ${sideLabel(p.side).toLowerCase()} client` : p.client_name.trim();
  const where = p.location?.trim() ? ` in ${p.location.trim()}` : "";
  const lines = [
    `Hi${first ? ` ${first}` : ""},`,
    "",
    `The Bly Team is referring ${who}${where}.`,
    "",
    `Name: ${p.client_name.trim()}`,
    `Email: ${p.client_email.trim()}`,
    `Phone: ${p.client_phone.trim()}`,
  ];
  if (p.timeline?.trim()) lines.push(`Timeline: ${p.timeline.trim()}`);
  if (p.notes?.trim()) lines.push(`Notes: ${p.notes.trim()}`);
  if (owner) lines.push("", `Bly Team agent for follow-up: ${owner}. That agent owns this lead.`);
  lines.push(
    "",
    `Referral record: ${p.recordUrl}`,
    "The filled Universal eXp-to-eXp Agent Referral Form is attached. Deborah G. Bly is the originating agent on that form.",
    "",
    "Please confirm once you have connected with them.",
    "",
    "Thank you,",
    "The Bly Team",
  );
  return lines.join("\n");
}

/** mailto cannot attach a PDF. The handoff creates an Outlook draft instead of using this. */
export function buildMailto(p: { to: string; cc: string[]; subject: string; body: string }): string {
  const parts = [`subject=${encodeURIComponent(p.subject)}`, `body=${encodeURIComponent(p.body)}`];
  if (p.cc.length) parts.unshift(`cc=${p.cc.map((e) => encodeURIComponent(e)).join(",")}`);
  return `mailto:${encodeURIComponent(p.to.trim())}?${parts.join("&")}`;
}

export function chicagoToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function isTouchDue(day: string | null, status: Status, now = new Date()): boolean {
  if (!day) return false;
  const due = day.slice(0, 10) <= chicagoToday(now);
  switch (status) {
    case "sent":
    case "connected":
    case "monthly_check":
      return due;
    case "new":
    case "shortlist":
    case "awaiting_pick":
    case "closed":
    case "nurture":
      return false;
    default: {
      const _n: never = status;
      return _n;
    }
  }
}

export function formatDay(day: string | null): string {
  if (!day) return "—";
  const [y, m, d] = day.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return day;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(y, m - 1, d));
}

export function formatWhen(iso: string | null): string {
  if (!iso) return "—";
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(dt);
}

export function humanError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/referrals/i.test(msg) && /schema cache|does not exist|relation/i.test(msg)) {
    return "The referrals table is not on this Supabase project yet. Apply supabase/migrations/20261027220000_referrals.sql to Agent Advantage Academy, then reload.";
  }
  if (/forbidden/i.test(msg)) return "Staff access is required for referrals.";
  return msg;
}
