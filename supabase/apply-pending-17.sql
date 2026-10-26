-- 0022: прихована рамка "Злий" (evil) — видається лише кодами з адмінки, у каталозі її немає.
-- Додає ключ evil до дозволених у frame_codes (create_frame_codes перевіряє той самий список).

alter table public.frame_codes drop constraint if exists frame_codes_frame_check;
alter table public.frame_codes
  add constraint frame_codes_frame_check
  check (frame in ('light','glow','aurora','star','hw-pumpkin','hw-ghost','hw-witch','venom','claws','evil'));

create or replace function public.create_frame_codes(p_frame text, p_count integer, p_days integer)
returns text[] language plpgsql security definer set search_path = ''
as $$
declare me uuid := auth.uid(); codes text[] := '{}'; c text; i int := 0; tries int;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if p_frame not in ('light','glow','aurora','star','hw-pumpkin','hw-ghost','hw-witch','venom','claws','evil')
    then raise exception 'invalid frame'; end if;
  p_count := least(greatest(coalesce(p_count, 1), 1), 50);
  p_days := least(greatest(coalesce(p_days, 30), 1), 365);

  while i < p_count loop
    tries := 0;
    loop
      tries := tries + 1;
      c := 'LUMN-' || upper(substr(md5(random()::text || gen_random_uuid()::text), 1, 4))
           || '-' || upper(substr(md5(random()::text || gen_random_uuid()::text), 1, 4));
      exit when not exists (select 1 from public.frame_codes where code = c) or tries > 5;
    end loop;
    insert into public.frame_codes (code, frame, duration_days, created_by) values (c, p_frame, p_days, me);
    codes := codes || c;
    i := i + 1;
  end loop;
  return codes;
end $$;
-- 0023: колекція рамок + сповіщення про закінчення терміну.
-- Активовані рамки більше не губляться: усі зберігаються в user_frames, користувач обирає будь-яку.
-- Тимчасові рамки видаляються після expires_at, а в сповіщення падає подія frame_expired.
-- Ідемпотентно: можна запускати повторно.

alter type public.notification_type add value if not exists 'frame_expired';

alter table public.notifications add column if not exists frame_key text;

create table if not exists public.user_frames (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  frame       text not null,
  expires_at  timestamptz,
  code        text,
  acquired_at timestamptz not null default now(),
  primary key (user_id, frame)
);

alter table public.user_frames enable row level security;
drop policy if exists "user_frames_select_own" on public.user_frames;
create policy "user_frames_select_own" on public.user_frames
  for select to authenticated using (user_id = auth.uid());
revoke insert, update, delete on public.user_frames from anon, authenticated;
grant select on public.user_frames to authenticated;

-- наявні активні рамки переносимо в колекцію (щоб нічого не загубилось)
insert into public.user_frames (user_id, frame, expires_at, code, acquired_at)
select p.id, p.frame, p.frame_expires_at, p.frame_code, now()
  from public.profiles p
 where p.frame is not null
   and (p.frame_expires_at is null or p.frame_expires_at > now())
on conflict (user_id, frame) do nothing;

-- історія кодів: повертаємо в колекцію всі рамки, які вже активували (навіть якщо profiles.frame перезаписали)
insert into public.user_frames (user_id, frame, expires_at, code, acquired_at)
select distinct on (c.used_by, c.frame)
       c.used_by,
       c.frame,
       case when c.frame like 'hw-%' then c.used_at + make_interval(days => c.duration_days) end,
       c.code,
       coalesce(c.used_at, c.created_at)
  from public.frame_codes c
 where c.used_by is not null
   and not c.revoked
   and (c.frame not like 'hw-%' or c.used_at + make_interval(days => c.duration_days) > now())
 order by c.used_by, c.frame, c.used_at desc nulls last
on conflict (user_id, frame) do nothing;

-- ── RPC ───────────────────────────────────────────────────────────────

-- Користувач: обрати рамку зі своєї колекції
create or replace function public.select_my_frame(p_frame text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare me uuid := auth.uid(); uf public.user_frames;
begin
  if me is null then raise exception 'not authenticated'; end if;
  select * into uf from public.user_frames
   where user_id = me
     and frame = p_frame
     and (expires_at is null or expires_at > now());
  if not found then raise exception 'not owned'; end if;

  update public.profiles
     set frame = uf.frame,
         frame_expires_at = uf.expires_at,
         frame_code = uf.code
   where id = me;
  return jsonb_build_object('frame', uf.frame, 'expires_at', uf.expires_at);
end $$;

-- Прибрати протухлі рамки з колекції й створити по одному сповіщенню на кожну
create or replace function public.sync_expired_frames()
returns integer language plpgsql security definer set search_path = ''
as $$
declare me uuid := auth.uid(); r record; n int := 0; v_frame text;
begin
  if me is null then return 0; end if;

  select frame into v_frame from public.profiles where id = me;

  for r in
    delete from public.user_frames
     where user_id = me and expires_at is not null and expires_at <= now()
     returning frame
  loop
    n := n + 1;
    if v_frame = r.frame then
      update public.profiles
         set frame = null, frame_expires_at = null, frame_code = null
       where id = me;
      v_frame := null;
    end if;
    insert into public.notifications (recipient_id, actor_id, type, frame_key)
    values (me, me, 'frame_expired'::public.notification_type, r.frame);
  end loop;

  return n;
end $$;

-- Активувати код: рамка потрапляє в колекцію (upsert), профіль перемикається на неї.
create or replace function public.activate_frame_code(p_code text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare me uuid := auth.uid(); c public.frame_codes; v_exp timestamptz;
begin
  if me is null then raise exception 'not authenticated'; end if;
  select * into c from public.frame_codes where upper(btrim(p_code)) = code for update;
  if not found then raise exception 'invalid code'; end if;
  if c.revoked then raise exception 'code revoked'; end if;
  if c.used_by is not null then raise exception 'code used'; end if;

  -- сезонні рамки тимчасові, решта — постійні (expires_at = null)
  v_exp := case when c.frame like 'hw-%' then now() + make_interval(days => c.duration_days) end;

  update public.frame_codes set used_by = me, used_at = now() where code = c.code;
  insert into public.user_frames (user_id, frame, expires_at, code, acquired_at)
  values (me, c.frame, v_exp, c.code, now())
  on conflict (user_id, frame) do update
    set expires_at = excluded.expires_at,
        code = excluded.code,
        acquired_at = now();
  update public.profiles
     set frame = c.frame,
         frame_expires_at = v_exp,
         frame_code = c.code
   where id = me;
  return jsonb_build_object('frame', c.frame, 'expires_at', v_exp);
end $$;

-- Деактивація коду адміном: прибирає саме цю рамку з колекції (повернення коштів)
create or replace function public.revoke_frame_code(p_code text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  update public.frame_codes set revoked = true where code = upper(btrim(p_code));
  delete from public.user_frames where code = upper(btrim(p_code));
  update public.profiles
     set frame = null, frame_expires_at = null, frame_code = null
   where frame_code = upper(btrim(p_code));
end $$;

-- Прибирання активної рамки більше не видаляє її з колекції
create or replace function public.clear_my_frame()
returns void language plpgsql security definer set search_path = ''
as $$
begin
  update public.profiles set frame = null, frame_expires_at = null, frame_code = null
   where id = auth.uid();
end $$;

revoke execute on function public.select_my_frame(text) from public;
revoke execute on function public.sync_expired_frames() from public;
grant execute on function public.select_my_frame(text) to authenticated;
grant execute on function public.sync_expired_frames() to authenticated;
