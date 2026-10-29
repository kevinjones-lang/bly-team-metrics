import { useState } from "react";
import { supabase } from "../sb";
import { humanError } from "./logic.ts";
import type { PublicReminder } from "../../supabase/functions/referral-reminders/logic.ts";

type Preview = {
  dryRun?: unknown;
  sent?: unknown;
  message?: unknown;
  reminders?: PublicReminder[];
};

function kindLabel(kind: PublicReminder["kind"]): string {
  switch (kind) {
    case "follow_up": return "Follow-up";
    case "nurture": return "Nurture flag";
    default: {
      const _n: never = kind;
      return _n;
    }
  }
}

function deliveryLabel(delivery: PublicReminder["delivery"]): string {
  switch (delivery) {
    case "dm": return "Slack DM";
    case "channel": return "Referral channel";
    case "undeliverable": return "No Slack destination";
    default: {
      const _n: never = delivery;
      return _n;
    }
  }
}

export default function ReminderPreview() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [message, setMessage] = useState("");
  const [rows, setRows] = useState<PublicReminder[] | null>(null);

  const run = async () => {
    setBusy(true);
    setErr("");
    setMessage("");
    const { data, error } = await supabase.functions.invoke("referral-reminders", { body: { dryRun: true } });
    setBusy(false);
    if (error) {
      let msg = error.message;
      const ctx = (error as { context?: Response }).context;
      if (ctx && typeof ctx.json === "function") {
        try {
          const body = await ctx.json() as { error?: unknown; message?: unknown };
          if (typeof body?.message === "string" && body.message) msg = body.message;
          else if (typeof body?.error === "string" && body.error) msg = body.error;
        } catch { /* empty */ }
      }
      setErr(humanError(new Error(msg)));
      return;
    }
    const body = (data ?? {}) as Preview;
    const list = (Array.isArray(body.reminders) ? body.reminders : []).filter((row): row is PublicReminder => {
      if (!row || typeof row !== "object") return false;
      const kind = row.kind === "follow_up" || row.kind === "nurture";
      const delivery = row.delivery === "dm" || row.delivery === "channel" || row.delivery === "undeliverable";
      return kind && delivery && typeof row.referralId === "string" && typeof row.clientName === "string" && typeof row.ownerName === "string";
    });
    setRows(list);
    const lead = typeof body.message === "string" ? body.message : "Dry run finished.";
    setMessage(body.sent === 0 || body.dryRun === true ? lead : `${lead} Sent count was ${String(body.sent)}.`);
  };

  return (
    <section className="section">
      <h2 className="serif">Follow-up reminders</h2>
      <p className="caption">Biweekly until connected, then monthly. Six months of silence is flagged for Nurture. This button only previews. It does not send Slack messages.</p>
      <div className="rh-actions">
        <button type="button" className="ghost dark" disabled={busy} onClick={() => { void run(); }}>{busy ? "Checking…" : "Preview follow-up reminders"}</button>
      </div>
      {err ? <p className="rh-error" role="alert">{err}</p> : null}
      {message ? <p className="rh-note">{message}</p> : null}
      {rows && rows.length === 0 ? <p className="caption">Nothing is due.</p> : null}
      {rows && rows.length > 0 ? (
        <ul className="rh-events">
          {rows.map((row) => (
            <li key={row.referralId}>
              <span>{kindLabel(row.kind)} · {row.clientName} · {row.ownerName} · {deliveryLabel(row.delivery)}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
