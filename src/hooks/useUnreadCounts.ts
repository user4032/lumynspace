"use client"

import { useEffect, useSyncExternalStore } from "react"
import type { RealtimeChannel } from "@supabase/supabase-js"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { isMockMode } from "@/lib/env"

/**
 * Лічильники непрочитаного (Supabase): сповіщення (без «message») і повідомлення.
 * Один спільний стан і одна Realtime-підписка на notifications на всю вкладку.
 */
type Counts = { notifications: number; messages: number }
const EMPTY: Counts = { notifications: 0, messages: 0 }
let counts: Counts = EMPTY
const listeners = new Set<() => void>()
let channel: RealtimeChannel | null = null
let userId: string | null = null
let inflight: Promise<void> | null = null

function emit() {
  listeners.forEach((l) => l())
}

export function refreshUnread(): Promise<void> {
  const supabase = getSupabaseBrowserClient()
  if (!supabase) return Promise.resolve()
  inflight ??= (async () => {
    try {
      if (!userId) {
        const { data } = await supabase.auth.getClaims()
        userId = (data?.claims?.sub as string | undefined) ?? null
      }
      if (!userId) return
      const base = () =>
        supabase.from("notifications").select("id", { count: "exact", head: true }).eq("recipient_id", userId!).is("read_at", null)
      const [n, m] = await Promise.all([base().neq("type", "message"), base().eq("type", "message")])
      counts = { notifications: n.count ?? 0, messages: m.count ?? 0 }
      emit()
      ensureChannel()
    } finally {
      inflight = null
    }
  })()
  return inflight
}

function ensureChannel() {
  const supabase = getSupabaseBrowserClient()
  if (!supabase || !userId || channel) return
  channel = supabase
    .channel(`unread:${userId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `recipient_id=eq.${userId}` }, () => {
      void refreshUnread()
    })
    .subscribe()
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

/**
 * { notifications, messages } — у демо завжди нулі (бейджі демо задано в nav-items).
 * pathname передає компонент (usePathname — лише всередині Suspense).
 */
export function useUnreadCounts(pathname: string | null): Counts {
  const value = useSyncExternalStore(subscribe, () => counts, () => EMPTY)
  useEffect(() => {
    if (isMockMode) return
    // після переходу (напр., відкрив розмову чи сповіщення) — перерахувати
    const t = setTimeout(() => void refreshUnread(), 600)
    return () => clearTimeout(t)
  }, [pathname])
  return value
}
