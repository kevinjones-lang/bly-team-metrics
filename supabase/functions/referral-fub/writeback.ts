// Pure Follow Up Boss write-back plan. No network and no secrets.
// Updates one existing person: tag, stage, and a note. Never creates or merges contacts.

export const FUB_TAG = "Out-of-Area Referral";
export const FUB_STAGE = "Lead";
export const DEFAULT_FEE_TEXT = "25% of gross commission";

export type WritebackTarget = {
  referralId: string;
  personId: string;
  clientName: string;
  receivingAgent: string;
  brokerage: string;
  area: string;
  fee: string;
  recordUrl: string;
  when: Date;
};

export type WritebackPlan = {
  tag: string;
  stage: string;
  marker: string;
  noteSubject: string;
  noteBody: string;
  updateUrl: string;
  updateBody: { stage: string; tags: string[] };
};

export type StoredWriteback = {
  ok?: unknown;
  personId?: unknown;
  dryRun?: unknown;
  error?: unknown;
  noteId?: unknown;
};

export type FubSnapshot = {
  stage: string;
  tags: string[];
};

export type FubNoteSnap = {
  subject: string;
  body: string;
};

export type WritebackDecision =
  | { action: "already"; message: string }
  | { action: "preview"; message: string; preview: { tag: string; stage: string; note: string } }
  | { action: "apply"; plan: WritebackPlan };

const MISSING = "Not recorded";

export function referralMarker(referralId: string): string {
  return `referral:${referralId}`;
}

export function fubPersonUpdateUrl(personId: string): string {
  return `https://api.followupboss.com/v1/people/${encodeURIComponent(personId)}?mergeTags=true`;
}

export function fubNotesUrl(personId: string, offset = 0): string {
  const q = new URLSearchParams({ personId, limit: "100", offset: String(offset) });
  return `https://api.followupboss.com/v1/notes?${q.toString()}`;
}

function line(label: string, value: string): string {
  const text = value.trim();
  return `${label}: ${text || MISSING}`;
}

export function chicagoDate(when: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(when);
}

export function planWriteback(target: WritebackTarget): WritebackPlan {
  const marker = referralMarker(target.referralId);
  const noteBody = [
    "Out-of-area referral",
    marker,
    "",
    line("Client", target.clientName),
    line("Receiving agent", target.receivingAgent),
    line("Brokerage", target.brokerage),
    line("Market/area", target.area),
    line("Fee", target.fee.trim() || DEFAULT_FEE_TEXT),
    line("Date", chicagoDate(target.when)),
    "",
    `Referral record: ${target.recordUrl}`,
  ].join("\n");
  return {
    tag: FUB_TAG,
    stage: FUB_STAGE,
    marker,
    noteSubject: "Out-of-area referral",
    noteBody,
    updateUrl: fubPersonUpdateUrl(target.personId),
    updateBody: { stage: FUB_STAGE, tags: [FUB_TAG] },
  };
}

export function storedIsDone(stored: StoredWriteback | null, personId: string): boolean {
  if (!stored || stored.ok !== true) return false;
  return stored.personId === personId;
}

export function noteHasMarker(notes: FubNoteSnap[], marker: string): boolean {
  const needle = marker.toLowerCase();
  return notes.some((note) => `${note.subject}\n${note.body}`.toLowerCase().includes(needle));
}

export function personNeedsUpdate(person: FubSnapshot): boolean {
  const stage = person.stage.trim().toLowerCase();
  const tagged = person.tags.some((tag) => tag.trim().toLowerCase() === FUB_TAG.toLowerCase());
  return stage !== FUB_STAGE.toLowerCase() || !tagged;
}

export function decideWriteback(input: {
  stored: StoredWriteback | null;
  personId: string;
  enabled: boolean;
  dryRun: boolean;
  plan: WritebackPlan;
}): WritebackDecision {
  if (storedIsDone(input.stored, input.personId)) {
    return {
      action: "already",
      message: "Follow Up Boss was already updated for this referral. Nothing was written again.",
    };
  }
  if (!input.enabled || input.dryRun) {
    const why = input.dryRun
      ? "This call asked for a dry run."
      : "FUB_WRITEBACK_ENABLED is not true.";
    return {
      action: "preview",
      message: `${why} Nothing was written to Follow Up Boss. When write-back is on, I sent it adds the tag ${FUB_TAG}, sets the stage to ${FUB_STAGE}, and adds this note:\n\n${input.plan.noteBody}`,
      preview: { tag: input.plan.tag, stage: input.plan.stage, note: input.plan.noteBody },
    };
  }
  return { action: "apply", plan: input.plan };
}
