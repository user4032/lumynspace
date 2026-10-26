-- 0012: Web Push (VAPID). Надсилає app-сервер (web-push), Supabase лише зберігає підписки.
-- Ідемпотентно: можна запускати повторно.

create table if not exists public.push_subscriptions (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  endpoint   text primary key,
  p256dh     text not null,
  auth       text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

-- власник бачить/пише/видаляє лише свої підписки
drop policy if exists push_own on public.push_subscriptions;
create policy push_own on public.push_subscriptions for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- серверні дії читають підписки ОДЕРЖУВАЧА (інший користувач) → security definer
create or replace function public.push_endpoints_for(p_user uuid)
returns jsonb language sql stable security definer set search_path = ''
as $$
  select coalesce(
    jsonb_agg(jsonb_build_object('endpoint', endpoint, 'p256dh', p256dh, 'auth', auth) order by created_at),
    '[]'::jsonb
  )
  from public.push_subscriptions where user_id = p_user
$$;
revoke execute on function public.push_endpoints_for(uuid) from public;
grant execute on function public.push_endpoints_for(uuid) to authenticated;

-- прибрати «мертву» підписку (410/404 від push-сервісу)
create or replace function public.push_remove_endpoint(p_endpoint text)
returns void language sql security definer set search_path = ''
as $$ delete from public.push_subscriptions where endpoint = p_endpoint $$;
revoke execute on function public.push_remove_endpoint(text) from public;
grant execute on function public.push_remove_endpoint(text) to authenticated;

-- Аналітика автора: перегляди/світла/читачі за 7 днів + топ-дописи.
-- security definer бо post_views закрита RLS (читається лише через RPC).
create or replace function public.author_stats()
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare me uuid := auth.uid(); r jsonb;
begin
  if me is null then return null; end if;
  select jsonb_build_object(
    'views7d', (select count(*) from public.post_views v join public.posts p on p.id = v.post_id
                where p.author_id = me and v.viewed_at > now() - interval '7 days'),
    'lights7d', (select count(*) from public.lights l join public.posts p on p.id = l.post_id
                 where p.author_id = me and l.created_at > now() - interval '7 days'),
    'followers7d', (select count(*) from public.follows
                    where following_id = me and created_at > now() - interval '7 days'),
    'totalViews', (select coalesce(sum(view_count), 0) from public.posts where author_id = me),
    'topPosts', (select coalesce(jsonb_agg(jsonb_build_object(
                   'id', t.id, 'excerpt', left(t.content, 120),
                   'views', t.view_count, 'lights', t.light_count, 'replies', t.reply_count)
                   order by t.view_count desc), '[]'::jsonb)
                 from (select id, content, view_count, light_count, reply_count from public.posts
                       where author_id = me and reply_to is null
                       order by view_count desc limit 5) t)
  ) into r;
  return r;
end $$;
revoke execute on function public.author_stats() from public;
grant execute on function public.author_stats() to authenticated;
