import { lazy, Suspense, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useAgent } from "../agent";
import {
  SIDES, STATUSES, blankToNull, ensureShortlistLine, formatDay, formatWhen, handoffCc,
  fubFields, humanError, isEmail, isSide, isStatus, isTouchDue, mergeStaffAgents, parseFubPersonId, parseShortlist, referralNewUrl, referralRecordUrl, sideLabel, statusAfterOptions, statusAfterPick, statusLabel, toggleStatusFilter, validateDraft,
  type Side, type Status,
} from "./logic.ts";
import { DEFAULT_RECEIVING_BROKERAGE } from "./formModel.ts";
import { formatShortlistLine } from "../../supabase/functions/referral-agents/logic.ts";
import { applySilence, createReferral, getReferral, listEvents, listReferrals, lookupFub, markOutlookDraft, updateReferral, writeBackReferral, type AgentLookup, type AgentOption, type FubPrefill, type Referral, type ReferralEvent, type ReferralWrite } from "./api";
import { confirmHandoffSent } from "./confirmSent";
import AgentOptions from "./AgentOptions";
import ExpShortlist from "./ExpShortlist";
import ReminderPreview from "./ReminderPreview";
import "./referrals.css";

const Handoff = lazy(() => import("./Handoff.tsx"));

const CC_ENV = import.meta.env.VITE_REFERRAL_CC as string | undefined;

function useReferralHead(): string {
  const read = () => {
    const path = window.location.hash.replace(/^#/, "").split("?")[0];
    const parts = path.split("/").filter(Boolean);
    return parts[0] === "referrals" ? (parts[1] ?? "board") : "board";
  };
  const [head, setHead] = useState(read);
  useEffect(() => {
    const onHash = () => setHead(read());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  return head;
}

function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

type Draft = {
  client_name: string;
  client_email: string;
  client_phone: string;
  location: string;
  side: "" | Side;
  timeline: string;
  notes: string;
  fub_person_id: string;
  fub_url: string;
  shortlist: string;
  receiving_agent: string;
  receiving_agent_email: string;
  receiving_agent_phone: string;
  receiving_brokerage: string;
  fub_owner: string;
  isa_email: string;
};

const EMPTY: Draft = {
  client_name: "", client_email: "", client_phone: "", location: "", side: "", timeline: "", notes: "",
  fub_person_id: "", fub_url: "", shortlist: "", receiving_agent: "", receiving_agent_email: "",
  receiving_agent_phone: "", receiving_brokerage: "", fub_owner: "", isa_email: "",
};

function draftFrom(row: Referral): Draft {
  return {
    client_name: row.client_name,
    client_email: row.client_email,
    client_phone: row.client_phone,
    location: row.location ?? "",
    side: row.side ?? "",
    timeline: row.timeline ?? "",
    notes: row.notes ?? "",
    fub_person_id: row.fub_person_id ?? "",
    fub_url: row.fub_url ?? "",
    shortlist: row.shortlist ?? "",
    receiving_agent: row.receiving_agent ?? "",
    receiving_agent_email: row.receiving_agent_email ?? "",
    receiving_agent_phone: row.receiving_agent_phone ?? "",
    receiving_brokerage: row.receiving_brokerage ?? "",
    fub_owner: row.fub_owner ?? "",
    isa_email: row.isa_email ?? "",
  };
}

function toWrite(d: Draft, withHandoff: boolean): ReferralWrite {
  const side = d.side && isSide(d.side) ? d.side : null;
  const base: ReferralWrite = {
    client_name: d.client_name.trim(),
    client_email: d.client_email.trim(),
    client_phone: d.client_phone.trim(),
    location: blankToNull(d.location),
    side,
    timeline: blankToNull(d.timeline),
    notes: blankToNull(d.notes),
    fub_person_id: blankToNull(d.fub_person_id),
    fub_url: blankToNull(d.fub_url),
    fub_owner: blankToNull(d.fub_owner),
    receiving_agent_phone: blankToNull(d.receiving_agent_phone),
    receiving_brokerage: blankToNull(d.receiving_brokerage),
  };
  if (!withHandoff) return base;
  return {
    ...base,
    shortlist: d.shortlist.trim() ? d.shortlist.trim() : null,
    receiving_agent: blankToNull(d.receiving_agent),
    receiving_agent_email: blankToNull(d.receiving_agent_email),
    isa_email: blankToNull(d.isa_email),
  };
}

function mergePrefill(d: Draft, person: FubPrefill): Draft {
  return {
    ...d,
    client_name: d.client_name.trim() ? d.client_name : person.name,
    client_email: d.client_email.trim() ? d.client_email : person.email,
    client_phone: d.client_phone.trim() ? d.client_phone : person.phone,
    location: d.location.trim() ? d.location : person.location,
    fub_person_id: person.id || d.fub_person_id,
    fub_url: person.url || d.fub_url,
    fub_owner: d.fub_owner.trim() ? d.fub_owner : person.owner,
  };
}

function Field(props: { label: string; children: ReactNode; wide?: boolean }) {
  return <label className={"field" + (props.wide ? " wide" : "")}><span>{props.label}</span>{props.children}</label>;
}

function ClientFields(props: { draft: Draft; set: (patch: Partial<Draft>) => void }) {
  const { draft, set } = props;
  return (
    <div className="rh-fields two">
      <Field label="Name" wide><input value={draft.client_name} onChange={(e) => set({ client_name: e.target.value })} required autoComplete="name" /></Field>
      <Field label="Email"><input type="email" value={draft.client_email} onChange={(e) => set({ client_email: e.target.value })} required autoComplete="email" /></Field>
      <Field label="Phone"><input type="tel" value={draft.client_phone} onChange={(e) => set({ client_phone: e.target.value })} required autoComplete="tel" /></Field>
      <Field label="Location"><input value={draft.location} onChange={(e) => set({ location: e.target.value })} placeholder="City, ST" /></Field>
      <Field label="Buyer, seller, or lease">
        <select value={draft.side} onChange={(e) => { const v = e.target.value; set({ side: isSide(v) ? v : "" }); }}>
          <option value="">Optional</option>
          {SIDES.map((s) => <option key={s} value={s}>{sideLabel(s)}</option>)}
        </select>
      </Field>
      <Field label="Timeline" wide><input value={draft.timeline} onChange={(e) => set({ timeline: e.target.value })} placeholder="ASAP, 30 days, this spring" /></Field>
      <Field label="Notes" wide><textarea value={draft.notes} onChange={(e) => set({ notes: e.target.value })} /></Field>
    </div>
  );
}

function FubLookup(props: { draft: Draft; set: (patch: Partial<Draft>) => void; onFound: (person: FubPrefill) => void }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [bad, setBad] = useState(false);
  const raw = props.draft.fub_url || props.draft.fub_person_id;
  const run = async (person: string) => {
    const id = parseFubPersonId(person);
    if (!id) { setBad(true); setMsg("Enter a Follow Up Boss person id or a person URL."); return; }
    setBusy(true); setBad(false); setMsg("");
    try {
      const found = await lookupFub(person);
      props.onFound(found);
      setMsg(found.stage ? `Filled from Follow Up Boss. Stage: ${found.stage}.` : "Filled from Follow Up Boss.");
    } catch (e) {
      setBad(true);
      setMsg(humanError(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="stack">
      <div className="rh-fields two">
        <Field label="Follow Up Boss person id or URL" wide>
          <input value={raw} onChange={(e) => { const v = e.target.value; props.set({ fub_url: v, fub_person_id: parseFubPersonId(v) ?? "" }); }} placeholder="12345 or https://agentbly1.followupboss.com/2/people/view/12345" />
        </Field>
      </div>
      <div className="rh-actions">
        <button type="button" className="ghost dark" disabled={busy} onClick={() => run(raw)}>
          {busy ? "Looking up…" : "Look up in Follow Up Boss"}
        </button>
      </div>
      {msg ? <p className={bad ? "rh-error" : "caption"} role={bad ? "alert" : undefined}>{msg}</p> : <p className="caption">Optional. The API key stays on the referral-fub Edge Function (secret FUB_API_KEY), not in this site.</p>}
    </div>
  );
}

function NewReferral() {
  const { href } = useAgent();
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const q = new URLSearchParams(window.location.hash.split("?")[1] || "").get("fub");
    if (!q) return;
    let cancel = false;
    setDraft((d) => ({ ...d, fub_url: q }));
    lookupFub(q).then((person) => { if (!cancel) setDraft((d) => mergePrefill({ ...d, fub_url: q }, person)); }).catch(() => { /* staff can type the client; the button explains a missing key */ });
    return () => { cancel = true; };
  }, []);

  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const problem = validateDraft(draft);
    if (problem) { setErr(problem); return; }
    const fub = fubFields(draft.fub_url || draft.fub_person_id);
    setBusy(true); setErr("");
    try {
      const row = await createReferral(toWrite({ ...draft, ...fub }, false));
      window.location.hash = href(`#/referrals/${row.id}`);
    } catch (ex) {
      setErr(humanError(ex));
      setBusy(false);
    }
  };

  return (
    <form className="section" onSubmit={onSubmit}>
      <h2 className="serif">New referral</h2>
      <p className="caption">Name, email, and phone are required. After you save, agent profiles near the location are the next step. The form handoff stays closed until a receiving agent email is on the record.</p>
      {err ? <p className="rh-error" role="alert">{err}</p> : null}
      <ClientFields draft={draft} set={set} />
      <FubLookup draft={draft} set={set} onFound={(person) => setDraft((d) => mergePrefill(d, person))} />
      <div className="rh-actions">
        <button className="primary" type="submit" disabled={busy}>{busy ? "Saving…" : "Create referral"}</button>
      </div>
    </form>
  );
}

function Board() {
  const { href } = useAgent();
  const [rows, setRows] = useState<Referral[] | null>(null);
  const [err, setErr] = useState("");
  const [moved, setMoved] = useState(0);
  const [filter, setFilter] = useState<Status | null>(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      let n = 0;
      try { n = await applySilence(); } catch { /* list surfaces a missing table; a silence failure still leaves the board usable */ }
      try {
        const list = await listReferrals();
        if (!cancel) { setMoved(n); setRows(list); }
      } catch (e) {
        if (!cancel) setErr(humanError(e));
      }
    })();
    return () => { cancel = true; };
  }, []);

  if (err) return <p className="rh-error" role="alert">{err}</p>;
  if (!rows) return <div className="center"><div className="spinner" /></div>;
  const due = rows.filter((r) => isTouchDue(r.next_touch_on, r.status)).length;
  const visible = filter ? STATUSES.filter((status) => status === filter) : STATUSES;
  return (
    <div className="stack">
      <p className="caption">New → shortlist → awaiting pick → sent → connected → monthly check → closed. Nurture is the quiet pile. After the handoff email, the next touch is 14 days out. Monthly check moves that to every 30 days. Opening this board files anyone untouched for six months into Nurture.</p>
      {moved > 0 ? <p className="rh-note">{moved === 1 ? "1 referral moved to nurture" : `${moved} referrals moved to nurture`} after six months without a touch.</p> : null}
      {due > 0 ? <p className="rh-note">{due === 1 ? "1 referral is due" : `${due} referrals are due`} for a touch.</p> : null}
      <ReminderPreview />
      {rows.length === 0 ? <p className="summary">No referrals yet. Create the first one.</p> : null}
      <div className="rh-filters" role="group" aria-label="Filter the board by status">
        <button type="button" className={filter === null ? "on" : ""} aria-pressed={filter === null} onClick={() => setFilter((current) => toggleStatusFilter(current, "all"))}>All <span>{rows.length}</span></button>
        {STATUSES.map((status) => {
          const count = rows.filter((r) => r.status === status).length;
          const on = filter === status;
          return (
            <button key={status} type="button" className={on ? "on" : ""} aria-pressed={on} onClick={() => setFilter((current) => toggleStatusFilter(current, status))}>
              {statusLabel(status)} <span>{count}</span>
            </button>
          );
        })}
      </div>
      {filter ? <p className="rh-note" role="status">Showing {statusLabel(filter)}. Select it again, or All, to show every status.</p> : null}
      <div className="rh-board">
        {visible.map((status) => {
          const cards = rows.filter((r) => r.status === status);
          return (
            <section key={status} className="rh-col" aria-label={statusLabel(status)}>
              <h2 className="serif">{statusLabel(status)} <span>{cards.length}</span></h2>
              {cards.length === 0 ? <p className="rh-empty">None</p> : cards.map((r) => (
                <a key={r.id} className={"rh-card" + (isTouchDue(r.next_touch_on, r.status) ? " due" : "")} href={href(`#/referrals/${r.id}`)}>
                  <span className="rh-name">{r.client_name}</span>
                  <span className="rh-meta">{[r.side ? sideLabel(r.side) : "", r.location || ""].filter(Boolean).join(" · ") || "No location yet"}</span>
                  <span className="rh-meta">Emails {r.email_count}{r.last_email_at ? ` · last ${formatWhen(r.last_email_at)}` : ""}</span>
                  {r.next_touch_on && (status === "sent" || status === "connected" || status === "monthly_check") ? <span className="rh-meta">{isTouchDue(r.next_touch_on, r.status) ? <span className="rh-pill">Due </span> : null}Next {formatDay(r.next_touch_on)} · {r.cadence}</span> : null}
                </a>
              ))}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function eventText(ev: ReferralEvent): string {
  const detail = ev.detail ?? {};
  if (ev.kind === "created") return "Created";
  if (ev.kind === "status") {
    const from = typeof detail.from === "string" && isStatus(detail.from) ? statusLabel(detail.from) : String(detail.from ?? "—");
    const to = typeof detail.to === "string" && isStatus(detail.to) ? statusLabel(detail.to) : String(detail.to ?? "—");
    return `Status ${from} to ${to}`;
  }
  if (ev.kind === "email_sent") return `Handoff email logged (count ${String(detail.email_count ?? "")})`;
  if (ev.kind === "draft_created") return "Outlook draft created. Not sent yet.";
  if (ev.kind === "fub_writeback") return "Follow Up Boss updated. Tag, stage, and note. Contacts were not merged.";
  if (ev.kind === "reminder") return "Follow-up reminder sent.";
  return ev.kind;
}

function Detail({ id }: { id: string }) {
  const { list } = useAgent();
  const [row, setRow] = useState<Referral | null>(null);
  const [events, setEvents] = useState<ReferralEvent[]>([]);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [missing, setMissing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [lookup, setLookup] = useState<AgentLookup | null>(null);
  const [fubMsg, setFubMsg] = useState("");
  const [receivingOpen, setReceivingOpen] = useState(true);
  const chain = useRef(Promise.resolve());
  const statusRef = useRef<Status>("new");
  const draftRef = useRef(draft);
  draftRef.current = draft;

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const [found, hist] = await Promise.all([getReferral(id), listEvents(id)]);
        if (cancel) return;
        if (!found) { setMissing(true); return; }
        setRow(found);
        statusRef.current = found.status;
        setDraft(draftFrom(found));
        setReceivingOpen(!(found.receiving_agent?.trim() || found.receiving_agent_email?.trim()));
        setEvents(hist);
      } catch (e) {
        if (!cancel) setErr(humanError(e));
      }
    })();
    return () => { cancel = true; };
  }, [id]);

  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  const enqueue = (task: () => Promise<void>) => {
    const run = chain.current.then(task, task);
    chain.current = run.then(() => undefined, () => undefined);
    return run;
  };

  const onListed = (result: AgentLookup) => {
    setLookup(result);
    return enqueue(async () => {
      if (result.tier === "unplaced" || result.agents.length === 0) return;
      const next = statusAfterOptions(statusRef.current);
      if (!next) return;
      const updated = await updateReferral(id, { status: next });
      statusRef.current = updated.status;
      setRow(updated);
      setEvents(await listEvents(id));
    });
  };

  const choose = (agent: { name: string; email: string; phone?: string; place?: string; distanceLabel?: string; level?: string }) => enqueue(async () => {
    const email = isEmail(agent.email) ? agent.email.trim() : "";
    const phone = agent.phone?.trim() ?? "";
    const line = formatShortlistLine({ name: agent.name, email, place: agent.place, distanceLabel: agent.distanceLabel, level: agent.level });
    const shortlist = ensureShortlistLine(draftRef.current.shortlist, line);
    draftRef.current = {
      ...draftRef.current,
      receiving_agent: agent.name,
      receiving_agent_email: email,
      receiving_agent_phone: phone,
      receiving_brokerage: DEFAULT_RECEIVING_BROKERAGE,
      shortlist,
    };
    setDraft(draftRef.current);
    const status = statusAfterPick(statusRef.current);
    setBusy(true); setErr(""); setNote("");
    try {
      const patch: Partial<ReferralWrite> & { status?: Status } = {
        receiving_agent: blankToNull(agent.name),
        receiving_agent_email: email ? email : null,
        receiving_agent_phone: blankToNull(phone),
        receiving_brokerage: DEFAULT_RECEIVING_BROKERAGE,
        shortlist: shortlist.trim() ? shortlist.trim() : null,
      };
      if (status) patch.status = status;
      const next = await updateReferral(id, patch);
      statusRef.current = next.status;
      const saved = draftFrom(next);
      draftRef.current = saved;
      setRow(next);
      setDraft(saved);
      setEvents(await listEvents(id));
      setReceivingOpen(false);
      setNote(email
        ? `${agent.name} is the receiving agent. Edit the referral form when you are ready. The handoff creates an Outlook draft with the filled PDF attached.`
        : `${agent.name} is selected. Add an email before editing the referral form.`);
    } catch (e) {
      setErr(humanError(e));
    } finally {
      setBusy(false);
    }
  });

  const save = async () => {
    const problem = validateDraft(draft);
    if (problem) { setErr(problem); return; }
    if (draft.receiving_agent_email.trim() && !isEmail(draft.receiving_agent_email)) { setErr("Receiving agent email is not valid."); return; }
    if (draft.receiving_agent_phone.trim().length > 40) { setErr("Receiving agent phone is too long."); return; }
    if (draft.receiving_brokerage.trim().length > 200) { setErr("Receiving brokerage is too long."); return; }
    if (draft.fub_owner.trim().length > 200) { setErr("Bly Team agent name is too long."); return; }
    if (draft.isa_email.trim() && !isEmail(draft.isa_email)) { setErr("ISA email is not valid."); return; }
    setBusy(true); setErr(""); setNote("");
    try {
      const next = await updateReferral(id, toWrite({ ...draft, ...fubFields(draft.fub_url || draft.fub_person_id) }, true));
      statusRef.current = next.status;
      setRow(next);
      setDraft(draftFrom(next));
      setEvents(await listEvents(id));
      setNote("Saved.");
    } catch (e) {
      setErr(humanError(e));
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (status: Status) => {
    setBusy(true); setErr(""); setNote("");
    try {
      const next = await updateReferral(id, { status });
      statusRef.current = next.status;
      setRow(next);
      setEvents(await listEvents(id));
      setNote(`Status is ${statusLabel(next.status)}. Next touch ${formatDay(next.next_touch_on)} (${next.cadence}).`);
    } catch (e) {
      setErr(humanError(e));
    } finally {
      setBusy(false);
    }
  };

  const sent = async () => {
    if (!isEmail(draft.receiving_agent_email)) { setErr("Add the receiving agent’s email before logging the send."); return; }
    setBusy(true); setErr(""); setNote(""); setFubMsg("");
    try {
      const { referral: next, fubMessage } = await confirmHandoffSent({ id, agent: draft.receiving_agent.trim(), email: draft.receiving_agent_email.trim(), isa: draft.isa_email.trim(), shortlist: draft.shortlist });
      statusRef.current = next.status;
      setRow(next);
      setDraft(draftFrom(next));
      setEvents(await listEvents(id));
      setFubMsg(fubMessage);
      setNote(`Logged. Emails: ${next.email_count}. Next touch ${formatDay(next.next_touch_on)} (${next.cadence}). ${fubMessage}`);
    } catch (e) {
      setErr(humanError(e));
    } finally {
      setBusy(false);
    }
  };

  const retryFub = async () => {
    setBusy(true); setErr(""); setFubMsg("");
    try {
      const fub = await writeBackReferral(id);
      const [next, hist] = await Promise.all([getReferral(id), listEvents(id)]);
      if (next) {
        statusRef.current = next.status;
        setRow(next);
        setDraft(draftFrom(next));
      }
      setEvents(hist);
      setFubMsg(fub.message);
      setNote(fub.message);
    } catch (e) {
      setErr(humanError(e));
    } finally {
      setBusy(false);
    }
  };

  if (err && !row) return <p className="rh-error" role="alert">{err}</p>;
  if (missing) return <p className="rh-error">That referral is not on file.</p>;
  if (!row) return <div className="center"><div className="spinner" /></div>;

  const recordUrl = referralRecordUrl(row.id);
  const cc = handoffCc(CC_ENV, draft.isa_email, draft.receiving_agent_email);
  const entries = parseShortlist(draft.shortlist);
  const blyNames = mergeStaffAgents(list);
  const pickedAgent = Boolean(draft.receiving_agent.trim() || draft.receiving_agent_email.trim());
  const pickedLine = [draft.receiving_agent.trim(), draft.receiving_brokerage.trim()].filter(Boolean).join(" · ");

  return (
    <div className="stack">
      {err ? <p className="rh-error" role="alert">{err}</p> : null}
      {note ? <p className="rh-note">{note}</p> : null}
      <section className="section">
        <h2 className="serif">{row.client_name}</h2>
        <p className="caption">Emails {row.email_count}{row.last_email_at ? ` · last email ${formatWhen(row.last_email_at)}` : ""}{row.outlook_draft_at ? ` · Outlook draft ${formatWhen(row.outlook_draft_at)} (not sent)` : ""} · cadence {row.cadence} · next touch {formatDay(row.next_touch_on)}</p>
        <div className="rh-status" role="group" aria-label="Status">
          {STATUSES.map((s) => (
            <button key={s} type="button" className={row.status === s ? "on" : ""} aria-pressed={row.status === s} disabled={busy} onClick={() => setStatus(s)}>{statusLabel(s)}</button>
          ))}
        </div>
      </section>
      {receivingOpen ? (
        <>
          <section className="section">
            <h2 className="serif">Agent options</h2>
            <p className="caption">The agent or ISA picks the receiving agent. Kevin and Deb stay on Cc unless they are the one who has to choose.</p>
            {draft.location.trim() !== (row.location ?? "").trim() ? <p className="caption">Save the client to rank agents for the edited location.</p> : null}
            <AgentOptions
              location={row.location ?? ""}
              selectedEmail={draft.receiving_agent_email}
              selectedName={draft.receiving_agent}
              busy={busy}
              onPick={(agent: AgentOption) => { void choose(agent); }}
              onListed={onListed}
            />
          </section>
          <ExpShortlist
            location={row.location ?? ""}
            exp={lookup?.exp ?? null}
            loading={false}
            selectedEmail={draft.receiving_agent_email}
            selectedName={draft.receiving_agent}
            busy={busy}
            onPick={(agent) => { void choose(agent); }}
          />
        </>
      ) : null}
      <div className="rh-split">
        <section className="section">
          <h2 className="serif">Client</h2>
          <p className="caption">This card is the only place to edit client details. The referral form uses these values and does not edit them.</p>
          <ClientFields draft={draft} set={set} />
          <FubLookup draft={draft} set={set} onFound={(person) => setDraft((d) => mergePrefill(d, person))} />
          <div className="rh-actions"><button type="button" className="primary" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save"}</button></div>
        </section>
        <section className="section">
          <h2 className="serif">Receiving agent</h2>
          {receivingOpen ? (
            <>
              <p className="caption">Pick a card above, or enter the agent here. The form below is filled from this agent. Cc is the ISA, Kevin, and Deb. Creating an Outlook draft does not mark the referral sent.</p>
              <div className="rh-fields">
                <Field label="Receiving agent"><input value={draft.receiving_agent} onChange={(e) => set({ receiving_agent: e.target.value })} /></Field>
                <Field label="Receiving agent email"><input type="email" value={draft.receiving_agent_email} onChange={(e) => set({ receiving_agent_email: e.target.value })} /></Field>
                <Field label="Receiving agent phone"><input value={draft.receiving_agent_phone} onChange={(e) => set({ receiving_agent_phone: e.target.value })} /></Field>
                <Field label="Receiving brokerage"><input value={draft.receiving_brokerage} onChange={(e) => set({ receiving_brokerage: e.target.value })} placeholder={DEFAULT_RECEIVING_BROKERAGE} /></Field>
                <Field label="ISA email (Cc)"><input type="email" value={draft.isa_email} onChange={(e) => set({ isa_email: e.target.value })} placeholder="Optional" /></Field>
                <Field label="Bly Team agent (Follow Up Boss owner)">
                  <input value={draft.fub_owner} list="bly-agents" onChange={(e) => set({ fub_owner: e.target.value })} placeholder="Required before the Outlook draft" />
                </Field>
              </div>
              <datalist id="bly-agents">
                {blyNames.map((name) => <option key={name} value={name} />)}
              </datalist>
              <p className="caption">Email only. Required before the Outlook draft, not before preview. Deborah G. Bly stays the originating agent on the PDF.</p>
              <details className="rh-sources">
                <summary>Paste a shortlist instead</summary>
                <p className="caption">One person per line: Name &lt;email&gt; — market.</p>
                <div className="rh-fields">
                  <Field label="Agent shortlist" wide>
                    <textarea value={draft.shortlist} onChange={(e) => set({ shortlist: e.target.value })} placeholder={"Ada Lovelace <ada@exp.com> — Austin\nGrace Hopper, grace@exp.com"} />
                  </Field>
                  {entries.length ? (
                    <Field label="Use a pasted line">
                      <select value="" onChange={(e) => {
                        const entry = entries[Number(e.target.value)];
                        if (!entry) return;
                        void choose({ name: entry.name, email: entry.email });
                      }}>
                        <option value="">Select an agent</option>
                        {entries.map((entry, i) => <option key={i} value={i}>{entry.name}{entry.email ? ` · ${entry.email}` : ""}</option>)}
                      </select>
                    </Field>
                  ) : null}
                </div>
              </details>
              <p className="rh-cc">Cc: {cc.join(", ") || "—"}</p>
              <div className="rh-actions">
                <button type="button" className="ghost dark" disabled={!pickedAgent} onClick={() => setReceivingOpen(false)}>Done</button>
              </div>
              {!isEmail(draft.receiving_agent_email) ? <p className="caption">Pick an agent card, or enter a receiving agent email, before the form handoff.</p> : null}
            </>
          ) : (
            <div className="rh-picked">
              <div>
                <p className="rh-name">{pickedLine || "Receiving agent"}</p>
                <p className="rh-meta">{draft.receiving_agent_email.trim() || "No email yet"}{draft.receiving_agent_phone.trim() ? ` · ${draft.receiving_agent_phone.trim()}` : ""}</p>
                <p className="rh-meta">{draft.fub_owner.trim() ? `Bly Team agent: ${draft.fub_owner.trim()}` : "Bly Team agent is not named yet. Change to add one before the Outlook draft."}</p>
              </div>
              <button type="button" className="ghost dark" onClick={() => setReceivingOpen(true)}>Change</button>
            </div>
          )}
          <h3 className="serif">Follow Up Boss field</h3>
          <p className="caption">Paste this into the custom field <b>Bly Team Referral Hub</b>. New referrals start at <a href={referralNewUrl()}>{referralNewUrl()}</a>.</p>
          <div className="rh-linkrow">
            <input readOnly value={recordUrl} aria-label="Bly Team Referral Hub field value" onFocus={(e) => e.currentTarget.select()} />
            <button type="button" className="ghost dark" onClick={async () => {
              try { await navigator.clipboard.writeText(recordUrl); setCopied(true); } catch { setCopied(false); setErr("Could not copy. Select the link and copy it."); }
            }}>{copied ? "Copied" : "Copy"}</button>
          </div>
        </section>
      </div>
      {isEmail(draft.receiving_agent_email) ? (
        <Suspense fallback={<p className="caption">Loading the referral form…</p>}>
        <Handoff
          seed={{
            clientName: draft.client_name,
            clientEmail: draft.client_email,
            clientPhone: draft.client_phone,
            location: draft.location,
            side: draft.side || null,
            timeline: draft.timeline,
            notes: draft.notes,
            fubPersonId: draft.fub_person_id,
            referralId: row.id,
            receivingAgent: draft.receiving_agent,
            receivingEmail: draft.receiving_agent_email,
            receivingPhone: draft.receiving_agent_phone,
            receivingBrokerage: draft.receiving_brokerage,
            blyAgent: draft.fub_owner,
          }}
          cc={cc}
          recordUrl={recordUrl}
          location={draft.location}
          timeline={draft.timeline}
          notes={draft.notes}
          busy={busy}
          draftAt={row.outlook_draft_at}
          draftLink={row.outlook_draft_web_link}
          onSent={sent}
          fubMessage={fubMsg}
          showFubRetry={Boolean(fubMsg || row.fub_writeback || row.email_count > 0)}
          onRetryFub={retryFub}
          onPersist={async (form) => {
            const next = await updateReferral(id, toWrite({
              ...draftRef.current,
              receiving_agent: form.receivingAgent,
              receiving_agent_email: form.receivingEmail,
              receiving_agent_phone: form.receivingPhone,
              receiving_brokerage: form.receivingBrokerage,
              fub_owner: form.blyAgent,
            }, true));
            statusRef.current = next.status;
            const saved = draftFrom(next);
            draftRef.current = saved;
            setRow(next);
            setDraft(saved);
          }}
          onDraftRecorded={async (webLink) => {
            const next = await markOutlookDraft(id, webLink);
            statusRef.current = next.status;
            const saved = draftFrom(next);
            draftRef.current = saved;
            setRow(next);
            setDraft(saved);
            setEvents(await listEvents(id));
          }}
        />
        </Suspense>
      ) : null}
      <section className="section">
        <h2 className="serif">Activity</h2>
        {events.length === 0 ? <p className="caption">No activity yet.</p> : (
          <ul className="rh-events">
            {events.map((ev) => (
              <li key={ev.id}><span>{eventText(ev)}</span><time dateTime={ev.created_at}>{formatWhen(ev.created_at)}</time></li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default function Referrals() {
  const { href } = useAgent();
  const head = useReferralHead();
  const detailId = isUuid(head) ? head : null;
  const onBoard = head === "board";
  return (
    <div className="page-body referrals">
      <div className="rh-top">
        <div>
          <h1 className="page-title serif">Referral Hub</h1>
          <p className="summary">Out-of-area referrals for The Bly Team. Create a record, pick an agent from the profiles near the location, then hand it off as an Outlook draft with the filled referral form attached.</p>
        </div>
      </div>
      <nav className="rh-tabs" aria-label="Referral Hub">
        <a href={href("#/referrals/board")} className={onBoard ? "on" : ""} aria-current={onBoard ? "page" : undefined}>Board</a>
        <a href={href("#/referrals/new")} className={head === "new" ? "on" : ""} aria-current={head === "new" ? "page" : undefined}>New referral</a>
      </nav>
      {head === "new" ? <NewReferral /> : detailId ? <Detail key={detailId} id={detailId} /> : head === "board" ? <Board /> : (
        <p className="rh-error">That referral link is not recognized. <a href={href("#/referrals/board")}>Back to the board</a>.</p>
      )}
    </div>
  );
}
