-- Record an Outlook draft without pretending the email was sent.
-- Status stays put until staff use referral_mark_sent ("I sent it").
-- Applied on Agent Advantage Academy. Do not re-run this file there.

alter table public.referrals
  add column if not exists fub_owner text,
  add column if not exists receiving_agent_phone text,
  add column if not exists receiving_brokerage text,
  add column if not exists outlook_draft_at timestamptz,
  add column if not exists outlook_draft_web_link text;

alter table public.referrals drop constraint if exists referrals_fub_owner_chk;
alter table public.referrals add constraint referrals_fub_owner_chk
  check (fub_owner is null or char_length(fub_owner) <= 200);

alter table public.referrals drop constraint if exists referrals_receiving_phone_chk;
alter table public.referrals add constraint referrals_receiving_phone_chk
  check (receiving_agent_phone is null or char_length(receiving_agent_phone) <= 40);

alter table public.referrals drop constraint if exists referrals_receiving_brokerage_chk;
alter table public.referrals add constraint referrals_receiving_brokerage_chk
  check (receiving_brokerage is null or char_length(receiving_brokerage) <= 200);

alter table public.referrals drop constraint if exists referrals_outlook_link_chk;
alter table public.referrals add constraint referrals_outlook_link_chk
  check (outlook_draft_web_link is null or char_length(outlook_draft_web_link) <= 2000);

comment on column public.referrals.fub_owner is
  'Bly Team agent who owns the lead in Follow Up Boss. Named in the handoff email. Not the originating agent on the PDF.';
comment on column public.referrals.receiving_agent_phone is
  'Phone from the selected agent card, printed on the referral form.';
comment on column public.referrals.receiving_brokerage is
  'Receiving brokerage printed on the referral form. Cards default to eXp Realty, LLC.';
comment on column public.referrals.outlook_draft_at is
  'When an Outlook draft was created. Does not mean the email was sent and does not change status.';
comment on column public.referrals.outlook_draft_web_link is
  'Outlook on the web link for that draft, when Graph returned one.';

alter table public.referral_events drop constraint if exists referral_events_kind_chk;
alter table public.referral_events add constraint referral_events_kind_chk
  check (kind in ('created', 'status', 'email_sent', 'draft_created'));

comment on table public.referral_events is
  'Append-only staff history for a referral (created, status, email_sent, draft_created).';

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
  end if;
  return new;
end;
$$;

comment on function public.referrals_after_write() is
  'Logs created, status, email_sent, and draft_created. A draft does not count as a sent email.';
