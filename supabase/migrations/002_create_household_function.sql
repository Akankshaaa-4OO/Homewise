-- Run this migration after the original schema.sql has already been applied.
-- It only adds the household bootstrap function; it does not recreate tables.

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

  if char_length(trim(household_name)) not between 1 and 120 then
    raise exception 'Household name must be between 1 and 120 characters';
  end if;

  insert into public.households (name)
  values (trim(household_name))
  returning id into new_household_id;

  insert into public.household_members (household_id, user_id, display_name, role)
  values (
    new_household_id,
    auth.uid(),
    coalesce(nullif(split_part(auth.jwt() ->> 'email', '@', 1), ''), 'Household member'),
    'member'
  );

  return new_household_id;
end;
$$;

revoke all on function public.create_household(text) from public;
grant execute on function public.create_household(text) to authenticated;
