-- apply-pending-2.sql: Supabase → SQL Editor → Run. Міграції 0007 + 0008 (ідемпотентно).
-- В кінці робить @denys адміном і верифікованим. Інший нік — змініть останній рядок.
-- Ідемпотентно: можна запускати повторно.

alter table public.posts add column if not exists view_count integer not null default 0;

create table if not exists public.post_views (
  post_id   uuid not null references public.posts (id) on delete cascade,
  viewer_id uuid not null references public.profiles (id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (post_id, viewer_id)
);
alter table public.post_views enable row level security;
-- без політик: пишемо/читаємо лише через RPC нижче
revoke all on public.post_views from anon, authenticated;

-- клієнт не може задати view_count при створенні
create or replace function public.posts_reset_views()
returns trigger language plpgsql set search_path = ''
as $$ begin new.view_count := 0; return new; end $$;
drop trigger if exists posts_reset_views on public.posts;
create trigger posts_reset_views before insert on public.posts
  for each row execute function public.posts_reset_views();

-- Записати перегляд (автор не рахується) і повернути актуальну кількість.
create or replace function public.record_post_view(p_post uuid)
returns integer language plpgsql security definer set search_path = ''
as $$
declare me uuid := auth.uid(); n integer; author uuid;
begin
  if not public.can_view_post(p_post) then return 0; end if;
  select author_id into author from public.posts where id = p_post;
  if me is not null and me <> author then
    insert into public.post_views (post_id, viewer_id) values (p_post, me) on conflict do nothing;
    if found then
      update public.posts set view_count = view_count + 1 where id = p_post;
    end if;
  end if;
  select view_count into n from public.posts where id = p_post;
  return coalesce(n, 0);
end $$;
revoke execute on function public.record_post_view(uuid) from public;
grant execute on function public.record_post_view(uuid) to anon, authenticated;

-- Лише прочитати кількість (для картки поширення)
create or replace function public.post_view_count(p_post uuid)
returns integer language sql stable security definer set search_path = ''
as $$ select case when public.can_view_post(p_post) then (select view_count from public.posts where id = p_post) else 0 end $$;
revoke execute on function public.post_view_count(uuid) from public;
grant execute on function public.post_view_count(uuid) to anon, authenticated;

-- 0008: адмінка — is_admin, verified, журнал дій, RPC з перевіркою адміна на сервері.
-- Ідемпотентно. Потребує 0007 (posts.view_count).

alter table public.profiles add column if not exists verified boolean not null default false;
alter table public.profiles add column if not exists is_admin boolean not null default false;
-- Користувачі не можуть змінювати verified / is_admin: update дозволено лише на перелічені колонки (0002/0005),
-- але на всяк випадок явно забираємо.
revoke update (verified, is_admin) on public.profiles from anon, authenticated;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = ''
as $$ select coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false) $$;
revoke execute on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- ── Журнал дій адмінів ──────────────────────────────────────────────
create table if not exists public.admin_actions (
  id          bigint generated always as identity primary key,
  admin_id    uuid references public.profiles (id) on delete set null,
  action      text not null,
  target_user uuid,
  target_id   uuid,
  details     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
alter table public.admin_actions enable row level security;
drop policy if exists admin_actions_select_admin on public.admin_actions;
create policy admin_actions_select_admin on public.admin_actions for select to authenticated using (public.is_admin());
revoke insert, update, delete on public.admin_actions from anon, authenticated;
grant select on public.admin_actions to authenticated;

create or replace function public.admin_log(p_action text, p_user uuid, p_target uuid, p_details jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = ''
as $$ insert into public.admin_actions (admin_id, action, target_user, target_id, details) values (auth.uid(), p_action, p_user, p_target, p_details) $$;
revoke execute on function public.admin_log(text, uuid, uuid, jsonb) from public, anon, authenticated;

create or replace function public.admin_require()
returns void language plpgsql stable security definer set search_path = ''
as $$ begin if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if; end $$;
revoke execute on function public.admin_require() from public, anon, authenticated;

-- Шлях файлу в Storage з публічного URL: .../object/public/<bucket>/<path>
create or replace function public.admin_try_delete_file(p_url text)
returns void language plpgsql security definer set search_path = ''
as $$
declare b text; n text;
begin
  if p_url is null or p_url !~ '/object/public/' then return; end if;
  b := split_part(split_part(p_url, '/object/public/', 2), '/', 1);
  n := split_part(substring(split_part(p_url, '/object/public/', 2) from length(b) + 2), '?', 1);
  begin
    delete from storage.objects where bucket_id = b and name = n;
  exception when others then null; -- best effort (новий Supabase може забороняти прямий delete)
  end;
end $$;
revoke execute on function public.admin_try_delete_file(text) from public, anon, authenticated;

-- ── Дії над користувачами ───────────────────────────────────────────
create or replace function public.admin_search_users(p_query text default '', p_limit integer default 50)
returns table (id uuid, username text, display_name text, avatar_url text, cover_url text,
               verified boolean, is_admin boolean, followers_count integer, posts_count integer, created_at timestamptz)
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform public.admin_require();
  return query
    select p.id, p.username, p.display_name, p.avatar_url, p.cover_url, p.verified, p.is_admin,
           p.followers_count, p.posts_count, p.created_at
    from public.profiles p
    where coalesce(p_query, '') = ''
       or p.username ilike '%' || ltrim(p_query, '@') || '%'
       or p.display_name ilike '%' || p_query || '%'
    order by p.created_at desc
    limit least(greatest(p_limit, 1), 200);
end $$;

create or replace function public.admin_set_verified(p_user uuid, p_verified boolean)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  perform public.admin_require();
  update public.profiles set verified = p_verified where id = p_user;
  perform public.admin_log(case when p_verified then 'verify' else 'unverify' end, p_user, null);
end $$;

create or replace function public.admin_reset_avatar(p_user uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare old text;
begin
  perform public.admin_require();
  select avatar_url into old from public.profiles where id = p_user;
  update public.profiles set avatar_url = null where id = p_user;
  perform public.admin_try_delete_file(old);
  perform public.admin_log('reset_avatar', p_user, null, jsonb_build_object('old', old));
end $$;

create or replace function public.admin_reset_banner(p_user uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare old text;
begin
  perform public.admin_require();
  select cover_url into old from public.profiles where id = p_user;
  update public.profiles set cover_url = null,
    banner_style = case when banner_style = 'image' then 'aurora' else banner_style end
  where id = p_user;
  perform public.admin_try_delete_file(old);
  perform public.admin_log('reset_banner', p_user, null, jsonb_build_object('old', old));
end $$;

create or replace function public.admin_delete_user(p_user uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare h text;
begin
  perform public.admin_require();
  if p_user = auth.uid() then raise exception 'use delete_my_account for yourself'; end if;
  if (select is_admin from public.profiles where id = p_user) then raise exception 'cannot delete another admin'; end if;
  select username into h from public.profiles where id = p_user;
  begin
    delete from storage.objects where (storage.foldername(name))[1] = p_user::text
      and bucket_id in ('avatars', 'covers', 'post-media');
  exception when others then null;
  end;
  begin
    update storage.objects set owner = null where owner = p_user;
  exception when others then null;
  end;
  perform public.admin_log('delete_user', p_user, null, jsonb_build_object('username', h));
  delete from public.profiles where id = p_user;
  delete from auth.users where id = p_user;
end $$;

-- ── Скарги ──────────────────────────────────────────────────────────
drop policy if exists reports_select_admin on public.reports;
create policy reports_select_admin on public.reports for select to authenticated using (public.is_admin());

create or replace function public.admin_resolve_report(p_report uuid, p_status public.report_status)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  perform public.admin_require();
  update public.reports set status = p_status, resolved_at = now() where id = p_report;
  perform public.admin_log('report_' || p_status::text, null, p_report);
end $$;

create or replace function public.admin_delete_post(p_post uuid, p_report uuid default null)
returns void language plpgsql security definer set search_path = ''
as $$
declare a uuid;
begin
  perform public.admin_require();
  select author_id into a from public.posts where id = p_post;
  delete from public.posts where id = p_post;
  if p_report is not null then
    update public.reports set status = 'resolved', resolved_at = now() where id = p_report;
  end if;
  perform public.admin_log('delete_post', a, p_post);
end $$;

/** Відкриті скарги + автор цілі (для швидких дій) */
create or replace function public.admin_open_reports(p_limit integer default 100)
returns table (id uuid, target_type text, target_id uuid, reason text, details text, created_at timestamptz,
               reporter_username text, target_user uuid, target_username text, target_preview text)
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform public.admin_require();
  return query
    select r.id, r.target_type::text, r.target_id, r.reason::text, r.details, r.created_at,
           rp.username,
           coalesce(po.author_id, pr.id),
           coalesce(pa.username, pr.username),
           left(coalesce(po.content, ''), 200)
    from public.reports r
    left join public.profiles rp on rp.id = r.reporter_id
    left join public.posts po on r.target_type::text = 'post' and po.id = r.target_id
    left join public.profiles pa on pa.id = po.author_id
    left join public.profiles pr on r.target_type::text in ('user', 'profile') and pr.id = r.target_id
    where r.status = 'open'
    order by r.created_at desc
    limit least(greatest(p_limit, 1), 500);
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'admin_search_users(text, integer)', 'admin_set_verified(uuid, boolean)', 'admin_reset_avatar(uuid)',
    'admin_reset_banner(uuid)', 'admin_delete_user(uuid)', 'admin_resolve_report(uuid, public.report_status)',
    'admin_delete_post(uuid, uuid)', 'admin_open_reports(integer)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

-- ── feed_posts: + author_verified (і view_count з 0007) ──────────────
drop function if exists public.following_feed(integer, timestamptz);
drop view if exists public.feed_posts;
create view public.feed_posts
with (security_invoker = true) as
select
  p.*,
  pr.username      as author_username,
  pr.display_name  as author_display_name,
  pr.avatar_url    as author_avatar_url,
  pr.accent_color  as author_accent_color,
  exists (select 1 from public.lights l where l.post_id = p.id and l.user_id = auth.uid()) as viewer_has_lit,
  exists (select 1 from public.posts r where r.repost_of = p.id and r.author_id = auth.uid()) as viewer_has_reposted,
  pr.verified      as author_verified
from public.posts p
join public.profiles pr on pr.id = p.author_id;
grant select on public.feed_posts to anon, authenticated;

create or replace function public.following_feed(p_limit integer default 20, p_before timestamptz default null)
returns setof public.feed_posts
language sql stable security invoker set search_path = ''
as $$
  select fp.* from public.feed_posts fp
  where fp.reply_to is null
    and (fp.author_id = auth.uid() or public.is_accepted_follower(auth.uid(), fp.author_id))
    and not exists (select 1 from public.mutes mu where mu.muter_id = auth.uid() and mu.muted_id = fp.author_id)
    and (p_before is null or fp.created_at < p_before)
  order by fp.created_at desc
  limit least(greatest(p_limit, 1), 100)
$$;
grant execute on function public.following_feed(integer, timestamptz) to authenticated;

-- ── Зробити себе адміном (нік denys) ────────────────────────────────
update public.profiles set is_admin = true, verified = true where username = 'denys';
