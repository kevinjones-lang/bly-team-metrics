# The Bly Team Metrics

Staff-only dashboard for The Bly Team (eXp Realty). Static Vite + React site on GitHub Pages. **This repo contains code only — no metrics data.**

- **Auth:** Supabase Auth with Slack (OIDC) on the Agent Advantage Academy project, so the admins are the same people. A visitor who is signed out sees only "Sign in with Slack". After sign-in the app calls `public.is_staff()` (AAA's existing SECURITY DEFINER function: `public.agents.role = 'staff'` and `active`). Anyone who isn't staff sees "Access restricted".
- **Data:** the daily pipeline upserts one JSON payload per day into `public.metrics_snapshots(snap_date, payload jsonb)` with the service-role key.
  - RLS is enabled and forced.
  - `anon` has no grant.
  - `authenticated` can SELECT only when `public.is_staff()` is true.
- **Dashboard code:** `src/Dashboard.tsx` is generated from the dashboard template by `npm run gen -- <template path>`. The generator strips all embedded data and fails if any remains. `src/kit.tsx` provides the branded components:
  - Charcoal `#12151C`, Ivory `#F3F1EB` and Ink `#1A1A1A`, with Bly Blue `#00519B` and Gold `#C0A062` as accents.
  - Canela/Cambria/Georgia headlines and Inter body text.
- **Deploy:** GitHub Actions builds the site and deploys it to Pages. The workflow needs two repo secrets: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

## Referral Hub

Out-of-area referral workspace for staff, inside this site (Slack sign-in, same `is_staff()` gate). It is one sidebar item and one tile on the ops hub. The ops hub stays a tile launcher.

| Route | What |
| --- | --- |
| `#/hub` | Ops hub. Referral Hub is a tile next to the other applets. |
| `#/referrals` and `#/referrals/board` | Admin board. Statuses: `new` → `shortlist` → `awaiting_pick` → `sent` → `connected` → `monthly_check` → `closed`, plus `nurture`. |
| `#/referrals/new` | New referral. Optional `?fub=` person id or Follow Up Boss URL prefills when the Edge Function is configured. |
| `#/referrals/<id>` | Detail, agent option cards, and email handoff. |

**Follow Up Boss custom field `Bly Team Referral Hub`.** Paste the record’s GitHub Pages link:

`https://kevinjones-lang.github.io/bly-team-metrics/#/referrals/<id>`

The new-referral link, if a field should open a blank form, is `https://kevinjones-lang.github.io/bly-team-metrics/#/referrals/new`.

**Data.** `supabase/migrations/20261027220000_referrals.sql` adds `public.referrals` and `public.referral_events` on Agent Advantage Academy. RLS is enabled and forced. `anon` has no grant. `authenticated` can read and write only when `public.is_staff()` is true. That migration is already applied on Agent Advantage Academy — do not run it a second time there.

Cadence is stored on the row: the first handoff schedules the next touch 14 days out (biweekly). Moving the status to monthly check schedules every 30 days, and a monthly cadence does not drop back to biweekly. Opening the board calls `referrals_apply_silence()`, which moves any referral with no touch for six months to nurture. v1 has no cron.

**Email handoff.** “Open mail app” is a `mailto:` with the receiving agent on To. Cc is the ISA on that referral, plus Kevin and Deb. “I sent it” increments `email_count` and `last_email_at`. The universal eXp-to-eXp form is the Drive file linked from the detail page.

**Cc addresses.** Not a secret. Defaults are `Kevin.Jones@AgentBly.com` and `Deb@AgentBly.com`. Set the optional GitHub Actions secret `VITE_REFERRAL_CC` to a comma-separated list to override them at build time. An empty value keeps the defaults.

**Follow Up Boss lookup.** Optional prefill. Deploy `supabase/functions/referral-fub` and set the Supabase Edge Function secret `FUB_API_KEY` (Follow Up Boss API key). Do not put that key in Vite, `VITE_*`, or this repo. Without the secret the form still saves; lookup returns a clear message. Magic-link or Google sign-in can wait; Slack staff access is the v1 gate.

**Agent options.** On a referral that has a location, the detail page asks the `referral-agents` Edge Function for Fast Forward Movement agents near that place. The function reads a cached copy of the public FFM Google My Map (`mid=1JtTrRiy5GKmzXhCLsLwTaFG4GfR2W51c`, file `supabase/functions/referral-agents/ffm-agents.json`). Pins in the KML are used when the map has them; otherwise the agent’s primary ZIP is a GeoNames centroid ([geonames.org](https://www.geonames.org/), CC-BY 4.0). The referral location is geocoded with Nominatim or, for a ZIP, Zippopotam. No API key.

- Within 20 miles: up to 3 cards, closest first. Selecting one saves the receiving agent and moves `new` / `shortlist` to `awaiting_pick`.
- None within 20 miles: up to 5 nearest FFM cards, plus links to the [eXp Agent Directory](https://www.exprealty.com/agents-search), the [eXp Hub US Referral Network](https://hub.exprealty.com/connect/group/us-corp-exp-referral-network), and the [Global Referral Platform](https://agents.exprealty.com/). The public directory blocks automated search (reCAPTCHA), so those sources stay links. Paste is still there for an agent you find that way.
- “Open mail app” stays disabled until a card is selected or a receiving-agent email is entered. Cc is still the ISA plus Kevin and Deb.

Deploy with the other referral function. No new secret:

```bash
supabase functions deploy referral-agents
```

Refresh the cache after the FFM map changes, then redeploy:

```bash
node --experimental-strip-types scripts/build-ffm-agents.ts
supabase functions deploy referral-agents
```

The function also re-reads the public KML in the background when an isolate is warm. The committed file is what a cold request uses.

**How to test (not Houston).** Sign in as staff, create a referral with location `Carlsbad, CA`, and open it. Expect up to three Fast Forward cards with a distance, market, trailing-12 volume when the map has it, and an eXp directory link. Select one: the receiving agent and email fill in, the status becomes Awaiting pick, and Open mail app becomes the primary button with that agent on To. A second referral with location `Boulder, CO` has no Fast Forward agent inside 20 miles, so the page shows the five nearest and the directory links. The universal eXp-to-eXp form link and the Follow Up Boss lookup are unchanged.

Checks:

```bash
node --experimental-strip-types scripts/check-referral-logic.ts
node --experimental-strip-types scripts/check-referral-agents.ts
```
