-- ════════════════════════════════════════════════════════════════════
--  Lumyn 0004 — живий режим: сховище фото, Realtime, спільноти
--  (запити в приватні), тренди хештегів, видалення акаунта.
--  Ідемпотентна: можна запускати повторно.
-- ════════════════════════════════════════════════════════════════════

-- ── 1. Supabase Storage ─────────────────────────────────────────────
-- Бакети avatars / covers / post-media створено в 0001; додаємо community-media.
-- Бакети публічні (читання за прямим посиланням), шляхи файлів —
-- <uid>/<випадковий-uuid>.<ext>, тож посилання неможливо вгадати.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('avatars',         'avatars',         true, 5242880,  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  ('covers',          'covers',          true, 5242880,  array['image/jpeg', 'image/png', 'image/webp']),
  ('post-media',      'post-media',      true, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  ('community-media', 'community-media', true, 5242880,  array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Старі політики 0001 (без community-media; публічний перелік усіх файлів) → нові.
-- Перелічувати (select) можна лише свої файли: інакше список шляхів розкрив би
-- фото з дописів «для близьких»/кола. Публічні URL працюють без select-політики.
drop policy if exists lumyn_media_public_read       on storage.objects;
drop policy if exists lumyn_media_insert_own_folder on storage.objects;
drop policy if exists lumyn_media_insert_own on storage.objects;
create policy lumyn_media_insert_own on storage.objects for insert to authenticated
  with check (
    bucket_id in ('avatars', 'covers', 'post-media', 'community-media')
    and (storage.foldername(name))[1] = auth.uid()::text
  );
drop policy if exists lumyn_media_select_own on storage.objects;
create policy lumyn_media_select_own on storage.objects for select to authenticated
  using (
    bucket_id in ('avatars', 'covers', 'post-media', 'community-media')
    and (storage.foldername(name))[1] = auth.uid()::text
  );
drop policy if exists lumyn_media_update_own on storage.objects;
create policy lumyn_media_update_own on storage.objects for update to authenticated
  using (
    bucket_id in ('avatars', 'covers', 'post-media', 'community-media')
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id in ('avatars', 'covers', 'post-media', 'community-media')
    and (storage.foldername(name))[1] = auth.uid()::text
  );
drop policy if exists lumyn_media_delete_own on storage.objects;
create policy lumyn_media_delete_own on storage.objects for delete to authenticated
  using (
    bucket_id in ('avatars', 'covers', 'post-media', 'community-media')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ── 2. Realtime: повідомлення й сповіщення ──────────────────────────
-- postgres_changes поважає RLS (messages_select_members, notifications_select_own).
do $$
declare t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  foreach t in array array['messages', 'notifications', 'conversation_members'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- Прочитав розмову → «message»-сповіщення з неї теж прочитані
create or replace function public.mark_conversation_read(p_conversation uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'not authenticated'; end if;
  update public.conversation_members set last_read_at = now()
    where conversation_id = p_conversation and user_id = me;
  update public.notifications set read_at = now()
    where recipient_id = me and conversation_id = p_conversation and type = 'message' and read_at is null;
end $$;

-- ── 3. Спільноти ───────────────────────────────────────────────────
-- Назву й опис приватної спільноти видно всім (щоб можна було надіслати запит);
-- дописи й учасники лишаються закритими (can_view_community).
drop policy if exists communities_select_visible on public.communities;
drop policy if exists communities_select_all on public.communities;
create policy communities_select_all on public.communities for select using (true);

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

/** Схвалити / відхилити запит у приватну спільноту (owner/admin/mod). */
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

-- ── 4. Тренди: хештеги з видимих мені дописів за останні N днів ──────
-- security invoker → RLS (аудиторія, Glow, блоки) діє для кожного допису.
create or replace function public.trending_hashtags(p_days integer default 7, p_limit integer default 10)
returns table (tag text, posts bigint)
language sql stable security invoker set search_path = ''
as $$
  select lower(m[1]) as tag, count(distinct p.id) as posts
  from public.posts p
  cross join lateral regexp_matches(p.content, '#([[:alnum:]_]{1,50})', 'g') as m
  where p.created_at > now() - make_interval(days => least(greatest(coalesce(p_days, 7), 1), 30))
    and p.repost_of is null
  group by 1
  order by 2 desc, 1
  limit least(greatest(coalesce(p_limit, 10), 1), 50)
$$;

-- ── 5. Видалення акаунта ───────────────────────────────────────────
-- Видаляє auth-користувача → каскадом профіль, дописи, повідомлення, членства…
-- Файли зі Storage застосунок прибирає через Storage API перед викликом.
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = ''
as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'not authenticated'; end if;
  delete from public.profiles where id = me;
  delete from auth.users where id = me;
end $$;

-- ── Права на функції: лише для авторизованих ─────────────────────────
revoke execute on function public.mark_conversation_read(uuid) from public, anon;
revoke execute on function public.respond_join_request(uuid, uuid, boolean) from public, anon;
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.mark_conversation_read(uuid) to authenticated;
grant execute on function public.respond_join_request(uuid, uuid, boolean) to authenticated;
grant execute on function public.delete_my_account() to authenticated;
grant execute on function public.trending_hashtags(integer, integer) to anon, authenticated;
grant select, insert, delete on public.community_join_requests to authenticated;
