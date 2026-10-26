"use client"

import Link from "next/link"
import { useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { AnimatePresence, motion } from "framer-motion"
import { AtSign, CheckCheck, Clock, Heart, Mail, MessageCircle, Repeat2, UserPlus, UserRoundPlus } from "lucide-react"
import { SparkIcon } from "@/components/icons"
import type { Notification, NotificationType } from "@/types"
import { Button } from "@/components/ui/button"
import { UserAvatar } from "@/components/user-avatar"
import { timeAgoLong } from "@/lib/format"
import { frameByKey } from "@/lib/frames"
import { isMockMode } from "@/lib/env"
import { useNow } from "@/hooks/useNow"
import { markNotificationsRead } from "@/lib/actions/social"
import { useRealtime } from "@/hooks/useRealtime"
import { refreshUnread } from "@/hooks/useUnreadCounts"
import { cn } from "@/lib/utils"

const LightIcon = (props: { className?: string }) => <SparkIcon filled className={props.className} />

const META: Record<NotificationType, { icon: React.ComponentType<{ className?: string }>; verb: string; code: string; tone?: string }> = {
  light: { icon: LightIcon, verb: "дав(-ла) світло вашому допису", code: "світло", tone: "text-glow" },
  like: { icon: Heart, verb: "вподобав(-ла) ваш допис", code: "вподобання" },
  reply: { icon: MessageCircle, verb: "відповів(-ла) на ваш допис", code: "відповідь" },
  follow: { icon: UserPlus, verb: "читає вас", code: "підписка" },
  follow_request: { icon: UserRoundPlus, verb: "хоче читати вас", code: "запит" },
  friend_joined: { icon: UserRoundPlus, verb: "приєднався(-лась) до Lumyn за вашим інвайтом", code: "запрошення", tone: "text-brand" },
  repost: { icon: Repeat2, verb: "поширив(-ла) ваш допис", code: "репост" },
  mention: { icon: AtSign, verb: "згадав(-ла) вас", code: "згадка" },
  message: { icon: Mail, verb: "надіслав(-ла) повідомлення", code: "повідомлення" },
  frame_expired: { icon: Clock, verb: "більше не діє — термін вичерпано", code: "рамка", tone: "text-brand" },
}

const FILTERS: { value: "all" | NotificationType; label: string }[] = [
  { value: "all", label: "Усі" },
  { value: "light", label: "Світло" },
  { value: "reply", label: "Відповіді" },
  { value: "mention", label: "Згадки" },
  { value: "follow", label: "Підписки" },
  { value: "friend_joined", label: "Друзі" },
  { value: "frame_expired", label: "Рамки" },
  { value: "message", label: "Повідомлення" },
]

function groupLabel(iso: string, now: number) {
  if (!now) return "Сьогодні"
  const h = (now - Date.parse(iso)) / 3_600_000
  if (h < 24) return "Сьогодні"
  if (h < 48) return "Вчора"
  return "Раніше"
}

export function ActivityLog({ items: initial, loading = false }: { items: Notification[]; loading?: boolean }) {
  // прочитане локально: усе до моменту «прочитати все» + окремі id (нові з Realtime лишаються новими)
  const [readUntil, setReadUntil] = useState<string | null>(null)
  const [readIds, setReadIds] = useState<string[]>([])
  const items = useMemo(
    () => initial.map((n) => (n.read || readIds.includes(n.id) || (readUntil && n.createdAt <= readUntil) ? { ...n, read: true } : n)),
    [initial, readIds, readUntil]
  )
  const now = useNow()
  const router = useRouter()
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Supabase: нове сповіщення → перезавантажити серверний список
  useRealtime<{ id: string }>({
    table: "notifications",
    enabled: !isMockMode && !loading,
    onInsert: () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current)
      refreshTimer.current = setTimeout(() => router.refresh(), 400)
    },
  })
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["value"]>("all")

  const visible = useMemo(() => items.filter((n) => filter === "all" || n.type === filter), [items, filter])
  const groups = useMemo(() => {
    const map = new Map<string, Notification[]>()
    for (const n of visible) {
      const k = groupLabel(n.createdAt, now)
      map.set(k, [...(map.get(k) ?? []), n])
    }
    return [...map.entries()]
  }, [visible, now])

  const unread = items.filter((n) => !n.read).length
  const stats = [
    { label: "Нових", value: unread },
    { label: "Світла", value: items.filter((n) => n.type === "light" || n.type === "like").length },
    { label: "Відповідей", value: items.filter((n) => n.type === "reply" || n.type === "mention").length },
    { label: "Нових читачів", value: items.filter((n) => n.type === "follow" || n.type === "friend_joined").length },
  ]

  return (
    <div className="mx-auto w-full max-w-[880px] px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.03em]">Активність</h1>
          <p className="mt-1 text-sm text-muted-foreground">Лише справжні події: без «вас давно не було» і без стріків.</p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          disabled={!unread}
          onClick={() => {
            setReadUntil(items.reduce((max, n) => (n.createdAt > max ? n.createdAt : max), ""))
            if (!isMockMode) void markNotificationsRead().then(() => refreshUnread())
          }}
        >
          <CheckCheck /> Позначити все прочитаним
        </Button>
      </div>

      {/* Метрики, як в Observability */}
      <div className="mt-6 grid grid-cols-2 overflow-hidden rounded-lg border sm:grid-cols-4">
        {stats.map((s, i) => (
          <div key={s.label} className={cn("px-4 py-3.5", i > 0 && "border-l max-sm:[&:nth-child(3)]:border-l-0", i > 1 && "max-sm:border-t")}>
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="mt-1 font-mono text-2xl font-medium tracking-tight tabular">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Фільтри */}
      <div className="mt-6 flex gap-1 overflow-x-auto no-scrollbar">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={cn(
              "relative h-8 shrink-0 rounded-full px-3 text-sm transition-colors",
              filter === f.value ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {filter === f.value && (
              <motion.span layoutId="activity-filter" className="absolute inset-0 rounded-full border bg-muted" transition={{ type: "spring", stiffness: 500, damping: 38 }} />
            )}
            <span className="relative">{f.label}</span>
          </button>
        ))}
      </div>

      {/* Лог */}
      <div className="mt-4 overflow-hidden rounded-lg border">
        <div className="hidden grid-cols-[minmax(0,1fr)_96px_120px] gap-4 border-b bg-subtle px-4 py-2 font-mono text-[11px] tracking-wider text-muted-foreground uppercase sm:grid">
          <span>Подія</span>
          <span>Тип</span>
          <span className="text-right">Коли</span>
        </div>
        <AnimatePresence initial={false} mode="popLayout">
          {groups.map(([label, list]) => (
            <motion.div key={label} layout>
              <div className="border-b bg-background px-4 pt-3 pb-1.5 text-xs font-medium text-muted-foreground">{label}</div>
              {list.map((n) => {
                const meta = META[n.type]
                const Icon = meta.icon
                const frameName = n.type === "frame_expired" ? frameByKey(n.frameKey)?.name ?? n.frameKey : null
                const href =
                  n.type === "frame_expired"
                    ? "/settings/frames"
                    : n.type === "message"
                      ? `/messages/${n.actor.username}`
                      : n.postId
                        ? `/post/${n.postId}`
                        : `/${n.actor.username}`
                return (
                  <motion.div key={n.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="border-b">
                    <Link
                      href={href}
                      onClick={() => {
                        setReadIds((ids) => [...ids, n.id])
                        if (!isMockMode && !n.read) void markNotificationsRead([n.id]).then(() => refreshUnread())
                      }}
                      className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-3 transition-colors hover:bg-subtle sm:grid-cols-[minmax(0,1fr)_96px_120px]"
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <span
                          aria-label={n.read ? "Прочитано" : "Нове"}
                          className={cn("size-2 shrink-0 rounded-full transition-colors", n.read ? "bg-border" : "bg-brand shadow-[0_0_0_3px_color-mix(in_oklab,var(--brand)_20%,transparent)]")}
                        />
                        <span className="relative shrink-0">
                          <UserAvatar
                            user={n.actor}
                            size="md"
                            frame={n.type === "frame_expired" ? n.frameKey : undefined}
                            frameExpiresAt={n.type === "frame_expired" ? "2099-01-01" : undefined}
                          />
                          <span className={cn("absolute -right-1 -bottom-1 inline-flex size-[18px] items-center justify-center rounded-full border bg-background", meta.tone)}>
                            <Icon className="size-2.5" />
                          </span>
                        </span>
                        <span className="min-w-0">
                          {n.type === "frame_expired" ? (
                            <span className="block truncate text-sm">
                              <span className="font-medium">Рамка «{frameName ?? "невідома"}»</span>{" "}
                              <span className="text-muted-foreground">{meta.verb}</span>
                            </span>
                          ) : (
                            <span className="block truncate text-sm">
                              <span className="font-medium">{n.actor.name}</span>{" "}
                              <span className="text-muted-foreground">{meta.verb}</span>
                            </span>
                          )}
                          {n.preview && <span className="block truncate font-mono text-xs text-muted-foreground">{n.preview}</span>}
                        </span>
                      </span>
                      <span className="hidden sm:block">
                        <span className="inline-flex h-5 items-center rounded border px-1.5 font-mono text-[11px] text-muted-foreground">{meta.code}</span>
                      </span>
                      <span className="text-right font-mono text-xs whitespace-nowrap text-muted-foreground tabular">{now ? timeAgoLong(n.createdAt, now) : ""}</span>
                    </Link>
                  </motion.div>
                )
              })}
            </motion.div>
          ))}
        </AnimatePresence>
        {visible.length === 0 && (
          <p className="px-4 py-12 text-center text-sm text-muted-foreground">{loading ? "Завантаження…" : "Тут поки порожньо."}</p>
        )}
      </div>
    </div>
  )
}
