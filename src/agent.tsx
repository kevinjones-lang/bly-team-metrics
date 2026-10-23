// Global agent selector state: ?agent=<name> in the hash query, mirrored to localStorage so it follows you across tabs.
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export const TEAM_LABEL = "The Bly Team (all)";
const LS = "bly-agent";
export const norm = (s: any) => String(s ?? "").replace(/\s+/g, " ").trim();
/** Excluded from the selector: Fello AI dialer, removed agents, non-agent Sisu users. */
export const isExcluded = (n: string) => /^jesse jones$/i.test(n) || /^ralph\b/i.test(n) || /^transaction coordinator$/i.test(n) || /^unknown$/i.test(n);

const readHash = (): string | null => {
  const q = window.location.hash.split("?")[1] || "";
  const v = new URLSearchParams(q).get("agent");
  return v === null ? null : norm(v);
};
/** Hash with the current agent param set (or removed). */
export function withAgent(hash: string, agent: string | null) {
  const [path, q = ""] = hash.replace(/^#/, "").split("?");
  const p = new URLSearchParams(q); if (agent) p.set("agent", agent); else p.delete("agent");
  const s = p.toString(); return "#" + path + (s ? "?" + s : "");
}

type Ctx = { agent: string | null; setAgent: (a: string | null) => void; list: string[]; href: (h: string) => string };
const AgentCtx = createContext<Ctx>({ agent: null, setAgent: () => {}, list: [], href: (h) => h });
export const useAgent = () => useContext(AgentCtx);

export function AgentProvider({ list, children }: { list: string[]; children: ReactNode }) {
  const valid = (a: string | null) => (a && list.includes(a) ? a : null);
  const init = () => { const h = readHash(); if (h !== null) return valid(h); try { return valid(norm(localStorage.getItem(LS))); } catch { return null; } };
  const [agent, setA] = useState<string | null>(init);
  const sync = (a: string | null) => {
    try { if (a) localStorage.setItem(LS, a); else localStorage.removeItem(LS); } catch { /* ignore */ }
    const nh = withAgent(window.location.hash || "#/team", a);
    if (nh !== window.location.hash) history.replaceState(history.state, "", window.location.pathname + window.location.search + nh);
    rememberHash();
  };
  useEffect(() => { sync(agent); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const f = () => { const h = readHash(); if (h === null) sync(agent); else if (valid(h) !== agent) { setA(valid(h)); sync(valid(h)); } };
    window.addEventListener("hashchange", f); return () => window.removeEventListener("hashchange", f);
  }, [agent, list]); // eslint-disable-line react-hooks/exhaustive-deps
  const setAgent = (a: string | null) => { const v = valid(a); setA(v); sync(v); };
  return <AgentCtx.Provider value={{ agent, setAgent, list, href: (h) => { const q = window.location.hash.split("?")[1]; return withAgent(h.split("?")[0] + (q ? "?" + q : ""), agent); } }}>{children}</AgentCtx.Provider>;
}

export function AgentSelect({ compact }: { compact?: boolean }) {
  const { agent, setAgent, list } = useAgent();
  return <label className={"agentsel" + (compact ? " compact" : "")}><span>Agent</span>
    <select value={agent ?? ""} onChange={(e) => setAgent(e.target.value || null)} aria-label="Select agent">
      <option value="">{TEAM_LABEL}</option>{list.map((a) => <option key={a} value={a}>{a}</option>)}</select></label>;
}

/** Plain notice for views without per-agent data. */
export function TeamOnly({ what, children }: { what: string; children?: ReactNode }) {
  const { agent, setAgent } = useAgent();
  return <div className="teamonly"><div className="teamonly-k">Team-level only</div>
    <p>{what} has no per-agent data, so nothing is shown for {agent}. {children}</p>
    <button className="ghost dark" onClick={() => setAgent(null)}>View {TEAM_LABEL}</button></div>;
}
/** Thin label above a filtered view. */
export function AgentBanner({ note }: { note?: string }) {
  const { agent } = useAgent(); if (!agent) return null;
  return <div className="agentbanner"><b className="serif">{agent}</b>{note ? <span>{note}</span> : null}</div>;
}

/** FUB/legacy names that differ from the Sisu name used in the selector. */
const ALIAS: Record<string, string[]> = { "Osvaldo Castillo": ["Ozzy Castillo"], "Abbie Reeves": ["Abbie J Contreras"], "Alex Huerta": ["Raul Alejandro Huerta"] };
const lk = (s: string) => norm(s).toLowerCase().replace(/[^a-z]/g, "");
export const sameAgent = (name: string, agent: string) => { const n = lk(name); return n === lk(agent) || (ALIAS[agent] ?? []).some((x) => lk(x) === n); };
/** Value for this agent from a by-name object, or undefined. */
export function pickAgent<T = any>(o: Record<string, T> | undefined | null, agent: string): T | undefined {
  if (!o) return undefined; const k = Object.keys(o).find((x) => sameAgent(x, agent)); return k === undefined ? undefined : o[k];
}

/* ---------- Place keeping: state in the hash query, mirrored to localStorage + sessionStorage ---------- */
const PK = "bly-p:";
const hashParams = () => new URLSearchParams(window.location.hash.split("?")[1] || "");
function store(k: string, v: string | null) {
  for (const st of [localStorage, sessionStorage]) { try { if (v === null) st.removeItem(PK + k); else st.setItem(PK + k, v); } catch { /* ignore */ } }
}
function stored(k: string): string | null { try { return sessionStorage.getItem(PK + k) ?? localStorage.getItem(PK + k); } catch { return null; } }
export function setHashParam(k: string, v: string | null) {
  const [path, q = ""] = (window.location.hash || "#/team").replace(/^#/, "").split("?");
  const p = new URLSearchParams(q); if (v === null || v === "") p.delete(k); else p.set(k, v);
  const s = p.toString(); const nh = "#" + path + (s ? "?" + s : "");
  if (nh !== window.location.hash) history.replaceState(history.state, "", window.location.pathname + window.location.search + nh);
  rememberHash();
}
/** useState that survives leaving the site: URL hash param first, then session/local storage, then the default. */
export function usePersist<T extends string = string>(k: string, def: NoInfer<T>, valid?: (v: string) => boolean): [T, (v: T) => void] {
  const [v, setV] = useState<T>(() => {
    const u = hashParams().get(k); const s = u ?? stored(k);
    const r = s !== null && (!valid || valid(s)) ? (s as T) : def;
    if (u === null && r !== def) queueMicrotask(() => setHashParam(k, r));
    return r;
  });
  const set = (x: T) => { setV(x); store(k, x); setHashParam(k, x === def ? null : x); };
  return [v, set];
}
/** Last full hash, so a fresh tab / sign-in redirect can land in the same place. */
export function rememberHash() { const h = window.location.hash; if (h && h.length > 2) for (const st of [localStorage, sessionStorage]) { try { st.setItem("bly-last-hash", h); } catch { /* ignore */ } } }
export function restoreHash() {
  let h: string | null = null; try { h = localStorage.getItem("bly-return") ?? sessionStorage.getItem("bly-last-hash") ?? localStorage.getItem("bly-last-hash"); localStorage.removeItem("bly-return"); } catch { /* ignore */ }
  const cur = window.location.hash;
  if (h && (!cur || cur === "#" || cur === "#/")) history.replaceState(null, "", window.location.pathname + window.location.search + h);
}
export function saveReturn() { try { localStorage.setItem("bly-return", window.location.hash || "#/team"); } catch { /* ignore */ } }

/** Per-route scroll memory (sessionStorage + localStorage). */
const routeKey = () => "bly-scroll:" + (window.location.hash.replace(/^#\/?/, "").split("?")[0] || "team");
export function saveScroll() { const k = routeKey(), y = String(Math.round(window.scrollY)); try { sessionStorage.setItem(k, y); localStorage.setItem(k, y); } catch { /* ignore */ } }
export function restoreScroll() {
  let y = 0; try { y = Number(sessionStorage.getItem(routeKey()) ?? localStorage.getItem(routeKey()) ?? 0); } catch { /* ignore */ }
  let n = 0; const tryIt = () => { window.scrollTo(0, y); if (Math.abs(window.scrollY - y) > 4 && n++ < 20) setTimeout(tryIt, 100); };
  requestAnimationFrame(tryIt);
}
