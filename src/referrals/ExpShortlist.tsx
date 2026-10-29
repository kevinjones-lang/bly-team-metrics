import { stubExpShortlist, type ExpCandidate, type ExpShortlist as ExpShortlistResult } from "../../supabase/functions/referral-agents/expShortlist.ts";

function ready(exp: ExpShortlistResult | null): ExpShortlistResult | null {
  if (!exp) return null;
  if (exp.status !== "ranked" && exp.status !== "stub") return null;
  if (!Array.isArray(exp.agents) || typeof exp.note !== "string" || typeof exp.searchUrl !== "string") return null;
  return exp;
}

function isSelected(agent: ExpCandidate, email: string, name: string): boolean {
  const want = email.trim().toLowerCase();
  if (want && agent.email && want === agent.email.toLowerCase()) return true;
  return !want && name.trim().length > 0 && name.trim().toLowerCase() === agent.name.toLowerCase();
}

export default function ExpShortlist(props: {
  location: string;
  exp: ExpShortlistResult | null;
  loading: boolean;
  selectedEmail: string;
  selectedName: string;
  busy: boolean;
  onPick: (agent: { name: string; email: string; phone?: string; place?: string; distanceLabel?: string }) => void;
}) {
  const location = props.location.trim();
  if (!location) return null;
  const result = ready(props.exp) ?? (props.loading ? null : stubExpShortlist(location));
  return (
    <section className="section">
      <h2 className="serif">eXp top 5</h2>
      <p className="caption">After the Fast Forward cards, these are eXp receiving-agent candidates. Picking one is the same as picking a Fast Forward card. Paste a different agent if you want someone else.</p>
      {props.loading || !result ? <p className="caption">Checking the eXp directory…</p> : null}
      {result ? <p className={result.status === "stub" ? "rh-note" : "caption"} role="status">{result.note}</p> : null}
      {result && result.agents.length > 0 ? (
        <div className="rh-options" role="list">
          {result.agents.map((agent) => {
            const on = isSelected(agent, props.selectedEmail, props.selectedName);
            return (
              <article key={agent.id} className={"rh-option" + (on ? " selected" : "")} role="listitem" aria-label={agent.name}>
                <h3 className="rh-name">{agent.name}</h3>
                <p className="rh-meta">{[agent.distanceLabel, agent.place].filter(Boolean).join(" · ") || "Distance unknown"}</p>
                {agent.market ? <p className="rh-meta">{agent.market}</p> : null}
                {agent.volumeLabel ? <p className="rh-metrics">{agent.volumeLabel} volume</p> : null}
                <p className="rh-meta">{agent.email || "No email in the directory"}{agent.phone ? ` · ${agent.phone}` : ""}</p>
                <ul className="rh-links">
                  <li><a href={agent.directoryUrl} target="_blank" rel="noopener noreferrer">eXp directory</a></li>
                </ul>
                <div className="rh-actions">
                  <button type="button" className={on ? "ghost dark" : "primary"} aria-pressed={on} disabled={props.busy || on} onClick={() => props.onPick({ name: agent.name, email: agent.email, phone: agent.phone, place: agent.place, distanceLabel: agent.distanceLabel })}>
                    {on ? "Selected" : "Select"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : null}
      {result ? <p className="rh-actions"><a href={result.searchUrl} target="_blank" rel="noopener noreferrer">Open the eXp agent directory</a></p> : null}
    </section>
  );
}
