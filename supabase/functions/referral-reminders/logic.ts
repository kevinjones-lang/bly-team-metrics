// Pure follow-up plan. No Slack calls and no database access.
// Biweekly until connected, then monthly, from the row's cadence and next_touch_on.
// Six months without a touch is flagged for Nurture. It is not moved here.

export const REFERRAL_SITE = "https://kevinjones-lang.github.io/bly-team-metrics/";

const FOLLOW_UP = new Set(["sent", "connected", "monthly_check"]);

export type Cadence = "biweekly" | "monthly";

export type ReminderRow = {
  id: string;
  clientName: string;
  location: string;
  status: string;
  cadence: string;
  fubOwner: string;
  receivingAgent: string;
  nextTouchOn: string | null;
  lastTouchAt: string;
  lastReminderAt: string | null;
};

export type StaffContact = {
  fullName: string;
  slackUserId: string;
  email: string;
};

export type PlannedReminder = {
  referralId: string;
  clientName: string;
  kind: "follow_up" | "nurture";
  cadence: Cadence | null;
  ownerName: string;
  delivery: "dm" | "channel" | "undeliverable";
  slackUserId: string | null;
  text: string;
};

export type PublicReminder = {
  referralId: string;
  clientName: string;
  kind: "follow_up" | "nurture";
  cadence: Cadence | null;
  ownerName: string;
  delivery: "dm" | "channel" | "undeliverable";
  text: string;
};

const FIRST_NAME_ALIASES: Record<string, string> = {
  deb: "deborah",
  debbie: "deborah",
  kim: "kimberley",
  kimberly: "kimberley",
};

export function chicagoToday(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function recordUrl(id: string): string {
  return `${REFERRAL_SITE}#/referrals/${id}`;
}

function nameTokens(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 1)
    .map((token) => FIRST_NAME_ALIASES[token] ?? token);
}

function sameTokens(a: string[], b: string[]): boolean {
  if (a.length === 0 || a.length !== b.length) return false;
  return a.every((token, i) => token === b[i]);
}

/** Match the Follow Up Boss owner name to one active staff row. */
export function matchStaff(owner: string, staff: StaffContact[]): StaffContact | null {
  const want = nameTokens(owner);
  if (!want.length) return null;
  const keyed = staff
    .map((person) => ({ person, tokens: nameTokens(person.fullName) }))
    .filter((row) => row.tokens.length > 0);
  const exact = keyed.filter((row) => sameTokens(want, row.tokens));
  if (exact.length === 1) return exact[0].person;
  if (exact.length > 1) return null;
  if (want.length === 1) {
    const first = keyed.filter((row) => row.tokens[0] === want[0]);
    if (first.length === 1) return first[0].person;
    const last = keyed.filter((row) => row.tokens[row.tokens.length - 1] === want[0]);
    if (last.length === 1) return last[0].person;
  }
  const contained = keyed.filter((row) => want.every((token) => row.tokens.includes(token)));
  if (contained.length === 1) return contained[0].person;
  return null;
}

function cadenceOf(value: string): Cadence | null {
  if (value === "biweekly" || value === "monthly") return value;
  return null;
}

function remindedOnOrAfter(lastReminderAt: string | null, day: string): boolean {
  if (!lastReminderAt) return false;
  const reminded = new Date(lastReminderAt);
  if (Number.isNaN(reminded.getTime())) return false;
  return chicagoToday(reminded) >= day.slice(0, 10);
}

function cadenceDays(status: string, cadence: Cadence | null): number {
  if (status === "monthly_check" || cadence === "monthly") return 30;
  return 14;
}

/** True when a reminder already went out inside the current cadence window. */
function remindedRecently(lastReminderAt: string | null, now: Date, days: number): boolean {
  if (!lastReminderAt) return false;
  const reminded = new Date(lastReminderAt);
  if (Number.isNaN(reminded.getTime())) return false;
  return now.getTime() - reminded.getTime() < days * 24 * 60 * 60 * 1000;
}

export function isSilent(lastTouchAt: string, now: Date): boolean {
  const touch = new Date(lastTouchAt);
  if (Number.isNaN(touch.getTime())) return false;
  const cutoff = new Date(now.getTime());
  cutoff.setUTCMonth(cutoff.getUTCMonth() - 6);
  return touch.getTime() < cutoff.getTime();
}

function cadenceLabel(cadence: Cadence | null, status: string): string {
  if (status === "monthly_check" || cadence === "monthly") return "monthly";
  if (cadence === "biweekly") return "biweekly until connected";
  return "the saved cadence";
}

function message(row: ReminderRow, kind: "follow_up" | "nurture", cadence: Cadence | null): string {
  const lines = [
    kind === "nurture"
      ? "Six months without a touch. Flag this referral for Nurture."
      : "Referral follow-up is due.",
    `Client: ${row.clientName.trim() || "Unnamed"}`,
    `Status: ${row.status}`,
    `Cadence: ${cadenceLabel(cadence, row.status)}`,
    `Market/area: ${row.location.trim() || "Not recorded"}`,
    `Receiving agent: ${row.receivingAgent.trim() || "Not recorded"}`,
    `Bly Team owner: ${row.fubOwner.trim() || "Not recorded"}`,
  ];
  if (row.nextTouchOn) lines.push(`Next touch: ${row.nextTouchOn.slice(0, 10)}`);
  if (kind === "nurture") {
    lines.push("Opening the Referral Hub board files untouched referrals into Nurture. This job only flags them.");
  }
  lines.push(`Record: ${recordUrl(row.id)}`);
  return lines.join("\n");
}

export function planReminders(rows: ReminderRow[], staff: StaffContact[], now: Date, channelConfigured: boolean): PlannedReminder[] {
  const today = chicagoToday(now);
  const planned: PlannedReminder[] = [];
  for (const row of rows) {
    if (row.status === "closed" || row.status === "nurture") continue;
    const silent = isSilent(row.lastTouchAt, now);
    const due = FOLLOW_UP.has(row.status) && Boolean(row.nextTouchOn) && row.nextTouchOn!.slice(0, 10) <= today;
    if (!silent && !due) continue;
    if (silent && remindedOnOrAfter(row.lastReminderAt, chicagoToday(new Date(row.lastTouchAt)))) continue;
    if (!silent && remindedRecently(row.lastReminderAt, now, cadenceDays(row.status, cadenceOf(row.cadence)))) continue;
    const kind = silent ? "nurture" : "follow_up";
    const cadence = cadenceOf(row.cadence);
    const staffHit = matchStaff(row.fubOwner, staff);
    const slackUserId = staffHit?.slackUserId.trim() || null;
    const delivery = slackUserId ? "dm" : channelConfigured ? "channel" : "undeliverable";
    planned.push({
      referralId: row.id,
      clientName: row.clientName,
      kind,
      cadence,
      ownerName: staffHit?.fullName || row.fubOwner.trim() || "Unassigned",
      delivery,
      slackUserId,
      text: message(row, kind, cadence),
    });
  }
  return planned;
}

export function toPublicReminders(items: PlannedReminder[]): PublicReminder[] {
  return items.map((item) => ({
    referralId: item.referralId,
    clientName: item.clientName,
    kind: item.kind,
    cadence: item.cadence,
    ownerName: item.ownerName,
    delivery: item.delivery,
    text: item.text,
  }));
}

export type DmBatch = {
  slackUserId: string;
  ownerName: string;
  text: string;
  referralIds: string[];
};

export function dmBatches(items: PlannedReminder[]): DmBatch[] {
  const groups = new Map<string, DmBatch>();
  for (const item of items) {
    if (!item.slackUserId) continue;
    const existing = groups.get(item.slackUserId);
    if (!existing) {
      groups.set(item.slackUserId, {
        slackUserId: item.slackUserId,
        ownerName: item.ownerName,
        text: item.text,
        referralIds: [item.referralId],
      });
      continue;
    }
    existing.text = `${existing.text}\n\n${item.text}`;
    existing.referralIds.push(item.referralId);
  }
  return [...groups.values()];
}

export function channelDigest(items: PlannedReminder[]): string {
  if (!items.length) return "";
  const lines = ["Referral Hub follow-ups", ""];
  for (const item of items) {
    const where = item.delivery === "dm" ? `DM ${item.ownerName}` : item.delivery === "channel" ? "channel only" : "no Slack destination";
    lines.push(`• ${item.clientName} — ${item.kind === "nurture" ? "Nurture flag" : "Follow-up"} — ${where}`);
    lines.push(recordUrl(item.referralId));
  }
  return lines.join("\n");
}
