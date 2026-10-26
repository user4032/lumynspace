-- apply-pending.sql: вставити в Supabase → SQL Editor і натиснути Run (= міграції 0005 + 0006, ідемпотентно)
-- Ідемпотентно: можна запускати повторно.

alter table public.profiles
  add column if not exists hide_following boolean not null default false;
grant update (hide_following) on public.profiles to authenticated;

-- Хто кого читає: якщо follower приховав свій список, чужі бачать рядок лише якщо вони — одна зі сторін.
create or replace function public.follow_list_visible(p_follower uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select not coalesce((select p.hide_following from public.profiles p where p.id = p_follower), false)
$$;
revoke execute on function public.follow_list_visible(uuid) from public;
grant execute on function public.follow_list_visible(uuid) to anon, authenticated;

drop policy if exists follows_select_all on public.follows;
drop policy if exists follows_select_visible on public.follows;
create policy follows_select_visible on public.follows for select
  using (
    follower_id = auth.uid()
    or following_id = auth.uid()
    or (status = 'accepted' and public.follow_list_visible(follower_id))
  );

-- Видалення акаунта: відв'язуємо файли Storage (старі проєкти мають FK owner → auth.users), потім каскад.
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = ''
as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'not authenticated'; end if;
  begin
    update storage.objects set owner = null where owner = me;
  exception when others then null;
  end;
  delete from public.profiles where id = me;
  delete from auth.users where id = me;
end $$;
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
