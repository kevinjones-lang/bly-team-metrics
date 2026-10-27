import { type ReactNode } from "react";
import Dashboard from "./Dashboard";
import FubAudit from "./FubTabs";
import Recruiting from "./Recruiting";
import Fello from "./Fello";
import Zillow from "./Zillow";
import Myt from "./Myt";
import Hub from "./Hub";
import { useAgent, TeamOnly } from "./agent";

function RecruitingGate({ data }: { data: any }) { const { agent } = useAgent(); return agent ? <div className="page-body"><h1 className="page-title serif">Recruiting Dynamics</h1><TeamOnly what="Recruiting Dynamics" /></div> : <Recruiting data={data} />; }

/** Sidebar entries. Add a new component by appending one object; hash route = #/<id>. */
export type NavItem = { id: string; label: string; hint?: string; render: (payload: any) => ReactNode };
export const NAV: NavItem[] = [
  { id: "hub", label: "Ops Hub", hint: "All sites & apps", render: () => <Hub /> },
  { id: "team", label: "Team Metrics", hint: "Production, leads, P&L", render: () => <Dashboard /> },
  { id: "myt", label: "Multi-Year Trends", hint: "Year × month tables", render: (p) => <Myt data={p?.myt} /> },
  { id: "fub-audit", label: "FUB Audit", hint: "Follow Up Boss health", render: (p) => <FubAudit data={p?.fub_audit} /> },
  { id: "fello", label: "Fello", hint: "Felix AI to closing", render: (p) => <Fello data={p?.fello} /> },
  { id: "zillow", label: "Zillow", hint: "Preferred funnel, ZHL", render: (p) => <Zillow data={p?.zillow} /> },
  { id: "recruiting", label: "Recruiting Dynamics", hint: "Agent recruiting funnel", render: (p) => <RecruitingGate data={p?.recruiting} /> },
];
