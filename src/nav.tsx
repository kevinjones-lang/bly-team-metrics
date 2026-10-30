import { type ReactNode } from "react";
import Dashboard from "./Dashboard";
import FubAudit from "./FubTabs";
import Recruiting from "./Recruiting";
import Fello from "./Fello";
import Zillow from "./Zillow";
import Ylopo from "./Ylopo";
import Myt from "./Myt";
import Hub from "./Hub";
import Listings from "./listings/Listings";
import Referrals from "./referrals/Referrals";
import { useAgent, TeamOnly } from "./agent";

function RecruitingGate({ data }: { data: any }) { const { agent } = useAgent(); return agent ? <div className="page-body"><h1 className="page-title serif">Recruiting Dynamics</h1><TeamOnly what="Recruiting Dynamics" /></div> : <Recruiting data={data} />; }

function SnapshotMissing({ title }: { title: string }) {
  return (
    <div className="page-body">
      <h1 className="page-title serif">{title}</h1>
      <div className="gatecard">
        <h1 className="serif">No snapshot yet</h1>
        <p className="rule" />
        <p>Metrics did not load. This page waits for the daily snapshot. Referral Hub and the ops hub stay available.</p>
      </div>
    </div>
  );
}

/** Sidebar entries. Add a new component by appending one object; hash route = #/<id>. */
export type NavItem = { id: string; label: string; hint?: string; render: (payload: any) => ReactNode };
export const NAV: NavItem[] = [
  { id: "hub", label: "Ops Hub", hint: "All sites & apps", render: () => <Hub /> },
  { id: "referrals", label: "Referral Hub", hint: "Out-of-area handoffs", render: () => <Referrals /> },
  { id: "listings", label: "Listings & Closings", hint: "HAR listings and closings", render: () => <Listings /> },
  { id: "team", label: "Team Metrics", hint: "Production, leads, P&L", render: (p) => p ? <Dashboard /> : <SnapshotMissing title="The Bly Team Metrics" /> },
  { id: "myt", label: "Multi-Year Trends", hint: "Year × month tables", render: (p) => <Myt data={p?.myt} /> },
  { id: "fub-audit", label: "FUB Audit", hint: "Follow Up Boss health", render: (p) => <FubAudit data={p?.fub_audit} /> },
  { id: "fello", label: "Fello", hint: "Felix AI to closing", render: (p) => <Fello data={p?.fello} /> },
  { id: "zillow", label: "Zillow", hint: "Tableau Preferred mirror", render: (p) => <Zillow data={p?.zillow} /> },
  { id: "ylopo", label: "Ylopo", hint: "Cost and outcome totals", render: (p) => <Ylopo data={p?.ylopo} /> },
  { id: "recruiting", label: "Recruiting Dynamics", hint: "Agent recruiting funnel", render: (p) => <RecruitingGate data={p?.recruiting} /> },
];
