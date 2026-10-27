-- Керування учасниками груп: додавати й видаляти інших може лише творець групи.
-- Перейменуйте файл на наступний вільний номер у supabase/migrations (після 0003_*).

-- 1) Додавати учасників — лише творець, лише в групи (раніше політика не перевіряла is_group,
--    тож творець DM міг би дописати третього) і лише поки сам лишається учасником.
drop policy if exists conv_members_insert_by_creator on public.conversation_members;
create policy conv_members_insert_by_creator on public.conversation_members for insert to authenticated
  with check (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and c.is_group
        and c.created_by = auth.uid()
        and public.is_conversation_member(c.id)
    )
  );

-- 2) Видаляти ІНШОГО учасника — лише творець групи (свій рядок і далі видаляє conv_members_leave).
--    Творця таким шляхом видалити не можна: user_id <> auth.uid().
drop policy if exists conv_members_kick_by_creator on public.conversation_members;
create policy conv_members_kick_by_creator on public.conversation_members for delete to authenticated
  using (
    user_id <> auth.uid()
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and c.is_group
        and c.created_by = auth.uid()
        and public.is_conversation_member(c.id)
    )
  );