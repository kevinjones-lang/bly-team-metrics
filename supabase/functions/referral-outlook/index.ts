// referral-outlook: create an Outlook draft with the filled referral PDF attached.
// Auth: caller JWT -> public.is_staff().
// Secrets (supabase secrets set, never VITE_*):
//   AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, OUTLOOK_MAILBOX
// Application permission Mail.ReadWrite, preferably limited to OUTLOOK_MAILBOX
// with an application access policy. This creates a draft. It does not send.
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const j = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MISSING = "Outlook drafts are not configured. Set Edge Function secrets AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, and OUTLOOK_MAILBOX. Or set VITE_MICROSOFT_CLIENT_ID so staff can connect Microsoft in the browser. A blank email is not opened.";

type DraftBody = {
  to?: unknown;
  cc?: unknown;
  subject?: unknown;
  body?: unknown;
  attachmentName?: unknown;
  attachmentBase64?: unknown;
};

function emailList(value: unknown, limit: number): string[] | null {
  if (!Array.isArray(value)) return [];
  if (value.length > limit) return null;
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== "string" || !EMAIL.test(item.trim())) return null;
    out.push(item.trim());
  }
  return out;
}

async function appToken(tenant: string, clientId: string, secret: string): Promise<string> {
  const res = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: secret,
      scope: "https://graph.microsoft.com/.default",
      grant_type: "client_credentials",
    }),
  });
  const payload = await res.json().catch(() => ({})) as { access_token?: unknown; error_description?: unknown };
  if (!res.ok || typeof payload.access_token !== "string") {
    const detail = typeof payload.error_description === "string" ? payload.error_description.slice(0, 240) : `token ${res.status}`;
    throw new Error(`Microsoft token request failed (${detail}).`);
  }
  return payload.access_token;
}

async function graph(token: string, method: string, url: string, body?: unknown): Promise<{ ok: boolean; status: number; payload: Record<string, unknown> }> {
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await res.json().catch(() => ({})) as Record<string, unknown>;
  return { ok: res.ok, status: res.status, payload };
}

function graphError(payload: Record<string, unknown>, status: number): string {
  const err = payload.error;
  if (err && typeof err === "object" && "message" in err && typeof (err as { message: unknown }).message === "string") {
    return (err as { message: string }).message;
  }
  return `Microsoft Graph returned ${status}.`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return j({ error: "POST the draft JSON." }, 405);

  const auth = req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return j({ error: "unauthorized" }, 401);
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
  const { data: u, error: ue } = await sb.auth.getUser(auth.slice(7));
  if (ue || !u?.user) return j({ error: "unauthorized" }, 401);
  const { data: staff } = await sb.rpc("is_staff");
  if (!staff) return j({ error: "forbidden" }, 403);

  const tenant = (Deno.env.get("AZURE_TENANT_ID") ?? "").trim();
  const clientId = (Deno.env.get("AZURE_CLIENT_ID") ?? "").trim();
  const secret = (Deno.env.get("AZURE_CLIENT_SECRET") ?? "").trim();
  const mailbox = (Deno.env.get("OUTLOOK_MAILBOX") ?? "").trim();
  if (!tenant || !clientId || !secret || !mailbox) return j({ error: MISSING }, 503);

  let body: DraftBody;
  try { body = await req.json(); } catch { return j({ error: "bad json" }, 400); }

  const to = typeof body.to === "string" ? body.to.trim() : "";
  if (!EMAIL.test(to)) return j({ error: "Receiving agent email is required." }, 400);
  const cc = emailList(body.cc, 8);
  if (!cc) return j({ error: "Cc must be a short list of email addresses." }, 400);
  const subject = typeof body.subject === "string" ? body.subject.trim() : "";
  const text = typeof body.body === "string" ? body.body : "";
  if (!subject || subject.length > 300) return j({ error: "Subject is required." }, 400);
  if (!text.trim() || text.length > 12000) return j({ error: "Email body is required." }, 400);
  const attachmentName = typeof body.attachmentName === "string" && body.attachmentName.trim()
    ? body.attachmentName.trim().slice(0, 120)
    : "Universal-eXp-to-eXp-Referral.pdf";
  const attachmentBase64 = typeof body.attachmentBase64 === "string" ? body.attachmentBase64.replace(/\s/g, "") : "";
  if (attachmentBase64.length < 100 || attachmentBase64.length > 1_500_000 || !/^[A-Za-z0-9+/=]+$/.test(attachmentBase64)) {
    return j({ error: "The filled PDF attachment is missing." }, 400);
  }

  let token: string;
  try { token = await appToken(tenant, clientId, secret); } catch (e) {
    const message = e instanceof Error ? e.message : "Microsoft token request failed.";
    return j({ error: message }, 502);
  }

  const messageUrl = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(mailbox)}/messages`;
  const created = await graph(token, "POST", messageUrl, {
    subject,
    body: { contentType: "Text", content: text },
    toRecipients: [{ emailAddress: { address: to } }],
    ccRecipients: cc.map((address) => ({ emailAddress: { address } })),
  });
  const id = typeof created.payload.id === "string" ? created.payload.id : "";
  if (!created.ok || !id) return j({ error: graphError(created.payload, created.status) }, 502);

  const attached = await graph(token, "POST", `${messageUrl}/${encodeURIComponent(id)}/attachments`, {
    "@odata.type": "#microsoft.graph.fileAttachment",
    name: attachmentName.endsWith(".pdf") ? attachmentName : `${attachmentName}.pdf`,
    contentType: "application/pdf",
    contentBytes: attachmentBase64,
  });
  if (!attached.ok) {
    await graph(token, "DELETE", `${messageUrl}/${encodeURIComponent(id)}`);
    return j({ error: `Microsoft rejected the PDF attachment. The empty draft was removed. ${graphError(attached.payload, attached.status)}` }, 502);
  }

  const webLink = typeof created.payload.webLink === "string" ? created.payload.webLink : null;
  return j({ id, webLink, mailbox });
});
