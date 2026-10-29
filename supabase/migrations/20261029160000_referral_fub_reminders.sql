-- Follow Up Boss write-back result and Slack reminder bookkeeping.
-- Apply once on Agent Advantage Academy. Do not re-run the earlier referral migrations.
-- This file does not send Slack messages or call Follow Up Boss.

alter table public.referrals
  add column if not exists fub_writeback jsonb,
  add column if not exists fub_writeback_at timestamptz,
  add column if not exists last_reminder_at timestamptz;

alter table public.referrals drop constraint if exists referrals_fub_writeback_chk;
alter table public.referrals add constraint referrals_fub_writeback_chk
  check (fub_writeback is null or jsonb_typeof(fub_writeback) = 'object');

comment on column public.referrals.fub_writeback is
  'Result of the referral-fub write-back (tag Out-of-Area Referral, stage Lead, note). ok true means do not write that person again.';
comment on column public.referrals.fub_writeback_at is
  'When a successful Follow Up Boss write-back was recorded. A dry run does not set this.';
comment on column public.referrals.last_reminder_at is
  'When a follow-up reminder was actually sent. A dry run does not set this. Overdue biweekly rows are reminded again after 14 days, monthly rows after 30 days. A Nurture flag is once per quiet stretch.';

alter table public.referral_events drop constraint if exists referral_events_kind_chk;
alter table public.referral_events add constraint referral_events_kind_chk
  check (kind in ('created', 'status', 'email_sent', 'draft_created', 'fub_writeback', 'reminder'));

comment on table public.referral_events is
  'Append-only staff history for a referral (created, status, email_sent, draft_created, fub_writeback, reminder).';

create or replace function public.referrals_after_write()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.referral_events (referral_id, actor, kind, detail)
    values (new.id, auth.uid(), 'created', jsonb_build_object('status', new.status));
  elsif tg_op = 'UPDATE' then
    if new.status is distinct from old.status then
      insert into public.referral_events (referral_id, actor, kind, detail)
      values (new.id, auth.uid(), 'status', jsonb_build_object('from', old.status, 'to', new.status));
    end if;
    if new.email_count is distinct from old.email_count then
      insert into public.referral_events (referral_id, actor, kind, detail)
      values (new.id, auth.uid(), 'email_sent', jsonb_build_object('email_count', new.email_count, 'last_email_at', new.last_email_at));
    end if;
    if new.outlook_draft_at is distinct from old.outlook_draft_at and new.outlook_draft_at is not null then
      insert into public.referral_events (referral_id, actor, kind, detail)
      values (new.id, auth.uid(), 'draft_created', jsonb_build_object('outlook_draft_at', new.outlook_draft_at));
    end if;
    if new.fub_writeback_at is distinct from old.fub_writeback_at and new.fub_writeback_at is not null then
      insert into public.referral_events (referral_id, actor, kind, detail)
      values (new.id, auth.uid(), 'fub_writeback', coalesce(new.fub_writeback, '{}'::jsonb));
    end if;
    if new.last_reminder_at is distinct from old.last_reminder_at and new.last_reminder_at is not null then
      insert into public.referral_events (referral_id, actor, kind, detail)
      values (new.id, auth.uid(), 'reminder', jsonb_build_object('last_reminder_at', new.last_reminder_at));
    end if;
  end if;
  return new;
end;
$$;

comment on function public.referrals_after_write() is
  'Logs created, status, email_sent, draft_created, fub_writeback, and reminder. A draft or a dry run does not count as a sent email.';
