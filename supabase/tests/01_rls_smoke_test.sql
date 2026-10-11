-- Smoke-тест RLS і тригерів. Запускати лише на тестовій БД (див. run-local.sh).
\set ON_ERROR_STOP on
-- користувачі
insert into auth.users (id, email, raw_user_meta_data) values
 ('00000000-0000-0000-0000-000000000001', 'denys@example.com', '{"user_name":"ozhaaar","full_name":"Денис","avatar_url":"https://x/a.png"}'),
 ('00000000-0000-0000-0000-000000000002', 'olena.k@example.com', '{"name":"Олена"}'),
 ('00000000-0000-0000-0000-000000000003', 'ozhaaar@gmail.com', '{}'),
 ('00000000-0000-0000-0000-000000000004', 'ab@x.com', '{}');
select username, display_name, avatar_url from public.profiles order by username;

-- дії від імені користувача 1
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
insert into public.posts (id, author_id, content) values ('10000000-0000-0000-0000-000000000001', auth.uid(), 'Привіт, @olenak! Перший допис у Lumyn');
insert into public.follows (follower_id, following_id) values (auth.uid(), '00000000-0000-0000-0000-000000000002');
insert into public.communities (id, slug, name, owner_id) values ('20000000-0000-0000-0000-000000000001', 'frontend-ua', 'Frontend UA', auth.uid());
insert into public.posts (author_id, community_id, content, media) values (auth.uid(), '20000000-0000-0000-0000-000000000001', '', '[{"type":"code","lang":"ts","code":"const a = 1"}]');
select public.start_direct_conversation('00000000-0000-0000-0000-000000000002') as conv \gset
insert into public.messages (conversation_id, sender_id, content) values (:'conv', auth.uid(), 'Привіт!');

-- спроби зламати
do $$ begin
  begin
    insert into public.posts (author_id, content) values ('00000000-0000-0000-0000-000000000002', 'підробка');
    raise exception 'FAIL: можна писати від чужого імені';
  exception when insufficient_privilege then raise notice 'OK: чужий author_id заблоковано'; end;
  begin
    update public.posts set like_count = 9999 where author_id = auth.uid();
    raise exception 'FAIL: можна накрутити лайки';
  exception when insufficient_privilege then raise notice 'OK: like_count не можна змінювати'; end;
  begin
    insert into public.notifications (recipient_id, actor_id, type) values (auth.uid(), auth.uid(), 'like');
    raise exception 'FAIL: можна створити сповіщення';
  exception when insufficient_privilege then raise notice 'OK: сповіщення лише тригерами'; end;
  begin
    insert into storage.objects (bucket_id, name) values ('avatars', '00000000-0000-0000-0000-000000000002/a.png');
    raise exception 'FAIL: можна писати в чужу теку';
  exception when insufficient_privilege then raise notice 'OK: storage чужа тека заблокована'; end;
end $$;
insert into storage.objects (bucket_id, name) values ('avatars', '00000000-0000-0000-0000-000000000001/a.png');

-- користувач 2
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', false);
insert into public.likes (user_id, post_id) values (auth.uid(), '10000000-0000-0000-0000-000000000001');
insert into public.posts (author_id, reply_to, content) values (auth.uid(), '10000000-0000-0000-0000-000000000001', 'Вітаю!');
insert into public.posts (author_id, repost_of) values (auth.uid(), '10000000-0000-0000-0000-000000000001');
insert into public.community_members (community_id, user_id) values ('20000000-0000-0000-0000-000000000001', auth.uid());
select count(*) as user2_sees_messages from public.messages;
select count(*) as user2_notifications from public.notifications;
do $$ begin
  begin
    update public.community_members set role = 'admin' where user_id = auth.uid();
    if found then raise exception 'FAIL: member підвищив себе'; end if;
    raise notice 'OK: member не може змінити свою роль (0 рядків)';
  end;
  begin
    delete from public.posts where id = '10000000-0000-0000-0000-000000000001';
    if found then raise exception 'FAIL: видалено чужий допис'; end if;
    raise notice 'OK: чужий допис не видаляється';
  end;
end $$;
select id, viewer_has_liked, like_count, reply_count, repost_count from public.feed_posts where id = '10000000-0000-0000-0000-000000000001';

-- користувач 3 (сторонній)
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', false);
select count(*) as user3_sees_messages from public.messages;
select count(*) as user3_sees_conv from public.conversations;
select count(*) as user3_notifications from public.notifications;

-- анонім
reset role;
set role anon;
select set_config('request.jwt.claim.sub', '', false);
select count(*) as anon_posts from public.posts;
reset role;

select username, followers_count, following_count, posts_count from public.profiles order by username;
select type, (select username from public.profiles where id = recipient_id) as recipient, (select username from public.profiles where id = actor_id) as actor from public.notifications order by created_at, type;
select slug, member_count from public.communities;
