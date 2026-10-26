-- 0021: редагування й видалення повідомлень у чаті
--   • редагувати може лише автор (RLS messages_update_own + grant на content, edited_at уже є)
--   • видаляти може автор АБО адмін групи (творець розмови) — через RPC, бо RLS дозволяє лише своє
-- Ідемпотентно: можна запускати повторно.

create or replace function public.delete_message(p_message uuid)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  me      uuid := auth.uid();
  conv    uuid;
  author  uuid;
  grp     boolean;
  creator uuid;
begin
  if me is null then return false; end if;

  select m.conversation_id, m.sender_id, c.is_group, c.created_by
    into conv, author, grp, creator
  from public.messages m
  join public.conversations c on c.id = m.conversation_id
  where m.id = p_message;

  if conv is null then return false; end if;

  if not public.is_conversation_member(conv) then
    raise exception 'not a conversation member' using errcode = '42501';
  end if;

  -- автор або (у групі) її творець
  if author <> me and not (grp and creator = me) then
    raise exception 'not allowed to delete this message' using errcode = '42501';
  end if;

  delete from public.messages where id = p_message;
  return true;
end;
$$;

revoke all on function public.delete_message(uuid) from public;
grant execute on function public.delete_message(uuid) to authenticated;
