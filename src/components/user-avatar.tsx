"use client"

import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import { hashString } from "@/lib/format"
import { frameActive } from "@/lib/frames"
import { hiResAvatarUrl } from "@/lib/avatar"
import type { User } from "@/types"

const dots = {
  xs: "size-1.5 ring-1",
  sm: "size-2 ring-2",
  md: "size-2.5 ring-2",
  lg: "size-2.5 ring-2",
  xl: "size-3 ring-2",
  "2xl": "size-4 ring-[3px] right-[6%] bottom-[6%]",
} as const

const sizes = {
  xs: "size-5",
  sm: "size-7",
  md: "size-9",
  lg: "size-10",
  xl: "size-14",
  "2xl": "size-28",
} as const

/** Градієнт, як у дефолтних аватарах Vercel — детермінований від username. */
const PALETTE: [string, string][] = [
  ["#ff6b6b", "#f7b267"],
  ["#4f8cff", "#7af0ff"],
  ["#a78bfa", "#f0abfc"],
  ["#22c55e", "#bef264"],
  ["#06b6d4", "#3b82f6"],
  ["#f43f5e", "#a855f7"],
  ["#f59e0b", "#ef4444"],
  ["#14b8a6", "#a3e635"],
  ["#6366f1", "#ec4899"],
  ["#0ea5e9", "#22d3ee"],
]

/** перемішування бітів (murmur3 finalizer) — рівномірніший розподіл кольорів */
function mix(x: number) {
  x ^= x >>> 16
  x = Math.imul(x, 0x7feb352d)
  x ^= x >>> 15
  x = Math.imul(x, 0x846ca68b)
  x ^= x >>> 16
  return x >>> 0
}

export function avatarGradient(seed: string) {
  const [a, b] = PALETTE[mix(hashString(seed) + 132) % PALETTE.length]
  return `linear-gradient(135deg, ${a} 0%, ${b} 100%)`
}

export function UserAvatar({
  user,
  size = "lg",
  className,
  showOnline = false,
  frame,
  frameExpiresAt,
}: {
  user: Pick<User, "username" | "name" | "avatarUrl" | "online"> & Partial<Pick<User, "frame" | "frameExpiresAt">>
  size?: keyof typeof sizes
  className?: string
  showOnline?: boolean
  /** явна рамка (перекриває user.frame) */
  frame?: string | null
  frameExpiresAt?: string | null
}) {
  const [broken, setBroken] = useState<string | null>(null)
  const rawAvatar = user.avatarUrl ?? null
  // Google віддає 96×96 за замовчуванням — просимо 512×512, інакше аватар мильний
  const src = rawAvatar && broken !== rawAvatar ? hiResAvatarUrl(rawAvatar) : null
  const imgRef = useRef<HTMLImageElement>(null)
  // картинка могла впасти ще до гідрації, тоді onError не спрацює
  useEffect(() => {
    const img = imgRef.current
    if (src && img?.complete && img.naturalWidth === 0) setBroken(rawAvatar)
  }, [src, rawAvatar])
  // час перевіряємо лише після монтування: Date.now() у пререндері заборонений
  const [nowMs, setNowMs] = useState(0)
  useEffect(() => {
    setNowMs(Date.now())
    const t = setInterval(() => setNowMs(Date.now()), 60_000)
    return () => clearInterval(t)
  }, [])
  // рамка: явний проп > поле користувача (автори постів, профілі, чат)
  const effFrame = frame ?? user.frame ?? null
  const activeFrame = effFrame && frameActive(effFrame, nowMs ? (frameExpiresAt ?? user.frameExpiresAt) : null) ? effFrame : null
  const avatar = (
    <span className={cn("relative inline-flex shrink-0", sizes[size], className)}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- аватари з будь-яких доменів (GitHub, Google)
        <img
          ref={imgRef}
          src={src}
          alt=""
          referrerPolicy="no-referrer"
          onError={() => setBroken(rawAvatar)}
          className="size-full rounded-full object-cover"
        />
      ) : (
        <span
          role="img"
          aria-label={user.name}
          className="size-full rounded-full"
          style={{ backgroundImage: avatarGradient(user.username) }}
        />
      )}
      <span className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-inset ring-foreground/10" />
      {!activeFrame && showOnline && user.online && (
        <span className={cn("absolute right-0 bottom-0 rounded-full bg-emerald-500 ring-background", dots[size])} />
      )}
    </span>
  )
  if (!activeFrame) return avatar
  return (
    <span className={cn("avatar-frame shrink-0", `frame-${activeFrame}`)}>
      <span className="avatar-inner">{avatar}</span>
      {/* статус — прямий нащадок рамки, щоб не ховався під її оверлеєм */}
      {showOnline && user.online && (
        <span
          className={cn(
            "avatar-status absolute right-0 bottom-0 rounded-full bg-emerald-500 ring-background",
            dots[size],
          )}
        />
      )}
    </span>
  )
}
