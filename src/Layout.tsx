import { useEffect, useState, type ReactNode } from "react";
import { NAV } from "./nav";

const routeOf = () => { const id = window.location.hash.replace(/^#\/?/, "").split(/[/?]/)[0]; return NAV.some((n) => n.id === id) ? id : NAV[0].id; };
export function useRoute() {
  const [r, setR] = useState(routeOf());
  useEffect(() => { const f = () => { setR(routeOf()); window.scrollTo(0, 0); }; window.addEventListener("hashchange", f); return () => window.removeEventListener("hashchange", f); }, []);
  return r;
}

export default function Layout({ right, payload, asOf }: { right?: ReactNode; payload: any; asOf?: string }) {
  const route = useRoute();
  const [open, setOpen] = useState(false);
  const item = NAV.find((n) => n.id === route)!;
  useEffect(() => setOpen(false), [route]);
  return (
    <div className={"applayout" + (open ? " navopen" : "")}>
      <header className="topbar">
        <button className="hamburger" aria-label="Open navigation" aria-expanded={open} onClick={() => setOpen(!open)}><span /><span /><span /></button>
        <div className="wordmark serif">The Bly Team <span className="gold">·</span> Metrics</div>
        <div className="topright">{right}</div>
      </header>
      <div className="appbody">
        <nav className="sidebar" aria-label="Sections">
          <div className="sidehead serif">Workspace</div>
          {NAV.map((n) => (
            <a key={n.id} href={"#/" + n.id} className={"navitem" + (n.id === route ? " active" : "")} aria-current={n.id === route ? "page" : undefined}>
              <span className="navlabel">{n.label}</span>{n.hint ? <span className="navhint">{n.hint}</span> : null}
            </a>))}
        </nav>
        <div className="scrim" onClick={() => setOpen(false)} />
        <main className="content">
          {asOf && route === "team" ? <div className="asof">Snapshot {asOf}</div> : null}
          <div className="dash" key={item.id}>{item.render(payload)}</div>
          <footer className="foot serif">Built to multiply.</footer>
        </main>
      </div>
    </div>
  );
}
