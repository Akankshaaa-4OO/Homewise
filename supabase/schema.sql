-- Homewise database foundation
-- Run this in Supabase SQL Editor after creating a project.

create extension if not exists "pgcrypto";

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  currency_code text not null default 'INR' check (currency_code ~ '^[A-Z]{3}$'),
  created_at timestamptz not null default now()
);

create table public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  role text not null default 'member' check (role in ('parent', 'sibling', 'student', 'member')),
  can_view_personal boolean not null default false,
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  created_by_user_id uuid not null references auth.users(id) on delete restrict default auth.uid(),
  description text not null check (char_length(trim(description)) between 1 and 160),
  amount_paise bigint not null check (amount_paise > 0),
  transaction_type text not null check (transaction_type in ('income', 'expense', 'transfer')),
  category text not null default 'Other',
  occurred_on date not null,
  scope text not null default 'shared' check (scope in ('personal', 'shared')),
  transfer_from_user_id uuid references auth.users(id) on delete restrict,
  transfer_to_user_id uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (transaction_type = 'transfer' and transfer_from_user_id is not null and transfer_to_user_id is not null)
    or (transaction_type <> 'transfer' and transfer_from_user_id is null and transfer_to_user_id is null)
  )
);

create table public.transaction_viewers (
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key (transaction_id, user_id)
);

create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  category text not null,
  limit_paise bigint not null check (limit_paise > 0),
  month_start date not null,
  created_by_user_id uuid not null references auth.users(id) on delete restrict default auth.uid(),
  unique (household_id, category, month_start)
);

create table public.recurring_bills (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  amount_paise bigint not null check (amount_paise > 0),
  category text not null default 'Other',
  next_due_on date not null,
  frequency text not null default 'monthly' check (frequency in ('weekly', 'monthly', 'yearly')),
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index transactions_household_date_idx on public.transactions (household_id, occurred_on desc);
create index transactions_owner_idx on public.transactions (owner_user_id);
create index bills_household_due_idx on public.recurring_bills (household_id, next_due_on);

create or replace function public.is_household_member(target_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.household_members
    where household_id = target_household_id and user_id = auth.uid()
  );
$$;

create or replace function public.create_household(household_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_household_id uuid;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to create a household';
  end if;

  insert into public.households (name)
  values (trim(household_name))
  returning id into new_household_id;

  insert into public.household_members (household_id, user_id, display_name, role)
  values (new_household_id, auth.uid(), split_part(auth.jwt() ->> 'email', '@', 1), 'member');

  return new_household_id;
end;
$$;

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.transactions enable row level security;
alter table public.transaction_viewers enable row level security;
alter table public.budgets enable row level security;
alter table public.recurring_bills enable row level security;

revoke all on function public.create_household(text) from public;
grant execute on function public.create_household(text) to authenticated;

create policy "Members can view their households"
  on public.households for select
  using (public.is_household_member(id));

create policy "Members can view household membership"
  on public.household_members for select
  using (public.is_household_member(household_id));

create policy "Members can view allowed transactions"
  on public.transactions for select
  using (
    public.is_household_member(household_id)
    and (
      scope = 'shared'
      or owner_user_id = auth.uid()
      or exists (
        select 1 from public.transaction_viewers tv
        where tv.transaction_id = transactions.id and tv.user_id = auth.uid()
      )
    )
  );

create policy "Members can create their transactions"
  on public.transactions for insert
  with check (
    public.is_household_member(household_id)
    and owner_user_id = auth.uid()
    and created_by_user_id = auth.uid()
  );

create policy "Owners can update their transactions"
  on public.transactions for update
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

create policy "Owners can delete their transactions"
  on public.transactions for delete
  using (owner_user_id = auth.uid());

create policy "Members can view household budgets"
  on public.budgets for select using (public.is_household_member(household_id));
create policy "Members can manage household budgets"
  on public.budgets for all
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy "Members can view household bills"
  on public.recurring_bills for select using (public.is_household_member(household_id));
create policy "Members can manage household bills"
  on public.recurring_bills for all
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy "Owners manage transaction viewers"
  on public.transaction_viewers for all
  using (exists (
    select 1 from public.transactions t
    where t.id = transaction_id and t.owner_user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.transactions t
    where t.id = transaction_id and t.owner_user_id = auth.uid()
  ));
