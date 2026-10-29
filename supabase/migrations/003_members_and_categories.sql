-- Household member profile and category management.
-- Run after 002_create_household_function.sql.

create table if not exists public.household_invitations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  email text not null check (position('@' in email) > 1),
  display_name text not null check (char_length(trim(display_name)) between 1 and 80),
  role text not null default 'member' check (role in ('parent', 'sibling', 'student', 'member')),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'cancelled')),
  invited_by uuid not null references auth.users(id) on delete restrict default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists public.household_categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 60),
  created_by uuid not null references auth.users(id) on delete restrict default auth.uid(),
  created_at timestamptz not null default now(),
  unique (household_id, name)
);

insert into public.household_categories (household_id, name, created_by)
select h.id, category.name, m.user_id
from public.households h
join lateral (
  select user_id from public.household_members
  where household_id = h.id
  order by joined_at
  limit 1
) m on true
cross join unnest(array['Groceries', 'Transport', 'Utilities', 'Education', 'Shopping', 'Subscriptions', 'Other']) as category(name)
on conflict (household_id, name) do nothing;

alter table public.household_invitations enable row level security;
alter table public.household_categories enable row level security;

create policy "Members can rename their own profile"
  on public.household_members for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.is_household_member(household_id));

create policy "Members can view household invitations"
  on public.household_invitations for select
  using (public.is_household_member(household_id));
create policy "Members can create household invitations"
  on public.household_invitations for insert
  with check (public.is_household_member(household_id) and invited_by = auth.uid());
create policy "Inviters can cancel invitations"
  on public.household_invitations for update
  using (invited_by = auth.uid())
  with check (invited_by = auth.uid());

create policy "Members can view categories"
  on public.household_categories for select
  using (public.is_household_member(household_id));
create policy "Members can create categories"
  on public.household_categories for insert
  with check (public.is_household_member(household_id) and created_by = auth.uid());
create policy "Members can rename categories"
  on public.household_categories for update
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));
create policy "Members can delete categories"
  on public.household_categories for delete
  using (public.is_household_member(household_id));

create or replace function public.accept_household_invitation()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  invitation public.household_invitations;
begin
  if auth.uid() is null then raise exception 'You must be signed in'; end if;
  select * into invitation
  from public.household_invitations
  where lower(email) = lower(auth.jwt() ->> 'email') and status = 'pending'
  order by created_at desc limit 1;
  if invitation.id is null then raise exception 'No pending invitation found for this email'; end if;

  insert into public.household_members (household_id, user_id, display_name, role)
  values (invitation.household_id, auth.uid(), invitation.display_name, invitation.role)
  on conflict (household_id, user_id) do update
    set display_name = excluded.display_name, role = excluded.role;
  update public.household_invitations set status = 'accepted' where id = invitation.id;
  return invitation.household_id;
end;
$$;

create or replace function public.remove_self_from_household(target_household_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.household_members
  where household_id = target_household_id and user_id = auth.uid();
$$;

revoke all on function public.accept_household_invitation() from public;
grant execute on function public.accept_household_invitation() to authenticated;
revoke all on function public.remove_self_from_household(uuid) from public;
grant execute on function public.remove_self_from_household(uuid) to authenticated;
