import type { Post } from "@/types"

/**
 * Механіка «Світла» та Glow-дописів. Тримайте синхронно з
 * supabase/migrations/0002_mvp.sql (glow_* функції).
 */
export const GLOW = {
  /** скільки живе новий Glow-допис */
  baseHours: 24,
  /** +година за кожне світло */
  hoursPerLight: 1,
  /** стеля: не довше 72 год від створення */
  maxHours: 72,
  /** стільки світла — і допис стає постійним */
  permanentAt: 25,
} as const

const H = 3_600_000

/** Детермінований термін (як у тригері apply_light_change). null — постійний. */
export function computeExpiry(createdAt: string, lights: number): string | null {
  if (lights >= GLOW.permanentAt) return null
  const created = Date.parse(createdAt)
  const hours = Math.min(GLOW.baseHours + lights * GLOW.hoursPerLight, GLOW.maxHours)
  return new Date(created + hours * H).toISOString()
}

/** Застосувати світло / його зняття до Glow-допису (оптимістично на клієнті). */
export function applyLight(post: Pick<Post, "mode" | "createdAt" | "expiresAt">, lights: number) {
  if (post.mode !== "glow") return { mode: post.mode, expiresAt: post.expiresAt ?? null, becamePermanent: false }
  const expiresAt = computeExpiry(post.createdAt, lights)
  return {
    mode: expiresAt ? ("glow" as const) : ("permanent" as const),
    expiresAt,
    becamePermanent: expiresAt === null,
  }
}

export function remainingMs(expiresAt: string | null | undefined, now: number) {
  if (!expiresAt) return Infinity
  return Math.max(0, Date.parse(expiresAt) - now)
}

/**
 * «Життя» 0..1 для CSS-змінної --life: повна яскравість, поки лишається ≥ 24 год,
 * далі допис поступово знебарвлюється і тьмяніє до згасання.
 */
export function lifeFraction(expiresAt: string | null | undefined, now: number) {
  const ms = remainingMs(expiresAt, now)
  if (ms === Infinity) return 1
  return Math.max(0, Math.min(1, ms / (GLOW.baseHours * H)))
}

/** «ще 5 год», «ще 40 хв», «згасає» */
export function remainingLabel(expiresAt: string | null | undefined, now: number) {
  const ms = remainingMs(expiresAt, now)
  if (ms === Infinity) return ""
  if (ms <= 0) return "згас"
  const m = Math.round(ms / 60_000)
  if (m < 60) return `ще ${m} хв`
  const h = Math.floor(m / 60)
  return `ще ${h} год`
}
