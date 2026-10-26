"use client"

import { useRef, useState, useTransition } from "react"
import { toast } from "sonner"
import { toggleLight } from "@/lib/actions/posts"
import { applyLight, GLOW } from "@/lib/glow"
import type { Post } from "@/types"

export type LightState = Pick<Post, "lights" | "lit" | "mode" | "expiresAt">

/**
 * Оптимістичне «світло»: лічильник, подовження Glow, перетворення на постійний.
 * onLit викликається на кожне нове світло (для «спалаху» картки).
 */
export function usePostLight(post: Post, onLit?: (becamePermanent: boolean) => void) {
  const [state, setState] = useState<LightState>({
    lights: post.lights,
    lit: post.lit,
    mode: post.mode,
    expiresAt: post.expiresAt ?? null,
  })
  const [, startTransition] = useTransition()
  const busy = useRef(false)

  const toggle = () => {
    // поки запит у дорозі — ігноруємо повторні кліки (інакше стан розходиться з БД)
    if (busy.current) return
    busy.current = true
    const prev = state
    const lit = !prev.lit
    const lights = Math.max(0, prev.lights + (lit ? 1 : -1))
    // постійність не відкочується (як у тригері)
    const glow = prev.mode === "glow" ? applyLight({ ...post, mode: "glow" }, lights) : { mode: prev.mode, expiresAt: prev.expiresAt, becamePermanent: false }
    const next: LightState = { lit, lights, mode: glow.mode, expiresAt: glow.expiresAt }
    setState(next)
    if (lit) onLit?.(glow.becamePermanent)
    if (glow.becamePermanent) {
      toast("Допис став постійним", {
        description: `${GLOW.permanentAt} світла — тепер він не згасне.`,
      })
    }
    startTransition(async () => {
      const res = await toggleLight(post.id, lit)
      busy.current = false
      if (!res.ok) {
        setState(prev)
        toast.error(res.error)
      }
    })
  }

  return { ...state, toggle }
}
