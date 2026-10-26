-- 0024: взаємодії зі сторіс — «світло», реакції та перегляди для автора.
-- Ідемпотентно: можна запускати повторно.

create table if not exists public.story_lights (
  story_id   uuid not null references public.stories (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (story_id, user_id)
);

create table if not exists public.story_reactions (
  story_id   uuid not null references public.stories (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  emoji      text not null check (char_length(emoji) between 1 and 16),
  created_at timestamptz not null default now(),
  primary key (story_id, user_id)
);

alter table public.story_lights enable row level security;
alter table public.story_reactions enable row level security;

-- ── світло ────────────────────────────────────────────────────────────
drop policy if exists story_lights_select_visible on public.story_lights;
create policy story_lights_select_visible on public.story_lights for select to authenticated
  using (public.can_view_story(story_id));

drop policy if exists story_lights_insert_own on public.story_lights;
create policy story_lights_insert_own on public.story_lights for insert to authenticated
  with check (user_id = auth.uid() and public.can_view_story(story_id));

drop policy if exists story_lights_delete_own on public.story_lights;
create policy story_lights_delete_own on public.story_lights for delete to authenticated
  using (user_id = auth.uid());

-- ── реакції (одна на користувача, можна змінити) ─────────────────────
drop policy if exists story_reactions_select_visible on public.story_reactions;
create policy story_reactions_select_visible on public.story_reactions for select to authenticated
  using (public.can_view_story(story_id));

drop policy if exists story_reactions_insert_own on public.story_reactions;
create policy story_reactions_insert_own on public.story_reactions for insert to authenticated
  with check (user_id = auth.uid() and public.can_view_story(story_id));

drop policy if exists story_reactions_update_own on public.story_reactions;
create policy story_reactions_update_own on public.story_reactions for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.can_view_story(story_id));

drop policy if exists story_reactions_delete_own on public.story_reactions;
create policy story_reactions_delete_own on public.story_reactions for delete to authenticated
  using (user_id = auth.uid());

-- ── автор бачить усі перегляди своїх сторіс ───────────────────────────
drop policy if exists story_views_author on public.story_views;
create policy story_views_author on public.story_views for select to authenticated
  using (exists (select 1 from public.stories s where s.id = story_id and s.author_id = auth.uid()));

grant select, insert, delete on public.story_lights to authenticated;
grant select, insert, update, delete on public.story_reactions to authenticated;
