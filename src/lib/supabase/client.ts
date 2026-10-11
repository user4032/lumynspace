"use client"

import { createBrowserClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"
import { isSupabaseConfigured, SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/env"

let client: SupabaseClient<Database> | null = null

/** Браузерний клієнт Supabase. Повертає null у демо-режимі (без .env). */
export function getSupabaseBrowserClient(): SupabaseClient<Database> | null {
  if (!isSupabaseConfigured) return null
  client ??= createBrowserClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY)
  return client
}
