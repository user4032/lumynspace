-- 0009: іконка статусу, вкладення в чаті (приватний бакет), відео в дописах, mute розмови.
-- Ідемпотентно: можна запускати повторно.

-- ── 1. Іконка статусу ───────────────────────────────────────────────
alter table public.profiles add column if not exists status_icon text;
alter table public.profiles drop constraint if exists profiles_status_icon_check;
alter table public.profiles add constraint profiles_status_icon_check check (
  status_icon is null or status_icon in ('coding','music','study','gaming','sleep','coffee','travel','love','busy','fire')
);
grant update (status_icon) on public.profiles to authenticated;

-- ── 2. Вкладення в повідомленнях ────────────────────────────────────
-- attachments: [{ kind: 'image'|'file', path, name, size, mime, width?, height? }]
alter table public.messages add column if not exists attachments jsonb not null default '[]'::jsonb;
alter table public.messages drop constraint if exists messages_attachments_array;
alter table public.messages add constraint messages_attachments_array
  check (jsonb_typeof(attachments) = 'array' and jsonb_array_length(attachments) <= 10);
-- текст може бути порожнім, якщо є вкладення
alter table public.messages drop constraint if exists messages_content_check;
alter table public.messages drop constraint if exists messages_content_or_attachment;
alter table public.messages add constraint messages_content_or_attachment check (
  char_length(content) <= 4000 and (char_length(content) >= 1 or jsonb_array_length(attachments) >= 1)
);
alter table public.messages alter column content set default '';

-- Приватний бакет: шлях <conversation_id>/<user_id>/<uuid>-<name>
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-files', 'chat-files', false, 26214400, null)
on conflict (id) do update set public = false, file_size_limit = 26214400;

drop policy if exists chat_files_read_members on storage.objects;
create policy chat_files_read_members on storage.objects for select to authenticated
  using (
    bucket_id = 'chat-files'
    and public.is_conversation_member(((storage.foldername(name))[1])::uuid)
  );
drop policy if exists chat_files_insert_member on storage.objects;
create policy chat_files_insert_member on storage.objects for insert to authenticated
  with check (
    bucket_id = 'chat-files'
    and (storage.foldername(name))[2] = auth.uid()::text
    and public.is_conversation_member(((storage.foldername(name))[1])::uuid)
  );
drop policy if exists chat_files_delete_own on storage.objects;
create policy chat_files_delete_own on storage.objects for delete to authenticated
  using (bucket_id = 'chat-files' and (storage.foldername(name))[2] = auth.uid()::text);

-- ── 3. Відео в дописах ──────────────────────────────────────────────
update storage.buckets
set file_size_limit = 52428800,
    allowed_mime_types = array['image/png','image/jpeg','image/webp','image/gif','video/mp4','video/webm','video/quicktime']
where id = 'post-media';

-- ── 4. Вимкнути сповіщення розмови ──────────────────────────────────
alter table public.conversation_members add column if not exists muted boolean not null default false;
grant update (muted) on public.conversation_members to authenticated;
