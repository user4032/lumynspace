-- 0016: рамки профілів за промокодами (MVP-монетизація)
-- каталог рамок статичний у коді; тут — активації, коди, статуси
-- Ідемпотентно: можна запускати повторно.

alter table public.profiles add column if not exists frame text;
alter table public.profiles add column if not exists frame_expires_at timestamptz;
alter table public.profiles add column if not exists frame_code text;
-- frame / frame_expires_at / frame_code клієнт не може міняти напряму:
revoke update (frame, frame_expires_at, frame_code) on public.profiles from anon, authenticated;

create table if not exists public.frame_codes (
  code          text primary key,
  frame         text not null check (frame in ('light','glow','aurora','star')),
  duration_days integer not null default 30 check (duration_days between 1 and 365),
  created_by    uuid not null references public.profiles (id) on delete cascade,
  used_by       uuid references public.profiles (id) on delete set null,
  used_at       timestamptz,
  revoked       boolean not null default false,
  created_at    timestamptz not null default now()
);

alter table public.frame_codes enable row level security;
-- доступ лише через RPC нижче
revoke all on public.frame_codes from anon, authenticated;

-- ── RPC ───────────────────────────────────────────────────────────────

-- Адмін: згенерувати N одноразових кодів на рамку
create or replace function public.create_frame_codes(p_frame text, p_count integer, p_days integer)
returns text[] language plpgsql security definer set search_path = ''
as $$
declare me uuid := auth.uid(); codes text[] := '{}'; c text; i int := 0; tries int;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if p_frame not in ('light','glow','aurora','star') then raise exception 'invalid frame'; end if;
  p_count := least(greatest(coalesce(p_count, 1), 1), 50);
  p_days := least(greatest(coalesce(p_days, 30), 1), 365);

  while i < p_count loop
    tries := 0;
    loop
      tries := tries + 1;
      c := 'LUMN-' || upper(substr(md5(random()::text || gen_random_uuid()::text), 1, 4))
           || '-' || upper(substr(md5(random()::text || gen_random_uuid()::text), 1, 4));
      exit when not exists (select 1 from public.frame_codes where code = c) or tries > 5;
    end loop;
    insert into public.frame_codes (code, frame, duration_days, created_by) values (c, p_frame, p_days, me);
    codes := codes || c;
    i := i + 1;
  end loop;
  return codes;
end $$;

-- Адмін: список кодів (з нікнеймом, хто активував)
create or replace function public.list_frame_codes()
returns table (code text, frame text, duration_days int, used_by uuid, used_username text, used_at timestamptz, revoked boolean, created_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select c.code, c.frame, c.duration_days, c.used_by, p.username, c.used_at, c.revoked, c.created_at
  from public.frame_codes c
  left join public.profiles p on p.id = c.used_by
  order by c.created_at desc
  limit 300
$$;

-- Користувач: активувати рамку одноразовим кодом
create or replace function public.activate_frame_code(p_code text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare me uuid := auth.uid(); c public.frame_codes;
begin
  if me is null then raise exception 'not authenticated'; end if;
  select * into c from public.frame_codes where upper(btrim(p_code)) = code for update;
  if not found then raise exception 'invalid code'; end if;
  if c.revoked then raise exception 'code revoked'; end if;
  if c.used_by is not null then raise exception 'code used'; end if;

  update public.frame_codes set used_by = me, used_at = now() where code = c.code;
  update public.profiles
     set frame = c.frame,
         frame_expires_at = now() + make_interval(days => c.duration_days),
         frame_code = c.code
   where id = me;
  return jsonb_build_object('frame', c.frame, 'expires_at', now() + make_interval(days => c.duration_days));
end $$;

-- Адмін: деактивувати код (повернення коштів) — рамка у користувача гасне
create or replace function public.revoke_frame_code(p_code text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  update public.frame_codes set revoked = true where code = upper(btrim(p_code));
  update public.profiles
     set frame = null, frame_expires_at = null, frame_code = null
   where frame_code = upper(btrim(p_code));
end $$;

-- Користувач: прибрати свою рамку
create or replace function public.clear_my_frame()
returns void language plpgsql security definer set search_path = ''
as $$
begin
  update public.profiles set frame = null, frame_expires_at = null, frame_code = null
   where id = auth.uid();
end $$;

revoke execute on function public.create_frame_codes(text, integer, integer) from public;
revoke execute on function public.list_frame_codes() from public;
revoke execute on function public.revoke_frame_code(text) from public;
grant execute on function public.create_frame_codes(text, integer, integer) to authenticated;
grant execute on function public.list_frame_codes() to authenticated;
grant execute on function public.activate_frame_code(text) to authenticated;
grant execute on function public.revoke_frame_code(text) to authenticated;
grant execute on function public.clear_my_frame() to authenticated;

-- ── view feed_posts + рамка автора ───────────────────────────────────
-- CREATE OR REPLACE не можна: колонки p.* у старій view «заморожені» (без edited_at/view_count),
-- тому пересоздаємо view з CASCADE (падає лише following_feed — відновлюємо нижче)
drop view if exists public.feed_posts cascade;

create view public.feed_posts
with (security_invoker = true) as
select
  p.*,
  pr.username         as author_username,
  pr.display_name     as author_display_name,
  pr.avatar_url       as author_avatar_url,
  pr.accent_color     as author_accent_color,
  pr.verified         as author_verified,
  pr.frame            as author_frame,
  pr.frame_expires_at as author_frame_expires_at,
  exists (select 1 from public.lights l where l.post_id = p.id and l.user_id = auth.uid()) as viewer_has_lit,
  exists (select 1 from public.posts r where r.repost_of = p.id and r.author_id = auth.uid()) as viewer_has_reposted
from public.posts p
join public.profiles pr on pr.id = p.author_id;

grant select on public.feed_posts to authenticated, anon;

-- відновлюємо following_feed (returns setof feed_posts)
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

revoke execute on function public.following_feed(integer, timestamptz) from public, anon;
grant execute on function public.following_feed(integer, timestamptz) to authenticated;
