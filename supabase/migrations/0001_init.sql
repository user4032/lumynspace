-- ════════════════════════════════════════════════════════════════════
--  Lumyn — початкова схема бази даних (Supabase / Postgres 15+)
--  Таблиці, RLS-політики, тригери-лічильники, сповіщення, сховище.
-- ════════════════════════════════════════════════════════════════════

-- ── Типи ────────────────────────────────────────────────────────────
create type public.community_role as enum ('owner', 'admin', 'mod', 'member');
create type public.notification_type as enum ('like', 'reply', 'follow', 'repost', 'mention', 'message');

-- ── Профілі ─────────────────────────────────────────────────────────
create table public.profiles (
  id               uuid primary key references auth.users (id) on delete cascade,
  username         text not null unique
                   check (username ~ '^[a-z0-9_]{3,24}$'),
  display_name     text not null default ''
                   check (char_length(display_name) <= 50),
  avatar_url       text,
  cover_url        text,
  bio              text not null default '' check (char_length(bio) <= 300),
  status           text not null default '' check (char_length(status) <= 140),
  location         text not null default '' check (char_length(location) <= 60),
  website          text not null default '' check (char_length(website) <= 120),
  followers_count  integer not null default 0,
  following_count  integer not null default 0,
  posts_count      integer not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ── Спільноти ───────────────────────────────────────────────────────
create table public.communities (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique check (slug ~ '^[a-z0-9-]{3,40}$'),
  name          text not null check (char_length(name) between 2 and 60),
  description   text not null default '' check (char_length(description) <= 500),
  avatar_url    text,
  cover_url     text,
  is_private    boolean not null default false,
  owner_id      uuid not null references public.profiles (id) on delete cascade,
  member_count  integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table public.community_members (
  community_id  uuid not null references public.communities (id) on delete cascade,
  user_id       uuid not null references public.profiles (id) on delete cascade,
  role          public.community_role not null default 'member',
  joined_at     timestamptz not null default now(),
  primary key (community_id, user_id)
);

-- ── Дописи ──────────────────────────────────────────────────────────
-- media: масив вкладень, напр.
--   [{"type":"image","url":"…","width":1200,"height":800,"alt":"…"},
--    {"type":"code","lang":"ts","code":"…"},
--    {"type":"poll","options":["Так","Ні"],"ends_at":"…"}]
create table public.posts (
  id             uuid primary key default gen_random_uuid(),
  author_id      uuid not null references public.profiles (id) on delete cascade,
  community_id   uuid references public.communities (id) on delete cascade,
  content        text not null default '' check (char_length(content) <= 2000),
  media          jsonb not null default '[]'::jsonb
                 check (jsonb_typeof(media) = 'array'),
  reply_to       uuid references public.posts (id) on delete cascade,
  repost_of      uuid references public.posts (id) on delete cascade,
  like_count     integer not null default 0,
  reply_count    integer not null default 0,
  repost_count   integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint posts_not_empty check (
    char_length(content) > 0 or jsonb_array_length(media) > 0 or repost_of is not null
  ),
  constraint posts_reply_xor_repost check (reply_to is null or repost_of is null)
);

-- один простий репост на допис від користувача
create unique index posts_unique_plain_repost
  on public.posts (author_id, repost_of)
  where repost_of is not null and content = '';

create table public.likes (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  post_id     uuid not null references public.posts (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, post_id)
);

create table public.poll_votes (
  post_id       uuid not null references public.posts (id) on delete cascade,
  user_id       uuid not null references public.profiles (id) on delete cascade,
  option_index  smallint not null check (option_index between 0 and 9),
  created_at    timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table public.follows (
  follower_id   uuid not null references public.profiles (id) on delete cascade,
  following_id  uuid not null references public.profiles (id) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

-- ── Особисті повідомлення ───────────────────────────────────────────
create table public.conversations (
  id          uuid primary key default gen_random_uuid(),
  created_by  uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  is_group    boolean not null default false,
  title       text check (char_length(title) <= 80),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.conversation_members (
  conversation_id  uuid not null references public.conversations (id) on delete cascade,
  user_id          uuid not null references public.profiles (id) on delete cascade,
  joined_at        timestamptz not null default now(),
  last_read_at     timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create table public.messages (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references public.conversations (id) on delete cascade,
  sender_id        uuid not null references public.profiles (id) on delete cascade,
  content          text not null check (char_length(content) between 1 and 4000),
  created_at       timestamptz not null default now(),
  edited_at        timestamptz
);

-- ── Сповіщення ──────────────────────────────────────────────────────
create table public.notifications (
  id               uuid primary key default gen_random_uuid(),
  recipient_id     uuid not null references public.profiles (id) on delete cascade,
  actor_id         uuid not null references public.profiles (id) on delete cascade,
  type             public.notification_type not null,
  post_id          uuid references public.posts (id) on delete cascade,
  conversation_id  uuid references public.conversations (id) on delete cascade,
  read_at          timestamptz,
  created_at       timestamptz not null default now()
);

-- ── Індекси ─────────────────────────────────────────────────────────
create index posts_author_created_idx    on public.posts (author_id, created_at desc);
create index posts_created_idx           on public.posts (created_at desc);
create index posts_community_created_idx on public.posts (community_id, created_at desc) where community_id is not null;
create index posts_reply_to_idx          on public.posts (reply_to) where reply_to is not null;
create index posts_repost_of_idx         on public.posts (repost_of) where repost_of is not null;
create index likes_post_idx              on public.likes (post_id);
create index follows_following_idx       on public.follows (following_id);
create index community_members_user_idx  on public.community_members (user_id);
create index conversation_members_user_idx on public.conversation_members (user_id);
create index messages_conversation_created_idx on public.messages (conversation_id, created_at);
create index notifications_recipient_created_idx on public.notifications (recipient_id, created_at desc);

-- ════════════════════════════════════════════════════════════════════
--  Допоміжні функції (security definer, щоб уникнути рекурсії в RLS)
-- ════════════════════════════════════════════════════════════════════
create or replace function public.community_role_of(cid uuid, uid uuid default auth.uid())
returns public.community_role
language sql stable security definer set search_path = ''
as $$
  select role from public.community_members
  where community_id = cid and user_id = uid
$$;

create or replace function public.is_community_member(cid uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.community_members
    where community_id = cid and user_id = auth.uid()
  )
$$;

create or replace function public.can_view_community(cid uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.communities c
    where c.id = cid
      and (not c.is_private
           or exists (select 1 from public.community_members m
                      where m.community_id = c.id and m.user_id = auth.uid()))
  )
$$;

create or replace function public.is_conversation_member(conv uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.conversation_members
    where conversation_id = conv and user_id = auth.uid()
  )
$$;

create or replace function public.can_view_post(pid uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.posts p
    where p.id = pid
      and (p.community_id is null or public.can_view_community(p.community_id))
  )
$$;

-- ════════════════════════════════════════════════════════════════════
--  Тригери
-- ════════════════════════════════════════════════════════════════════

-- updated_at
create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger profiles_touch     before update on public.profiles     for each row execute function public.touch_updated_at();
create trigger communities_touch  before update on public.communities  for each row execute function public.touch_updated_at();
create trigger posts_touch        before update on public.posts        for each row execute function public.touch_updated_at();

-- Автоматичне створення профілю після реєстрації (GitHub / Google / email)
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
    meta ->> 'user_name',            -- GitHub
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

  while exists (select 1 from public.profiles where username = candidate) loop
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

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Лічильники лайків
create or replace function public.bump_like_count()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.posts set like_count = like_count + 1 where id = new.post_id;
  else
    update public.posts set like_count = greatest(like_count - 1, 0) where id = old.post_id;
  end if;
  return null;
end $$;

create trigger likes_count after insert or delete on public.likes
  for each row execute function public.bump_like_count();

-- Лічильники відповідей / репостів / дописів у профілі
create or replace function public.bump_post_counts()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  rec public.posts;
  d   integer;
begin
  if tg_op = 'INSERT' then rec := new; d := 1; else rec := old; d := -1; end if;

  if rec.reply_to is not null then
    update public.posts set reply_count = greatest(reply_count + d, 0) where id = rec.reply_to;
  end if;
  if rec.repost_of is not null then
    update public.posts set repost_count = greatest(repost_count + d, 0) where id = rec.repost_of;
  end if;
  if rec.reply_to is null then
    update public.profiles set posts_count = greatest(posts_count + d, 0) where id = rec.author_id;
  end if;
  return null;
end $$;

create trigger posts_count after insert or delete on public.posts
  for each row execute function public.bump_post_counts();

-- Лічильники підписок
create or replace function public.bump_follow_counts()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.profiles set following_count = following_count + 1 where id = new.follower_id;
    update public.profiles set followers_count = followers_count + 1 where id = new.following_id;
  else
    update public.profiles set following_count = greatest(following_count - 1, 0) where id = old.follower_id;
    update public.profiles set followers_count = greatest(followers_count - 1, 0) where id = old.following_id;
  end if;
  return null;
end $$;

create trigger follows_count after insert or delete on public.follows
  for each row execute function public.bump_follow_counts();

-- Лічильник учасників спільноти
create or replace function public.bump_member_count()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.communities set member_count = member_count + 1 where id = new.community_id;
  else
    update public.communities set member_count = greatest(member_count - 1, 0) where id = old.community_id;
  end if;
  return null;
end $$;

create trigger community_members_count after insert or delete on public.community_members
  for each row execute function public.bump_member_count();

-- Творець спільноти автоматично стає owner
create or replace function public.add_community_owner()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.community_members (community_id, user_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict (community_id, user_id) do update set role = 'owner';
  return null;
end $$;

create trigger communities_add_owner after insert on public.communities
  for each row execute function public.add_community_owner();

-- Творець розмови автоматично стає учасником
create or replace function public.add_conversation_creator()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.conversation_members (conversation_id, user_id)
  values (new.id, new.created_by)
  on conflict do nothing;
  return null;
end $$;

create trigger conversations_add_creator after insert on public.conversations
  for each row execute function public.add_conversation_creator();

-- ── Сповіщення ──────────────────────────────────────────────────────
create or replace function public.notify_on_like()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  author uuid;
begin
  select author_id into author from public.posts where id = new.post_id;
  if author is not null and author <> new.user_id then
    insert into public.notifications (recipient_id, actor_id, type, post_id)
    values (author, new.user_id, 'like', new.post_id);
  end if;
  return null;
end $$;

create trigger likes_notify after insert on public.likes
  for each row execute function public.notify_on_like();

create or replace function public.notify_on_follow()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.notifications (recipient_id, actor_id, type)
  values (new.following_id, new.follower_id, 'follow');
  return null;
end $$;

create trigger follows_notify after insert on public.follows
  for each row execute function public.notify_on_follow();

create or replace function public.notify_on_post()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  target uuid;
  mentioned uuid;
begin
  if new.reply_to is not null then
    select author_id into target from public.posts where id = new.reply_to;
    if target is not null and target <> new.author_id then
      insert into public.notifications (recipient_id, actor_id, type, post_id)
      values (target, new.author_id, 'reply', new.id);
    end if;
  end if;

  if new.repost_of is not null then
    select author_id into target from public.posts where id = new.repost_of;
    if target is not null and target <> new.author_id then
      insert into public.notifications (recipient_id, actor_id, type, post_id)
      values (target, new.author_id, 'repost', new.repost_of);
    end if;
  end if;

  -- @згадки
  for mentioned in
    select distinct p.id
    from regexp_matches(new.content, '@([a-z0-9_]{3,24})', 'g') as m(arr)
    join public.profiles p on p.username = m.arr[1]
    where p.id <> new.author_id
  loop
    insert into public.notifications (recipient_id, actor_id, type, post_id)
    values (mentioned, new.author_id, 'mention', new.id);
  end loop;

  return null;
end $$;

create trigger posts_notify after insert on public.posts
  for each row execute function public.notify_on_post();

create or replace function public.on_message_insert()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  update public.conversations set updated_at = now() where id = new.conversation_id;
  update public.conversation_members set last_read_at = new.created_at
    where conversation_id = new.conversation_id and user_id = new.sender_id;

  insert into public.notifications (recipient_id, actor_id, type, conversation_id)
  select m.user_id, new.sender_id, 'message', new.conversation_id
  from public.conversation_members m
  where m.conversation_id = new.conversation_id and m.user_id <> new.sender_id;
  return null;
end $$;

create trigger messages_after_insert after insert on public.messages
  for each row execute function public.on_message_insert();

-- ── RPC: знайти або створити особистий діалог ───────────────────────
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
    insert into public.conversations (created_by, is_group) values (me, false) returning id into conv;
    insert into public.conversation_members (conversation_id, user_id)
    values (conv, other_user) on conflict do nothing;
  end if;
  return conv;
end $$;

-- ════════════════════════════════════════════════════════════════════
--  Представлення для стрічки (security_invoker → діє RLS читача)
-- ════════════════════════════════════════════════════════════════════
create view public.feed_posts
with (security_invoker = true) as
select
  p.*,
  pr.username      as author_username,
  pr.display_name  as author_display_name,
  pr.avatar_url    as author_avatar_url,
  exists (select 1 from public.likes l where l.post_id = p.id and l.user_id = auth.uid()) as viewer_has_liked,
  exists (select 1 from public.posts r where r.repost_of = p.id and r.author_id = auth.uid()) as viewer_has_reposted
from public.posts p
join public.profiles pr on pr.id = p.author_id;

-- ════════════════════════════════════════════════════════════════════
--  Row Level Security
-- ════════════════════════════════════════════════════════════════════
alter table public.profiles             enable row level security;
alter table public.communities          enable row level security;
alter table public.community_members    enable row level security;
alter table public.posts                enable row level security;
alter table public.likes                enable row level security;
alter table public.poll_votes           enable row level security;
alter table public.follows              enable row level security;
alter table public.conversations        enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages             enable row level security;
alter table public.notifications        enable row level security;

-- profiles
create policy profiles_select_all      on public.profiles for select using (true);
create policy profiles_insert_own     on public.profiles for insert to authenticated with check (id = auth.uid());
create policy profiles_update_own      on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- communities
create policy communities_select_visible on public.communities for select
  using (not is_private or public.is_community_member(id));
create policy communities_insert_owner on public.communities for insert to authenticated
  with check (owner_id = auth.uid());
create policy communities_update_admins    on public.communities for update to authenticated
  using (public.community_role_of(id) in ('owner', 'admin'))
  with check (public.community_role_of(id) in ('owner', 'admin'));
create policy communities_delete_owner            on public.communities for delete to authenticated
  using (owner_id = auth.uid());

-- community_members
create policy members_select_visible on public.community_members for select
  using (public.can_view_community(community_id));
create policy members_join_public   on public.community_members for insert to authenticated
  with check (
    user_id = auth.uid() and role = 'member'
    and exists (select 1 from public.communities c where c.id = community_id and not c.is_private)
  );
create policy members_add_by_admins on public.community_members for insert to authenticated
  with check (public.community_role_of(community_id) in ('owner', 'admin') and role in ('member', 'mod'));
create policy members_update_role_admins    on public.community_members for update to authenticated
  using (public.community_role_of(community_id) in ('owner', 'admin') and role <> 'owner')
  with check (
    role <> 'owner'
    and (public.community_role_of(community_id) = 'owner' or role in ('member', 'mod'))
  );
create policy members_leave_or_kick     on public.community_members for delete to authenticated
  using (
    (user_id = auth.uid() and role <> 'owner')
    or (role <> 'owner' and public.community_role_of(community_id) in ('owner', 'admin', 'mod'))
  );

-- posts
create policy posts_select_visible on public.posts for select
  using (community_id is null or public.can_view_community(community_id));
create policy posts_insert_author                  on public.posts for insert to authenticated
  with check (
    author_id = auth.uid()
    and (community_id is null or public.is_community_member(community_id))
    and like_count = 0 and reply_count = 0 and repost_count = 0
  );
create policy posts_update_author                  on public.posts for update to authenticated
  using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy posts_delete_author_or_mod    on public.posts for delete to authenticated
  using (
    author_id = auth.uid()
    or (community_id is not null and public.community_role_of(community_id) in ('owner', 'admin', 'mod'))
  );

-- likes
create policy likes_select        on public.likes for select using (public.can_view_post(post_id));
create policy likes_insert_own      on public.likes for insert to authenticated
  with check (user_id = auth.uid() and public.can_view_post(post_id));
create policy likes_delete_own     on public.likes for delete to authenticated using (user_id = auth.uid());

-- poll_votes
create policy poll_votes_select   on public.poll_votes for select using (public.can_view_post(post_id));
create policy poll_votes_insert_own on public.poll_votes for insert to authenticated
  with check (user_id = auth.uid() and public.can_view_post(post_id));
create policy poll_votes_delete_own on public.poll_votes for delete to authenticated using (user_id = auth.uid());

-- follows
create policy follows_select_all      on public.follows for select using (true);
create policy follows_insert_own  on public.follows for insert to authenticated with check (follower_id = auth.uid());
create policy follows_delete_own  on public.follows for delete to authenticated using (follower_id = auth.uid());

-- conversations
create policy conversations_select_members on public.conversations for select to authenticated
  using (created_by = auth.uid() or public.is_conversation_member(id));
create policy conversations_insert_creator        on public.conversations for insert to authenticated
  with check (created_by = auth.uid());
create policy conversations_update_members   on public.conversations for update to authenticated
  using (public.is_conversation_member(id)) with check (public.is_conversation_member(id));

-- conversation_members
create policy conv_members_select  on public.conversation_members for select to authenticated
  using (public.is_conversation_member(conversation_id));
create policy conv_members_insert_by_creator    on public.conversation_members for insert to authenticated
  with check (
    exists (select 1 from public.conversations c
            where c.id = conversation_id and c.created_by = auth.uid())
  );
create policy conv_members_update_own on public.conversation_members for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy conv_members_leave            on public.conversation_members for delete to authenticated
  using (user_id = auth.uid());

-- messages
create policy messages_select_members     on public.messages for select to authenticated
  using (public.is_conversation_member(conversation_id));
create policy messages_insert_member      on public.messages for insert to authenticated
  with check (sender_id = auth.uid() and public.is_conversation_member(conversation_id));
create policy messages_update_own      on public.messages for update to authenticated
  using (sender_id = auth.uid()) with check (sender_id = auth.uid());
create policy messages_delete_own        on public.messages for delete to authenticated
  using (sender_id = auth.uid());

-- notifications (створюються лише тригерами)
create policy notifications_select_own            on public.notifications for select to authenticated
  using (recipient_id = auth.uid());
create policy notifications_mark_read on public.notifications for update to authenticated
  using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());
create policy notifications_delete_own   on public.notifications for delete to authenticated
  using (recipient_id = auth.uid());

-- ── Привілеї на рівні колонок: лічильники змінюють лише тригери ─────
revoke update on public.profiles from anon, authenticated;
grant  update (username, display_name, avatar_url, cover_url, bio, status, location, website)
  on public.profiles to authenticated;

revoke update on public.posts from anon, authenticated;
grant  update (content, media) on public.posts to authenticated;

revoke update on public.communities from anon, authenticated;
grant  update (name, description, avatar_url, cover_url, is_private) on public.communities to authenticated;

revoke update on public.community_members from anon, authenticated;
grant  update (role) on public.community_members to authenticated;

revoke update on public.conversation_members from anon, authenticated;
grant  update (last_read_at) on public.conversation_members to authenticated;

revoke update on public.messages from anon, authenticated;
grant  update (content, edited_at) on public.messages to authenticated;

revoke update on public.notifications from anon, authenticated;
grant  update (read_at) on public.notifications to authenticated;

revoke update on public.conversations from anon, authenticated;
grant  update (title) on public.conversations to authenticated;

revoke execute on function public.start_direct_conversation(uuid) from public, anon;
grant  execute on function public.start_direct_conversation(uuid) to authenticated;

-- ════════════════════════════════════════════════════════════════════
--  Realtime: повідомлення, сповіщення, нові дописи
-- ════════════════════════════════════════════════════════════════════
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.messages, public.notifications, public.posts;
  end if;
end $$;

-- ════════════════════════════════════════════════════════════════════
--  Storage: avatars, covers, post-media
--  Шлях файлу: <bucket>/<user_id>/<ім'я файлу>
-- ════════════════════════════════════════════════════════════════════
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars',    'avatars',    true, 2097152,  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']),
  ('covers',     'covers',     true, 5242880,  array['image/png', 'image/jpeg', 'image/webp']),
  ('post-media', 'post-media', true, 10485760, array['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
on conflict (id) do nothing;

create policy lumyn_media_public_read on storage.objects for select
  using (bucket_id in ('avatars', 'covers', 'post-media'));

create policy lumyn_media_insert_own_folder on storage.objects for insert to authenticated
  with check (
    bucket_id in ('avatars', 'covers', 'post-media')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy lumyn_media_update_own on storage.objects for update to authenticated
  using (
    bucket_id in ('avatars', 'covers', 'post-media')
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id in ('avatars', 'covers', 'post-media')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy lumyn_media_delete_own on storage.objects for delete to authenticated
  using (
    bucket_id in ('avatars', 'covers', 'post-media')
    and (storage.foldername(name))[1] = auth.uid()::text
  );
