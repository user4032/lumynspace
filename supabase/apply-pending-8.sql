-- apply-pending-8.sql: Supabase → SQL Editor → Run (= міграція 0014, ідемпотентно).
-- Чат: реакції на повідомлення та відповіді на конкретне повідомлення.

-- 0014: реакції на повідомлення + відповіді на конкретне повідомлення в чаті
-- Ідемпотентно: можна запускати повторно.

alter table public.messages add column if not exists reply_to uuid
  references public.messages (id) on delete set null;

create table if not exists public.message_reactions (
  message_id  uuid not null references public.messages (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  emoji       text not null check (char_length(emoji) between 1 and 8),
  created_at  timestamptz not null default now(),
  primary key (message_id, user_id, emoji)
);

alter table public.message_reactions enable row level security;

drop policy if exists message_reactions_select on public.message_reactions;
create policy message_reactions_select on public.message_reactions for select to authenticated
  using (public.is_conversation_member((select m.conversation_id from public.messages m where m.id = message_id)));

drop policy if exists message_reactions_insert_own on public.message_reactions;
create policy message_reactions_insert_own on public.message_reactions for insert to authenticated
  with check (
    user_id = auth.uid()
    and public.is_conversation_member((select m.conversation_id from public.messages m where m.id = message_id))
  );

drop policy if exists message_reactions_delete_own on public.message_reactions;
create policy message_reactions_delete_own on public.message_reactions for delete to authenticated
  using (user_id = auth.uid());

grant select, insert, delete on public.message_reactions to authenticated;

-- author може додати reply_to своєму повідомленню при створенні (insert), тому лише розширюємо grant
grant update (reply_to) on public.messages to authenticated;
