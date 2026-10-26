"use client"

import { useEffect, useRef, useState } from "react"
import type { Post } from "@/types"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Справжні перегляди: коли допис потрапляє у вікно, пишемо перегляд через RPC
 * record_post_view (1 на користувача, автор не рахується) і показуємо актуальний view_count.
 */
export function usePostViews(post: Post) {
  const [views, setViews] = useState(post.views ?? 0)
  const ref = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const supabase = getSupabaseBrowserClient()
    const el = ref.current
    if (!supabase || !el || !UUID_RE.test(post.id)) return
    let done = false
    const io = new IntersectionObserver(
      (entries) => {
        if (done || !entries.some((e) => e.isIntersecting)) return
        done = true
        io.disconnect()
        void supabase.rpc("record_post_view", { p_post: post.id }).then(({ data }) => {
          if (typeof data === "number") setViews(data)
        })
      },
      { rootMargin: "150px 0px" }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [post.id])

  return { views, ref }
}
