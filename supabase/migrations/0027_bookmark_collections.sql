-- 0027: Колекції закладок (папки)
-- Ідемпотентно.

create table if not exists public.bookmark_collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, name)
);

create table if not exists public.bookmark_collection_items (
  collection_id uuid not null references public.bookmark_collections(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key(collection_id, post_id)
);

alter table public.bookmarks add column if not exists collection_id uuid references public.bookmark_collections(id) on delete set null;

alter table public.bookmark_collections enable row level security;
alter table public.bookmark_collection_items enable row level security;
alter table public.bookmarks enable row level security;

drop policy if exists bookmark_collections_own on public.bookmark_collections;
create policy bookmark_collections_own on public.bookmark_collections
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists bookmark_collection_items_own on public.bookmark_collection_items;
create policy bookmark_collection_items_own on public.bookmark_collection_items
  for all to authenticated
  using (exists (select 1 from public.bookmark_collections c where c.id = collection_id and c.user_id = auth.uid()))
  with check (exists (select 1 from public.bookmark_collections c where c.id = collection_id and c.user_id = auth.uid()));

drop policy if exists bookmarks_own on public.bookmarks;
create policy bookmarks_own on public.bookmarks
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select, insert, update, delete on public.bookmark_collections to authenticated;
grant select, insert, delete on public.bookmark_collection_items to authenticated;
