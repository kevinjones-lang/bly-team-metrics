// coach-ask: staff-only AI coach/analyst over the latest metrics snapshot. Read-only (never writes to Sisu/FUB).
// Auth: caller's Supabase JWT -> public.is_staff(). Data: latest public.metrics_snapshots row read with the caller's JWT (RLS).
// LLM: set ONE secret (supabase secrets set ...): OPENAI_API_KEY, ANTHROPIC_API_KEY or XAI_API_KEY. Without one, returns 503 {fallback:true}.
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const j = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

const RULES = `You are the Bly Team Coach, an analyst for The Bly Team (eXp Realty, Houston; team lead Kevin Jones). Answer only from the DATA provided. If the data can't answer, say what's missing. Never invent numbers.
Output GitHub-flavored markdown: a one-line headline answer in bold, then compact tables, then 1-3 concrete next actions. Keep it brief.
Team rules (always apply):
- eXp transaction IDs that differ only by .1/.2 are ONE unit. Sisu buyer+seller sides with the same address+close date are ONE unit (volume counted once, both GCI kept). Co-agented eXp deals split unit and volume between agents.
- Deborah (Deb) Bly's team-leader share is team-only revenue, not agent production.
- Jesse Jones is the Fello AI dialer: exclude from all human agent/ISA metrics and rankings.
- FUB tag "FELIX AI HANDOFF" = AI conversion tool (Fello). Ralph's ISA conversions count only from 2026.
- Leases & referrals are included by default; *X fields (sUnitsX, sGciX, xRevX) are the excluded variants — use them if the user says exclude leases/referrals.
- Attribution is multi-touch: the original FUB source is separate from assists. Maverick = assist. Ylopo Recent Activity on sphere = remarketing assist. 2026 closings from pre-2026 leads credit the original source.
- Always label GCI: "gross (Sisu)", "deposited (P&L)", or "team share (eXp)".
Data notes: segs[key] metric arrays are indexed [MTD, last month, YTD, trailing 30d, last-year YTD]; periods gives the date ranges. stl = [median minutes to first call, leads called, leads, within 5 min, within 15 min]. No Sisu goals are set, so "pace" = vs same date last year unless the user gives a goal. coach.answers holds precomputed markdown analyses; coach.coach holds per-agent 1:1 prep; coach.detail holds pending/lost deal rows and weekly call counts.`;

function compact(p: any) {
  const c = p.coach || {};
  return {
    asof: p.asof, generated: p.generated, periods: p.periods, names: p.names, groups: p.groups,
    segs: Object.fromEntries(Object.entries(p.segs || {}).map(([k, v]: any) => [k, Object.fromEntries(Object.entries(v).filter(([f]) => !["up30", "mon", "fPipe"].includes(f)))])),
    alerts: p.alerts, attr_sources: p.attr?.src, attr_cols: p.attr?.cols, attr_team_ytd: p.attr?.m?.["team|ytd|1"], attr_gs_ytd: p.attr?.gs?.["team|ytd|1"],
    pnl: p.pnl, isa_labels: p.isa?.labels,
    coach: { insights: c.insights, answers: Object.fromEntries(Object.entries(c.answers || {}).map(([k, v]: any) => [k, v.md])), detail: c.detail },
  };
}

async function callLLM(system: string, messages: { role: string; content: string }[]) {
  const oa = Deno.env.get("OPENAI_API_KEY"), an = Deno.env.get("ANTHROPIC_API_KEY"), xa = Deno.env.get("XAI_API_KEY");
  if (an) {
    const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "x-api-key": an, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: Deno.env.get("COACH_MODEL") || "claude-sonnet-4-5", max_tokens: 2000, system, messages }) });
    const d = await r.json(); if (!r.ok) throw new Error(d?.error?.message || r.statusText);
    return d.content.map((b: any) => b.text || "").join("");
  }
  const [url, key, model] = oa ? ["https://api.openai.com/v1/chat/completions", oa, Deno.env.get("COACH_MODEL") || "gpt-4.1"] : ["https://api.x.ai/v1/chat/completions", xa!, Deno.env.get("COACH_MODEL") || "grok-4"];
  const r = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages: [{ role: "system", content: system }, ...messages], temperature: 0.2 }) });
  const d = await r.json(); if (!r.ok) throw new Error(d?.error?.message || r.statusText);
  return d.choices[0].message.content;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method === "GET") return j({ ok: true, llm: !!(Deno.env.get("OPENAI_API_KEY") || Deno.env.get("ANTHROPIC_API_KEY") || Deno.env.get("XAI_API_KEY")) });
  const auth = req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return j({ error: "unauthorized" }, 401);
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
  const { data: u, error: ue } = await sb.auth.getUser(auth.slice(7));
  if (ue || !u?.user) return j({ error: "unauthorized" }, 401);
  const { data: staff } = await sb.rpc("is_staff");
  if (!staff) return j({ error: "forbidden" }, 403);
  const llm = !!(Deno.env.get("OPENAI_API_KEY") || Deno.env.get("ANTHROPIC_API_KEY") || Deno.env.get("XAI_API_KEY"));
  if (!llm) return j({ fallback: true, error: "Free-form chat is not enabled (no LLM API key secret set). Use the prebuilt answers." }, 503);
  let body: any; try { body = await req.json(); } catch { return j({ error: "bad json" }, 400); }
  const msgs = (Array.isArray(body?.messages) ? body.messages : []).slice(-10).filter((m: any) => ["user", "assistant"].includes(m.role) && typeof m.content === "string").map((m: any) => ({ role: m.role, content: m.content.slice(0, 4000) }));
  if (!msgs.length || msgs[msgs.length - 1].role !== "user") return j({ error: "no question" }, 400);
  const { data: snap, error: se } = await sb.from("metrics_snapshots").select("snap_date,payload").order("snap_date", { ascending: false }).limit(1);
  if (se || !snap?.length) return j({ error: "no snapshot" }, 500);
  const system = `${RULES}\nSnapshot date: ${snap[0].snap_date}.\nDATA (JSON):\n${JSON.stringify(compact(snap[0].payload))}`;
  try { return j({ answer: await callLLM(system, msgs), snap_date: snap[0].snap_date }); }
  catch (e) { return j({ error: "LLM error: " + String((e as Error).message).slice(0, 200) }, 502); }
});
