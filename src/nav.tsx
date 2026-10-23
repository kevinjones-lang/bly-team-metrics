import { type ReactNode } from "react";
import Dashboard from "./Dashboard";
import FubAudit from "./FubTabs";
import Recruiting from "./Recruiting";
import Fello from "./Fello";
import { useAgent, TeamOnly } from "./agent";

function RecruitingGate({ data }: { data: any }) { const { agent } = useAgent(); return agent ? <div className="page-body"><h1 className="page-title serif">Recruiting Dynamics</h1><TeamOnly what="Recruiting Dynamics" /></div> : <Recruiting data={data} />; }

/** Sidebar entries. Add a new component by appending one object; hash route = #/<id>. */
export type NavItem = { id: string; label: string; hint?: string; render: (payload: any) => ReactNode };
export const NAV: NavItem[] = [
  { id: "team", label: "Team Metrics", hint: "Production, leads, P&L", render: () => <Dashboard /> },
  { id: "fub-audit", label: "FUB Audit", hint: "Follow Up Boss health", render: (p) => <FubAudit data={p?.fub_audit} /> },
  { id: "fello", label: "Fello", hint: "Felix AI to closing", render: (p) => <Fello data={p?.fello} /> },
  { id: "recruiting", label: "Recruiting Dynamics", hint: "Agent recruiting funnel", render: (p) => <RecruitingGate data={p?.recruiting} /> },
];
