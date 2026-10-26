-- apply-pending-7.sql: Supabase → SQL Editor → Run (= міграція 0013, ідемпотентно).
-- Редагування дописів: позначка «змінено» (edited_at).

-- 0013: редагування дописів — окрема позначка edited_at
-- (updated_at рухається тригерами лічильників, тому для «змінено» — своя колонка)
-- Ідемпотентно: можна запускати повторно.

alter table public.posts add column if not exists edited_at timestamptz;

revoke update on public.posts from anon, authenticated;
grant update (content, media, edited_at) on public.posts to authenticated;
