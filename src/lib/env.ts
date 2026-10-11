/**
 * Нормалізує Project URL: якщо вставили REST-адресу (…supabase.co/rest/v1/),
 * відрізаємо хвіст — supabase-js сам додає /rest/v1, /auth/v1 тощо.
 */
function normalizeSupabaseUrl(raw: string | undefined) {
  return (raw ?? "").trim().replace(/\/rest\/v1\/?$/i, "").replace(/\/+$/, "")
}

/** Supabase налаштовано? Якщо ні — увесь застосунок працює на мок-даних. */
export const SUPABASE_URL = normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL)
export const SUPABASE_ANON_KEY = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim()

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)
export const isMockMode = !isSupabaseConfigured
