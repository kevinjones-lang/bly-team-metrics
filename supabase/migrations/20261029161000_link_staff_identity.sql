-- Let Google or email sign-in attach to an existing staff row.
-- public.is_staff() stays user_id = auth.uid() with role = staff and active.
-- This does not grant staff. It sets user_id only when the confirmed auth email
-- matches public.agents.email, the row is already staff and active, and user_id
-- is empty or already this user. A different user_id is left alone.
-- Apply once on Agent Advantage Academy. Do not re-run earlier referral migrations.

create or replace function public.link_staff_identity()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  confirmed boolean;
  em text;
begin
  if uid is null then
    return false;
  end if;

  select email_confirmed_at is not null, lower(btrim(email))
    into confirmed, em
  from auth.users
  where id = uid;

  if confirmed is not true or em is null or em = '' then
    return public.is_staff();
  end if;

  update public.agents
     set user_id = uid,
         updated_at = now()
   where lower(btrim(email)) = em
     and role = 'staff'
     and active
     and (user_id is null or user_id = uid);

  return public.is_staff();
end;
$$;

comment on function public.link_staff_identity() is
  'Attaches the signed-in user to an unclaimed active staff row with the same confirmed email. Does not override another user_id and does not change is_staff().';

revoke all on function public.link_staff_identity() from public, anon;
grant execute on function public.link_staff_identity() to authenticated, service_role;
