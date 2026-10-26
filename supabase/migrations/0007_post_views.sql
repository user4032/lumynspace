-- 0007: справжні перегляди дописів (1 перегляд на користувача) + ідемпотентне «світло»
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
