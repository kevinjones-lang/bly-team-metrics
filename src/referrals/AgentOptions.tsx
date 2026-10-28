import { useEffect, useRef, useState } from "react";
import { lookupAgents, type AgentLookup, type AgentOption } from "./api";
import { humanError } from "./logic";
import { sourceLinks, type AgentLinks } from "../../supabase/functions/referral-agents/logic.ts";

function isSelected(agent: AgentOption, email: string, name: string): boolean {
  const want = email.trim().toLowerCase();
  if (want && agent.email && want === agent.email.toLowerCase()) return true;
  return !want && name.trim().length > 0 && name.trim().toLowerCase() === agent.name.toLowerCase();
}

function LinkList({ links }: { links: AgentLinks }) {
  const items = [
    ["eXp Agent Directory", links.expDirectory],
    ["eXp Hub — US Referral Network", links.expHub],
    ["Global Referral Platform", links.expGlobal],
    ["FFM map", links.ffmMap],
  ] as const;
  return (
    <ul className="rh-fallback-links">
      {items.map(([label, href]) => (
        <li key={label}><a href={href} target="_blank" rel="noopener noreferrer">{label}</a></li>
      ))}
    </ul>
  );
}

export default function AgentOptions(props: {
  location: string;
  selectedEmail: string;
  selectedName: string;
  busy: boolean;
  onPick: (agent: AgentOption) => void;
  onListed: (result: AgentLookup) => Promise<void> | void;
}) {
  const location = props.location.trim();
  const [result, setResult] = useState<AgentLookup | null>(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [pickable, setPickable] = useState(false);
  const onListed = useRef(props.onListed);
  onListed.current = props.onListed;

  useEffect(() => {
    if (!location) {
      setResult(null);
      setErr("");
      setLoading(false);
      setPickable(false);
      return;
    }
    let cancel = false;
    setLoading(true);
    setPickable(false);
    setErr("");
    setResult(null);
    lookupAgents(location).then(async (found) => {
      if (cancel) return;
      setResult(found);
      setLoading(false);
      try {
        await onListed.current(found);
      } catch (e) {
        if (!cancel) setErr(humanError(e));
      }
      if (!cancel) setPickable(true);
    }).catch((e) => {
      if (cancel) return;
      setResult(null);
      setErr(humanError(e));
      setLoading(false);
      setPickable(false);
    });
    return () => { cancel = true; };
  }, [location]);

  if (!location) {
    return <p className="caption">Add a city or ZIP on the client record and save. Agent options are ranked from that place.</p>;
  }

  const links = result?.links ?? sourceLinks({ location });
  const showLinks = Boolean(err) || (result != null && result.tier !== "ffm");

  return (
    <div className="stack">
      {loading ? <div className="center"><div className="spinner" /><p className="caption">Finding agents near {location}…</p></div> : null}
      {err ? <p className="rh-error" role="alert">{err}</p> : null}
      {result && result.agents.length === 0 ? (
        <div className={result.tier === "unplaced" ? "rh-error" : "rh-note"} role="status">
          <p><b>No agent cards for {location}.</b></p>
          <p>{result.note}</p>
        </div>
      ) : null}
      {result && result.agents.length > 0 ? <p className="caption">{result.note}{result.place ? ` Placed at ${result.place}.` : ""}</p> : null}
      {result && result.agents.length > 0 ? (
        <div className="rh-options" role="list">
          {result.agents.map((agent) => {
            const on = isSelected(agent, props.selectedEmail, props.selectedName);
            const someone = props.selectedEmail.trim().length > 0 || props.selectedName.trim().length > 0;
            const stats = [agent.volumeLabel ? `${agent.volumeLabel} volume` : "", agent.unitsLabel].filter(Boolean);
            return (
              <article key={agent.id} className={"rh-option" + (on ? " selected" : "")} role="listitem" aria-label={agent.name}>
                <h3 className="rh-name">{agent.name}</h3>
                <p className="rh-meta">{[agent.distanceLabel, agent.place].filter(Boolean).join(" · ") || "Distance unknown"}</p>
                {agent.level ? <p className="rh-meta">FFM {agent.level}</p> : null}
                {agent.market ? <p className="rh-meta">{agent.market}</p> : null}
                {stats.length ? <p className="rh-metrics">{stats.join(" · ")} <span>trailing 12 months, as listed on the FFM map</span></p> : null}
                <p className="rh-meta">{agent.email || "No email on the FFM map"}{agent.phone ? ` · ${agent.phone}` : ""}</p>
                <ul className="rh-links">
                  {agent.profileUrl ? <li><a href={agent.profileUrl} target="_blank" rel="noopener noreferrer">Profile</a></li> : null}
                  <li><a href={agent.directoryUrl} target="_blank" rel="noopener noreferrer">eXp directory</a></li>
                  {agent.mapUrl ? <li><a href={agent.mapUrl} target="_blank" rel="noopener noreferrer">Map</a></li> : null}
                </ul>
                <div className="rh-actions">
                  <button type="button" className={on || someone ? "ghost dark" : "primary"} aria-pressed={on} aria-label={on ? `${agent.name} selected` : `Select ${agent.name}`} disabled={props.busy || !pickable || on} onClick={() => props.onPick(agent)}>
                    {on ? "Selected" : "Select"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : null}
      {showLinks ? <LinkList links={links} /> : null}
      {result?.tier === "ffm" ? (
        <details className="rh-sources">
          <summary>Broader eXp sources</summary>
          <p className="caption">Use these when none of the Fast Forward cards is the right agent, then paste that person in the handoff panel.</p>
          <LinkList links={links} />
        </details>
      ) : null}
    </div>
  );
}
