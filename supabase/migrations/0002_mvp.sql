-- ════════════════════════════════════════════════════════════════════
--  Lumyn 0002 — MVP: «Світло» і Glow-дописи, аудиторія (близькі друзі / кола),
--  тюнер стрічки й ранжування «Для тебе», кастомізація профілю,
--  приватність (приватні акаунти, політика DM, неповнолітні), інвайти,
--  бронювання ніків, блок / мют / скарги.
--
--  Міграція безпечна для виконання в одній транзакції (Supabase SQL Editor,
--  `supabase db push`): нові значення enum використовуються лише всередині
--  тіл функцій, які виконуються пізніше.
-- ════════════════════════════════════════════════════════════════════

-- ── Налаштування механік (одне місце, щоб крутити баланс) ───────────
-- Тримайте синхронно з src/lib/glow.ts
create or replace function public.glow_base_hours()     returns integer language sql stable as $$ select 24 $$;
create or replace function public.glow_hours_per_light() returns integer language sql stable as $$ select 1 $$;
create or replace function public.glow_max_hours()      returns integer language sql stable as $$ select 72 $$;
create or replace function public.glow_permanent_at()   returns integer language sql stable as $$ select 25 $$;
create or replace function public.invites_per_user()    returns integer language sql stable as $$ select 5 $$;
create or replace function public.min_age()             returns integer language sql stable as $$ select 16 $$;
-- true → онбординг вимагає інвайт-код (закрита бета)
create or replace function public.invite_only()         returns boolean language sql stable as $$ select true $$;

-- ── Нові типи ───────────────────────────────────────────────────────
create type public.post_mode     as enum ('permanent', 'glow');
create type public.post_audience as enum ('public', 'close_friends', 'circle');
create type public.dm_policy     as enum ('everyone', 'followers', 'nobody');
create type public.follow_status as enum ('pending', 'accepted');
create type public.report_target as enum ('post', 'profile', 'message', 'community');
create type public.report_reason as enum ('spam', 'harassment', 'hate', 'violence', 'nudity', 'self_harm', 'impersonation', 'minor_safety', 'other');
create type public.report_status as enum ('open', 'reviewing', 'resolved', 'dismissed');
create type public.feed_reason   as enum ('friend_light', 'community_popular', 'new_author', 'popular');

alter type public.notification_type add value if not exists 'light';
alter type public.notification_type add value if not exists 'friend_joined';
alter type public.notification_type add value if not exists 'follow_request';

-- ════════════════════════════════════════════════════════════════════
--  1. likes → lights («Світло»)
-- ════════════════════════════════════════════════════════════════════
drop view if exists public.feed_posts;
drop trigger if exists likes_count  on public.likes;
drop trigger if exists likes_notify on public.likes;
drop function if exists public.bump_like_count();
drop function if exists public.notify_on_like();

alter table public.likes rename to lights;
alter index if exists public.likes_pkey     rename to lights_pkey;
alter index if exists public.likes_post_idx rename to lights_post_idx;
alter policy likes_select     on public.lights rename to lights_select;
alter policy likes_insert_own on public.lights rename to lights_insert_own;
alter policy likes_delete_own on public.lights rename to lights_delete_own;

alter table public.posts rename column like_count to light_count;

-- ════════════════════════════════════════════════════════════════════
--  2. Нові колонки
-- ════════════════════════════════════════════════════════════════════
alter table public.posts
  add column mode       public.post_mode     not null default 'permanent',
  add column expires_at timestamptz,
  add column audience   public.post_audience not null default 'public',
  add column circle_id  uuid;
alter table public.posts
  add constraint posts_glow_top_level check (mode = 'permanent' or (reply_to is null and repost_of is null)),
  add constraint posts_glow_expiry    check ((mode = 'glow') = (expires_at is not null));

alter table public.profiles
  add column accent_color      text not null default '#3b8eff' check (accent_color ~ '^#[0-9a-f]{6}$'),
  add column banner_style      text not null default 'aurora'
                               check (banner_style in ('aurora', 'mesh', 'grid', 'image', 'solid')),
  -- {"top4": [uuid, …], "now_playing": {"title": "…", "artist": "…"} }
  add column widgets           jsonb not null default '{}'::jsonb check (jsonb_typeof(widgets) = 'object'),
  add column status_expires_at timestamptz,
  -- {"social": 0..1 (0 = друзі, 1 = рекомендації), "media": 0..1 (0 = текст, 1 = медіа)}
  add column feed_prefs        jsonb not null default '{"social": 0.5, "media": 0.5}'::jsonb
                               check (jsonb_typeof(feed_prefs) = 'object'),
  add column birth_year        smallint check (birth_year between 1900 and 2100),
  add column is_private        boolean not null default false,
  add column dm_policy         public.dm_policy not null default 'everyone',
  add column onboarded_at      timestamptz,
  add column invited_by        uuid references public.profiles (id) on delete set null;

alter table public.follows
  add column status public.follow_status not null default 'accepted';

-- ════════════════════════════════════════════════════════════════════
--  3. Нові таблиці
-- ════════════════════════════════════════════════════════════════════
create table public.close_friends (
  owner_id   uuid not null references public.profiles (id) on delete cascade,
  friend_id  uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (owner_id, friend_id),
  check (owner_id <> friend_id)
);

-- Кола (v0.2: власні аудиторії з окремою «персоною»)
create table public.circles (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 40),
  emoji      text not null default '✦' check (char_length(emoji) <= 8),
  created_at timestamptz not null default now()
);
create table public.circle_members (
  circle_id  uuid not null references public.circles (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  added_at   timestamptz not null default now(),
  primary key (circle_id, user_id)
);
alter table public.posts
  add constraint posts_circle_fk foreign key (circle_id) references public.circles (id) on delete cascade,
  add constraint posts_circle_audience check ((audience = 'circle') = (circle_id is not null));

create table public.invites (
  code        text primary key check (code ~ '^[A-Z0-9]{4}-[A-Z0-9]{4}$'),
  inviter_id  uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  used_by     uuid unique references public.profiles (id) on delete set null,
  used_at     timestamptz,
  created_at  timestamptz not null default now()
);

create table public.reserved_handles (
  handle      text primary key check (handle ~ '^[a-z0-9_]{3,24}$'),
  email       text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 254),
  claimed_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);
create unique index reserved_handles_email_idx on public.reserved_handles (lower(email));

create table public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create table public.mutes (
  muter_id   uuid not null references public.profiles (id) on delete cascade,
  muted_id   uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (muter_id, muted_id),
  check (muter_id <> muted_id)
);
create table public.reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  target_type public.report_target not null,
  target_id   uuid not null,
  reason      public.report_reason not null,
  details     text not null default '' check (char_length(details) <= 1000),
  status      public.report_status not null default 'open',
  created_at  timestamptz not null default now(),
  resolved_at timestamptz
);

-- ── Індекси ─────────────────────────────────────────────────────────
create index posts_glow_expires_idx      on public.posts (expires_at) where mode = 'glow';
create index posts_light_count_idx       on public.posts (light_count desc, created_at desc) where reply_to is null;
create index close_friends_friend_idx    on public.close_friends (friend_id);
create index circle_members_user_idx     on public.circle_members (user_id);
create index invites_inviter_idx         on public.invites (inviter_id);
create index blocks_blocked_idx          on public.blocks (blocked_id);
create index reports_status_created_idx  on public.reports (status, created_at desc);
create index follows_pending_idx         on public.follows (following_id) where status = 'pending';

-- ════════════════════════════════════════════════════════════════════
--  4. Допоміжні функції (security definer — без рекурсії RLS)
-- ════════════════════════════════════════════════════════════════════
create or replace function public.is_blocked_between(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)
  )
$$;

create or replace function public.is_accepted_follower(follower uuid, target uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.follows
    where follower_id = follower and following_id = target and status = 'accepted'
  )
$$;

/** Вік за роком народження (грубо, без дня/місяця — для MVP достатньо). */
create or replace function public.age_from_birth_year(y smallint)
returns integer language sql stable
as $$ select case when y is null then null else extract(year from now())::int - y end $$;

/**
 * Чи може поточний користувач бачити допис. Єдине джерело правди для
 * posts / lights / poll_votes: спільнота, термін Glow, аудиторія,
 * приватний акаунт, блокування.
 */
create or replace function public.can_view_post(pid uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.posts p
    join public.profiles a on a.id = p.author_id
    where p.id = pid
      and (
        p.author_id = auth.uid()
        or (
          (p.expires_at is null or p.expires_at > now())
          and (p.community_id is null or public.can_view_community(p.community_id))
          and (not a.is_private or public.is_accepted_follower(auth.uid(), p.author_id))
          and (
            p.audience = 'public'
            or (p.audience = 'close_friends' and exists (
                  select 1 from public.close_friends cf
                  where cf.owner_id = p.author_id and cf.friend_id = auth.uid()))
            or (p.audience = 'circle' and exists (
                  select 1 from public.circle_members cm
                  join public.circles c on c.id = cm.circle_id
                  where cm.circle_id = p.circle_id and cm.user_id = auth.uid()
                    and c.owner_id = p.author_id))
          )
          and (auth.uid() is null or not public.is_blocked_between(auth.uid(), p.author_id))
        )
      )
  )
$$;

/** Чи можна написати користувачу (політика DM + блокування). */
create or replace function public.can_dm(sender uuid, recipient uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select sender is not null and sender <> recipient
     and not public.is_blocked_between(sender, recipient)
     and coalesce((
       select case r.dm_policy
         when 'everyone'  then true
         when 'nobody'    then false
         -- «followers»: схвалені читачі отримувача або ті, кого читає сам отримувач
         else public.is_accepted_follower(sender, recipient)
           or public.is_accepted_follower(recipient, sender)
       end
       from public.profiles r where r.id = recipient
     ), false)
$$;

-- ════════════════════════════════════════════════════════════════════
--  5. Тригери
-- ════════════════════════════════════════════════════════════════════

-- 5.1 Нормалізація нового допису: клієнт не може задати термін, лічильники чи дату.
create or replace function public.posts_before_insert()
returns trigger language plpgsql set search_path = ''
as $$
begin
  new.created_at  := now();
  new.light_count := 0;
  new.reply_count := 0;
  new.repost_count := 0;
  if new.mode = 'glow' then
    new.expires_at := now() + make_interval(hours => public.glow_base_hours());
  else
    new.expires_at := null;
  end if;
  return new;
end $$;

create trigger posts_normalize before insert on public.posts
  for each row execute function public.posts_before_insert();

-- 5.2 Світло: лічильник + подовження життя Glow + перетворення на постійний.
--  expires_at = min(created_at + base + light_count·per_light, created_at + max)
--  Формула детермінована: «світло → прибрав → світло» не накручує час.
--  На permanent_at світла допис стає постійним назавжди (не відкочується).
create or replace function public.apply_light_change()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  pid uuid := coalesce(new.post_id, old.post_id);
  d   integer := case when tg_op = 'INSERT' then 1 else -1 end;
begin
  update public.posts p
  set light_count = greatest(p.light_count + d, 0),
      mode = case
               when p.mode = 'glow' and greatest(p.light_count + d, 0) >= public.glow_permanent_at()
                 then 'permanent'::public.post_mode
               else p.mode
             end,
      expires_at = case
               when p.mode <> 'glow' then null
               when greatest(p.light_count + d, 0) >= public.glow_permanent_at() then null
               else least(
                 p.created_at + make_interval(hours => public.glow_base_hours()
                                                     + greatest(p.light_count + d, 0) * public.glow_hours_per_light()),
                 p.created_at + make_interval(hours => public.glow_max_hours()))
             end
  where p.id = pid;
  return null;
end $$;

create trigger lights_apply after insert or delete on public.lights
  for each row execute function public.apply_light_change();

create or replace function public.notify_on_light()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  author uuid;
begin
  select author_id into author from public.posts where id = new.post_id;
  -- одне сповіщення на пару (хто, допис): «світло → прибрав → світло» не спамить
  if author is not null and author <> new.user_id and not exists (
       select 1 from public.notifications
       where type = 'light'::public.notification_type and actor_id = new.user_id and post_id = new.post_id) then
    insert into public.notifications (recipient_id, actor_id, type, post_id)
    values (author, new.user_id, 'light'::public.notification_type, new.post_id);
  end if;
  return null;
end $$;

create trigger lights_notify after insert on public.lights
  for each row execute function public.notify_on_light();

-- 5.3 Підписки: приватний акаунт → запит (pending), лічильники лише для accepted.
create or replace function public.follows_before_insert()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if public.is_blocked_between(new.follower_id, new.following_id) then
    raise exception 'blocked' using errcode = '42501';
  end if;
  new.status := case
    when (select is_private from public.profiles where id = new.following_id) then 'pending'::public.follow_status
    else 'accepted'::public.follow_status
  end;
  return new;
end $$;

create trigger follows_normalize before insert on public.follows
  for each row execute function public.follows_before_insert();

create or replace function public.bump_follow_counts()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' and new.status = 'accepted' then
    update public.profiles set following_count = following_count + 1 where id = new.follower_id;
    update public.profiles set followers_count = followers_count + 1 where id = new.following_id;
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'accepted' then
    update public.profiles set following_count = following_count + 1 where id = new.follower_id;
    update public.profiles set followers_count = followers_count + 1 where id = new.following_id;
  elsif tg_op = 'DELETE' and old.status = 'accepted' then
    update public.profiles set following_count = greatest(following_count - 1, 0) where id = old.follower_id;
    update public.profiles set followers_count = greatest(followers_count - 1, 0) where id = old.following_id;
  end if;
  return null;
end $$;

drop trigger if exists follows_count on public.follows;
create trigger follows_count after insert or update or delete on public.follows
  for each row execute function public.bump_follow_counts();

create or replace function public.notify_on_follow()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.notifications (recipient_id, actor_id, type)
    values (new.following_id, new.follower_id,
            case when new.status = 'pending' then 'follow_request' else 'follow' end::public.notification_type);
  elsif old.status = 'pending' and new.status = 'accepted' then
    insert into public.notifications (recipient_id, actor_id, type)
    values (new.following_id, new.follower_id, 'follow'::public.notification_type);
  end if;
  return null;
end $$;

drop trigger if exists follows_notify on public.follows;
create trigger follows_notify after insert or update of status on public.follows
  for each row execute function public.notify_on_follow();

-- Акаунт став публічним → усі запити автоматично схвалюються
create or replace function public.accept_pending_on_public()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if old.is_private and not new.is_private then
    update public.follows set status = 'accepted' where following_id = new.id and status = 'pending';
  end if;
  return null;
end $$;

create trigger profiles_accept_pending after update of is_private on public.profiles
  for each row execute function public.accept_pending_on_public();

-- 5.4 Блокування розриває підписки, «близьких друзів» і членство в колах в обидва боки.
create or replace function public.on_block()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  delete from public.follows
   where (follower_id = new.blocker_id and following_id = new.blocked_id)
      or (follower_id = new.blocked_id and following_id = new.blocker_id);
  delete from public.close_friends
   where (owner_id = new.blocker_id and friend_id = new.blocked_id)
      or (owner_id = new.blocked_id and friend_id = new.blocker_id);
  delete from public.circle_members cm using public.circles c
   where cm.circle_id = c.id
     and ((c.owner_id = new.blocker_id and cm.user_id = new.blocked_id)
       or (c.owner_id = new.blocked_id and cm.user_id = new.blocker_id));
  return null;
end $$;

create trigger blocks_after_insert after insert on public.blocks
  for each row execute function public.on_block();

-- 5.5 Сповіщення не створюються між заблокованими і від заглушених.
create or replace function public.notifications_guard()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if public.is_blocked_between(new.recipient_id, new.actor_id)
     or exists (select 1 from public.mutes where muter_id = new.recipient_id and muted_id = new.actor_id) then
    return null;
  end if;
  return new;
end $$;

create trigger notifications_guard before insert on public.notifications
  for each row execute function public.notifications_guard();

-- 5.6 Неповнолітні (16–17): приватний акаунт і DM лише від читачів за замовчуванням.
--     Рік народження задається один раз; неповнолітнім недоступна політика «усі».
create or replace function public.profiles_privacy_defaults()
returns trigger language plpgsql set search_path = ''
as $$
declare
  age integer;
begin
  if tg_op = 'UPDATE' and old.birth_year is not null and new.birth_year is distinct from old.birth_year then
    raise exception 'birth_year can be set only once' using errcode = '42501';
  end if;
  age := public.age_from_birth_year(new.birth_year);
  if age is not null and age < 18 then
    if tg_op = 'INSERT' or old.birth_year is null then
      new.is_private := true;
      new.dm_policy  := 'followers';
    end if;
    if new.dm_policy = 'everyone' then
      new.dm_policy := 'followers';
    end if;
  end if;
  if new.status = '' then
    new.status_expires_at := null;
  end if;
  return new;
end $$;

create trigger profiles_privacy before insert or update on public.profiles
  for each row execute function public.profiles_privacy_defaults();

-- 5.7 Інвайти: не більше invites_per_user() на користувача.
create or replace function public.invites_limit()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if (select count(*) from public.invites where inviter_id = new.inviter_id) >= public.invites_per_user() then
    raise exception 'invite limit reached (%)', public.invites_per_user() using errcode = 'check_violation';
  end if;
  new.used_by := null;
  new.used_at := null;
  return new;
end $$;

create trigger invites_limit before insert on public.invites
  for each row execute function public.invites_limit();

-- 5.8 Скарги: статус задає лише модерація.
create or replace function public.reports_before_insert()
returns trigger language plpgsql set search_path = ''
as $$
begin
  new.status := 'open';
  new.resolved_at := null;
  new.created_at := now();
  return new;
end $$;

create trigger reports_normalize before insert on public.reports
  for each row execute function public.reports_before_insert();

-- ════════════════════════════════════════════════════════════════════
--  6. RPC
-- ════════════════════════════════════════════════════════════════════

/** Згенерувати інвайт-код (XXXX-XXXX). Ліміт перевіряє тригер. */
create or replace function public.create_invite()
returns text language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := auth.uid();
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  c text;
begin
  if me is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  loop
    c := '';
    for i in 1..8 loop
      c := c || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
      if i = 4 then c := c || '-'; end if;
    end loop;
    exit when not exists (select 1 from public.invites where code = c);
  end loop;
  insert into public.invites (code, inviter_id) values (c, me);
  return c;
end $$;

/** Чи вільний нік (не зайнятий профілем і не заброньований). Доступно анонімам для лендінгу. */
create or replace function public.is_handle_available(p_handle text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select p_handle ~ '^[a-z0-9_]{3,24}$'
     and not exists (select 1 from public.profiles where username = p_handle)
     and not exists (select 1 from public.reserved_handles where handle = p_handle)
$$;

/** Вейтліст: забронювати нік на пошту (одна бронь на пошту). */
create or replace function public.reserve_handle(p_handle text, p_email text)
returns boolean language plpgsql security definer set search_path = ''
as $$
begin
  p_handle := lower(trim(p_handle));
  p_email  := lower(trim(p_email));
  if not public.is_handle_available(p_handle) then
    return false;
  end if;
  insert into public.reserved_handles (handle, email) values (p_handle, p_email)
  on conflict do nothing;
  return found;
end $$;

/**
 * Онбординг: нік, рік народження, інвайт, акцент.
 * Нік, заброньований на вейтлісті, може забрати лише власник тієї ж пошти.
 */
create or replace function public.complete_onboarding(
  p_username    text,
  p_birth_year  smallint,
  p_invite_code text default null,
  p_accent      text default null
)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  me       uuid := auth.uid();
  my_email text;
  inviter  uuid;
  res      public.reserved_handles;
begin
  if me is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if exists (select 1 from public.profiles where id = me and onboarded_at is not null) then
    raise exception 'already onboarded';
  end if;
  p_username := lower(trim(p_username));
  if p_username !~ '^[a-z0-9_]{3,24}$' then raise exception 'invalid username'; end if;
  if public.age_from_birth_year(p_birth_year) is null or public.age_from_birth_year(p_birth_year) < public.min_age() then
    raise exception 'min age is %', public.min_age();
  end if;
  if exists (select 1 from public.profiles where username = p_username and id <> me) then
    raise exception 'username taken';
  end if;

  select lower(email) into my_email from auth.users where id = me;
  select * into res from public.reserved_handles where handle = p_username;
  if found and res.claimed_by is null and lower(res.email) is distinct from my_email then
    raise exception 'username reserved';
  end if;

  if p_invite_code is not null and p_invite_code <> '' then
    update public.invites
       set used_by = me, used_at = now()
     where code = upper(trim(p_invite_code)) and used_by is null and inviter_id <> me
     returning inviter_id into inviter;
    if inviter is null then raise exception 'invalid invite'; end if;
  elsif public.invite_only() then
    raise exception 'invite required';
  end if;

  update public.profiles
     set username     = p_username,
         birth_year   = p_birth_year,
         accent_color = coalesce(nullif(lower(p_accent), ''), accent_color),
         invited_by   = inviter,
         onboarded_at = now()
   where id = me;
  update public.reserved_handles set claimed_by = me where handle = p_username;

  if inviter is not null then
    insert into public.notifications (recipient_id, actor_id, type)
    values (inviter, me, 'friend_joined'::public.notification_type);
    -- той, хто запросив, і новачок одразу читають одне одного
    insert into public.follows (follower_id, following_id) values (me, inviter) on conflict do nothing;
    insert into public.follows (follower_id, following_id) values (inviter, me) on conflict do nothing;
  end if;
end $$;

/** Схвалити / відхилити запит на підписку. */
create or replace function public.respond_follow_request(p_follower uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if p_accept then
    update public.follows set status = 'accepted'
     where follower_id = p_follower and following_id = auth.uid() and status = 'pending';
  else
    delete from public.follows
     where follower_id = p_follower and following_id = auth.uid() and status = 'pending';
  end if;
end $$;

-- DM: перевизначаємо з урахуванням політики та блокувань
create or replace function public.start_direct_conversation(other_user uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  me   uuid := auth.uid();
  conv uuid;
begin
  if me is null then raise exception 'not authenticated'; end if;
  if other_user = me then raise exception 'cannot message yourself'; end if;

  select c.id into conv
  from public.conversations c
  join public.conversation_members a on a.conversation_id = c.id and a.user_id = me
  join public.conversation_members b on b.conversation_id = c.id and b.user_id = other_user
  where not c.is_group
  limit 1;

  if conv is null then
    if not public.can_dm(me, other_user) then
      raise exception 'dm not allowed' using errcode = '42501';
    end if;
    insert into public.conversations (created_by, is_group) values (me, false) returning id into conv;
    insert into public.conversation_members (conversation_id, user_id)
    values (conv, other_user) on conflict do nothing;
  elsif public.is_blocked_between(me, other_user) then
    raise exception 'blocked' using errcode = '42501';
  end if;
  return conv;
end $$;

-- Автоматичний нік при реєстрації не забирає заброньовані на вейтлісті ніки
-- (крім випадку, коли пошта збігається з бронню).
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  meta      jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  base_name text;
  candidate text;
  n         integer := 0;
begin
  base_name := lower(coalesce(
    meta ->> 'user_name',
    meta ->> 'preferred_username',
    split_part(coalesce(new.email, ''), '@', 1),
    'user'
  ));
  base_name := regexp_replace(base_name, '[^a-z0-9_]', '', 'g');
  if char_length(base_name) < 3 then
    base_name := base_name || 'user';
  end if;
  base_name := left(base_name, 20);
  candidate := base_name;

  while exists (select 1 from public.profiles where username = candidate)
     or exists (select 1 from public.reserved_handles r
                where r.handle = candidate and r.claimed_by is null
                  and lower(r.email) is distinct from lower(new.email)) loop
    n := n + 1;
    candidate := left(base_name, 20) || n::text;
  end loop;

  insert into public.profiles (id, username, display_name, avatar_url)
  values (
    new.id,
    candidate,
    left(coalesce(meta ->> 'full_name', meta ->> 'name', candidate), 50),
    coalesce(meta ->> 'avatar_url', meta ->> 'picture')
  );
  return new;
end $$;

-- ════════════════════════════════════════════════════════════════════
--  7. Стрічки
-- ════════════════════════════════════════════════════════════════════
create view public.feed_posts
with (security_invoker = true) as
select
  p.*,
  pr.username      as author_username,
  pr.display_name  as author_display_name,
  pr.avatar_url    as author_avatar_url,
  pr.accent_color  as author_accent_color,
  exists (select 1 from public.lights l where l.post_id = p.id and l.user_id = auth.uid()) as viewer_has_lit,
  exists (select 1 from public.posts r where r.repost_of = p.id and r.author_id = auth.uid()) as viewer_has_reposted
from public.posts p
join public.profiles pr on pr.id = p.author_id;

/**
 * «Для тебе»: ранжування з вагами з profiles.feed_prefs.
 *   social: 0 → більше друзів, 1 → більше рекомендацій
 *   media:  0 → більше тексту, 1 → більше фото/коду/опитувань
 * security invoker: RLS (аудиторія, Glow, блоки, приватність) діє автоматично.
 * Повертає причину показу для рекомендованих (не від тих, кого ви читаєте).
 */
create or replace function public.for_you_feed(p_limit integer default 20, p_offset integer default 0)
returns table (
  post_id         uuid,
  score           double precision,
  reason          public.feed_reason,
  reason_actor_id uuid,
  reason_community_id uuid
)
language sql stable security invoker set search_path = ''
as $$
  with me as (
    select p.id,
           least(greatest(coalesce((p.feed_prefs ->> 'social')::float8, 0.5), 0), 1) as social,
           least(greatest(coalesce((p.feed_prefs ->> 'media')::float8, 0.5), 0), 1)  as media
    from public.profiles p where p.id = auth.uid()
  ),
  candidates as (
    select
      po.id, po.author_id, po.community_id, po.light_count, po.created_at, po.mode,
      (extract(epoch from (now() - po.created_at)) / 3600.0)::float8 as age_h,
      exists (select 1 from jsonb_array_elements(po.media) m where m ->> 'type' in ('image', 'code', 'poll')) as has_media,
      public.is_accepted_follower(auth.uid(), po.author_id) as followed,
      (select l.user_id from public.lights l
        where l.post_id = po.id and public.is_accepted_follower(auth.uid(), l.user_id)
        order by l.created_at desc limit 1) as friend_lit_by,
      (po.community_id is not null and public.is_community_member(po.community_id) and po.light_count >= 10) as community_popular,
      (au.created_at > now() - interval '14 days' or au.posts_count < 5) as new_author
    from public.posts po
    join public.profiles au on au.id = po.author_id
    cross join me
    where po.reply_to is null
      and po.repost_of is null
      and po.author_id <> me.id
      and po.created_at > now() - interval '14 days'
      and not exists (select 1 from public.mutes mu where mu.muter_id = me.id and mu.muted_id = po.author_id)
  ),
  scored as (
    select c.*,
      -- свіжість: ~0.66 на старті, ~0.15 через добу
      (1.0::float8 / power(c.age_h + 2.0, 0.6)
      * (case when c.followed
              then 1.0 + 2.0 * (1.0 - me.social)
              else 0.4 + me.social * (
                     1.0
                     + 2.0 * (c.friend_lit_by is not null)::int
                     + 1.5 * c.community_popular::int
                     + 1.0 * c.new_author::int
                     + ln(1.0 + c.light_count) / 3.0)
         end)
      * (1.0 + (me.media - 0.5) * (case when c.has_media then 1.6 else -1.6 end))
      * (case when c.mode = 'glow' then 1.15 else 1.0 end))::float8
      as score
    from candidates c cross join me
  )
  select
    s.id,
    s.score,
    case
      when s.followed then null
      when s.friend_lit_by is not null then 'friend_light'::public.feed_reason
      when s.community_popular then 'community_popular'::public.feed_reason
      when s.new_author then 'new_author'::public.feed_reason
      else 'popular'::public.feed_reason
    end,
    case when not s.followed then s.friend_lit_by end,
    case when not s.followed and s.friend_lit_by is null and s.community_popular then s.community_id end
  from scored s
  order by s.score desc, s.created_at desc
  limit least(greatest(p_limit, 1), 100) offset greatest(p_offset, 0)
$$;

/** «Підписки»: хронологічно, лише схвалені підписки + власні, без заглушених. */
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

-- ════════════════════════════════════════════════════════════════════
--  8. RLS
-- ════════════════════════════════════════════════════════════════════
alter table public.close_friends    enable row level security;
alter table public.circles          enable row level security;
alter table public.circle_members   enable row level security;
alter table public.invites          enable row level security;
alter table public.reserved_handles enable row level security;
alter table public.blocks           enable row level security;
alter table public.mutes            enable row level security;
alter table public.reports          enable row level security;

-- posts: видимість через can_view_post (аудиторія, Glow, приватність, блоки)
drop policy if exists posts_select_visible on public.posts;
create policy posts_select_visible on public.posts for select
  using (public.can_view_post(id));

drop policy if exists posts_insert_author on public.posts;
create policy posts_insert_author on public.posts for insert to authenticated
  with check (
    author_id = auth.uid()
    and (community_id is null or public.is_community_member(community_id))
    and (audience <> 'circle' or exists (select 1 from public.circles c where c.id = circle_id and c.owner_id = auth.uid()))
    and (reply_to is null or public.can_view_post(reply_to))
    and (repost_of is null or public.can_view_post(repost_of))
  );

-- lights: як і раніше, але видимість через can_view_post (термін Glow, блоки…)
drop policy if exists lights_select on public.lights;
create policy lights_select on public.lights for select using (public.can_view_post(post_id));

-- follows: бачимо схвалені всім, pending — лише учасникам; схвалює той, на кого підписуються
drop policy if exists follows_select_all on public.follows;
create policy follows_select_visible on public.follows for select
  using (status = 'accepted' or follower_id = auth.uid() or following_id = auth.uid());
create policy follows_accept_by_target on public.follows for update to authenticated
  using (following_id = auth.uid()) with check (following_id = auth.uid() and status = 'accepted');
create policy follows_remove_follower on public.follows for delete to authenticated
  using (following_id = auth.uid());

-- profiles: заблоковані не бачать профіль один одного
drop policy if exists profiles_select_all on public.profiles;
create policy profiles_select_visible on public.profiles for select
  using (auth.uid() is null or id = auth.uid() or not public.is_blocked_between(auth.uid(), id));

-- messages: не можна писати, якщо є блокування з будь-ким у розмові
drop policy if exists messages_insert_member on public.messages;
create policy messages_insert_member on public.messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and public.is_conversation_member(conversation_id)
    and not exists (
      select 1 from public.conversation_members m
      where m.conversation_id = messages.conversation_id
        and m.user_id <> auth.uid()
        and public.is_blocked_between(auth.uid(), m.user_id)
    )
  );

-- close_friends: список бачить і змінює лише власник
create policy close_friends_owner on public.close_friends for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid() and not public.is_blocked_between(owner_id, friend_id));

-- circles / circle_members
create policy circles_owner on public.circles for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy circle_members_owner on public.circle_members for all to authenticated
  using (exists (select 1 from public.circles c where c.id = circle_id and c.owner_id = auth.uid()))
  with check (exists (select 1 from public.circles c where c.id = circle_id and c.owner_id = auth.uid()));
create policy circle_members_self_read on public.circle_members for select to authenticated
  using (user_id = auth.uid());

-- invites
create policy invites_select_own on public.invites for select to authenticated
  using (inviter_id = auth.uid() or used_by = auth.uid());
create policy invites_insert_own on public.invites for insert to authenticated
  with check (inviter_id = auth.uid());
create policy invites_delete_unused on public.invites for delete to authenticated
  using (inviter_id = auth.uid() and used_by is null);

-- reserved_handles: лише через reserve_handle(); прямий доступ закрито (пошти не витікають)
-- (RLS увімкнено, політик немає → anon/authenticated не бачать і не пишуть напряму)

-- blocks / mutes
create policy blocks_own on public.blocks for all to authenticated
  using (blocker_id = auth.uid()) with check (blocker_id = auth.uid());
create policy mutes_own on public.mutes for all to authenticated
  using (muter_id = auth.uid()) with check (muter_id = auth.uid());

-- reports: створити й побачити свої; розгляд — service_role / модератори
create policy reports_insert_own on public.reports for insert to authenticated
  with check (reporter_id = auth.uid());
create policy reports_select_own on public.reports for select to authenticated
  using (reporter_id = auth.uid());

-- ── Привілеї на рівні колонок ───────────────────────────────────────
revoke update on public.profiles from anon, authenticated;
grant  update (display_name, avatar_url, cover_url, bio, status, status_expires_at, location, website,
               accent_color, banner_style, widgets, feed_prefs, birth_year, is_private, dm_policy)
  on public.profiles to authenticated;   -- username і onboarded_at — лише через complete_onboarding

revoke update on public.posts from anon, authenticated;
grant  update (content, media) on public.posts to authenticated;

revoke update on public.follows from anon, authenticated;
grant  update (status) on public.follows to authenticated;

revoke update on public.invites, public.reports, public.blocks, public.mutes, public.close_friends from anon, authenticated;
revoke all on public.reserved_handles from anon, authenticated;

revoke execute on function public.create_invite()                         from public, anon;
revoke execute on function public.complete_onboarding(text, smallint, text, text) from public, anon;
revoke execute on function public.respond_follow_request(uuid, boolean)  from public, anon;
revoke execute on function public.for_you_feed(integer, integer)         from public, anon;
revoke execute on function public.following_feed(integer, timestamptz)   from public, anon;
grant  execute on function public.create_invite()                         to authenticated;
grant  execute on function public.complete_onboarding(text, smallint, text, text) to authenticated;
grant  execute on function public.respond_follow_request(uuid, boolean)  to authenticated;
grant  execute on function public.for_you_feed(integer, integer)         to authenticated;
grant  execute on function public.following_feed(integer, timestamptz)   to authenticated;
grant  execute on function public.is_handle_available(text)              to anon, authenticated;
grant  execute on function public.reserve_handle(text, text)             to anon, authenticated;

-- ════════════════════════════════════════════════════════════════════
--  9. Прибирання згаслих Glow-дописів (pg_cron, якщо доступний)
--     Згаслі одразу ховаються RLS; фізично видаляються через 7 днів
--     (автор ще бачить їх у своєму «архіві»).
-- ════════════════════════════════════════════════════════════════════
create or replace function public.purge_expired_glow()
returns integer language plpgsql security definer set search_path = ''
as $$
declare n integer;
begin
  delete from public.posts where mode = 'glow' and expires_at < now() - interval '7 days';
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.purge_expired_glow() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    begin
      create extension if not exists pg_cron;
      perform cron.schedule('lumyn-purge-expired-glow', '17 * * * *', 'select public.purge_expired_glow()');
    exception when others then
      raise notice 'pg_cron недоступний (%): увімкніть Database → Extensions → pg_cron і заплануйте purge_expired_glow() вручну', sqlerrm;
    end;
  else
    raise notice 'pg_cron не встановлено — пропускаю розклад прибирання';
  end if;
end $$;
