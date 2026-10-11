-- Перевірка після застосування 0004 у Supabase (лише читання).
-- Supabase Dashboard → SQL Editor → вставити → Run.
select 'таблиці без RLS' as check, coalesce(string_agg(c.relname, ', '), '— немає') as result
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
union all
select 'бакети', string_agg(id || (case when public then ' (public)' else '' end), ', ' order by id)
  from storage.buckets where id in ('avatars', 'covers', 'post-media', 'community-media')
union all
select 'політики storage', string_agg(policyname, ', ' order by policyname)
  from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname like 'lumyn_media_%'
union all
select 'realtime-публікація', string_agg(tablename, ', ' order by tablename)
  from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public'
union all
select 'функції 0004', string_agg(proname, ', ' order by proname)
  from pg_proc where pronamespace = 'public'::regnamespace
   and proname in ('trending_hashtags', 'mark_conversation_read', 'respond_join_request', 'delete_my_account')
union all
select 'community_join_requests', case when to_regclass('public.community_join_requests') is null then 'НЕМАЄ' else 'є' end;
