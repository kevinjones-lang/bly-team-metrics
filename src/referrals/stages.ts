// Pipeline stages for the referral board. The database statuses stay as they are.
// New keeps anything not sent yet. Sent is the emailed handoff. Connected includes
// monthly check (the agent has already connected). Closed and Nurture are themselves.
import { isTouchDue, sideLabel, statusLabel, STATUSES, type Side, type Status } from "./logic.ts";

export const STAGES = ["new", "sent", "connected", "closed", "nurture"] as const;
export type Stage = (typeof STAGES)[number];

export type BandId = "active" | "connected" | "closed" | "nurture";

export const BANDS: readonly { id: BandId; label: string; stages: readonly Stage[] }[] = [
  { id: "active", label: "Active", stages: ["new", "sent"] },
  { id: "connected", label: "Connected", stages: ["connected"] },
  { id: "closed", label: "Closed", stages: ["closed"] },
  { id: "nurture", label: "Nurture", stages: ["nurture"] },
];

/** Standard referral fee rate. Referrals do not store a sale price, so the column footer is a count. */
export const FEE_RATE_LABEL = "25%";

export type BoardCard = {
  id: string;
  clientName: string;
  location: string | null;
  side: Side | null;
  status: Status;
  receivingAgent: string | null;
  blyAgent: string | null;
  emailCount: number;
  lastEmailAt: string | null;
  lastTouchAt: string;
  nextTouchOn: string | null;
  updatedAt: string;
};

export type SortKey = "updated" | "name" | "next" | "emails";

export type BoardFilter =
  | { kind: "status"; status: Status }
  | { kind: "side"; side: Side }
  | { kind: "due" }
  | { kind: "band"; band: BandId }
  | { kind: "stage"; stage: Stage };

export function stageOf(status: Status): Stage {
  switch (status) {
    case "new":
    case "shortlist":
    case "awaiting_pick":
      return "new";
    case "sent":
      return "sent";
    case "connected":
    case "monthly_check":
      return "connected";
    case "closed":
      return "closed";
    case "nurture":
      return "nurture";
    default: {
      const _n: never = status;
      return _n;
    }
  }
}

export function stageLabel(stage: Stage): string {
  switch (stage) {
    case "new": return "New";
    case "sent": return "Sent";
    case "connected": return "Connected";
    case "closed": return "Closed";
    case "nurture": return "Nurture";
    default: {
      const _n: never = stage;
      return _n;
    }
  }
}

export function stageBlurb(stage: Stage): string {
  switch (stage) {
    case "new":
      return "Not sent yet. Shortlist and awaiting pick stay in this column.";
    case "sent":
      return "The referral email is out and waiting on the receiving agent. Follow-up stays every two weeks.";
    case "connected":
      return "The receiving agent has connected with the client. Monthly check stays in this column.";
    case "closed":
      return "The deal closed, or the referral is finished.";
    case "nurture":
      return "Six months with no touch. Opening the board files those referrals here.";
    default: {
      const _n: never = stage;
      return _n;
    }
  }
}

export function statusForStage(stage: Stage): Status {
  switch (stage) {
    case "new": return "new";
    case "sent": return "sent";
    case "connected": return "connected";
    case "closed": return "closed";
    case "nurture": return "nurture";
    default: {
      const _n: never = stage;
      return _n;
    }
  }
}

/** Dropping a card on its current stage keeps the finer status (shortlist, monthly check). */
export function statusForStageMove(current: Status, stage: Stage): Status {
  if (stageOf(current) === stage) return current;
  return statusForStage(stage);
}

export function statusesInStage(stage: Stage): Status[] {
  return STATUSES.filter((status) => stageOf(status) === stage);
}

export function bandForStage(stage: Stage): BandId {
  switch (stage) {
    case "new":
    case "sent":
      return "active";
    case "connected":
      return "connected";
    case "closed":
      return "closed";
    case "nurture":
      return "nurture";
    default: {
      const _n: never = stage;
      return _n;
    }
  }
}

/** Badge for shortlist, awaiting pick, and monthly check. The column already names the canonical status. */
export function finerStatusLabel(status: Status): string | null {
  if (statusForStage(stageOf(status)) === status) return null;
  return statusLabel(status);
}

export function initials(name: string | null): string {
  const parts = (name ?? "").replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  if (!parts.length) return "";
  return parts.slice(0, 2).map((part) => part[0] ?? "").join("").toUpperCase();
}

export function filterKey(filter: BoardFilter): string {
  switch (filter.kind) {
    case "status": return `status:${filter.status}`;
    case "side": return `side:${filter.side}`;
    case "due": return "due";
    case "band": return `band:${filter.band}`;
    case "stage": return `stage:${filter.stage}`;
    default: {
      const _n: never = filter;
      return _n;
    }
  }
}

export function filterLabel(filter: BoardFilter): string {
  switch (filter.kind) {
    case "status": return statusLabel(filter.status);
    case "side": return sideLabel(filter.side);
    case "due": return "Follow-up due";
    case "band": {
      const band = BANDS.find((item) => item.id === filter.band);
      return band ? band.label : filter.band;
    }
    case "stage": return stageLabel(filter.stage);
    default: {
      const _n: never = filter;
      return _n;
    }
  }
}

/** One filter per kind. Choosing the active value again removes it. */
export function toggleFilter(current: readonly BoardFilter[], next: BoardFilter): BoardFilter[] {
  const key = filterKey(next);
  if (current.some((item) => filterKey(item) === key)) return current.filter((item) => filterKey(item) !== key);
  return [...current.filter((item) => item.kind !== next.kind), next];
}

export function matchesQuery(card: BoardCard, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const hay = [
    card.clientName,
    card.location ?? "",
    card.receivingAgent ?? "",
    card.blyAgent ?? "",
    card.side ? sideLabel(card.side) : "",
    stageLabel(stageOf(card.status)),
    statusLabel(card.status),
  ].join("\n").toLowerCase();
  return hay.includes(q);
}

export function cardMatches(card: BoardCard, filters: readonly BoardFilter[], query: string, now = new Date()): boolean {
  if (!matchesQuery(card, query)) return false;
  for (const filter of filters) {
    switch (filter.kind) {
      case "status":
        if (card.status !== filter.status) return false;
        break;
      case "side":
        if (card.side !== filter.side) return false;
        break;
      case "due":
        if (!isTouchDue(card.nextTouchOn, card.status, now)) return false;
        break;
      case "band":
        if (bandForStage(stageOf(card.status)) !== filter.band) return false;
        break;
      case "stage":
        if (stageOf(card.status) !== filter.stage) return false;
        break;
      default: {
        const _n: never = filter;
        return _n;
      }
    }
  }
  return true;
}

export function chipCount(rows: readonly BoardCard[], filter: BoardFilter, now = new Date()): number {
  return rows.filter((card) => cardMatches(card, [filter], "", now)).length;
}

export function visibleStages(filters: readonly BoardFilter[]): Stage[] {
  const band = filters.find((item): item is Extract<BoardFilter, { kind: "band" }> => item.kind === "band");
  const stageFilter = filters.find((item): item is Extract<BoardFilter, { kind: "stage" }> => item.kind === "stage");
  const status = filters.find((item): item is Extract<BoardFilter, { kind: "status" }> => item.kind === "status");
  return STAGES.filter((stage) => {
    if (band && bandForStage(stage) !== band.band) return false;
    if (stageFilter && stageFilter.stage !== stage) return false;
    if (status && stageOf(status.status) !== stage) return false;
    return true;
  });
}

export function compareCards(sort: SortKey, a: BoardCard, b: BoardCard): number {
  switch (sort) {
    case "name":
      return a.clientName.localeCompare(b.clientName, undefined, { sensitivity: "base" }) || b.updatedAt.localeCompare(a.updatedAt);
    case "next":
      return (a.nextTouchOn ?? "9999-99-99").localeCompare(b.nextTouchOn ?? "9999-99-99") || a.clientName.localeCompare(b.clientName);
    case "emails":
      return b.emailCount - a.emailCount || b.updatedAt.localeCompare(a.updatedAt);
    case "updated":
      return b.updatedAt.localeCompare(a.updatedAt);
    default: {
      const _n: never = sort;
      return _n;
    }
  }
}
