-- apply-pending-13.sql: Supabase → SQL Editor → Run (= міграція 0019, ідемпотентно).
-- Фікс «invalid frame»: генерація кодів на хелловінські рамки.

create or replace function public.create_frame_codes(p_frame text, p_count integer, p_days integer)
returns text[] language plpgsql security definer set search_path = ''
as $$
declare me uuid := auth.uid(); codes text[] := '{}'; c text; i int := 0; tries int;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if p_frame not in ('light','glow','aurora','star','hw-pumpkin','hw-ghost','hw-witch')
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
