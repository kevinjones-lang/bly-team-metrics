// referral-fub: staff-only Follow Up Boss lookup and send-confirm write-back.
// Auth: caller JWT -> public.is_staff(). Secret FUB_API_KEY stays on the function.
// Write-back runs only when FUB_WRITEBACK_ENABLED=true. It updates the existing person
// (tag, stage, note) and never creates or merges contacts.
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import {
  decideWriteback, fubNotesUrl, noteHasMarker, personNeedsUpdate, planWriteback,
  type FubNoteSnap, type FubSnapshot, type StoredWriteback,
} from "./writeback.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const j = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const RECORD_SITE = "https://kevinjones-lang.github.io/bly-team-metrics/";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function personId(input: string): string | null {
  const s = input.trim();
  if (/^\d{1,20}$/.test(s)) return s;
  try {
    const u = new URL(s);
    const parts = u.pathname.split("/").filter(Boolean);
    const view = parts.lastIndexOf("view");
    if (view >= 0 && /^\d{1,20}$/.test(parts[view + 1] ?? "")) return parts[view + 1];
    const people = parts.lastIndexOf("people");
    if (people >= 0 && /^\d{1,20}$/.test(parts[people + 1] ?? "")) return parts[people + 1];
    const q = u.searchParams.get("personId") || u.searchParams.get("id");
    if (q && /^\d{1,20}$/.test(q)) return q;
  } catch {
    /* not a url */
  }
  const m = s.match(/people\/(?:view\/)?(\d{1,20})/i);
  return m ? m[1] : null;
}

function canonicalUrl(id: string, input: string): string {
  try {
    const u = new URL(input);
    if (u.hostname.endsWith("followupboss.com")) return `${u.origin}/2/people/view/${id}`;
  } catch {
    /* plain id */
  }
  return `https://agentbly1.followupboss.com/2/people/view/${id}`;
}

function firstValue(list: unknown): string {
  if (!Array.isArray(list)) return "";
  for (const item of list) {
    if (item && typeof item === "object" && "value" in item && typeof (item as { value: unknown }).value === "string") {
      const v = (item as { value: string }).value.trim();
      if (v) return v;
    }
  }
  return "";
}

function ownerName(assignedTo: unknown): string {
  if (typeof assignedTo === "string") return assignedTo.trim();
  if (assignedTo && typeof assignedTo === "object" && "name" in assignedTo && typeof (assignedTo as { name: unknown }).name === "string") {
    return (assignedTo as { name: string }).name.trim();
  }
  return "";
}

function locationOf(addresses: unknown): string {
  if (!Array.isArray(addresses) || !addresses[0] || typeof addresses[0] !== "object") return "";
  const a = addresses[0] as { city?: unknown; state?: unknown; street?: unknown };
  const city = typeof a.city === "string" ? a.city.trim() : "";
  const state = typeof a.state === "string" ? a.state.trim() : "";
  if (city && state) return `${city}, ${state}`;
  if (city || state) return city || state;
  return typeof a.street === "string" ? a.street.trim() : "";
}

function fubAuth(key: string): HeadersInit {
  return { Authorization: `Basic ${btoa(`${key}:`)}`, Accept: "application/json", "Content-Type": "application/json" };
}

function asStored(value: unknown): StoredWriteback | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as StoredWriteback;
}

function snapshotOf(person: { stage?: unknown; tags?: unknown }): FubSnapshot {
  const tags = Array.isArray(person.tags) ? person.tags.filter((tag): tag is string => typeof tag === "string") : [];
  return { stage: typeof person.stage === "string" ? person.stage : "", tags };
}

async function loadNotes(key: string, id: string): Promise<FubNoteSnap[]> {
  const notes: FubNoteSnap[] = [];
  for (let page = 0; page < 3; page++) {
    const res = await fetch(fubNotesUrl(id, page * 100), { headers: fubAuth(key) });
    if (!res.ok) throw new Error(`Follow Up Boss notes lookup failed (${res.status}).`);
    const body = await res.json() as { notes?: unknown };
    const list = Array.isArray(body.notes) ? body.notes : [];
    for (const item of list) {
      if (!item || typeof item !== "object") continue;
      const note = item as { subject?: unknown; body?: unknown };
      notes.push({
        subject: typeof note.subject === "string" ? note.subject : "",
        body: typeof note.body === "string" ? note.body : "",
      });
    }
    if (list.length < 100) break;
  }
  return notes;
}

async function writeback(sb: SupabaseClient, body: { referralId?: unknown; dryRun?: unknown }): Promise<Response> {
  const referralId = typeof body.referralId === "string" ? body.referralId.trim() : "";
  if (!UUID.test(referralId)) return j({ ok: false, dryRun: true, message: "A referral id is required. Nothing was written." }, 400);

  const { data, error } = await sb.from("referrals").select("id, client_name, location, receiving_agent, receiving_brokerage, fub_person_id, fub_writeback").eq("id", referralId).maybeSingle();
  if (error) {
    if (/fub_writeback|schema cache|does not exist|column/i.test(error.message)) {
      return j({ ok: false, dryRun: true, message: "Follow Up Boss write-back is not stored yet. Apply supabase/migrations/20261029160000_referral_fub_reminders.sql on Agent Advantage Academy. Nothing was written." }, 503);
    }
    return j({ ok: false, dryRun: true, message: error.message }, 500);
  }
  if (!data) return j({ ok: false, dryRun: true, message: "That referral is not on file. Nothing was written." }, 404);

  const row = data as {
    client_name?: unknown;
    location?: unknown;
    receiving_agent?: unknown;
    receiving_brokerage?: unknown;
    fub_person_id?: unknown;
    fub_writeback?: unknown;
  };
  const id = typeof row.fub_person_id === "string" ? row.fub_person_id.trim() : "";
  if (!/^\d{1,15}$/.test(id)) {
    return j({ ok: false, dryRun: true, message: "This referral has no Follow Up Boss person id, so nothing was written. Add the person and use Retry Follow Up Boss update. Do not click I sent it again." }, 400);
  }

  const enabled = Deno.env.get("FUB_WRITEBACK_ENABLED") === "true";
  const plan = planWriteback({
    referralId,
    personId: id,
    clientName: typeof row.client_name === "string" ? row.client_name : "",
    receivingAgent: typeof row.receiving_agent === "string" ? row.receiving_agent : "",
    brokerage: typeof row.receiving_brokerage === "string" ? row.receiving_brokerage : "",
    area: typeof row.location === "string" ? row.location : "",
    fee: "",
    recordUrl: `${RECORD_SITE}#/referrals/${referralId}`,
    when: new Date(),
  });
  const decision = decideWriteback({
    stored: asStored(row.fub_writeback),
    personId: id,
    enabled,
    dryRun: body.dryRun === true,
    plan,
  });
  if (decision.action === "already") return j({ ok: true, dryRun: false, message: decision.message });
  if (decision.action === "preview") return j({ ok: false, dryRun: true, message: decision.message, preview: decision.preview });

  const key = Deno.env.get("FUB_API_KEY");
  if (!key) return j({ ok: false, dryRun: true, message: "Follow Up Boss is not configured. Set the FUB_API_KEY secret. Nothing was written." }, 503);

  const personRes = await fetch(`https://api.followupboss.com/v1/people/${id}`, { headers: fubAuth(key) });
  if (personRes.status === 404) return j({ ok: false, dryRun: false, message: "No Follow Up Boss person with that id. Nothing was created." }, 404);
  if (!personRes.ok) return j({ ok: false, dryRun: false, message: `Follow Up Boss lookup failed (${personRes.status}). Nothing was written.` }, 502);
  const person = snapshotOf(await personRes.json() as { stage?: unknown; tags?: unknown });
  let notes: FubNoteSnap[];
  try { notes = await loadNotes(key, id); } catch (e) {
    const message = e instanceof Error ? e.message : "Follow Up Boss notes lookup failed.";
    return j({ ok: false, dryRun: false, message: `${message} Nothing else was written.` }, 502);
  }

  const put = personNeedsUpdate(person);
  const post = !noteHasMarker(notes, plan.marker);
  let noteId: number | null = null;
  if (put) {
    const updated = await fetch(plan.updateUrl, { method: "PUT", headers: fubAuth(key), body: JSON.stringify(plan.updateBody) });
    if (!updated.ok) return j({ ok: false, dryRun: false, message: `Follow Up Boss did not update the person (${updated.status}). No contact was created or merged.` }, 502);
  }
  if (post) {
    const created = await fetch("https://api.followupboss.com/v1/notes", {
      method: "POST",
      headers: fubAuth(key),
      body: JSON.stringify({ personId: Number(id), subject: plan.noteSubject, body: plan.noteBody, isHtml: false }),
    });
    if (!created.ok) {
      return j({ ok: false, dryRun: false, message: `The note was not added (${created.status}). Retry Follow Up Boss update. That retry will not add a second note if this one landed, and it will not merge contacts.` }, 502);
    }
    const note = await created.json() as { id?: unknown };
    noteId = typeof note.id === "number" ? note.id : null;
  }

  const recorded = {
    ok: true,
    personId: id,
    tag: plan.tag,
    stage: plan.stage,
    noteId,
    updatedPerson: put,
    at: new Date().toISOString(),
  };
  const saved = await sb.from("referrals").update({ fub_writeback: recorded, fub_writeback_at: recorded.at }).eq("id", referralId);
  const message = put || post
    ? "Follow Up Boss updated. Tag Out-of-Area Referral, stage Lead, and a referral note. Contacts were not merged."
    : "Follow Up Boss already had the tag, stage, and note. The referral now records that. Contacts were not merged.";
  if (saved.error) {
    return j({ ok: true, dryRun: false, message: `${message} The referral row did not store the result. Retry is safe.` });
  }
  return j({ ok: true, dryRun: false, message });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return j({ error: "POST a JSON body." }, 405);

  const auth = req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return j({ error: "unauthorized" }, 401);
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
  const { data: u, error: ue } = await sb.auth.getUser(auth.slice(7));
  if (ue || !u?.user) return j({ error: "unauthorized" }, 401);
  const { data: staff } = await sb.rpc("is_staff");
  if (!staff) return j({ error: "forbidden" }, 403);

  let body: { person?: unknown; action?: unknown; referralId?: unknown; dryRun?: unknown };
  try { body = await req.json(); } catch { return j({ error: "bad json" }, 400); }
  if (body.action === "writeback") return writeback(sb, body);

  const raw = typeof body?.person === "string" ? body.person : "";
  const id = personId(raw);
  if (!id) return j({ error: "Enter a Follow Up Boss person id or a person URL." }, 400);

  const key = Deno.env.get("FUB_API_KEY");
  if (!key) return j({ error: "Follow Up Boss lookup is not configured. Set the FUB_API_KEY secret on the referral-fub function. You can still enter the client by hand." }, 503);

  const res = await fetch(`https://api.followupboss.com/v1/people/${id}`, {
    headers: { Authorization: `Basic ${btoa(`${key}:`)}`, Accept: "application/json" },
  });
  if (res.status === 404) return j({ error: "No Follow Up Boss person with that id." }, 404);
  if (res.status === 401 || res.status === 403) return j({ error: "Follow Up Boss rejected the API key." }, 502);
  if (!res.ok) return j({ error: `Follow Up Boss lookup failed (${res.status}).` }, 502);

  const person = await res.json() as {
    id?: unknown;
    name?: unknown;
    firstName?: unknown;
    lastName?: unknown;
    emails?: unknown;
    phones?: unknown;
    addresses?: unknown;
    stage?: unknown;
    assignedTo?: unknown;
  };
  const name = typeof person.name === "string" && person.name.trim()
    ? person.name.trim()
    : [person.firstName, person.lastName].filter((x) => typeof x === "string" && x.trim()).join(" ");
  return j({
    person: {
      id: String(person.id ?? id),
      name,
      email: firstValue(person.emails),
      phone: firstValue(person.phones),
      location: locationOf(person.addresses),
      url: canonicalUrl(id, raw),
      stage: typeof person.stage === "string" ? person.stage : "",
      owner: ownerName(person.assignedTo),
    },
  });
});
