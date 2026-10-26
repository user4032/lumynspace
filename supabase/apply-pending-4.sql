-- apply-pending-4.sql: Supabase → SQL Editor → Run (= міграція 0010, ідемпотентно). Стирає токени Spotify.
-- Ідемпотентно: повторний запуск нічого не змінює.
update public.profiles
set widgets = widgets - 'spotify_token' - 'spotify_refresh'
where widgets ?| array['spotify_token', 'spotify_refresh'];
