-- 0015: сторіс — фото/відео-мітки на 24 год, видимість як у дописів (усі/близькі/кола)
-- Ідемпотентно: можна запускати повторно.

create table if not exists public.stories (
  id           uuid primary key default gen_random_uuid(),
  author_id    uuid not null references public.profiles (id) on delete cascade,
  media_url    text not null,
  mime         text not null default 'image/jpeg',
  duration_sec integer not null default 5 check (duration_sec between 3 and 60),
  caption      text check (char_length(caption) <= 200),
  audience     public.post_audience not null default 'public',
  circle_id    uuid references public.circles (id) on delete cascade,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null default now() + interval '24 hours'
);

create index if not exists stories_author_active_idx on public.stories (author_id, expires_at desc);

-- чи видно мені цю сторіс (security definer, щоб не рекурсивило в RLS)
create or replace function public.can_view_story(sid uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.stories s
    where s.id = sid
      and not public.is_blocked_between(s.author_id, auth.uid())
      and (
        s.author_id = auth.uid()
        or (
          s.expires_at > now()
          and case
            when s.audience = 'close_friends' then exists (
              select 1 from public.close_friends cf
              where cf.owner_id = s.author_id and cf.friend_id = auth.uid()
            )
            when s.audience = 'circle' then exists (
              select 1 from public.circle_members cm
              where cm.circle_id = s.circle_id and cm.user_id = auth.uid()
            )
            else (
              not coalesce((select p.is_private from public.profiles p where p.id = s.author_id), false)
              or public.is_accepted_follower(auth.uid(), s.author_id)
            )
          end
        )
      )
  )
$$;
revoke execute on function public.can_view_story(uuid) from public;
grant execute on function public.can_view_story(uuid) to authenticated;

alter table public.stories enable row level security;

drop policy if exists stories_select_visible on public.stories;
create policy stories_select_visible on public.stories for select
  using (public.can_view_story(id));

drop policy if exists stories_insert_own on public.stories;
create policy stories_insert_own on public.stories for insert to authenticated
  with check (author_id = auth.uid() and audience in ('public', 'close_friends', 'circle'));

drop policy if exists stories_delete_own on public.stories;
create policy stories_delete_own on public.stories for delete to authenticated
  using (author_id = auth.uid());

-- хто переглянув (для сірих кіл «переглянуто»)
create table if not exists public.story_views (
  story_id  uuid not null references public.stories (id) on delete cascade,
  viewer_id uuid not null references public.profiles (id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (story_id, viewer_id)
);
alter table public.story_views enable row level security;

drop policy if exists story_views_own on public.story_views;
create policy story_views_own on public.story_views for all to authenticated
  using (viewer_id = auth.uid())
  with check (viewer_id = auth.uid());

grant select, insert, delete on public.stories to authenticated;
grant select, insert on public.story_views to authenticated;
