import { useAgent } from "./agent";

type Tile = {
  id: string;
  label: string;
  hint: string;
  group: string;
  /** Internal hash route without #, e.g. "team" */
  route?: string;
  /** External https URL — confirmed only */
  href?: string;
  note?: string;
};

/** Ops hub tiles: confirmed URLs / in-app routes only. Referral Hub is one applet, not the whole page. */
export const HUB_TILES: Tile[] = [
  { id: "referrals", label: "Referral Hub", hint: "Out-of-area client handoffs", group: "Apps", route: "referrals" },
  { id: "team", label: "Team Metrics", hint: "Production, leads, P&L", group: "Metrics", route: "team" },
  { id: "myt", label: "Multi-Year Trends", hint: "Year × month tables", group: "Metrics", route: "myt" },
  { id: "fub-audit", label: "FUB Audit", hint: "Follow Up Boss health", group: "Metrics", route: "fub-audit" },
  { id: "fello", label: "Fello", hint: "Felix AI to closing", group: "Metrics", route: "fello" },
  { id: "zillow", label: "Zillow Preferred", hint: "Tableau mirror · ratings & coaching", group: "Metrics", route: "zillow" },
  { id: "ylopo", label: "Ylopo", hint: "Cost, leads & closings", group: "Metrics", route: "ylopo" },
  { id: "recruiting", label: "Recruiting Dynamics", hint: "Live recruiting funnel", group: "Metrics", route: "recruiting" },
  { id: "fub", label: "Follow Up Boss", hint: "agentbly1 CRM", group: "CRM & leads", href: "https://agentbly1.followupboss.com" },
  { id: "fub-zillow-rpt", label: "FUB Zillow Reporting", hint: "Kahla login", group: "CRM & leads", href: "https://agentbly1.followupboss.com/2/reporting/zillow-reporting" },
  { id: "kahla-sheet", label: "Kahla Preferred sheet", hint: "Zillow Preferred workbook", group: "CRM & leads", href: "https://docs.google.com/spreadsheets/d/11VPtEWP_482Yt6OVWAZkGxkxXcE7nmI4sP_qKMz6t1s" },
  { id: "rec-master", label: "Recruiting Master Tracker", hint: "Google Sheet", group: "Recruiting", href: "https://docs.google.com/spreadsheets/d/18XXe2ap4b6DqUGgRW8GrT8GUceT7dt2k4VgyglQZpPo/edit" },
  { id: "calculators", label: "Calculators", hint: "Commission split & business plan", group: "Tools", href: "https://kevinajones.github.io/bly-team-calculators/" },
  { id: "mortgage-calc", label: "Mortgage Calculator", hint: "Team mortgage calculator", group: "Tools", href: "https://kevinajones.github.io/team-mortgage-calculator/" },
  { id: "tv-listings", label: "Bly TV Listings", hint: "Listing TV / media board", group: "Tools", href: "https://kevinjones-lang.github.io/bly-tv-listings/" },
  { id: "agent-training", label: "Agent Training", hint: "New agent training", group: "Tools", href: "https://bly-agent-training.vercel.app/#/agent" },
  { id: "video-library", label: "Video Library", hint: "Video classes (Slack sign-in)", group: "Tools", href: "https://bly-video-library.kevin-jones-cd2.workers.dev" },
];

const GROUPS = ["Apps", "Metrics", "CRM & leads", "Recruiting", "Tools"];

export default function Hub() {
  const { href } = useAgent();
  return (
    <div className="page-body hub">
      <h1 className="page-title serif">Operations hub</h1>
      <p className="summary">One stop for Bly Team ops sites and dashboards. Open a tile to jump in.</p>
      {GROUPS.map((g) => {
        const tiles = HUB_TILES.filter((t) => t.group === g);
        if (!tiles.length) return null;
        return (
          <section key={g} className="section hub-section">
            <h2 className="serif">{g}</h2>
            <div className="hub-grid">
              {tiles.map((t) => {
                const isExt = Boolean(t.href);
                const link = isExt ? t.href! : href("#/" + t.route);
                return (
                  <a
                    key={t.id}
                    className="hub-tile"
                    href={link}
                    {...(isExt ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  >
                    <span className="hub-tile-mark" aria-hidden />
                    <span className="hub-tile-label serif">{t.label}</span>
                    <span className="hub-tile-hint">{t.hint}</span>
                    {isExt ? <span className="hub-tile-ext">Opens externally</span> : null}
                  </a>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
