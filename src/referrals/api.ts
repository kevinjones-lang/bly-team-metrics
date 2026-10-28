import { supabase } from "../sb";
import type { Side, Status } from "./logic";
import type { AgentLookup, PublicAgent } from "../../supabase/functions/referral-agents/logic.ts";

export type { AgentLookup };
export type AgentOption = PublicAgent;

export type Cadence = "biweekly" | "monthly";

export type Referral = {
  id: string;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  client_name: string;
  client_email: string;
  client_phone: string;
  location: string | null;
  side: Side | null;
  timeline: string | null;
  notes: string | null;
  fub_person_id: string | null;
  fub_url: string | null;
  status: Status;
  cadence: Cadence;
  email_count: number;
  last_email_at: string | null;
  last_touch_at: string;
  next_touch_on: string | null;
  shortlist: string | null;
  receiving_agent: string | null;
  receiving_agent_email: string | null;
  isa_email: string | null;
  nurture_at: string | null;
  closed_at: string | null;
};

export type ReferralEvent = {
  id: string;
  referral_id: string;
  created_at: string;
  actor: string | null;
  kind: string;
  detail: Record<string, unknown>;
};

export type FubPrefill = {
  id: string;
  name: string;
  email: string;
  phone: string;
  location: string;
  url: string;
  stage: string;
};

export type ReferralWrite = {
  client_name: string;
  client_email: string;
  client_phone: string;
  location: string | null;
  side: Side | null;
  timeline: string | null;
  notes: string | null;
  fub_person_id: string | null;
  fub_url: string | null;
  shortlist?: string | null;
  receiving_agent?: string | null;
  receiving_agent_email?: string | null;
  isa_email?: string | null;
};

function one(data: Referral | Referral[] | null): Referral {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error("Referral was not returned.");
  return row;
}

export async function listReferrals(): Promise<Referral[]> {
  const { data, error } = await supabase.from("referrals").select("*").order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Referral[];
}

export async function getReferral(id: string): Promise<Referral | null> {
  const { data, error } = await supabase.from("referrals").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Referral | null) ?? null;
}

export async function listEvents(id: string): Promise<ReferralEvent[]> {
  const { data, error } = await supabase.from("referral_events").select("*").eq("referral_id", id).order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as ReferralEvent[];
}

export async function createReferral(input: ReferralWrite): Promise<Referral> {
  const { data, error } = await supabase.from("referrals").insert(input).select("*").single();
  if (error) throw new Error(error.message);
  return one(data as Referral);
}

export async function updateReferral(id: string, patch: Partial<ReferralWrite> & { status?: Status }): Promise<Referral> {
  const { data, error } = await supabase.from("referrals").update(patch).eq("id", id).select("*").single();
  if (error) throw new Error(error.message);
  return one(data as Referral);
}

export async function applySilence(): Promise<number> {
  const { data, error } = await supabase.rpc("referrals_apply_silence");
  if (error) throw new Error(error.message);
  return typeof data === "number" ? data : Number(data ?? 0);
}

export async function markSent(p: { id: string; agent: string; email: string; isa: string; shortlist: string }): Promise<Referral> {
  const { data, error } = await supabase.rpc("referral_mark_sent", {
    p_id: p.id,
    p_agent_name: p.agent,
    p_agent_email: p.email,
    p_isa: p.isa,
    p_shortlist: p.shortlist,
  });
  if (error) throw new Error(error.message);
  return one(data as Referral | Referral[] | null);
}

export async function lookupAgents(location: string): Promise<AgentLookup> {
  const { data, error } = await supabase.functions.invoke("referral-agents", { body: { location } });
  if (error) {
    let msg = error.message;
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === "function") {
      try {
        const body = await ctx.json() as { error?: unknown };
        if (typeof body?.error === "string" && body.error) msg = body.error;
      } catch { /* response body already consumed or empty */ }
    }
    if (/failed to send a request|relay error|not found|404/i.test(msg)) {
      msg = "Agent options are not deployed yet. Deploy the referral-agents Edge Function. No extra secret is required. You can still paste an agent below.";
    }
    throw new Error(msg);
  }
  if (!data || typeof data !== "object") throw new Error("Agent lookup returned an empty result.");
  const body = data as Partial<AgentLookup> & { error?: unknown };
  if (typeof body.error === "string" && body.error) throw new Error(body.error);
  if (!Array.isArray(body.agents) || (body.tier !== "ffm" && body.tier !== "ffm_nearest" && body.tier !== "unplaced")) {
    throw new Error("Agent lookup returned an unexpected result.");
  }
  return body as AgentLookup;
}

export async function lookupFub(person: string): Promise<FubPrefill> {
  const { data, error } = await supabase.functions.invoke("referral-fub", { body: { person } });
  if (error) {
    let msg = error.message;
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === "function") {
      try {
        const body = await ctx.json() as { error?: unknown };
        if (typeof body?.error === "string" && body.error) msg = body.error;
      } catch { /* response body already consumed or empty */ }
    }
    throw new Error(msg);
  }
  const body = data as { person?: FubPrefill } | null;
  if (!body?.person) throw new Error("Follow Up Boss returned an empty person.");
  return body.person;
}
