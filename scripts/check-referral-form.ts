import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { BLANKS, BOXES, ORIGINATING, PDF_PAGE, checkedBoxes, defaultReferralForm, pdfBaseline, pdfBox, validateHandoff } from "../src/referrals/formModel.ts";
import { fillReferralPdf } from "../src/referrals/pdfFill.ts";
import { graphAttachment, graphMessage, handoffPayload } from "../src/referrals/outlookDraft.ts";

const blanks = Object.entries(BLANKS);
for (const [name, blank] of blanks) {
  assert.equal(blank.page >= 0 && blank.page <= 2, true, name);
  assert.ok(blank.x > 30 && blank.x < 560, name);
  assert.ok(blank.right > blank.x + 8 && blank.right < 580, name);
  assert.ok(blank.top > 40 && blank.top < 760, name);
  const y = pdfBaseline(blank.top);
  assert.ok(y > 20 && y < PDF_PAGE.height - 20, name);
}

for (const [name, box] of Object.entries(BOXES)) {
  const placed = pdfBox(box);
  assert.ok(placed.x > 20 && placed.x < 200, name);
  assert.ok(placed.y > 40 && placed.y < 400, name);
  assert.ok(placed.size > 8 && placed.size < 14, name);
}

const form = defaultReferralForm({
  clientName: "Jordan Lee",
  clientEmail: "jordan@example.com",
  clientPhone: "619-555-0199",
  location: "Carlsbad, CA",
  side: "buyer",
  timeline: "30 days",
  notes: "Wants a condo near the water.",
  fubPersonId: "987",
  referralId: "abc",
  receivingAgent: "Ada Lovelace",
  receivingEmail: "ada@exp.com",
  receivingPhone: "760-555-0144",
  blyAgent: "Kevin Jones",
}, new Date("2026-10-28T18:00:00Z"));

assert.equal(form.originatingAgent, ORIGINATING.agentName);
assert.equal(form.originatingAgent, "Deborah G. Bly");
assert.equal(form.originatingEmail, "team@agentbly.com");
assert.equal(form.feeKind, "percent");
assert.equal(form.feePercent, "25");
assert.equal(form.contract, "buy");
assert.equal(form.termStart, "2026-10-28");
assert.equal(form.termEnd, "2027-10-28");
assert.equal(form.opportunityId, "FUB 987");
assert.deepEqual(checkedBoxes(form), ["buy", "percent"]);
assert.equal(validateHandoff(form, "draft"), null);
assert.equal(validateHandoff(form, "preview"), null);
assert.equal(validateHandoff({ ...form, blyAgent: "" }, "preview"), null);
assert.equal(validateHandoff({ ...form, blyAgent: "" }, "draft"), "Name the Bly Team agent who owns this lead in Follow Up Boss. That name goes in the email, not on the originating-agent line.");
assert.equal(validateHandoff({ ...form, contract: "" }, "preview")?.includes("buy"), true);

const template = readFileSync(new URL("../public/forms/universal-exp-to-exp-referral-form.pdf", import.meta.url));
const filled = await fillReferralPdf(template, form);
const visible = pdfStreams(Buffer.from(filled));
for (const text of ["Deborah G. Bly", "Jordan Lee", "Ada Lovelace", "team@agentbly.com", "ada@exp.com", "10/28/26", "10/28/27", "eXp Realty, LLC", "the State of Texas"]) {
  assert.ok(visible.includes(text), text);
}
assert.equal(visible.includes("drive.google.com"), false);
writeFileSync("/tmp/filled-referral.pdf", filled);

function pdfStreams(buf: Buffer): string {
  let raw = "";
  let i = 0;
  while (i < buf.length) {
    const start = buf.indexOf("stream", i);
    if (start < 0) break;
    let data = start + "stream".length;
    if (buf[data] === 13) data += 1;
    if (buf[data] === 10) data += 1;
    const end = buf.indexOf("endstream", data);
    if (end < 0) break;
    const slice = buf.subarray(data, end);
    try { raw += inflateSync(slice).toString("latin1"); } catch { raw += slice.toString("latin1"); }
    i = end + "endstream".length;
  }
  let decoded = raw;
  for (const match of raw.matchAll(/<([0-9A-Fa-f]+)>/g)) {
    const hex = match[1] ?? "";
    if (hex.length % 2) continue;
    let text = "";
    for (let k = 0; k < hex.length; k += 2) text += String.fromCharCode(parseInt(hex.slice(k, k + 2), 16));
    decoded += text;
  }
  return decoded;
}

const payload = handoffPayload({
  form,
  pdf: filled,
  cc: ["Kevin.Jones@AgentBly.com", "Deb@AgentBly.com"],
  recordUrl: "https://kevinjones-lang.github.io/bly-team-metrics/#/referrals/abc",
  location: "Carlsbad, CA",
  timeline: "30 days",
  notes: "Wants a condo near the water.",
});
const message = graphMessage(payload);
const file = graphAttachment(payload);
assert.equal(message.toRecipients[0]?.emailAddress.address, "ada@exp.com");
assert.equal(message.ccRecipients.length, 2);
assert.equal(message.body.content.includes("Kevin Jones"), true);
assert.equal(message.body.content.includes("Deborah G. Bly"), true);
assert.equal(message.body.content.includes("filled Universal"), true);
assert.equal(message.body.content.includes("drive.google.com"), false);
assert.equal(message.body.content.includes("mailto:"), false);
assert.equal("attachments" in message, false);
assert.equal(file.contentType, "application/pdf");
assert.equal(file["@odata.type"], "#microsoft.graph.fileAttachment");
assert.ok(file.contentBytes.length > 1000);
assert.equal(file.name.endsWith(".pdf"), true);

console.log("referral form ok");
