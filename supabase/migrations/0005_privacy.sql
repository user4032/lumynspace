-- Privacy: hide following list
alter table public.profiles
  add column if not exists hide_following boolean not null default false;

-- Allow updating the new column
grant update (hide_following) on public.profiles to authenticated;
