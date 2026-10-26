-- apply-pending-12.sql: Supabase → SQL Editor → Run (= міграція 0018, ідемпотентно).
-- Звичайні рамки (light/glow/aurora/star) видаються НАЗАВЖДИ,
-- хелловінські (hw-pumpkin/hw-ghost/hw-witch) — на стільки днів, скільки задано в коді.

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

  -- сезонні рамки тимчасові, решта — постійні (frame_expires_at = null)
  v_exp := case when c.frame like 'hw-%' then now() + make_interval(days => c.duration_days) end;

  update public.frame_codes set used_by = me, used_at = now() where code = c.code;
  update public.profiles
     set frame = c.frame,
         frame_expires_at = v_exp,
         frame_code = c.code
   where id = me;
  return jsonb_build_object('frame', c.frame, 'expires_at', v_exp);
end $$;
