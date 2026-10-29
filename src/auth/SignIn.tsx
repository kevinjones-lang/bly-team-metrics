import { useState, type FormEvent } from "react";
import { supabase } from "../sb";
import { saveReturn } from "../agent";

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export default function SignIn(props: { redirectTo: string }) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [bad, setBad] = useState(false);

  const oauth = (provider: "slack_oidc" | "google") => {
    setBad(false);
    setMsg("");
    saveReturn();
    return supabase.auth.signInWithOAuth({ provider, options: { redirectTo: props.redirectTo } });
  };

  const sendCode = async (e: FormEvent) => {
    e.preventDefault();
    if (!isEmail(email)) {
      setBad(true);
      setMsg("Enter the email on your staff record.");
      return;
    }
    setBusy(true);
    setBad(false);
    setMsg("");
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: props.redirectTo, shouldCreateUser: true },
    });
    setBusy(false);
    if (error) {
      setBad(true);
      setMsg(error.message);
      return;
    }
    setSent(true);
    setMsg("Check that inbox for a sign-in link and a 6-digit code. Enter the code if the link was already opened.");
  };

  const verify = async (e: FormEvent) => {
    e.preventDefault();
    const token = code.trim();
    if (!/^\d{6}$/.test(token)) {
      setBad(true);
      setMsg("Enter the 6-digit code from the email.");
      return;
    }
    setBusy(true);
    setBad(false);
    setMsg("");
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token, type: "email" });
    setBusy(false);
    if (error) {
      setBad(true);
      setMsg(error.message);
    }
  };

  return (
    <div className="gate-actions">
      <button type="button" className="primary" onClick={() => { void oauth("slack_oidc"); }}>Sign in with Slack</button>
      <button type="button" className="ghost dark" onClick={() => { void oauth("google"); }}>Sign in with Google</button>
      <form onSubmit={sent ? verify : sendCode}>
        <label className="field">
          <span>Work email</span>
          <input type="email" autoComplete="email" value={email} onChange={(ev) => setEmail(ev.target.value)} required />
        </label>
        {sent ? (
          <label className="field">
            <span>Email code</span>
            <input inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(ev) => setCode(ev.target.value)} placeholder="6-digit code" />
          </label>
        ) : null}
        <button className="ghost dark" type="submit" disabled={busy}>{busy ? "Sending…" : sent ? "Enter code" : "Email me a sign-in code"}</button>
      </form>
      <p className="caption">Slack, Google, and email all use the same staff list. Google or email has to be the address on your staff record.</p>
      {msg ? <p className={bad ? "rh-error" : "caption"} role={bad ? "alert" : undefined}>{msg}</p> : null}
    </div>
  );
}
