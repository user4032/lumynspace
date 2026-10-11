import "server-only"

import { cookies } from "next/headers"
import { connection } from "next/server"
import { createServerClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"
import { isSupabaseConfigured, SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/env"

/**
 * Серверний клієнт Supabase (Server Components, Server Actions, Route Handlers).
 * Повертає null у демо-режимі.
 *
 * `connection()` — лише під час справжнього запиту: auth-клієнт Supabase
 * перевіряє строк дії сесії через Date.now(), а Next (cacheComponents) забороняє
 * це під час пререндеру (зокрема generateMetadata з cookies сесії).
 */
export async function getSupabaseServerClient(): Promise<SupabaseClient<Database> | null> {
  if (!isSupabaseConfigured) return null
  await connection()
  const cookieStore = await cookies()

  return createServerClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        } catch {
          // Виклик із Server Component — ігноруємо: сесію оновлює proxy.ts
        }
      },
    },
  })
}
