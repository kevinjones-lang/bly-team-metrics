// Ask tab: Sunburst-style coach. Prebuilt pipeline answers always work; free-form chat uses the coach-ask Edge Function when an LLM key is configured.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { supabase, SB_URL } from "./sb";

type Msg = { role: "user" | "assistant"; content: string; tag?: string };

function inline(s: string, k: number): ReactNode[] {
  return s.split(/(\*\*[^*]+\*\*|_[^_]+_|`[^`]+`)/g).map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? <strong key={k + "-" + i}>{p.slice(2, -2)}</strong>
    : p.length > 2 && p.startsWith("_") && p.endsWith("_") ? <em key={k + "-" + i}>{p.slice(1, -1)}</em>
    : p.startsWith("`") && p.endsWith("`") ? <code key={k + "-" + i}>{p.slice(1, -1)}</code> : p);
}
const cells = (l: string) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
const isNum = (c: string) => /^[−\-+$]?[\d$,.%]+[kKmM%]?$|^n\/a$|^—$/.test(c);

export function Markdown({ md }: { md: string }) {
  const lines = md.split("\n"); const out: ReactNode[] = []; let i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (l.trim().startsWith("|") && lines[i + 1] && /^\s*\|?\s*:?-{3}/.test(lines[i + 1])) {
      const head = cells(l); const rows: string[][] = []; i += 2;
      while (i < lines.length && lines[i].trim().startsWith("|")) rows.push(cells(lines[i++]));
      out.push(<div className="tablewrap" key={i}><table><thead><tr>{head.map((h, k) => <th key={k} className={k && rows.every((r) => isNum(r[k] || "")) ? "num" : ""}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, a) => <tr key={a}>{r.map((c, k) => <td key={k} className={k && isNum(c) ? "num" : ""}>{inline(c, k)}</td>)}</tr>)}</tbody></table></div>);
      continue;
    }
    if (/^#{1,3} /.test(l)) { const n = l.match(/^#+/)![0].length; const T = (n === 1 ? "h3" : n === 2 ? "h3" : "h4") as any; out.push(<T key={i} className="serif">{inline(l.replace(/^#+ /, ""), i)}</T>); i++; continue; }
    if (/^\s*[-*] /.test(l)) { const it: string[] = []; while (i < lines.length && /^\s*[-*] /.test(lines[i])) it.push(lines[i++].replace(/^\s*[-*] /, "")); out.push(<ul key={i}>{it.map((x, k) => <li key={k}>{inline(x, k)}</li>)}</ul>); continue; }
    if (/^\s*\d+\. /.test(l)) { const it: string[] = []; while (i < lines.length && /^\s*\d+\. /.test(lines[i])) it.push(lines[i++].replace(/^\s*\d+\. /, "")); out.push(<ol key={i}>{it.map((x, k) => <li key={k}>{inline(x, k)}</li>)}</ol>); continue; }
    if (l.trim()) out.push(<p key={i}>{inline(l, i)}</p>);
    i++;
  }
  return <div className="md">{out}</div>;
}

const CHIPS: [string, string][] = [["pace", "Who's behind pace YTD?"], ["atrisk", "At-risk deals closing this month"], ["pending", "Pending GCI by agent"],
  ["stl", "Speed to lead"], ["roi", "Lead source ROI YTD"], ["activity", "Activity consistency"], ["lost", "Lost transactions YTD"], ["snapshot", "MTD/YTD snapshot"]];

export default function Ask({ data }: { data: any }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [q, setQ] = useState(""); const [busy, setBusy] = useState(false);
  const [llm, setLlm] = useState<boolean | null>(null); const [agent, setAgent] = useState("");
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { fetch(`${SB_URL}/functions/v1/coach-ask`).then((r) => r.json()).then((d) => setLlm(!!d.llm)).catch(() => setLlm(false)); }, []);
  useEffect(() => { if (msgs.length) end.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }, [msgs.length]);
  if (!data) return <div className="section"><h2 className="serif">Ask</h2><p className="text">Coach data isn't in this snapshot yet. It appears after the next daily pipeline run.</p></div>;
  const A = data.answers || {}; const C = data.coach || {};
  const prebuilt = (key: string, label: string) => { const a = key.startsWith("agent:") ? C[key] : A[key]; if (a) setMsgs((m) => [...m, { role: "user", content: label }, { role: "assistant", content: a.md, tag: "Prebuilt from today's snapshot" }]); };
  const matchPrebuilt = (t: string): string | null => {
    const s = t.toLowerCase();
    const ag = (data.agents || []).find((x: any) => s.includes(x.n.toLowerCase()) || s.includes(x.n.split(" ")[0].toLowerCase() + " " + (x.n.split(" ").pop() || "").toLowerCase()));
    if (ag && /coach|1:1|one on one|prep|how is|doing/.test(s)) return ag.k;
    const R: [RegExp, string][] = [[/pace|behind|goal|ahead/, "pace"], [/risk|stall|overdue|closing this month|missing/, "atrisk"], [/pending|forecast/, "pending"], [/speed|stl|uncontacted|first call/, "stl"],
      [/roi|source|conversion|attribution/, "roi"], [/activity|consisten|calls|dial/, "activity"], [/lost|fell|cancel/, "lost"], [/snapshot|mtd|ytd|closed|units|volume|gci/, "snapshot"]];
    const r = R.find(([re]) => re.test(s)); return r ? r[1] : ag ? ag.k : null;
  };
  const send = async (text: string) => {
    const t = text.trim(); if (!t || busy) return; setQ("");
    const hist: Msg[] = [...msgs, { role: "user", content: t }]; setMsgs(hist);
    if (llm) {
      setBusy(true);
      try {
        const { data: s } = await supabase.auth.getSession();
        const r = await fetch(`${SB_URL}/functions/v1/coach-ask`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${s.session?.access_token}` },
          body: JSON.stringify({ messages: hist.map(({ role, content }) => ({ role, content })) }) });
        const d = await r.json();
        if (d.answer) { setMsgs((m) => [...m, { role: "assistant", content: d.answer, tag: "AI answer · check figures against the tabs" }]); setBusy(false); return; }
      } catch { /* fall through to prebuilt */ }
      setBusy(false);
    }
    const k = matchPrebuilt(t); const a = k ? (k.startsWith("agent:") ? C[k] : A[k]) : null;
    setMsgs((m) => [...m, a ? { role: "assistant", content: a.md, tag: "Closest prebuilt answer (free-form AI chat not enabled)" }
      : { role: "assistant", content: "Free-form AI chat isn't enabled yet, and I couldn't match that to a prebuilt answer. Try a suggested prompt or pick an agent for coaching prep." }]);
  };
  const tone: Record<string, string> = { danger: "#9B2C2C", warning: "#C0A062", success: "#2F6B3A", neutral: "#00519B" };
  return (
    <div className="ask">
      <div className="section">
        <h2 className="serif">This week's insights</h2>
        <p className="caption">{`Top things to act on, rebuilt by the daily pipeline · snapshot ${data.asof}`}</p>
        <div className="insights">
          {(data.insights || []).map((x: any, k: number) => (
            <button key={k} className="insight" style={{ borderLeftColor: tone[x.tone] || tone.neutral }} onClick={() => prebuilt(x.ask, x.title)}>
              <span className="ititle">{x.title}</span><span className="ibody">{x.body}</span><span className="imore">See details →</span>
            </button>))}
        </div>
      </div>
      <div className="section">
        <h2 className="serif">Ask the coach</h2>
        <p className="caption">{llm ? "Ask anything about production, pipeline, leads or activity. Answers follow team rules (dedupe, AI dialer excluded, GCI labeled by source)." : "Prebuilt answers from today's snapshot. Free-form AI chat turns on when an LLM key is configured."}</p>
        <div className="chips">{CHIPS.map(([k, l]) => <button key={k} className="chip" onClick={() => prebuilt(k, l)}>{l}</button>)}</div>
        <div className="agentpick">
          <label className="field">Coaching prep for
            <select value={agent} onChange={(e) => { setAgent(e.target.value); if (e.target.value) prebuilt(e.target.value, "Coaching prep for " + (data.agents.find((a: any) => a.k === e.target.value)?.n || "")); }}>
              <option value="">Choose an agent…</option>
              {(data.agents || []).map((a: any) => <option key={a.k} value={a.k}>{a.n}</option>)}
            </select></label>
        </div>
        <div className="chat">
          {msgs.map((m, k) => m.role === "user" ? <div key={k} className="bubble me">{m.content}</div>
            : <div key={k} className="bubble bot">{m.tag ? <div className="tag">{m.tag}</div> : null}<Markdown md={m.content} /></div>)}
          {busy ? <div className="bubble bot"><div className="spinner" /></div> : null}
          <div ref={end} />
        </div>
        {msgs.length ? <button className="ghost dark clear" onClick={() => setMsgs([])}>Clear conversation</button> : null}
        <form className="askbar" onSubmit={(e) => { e.preventDefault(); send(q); }}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={llm ? "Ask about any agent, group or date range…" : "e.g. coaching prep for Angelina Martinez"} aria-label="Ask a question" />
          <button className="primary" type="submit" disabled={busy}>Ask</button>
        </form>
      </div>
    </div>
  );
}
