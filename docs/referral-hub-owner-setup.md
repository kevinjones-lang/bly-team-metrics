# Referral Hub setup for the owner

This is the list of dashboard clicks, secrets, and SQL to run yourself. Nothing in this file is a secret. Do not commit API keys, Slack tokens, or Azure client secrets.

The site is `https://kevinjones-lang.github.io/bly-team-metrics/`. The Supabase project is Agent Advantage Academy (`yogqaxctqlzzzziyplzl`).

Do not re-run `supabase/migrations/20261027220000_referrals.sql` or `supabase/migrations/20261028194500_referral_outlook_draft.sql`. Those are already applied.

Apply these once, in the Supabase SQL editor, in this order:

1. `supabase/migrations/20261029160000_referral_fub_reminders.sql`
2. `supabase/migrations/20261029161000_link_staff_identity.sql`

Then deploy:

```bash
supabase functions deploy referral-fub
supabase functions deploy referral-outlook
supabase functions deploy referral-agents
supabase functions deploy referral-reminders
```

## 1. Each agent’s own Outlook draft

This is the path staff should use. The draft is created in the Outlook of the person who clicks Connect Microsoft. It is not sent. The filled PDF is attached. If Microsoft rejects the PDF, the empty draft is deleted.

The team mailbox (`referral-outlook`) remains only as a fallback when the site has no Microsoft app id. It also creates a draft and does not send. A blank email is not opened.

In Microsoft Entra, register an application:

- Name it something like Bly Team Referral Hub.
- Supported accounts: this organization only (single tenant), unless you intentionally want any work account.
- Platform: **Single-page application**. Do not create a client secret for this app. The browser cannot keep a secret.
- Redirect URIs, exactly:
  - `https://kevinjones-lang.github.io/bly-team-metrics/microsoft-auth.html`
  - `http://localhost:5173/bly-team-metrics/microsoft-auth.html`
- API permissions: Microsoft Graph **delegated** `Mail.ReadWrite` and `User.Read`. Grant admin consent.

GitHub Actions secrets on this repo (build-time config, then rerun the Pages deploy):

| Secret | Value |
| --- | --- |
| `VITE_MICROSOFT_CLIENT_ID` | Application (client) ID from the Entra app |
| `VITE_MICROSOFT_TENANT_ID` | Directory (tenant) ID. Required for the single-tenant app. |

Until `VITE_MICROSOFT_CLIENT_ID` is in a rebuilt site, the referral form shows this same checklist.

Optional team-mailbox fallback, as Supabase Edge secrets, not Vite:

| Secret | Value |
| --- | --- |
| `AZURE_TENANT_ID` | Directory (tenant) ID |
| `AZURE_CLIENT_ID` | A separate confidential app’s client ID |
| `AZURE_CLIENT_SECRET` | That app’s client secret |
| `OUTLOOK_MAILBOX` | Mailbox UPN that should own the draft, such as `team@agentbly.com` |

That confidential app needs application permission `Mail.ReadWrite`, limited to `OUTLOOK_MAILBOX` with an Exchange application access policy.

`VITE_REFERRAL_CC` is optional. It is not a secret. Empty keeps Cc as `Kevin.Jones@AgentBly.com` and `Deb@AgentBly.com`.

## 2. Follow Up Boss write-back

I sent it still logs the email in Referral Hub. It then asks `referral-fub` to update the **existing** person:

- add tag `Out-of-Area Referral` (merged with tags they already have)
- set stage to `Lead`
- add one note with the receiving agent, brokerage, market/area, fee (the default is 25% of gross commission), and the date

The note is marked with `referral:<id>`. A second click of Retry does not add another note and does not change the person again after a success is stored. Retry does not increment the email count. I sent it does, so do not use it as the retry.

The function never calls contact merge and never creates a person.

| Secret | Where | Value |
| --- | --- | --- |
| `FUB_API_KEY` | Supabase Edge secret | Follow Up Boss API key. Already used for lookup. |
| `FUB_WRITEBACK_ENABLED` | Supabase Edge secret | Exactly `true` when you want live writes. Leave it unset until the new SQL is applied and a dry run looks right. |

With the flag unset, I sent it still logs the email and shows the note that would have been written. Nothing is sent to Follow Up Boss.

## 3. Slack follow-up reminders

The job finds referrals whose next touch is today or earlier (biweekly until connected, then monthly) and referrals with no touch for six months. An overdue referral is reminded again after 14 days, or after 30 days once the cadence is monthly. It is not reminded every day. Six-month rows are **flagged** for Nurture in the message, once per quiet stretch. Opening the board is still what moves them to Nurture.

The Bly owner is `fub_owner` on the referral, matched to `public.agents.full_name` for an active staff row. The DM uses that row’s `slack_user_id`. All current active staff rows have a Slack id. Deb matches Deborah. Kim matches Kimberley. A first name is used only when one staff member has it.

Scheduler that ships with the repo: `.github/workflows/referral-reminders.yml`, every day at 13:00 UTC. It does not send unless both switches below are on.

| Name | Where | Value |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | GitHub secret | Already set for the Pages build. The workflow reuses it. |
| `VITE_SUPABASE_ANON_KEY` | GitHub secret | Already set. It only lets the request reach the function. It does not authorize a send. |
| `REFERRAL_REMINDERS_CRON_SECRET` | GitHub secret **and** Supabase Edge secret | Same long random string in both places. This is what authorizes the job. |
| `SLACK_BOT_TOKEN` | Supabase Edge secret | Bot token (`xoxb-...`). Not a Vite variable. |
| `REFERRAL_SLACK_CHANNEL` | Supabase Edge secret | Optional channel ID such as `C0123456789`. Invite the bot to that channel. Leave unset to DM only. |
| `REFERRAL_REMINDERS_SEND` | Supabase Edge secret | Exactly `true` to allow Slack. Leave unset and nothing is sent. |
| `REFERRAL_REMINDERS_SEND` | GitHub repository **variable** (not a secret) | Exactly `true` before the daily schedule will even ask to send. Leave unset. |

Slack app scopes for the bot token:

- `chat:write` — post the message
- `im:write` — open a DM with the agent

Staff can click **Preview follow-up reminders** on the board. That preview cannot send, even if the flags are on.

A manual `workflow_dispatch` with “send” checked still does nothing unless the Edge secret is `true`.

`supabase/manual/referral-reminders-cron.sql` is an optional pg_cron schedule if you would rather run it inside Supabase. Do not run it with the placeholder secret still in the file. The GitHub workflow is enough.

## 4. Google and email sign-in

Slack stays. Google and an email code are next to it. `public.is_staff()` is unchanged: `agents.user_id` must be this login, `role` must be `staff`, and `active` must be true.

`link_staff_identity()` (the second SQL file) sets `user_id` only when the confirmed email matches `agents.email`, the row is already staff and active, and `user_id` is empty or already this person. It will not replace a different login.

In Supabase, Authentication:

- Site URL: `https://kevinjones-lang.github.io/bly-team-metrics/`
- Redirect URLs, add each of these:
  - `https://kevinjones-lang.github.io/bly-team-metrics/`
  - `https://kevinjones-lang.github.io/bly-team-metrics`
  - `http://localhost:5173/bly-team-metrics/`
  - `http://localhost:5173/bly-team-metrics`

Google provider:

- Create a Google Cloud OAuth client, type Web application.
- Authorized JavaScript origins: `https://kevinjones-lang.github.io` and `http://localhost:5173`
- Authorized redirect URI: `https://yogqaxctqlzzzziyplzl.supabase.co/auth/v1/callback`
- Put the Google client ID and client secret in the Supabase Google provider page. Do not put them in this repo.
- Leave automatic identity linking on, so a Google login with the same confirmed email joins the existing staff user.

Email code:

- Email provider stays enabled.
- Edit the Magic Link email template so it contains both `{{ .ConfirmationURL }}` and `{{ .Token }}`. Outlook can open the link before the person does. The 6-digit code still works. The sign-in card has a box for that code.
- The address they type has to be the email on their staff row (the same one Slack uses if that login is already linked).

No new Vite secret is required for Google or email.

## 5. eXp top 5

Fast Forward still ranks up to 3 agents within about 20 miles. The eXp top 5 is a separate section.

The public directory at `https://www.exprealty.com/agents-search` calls `https://agentdir-api.expproptech.com/graphql`. That search requires a reCAPTCHA token and sorts `random`. It is not a reliable top 5, and this app does not try to solve the captcha.

Until you supply a directory file, the section says so and the paste box remains the override. Picking a card is still optional.

To rank a real top 5, either:

- fill `supabase/functions/referral-agents/exp-agents.json` and redeploy `referral-agents`, or
- set the Edge secret `EXP_DIRECTORY_JSON_URL` to an https URL you control that returns JSON.

Shape:

```json
{
  "agents": [
    {
      "name": "Ada Lovelace",
      "email": "ada@exp.com",
      "phone": "512-555-0100",
      "city": "Austin",
      "region": "TX",
      "lat": 30.27,
      "lng": -97.74,
      "volume": 16000000,
      "volumeLabel": "$16M",
      "market": "Austin"
    }
  ]
}
```

`name` is required. `lat` and `lng` are required for a person to be ranked. The nearest 5 are shown. Higher `volume` wins when the distance is the same. There is no eXp credential in this repo. A credentialed eXp or PropTech feed would have to be exported into that JSON by you.

## What stays off until you opt in

- Slack messages, unless `REFERRAL_REMINDERS_SEND` is `true` on the function and the GitHub variable or the manual “send” checkbox asks for it.
- Follow Up Boss writes, unless `FUB_WRITEBACK_ENABLED` is `true`.
- Outlook send. Both draft paths create drafts only.
