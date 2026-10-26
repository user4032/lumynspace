"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { fetchFeedPage } from "@/lib/feed"
import { scorePost } from "@/lib/mock-data"
import { isMockMode } from "@/lib/env"
import { useViewer } from "@/lib/viewer-store"
import type { FeedTab, Post } from "@/types"

type State = {
  posts: Post[]
  cursor: number | null
  loading: boolean
  error: string | null
  /** id першої сторінки — лише їм потрібна «каскадна» поява */
  firstPage: Set<string>
  /** скільки постів зверху новіші за останній побачений візит */
  newCount: number
}

const seenKey = (tab: FeedTab) => `lumyn:feed-head:${tab}`

/** Скільки верхніх постів новіші за «останній побачений» час цієї вкладки */
function newSinceSeen(tab: FeedTab, page: Post[]): number {
  if (typeof window === "undefined" || !page.length) return 0
  try {
    const seen = window.localStorage.getItem(seenKey(tab))
    if (!seen) return 0
    return Math.min(page.filter((p) => p.createdAt > seen && !p.id.startsWith("local-")).length, page.length)
  } catch {
    return 0
  }
}

/**
 * Нескінченна стрічка: сторінки підвантажуються, коли sentinel потрапляє у viewport.
 * Зміна тюнера переранжовує вже завантажене (у демо — миттєво, з анімацією перестановки;
 * із Supabase — перезапитом for_you_feed з новими вагами).
 */
export function useInfiniteFeed(tab: FeedTab) {
  const prefs = useViewer((s) => s.feedPrefs)
  const blocked = useViewer((s) => s.blocked)
  const muted = useViewer((s) => s.muted)
  const hiddenPosts = useViewer((s) => s.hiddenPosts)
  const hiddenAuthors = useMemo(() => [...blocked, ...muted], [blocked, muted])

  const [state, setState] = useState<State>({ posts: [], cursor: 0, loading: true, error: null, firstPage: new Set(), newCount: 0 })
  const loadingRef = useRef(false)
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const stateRef = useRef(state)
  const prefsRef = useRef(prefs)
  const hiddenRef = useRef(hiddenAuthors)
  useEffect(() => {
    stateRef.current = state
    prefsRef.current = prefs
    hiddenRef.current = hiddenAuthors
  })

  const loadMore = useCallback(
    async (cursor: number | null, reset = false) => {
      if (cursor === null || loadingRef.current) return
      loadingRef.current = true
      setState((s) => ({ ...s, loading: true, error: null }))
      try {
        const loaded = reset ? [] : stateRef.current.posts
        const page = await fetchFeedPage(tab, {
          cursor,
          prefs: prefsRef.current,
          exclude: loaded.map((p) => p.id),
          hiddenAuthors: hiddenRef.current,
          before: loaded.at(-1)?.createdAt ?? null,
        })
        setState((s) => {
          const base = reset ? [] : s.posts
          const seen = new Set(base.map((p) => p.id))
          return {
            posts: [...base, ...page.posts.filter((p) => !seen.has(p.id))],
            cursor: page.nextCursor,
            loading: false,
            error: null,
            firstPage: reset ? new Set(page.posts.map((p) => p.id)) : s.firstPage,
            newCount: reset ? newSinceSeen(tab, page.posts) : s.newCount,
          }
        })
      } catch (e) {
        setState((s) => ({ ...s, loading: false, error: e instanceof Error ? e.message : "Помилка" }))
      } finally {
        loadingRef.current = false
      }
    },
    [tab]
  )

  // перше завантаження / зміна вкладки
  useEffect(() => {
    loadingRef.current = false
    void loadMore(0, true)
  }, [loadMore])

  // тюнер змінився → переранжувати
  const firstPrefs = useRef(true)
  useEffect(() => {
    if (firstPrefs.current) {
      firstPrefs.current = false
      return
    }
    if (tab !== "for-you") return
    if (isMockMode) {
      setState((s) => ({
        ...s,
        posts: [...s.posts]
          .map((p) => ({ p, score: p.id.startsWith("local-") ? Infinity : scorePost(p, prefs) }))
          .sort((a, b) => b.score - a.score)
          .map(({ p }) => p),
      }))
      return
    }
    const t = setTimeout(() => void loadMore(0, true), 450)
    return () => clearTimeout(t)
  }, [prefs, tab, loadMore])

  // спостерігач за кінцем списку
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMore(stateRef.current.cursor)
      },
      { rootMargin: "600px 0px" }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [loadMore, state.cursor])

  const prepend = useCallback((post: Post) => {
    setState((s) => ({ ...s, posts: [post, ...s.posts] }))
  }, [])

  /** «Побачив нові» — запам'ятовуємо голову стрічки й ховаємо лічильник */
  const clearNew = useCallback(() => {
    setState((s) => {
      const head = s.posts.find((p) => !p.id.startsWith("local-"))
      if (head) {
        try {
          window.localStorage.setItem(seenKey(tab), head.createdAt)
        } catch {
          /* приватний режим */
        }
      }
      return { ...s, newCount: 0 }
    })
  }, [tab])

  /** оптимістичний допис → збережений (або прибрати, якщо не вдалося) */
  const settle = useCallback((localId: string, post: Post | null) => {
    setState((s) => ({
      ...s,
      posts: post ? s.posts.map((p) => (p.id === localId ? post : p)) : s.posts.filter((p) => p.id !== localId),
    }))
  }, [])

  const visible = useMemo(() => {
    const hiddenA = new Set(hiddenAuthors)
    const hiddenP = new Set(hiddenPosts)
    return state.posts.filter((p) => !hiddenA.has(p.author.id) && !hiddenP.has(p.id))
  }, [state.posts, hiddenAuthors, hiddenPosts])

  return {
    posts: visible,
    firstPage: state.firstPage,
    loading: state.loading,
    error: state.error,
    hasMore: state.cursor !== null,
    sentinelRef,
    prepend,
    settle,
    retry: () => loadMore(state.cursor),
    newCount: state.newCount,
    clearNew,
  }
}
