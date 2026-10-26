-- 0025: приватність спільнот — видимий список учасників і гільдія під дописом.
-- Ідемпотентно: можна запускати повторно.

alter table public.communities
  add column if not exists members_visible boolean not null default true;

drop policy if exists members_select_visible on public.community_members;
create policy members_select_visible on public.community_members for select
  using (
    user_id = auth.uid()
    or public.community_role_of(community_id) in ('owner', 'admin', 'mod')
    or exists (
      select 1
      from public.communities c
      where c.id = community_id
        and (not c.is_private or c.members_visible)
    )
  );

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
  c.slug              as community_slug,
  c.name              as community_name,
  exists (select 1 from public.lights l where l.post_id = p.id and l.user_id = auth.uid()) as viewer_has_lit,
  exists (select 1 from public.posts r where r.repost_of = p.id and r.author_id = auth.uid()) as viewer_has_reposted
from public.posts p
join public.profiles pr on pr.id = p.author_id
left join public.communities c on c.id = p.community_id;

grant select on public.feed_posts to authenticated, anon;

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
