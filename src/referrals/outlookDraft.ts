// Graph draft payload. No mailto — a draft is a message with the filled PDF attached.
import { handoffBody, handoffSubject, type Side } from "./logic.ts";
import { sideForContract, type ReferralForm } from "./formModel.ts";

export type OutlookDraftInput = {
  to: string;
  cc: string[];
  subject: string;
  body: string;
  attachmentName: string;
  attachmentBase64: string;
};

export type GraphMessage = {
  subject: string;
  body: { contentType: "Text"; content: string };
  toRecipients: { emailAddress: { address: string } }[];
  ccRecipients: { emailAddress: { address: string } }[];
};

export type GraphFileAttachment = {
  "@odata.type": "#microsoft.graph.fileAttachment";
  name: string;
  contentType: "application/pdf";
  contentBytes: string;
};

export function referralPdfName(client: string): string {
  const slug = client.trim().replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "client";
  return `Universal-eXp-to-eXp-Referral-${slug}.pdf`;
}

export function bytesToBase64(bytes: Uint8Array): string {
  const chunk = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + chunk, bytes.length)));
  }
  return btoa(binary);
}

export function handoffPayload(p: {
  form: ReferralForm;
  pdf: Uint8Array;
  cc: string[];
  recordUrl: string;
  location?: string | null;
  timeline?: string | null;
  notes?: string | null;
}): OutlookDraftInput {
  const side: Side | null = sideForContract(p.form.contract);
  return {
    to: p.form.receivingEmail.trim(),
    cc: p.cc,
    subject: handoffSubject({ client_name: p.form.clientName, location: p.location, side }),
    body: handoffBody({
      client_name: p.form.clientName,
      client_email: p.form.clientEmail,
      client_phone: p.form.clientPhone,
      location: p.location,
      side,
      timeline: p.timeline,
      notes: p.notes,
      receiving_agent: p.form.receivingAgent,
      bly_agent: p.form.blyAgent,
      recordUrl: p.recordUrl,
    }),
    attachmentName: referralPdfName(p.form.clientName),
    attachmentBase64: bytesToBase64(p.pdf),
  };
}

/** Message without the file. The file is added in a second call so a failed attach can be deleted. */
export function graphMessage(input: OutlookDraftInput): GraphMessage {
  return {
    subject: input.subject,
    body: { contentType: "Text", content: input.body },
    toRecipients: [{ emailAddress: { address: input.to.trim() } }],
    ccRecipients: input.cc.filter(Boolean).map((address) => ({ emailAddress: { address: address.trim() } })),
  };
}

export function graphAttachment(input: OutlookDraftInput): GraphFileAttachment {
  return {
    "@odata.type": "#microsoft.graph.fileAttachment",
    name: input.attachmentName,
    contentType: "application/pdf",
    contentBytes: input.attachmentBase64,
  };
}
