import "./fubaudit.css";
import { useEffect, useState, type ReactNode } from "react";
import { NAV } from "./nav";
import { AgentProvider, AgentSelect, useAgent, isExcluded, norm, saveScroll, restoreScroll, rememberHash } from "./agent";
import { mergeStaffAgents } from "./referrals/logic.ts";

const routeOf = () => { const id = window.location.hash.replace(/^#\/?/, "").split(/[/?]/)[0]; return NAV.some((n) => n.id === id) ? id : NAV[0].id; };
export function useRoute() {
  const [r, setR] = useState(routeOf());
  useEffect(() => {
    const f = () => { rememberHash(); const n = routeOf(); setR((o) => { if (o !== n) restoreScroll(); return n; }); };
    window.addEventListener("hashchange", f); return () => window.removeEventListener("hashchange", f);
  }, []);
  return r;
}

export function agentList(payload: any): string[] {
  const m = payload?.main; const src: string[] = m?.agent_list ?? Object.keys(m?.by_agent ?? {});
  return mergeStaffAgents(src.map(norm)).filter((n) => !isExcluded(n));
}
const METRICS_ROUTES = new Set(["team", "myt", "fub-audit", "fello", "zillow", "recruiting"]);

export default function Layout(props: { right?: ReactNode; payload: any; asOf?: string; metricsPending?: boolean }) {
  return <AgentProvider list={agentList(props.payload)}><Inner {...props} /></AgentProvider>;
}
function Inner({ right, payload, asOf, metricsPending }: { right?: ReactNode; payload: any; asOf?: string; metricsPending?: boolean }) {
  const { agent, href } = useAgent();
  const route = useRoute();
  const [open, setOpen] = useState(false);
  const item = NAV.find((n) => n.id === route)!;
  useEffect(() => setOpen(false), [route]);
  useEffect(() => { // per-route scroll memory: save while scrolling and on leave, restore on load
    restoreScroll(); let t = 0; const onS = () => { clearTimeout(t); t = window.setTimeout(saveScroll, 150); };
    const onHide = () => saveScroll();
    window.addEventListener("scroll", onS, { passive: true }); window.addEventListener("pagehide", onHide); document.addEventListener("visibilitychange", onHide);
    return () => { window.removeEventListener("scroll", onS); window.removeEventListener("pagehide", onHide); document.removeEventListener("visibilitychange", onHide); };
  }, []);
  return (
    <div className={"applayout" + (open ? " navopen" : "")}>
      <header className="topbar">
        <button className="hamburger" aria-label="Open navigation" aria-expanded={open} onClick={() => setOpen(!open)}><span /><span /><span /></button>
        <div className="wordmark serif">The Bly Team <span className="gold">·</span> Ops</div>
        <div className="topagent"><AgentSelect /></div>
        <div className="topright">{right}</div>
      </header>
      <div className="appbody">
        <nav className="sidebar" aria-label="Sections">
          <div className="sidehead serif">Workspace</div>
          {NAV.map((n) => (
            <a key={n.id} onClick={saveScroll} href={href("#/" + n.id)} className={"navitem" + (n.id === route ? " active" : "")} aria-current={n.id === route ? "page" : undefined}>
              <span className="navlabel">{n.label}</span>{n.hint ? <span className="navhint">{n.hint}</span> : null}
            </a>))}
        </nav>
        <div className="scrim" onClick={() => setOpen(false)} />
        <main className="content">
          {asOf && (route === "team" || route === "hub") ? <div className="asof">Snapshot {asOf}</div> : null}
          {metricsPending && !payload && METRICS_ROUTES.has(route)
            ? <div className="center"><div className="spinner" /><p className="caption">Loading the metrics snapshot…</p></div>
            : <div className="dash" key={item.id + "|" + (agent ?? "")}>{item.render(payload)}</div>}
          <footer className="foot serif">Built to multiply.</footer>
        </main>
      </div>
    </div>
  );
}
