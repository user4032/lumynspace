-- 0010: прибрати інтеграцію Spotify — стерти токени з profiles.widgets у всіх користувачів.
-- Ідемпотентно: повторний запуск нічого не змінює.
update public.profiles
set widgets = widgets - 'spotify_token' - 'spotify_refresh'
where widgets ?| array['spotify_token', 'spotify_refresh'];
