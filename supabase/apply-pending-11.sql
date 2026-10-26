-- apply-pending-11.sql: Supabase → SQL Editor → Run (= міграція 0017, ідемпотентно).
-- Хелловін-рамки: гарбуз / привид / відьма (продаж до 3.11.2026).

-- 0017: хелловінські лімітовані рамки (продаж до 3 листопада 2026)
-- Ідемпотентно: можна запускати повторно.

alter table public.frame_codes drop constraint if exists frame_codes_frame_check;
alter table public.frame_codes
  add constraint frame_codes_frame_check
  check (frame in ('light','glow','aurora','star','hw-pumpkin','hw-ghost','hw-witch'));
