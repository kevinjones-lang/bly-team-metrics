import assert from "node:assert/strict";
import {
  STATUSES, buildMailto, ensureShortlistLine, fubFields, handoffBody, handoffCc, handoffSubject, isTouchDue, parseFubPersonId, parseShortlist,
  referralNewUrl, referralRecordUrl, statusAfterOptions, statusAfterPick, statusLabel, validateDraft,
} from "../src/referrals/logic.ts";
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

const mail = buildMailto({ to: "ada@exp.com", cc: ["Kevin.Jones@AgentBly.com"], subject: "Bly Team referral — Ada", body: "Line one\nLine two" });
assert.ok(mail.startsWith("mailto:ada%40exp.com?"));
assert.ok(mail.includes("cc=Kevin.Jones%40AgentBly.com"));
assert.ok(mail.includes("subject=Bly%20Team%20referral%20%E2%80%94%20Ada"));
assert.ok(!mail.includes("+"));

assert.equal(handoffSubject({ client_name: "Ada", side: "buyer", location: "Austin, TX" }), "Bly Team referral — Ada · Buyer · Austin, TX");
const body = handoffBody({ client_name: "Ada", client_email: "a@b.co", client_phone: "3465550100", side: "seller", location: "Austin", receiving_agent: "Grace Hopper", recordUrl: referralRecordUrl("abc") });
assert.ok(body.startsWith("Hi Grace,"));
assert.ok(body.includes("https://kevinjones-lang.github.io/bly-team-metrics/#/referrals/abc"));
assert.ok(body.includes("https://drive.google.com/file/d/1tbI2DtYasnoBMCY-pNzoEMI8UzLikQJp/view"));
assert.equal(referralNewUrl(), "https://kevinjones-lang.github.io/bly-team-metrics/#/referrals/new");

assert.equal(validateDraft({ client_name: "", client_email: "a@b.co", client_phone: "3465550100", side: "" }), "Name is required.");
assert.equal(validateDraft({ client_name: "Ada", client_email: "nope", client_phone: "3465550100", side: "buyer" }), "A valid email is required.");
assert.equal(validateDraft({ client_name: "Ada", client_email: "a@b.co", client_phone: "12", side: "" }), "A phone number is required.");
assert.equal(validateDraft({ client_name: "Ada", client_email: "a@b.co", client_phone: "(346) 555-0100", side: "lease" }), null);

assert.equal(isTouchDue("2020-01-01", "sent", new Date("2026-10-27T18:00:00Z")), true);
assert.equal(isTouchDue("2020-01-01", "new", new Date("2026-10-27T18:00:00Z")), false);
assert.equal(isTouchDue("2999-01-01", "monthly_check", new Date("2026-10-27T18:00:00Z")), false);
assert.equal(isTouchDue(null, "connected"), false);

for (const s of STATUSES) assert.ok(statusLabel(s).length > 0);

console.log("referral logic ok");
