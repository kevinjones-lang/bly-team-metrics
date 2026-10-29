# The Bly Team Metrics

Staff-only dashboard for The Bly Team (eXp Realty). Static Vite + React site on GitHub Pages. **This repo contains code only — no metrics data.**

- **Auth:** Supabase Auth on the Agent Advantage Academy project. Sign-in is Slack (OIDC), Google, or an email code. After sign-in the app calls `public.is_staff()` (`public.agents.user_id = auth.uid()`, `role = 'staff'`, and `active`). Anyone who isn't staff sees "Access restricted". Google and email can attach to an unclaimed staff row only when the confirmed email matches `public.agents.email`. See `docs/referral-hub-owner-setup.md`.
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
| `#/referrals` and `#/referrals/board` | Pipeline board. Five columns: New (not sent yet, including shortlist and awaiting pick), Sent, Connected (including monthly check), Closed, Nurture. |
| `#/referrals/new` | New referral, opened over the board. Optional `?fub=` person id or Follow Up Boss URL prefills when the Edge Function is configured. |
| `#/referrals/<id>` | The same record, in a drawer on the board: agent options and the filled-form handoff. |

**Follow Up Boss custom field `Bly Team Referral Hub`.** Paste the record’s GitHub Pages link:

`https://kevinjones-lang.github.io/bly-team-metrics/#/referrals/<id>`

The new-referral link, if a field should open a blank form, is `https://kevinjones-lang.github.io/bly-team-metrics/#/referrals/new`.

**Data.** `supabase/migrations/20261027220000_referrals.sql` adds `public.referrals` and `public.referral_events` on Agent Advantage Academy. RLS is enabled and forced. `anon` has no grant. `authenticated` can read and write only when `public.is_staff()` is true. That migration is already applied on Agent Advantage Academy — do not run it a second time there.

Cadence is stored on the row: the first handoff schedules the next touch 14 days out (biweekly). Moving the status to monthly check schedules every 30 days, and a monthly cadence does not drop back to biweekly. Opening the board calls `referrals_apply_silence()`, which moves any referral with no touch for six months to nurture. A daily GitHub Actions job can preview those follow-ups and, only after you opt in, Slack the Bly agent who owns the lead. It does not send during a dry run. Details are in `docs/referral-hub-owner-setup.md`.

**Form handoff.** Picking a receiving agent with an email opens the Universal eXp-to-eXp form on the detail page. Staff edit the fields, preview the filled 3-page PDF, then create an Outlook **draft** with that PDF attached. The blank template is `public/forms/universal-exp-to-exp-referral-form.pdf` (a flat PDF — text is stamped on, not filled as AcroForm fields). There is no `mailto:` step. A blank compose window is not opened.

The preview draws the three pages in the Hub (PDF.js canvases). It does not use an iframe, which stays blank for blob PDFs in Chrome, Safari, and mobile. Open preview and Download filled PDF remain. The Follow Up Boss owner is required for the Outlook draft email, and preview still runs when that name is empty.

In the referral drawer the form stays hidden until a receiving agent email is on the record, from a card, a pasted line, or the email field. The Bly Team agent who owns the Follow Up Boss lead is one field, on the receiving agent panel, and it is still required only when creating the Outlook draft. Directory links are listed once, with the agent cards. Start a referral with Add referral on the board. The ops hub tile still opens Referral Hub.

Deborah G. Bly is the originating agent on the PDF (The Bly Team / eXp Realty, LLC, 281-782-5313, team@agentbly.com). The fee defaults to 25% of gross commission. The receiving agent, phone, and email come from the selected card. The email body names the Bly Team agent who owns the Follow Up Boss lead (`fub_owner`) so the receiving agent knows who to follow up with. Cc stays the ISA plus Kevin and Deb.

Creating the draft does **not** mark the referral sent and does not increment `email_count`. Status stays where it was (usually Awaiting pick). Activity shows “Outlook draft created. Not sent yet.” `outlook_draft_at` stores when the draft was created. “I sent it” is still the confirmation after someone sends that draft from Outlook. That is what moves an early referral to Sent and schedules the next touch. The same click asks Follow Up Boss to update the existing person when write-back is enabled. Retry Follow Up Boss update does that step again without counting another email.

The draft is created in one of two places:

1. **Staff Outlook (preferred).** Set the GitHub Actions secrets `VITE_MICROSOFT_CLIENT_ID` and, for a single-tenant app, `VITE_MICROSOFT_TENANT_ID`. These are a public SPA client id and tenant id, not secrets in the Azure sense, but they are build-time config. Register a Microsoft Entra **single-page application** with delegated `Mail.ReadWrite` and `User.Read`, and redirect URIs:
   - `https://kevinjones-lang.github.io/bly-team-metrics/microsoft-auth.html`
   - `http://localhost:5173/bly-team-metrics/microsoft-auth.html` for local preview
   Staff click **Connect Microsoft**, then **Create Outlook draft**. The draft lands in that person’s Drafts folder. The filled PDF is attached in a second Graph call; if the attachment is rejected, the empty draft is deleted. If the client id is missing from the build, the referral form shows these values and does not offer Connect Microsoft.
2. **Team mailbox.** If the Vite client id is empty, the button calls the `referral-outlook` Edge Function. Set Supabase secrets `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, and `OUTLOOK_MAILBOX` (the mailbox UPN that should own the draft). The app registration is a confidential client with application permission `Mail.ReadWrite`. Limit it to that mailbox with an Exchange application access policy. The function creates a draft and attaches the PDF. It does not send. Until those secrets exist, the button explains what is missing and does not fall back to a blank email.

```bash
supabase functions deploy referral-outlook
supabase secrets set AZURE_TENANT_ID=... AZURE_CLIENT_ID=... AZURE_CLIENT_SECRET=... OUTLOOK_MAILBOX=team@agentbly.com
```

**Cc addresses.** Not a secret. Defaults are `Kevin.Jones@AgentBly.com` and `Deb@AgentBly.com`. Set the optional GitHub Actions secret `VITE_REFERRAL_CC` to a comma-separated list to override them at build time. An empty value keeps the defaults.

**Follow Up Boss.** Optional prefill, and a write-back when someone clicks I sent it. Deploy `supabase/functions/referral-fub` and set the Supabase Edge Function secret `FUB_API_KEY` (Follow Up Boss API key). Do not put that key in Vite, `VITE_*`, or this repo. Without the secret the form still saves; lookup returns a clear message. Write-back stays a dry run until `FUB_WRITEBACK_ENABLED` is exactly `true`. It adds the tag `Out-of-Area Referral`, sets the stage to `Lead`, and adds a note on that existing person. It does not create or merge contacts. Apply `supabase/migrations/20261029160000_referral_fub_reminders.sql` before turning write-back on. Google and email sign-in are on the same gate; the provider setup is in `docs/referral-hub-owner-setup.md`.

**Agent options.** On a referral that has a location, the detail page asks the `referral-agents` Edge Function for Fast Forward Movement agents near that place. The function reads a cached copy of the public FFM Google My Map (`mid=1JtTrRiy5GKmzXhCLsLwTaFG4GfR2W51c`, file `supabase/functions/referral-agents/ffm-agents.json`). Pins in the KML are used when the map has them; otherwise the agent’s primary ZIP is a GeoNames centroid ([geonames.org](https://www.geonames.org/), CC-BY 4.0). The referral location is geocoded with no API key: a ZIP uses Zippopotam; a city tries Nominatim, then the Open-Meteo geocoding API, then Photon. Nominatim often does not answer from Supabase Edge, and a failure there used to return no cards. The later geocoders still place the city. US and Canadian hits are preferred, including the state in the location text.

- Within 20 miles: up to 3 cards, closest first. Selecting one saves the receiving agent and moves `new` / `shortlist` to `awaiting_pick`.
- None within 20 miles: up to 5 nearest FFM cards, plus links to the [eXp Agent Directory](https://www.exprealty.com/agents-search), the [eXp Hub US Referral Network](https://hub.exprealty.com/connect/group/us-corp-exp-referral-network), and the [Global Referral Platform](https://agents.exprealty.com/). The public directory search requires a reCAPTCHA token and returns a random page, so it is not a top-5 ranking. An eXp top 5 appears when `exp-agents.json` or `EXP_DIRECTORY_JSON_URL` has agents with map points. Until then the section explains the gap and paste remains the override.
- The referral form stays off the page until a card is selected or a receiving-agent email is entered. Cc is still the ISA plus Kevin and Deb. The card’s phone is saved on the referral and printed on the form. Receiving brokerage defaults to eXp Realty, LLC and can be edited.

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

**How to test (not Houston).** Sign in as staff. `Carlsbad, CA` is inside the 20-mile Fast Forward radius: expect up to three cards. Select one and the referral form opens with that agent as the receiving agent and Deborah G. Bly as the originating agent. Preview the PDF, then Create Outlook draft. With `VITE_MICROSOFT_CLIENT_ID` set, Connect Microsoft first; the draft is in that user’s Outlook, with the filled PDF attached, and the referral stays Awaiting pick. Without the client id, the same button calls `referral-outlook` and names the team mailbox when the draft is created. `Dallas, TX` (and `Boulder, CO`) have nobody within 20 miles: expect five nearest cards with distances, not an empty Agent options section. If a location cannot be geocoded at all, the page says no cards were ranked because the place could not be mapped.

`referral-fub` returns the Follow Up Boss `assignedTo` name as `owner`, stored on the referral as `fub_owner` and written into the email body. Redeploy `referral-fub`, `referral-agents`, and `referral-reminders` after pulling this change. The new switch is `FUB_WRITEBACK_ENABLED`, not a second API key. Leave it unset until the migration is applied. The full owner checklist is `docs/referral-hub-owner-setup.md`.

After this change, redeploy the function (no new secret):

```bash
supabase functions deploy referral-agents
```

Checks:

```bash
node --experimental-strip-types scripts/check-referral-logic.ts
node --experimental-strip-types scripts/check-referral-form.ts
node --experimental-strip-types scripts/check-referral-agents.ts
node --experimental-strip-types scripts/check-referral-geocode.ts
node --experimental-strip-types scripts/check-referral-followup.ts
```

Migration `supabase/migrations/20261028194500_referral_outlook_draft.sql` adds `fub_owner`, `receiving_agent_phone`, `receiving_brokerage`, `outlook_draft_at`, and `outlook_draft_web_link`, and logs a `draft_created` event. It is already applied on Agent Advantage Academy. Do not run it a second time there.
