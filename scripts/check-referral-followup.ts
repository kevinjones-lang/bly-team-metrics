import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  DEFAULT_FEE_TEXT, FUB_STAGE, FUB_TAG, decideWriteback, fubPersonUpdateUrl, noteHasMarker, personNeedsUpdate, planWriteback, storedIsDone,
} from "../supabase/functions/referral-fub/writeback.ts";
import {
  channelDigest, dmBatches, isSilent, matchStaff, planReminders, toPublicReminders,
  type ReminderRow, type StaffContact,
} from "../supabase/functions/referral-reminders/logic.ts";
import { expShortlistFromDirectory, parseExpDirectory, rankExpAgents, stubExpShortlist } from "../supabase/functions/referral-agents/expShortlist.ts";

const when = new Date("2026-10-29T18:00:00Z");
const plan = planWriteback({
  referralId: "11111111-1111-1111-1111-111111111111",
  personId: "987",
  clientName: "Ada Lovelace",
  receivingAgent: "Grace Hopper",
  brokerage: "eXp Realty, LLC",
  area: "Austin, TX",
  fee: "",
  recordUrl: "https://kevinjones-lang.github.io/bly-team-metrics/#/referrals/11111111-1111-1111-1111-111111111111",
  when,
});
assert.equal(plan.updateBody.stage, FUB_STAGE);
assert.deepEqual(plan.updateBody.tags, [FUB_TAG]);
assert.deepEqual(Object.keys(plan.updateBody).sort(), ["stage", "tags"]);
assert.equal(plan.updateUrl, fubPersonUpdateUrl("987"));
assert.ok(plan.updateUrl.includes("mergeTags=true"));
assert.equal(plan.updateUrl.includes("/people/merge"), false);
assert.ok(plan.noteBody.includes("Grace Hopper"));
assert.ok(plan.noteBody.includes("eXp Realty, LLC"));
assert.ok(plan.noteBody.includes("Austin, TX"));
assert.ok(plan.noteBody.includes(DEFAULT_FEE_TEXT));
assert.ok(plan.noteBody.includes("referral:11111111-1111-1111-1111-111111111111"));
assert.ok(plan.noteBody.includes("Oct 29, 2026"));
assert.equal(plan.noteBody.toLowerCase().includes("merge contact"), false);

const preview = decideWriteback({ stored: null, personId: "987", enabled: false, dryRun: false, plan });
assert.equal(preview.action, "preview");
if (preview.action === "preview") assert.ok(preview.message.includes("Nothing was written"));
const forced = decideWriteback({ stored: null, personId: "987", enabled: true, dryRun: true, plan });
assert.equal(forced.action, "preview");
const again = decideWriteback({ stored: { ok: true, personId: "987" }, personId: "987", enabled: true, dryRun: false, plan });
assert.equal(again.action, "already");
const otherPerson = decideWriteback({ stored: { ok: true, personId: "1" }, personId: "987", enabled: true, dryRun: false, plan });
assert.equal(otherPerson.action, "apply");
assert.equal(storedIsDone({ ok: true, personId: "987" }, "987"), true);
assert.equal(storedIsDone({ ok: false, personId: "987" }, "987"), false);
assert.equal(noteHasMarker([{ subject: "", body: "referral:11111111-1111-1111-1111-111111111111" }], plan.marker), true);
assert.equal(noteHasMarker([{ subject: "Other", body: "hello" }], plan.marker), false);
assert.equal(personNeedsUpdate({ stage: "Lead", tags: ["Out-of-Area Referral", "Zillow"] }), false);
assert.equal(personNeedsUpdate({ stage: "Nurture", tags: ["Out-of-Area Referral"] }), true);
assert.equal(personNeedsUpdate({ stage: "Lead", tags: ["Zillow"] }), true);

const staff: StaffContact[] = [
  { fullName: "Kevin Jones", slackUserId: "UKEVIN", email: "Kevin.Jones@AgentBly.com" },
  { fullName: "Deborah G. Bly", slackUserId: "UDEBB", email: "Deb@AgentBly.com" },
  { fullName: "Sheryl Haag", slackUserId: "USHERYL", email: "sheryl@example.com" },
  { fullName: "Kimberley Stone", slackUserId: "UKIM", email: "kim@example.com" },
];
assert.equal(matchStaff("Deb Bly", staff)?.slackUserId, "UDEBB");
assert.equal(matchStaff("Deborah Bly", staff)?.slackUserId, "UDEBB");
assert.equal(matchStaff("Sheryl Haag", staff)?.slackUserId, "USHERYL");
assert.equal(matchStaff("Sheryl", staff)?.slackUserId, "USHERYL");
assert.equal(matchStaff("Kim", staff)?.slackUserId, "UKIM");
assert.equal(matchStaff("Kevin", staff)?.slackUserId, "UKEVIN");
const twoKevins: StaffContact[] = [
  { fullName: "Kevin Jones", slackUserId: "U1", email: "a@example.com" },
  { fullName: "Kevin Smith", slackUserId: "U2", email: "b@example.com" },
];
assert.equal(matchStaff("Kevin", twoKevins), null);
assert.equal(matchStaff("", staff), null);

function row(patch: Partial<ReminderRow>): ReminderRow {
  return {
    id: "abc",
    clientName: "Ada",
    location: "Austin, TX",
    status: "sent",
    cadence: "biweekly",
    fubOwner: "Kevin Jones",
    receivingAgent: "Grace Hopper",
    nextTouchOn: "2026-10-29",
    lastTouchAt: "2026-10-01T12:00:00Z",
    lastReminderAt: null,
    ...patch,
  };
}

const due = planReminders([row({})], staff, when, true);
assert.equal(due.length, 1);
assert.equal(due[0].kind, "follow_up");
assert.equal(due[0].delivery, "dm");
assert.ok(due[0].text.includes("biweekly until connected"));
assert.equal(planReminders([row({ lastReminderAt: "2026-10-29T15:00:00Z" })], staff, when, true).length, 0);
assert.equal(planReminders([row({ lastReminderAt: "2026-10-01T15:00:00Z" })], staff, when, true).length, 1);
assert.equal(planReminders([row({ status: "monthly_check", cadence: "monthly", lastReminderAt: "2026-10-10T15:00:00Z" })], staff, when, true).length, 0);
assert.equal(planReminders([row({ status: "connected", cadence: "monthly", nextTouchOn: "2026-11-20" })], staff, when, true).length, 0);
const monthly = planReminders([row({ status: "monthly_check", cadence: "monthly" })], staff, when, true);
assert.equal(monthly[0].kind, "follow_up");
assert.ok(monthly[0].text.includes("monthly"));
assert.equal(isSilent("2026-04-28T12:00:00Z", when), true);
assert.equal(isSilent("2026-05-15T12:00:00Z", when), false);
const quiet = planReminders([row({ lastTouchAt: "2026-01-01T12:00:00Z", fubOwner: "Nobody" })], staff, when, true);
assert.equal(quiet[0].kind, "nurture");
assert.equal(quiet[0].delivery, "channel");
assert.ok(quiet[0].text.includes("Nurture"));
assert.equal(planReminders([row({ lastTouchAt: "2026-01-01T12:00:00Z", lastReminderAt: "2026-02-01T12:00:00Z" })], staff, when, true).length, 0);
assert.equal(planReminders([row({ status: "new", nextTouchOn: null, lastTouchAt: "2026-10-01T12:00:00Z" })], staff, when, false).length, 0);
const lost = planReminders([row({ fubOwner: "Pat Example" })], staff, when, false);
assert.equal(lost[0].delivery, "undeliverable");
assert.equal(dmBatches(due)[0].slackUserId, "UKEVIN");
assert.ok(channelDigest(quiet).includes("Ada"));
const published = toPublicReminders(due);
assert.equal("slackUserId" in published[0], false);
assert.equal(JSON.stringify(published).includes("UKEVIN"), false);

const stub = stubExpShortlist("Dallas, TX");
assert.equal(stub.status, "stub");
assert.equal(stub.agents.length, 0);
assert.ok(stub.note.includes("reCAPTCHA"));
assert.ok(stub.note.includes("Paste"));
assert.ok(stub.searchUrl.includes("exprealty.com/agents-search"));
assert.equal(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(stub.note), false);

const origin = { lat: 30.27, lng: -97.74 };
const directory = parseExpDirectory({
  agents: [
    { name: "Near", email: "near@exp.com", lat: 30.3, lng: -97.74, volume: 1, city: "Austin", region: "TX" },
    { name: "Far", email: "far@exp.com", lat: 40, lng: -105, volume: 9, city: "Boulder", region: "CO" },
    { name: "Mid", lat: 32, lng: -97, volume: 3, city: "Dallas", region: "TX" },
    { name: "Tied Low", lat: 30.27, lng: -97.74, volume: 2 },
    { name: "Tied High", lat: 30.27, lng: -97.74, volume: 8 },
    { name: "Sixth", lat: 29, lng: -98, volume: 1, city: "San Antonio", region: "TX" },
    { name: "No Map", email: "nomap@exp.com", city: "Houston" },
    { name: "" },
  ],
});
const ranked = rankExpAgents(directory, origin);
assert.equal(ranked.agents.length, 5);
assert.equal(ranked.skipped, 1);
assert.equal(ranked.agents[0].name, "Tied High");
assert.equal(ranked.agents[1].name, "Tied Low");
assert.equal(ranked.agents.some((agent) => agent.name === "No Map"), false);
const listed = expShortlistFromDirectory({ location: "Austin, TX", origin: { ...origin, label: "Austin, TX" }, agents: directory, source: "bundled" });
assert.equal(listed.status, "ranked");
assert.equal(listed.agents[0].source, "exp");
assert.ok(listed.note.includes("Paste"));
const empty = expShortlistFromDirectory({ location: "Austin, TX", origin: { ...origin, label: "Austin" }, agents: [], source: "bundled" });
assert.equal(empty.status, "stub");

for (const rel of [
  "supabase/functions/referral-fub/index.ts",
  "supabase/functions/referral-fub/writeback.ts",
  "supabase/functions/referral-reminders/index.ts",
]) {
  const text = readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");
  assert.equal(text.includes("/people/merge"), false, rel);
  assert.equal(text.includes("checkDuplicate"), false, rel);
}
const reminders = readFileSync(new URL("../supabase/functions/referral-reminders/index.ts", import.meta.url), "utf8");
assert.ok(reminders.includes("REFERRAL_REMINDERS_SEND"));
assert.ok(reminders.includes("dryRun"));
assert.ok(reminders.includes("chat.postMessage"));
const fub = readFileSync(new URL("../supabase/functions/referral-fub/index.ts", import.meta.url), "utf8");
assert.ok(fub.includes("FUB_WRITEBACK_ENABLED"));
assert.ok(fub.includes("mergeTags=true") || fub.includes("plan.updateUrl"));
const outlook = readFileSync(new URL("../src/referrals/outlook.ts", import.meta.url), "utf8");
assert.ok(outlook.includes("Mail.ReadWrite"));
assert.ok(outlook.includes("createStaffDraft"));
const handoff = readFileSync(new URL("../src/referrals/Handoff.tsx", import.meta.url), "utf8");
assert.equal(handoff.includes("mailto:"), false);
assert.ok(handoff.includes("microsoftConfigured() ? await createStaffDraft(input) : await createOutlookDraft(input)"));
const signIn = readFileSync(new URL("../src/auth/SignIn.tsx", import.meta.url), "utf8");
assert.ok(signIn.includes("slack_oidc"));
assert.ok(signIn.includes("google"));
assert.ok(signIn.includes("signInWithOtp"));
assert.ok(signIn.includes("verifyOtp"));

console.log("referral follow-up ok");
