// referral-fub: staff-only Follow Up Boss person lookup so the referral form can prefill.
// Auth: caller JWT -> public.is_staff(). Secret (supabase secrets set FUB_API_KEY): never shipped to Vite.
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const j = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

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

function locationOf(addresses: unknown): string {
  if (!Array.isArray(addresses) || !addresses[0] || typeof addresses[0] !== "object") return "";
  const a = addresses[0] as { city?: unknown; state?: unknown; street?: unknown };
  const city = typeof a.city === "string" ? a.city.trim() : "";
  const state = typeof a.state === "string" ? a.state.trim() : "";
  if (city && state) return `${city}, ${state}`;
  if (city || state) return city || state;
  return typeof a.street === "string" ? a.street.trim() : "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return j({ error: "POST a JSON body { person }." }, 405);

  const auth = req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return j({ error: "unauthorized" }, 401);
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
  const { data: u, error: ue } = await sb.auth.getUser(auth.slice(7));
  if (ue || !u?.user) return j({ error: "unauthorized" }, 401);
  const { data: staff } = await sb.rpc("is_staff");
  if (!staff) return j({ error: "forbidden" }, 403);

  let body: { person?: unknown };
  try { body = await req.json(); } catch { return j({ error: "bad json" }, 400); }
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
    },
  });
});
