-- Optional scheduler. Do not run this until referral-reminders is deployed
-- and you have decided to call it from the database.
-- The GitHub Actions workflow .github/workflows/referral-reminders.yml is the
-- scheduler that ships with the repo. Use this file only if you prefer pg_cron.
--
-- The function does not send Slack unless the Edge secret REFERRAL_REMINDERS_SEND
-- is exactly true. Leave that unset until a dry-run preview looks right.
--
-- 1. Enable the pg_cron and pg_net extensions in the Supabase dashboard.
-- 2. Store two Vault secrets yourself. Do not put the values in this file.
--      select vault.create_secret('https://yogqaxctqlzzzziyplzl.supabase.co', 'project_url');
--      select vault.create_secret('<the anon key already used by the site>', 'referral_anon_key');
--    The anon key only gets the request past the function gateway.
--    Authorization is the cron secret below, which you also set as an Edge secret
--    named REFERRAL_REMINDERS_CRON_SECRET. Replace the placeholder before running.
-- 3. Run the schedule once. The job name is referral-reminders-daily.

select cron.schedule(
  'referral-reminders-daily',
  '0 13 * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/referral-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'referral_anon_key'),
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'referral_anon_key'),
      'x-cron-secret', 'REPLACE_WITH_THE_CRON_SECRET'
    ),
    body := '{"source":"pg_cron"}'::jsonb
  ) as request_id;
  $$
);
