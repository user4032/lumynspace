-- ════════════════════════════════════════════════════════════════════
--  Lumyn 0003 — перший користувач без інвайту.
--
--  Раніше invite_only() завжди повертав true, тож у порожній базі ніхто
--  не міг пройти онбординг (інвайти створюють лише вже зареєстровані).
--  Тепер код обов'язковий лише тоді, коли в системі вже є хоч один інвайт:
--  власник заходить без коду, створює інвайти — і далі бета закрита.
--
--  Безпечно запускати повторно (create or replace).
-- ════════════════════════════════════════════════════════════════════

create or replace function public.invite_only()
returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.invites) $$;

/** Для UI онбордингу: чи треба просити інвайт-код (лише boolean, без даних інвайтів). */
create or replace function public.invite_required()
returns boolean
language sql stable security definer set search_path = ''
as $$ select public.invite_only() $$;

revoke execute on function public.invite_required() from public, anon;
grant  execute on function public.invite_required() to authenticated;
