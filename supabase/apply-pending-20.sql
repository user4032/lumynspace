-- apply-pending-20: уривок 0004, якого немає в живій БД.
-- Симптоми: приватні спільноти не видно в каталозі/профілі, а запити
-- на вступ падають із "Could not find the table public.community_join_requests".
-- Ідемпотентно: можна запускати повторно.

-- ── 1. Приватні спільноти видимі всім (назва, опис, лічильник) ───────
-- Дописи й учасники далі закриває can_view_community() / members_select_visible.
drop policy if exists communities_select_visible on public.communities;
drop policy if exists communities_select_all on public.communities;
create policy communities_select_all on public.communities for select using (true);

-- ── 2. Запити на вступ ──────────────────────────────────────────────
create table if not exists public.community_join_requests (
  community_id uuid not null references public.communities (id) on delete cascade,
  user_id      uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (community_id, user_id)
);
create index if not exists community_join_requests_user_idx on public.community_join_requests (user_id);
alter table public.community_join_requests enable row level security;
revoke update on public.community_join_requests from anon, authenticated;

drop policy if exists join_requests_select on public.community_join_requests;
create policy join_requests_select on public.community_join_requests for select to authenticated
  using (user_id = auth.uid() or public.community_role_of(community_id) in ('owner', 'admin', 'mod'));
drop policy if exists join_requests_insert_own on public.community_join_requests;
create policy join_requests_insert_own on public.community_join_requests for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.communities c where c.id = community_id and c.is_private)
    and not public.is_community_member(community_id)
  );
drop policy if exists join_requests_delete on public.community_join_requests;
create policy join_requests_delete on public.community_join_requests for delete to authenticated
  using (user_id = auth.uid() or public.community_role_of(community_id) in ('owner', 'admin', 'mod'));

-- ── 3. Схвалення / відхилення запиту ────────────────────────────────
create or replace function public.respond_join_request(p_community uuid, p_user uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if public.community_role_of(p_community, auth.uid()) is null
     or public.community_role_of(p_community, auth.uid()) not in ('owner', 'admin', 'mod') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if not exists (select 1 from public.community_join_requests where community_id = p_community and user_id = p_user) then
    raise exception 'no request';
  end if;
  delete from public.community_join_requests where community_id = p_community and user_id = p_user;
  if p_accept then
    insert into public.community_members (community_id, user_id, role)
    values (p_community, p_user, 'member') on conflict do nothing;
  end if;
end $$;

-- ── 4. Права ────────────────────────────────────────────────────────
grant select, insert, delete on public.community_join_requests to authenticated;
revoke execute on function public.respond_join_request(uuid, uuid, boolean) from public, anon;
grant execute on function public.respond_join_request(uuid, uuid, boolean) to authenticated;

-- PostgREST кешує схему: після створення таблиці/функції хай перечитає.
notify pgrst, 'reload schema';
