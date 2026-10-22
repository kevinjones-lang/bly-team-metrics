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
