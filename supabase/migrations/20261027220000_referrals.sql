-- Out-of-area referrals for The Bly Team.
-- Staff only: public.is_staff() (agents.role = 'staff' and active), same gate as metrics_snapshots.
-- The Follow Up Boss API key is NOT stored here. It is a secret on the referral-fub Edge Function.

create table public.referrals (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),

  client_name text not null,
  client_email text not null,
  client_phone text not null,
  location text,
  side text,
  timeline text,
  notes text,

  fub_person_id text,
  fub_url text,

  status text not null default 'new',
  cadence text not null default 'biweekly',

  email_count integer not null default 0,
  last_email_at timestamptz,
  last_touch_at timestamptz not null default now(),
  next_touch_on date,

  shortlist text,
  receiving_agent text,
  receiving_agent_email text,
  isa_email text,

  nurture_at timestamptz,
  closed_at timestamptz,

  constraint referrals_name_chk check (char_length(btrim(client_name)) between 1 and 200),
  constraint referrals_email_chk check (client_email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' and char_length(client_email) <= 320),
  constraint referrals_phone_chk check (char_length(client_phone) between 7 and 40 and length(regexp_replace(client_phone, '\D', '', 'g')) >= 7),
  constraint referrals_location_chk check (location is null or char_length(location) <= 500),
  constraint referrals_timeline_chk check (timeline is null or char_length(timeline) <= 500),
  constraint referrals_notes_chk check (notes is null or char_length(notes) <= 8000),
  constraint referrals_shortlist_chk check (shortlist is null or char_length(shortlist) <= 8000),
  constraint referrals_agent_chk check (receiving_agent is null or char_length(receiving_agent) <= 200),
  constraint referrals_agent_email_chk check (receiving_agent_email is null or (char_length(receiving_agent_email) <= 320 and receiving_agent_email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')),
  constraint referrals_isa_email_chk check (isa_email is null or (char_length(isa_email) <= 320 and isa_email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')),
  constraint referrals_fub_id_chk check (fub_person_id is null or fub_person_id ~ '^[0-9]{1,20}$'),
  constraint referrals_side_chk check (side is null or side in ('buyer', 'seller', 'lease')),
  constraint referrals_status_chk check (status in ('new', 'shortlist', 'awaiting_pick', 'sent', 'connected', 'monthly_check', 'closed', 'nurture')),
  constraint referrals_cadence_chk check (cadence in ('biweekly', 'monthly')),
  constraint referrals_email_count_chk check (email_count >= 0)
);

comment on table public.referrals is
  'Bly Team out-of-area referrals. RLS: authenticated staff via is_staff(). Cadence is biweekly (14 days) after send, then monthly (30 days) at monthly_check. Six months without a touch moves a row to nurture via referrals_apply_silence().';

create table public.referral_events (
  id uuid primary key default gen_random_uuid(),
  referral_id uuid not null references public.referrals (id) on delete cascade,
  created_at timestamptz not null default now(),
  actor uuid default auth.uid(),
  kind text not null,
  detail jsonb not null default '{}'::jsonb,
  constraint referral_events_kind_chk check (kind in ('created', 'status', 'email_sent'))
);

comment on table public.referral_events is 'Append-only staff history for a referral (created, status, email_sent).';

create index referrals_status_updated_idx on public.referrals (status, updated_at desc);
create index referrals_silence_idx on public.referrals (last_touch_at) where status not in ('closed', 'nurture');
create index referrals_next_touch_idx on public.referrals (next_touch_on) where next_touch_on is not null;
create index referral_events_referral_idx on public.referral_events (referral_id, created_at desc);

alter table public.referrals enable row level security;
alter table public.referrals force row level security;
alter table public.referral_events enable row level security;
alter table public.referral_events force row level security;

revoke all on table public.referrals from public, anon;
revoke all on table public.referral_events from public, anon;
grant select, insert, update, delete on table public.referrals to authenticated, service_role;
grant select, insert, update, delete on table public.referral_events to authenticated, service_role;

-- (select public.is_staff()) is evaluated once per statement, not once per row.
create policy referrals_staff_all on public.referrals
  for all to authenticated
  using ((select public.is_staff()))
  with check ((select public.is_staff()));

create policy referral_events_staff_all on public.referral_events
  for all to authenticated
  using ((select public.is_staff()))
  with check ((select public.is_staff()));

-- Cadence and the sent-on-first-email rule live in the database so every client agrees.
create or replace function public.referrals_before_write()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  today date := (timezone('America/Chicago', now()))::date;
begin
  new.updated_at := now();

  if tg_op = 'INSERT' then
    new.last_touch_at := coalesce(new.last_touch_at, now());
    return new;
  end if;

  if new.email_count is distinct from old.email_count and new.email_count > old.email_count then
    new.last_email_at := coalesce(new.last_email_at, now());
    new.last_touch_at := now();
    if new.status in ('new', 'shortlist', 'awaiting_pick') then
      new.status := 'sent';
    end if;
    if new.status not in ('closed', 'nurture') then
      if new.status = 'monthly_check' or old.cadence = 'monthly' or new.cadence = 'monthly' then
        new.cadence := 'monthly';
        new.next_touch_on := today + 30;
      else
        new.cadence := 'biweekly';
        new.next_touch_on := today + 14;
      end if;
    end if;
  end if;

  if new.status is distinct from old.status then
    if new.status = 'monthly_check' then
      new.last_touch_at := now();
      new.cadence := 'monthly';
      new.next_touch_on := today + 30;
    elsif new.status in ('sent', 'connected') then
      new.last_touch_at := now();
      if old.cadence is distinct from 'monthly' and new.cadence is distinct from 'monthly' then
        new.cadence := 'biweekly';
        if new.next_touch_on is not distinct from old.next_touch_on then
          new.next_touch_on := today + 14;
        end if;
      end if;
    elsif new.status in ('new', 'shortlist', 'awaiting_pick') then
      new.last_touch_at := now();
    elsif new.status = 'closed' then
      new.closed_at := coalesce(new.closed_at, now());
    elsif new.status = 'nurture' then
      new.nurture_at := coalesce(new.nurture_at, now());
    end if;
  end if;

  return new;
end;
$$;

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
  end if;
  return new;
end;
$$;

create trigger referrals_before_write
  before insert or update on public.referrals
  for each row execute function public.referrals_before_write();

create trigger referrals_after_write
  after insert or update on public.referrals
  for each row execute function public.referrals_after_write();

-- Atomic "I sent it": increments email_count. The before-trigger schedules the next touch.
create or replace function public.referral_mark_sent(
  p_id uuid,
  p_agent_name text,
  p_agent_email text,
  p_isa text,
  p_shortlist text
)
returns public.referrals
language plpgsql
security invoker
set search_path = public
as $$
declare
  row public.referrals;
begin
  if not (select public.is_staff()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  update public.referrals set
    email_count = email_count + 1,
    last_email_at = now(),
    receiving_agent = nullif(btrim(p_agent_name), ''),
    receiving_agent_email = nullif(btrim(p_agent_email), ''),
    isa_email = nullif(btrim(p_isa), ''),
    shortlist = p_shortlist
  where id = p_id
  returning * into row;

  if not found then
    raise exception 'not found' using errcode = 'P0002';
  end if;
  return row;
end;
$$;

-- Board open applies the six-month silence rule. There is no cron in this repo.
create or replace function public.referrals_apply_silence()
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  n integer;
begin
  if not (select public.is_staff()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  update public.referrals
     set status = 'nurture'
   where status not in ('closed', 'nurture')
     and coalesce(last_touch_at, created_at) < now() - interval '6 months';

  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.referrals_before_write() from public, anon;
revoke all on function public.referrals_after_write() from public, anon;
revoke all on function public.referral_mark_sent(uuid, text, text, text, text) from public, anon;
revoke all on function public.referrals_apply_silence() from public, anon;

grant execute on function public.referrals_before_write() to authenticated, service_role;
grant execute on function public.referrals_after_write() to authenticated, service_role;
grant execute on function public.referral_mark_sent(uuid, text, text, text, text) to authenticated, service_role;
grant execute on function public.referrals_apply_silence() to authenticated, service_role;

comment on function public.referral_mark_sent(uuid, text, text, text, text) is
  'Staff logs a handoff email. Trigger moves early statuses to sent and sets the next touch (14 days biweekly, or 30 days when cadence is already monthly).';
comment on function public.referrals_apply_silence() is
  'Staff-only. Moves referrals with no touch for 6 months to nurture. Called when the Referral Hub board opens.';
