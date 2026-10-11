-- Тест 0003 (перший користувач без інвайту). Потрібна СВІЖА БД: stubs → 0001 → 0002 → 0003, без даних з 01/02.
\set ON_ERROR_STOP on
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
  raise exception 'FAIL: % — мав впасти', msg;
end $$;
grant execute on function public._t_fails(text, text) to anon, authenticated;

insert into auth.users (id, email, raw_user_meta_data) values
 ('a0000000-0000-0000-0000-00000000000a', 'owner@example.com', '{"user_name":"Denys-Dev"}'),
 ('a0000000-0000-0000-0000-00000000000b', 'friend@example.com', '{"user_name":"friend"}'),
 ('a0000000-0000-0000-0000-00000000000c', 'teen@example.com', '{"user_name":"teen"}'),
 ('a0000000-0000-0000-0000-00000000000d', 'rando@example.com', '{"user_name":"rando"}');

set role anon;
select public._t_fails($$select public.invite_required()$$, 'анонім не викликає invite_required');
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-00000000000a', false);
select public._t((select public.invite_required()) = false, 'порожня таблиця інвайтів → код не потрібен');
select public._t((select onboarded_at is null and username = 'denysdev' from public.profiles where id = auth.uid()), 'тригер створив профіль без онбордингу');
select public.complete_onboarding('denys', 2001::smallint, null, '#ff3d81');
select public._t((select username = 'denys' and birth_year = 2001 and accent_color = '#ff3d81' and onboarded_at is not null and not is_private
                  from public.profiles where id = auth.uid()), 'власник пройшов онбординг без коду');
select public.create_invite() as code_a \gset
select public._t((select public.invite_required()) = true, 'після першого інвайту код обов''язковий');

select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-00000000000d', false);
select public._t_fails($$select public.complete_onboarding('rando_x', 2000::smallint, null, null)$$, 'без коду вже не можна');
select public._t_fails($$select public.complete_onboarding('rando_x', 2000::smallint, 'AAAA-AAAA', null)$$, 'неіснуючий код');
select public._t((select count(*) = 0 from public.invites), 'чужі інвайти не видно через RLS');

select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-00000000000c', false);
select public.complete_onboarding('teen_one', (extract(year from now())::int - 17)::smallint, :'code_a', null);
select public._t((select is_private and dm_policy = 'followers' from public.profiles where id = auth.uid()), '17 років → приватний і DM від читачів (тригер)');
select public._t((select used_by = auth.uid() from public.invites where code = :'code_a'), 'код позначено використаним');

select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-00000000000b', false);
select public._t_fails(format($$select public.complete_onboarding('friend_x', 2000::smallint, %L, null)$$, :'code_a'), 'використаний код вдруге не працює');
reset role;
