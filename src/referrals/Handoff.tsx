import { useEffect, useRef, useState, type ReactNode } from "react";
import { formatWhen, humanError, isEmail, sideLabel } from "./logic.ts";
import { createOutlookDraft } from "./api.ts";
import {
  contractFromSide, defaultReferralForm, validateHandoff,
  type ContractChoice, type FeeKind, type FormSeed, type ReferralForm,
} from "./formModel.ts";
import { fillReferralPdf, loadReferralTemplate } from "./pdfFill.ts";
import PdfPreview from "./PdfPreview.tsx";
import { handoffPayload } from "./outlookDraft.ts";
import { connectMicrosoft, createStaffDraft, microsoftAccount, microsoftConfigured } from "./outlook.ts";

type Step = "edit" | "preview";

function Field(props: { label: string; children: ReactNode; wide?: boolean }) {
  return <label className={"field" + (props.wide ? " wide" : "")}><span>{props.label}</span>{props.children}</label>;
}

function LockedField(props: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={"field" + (props.wide ? " wide" : "")}>
      <span>{props.label}</span>
      <p className="rh-readonly">{props.value.trim() || "—"}</p>
    </div>
  );
}

function feeKind(value: string): FeeKind {
  switch (value) {
    case "flat": return "flat";
    case "percent": return "percent";
    default: return "percent";
  }
}

function pdfBlob(bytes: Uint8Array): Blob {
  return new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
}

function contractCaption(contract: ContractChoice): string {
  switch (contract) {
    case "buy": return "The buy box will be checked.";
    case "sell": return "The sell box will be checked.";
    case "lease": return "The lease box will be checked.";
    case "other": return "The Other box will be checked.";
    case "": return "Set buyer, seller, or lease on the referral card before preview.";
    default: {
      const _n: never = contract;
      return _n;
    }
  }
}

export default function Handoff(props: {
  seed: FormSeed;
  cc: string[];
  recordUrl: string;
  location?: string | null;
  timeline?: string | null;
  notes?: string | null;
  busy: boolean;
  draftAt: string | null;
  draftLink: string | null;
  onPersist: (form: ReferralForm) => Promise<void>;
  onDraftRecorded: (webLink: string | null) => Promise<void>;
  onSent: () => Promise<void>;
}) {
  const seedRef = useRef(props.seed);
  seedRef.current = props.seed;
  const [form, setFormState] = useState(() => defaultReferralForm(props.seed));
  const [syncedEmail, setSyncedEmail] = useState((props.seed.receivingEmail ?? "").trim().toLowerCase());
  const [step, setStep] = useState<Step>("edit");
  const [pdf, setPdf] = useState<Uint8Array | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");
  const [link, setLink] = useState<string | null>(props.draftLink);
  const [account, setAccount] = useState("");

  useEffect(() => {
    if (!microsoftConfigured()) return;
    microsoftAccount().then((found) => setAccount(found?.username || found?.name || "")).catch(() => setAccount(""));
  }, []);

  useEffect(() => {
    const email = (props.seed.receivingEmail ?? "").trim().toLowerCase();
    if (!isEmail(email) || email === syncedEmail) return;
    setFormState(defaultReferralForm(seedRef.current));
    setSyncedEmail(email);
    setPdf(null);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setStep("edit");
  }, [props.seed.receivingEmail, syncedEmail]);

  useEffect(() => {
    const owner = props.seed.blyAgent ?? "";
    setFormState((current) => current.blyAgent === owner ? current : { ...current, blyAgent: owner });
  }, [props.seed.blyAgent]);

  const clientName = props.seed.clientName.trim();
  const clientEmail = props.seed.clientEmail.trim();
  const clientPhone = props.seed.clientPhone.trim();
  const contract = contractFromSide(props.seed.side);
  const clientKey = `${clientName}|${clientEmail}|${clientPhone}|${contract}`;
  const seenClient = useRef(clientKey);
  useEffect(() => {
    setFormState((current) => {
      if (current.clientName === clientName && current.clientEmail === clientEmail && current.clientPhone === clientPhone && current.contract === contract) return current;
      return { ...current, clientName, clientEmail, clientPhone, contract };
    });
    if (seenClient.current === clientKey) return;
    seenClient.current = clientKey;
    setPdf(null);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setStep("edit");
  }, [clientKey, clientName, clientEmail, clientPhone, contract]);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const edit = (patch: Partial<ReferralForm>) => {
    setFormState((current) => ({ ...current, ...patch }));
    const keys = Object.keys(patch) as (keyof ReferralForm)[];
    const changesPdf = keys.some((key) => key !== "blyAgent");
    if (changesPdf) {
      setPdf(null);
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      setStep("edit");
    }
    setNote("");
  };

  const reload = () => {
    setFormState(defaultReferralForm(seedRef.current));
    setPdf(null);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setStep("edit");
    setErr("");
    setNote("Reloaded from the referral.");
  };

  const withCard = (current: ReferralForm): ReferralForm => ({
    ...current,
    blyAgent: seedRef.current.blyAgent ?? "",
    clientName: seedRef.current.clientName.trim(),
    clientEmail: seedRef.current.clientEmail.trim(),
    clientPhone: seedRef.current.clientPhone.trim(),
    contract: contractFromSide(seedRef.current.side),
  });

  const preview = async () => {
    const current = withCard(form);
    const problem = validateHandoff(current, "preview");
    if (problem) { setErr(problem); return; }
    setWorking(true); setErr(""); setNote("");
    try {
      const template = await loadReferralTemplate();
      const bytes = (await fillReferralPdf(template, current)).slice();
      const url = URL.createObjectURL(pdfBlob(bytes));
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
      setPdf(bytes);
      setStep("preview");
    } catch (e) {
      setErr(humanError(e));
    } finally {
      setWorking(false);
    }
  };

  const connect = async () => {
    setWorking(true); setErr("");
    try {
      const signedIn = await connectMicrosoft();
      setAccount(signedIn.username || signedIn.name || "Connected");
      setNote("Microsoft is connected. Preview the form, then create the Outlook draft.");
    } catch (e) {
      setErr(humanError(e));
    } finally {
      setWorking(false);
    }
  };

  const create = async () => {
    if (!pdf) { setErr("Preview the filled PDF before creating the draft."); return; }
    const current = withCard(form);
    const problem = validateHandoff(current, "draft");
    if (problem) { setErr(problem); return; }
    setWorking(true); setErr(""); setNote("");
    try {
      await props.onPersist(current);
      const input = handoffPayload({
        form: current,
        pdf,
        cc: props.cc,
        recordUrl: props.recordUrl,
        location: props.location,
        timeline: props.timeline,
        notes: props.notes,
      });
      const result = microsoftConfigured() ? await createStaffDraft(input) : await createOutlookDraft(input);
      setLink(result.webLink);
      let recordError = "";
      try {
        await props.onDraftRecorded(result.webLink);
      } catch (e) {
        recordError = humanError(e);
      }
      const where = result.mailbox ? ` in ${result.mailbox}` : result.account ? ` for ${result.account}` : "";
      setNote(`Outlook draft created${where}. The filled PDF is attached. It is not sent. This referral stays Awaiting pick until you send the draft from Outlook and click I sent it.`);
      if (recordError) setErr(`The draft is in Outlook. The referral record did not store the draft time. ${recordError}`);
    } catch (e) {
      setErr(humanError(e));
    } finally {
      setWorking(false);
    }
  };

  const download = () => {
    if (!pdf) return;
    const url = URL.createObjectURL(pdfBlob(pdf));
    const a = document.createElement("a");
    a.href = url;
    a.download = `Universal-eXp-to-eXp-Referral.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const locked = working || props.busy;
  const openLink = link || props.draftLink;

  return (
    <section className="section">
      <h2 className="serif">Referral form</h2>
      <p className="caption">Edit the Universal eXp-to-eXp form, preview the filled PDF, create an Outlook draft with that PDF attached, then mark it sent after you send the draft from Outlook. Deborah G. Bly stays the originating agent. Client details come from the referral card. The Bly Team agent who owns the Follow Up Boss lead is named in the email only. Enter that name once, on the receiving agent panel. Preview works before it is filled. The Outlook draft still needs it.</p>
      <p className="rh-steps" aria-label="Handoff steps">
        <span className={step === "edit" ? "on" : ""}>1. Edit</span>
        <span className={step === "preview" ? "on" : ""}>2. Preview</span>
        <span>3. Outlook draft</span>
        <span className={props.draftAt || link ? "on" : ""}>4. I sent it</span>
      </p>
      {props.draftAt ? <p className="rh-note">An Outlook draft was created {formatWhen(props.draftAt)}. It has not been marked sent.</p> : null}
      {err ? <p className="rh-error" role="alert">{err}</p> : null}
      {note ? <p className="rh-note">{note}</p> : null}
      {step === "edit" ? (
        <div className="stack">
          <p className="caption">Name, email, phone, location, side, timeline, and notes are edited on the referral card. Change them there. Reload from referral after location, timeline, or notes change so additional terms pick up the card.</p>
          <div className="rh-fields two">
            <LockedField label="Client name" value={clientName} />
            <LockedField label="Client email" value={clientEmail} />
            <LockedField label="Client phone" value={clientPhone} />
            <LockedField label="Location" value={props.location ?? ""} />
            <LockedField label="Buyer, seller, or lease" value={props.seed.side ? sideLabel(props.seed.side) : ""} />
            <LockedField label="Timeline" value={props.timeline ?? ""} />
            <LockedField label="Notes" value={props.notes ?? ""} wide />
            <Field label="Originating brokerage" wide><input value={form.originatingBrokerage} onChange={(e) => edit({ originatingBrokerage: e.target.value })} /></Field>
            <Field label="Originating agent"><input value={form.originatingAgent} onChange={(e) => edit({ originatingAgent: e.target.value })} /></Field>
            <Field label="Originating phone"><input value={form.originatingPhone} onChange={(e) => edit({ originatingPhone: e.target.value })} /></Field>
            <Field label="Originating email" wide><input type="email" value={form.originatingEmail} onChange={(e) => edit({ originatingEmail: e.target.value })} /></Field>
            <Field label="Receiving brokerage" wide><input value={form.receivingBrokerage} onChange={(e) => edit({ receivingBrokerage: e.target.value })} /></Field>
            <Field label="Receiving agent"><input value={form.receivingAgent} onChange={(e) => edit({ receivingAgent: e.target.value })} /></Field>
            <Field label="Receiving phone"><input value={form.receivingPhone} onChange={(e) => edit({ receivingPhone: e.target.value })} /></Field>
            <Field label="Receiving email" wide><input type="email" value={form.receivingEmail} onChange={(e) => edit({ receivingEmail: e.target.value })} /></Field>
            <Field label="Referral opportunity id"><input value={form.opportunityId} onChange={(e) => edit({ opportunityId: e.target.value })} /></Field>
            <Field label="Term starts"><input type="date" value={form.termStart} onChange={(e) => edit({ termStart: e.target.value })} /></Field>
            <Field label="Term ends"><input type="date" value={form.termEnd} onChange={(e) => edit({ termEnd: e.target.value })} /></Field>
            <Field label="Referral fee">
              <select value={form.feeKind} onChange={(e) => edit({ feeKind: feeKind(e.target.value) })}>
                <option value="percent">Percent of gross commission</option>
                <option value="flat">Flat amount at closing</option>
              </select>
            </Field>
            {form.feeKind === "percent"
              ? <Field label="Percent"><input inputMode="decimal" value={form.feePercent} onChange={(e) => edit({ feePercent: e.target.value })} /></Field>
              : <Field label="Flat amount"><input value={form.feeFlat} onChange={(e) => edit({ feeFlat: e.target.value })} /></Field>}
            <Field label="Governing law"><input value={form.governingLaw} onChange={(e) => edit({ governingLaw: e.target.value })} /></Field>
            <Field label="Additional terms" wide><textarea value={form.additionalTerms} onChange={(e) => edit({ additionalTerms: e.target.value })} /></Field>
          </div>
          <p className="caption">Signature lines stay blank. {contractCaption(contract)} The fee defaults to 25% of gross commission. The contract box follows the side on the referral card.</p>
          <div className="rh-actions">
            <button type="button" className="primary" disabled={locked || !isEmail(form.receivingEmail)} onClick={() => { void preview(); }}>{working ? "Preparing…" : "Preview filled PDF"}</button>
            <button type="button" className="ghost dark" disabled={locked} onClick={reload}>Reload from referral</button>
          </div>
          {!isEmail(form.receivingEmail) ? <p className="caption">Pick a receiving agent with an email before preview.</p> : null}
        </div>
      ) : (
        <div className="stack">
          <p className="caption">These are the pages that will be attached. Check Deborah G. Bly as originating agent, the 25% fee unless you changed it, and the client and receiving agent.</p>
          {pdf ? <PdfPreview data={pdf} fallbackUrl={previewUrl} /> : null}
          {!(props.seed.blyAgent ?? "").trim() ? <p className="caption">Name the Bly Team agent on the receiving agent panel before creating the draft. That name is for the email only. It is not the originating agent on the PDF.</p> : null}
          <p className="rh-cc">To: {form.receivingEmail || "—"} · Cc: {props.cc.join(", ") || "—"}</p>
          {microsoftConfigured()
            ? <p className="caption">{account ? `Microsoft connected as ${account}.` : "Connect Microsoft once. The draft is created in that account’s Outlook Drafts."}</p>
            : <p className="caption">This site has no Microsoft app id, so Create Outlook draft asks the referral-outlook Edge Function to file the draft in the team mailbox. It does not open a blank email.</p>}
          <div className="rh-actions">
            <button type="button" className="ghost dark" disabled={locked} onClick={() => setStep("edit")}>Back to edit</button>
            {microsoftConfigured() && !account
              ? <button type="button" className="primary" disabled={locked} onClick={() => { void connect(); }}>{working ? "Connecting…" : "Connect Microsoft"}</button>
              : <button type="button" className="primary" disabled={locked || !pdf} onClick={() => { void create(); }}>{working ? "Creating draft…" : "Create Outlook draft"}</button>}
            <button type="button" className="ghost dark" disabled={locked || !pdf} onClick={download}>Download filled PDF</button>
            {previewUrl ? <a className="ghost dark" href={previewUrl} target="_blank" rel="noopener noreferrer">Open preview</a> : null}
          </div>
        </div>
      )}
      {step === "preview" || props.draftAt || openLink ? (
        <div className="stack">
          <div className="rh-actions">
            <button type="button" className="ghost dark" disabled={locked || !isEmail(form.receivingEmail)} onClick={() => { void props.onSent(); }}>I sent it</button>
          </div>
          <p className="caption">I sent it is the step after the Outlook draft. Use it only after you send that draft from Outlook. It logs the email and moves an early referral to Sent.</p>
        </div>
      ) : null}
      {openLink ? <p className="rh-actions"><a className="primary" href={openLink} target="_blank" rel="noopener noreferrer">Open the Outlook draft</a></p> : null}
    </section>
  );
}
