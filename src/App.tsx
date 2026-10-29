import { useEffect, useState } from "react";
import { type Session } from "@supabase/supabase-js";
import { supabase } from "./sb";
import { setData } from "./Dashboard";
import Layout from "./Layout";
import { restoreHash } from "./agent";
import SignIn from "./auth/SignIn";
import { resolveStaff } from "./auth/staffSession";

restoreHash(); // land where you left off (new tab, back button, Slack sign-in redirect)

const SITE = window.location.origin + import.meta.env.BASE_URL;

type State = "loading" | "signedout" | "restricted" | "ready" | "error";

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [state, setState] = useState<State>("loading");
  const [asOf, setAsOf] = useState<string>("");
  const [payload, setPayload] = useState<any>(null);
  const [metricsPending, setMetricsPending] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); if (!data.session) setState("signedout"); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (!s) { setState("signedout"); setPayload(null); setAsOf(""); setMetricsPending(true); }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const uid = session?.user.id;
  useEffect(() => {
    if (!uid) return; // token refreshes keep the same user: no refetch, no remount, no lost place
    let cancel = false;
    (async () => {
      setState((current) => (current === "ready" ? current : "loading"));
      const staff = await resolveStaff();
      if (cancel) return;
      switch (staff) {
        case "error":
          setState("error");
          return;
        case "restricted":
          setState("restricted");
          return;
        case "staff":
          break;
        default: {
          const _n: never = staff;
          setState("error");
          return _n;
        }
      }
      // Referral Hub and the ops hub do not wait on metrics. A missing or failed snapshot stays on the metrics pages.
      setMetricsPending(true);
      setState("ready");
      restoreHash();
      try {
        const { data, error } = await supabase.from("metrics_snapshots").select("snap_date,payload").order("snap_date", { ascending: false }).limit(1);
        if (cancel) return;
        if (error || !data?.length) { setMetricsPending(false); return; }
        setData(data[0].payload); setPayload(data[0].payload); setAsOf(data[0].snap_date); setMetricsPending(false);
      } catch { if (!cancel) setMetricsPending(false); }
    })();
    return () => { cancel = true; };
  }, [uid]); // eslint-disable-line react-hooks/exhaustive-deps

  const signOut = () => supabase.auth.signOut();

  if (state === "ready") return <Layout payload={payload} asOf={asOf} metricsPending={metricsPending} right={<button className="ghost" onClick={signOut}>Sign out</button>} />;

  return (
    <div className="shell">
      <header className="topbar">
        <div className="wordmark serif">The Bly Team <span className="gold">·</span> Ops</div>
        {session ? <button className="ghost" onClick={signOut}>Sign out</button> : null}
      </header>
      <main>
        {state === "loading" ? <div className="center"><div className="spinner" /></div> : null}
        {state === "signedout" ? (
          <div className="gatecard">
            <div className="logoplate"><img src={import.meta.env.BASE_URL + "logo.png"} alt="Bly Team, eXp Realty" /></div>
            <h1 className="serif">Ops hub</h1>
            <p className="rule" />
            <p>Operations hub for The Bly Team — metrics, referrals, CRM, recruiting, and team sites. Staff access only.</p>
            <SignIn redirectTo={SITE} />
          </div>) : null}
        {state === "restricted" ? (
          <div className="gatecard">
            <h1 className="serif">Access restricted</h1><p className="rule" />
            <p>{`Signed in as ${session?.user.email ?? "unknown"}. This dashboard is limited to Bly Team admins. Slack, Google, and email use that same staff list. Ask Kevin if you need access.`}</p>
            <button className="ghost dark" onClick={signOut}>Sign out</button>
          </div>) : null}
        {state === "error" ? <div className="gatecard"><h1 className="serif">Something went wrong</h1><p className="rule" /><p>Could not confirm staff access. Try signing out and in again.</p><button className="ghost dark" onClick={signOut}>Sign out</button></div> : null}
      </main>
      <footer className="foot serif">Built to multiply.</footer>
    </div>
  );
}
