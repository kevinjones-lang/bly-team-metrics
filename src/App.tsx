import { useEffect, useState } from "react";
import { type Session } from "@supabase/supabase-js";
import { supabase } from "./sb";
import { setData } from "./Dashboard";
import Layout from "./Layout";
import { restoreHash, saveReturn } from "./agent";

restoreHash(); // land where you left off (new tab, back button, Slack sign-in redirect)

const SITE = window.location.origin + import.meta.env.BASE_URL;

type State = "loading" | "signedout" | "restricted" | "nodata" | "ready" | "error";

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [state, setState] = useState<State>("loading");
  const [asOf, setAsOf] = useState<string>("");
  const [payload, setPayload] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); if (!data.session) setState("signedout"); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => { setSession(s); if (!s) { setState("signedout"); setData({}); } });
    return () => sub.subscription.unsubscribe();
  }, []);

  const uid = session?.user.id;
  useEffect(() => {
    if (!uid) return; // token refreshes keep the same user: no refetch, no remount, no lost place
    (async () => {
      if (!payload) setState("loading");
      const { data: staff, error: e1 } = await supabase.rpc("is_staff");
      if (e1) { setState("error"); return; }
      if (!staff) { setState("restricted"); return; }
      const { data, error } = await supabase.from("metrics_snapshots").select("snap_date,payload").order("snap_date", { ascending: false }).limit(1);
      if (error) { setState("error"); return; }
      if (!data || !data.length) { setState("nodata"); return; }
      setData(data[0].payload); setPayload(data[0].payload); setAsOf(data[0].snap_date); restoreHash(); setState("ready");
    })();
  }, [uid]); // eslint-disable-line react-hooks/exhaustive-deps

  const signIn = () => { saveReturn(); return supabase.auth.signInWithOAuth({ provider: "slack_oidc", options: { redirectTo: SITE } }); };
  const signOut = () => supabase.auth.signOut();

  if (state === "ready") return <Layout payload={payload} asOf={asOf} right={<button className="ghost" onClick={signOut}>Sign out</button>} />;

  return (
    <div className="shell">
      <header className="topbar">
        <div className="wordmark serif">The Bly Team <span className="gold">·</span> Metrics</div>
        {session ? <button className="ghost" onClick={signOut}>Sign out</button> : null}
      </header>
      <main>
        {state === "loading" ? <div className="center"><div className="spinner" /></div> : null}
        {state === "signedout" ? (
          <div className="gatecard">
            <div className="logoplate"><img src={import.meta.env.BASE_URL + "logo.png"} alt="Bly Team, eXp Realty" /></div>
            <h1 className="serif">Team metrics</h1>
            <p className="rule" />
            <p>Production, leads, attribution and P&amp;L for The Bly Team. Staff access only.</p>
            <button className="primary" onClick={signIn}>Sign in with Slack</button>
          </div>) : null}
        {state === "restricted" ? (
          <div className="gatecard">
            <h1 className="serif">Access restricted</h1><p className="rule" />
            <p>{`Signed in as ${session?.user.email ?? "unknown"}. This dashboard is limited to Bly Team admins. Ask Kevin if you need access.`}</p>
            <button className="ghost dark" onClick={signOut}>Sign out</button>
          </div>) : null}
        {state === "nodata" ? <div className="gatecard"><h1 className="serif">No snapshot yet</h1><p className="rule" /><p>The daily data load has not run yet. Check back after the next pipeline run.</p></div> : null}
        {state === "error" ? <div className="gatecard"><h1 className="serif">Something went wrong</h1><p className="rule" /><p>Could not load the dashboard. Try signing out and in again.</p><button className="ghost dark" onClick={signOut}>Sign out</button></div> : null}
      </main>
      <footer className="foot serif">Built to multiply.</footer>
    </div>
  );
}
