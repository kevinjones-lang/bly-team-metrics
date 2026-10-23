import { type ReactNode } from "react";
import Dashboard from "./Dashboard";
import FubAudit from "./FubAudit";

/** Sidebar entries. Add a new component by appending one object; hash route = #/<id>. */
export type NavItem = { id: string; label: string; hint?: string; render: (payload: any) => ReactNode };
export const NAV: NavItem[] = [
  { id: "team", label: "Team Metrics", hint: "Production, leads, P&L", render: () => <Dashboard /> },
  { id: "fub-audit", label: "FUB Audit", hint: "Follow Up Boss health", render: (p) => <FubAudit data={p?.fub_audit} /> },
];
