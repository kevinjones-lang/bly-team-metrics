import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  STAFF_AGENTS, STATUSES, ensureShortlistLine, fubFields, handoffBody, handoffCc, handoffSubject, isTouchDue, mergeStaffAgents, parseFubPersonId, parseShortlist,
  referralNewUrl, referralRecordUrl, statusAfterOptions, statusAfterPick, statusLabel, toggleStatusFilter, validateDraft,
} from "../src/referrals/logic.ts";
import {
  FEE_RATE_LABEL, cardMatches, stageLabel, stageOf, statusForStageMove, statusesInStage, STAGES, toggleFilter, visibleStages,
  type BoardCard,
} from "../src/referrals/stages.ts";
import { formatShortlistLine } from "../supabase/functions/referral-agents/logic.ts";

const id = "12345";
assert.equal(parseFubPersonId(id), id);
assert.equal(parseFubPersonId("  https://agentbly1.followupboss.com/2/people/view/987?tab=notes  "), "987");
assert.equal(parseFubPersonId("https://agentbly1.followupboss.com/2/people/123"), "123");
assert.equal(parseFubPersonId(""), null);
assert.equal(parseFubPersonId("not a person"), null);
assert.deepEqual(fubFields("987"), { fub_person_id: "987", fub_url: "https://agentbly1.followupboss.com/2/people/view/987" });
assert.equal(fubFields("https://agentbly1.followupboss.com/2/people/view/42").fub_person_id, "42");
assert.deepEqual(fubFields(""), { fub_person_id: "", fub_url: "" });

const list = parseShortlist("Ada Lovelace <ada@exp.com> — Austin\n# skip\n\nGrace Hopper, grace@exp.com\nonly@exp.com\n");
assert.equal(list.length, 3);
assert.deepEqual(list[0], { name: "Ada Lovelace", email: "ada@exp.com", raw: "Ada Lovelace <ada@exp.com> — Austin" });
assert.equal(list[1].name, "Grace Hopper");
assert.equal(list[1].email, "grace@exp.com");
assert.equal(list[2].name, "only@exp.com");
assert.equal(list[2].email, "only@exp.com");

const picked = formatShortlistLine({ name: "Ada Lovelace", email: "ada@exp.com", place: "Carlsbad, CA", distanceLabel: "6.7 mi", level: "Generals" });
const again = parseShortlist(picked);
assert.equal(again[0].name, "Ada Lovelace");
assert.equal(again[0].email, "ada@exp.com");
assert.equal(ensureShortlistLine("Grace Hopper <grace@exp.com>", picked).split("\n").length, 2);
assert.equal(ensureShortlistLine(picked, picked), picked);
assert.equal(statusAfterOptions("new"), "shortlist");
assert.equal(statusAfterOptions("sent"), null);
assert.equal(statusAfterPick("shortlist"), "awaiting_pick");
assert.equal(statusAfterPick("new"), "awaiting_pick");
assert.equal(statusAfterPick("sent"), null);
assert.equal(statusAfterPick("awaiting_pick"), null);

assert.deepEqual(handoffCc(undefined, "isa@agentbly.com", "ada@exp.com"), ["Kevin.Jones@AgentBly.com", "Deb@AgentBly.com", "isa@agentbly.com"]);
assert.deepEqual(handoffCc("ops@agentbly.com, Deb@AgentBly.com", "ops@agentbly.com", "ada@exp.com"), ["ops@agentbly.com", "Deb@AgentBly.com"]);
assert.deepEqual(handoffCc(undefined, "", "Kevin.Jones@AgentBly.com"), ["Deb@AgentBly.com"]);

assert.equal(handoffSubject({ client_name: "Ada", side: "buyer", location: "Austin, TX" }), "Bly Team referral — Ada · Buyer · Austin, TX");
const body = handoffBody({ client_name: "Ada", client_email: "a@b.co", client_phone: "3465550100", side: "seller", location: "Austin", receiving_agent: "Grace Hopper", bly_agent: "Kevin Jones", recordUrl: referralRecordUrl("abc") });
assert.ok(body.startsWith("Hi Grace,"));
assert.ok(body.includes("https://kevinjones-lang.github.io/bly-team-metrics/#/referrals/abc"));
assert.ok(body.includes("Bly Team agent for follow-up: Kevin Jones"));
assert.ok(body.includes("filled Universal eXp-to-eXp Agent Referral Form is attached"));
assert.ok(body.includes("Deborah G. Bly"));
assert.equal(body.includes("drive.google.com"), false);
assert.equal(body.includes("mailto:"), false);
assert.equal(handoffSubject({ client_name: "Ada", side: "buyer", location: "Austin, TX" }).includes("mailto:"), false);
for (const rel of [
  "src/referrals/logic.ts",
  "src/referrals/Handoff.tsx",
  "src/referrals/Referrals.tsx",
  "src/referrals/outlook.ts",
  "src/referrals/outlookDraft.ts",
]) {
  const text = readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");
  assert.equal(text.includes("buildMailto"), false, rel);
  assert.equal(text.includes("mailto:"), false, rel);
}
assert.equal(referralNewUrl(), "https://kevinjones-lang.github.io/bly-team-metrics/#/referrals/new");

const sheryl = STAFF_AGENTS.find((agent) => agent.name === "Sheryl Haag");
assert.ok(sheryl, "Sheryl Haag is a Bly Team agent");
assert.equal(sheryl?.email, "");
assert.equal(sheryl?.phone, "");
assert.deepEqual(mergeStaffAgents(["Kevin Jones", "Sheryl Haag"]), ["Kevin Jones", "Sheryl Haag"]);
assert.equal(mergeStaffAgents([]).includes("Sheryl Haag"), true);
assert.equal(toggleStatusFilter(null, "sent"), "sent");
assert.equal(toggleStatusFilter("sent", "sent"), null);
assert.equal(toggleStatusFilter("sent", "all"), null);
assert.equal(toggleStatusFilter("new", "closed"), "closed");

const handoffUi = readFileSync(new URL("../src/referrals/Handoff.tsx", import.meta.url), "utf8");
const referralUi = readFileSync(new URL("../src/referrals/Referrals.tsx", import.meta.url), "utf8");
assert.equal(handoffUi.includes(">I sent it<"), true);
assert.equal(referralUi.includes(">I sent it<"), false);
assert.equal(handoffUi.includes("edit({ clientName"), false);
assert.equal(handoffUi.includes("edit({ clientEmail"), false);
assert.equal(handoffUi.includes("edit({ clientPhone"), false);
assert.equal(handoffUi.includes("referral card"), true);

assert.equal(validateDraft({ client_name: "", client_email: "a@b.co", client_phone: "3465550100", side: "" }), "Name is required.");
assert.equal(validateDraft({ client_name: "Ada", client_email: "nope", client_phone: "3465550100", side: "buyer" }), "A valid email is required.");
assert.equal(validateDraft({ client_name: "Ada", client_email: "a@b.co", client_phone: "12", side: "" }), "A phone number is required.");
assert.equal(validateDraft({ client_name: "Ada", client_email: "a@b.co", client_phone: "(346) 555-0100", side: "lease" }), null);

assert.equal(isTouchDue("2020-01-01", "sent", new Date("2026-10-27T18:00:00Z")), true);
assert.equal(isTouchDue("2020-01-01", "new", new Date("2026-10-27T18:00:00Z")), false);
assert.equal(isTouchDue("2999-01-01", "monthly_check", new Date("2026-10-27T18:00:00Z")), false);
assert.equal(isTouchDue(null, "connected"), false);

for (const s of STATUSES) assert.ok(statusLabel(s).length > 0);

assert.deepEqual(STAGES.map(stageLabel), ["New", "Sent", "Connected", "Closed", "Nurture"]);
for (const status of STATUSES) assert.ok(STAGES.includes(stageOf(status)));
assert.deepEqual(statusesInStage("new"), ["new", "shortlist", "awaiting_pick"]);
assert.deepEqual(statusesInStage("sent"), ["sent"]);
assert.deepEqual(statusesInStage("connected"), ["connected", "monthly_check"]);
assert.deepEqual(statusesInStage("closed"), ["closed"]);
assert.deepEqual(statusesInStage("nurture"), ["nurture"]);
assert.equal(statusForStageMove("shortlist", "new"), "shortlist");
assert.equal(statusForStageMove("monthly_check", "connected"), "monthly_check");
assert.equal(statusForStageMove("sent", "connected"), "connected");
assert.equal(statusForStageMove("awaiting_pick", "sent"), "sent");
assert.equal(statusForStageMove("connected", "nurture"), "nurture");
assert.equal(statusForStageMove("closed", "new"), "new");
assert.deepEqual(toggleFilter([], { kind: "status", status: "sent" }), [{ kind: "status", status: "sent" }]);
assert.deepEqual(toggleFilter([{ kind: "status", status: "sent" }], { kind: "status", status: "sent" }), []);
assert.deepEqual(toggleFilter([{ kind: "status", status: "sent" }], { kind: "status", status: "closed" }), [{ kind: "status", status: "closed" }]);
assert.deepEqual(visibleStages([{ kind: "band", band: "active" }]), ["new", "sent"]);
assert.deepEqual(visibleStages([{ kind: "status", status: "monthly_check" }]), ["connected"]);
assert.deepEqual(visibleStages([{ kind: "band", band: "active" }, { kind: "status", status: "closed" }]), []);

const sample: BoardCard = {
  id: "sample", clientName: "Ada", location: "Austin, TX", side: "buyer", status: "sent",
  receivingAgent: "Grace", blyAgent: "Jordan", emailCount: 1, lastEmailAt: null, lastTouchAt: "2026-01-01T00:00:00.000Z",
  nextTouchOn: "2020-01-01", updatedAt: "2026-01-01T00:00:00.000Z",
};
const quiet: BoardCard = { ...sample, id: "quiet", status: "new", nextTouchOn: null };
const now = new Date("2026-10-29T18:00:00Z");
assert.equal(cardMatches(sample, [{ kind: "due" }], "", now), true);
assert.equal(cardMatches(quiet, [{ kind: "due" }], "", now), false);
assert.equal(cardMatches(sample, [], "grace"), true);
assert.equal(cardMatches(sample, [], "nobody"), false);
assert.equal(FEE_RATE_LABEL, "25%");

const tokens = readFileSync(new URL("../src/referrals/tokens.css", import.meta.url), "utf8");
const boardCss = readFileSync(new URL("../src/referrals/board.css", import.meta.url), "utf8");
const boardView = readFileSync(new URL("../src/referrals/BoardView.tsx", import.meta.url), "utf8");
const mock = readFileSync(new URL("../src/referrals/mockBoard.ts", import.meta.url), "utf8");
assert.equal(tokens.includes(":root"), false);
assert.ok(tokens.includes("--color-canvas: #f4efe6"));
assert.ok(tokens.includes("--color-column: #eceff3"));
assert.ok(tokens.includes("--color-border-card: #e6e8ec"));
assert.ok(tokens.includes("--color-accent: #1f4a3a"));
assert.ok(tokens.includes("--font-sans: Outfit"));
assert.ok(tokens.includes("--font-serif: Fraunces"));
assert.ok(tokens.includes("--size-column: 300px"));
assert.ok(tokens.includes("--radius-card: 8px"));
assert.ok(tokens.includes("--opacity-dragging: 0.45"));
assert.ok(tokens.includes("--shadow-drop:"));
assert.ok(tokens.includes("--color-warning: #8a5a1b"));
assert.ok(tokens.includes("--color-success: #2f6b4a"));
assert.equal(/#[0-9a-f]{3,8}/i.test(boardCss), false);
assert.equal(/rgb\(/i.test(boardCss), false);
for (const name of boardCss.matchAll(/var\((--[a-z0-9-]+)/g)) assert.ok(tokens.includes(name[1]), name[1]);
assert.equal(/#[0-9a-f]{3,8}/i.test(boardView), false);
assert.equal(mock.includes("@"), false);
assert.equal(/\d{3}[-.)]\d{3}/.test(mock), false);

console.log("referral logic ok");
