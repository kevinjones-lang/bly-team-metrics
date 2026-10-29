// referral-reminders: find due follow-ups and six-month silence, then DM the Bly owner.
// Dry-run unless REFERRAL_REMINDERS_SEND=true AND the caller presents REFERRAL_REMINDERS_CRON_SECRET.
// A staff JWT can preview only. It cannot send Slack messages.
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import {
  channelDigest, dmBatches, planReminders, toPublicReminders,
  type ReminderRow, type StaffContact,
} from "./logic.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const j = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

function timingSafeEqual(a: string, b: string): boolean {
  const left = new TextEncoder().encode(a);
  const right = new TextEncoder().encode(b);
  const length = Math.max(left.length, right.length);
  let mismatch = left.length === right.length ? 0 : 1;
  for (let i = 0; i < length; i++) mismatch |= (left[i] ?? 0) ^ (right[i] ?? 0);
  return mismatch === 0;
}

function cronAuthorized(req: Request): boolean {
  const secret = (Deno.env.get("REFERRAL_REMINDERS_CRON_SECRET") ?? "").trim();
  const got = (req.headers.get("x-cron-secret") ?? "").trim();
  if (!secret || !got) return false;
  return timingSafeEqual(secret, got);
}

async function staffAuthorized(req: Request): Promise<boolean> {
  const auth = req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return false;
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
  const { data: u, error: ue } = await sb.auth.getUser(auth.slice(7));
  if (ue || !u?.user) return false;
  const { data: staff } = await sb.rpc("is_staff");
  return staff === true;
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function rowsOf(value: unknown): ReminderRow[] {
  if (!Array.isArray(value)) return [];
  const out: ReminderRow[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    if (typeof row.id !== "string") continue;
    out.push({
      id: row.id,
      clientName: text(row.client_name),
      location: text(row.location),
      status: text(row.status),
      cadence: text(row.cadence),
      fubOwner: text(row.fub_owner),
      receivingAgent: text(row.receiving_agent),
      nextTouchOn: typeof row.next_touch_on === "string" ? row.next_touch_on : null,
      lastTouchAt: text(row.last_touch_at) || text(row.created_at),
      lastReminderAt: typeof row.last_reminder_at === "string" ? row.last_reminder_at : null,
    });
  }
  return out;
}

function staffOf(value: unknown): StaffContact[] {
  if (!Array.isArray(value)) return [];
  const out: StaffContact[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const fullName = text(row.full_name).trim();
    if (!fullName) continue;
    out.push({ fullName, slackUserId: text(row.slack_user_id).trim(), email: text(row.email).trim() });
  }
  return out;
}

async function slack(token: string, method: string, body: Record<string, unknown>): Promise<void> {
  const res = await fetch(`https://slack.com/api/${method}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
  });
  const payload = await res.json().catch(() => ({})) as { ok?: unknown; error?: unknown };
  if (!res.ok || payload.ok !== true) {
    const reason = typeof payload.error === "string" ? payload.error : `HTTP ${res.status}`;
    throw new Error(reason);
  }
}

async function sendDm(token: string, slackUserId: string, textBody: string): Promise<void> {
  const res = await fetch("https://slack.com/api/conversations.open", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ users: slackUserId }),
  });
  const payload = await res.json().catch(() => ({})) as { ok?: unknown; error?: unknown; channel?: { id?: unknown } };
  if (!res.ok || payload.ok !== true || typeof payload.channel?.id !== "string") {
    const reason = typeof payload.error === "string" ? payload.error : `HTTP ${res.status}`;
    throw new Error(reason);
  }
  await slack(token, "chat.postMessage", { channel: payload.channel.id, text: textBody });
}

async function markReminded(admin: SupabaseClient, ids: string[], at: string): Promise<string | null> {
  if (!ids.length) return null;
  const { error } = await admin.from("referrals").update({ last_reminder_at: at }).in("id", ids);
  if (!error) return null;
  if (/last_reminder_at|schema cache|does not exist|column/i.test(error.message)) {
    return "Reminders were not recorded. Apply supabase/migrations/20261029160000_referral_fub_reminders.sql.";
  }
  return error.message;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return j({ error: "POST a JSON body." }, 405);

  const cron = cronAuthorized(req);
  const staff = cron ? false : await staffAuthorized(req);
  if (!cron && !staff) return j({ error: "unauthorized" }, 401);

  let body: { dryRun?: unknown } = {};
  try { body = await req.json(); } catch { body = {}; }

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });
  const [referralRes, staffRes] = await Promise.all([
    admin.from("referrals").select("id, client_name, location, status, cadence, fub_owner, receiving_agent, next_touch_on, last_touch_at, last_reminder_at, created_at").neq("status", "closed").neq("status", "nurture"),
    admin.from("agents").select("full_name, slack_user_id, email").eq("role", "staff").eq("active", true),
  ]);
  if (referralRes.error) {
    if (/last_reminder_at|schema cache|does not exist|column/i.test(referralRes.error.message)) {
      return j({ dryRun: true, sent: 0, message: "Apply supabase/migrations/20261029160000_referral_fub_reminders.sql before running reminders. Nothing was sent.", reminders: [] }, 503);
    }
    return j({ error: referralRes.error.message }, 500);
  }
  if (staffRes.error) return j({ error: staffRes.error.message }, 500);

  const channel = (Deno.env.get("REFERRAL_SLACK_CHANNEL") ?? "").trim();
  const planned = planReminders(rowsOf(referralRes.data), staffOf(staffRes.data), new Date(), channel.length > 0);
  const sendAllowed = cron && Deno.env.get("REFERRAL_REMINDERS_SEND") === "true" && body.dryRun !== true;
  const reminders = toPublicReminders(planned);

  if (!sendAllowed) {
    const why = !cron
      ? "Staff preview only. Slack was not called."
      : body.dryRun === true
        ? "This call asked for a dry run. Slack was not called."
        : "REFERRAL_REMINDERS_SEND is not true. Slack was not called.";
    return j({ dryRun: true, sent: 0, message: why, reminders });
  }

  const token = (Deno.env.get("SLACK_BOT_TOKEN") ?? "").trim();
  if (!token) return j({ dryRun: true, sent: 0, message: "SLACK_BOT_TOKEN is not set. Nothing was sent.", reminders }, 503);

  const sentIds: string[] = [];
  const errors: string[] = [];
  const clip = (value: string) => value.length > 3500 ? `${value.slice(0, 3400)}\n…` : value;
  for (const batch of dmBatches(planned)) {
    try {
      await sendDm(token, batch.slackUserId, clip(batch.text));
      sentIds.push(...batch.referralIds);
    } catch (e) {
      const reason = e instanceof Error ? e.message : "Slack DM failed.";
      errors.push(`${batch.ownerName}: ${reason}`);
    }
  }
  const digest = channelDigest(planned);
  if (channel && digest) {
    try {
      await slack(token, "chat.postMessage", { channel, text: clip(digest) });
      for (const item of planned) {
        if (item.delivery !== "dm" && !sentIds.includes(item.referralId)) sentIds.push(item.referralId);
      }
    } catch (e) {
      const reason = e instanceof Error ? e.message : "Slack channel post failed.";
      errors.push(`channel: ${reason}`);
    }
  }
  const undelivered = planned.filter((item) => item.delivery === "undeliverable").map((item) => item.clientName);
  const recorded = await markReminded(admin, [...new Set(sentIds)], new Date().toISOString());
  if (recorded) errors.push(recorded);
  return j({
    dryRun: false,
    sent: new Set(sentIds).size,
    message: errors.length ? `Some reminders failed. ${errors.join(" ")}` : "Reminders sent.",
    undelivered,
    reminders,
  }, errors.length ? 502 : 200);
});
