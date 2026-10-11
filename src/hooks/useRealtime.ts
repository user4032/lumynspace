"use client"

import { useEffect, useId, useRef } from "react"
import type { RealtimePostgresInsertPayload } from "@supabase/supabase-js"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"

type Options<Row extends Record<string, unknown>> = {
  /** таблиця в схемі public */
  table: string
  /** фільтр Realtime, напр. `conversation_id=eq.<id>` */
  filter?: string
  enabled?: boolean
  onInsert: (row: Row) => void
}

/**
 * Підписка на INSERT у таблиці через Supabase Realtime.
 * У демо-режимі (без .env) нічого не робить.
 */
export function useRealtime<Row extends Record<string, unknown>>({
  table,
  filter,
  enabled = true,
  onInsert,
}: Options<Row>) {
  const handler = useRef(onInsert)
  // окремий канал на кожного підписника (однакові topic у supabase-js конфліктують)
  const uid = useId()
  useEffect(() => {
    handler.current = onInsert
  }, [onInsert])

  useEffect(() => {
    const supabase = getSupabaseBrowserClient()
    if (!supabase || !enabled) return

    const channel = supabase
      .channel(`rt:${table}:${filter ?? "all"}:${uid}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table, filter },
        (payload: RealtimePostgresInsertPayload<Row>) => handler.current(payload.new)
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [table, filter, enabled, uid])
}

/**
 * Індикатор «друкує…» через Realtime Broadcast.
 * Повертає функцію notifyTyping(); onTyping викликається, коли друкує співрозмовник.
 */
export function useTypingChannel(conversationId: string, userId: string, onTyping: (userId: string) => void) {
  const cb = useRef(onTyping)
  useEffect(() => {
    cb.current = onTyping
  }, [onTyping])
  const channelRef = useRef<ReturnType<NonNullable<ReturnType<typeof getSupabaseBrowserClient>>["channel"]> | null>(null)

  useEffect(() => {
    const supabase = getSupabaseBrowserClient()
    if (!supabase || !conversationId) return
    const channel = supabase
      .channel(`typing:${conversationId}`)
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        if (payload?.userId && payload.userId !== userId) cb.current(payload.userId as string)
      })
      .subscribe()
    channelRef.current = channel
    return () => {
      channelRef.current = null
      void supabase.removeChannel(channel)
    }
  }, [conversationId, userId])

  return () => {
    void channelRef.current?.send({ type: "broadcast", event: "typing", payload: { userId } })
  }
}
