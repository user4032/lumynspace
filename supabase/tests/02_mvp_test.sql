-- Тести міграції 0002 (MVP): Glow/світло, аудиторія, приватність, неповнолітні,
-- блоки/мюти, інвайти, бронювання ніків, DM-політика, ранжування, скарги.
-- Кожна перевірка або друкує «OK: …», або падає з «FAIL: …».
\set ON_ERROR_STOP on
\set QUIET on
set client_min_messages = notice;

create or replace function public._t(cond boolean, msg text) returns void language plpgsql as $$
begin
  if cond is distinct from true then raise exception 'FAIL: %', msg; end if;
  raise notice 'OK: %', msg;
end $$;
grant execute on function public._t(boolean, text) to anon, authenticated;

-- Дає змогу перевірити «очікувану помилку» з-під будь-якої ролі
create or replace function public._t_fails(sql text, msg text) returns void language plpgsql as $$
begin
  begin
    execute sql;
  exception when others then
    raise notice 'OK: % (%)', msg, sqlerrm;
    return;
  end;
  raise exception 'FAIL: % — запит мав впасти: %', msg, sql;
end $$;
grant execute on function public._t_fails(text, text) to anon, authenticated;

-- ── Користувачі ─────────────────────────────────────────────────────
-- A — автор, B — близький друг A, C — сторонній, M — неповнолітня, K — блокує A, N — новачок
insert into auth.users (id, email, raw_user_meta_data) values
 ('a0000000-0000-0000-0000-00000000000a', 'anna@example.com',  '{"user_name":"anna"}'),
 ('a0000000-0000-0000-0000-00000000000b', 'bohdan@example.com','{"user_name":"bohdan"}'),
 ('a0000000-0000-0000-0000-00000000000c', 'cyril@example.com', '{"user_name":"cyril"}'),
 ('a0000000-0000-0000-0000-00000000000d', 'mila@example.com',  '{"user_name":"mila"}'),
 ('a0000000-0000-0000-0000-00000000000e', 'kost@example.com',  '{"user_name":"kost"}'),
 ('a0000000-0000-0000-0000-00000000000f', 'nova@example.com',  '{"user_name":"nova"}');
-- 30 «ліхтариків» для перевірки порогу постійності
insert into auth.users (id, email)
select ('b0000000-0000-0000-0000-' || lpad(g::text, 12, '0'))::uuid, 'l' || g || '@example.com'
from generate_series(1, 30) g;
-- «досвідчені» автори: інакше всі нові й отримують причину new_author
update public.profiles set created_at = now() - interval '90 days', posts_count = 50
 where id::text like 'a0000000%';

set role authenticated;

-- ════════ 1. Неповнолітні та рік народження ════════
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-00000000000d', false);
update public.profiles set birth_year = extract(year from now())::int - 16 where id = auth.uid();
select public._t((select is_private and dm_policy = 'followers' from public.profiles where id = auth.uid()),
  'неповнолітня (16): приватний акаунт і DM лише від читачів за замовчуванням');
update public.profiles set dm_policy = 'everyone' where id = auth.uid();
select public._t((select dm_policy = 'followers' from public.profiles where id = auth.uid()),
  'неповнолітня не може відкрити DM для всіх');
select public._t_fails($$update public.profiles set birth_year = 1990 where id = auth.uid()$$,
  'рік народження змінити не можна');
insert into public.posts (id, author_id, content) values ('c0000000-0000-0000-0000-0000000000d1', auth.uid(), 'пост Міли');

select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-00000000000a', false);
update public.profiles set birth_year = 2000 where id = auth.uid();
select public._t((select not is_private and dm_policy = 'everyone' from public.profiles where id = auth.uid()),
  'дорослий: публічний акаунт за замовчуванням');
select public._t_fails($$update public.profiles set username = 'hacker' where id = auth.uid()$$,
  'нік не змінюється напряму (лише через онбординг)');
select public._t_fails($$update public.profiles set followers_count = 1000000 where id = auth.uid()$$,
  'лічильники профілю захищені');

-- ════════ 2. Інвайти ════════
select public.create_invite() from generate_series(1, 5);
select public._t((select count(*) = 5 from public.invites where inviter_id = auth.uid()), 'створено 5 інвайтів');
select public._t_fails($$select public.create_invite()$$, '6-й інвайт заблоковано лімітом');
select public._t_fails($$insert into public.invites (code, inviter_id) values ('ZZZZ-ZZZZ', auth.uid())$$,
  'ліміт діє і для прямого insert');
select code as invite_a from public.invites where inviter_id = auth.uid() order by code limit 1 \gset
select code as invite_b from public.invites where inviter_id = auth.uid() order by code offset 1 limit 1 \gset

select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-00000000000c', false);
select public._t((select count(*) = 0 from public.invites), 'чужі інвайти не видно');

-- ════════ 3. Бронювання ніків (вейтліст) ════════
reset role; set role anon;
select set_config('request.jwt.claim.sub', '', false);
select public._t(public.is_handle_available('coolname'), 'нік coolname вільний');
select public._t(public.reserve_handle('CoolName', 'Res@Example.com'), 'анонім бронює нік');
select public._t(not public.reserve_handle('coolname', 'other@example.com'), 'повторна бронь того ж ніка — ні');
select public._t(not public.reserve_handle('another', 'res@example.com'), 'одна бронь на пошту');
select public._t(not public.is_handle_available('coolname'), 'заброньований нік зайнятий');
select public._t(not public.is_handle_available('anna'), 'нік існуючого профілю зайнятий');
select public._t_fails($$select * from public.reserved_handles$$, 'пошти з вейтліста не читаються');
select public._t_fails($$select public.create_invite()$$, 'анонім не створює інвайти');
reset role; set role authenticated;

-- ════════ 4. Онбординг ════════
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-00000000000f', false);
select public._t_fails($$select public.complete_onboarding('nova_x', 2000::smallint, null, null)$$, 'без інвайту — не можна (invite_only)');
select public._t_fails(format($$select public.complete_onboarding('nova_x', %s::smallint, %L, null)$$,
  extract(year from now())::int - 14, :'invite_a'), 'молодше 16 — не можна');
select public._t_fails(format($$select public.complete_onboarding('coolname', 2000::smallint, %L, null)$$, :'invite_a'),
  'чужий заброньований нік не забрати');
select public._t_fails($$select public.complete_onboarding('nova_x', 2000::smallint, 'AAAA-AAAA', null)$$, 'неіснуючий інвайт');
select public.complete_onboarding('nova_x', 2004::smallint, :'invite_a', '#ff3d81');
select public._t((select username = 'nova_x' and accent_color = '#ff3d81' and onboarded_at is not null
                    and invited_by = 'a0000000-0000-0000-0000-00000000000a'
                  from public.profiles where id = auth.uid()), 'онбординг: нік, акцент, хто запросив');
select public._t_fails($$select public.complete_onboarding('nova_y', 2004::smallint, null, null)$$, 'повторний онбординг заборонено');

select set_config('request.jwt.claim.sub', 'b0000000-0000-0000-0000-000000000001', false);
select public._t_fails(format($$select public.complete_onboarding('lamp_one', 2000::smallint, %L, null)$$, :'invite_a'),
  'використаний інвайт удруге не працює');

select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-00000000000a', false);
select public._t((select count(*) = 1 from public.notifications where type = 'friend_joined'),
  'сповіщення «друг приєднався»');
select public._t(public.is_accepted_follower('a0000000-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-00000000000f')
             and public.is_accepted_follower('a0000000-0000-0000-0000-00000000000f', 'a0000000-0000-0000-0000-00000000000a'),
  'запрошувач і новачок читають одне одного');

-- ════════ 5. Glow і світло ════════
insert into public.posts (id, author_id, content, mode, expires_at, light_count)
values ('c0000000-0000-0000-0000-0000000000a1', auth.uid(), 'Glow-допис', 'glow', now() + interval '999 days', 999);
select public._t((select light_count = 0 and abs(extract(epoch from expires_at - (now() + interval '24 hours'))) < 5
                  from public.posts where id = 'c0000000-0000-0000-0000-0000000000a1'),
  'Glow: клієнт не задає термін і лічильник (24 год, 0 світла)');
select public._t_fails($$insert into public.posts (author_id, content, mode, reply_to)
  values (auth.uid(), 'x', 'glow', 'c0000000-0000-0000-0000-0000000000a1')$$, 'відповідь не може бути Glow');
select public._t_fails($$update public.posts set expires_at = now() + interval '30 days' where id = 'c0000000-0000-0000-0000-0000000000a1'$$,
  'автор не продовжує Glow вручну');

select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-00000000000b', false);
insert into public.lights (user_id, post_id) values (auth.uid(), 'c0000000-0000-0000-0000-0000000000a1');
select public._t((select light_count = 1 and expires_at = created_at + interval '25 hours'
                  from public.posts where id = 'c0000000-0000-0000-0000-0000000000a1'), 'світло: +1 год (25 год)');
delete from public.lights where user_id = auth.uid() and post_id = 'c0000000-0000-0000-0000-0000000000a1';
select public._t((select light_count = 0 and expires_at = created_at + interval '24 hours'
                  from public.posts where id = 'c0000000-0000-0000-0000-0000000000a1'), 'прибрали світло: знову 24 год (без накрутки)');
insert into public.lights (user_id, post_id) values (auth.uid(), 'c0000000-0000-0000-0000-0000000000a1');

reset role;
select public._t((select count(*) = 1 from public.notifications n
                  where n.type = 'light' and n.recipient_id = 'a0000000-0000-0000-0000-00000000000a'), 'сповіщення про світло (одне, без спаму при повторі)');

-- стеля 72 год (поріг постійності тимчасово піднято, щоб дійти до стелі)
create or replace function public.glow_permanent_at() returns integer language sql stable as $$ select 1000 $$;
update public.posts set light_count = 47 where id = 'c0000000-0000-0000-0000-0000000000a1';
insert into public.lights (user_id, post_id) values ('b0000000-0000-0000-0000-000000000030', 'c0000000-0000-0000-0000-0000000000a1');
select public._t((select light_count = 48 and expires_at = created_at + interval '72 hours'
                  from public.posts where id = 'c0000000-0000-0000-0000-0000000000a1'), '48 світла → рівно 72 год');
insert into public.lights (user_id, post_id) values ('b0000000-0000-0000-0000-000000000029', 'c0000000-0000-0000-0000-0000000000a1');
select public._t((select light_count = 49 and expires_at = created_at + interval '72 hours'
                  from public.posts where id = 'c0000000-0000-0000-0000-0000000000a1'), 'стеля: не більше 72 год від створення');
create or replace function public.glow_permanent_at() returns integer language sql stable as $$ select 25 $$;
delete from public.lights where post_id = 'c0000000-0000-0000-0000-0000000000a1';
update public.posts set mode = 'glow', light_count = 0, expires_at = created_at + interval '24 hours' where id = 'c0000000-0000-0000-0000-0000000000a1';

-- поріг постійності: 25 світла
insert into public.lights (user_id, post_id)
select ('b0000000-0000-0000-0000-' || lpad(g::text, 12, '0'))::uuid, 'c0000000-0000-0000-0000-0000000000a1'
from generate_series(1, 24) g;
select public._t((select mode = 'glow' and light_count = 24 from public.posts where id = 'c0000000-0000-0000-0000-0000000000a1'),
  '24 світла — ще Glow');
insert into public.lights (user_id, post_id) values ('b0000000-0000-0000-0000-000000000025', 'c0000000-0000-0000-0000-0000000000a1');
select public._t((select mode = 'permanent' and expires_at is null and light_count = 25
                  from public.posts where id = 'c0000000-0000-0000-0000-0000000000a1'), '25 світла → допис постійний');
delete from public.lights where user_id = 'b0000000-0000-0000-0000-000000000025';
select public._t((select mode = 'permanent' and expires_at is null from public.posts where id = 'c0000000-0000-0000-0000-0000000000a1'),
  'постійність не відкочується, якщо світло прибрали');

-- згаслий Glow
insert into public.posts (id, author_id, content, mode) values ('c0000000-0000-0000-0000-0000000000a2', 'a0000000-0000-0000-0000-00000000000a', 'згасне', 'glow');
update public.posts set created_at = now() - interval '30 hours', expires_at = now() - interval '1 hour'
 where id = 'c0000000-0000-0000-0000-0000000000a2';
set role authenticated;
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-00000000000c', false);
select public._t((select count(*) = 0 from public.posts where id = 'c0000000-0000-0000-0000-0000000000a2'), 'згаслий Glow прихований від інших');
select public._t_fails($$insert into public.lights (user_id, post_id) values (auth.uid(), 'c0000000-0000-0000-0000-0000000000a2')$$,
  'згаслому не дати світло');
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-00000000000a', false);
select public._t((select count(*) = 1 from public.posts where id = 'c0000000-0000-0000-0000-0000000000a2'), 'автор бачить свій згаслий (архів)');
reset role;
select public._t(public.purge_expired_glow() = 0, 'прибирання: згаслі < 7 днів ще лишаються');
update public.posts set expires_at = now() - interval '8 days' where id = 'c0000000-0000-0000-0000-0000000000a2';
select public._t(public.purge_expired_glow() = 1, 'прибирання: згаслі > 7 днів видаляються');
set role authenticated;

-- ════════ 6. Аудиторія: близькі друзі та кола ════════
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-00000000000a', false);
insert into public.close_friends (owner_id, friend_id) values (auth.uid(), 'a0000000-0000-0000-0000-00000000000b');
insert into public.posts (id, author_id, content, audience) values ('c0000000-0000-0000-0000-0000000000a3', auth.uid(), 'лише для близьких', 'close_friends');
insert into public.circles (id, name) values ('d0000000-0000-0000-0000-000000000001', 'Команда');
insert into public.circle_members (circle_id, user_id) values ('d0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000c');
insert into public.posts (id, author_id, content, audience, circle_id) values ('c0000000-0000-0000-0000-0000000000a4', auth.uid(), 'для кола', 'circle', 'd0000000-0000-0000-0000-000000000001');
select public._t_fails($$insert into public.close_friends (owner_id, friend_id) values ('a0000000-0000-0000-0000-00000000000c', auth.uid())$$,
  'не можна додати себе в чужі близькі друзі');

select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-00000000000b', false);
select public._t((select count(*) = 1 from public.posts where id = 'c0000000-0000-0000-0000-0000000000a3'), 'близький друг бачить допис для близьких');
select public._t((select count(*) = 0 from public.posts where id = 'c0000000-0000-0000-0000-0000000000a4'), 'не член кола не бачить допис кола');
select public._t((select count(*) = 0 from public.close_friends), 'список близьких друзів бачить лише власник');

select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-00000000000c', false);
select public._t((select count(*) = 0 from public.posts where id = 'c0000000-0000-0000-0000-0000000000a3'), 'сторонній не бачить допис для близьких');
select public._t((select count(*) = 1 from public.posts where id = 'c0000000-0000-0000-0000-0000000000a4'), 'член кола бачить допис кола');
select public._t_fails($$insert into public.lights (user_id, post_id) values (auth.uid(), 'c0000000-0000-0000-0000-0000000000a3')$$,
  'не можна дати світло невидимому допису');
select public._t_fails($$insert into public.posts (author_id, content, reply_to) values (auth.uid(), 'хі', 'c0000000-0000-0000-0000-0000000000a3')$$,
  'не можна відповісти на невидимий допис');

reset role; set role anon;
select set_config('request.jwt.claim.sub', '', false);
select public._t((select count(*) = 0 from public.posts where audience <> 'public'), 'анонім бачить лише публічне');
select public._t((select count(*) = 0 from public.posts where id = 'c0000000-0000-0000-0000-0000000000d1'), 'анонім не бачить дописи приватного акаунта');
reset role; set role authenticated;

-- ════════ 7. Приватний акаунт і запити на підписку ════════
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-00000000000b', false);
insert into public.follows (follower_id, following_id) values (auth.uid(), 'a0000000-0000-0000-0000-00000000000d');
select public._t((select status = 'pending' from public.follows where follower_id = auth.uid() and following_id = 'a0000000-0000-0000-0000-00000000000d'),
  'підписка на приватний акаунт → запит');
select public._t((select count(*) = 0 from public.posts where id = 'c0000000-0000-0000-0000-0000000000d1'), 'до схвалення дописи приватного акаунта приховані');
select public._t_fails($$select public.start_direct_conversation('a0000000-0000-0000-0000-00000000000d')$$, 'DM неповнолітній до схвалення — ні');
update public.follows set status = 'accepted' where follower_id = auth.uid();
select public._t((select status = 'pending' from public.follows where follower_id = auth.uid() and following_id = 'a0000000-0000-0000-0000-00000000000d'),
  'сам собі запит не схвалиш');

select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-00000000000d', false);
select public._t((select followers_count = 0 from public.profiles where id = auth.uid()), 'запит не рахується в читачах');
select public._t((select count(*) = 1 from public.notifications where type = 'follow_request'), 'сповіщення про запит');
select public.respond_follow_request('a0000000-0000-0000-0000-00000000000b', true);
select public._t((select followers_count = 1 from public.profiles where id = auth.uid()), 'після схвалення +1 читач');

select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-00000000000b', false);
select public._t((select count(*) = 1 from public.posts where id = 'c0000000-0000-0000-0000-0000000000d1'), 'після схвалення дописи видно');
select public.start_direct_conversation('a0000000-0000-0000-0000-00000000000d') is not null as dm_ok \gset
select public._t(:'dm_ok'::boolean, 'схвалений читач може написати неповнолітній');

select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-00000000000c', false);
select public._t_fails($$select public.start_direct_conversation('a0000000-0000-0000-0000-00000000000d')$$, 'сторонній не пише неповнолітній (dm_policy=followers)');

-- ════════ 8. Блокування ════════
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-00000000000e', false);
insert into public.posts (id, author_id, content) values ('c0000000-0000-0000-0000-0000000000e1', auth.uid(), 'пост Кості');
insert into public.follows (follower_id, following_id) values (auth.uid(), 'a0000000-0000-0000-0000-00000000000a');
insert into public.blocks (blocker_id, blocked_id) values (auth.uid(), 'a0000000-0000-0000-0000-00000000000a');
select public._t((select count(*) = 0 from public.follows where follower_id = auth.uid() and following_id = 'a0000000-0000-0000-0000-00000000000a'),
  'блок розриває підписки');
select public._t((select count(*) = 0 from public.posts where author_id = 'a0000000-0000-0000-0000-00000000000a'), 'хто заблокував — не бачить дописів');
select public._t((select count(*) = 0 from public.profiles where id = 'a0000000-0000-0000-0000-00000000000a'), 'і профіль заблокованого');

select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-00000000000a', false);
select public._t((select count(*) = 0 from public.posts where id = 'c0000000-0000-0000-0000-0000000000e1'), 'заблокований не бачить дописів того, хто заблокував');
select public._t((select count(*) = 0 from public.blocks), 'заблокований не бачить запис про блок');
select public._t_fails($$insert into public.follows (follower_id, following_id) values (auth.uid(), 'a0000000-0000-0000-0000-00000000000e')$$,
  'заблокований не може підписатися');
select public._t_fails($$select public.start_direct_conversation('a0000000-0000-0000-0000-00000000000e')$$, 'заблокований не може написати');

-- блок посеред розмови
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-00000000000c', false);
select public.start_direct_conversation('a0000000-0000-0000-0000-00000000000b') as conv_cb \gset
insert into public.messages (conversation_id, sender_id, content) values (:'conv_cb', auth.uid(), 'привіт');
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-00000000000b', false);
insert into public.blocks (blocker_id, blocked_id) values (auth.uid(), 'a0000000-0000-0000-0000-00000000000c');
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-00000000000c', false);
select public._t_fails(format($$insert into public.messages (conversation_id, sender_id, content) values (%L, auth.uid(), 'ще')$$, :'conv_cb'),
  'після блоку повідомлення в існуючу розмову не надсилаються');
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-00000000000b', false);
delete from public.blocks where blocker_id = auth.uid();
select public._t((select count(*) = 0 from public.blocks), 'розблокування');

-- ════════ 9. Мют і сповіщення ════════
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-00000000000b', false);
insert into public.posts (id, author_id, content) values ('c0000000-0000-0000-0000-0000000000b1', auth.uid(), 'пост Богдана');
insert into public.mutes (muter_id, muted_id) values (auth.uid(), 'a0000000-0000-0000-0000-00000000000c');
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-00000000000c', false);
insert into public.lights (user_id, post_id) values (auth.uid(), 'c0000000-0000-0000-0000-0000000000b1');
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-00000000000b', false);
select public._t((select count(*) = 0 from public.notifications where actor_id = 'a0000000-0000-0000-0000-00000000000c' and type = 'light'),
  'від заглушеного сповіщень немає');
select public._t((select light_count = 1 from public.posts where id = 'c0000000-0000-0000-0000-0000000000b1'), 'але світло зараховано');
select public._t((select count(*) = 0 from public.mutes where muter_id <> auth.uid()), 'мюти бачить лише власник');
delete from public.mutes where muter_id = auth.uid();

-- ════════ 10. Ранжування «Для тебе» ════════
-- B читає A. A дав світло допису C (C B не читає) → причина friend_light.
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-00000000000b', false);
insert into public.follows (follower_id, following_id) values (auth.uid(), 'a0000000-0000-0000-0000-00000000000a');
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-00000000000c', false);
insert into public.posts (id, author_id, content) values ('c0000000-0000-0000-0000-0000000000c1', auth.uid(), 'пост Кирила');
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-00000000000a', false);
insert into public.lights (user_id, post_id) values (auth.uid(), 'c0000000-0000-0000-0000-0000000000c1');
insert into public.posts (id, author_id, content) values ('c0000000-0000-0000-0000-0000000000a5', auth.uid(), 'свіжий пост Анни');

select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-00000000000b', false);
select public._t((select reason = 'friend_light' and reason_actor_id = 'a0000000-0000-0000-0000-00000000000a'
                  from public.for_you_feed(50, 0) where post_id = 'c0000000-0000-0000-0000-0000000000c1'),
  'рекомендація з причиною «друг дав світло»');
select public._t((select reason is null from public.for_you_feed(50, 0) where post_id = 'c0000000-0000-0000-0000-0000000000a5'),
  'пости тих, кого читаєш, — без причини');
select public._t((select count(*) = 1 from public.for_you_feed(50, 0) where post_id = 'c0000000-0000-0000-0000-0000000000a3'),
  'близький друг бачить допис «для близьких» у своїй стрічці');
select public._t((select count(*) = 0 from public.for_you_feed(50, 0) where post_id = 'c0000000-0000-0000-0000-0000000000a4'),
  'допис кола не потрапляє у стрічку не-члена');
select public._t((select count(*) = 0 from public.for_you_feed(50, 0) where post_id = 'c0000000-0000-0000-0000-0000000000b1'),
  'власні дописи не рекомендуються собі');

update public.profiles set feed_prefs = '{"social": 0, "media": 0.5}' where id = auth.uid();
select public._t((select reason is null from public.for_you_feed(1, 0)), 'тюнер «друзі»: першим іде допис друга');
update public.profiles set feed_prefs = '{"social": 1, "media": 0.5}' where id = auth.uid();
select public._t((select reason is not null from public.for_you_feed(1, 0)), 'тюнер «рекомендації»: першою йде рекомендація');

-- media-вага
reset role;
insert into public.posts (id, author_id, content, media) values
  ('c0000000-0000-0000-0000-0000000000c2', 'a0000000-0000-0000-0000-00000000000c', '', '[{"type":"image","url":"/x.jpg"}]'),
  ('c0000000-0000-0000-0000-0000000000c3', 'a0000000-0000-0000-0000-00000000000c', 'лише текст', '[]');
set role authenticated;
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-00000000000b', false);
update public.profiles set feed_prefs = '{"social": 1, "media": 1}' where id = auth.uid();
select public._t((select (select score from public.for_you_feed(50,0) where post_id = 'c0000000-0000-0000-0000-0000000000c2')
                       > (select score from public.for_you_feed(50,0) where post_id = 'c0000000-0000-0000-0000-0000000000c3')),
  'тюнер «медіа»: фото вище за текст');
update public.profiles set feed_prefs = '{"social": 1, "media": 0}' where id = auth.uid();
select public._t((select (select score from public.for_you_feed(50,0) where post_id = 'c0000000-0000-0000-0000-0000000000c3')
                       > (select score from public.for_you_feed(50,0) where post_id = 'c0000000-0000-0000-0000-0000000000c2')),
  'тюнер «текст»: текст вище за фото');

insert into public.mutes (muter_id, muted_id) values (auth.uid(), 'a0000000-0000-0000-0000-00000000000c');
select public._t((select count(*) = 0 from public.for_you_feed(50, 0) f join public.posts p on p.id = f.post_id
                  where p.author_id = 'a0000000-0000-0000-0000-00000000000c'), 'заглушені не потрапляють у «Для тебе»');
select public._t((select count(*) >= 1 from public.following_feed(20, null) where author_id = 'a0000000-0000-0000-0000-00000000000a'),
  '«Підписки»: дописи тих, кого читаєш');
select public._t((select bool_and(created_at >= coalesce(lead_created, created_at)) from (
                    select created_at, lead(created_at) over (order by created_at desc) as lead_created
                    from public.following_feed(20, null)) s), '«Підписки»: хронологічно');
delete from public.mutes where muter_id = auth.uid();

reset role; set role anon;
select set_config('request.jwt.claim.sub', '', false);
select public._t_fails($$select * from public.for_you_feed(10, 0)$$, 'анонім не викликає ранжування');
reset role; set role authenticated;

-- ════════ 11. Скарги ════════
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-00000000000c', false);
insert into public.reports (target_type, target_id, reason, details, status)
values ('post', 'c0000000-0000-0000-0000-0000000000a1', 'spam', 'реклама', 'resolved');
select public._t((select status = 'open' from public.reports), 'скарга завжди створюється відкритою');
select public._t_fails($$update public.reports set status = 'dismissed'$$, 'автор скарги не змінює статус');
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-00000000000a', false);
select public._t((select count(*) = 0 from public.reports), 'чужі скарги не видно');

-- ════════ 12. Кастомізація профілю ════════
update public.profiles
   set accent_color = '#ff6b00', banner_style = 'mesh',
       widgets = '{"top4": ["a0000000-0000-0000-0000-00000000000b"], "now_playing": {"title": "Нічний Київ", "artist": "Lumyn FM"}}',
       status = 'на парах до 18:00', status_expires_at = now() + interval '4 hours'
 where id = auth.uid();
select public._t((select accent_color = '#ff6b00' and widgets ? 'top4' from public.profiles where id = auth.uid()), 'кастомізація профілю зберігається');
select public._t_fails($$update public.profiles set accent_color = 'red' where id = auth.uid()$$, 'акцент лише у форматі #rrggbb');
update public.profiles set status = '' where id = auth.uid();
select public._t((select status_expires_at is null from public.profiles where id = auth.uid()), 'порожній статус скидає термін');

reset role;
select public._t((select count(*) = 0 from pg_tables where schemaname = 'public' and not rowsecurity and tablename not like '\_t%'),
  'RLS увімкнено на всіх таблицях public');
drop function public._t(boolean, text);
drop function public._t_fails(text, text);
\echo '✓ 0002: усі перевірки MVP пройшли'
