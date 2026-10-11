-- Тести міграції 0004: Storage, Realtime, запити в приватні спільноти,
-- тренди хештегів, прочитання розмови, видалення акаунта.
\set ON_ERROR_STOP on
\set QUIET on
set client_min_messages = notice;

create or replace function public._t(cond boolean, msg text) returns void language plpgsql as $$
begin
  if cond is distinct from true then raise exception 'FAIL: %', msg; end if;
  raise notice 'OK: %', msg;
end $$;
grant execute on function public._t(boolean, text) to anon, authenticated;
create or replace function public._t_fails(sql text, msg text) returns void language plpgsql as $$
begin
  begin execute sql; exception when others then raise notice 'OK: % (%)', msg, sqlerrm; return; end;
  raise exception 'FAIL: % — запит мав впасти: %', msg, sql;
end $$;
grant execute on function public._t_fails(text, text) to anon, authenticated;

-- O — власниця спільноти, R — хоче вступити, X — стороння, D — видалить акаунт
insert into auth.users (id, email, raw_user_meta_data) values
 ('c0000000-0000-0000-0000-00000000000a', 'olha4@example.com',  '{"user_name":"olha4"}'),
 ('c0000000-0000-0000-0000-00000000000b', 'roman4@example.com', '{"user_name":"roman4"}'),
 ('c0000000-0000-0000-0000-00000000000c', 'xenia4@example.com', '{"user_name":"xenia4"}'),
 ('c0000000-0000-0000-0000-00000000000d', 'dmytro4@example.com','{"user_name":"dmytro4"}');

-- ── Storage ─────────────────────────────────────────────────────────
select public._t((select count(*) = 4 from storage.buckets where id in ('avatars', 'covers', 'post-media', 'community-media') and public), 'чотири публічні бакети');
select public._t((select file_size_limit = 5242880 from storage.buckets where id = 'avatars'), 'ліміт розміру аватарів оновлено');

set role authenticated;
select set_config('request.jwt.claim.sub', 'c0000000-0000-0000-0000-00000000000a', false);
insert into storage.objects (bucket_id, name, owner) values ('avatars', 'c0000000-0000-0000-0000-00000000000a/a.png', auth.uid());
select public._t(true, 'завантаження у власну теку');
select public._t_fails($$insert into storage.objects (bucket_id, name) values ('avatars', 'c0000000-0000-0000-0000-00000000000b/x.png')$$, 'чужа тека заборонена');
select public._t_fails($$insert into storage.objects (bucket_id, name) values ('avatars', 'x.png')$$, 'файл поза текою заборонено');
select public._t_fails($$insert into storage.objects (bucket_id, name) values ('other', 'c0000000-0000-0000-0000-00000000000a/x.png')$$, 'інші бакети не чіпаємо');
select set_config('request.jwt.claim.sub', 'c0000000-0000-0000-0000-00000000000b', false);
select public._t((select count(*) = 0 from storage.objects where bucket_id = 'avatars'), 'чужі файли не перелічуються');
delete from storage.objects where name like 'c0000000-0000-0000-0000-00000000000a/%';
reset role;
select public._t((select count(*) = 1 from storage.objects where name = 'c0000000-0000-0000-0000-00000000000a/a.png'), 'чужий файл не видалити');

-- ── Realtime ────────────────────────────────────────────────────────
select public._t((select count(*) = 3 from pg_publication_tables where pubname = 'supabase_realtime'
                  and schemaname = 'public' and tablename in ('messages', 'notifications', 'conversation_members')), 'messages/notifications у публікації Realtime');

-- ── Приватна спільнота й запити ─────────────────────────────────────
set role authenticated;
select set_config('request.jwt.claim.sub', 'c0000000-0000-0000-0000-00000000000a', false);
insert into public.communities (slug, name, description, is_private, owner_id)
values ('secret-club', 'Таємний клуб', 'опис', true, auth.uid());
select id as cid from public.communities where slug = 'secret-club' \gset
select public._t((select role = 'owner' from public.community_members where community_id = :'cid' and user_id = auth.uid()), 'творець — owner');
insert into public.posts (author_id, community_id, content) values (auth.uid(), :'cid', 'для своїх #Клуб');

select set_config('request.jwt.claim.sub', 'c0000000-0000-0000-0000-00000000000b', false);
select public._t((select count(*) = 1 from public.communities where slug = 'secret-club'), 'приватну спільноту видно в списку');
select public._t((select count(*) = 0 from public.posts where community_id = :'cid'), 'дописи приватної спільноти закриті');
select public._t((select count(*) = 0 from public.community_members where community_id = :'cid'), 'учасники приватної спільноти закриті');
select public._t_fails(format($$insert into public.community_members (community_id, user_id) values (%L, auth.uid())$$, :'cid'), 'вступити напряму не можна');
insert into public.community_join_requests (community_id) values (:'cid');
select public._t((select count(*) = 1 from public.community_join_requests where community_id = :'cid'), 'свій запит видно');
select public._t_fails(format($$select public.respond_join_request(%L, auth.uid(), true)$$, :'cid'), 'сам себе не схвалиш');

select set_config('request.jwt.claim.sub', 'c0000000-0000-0000-0000-00000000000c', false);
select public._t((select count(*) = 0 from public.community_join_requests), 'чужі запити не видно');

select set_config('request.jwt.claim.sub', 'c0000000-0000-0000-0000-00000000000a', false);
select public._t((select count(*) = 1 from public.community_join_requests where community_id = :'cid'), 'власниця бачить запит');
select public.respond_join_request(:'cid', 'c0000000-0000-0000-0000-00000000000b', true);
select public._t((select count(*) = 0 from public.community_join_requests where community_id = :'cid'), 'запит прибрано після схвалення');
select public._t((select member_count = 2 from public.communities where id = :'cid'), 'лічильник учасників +1');

select set_config('request.jwt.claim.sub', 'c0000000-0000-0000-0000-00000000000b', false);
select public._t((select count(*) = 1 from public.posts where community_id = :'cid'), 'після схвалення дописи видно');
select public._t_fails(format($$insert into public.community_join_requests (community_id) values (%L)$$, :'cid'), 'учасник не надсилає запит');
update public.community_members set role = 'admin' where community_id = :'cid' and user_id = auth.uid();
select public._t((select role = 'member' from public.community_members where community_id = :'cid' and user_id = auth.uid()), 'учасник не підвищує себе');

select set_config('request.jwt.claim.sub', 'c0000000-0000-0000-0000-00000000000a', false);
update public.community_members set role = 'admin' where community_id = :'cid' and user_id = 'c0000000-0000-0000-0000-00000000000b';
select public._t((select role = 'admin' from public.community_members where community_id = :'cid' and user_id = 'c0000000-0000-0000-0000-00000000000b'), 'власниця призначає адміна');

-- ── Тренди ──────────────────────────────────────────────────────────
insert into public.posts (author_id, content) values (auth.uid(), 'Привіт #Київ і #nextjs'), (auth.uid(), 'ще раз #київ');
select public._t((select posts = 2 from public.trending_hashtags(7, 10) where tag = 'київ'), 'тренд #київ (кирилиця, без регістру) = 2');
select public._t((select count(*) = 1 from public.trending_hashtags(7, 10) where tag = 'клуб'), 'тренд із приватної спільноти бачить учасниця');
select set_config('request.jwt.claim.sub', 'c0000000-0000-0000-0000-00000000000c', false);
select public._t((select count(*) = 0 from public.trending_hashtags(7, 10) where tag = 'клуб'), 'стороння не бачить тегів із закритих дописів');
reset role;
set role anon;
select set_config('request.jwt.claim.sub', '', false);
select public._t((select count(*) >= 1 from public.trending_hashtags()), 'тренди доступні аноніму (лише публічне)');
select public._t_fails($$select public.delete_my_account()$$, 'анонім не викликає delete_my_account');
reset role;

-- ── Прочитання розмови ──────────────────────────────────────────────
set role authenticated;
select set_config('request.jwt.claim.sub', 'c0000000-0000-0000-0000-00000000000a', false);
select public.start_direct_conversation('c0000000-0000-0000-0000-00000000000c') as conv \gset
insert into public.messages (conversation_id, sender_id, content) values (:'conv', auth.uid(), 'привіт');
select set_config('request.jwt.claim.sub', 'c0000000-0000-0000-0000-00000000000c', false);
select public._t((select count(*) = 1 from public.notifications where type = 'message' and read_at is null), 'сповіщення про повідомлення');
select public.mark_conversation_read(:'conv');
select public._t((select count(*) = 0 from public.notifications where type = 'message' and read_at is null), 'прочитав розмову → сповіщення прочитані');

-- ── Видалення акаунта ───────────────────────────────────────────────
select set_config('request.jwt.claim.sub', 'c0000000-0000-0000-0000-00000000000d', false);
insert into public.posts (author_id, content) values (auth.uid(), 'бувайте');
select public.delete_my_account();
reset role;
select public._t((select count(*) = 0 from auth.users where id = 'c0000000-0000-0000-0000-00000000000d'), 'auth-користувача видалено');
select public._t((select count(*) = 0 from public.posts where author_id = 'c0000000-0000-0000-0000-00000000000d'), 'дописи видалено каскадом');
select public._t((select count(*) = 1 from auth.users where id = 'c0000000-0000-0000-0000-00000000000c'), 'інших не зачеплено');

select public._t((select count(*) = 0 from pg_tables where schemaname = 'public' and not rowsecurity), 'RLS увімкнено на всіх таблицях public');
\echo '✓ 0004: усі перевірки пройшли'
