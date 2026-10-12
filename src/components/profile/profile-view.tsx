"use client"

import Image from "next/image"
import Link from "next/link"
import { useState } from "react"
import { motion } from "framer-motion"
import type { Community, Post, User } from "@/types"
import {
  Ban,
  CalendarDays,
  Flag,
  Link2,
  Lock,
  Mail,
  MapPin,
  MoreHorizontal,
  Palette,
  Pencil,
  Quote,
  Timer,
  VolumeX,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { UserAvatar } from "@/components/user-avatar"
import { VerifiedBadge } from "@/components/verified-badge"
import { Composer } from "@/components/feed/composer"
import { PostCard } from "@/components/feed/post-card"
import { formatCount, formatJoined, plural } from "@/lib/format"
import { cn } from "@/lib/utils"
import { accentVars, DEFAULT_ACCENT } from "@/lib/accent"
import { remainingLabel } from "@/lib/glow"
import { useNow } from "@/hooks/useNow"
import { useMe, useViewer, viewerActions } from "@/lib/viewer-store"
import { useModeration } from "@/components/moderation/use-moderation"
import { ReportDialog } from "@/components/moderation/report-dialog"
import { CloseFriendsIcon } from "@/components/icons"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { toast } from "sonner"
import { setCloseFriend } from "@/lib/actions/viewer"
import { isMockMode } from "@/lib/env"
import { FollowButton } from "./follow-button"
import { ProfileBanner } from "./profile-banner"
import { NowPlaying, TopFour } from "./profile-widgets"
import { SpotifyNow } from "./spotify-now"

type Tab = "wall" | "photos" | "friends" | "communities"
const TABS: { value: Tab; label: string }[] = [
  { value: "wall", label: "Стіна" },
  { value: "photos", label: "Фото" },
  { value: "friends", label: "Друзі" },
  { value: "communities", label: "Спільноти" },
]

function Stat({ value, label, href }: { value: number; label: string; href?: string }) {
  const content = (
    <span className="text-sm">
      <span className="font-semibold text-foreground tabular">{formatCount(value)}</span>{" "}
      <span className="text-muted-foreground">{label}</span>
    </span>
  )
  if (href) {
    return (
      <Link href={href} className="hover:underline">
        {content}
      </Link>
    )
  }
  return content
}

function ProfileMenu({ user }: { user: User }) {
  const { mute, block } = useModeration()
  const { closeFriends, muted } = useViewer()
  const [reportOpen, setReportOpen] = useState(false)
  const isClose = closeFriends.includes(user.id)
  const isMuted = muted.includes(user.id)
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="secondary" size="icon-sm" className="rounded-full" aria-label="Ще">
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuItem
            onSelect={() => {
              viewerActions.toggle("closeFriends", user.id, !isClose)
              void setCloseFriend(user.id, !isClose)
              toast(isClose ? `@${user.username} більше не в близьких` : `@${user.username} тепер у близьких друзях`, {
                description: isClose ? undefined : "Бачитиме дописи із зеленою позначкою. Сповіщення не надсилаємо.",
              })
            }}
          >
            <CloseFriendsIcon className="text-close" /> {isClose ? "Прибрати з близьких" : "Додати в близькі друзі"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => mute(user, !isMuted)}>
            <VolumeX /> {isMuted ? "Повернути у стрічку" : `Заглушити @${user.username}`}
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={() => block(user, true)}>
            <Ban /> Заблокувати
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={() => setReportOpen(true)}>
            <Flag /> Поскаржитися
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ReportDialog open={reportOpen} onOpenChange={setReportOpen} targetType="profile" targetId={user.id} subject={`профіль @${user.username}`} />
    </>
  )
}

function GateCard({ icon, title, text, action }: { icon: React.ReactNode; title: string; text: string; action?: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center px-6 py-16 text-center"
    >
      <span className="mb-4 grid size-14 place-items-center rounded-2xl border bg-card text-muted-foreground">{icon}</span>
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">{text}</p>
      {action && <div className="mt-5">{action}</div>}
    </motion.div>
  )
}

export function ProfileView({
  user: serverUser,
  isMe,
  following = false,
  requested = false,
  posts,
  friends,
  top4Users = [],
  photos,
  communities,
}: {
  user: User
  isMe: boolean
  following?: boolean
  /** Supabase: запит на підписку чекає схвалення */
  requested?: boolean
  posts: Post[]
  friends: User[]
  /** Supabase: профілі з widgets.top4 (у демо Топ-4 бере людей із мок-даних) */
  top4Users?: User[]
  photos: string[]
  communities: Community[]
}) {
  const me = useMe()
  // Supabase: свій профіль — з viewer-store (миттєво після збереження в налаштуваннях), щойно він завантажився
  const user = isMe && (isMockMode || me.id === serverUser.id) ? me : serverUser
  const { blocked, people = [] } = useViewer()
  const { block } = useModeration()
  const now = useNow()
  const [tab, setTab] = useState<Tab>("wall")
  const [wall, setWall] = useState(posts)
  const isBlocked = !isMe && blocked.includes(user.id)
  const locked = !isMe && user.isPrivate && !following
  const accent = user.accentColor ?? DEFAULT_ACCENT
  const statusLive = user.status && (!user.statusExpiresAt || Date.parse(user.statusExpiresAt) > now)

  return (
    <div style={accentVars(accent)} className="[--brand:var(--accent-user)]">
      <ProfileBanner style={user.bannerStyle ?? "aurora"} coverUrl={user.coverUrl}>
        {isMe && (
          <Button
            variant="secondary"
            size="xs"
            asChild
            className="absolute right-3 bottom-3 border-white/20 bg-black/40 text-white backdrop-blur hover:bg-black/60"
          >
            <Link href="/settings#style">
              <Palette /> Стиль профілю
            </Link>
          </Button>
        )}
      </ProfileBanner>

      {/* Шапка профілю */}
      <div className="px-4 pb-4">
        <div className="flex items-end justify-between">
          <span className="relative -mt-14">
            <span
              aria-hidden
              className="absolute -inset-1.5 rounded-full opacity-70 blur-md"
              style={{ background: "conic-gradient(from 140deg, var(--accent-user), transparent 40%, var(--accent-user))" }}
            />
            <UserAvatar user={user} size="2xl" className="relative size-[108px] rounded-full ring-4 ring-background" showOnline={!isBlocked} />
          </span>
          <div className="flex items-center gap-2 pt-3">
            {isMe ? (
              <Button variant="secondary" size="sm" asChild className="rounded-full">
                <Link href="/settings">
                  <Pencil /> Редагувати профіль
                </Link>
              </Button>
            ) : isBlocked ? (
              <Button variant="secondary" size="sm" className="rounded-full" onClick={() => block(user, false)}>
                Розблокувати
              </Button>
            ) : (
              <>
                <ProfileMenu user={user} />
                {!locked && (
                  <Button variant="secondary" size="icon-sm" asChild className="rounded-full" aria-label="Написати">
                    <Link href={`/messages/${user.username}`}>
                      <Mail />
                    </Link>
                  </Button>
                )}
                <FollowButton userId={user.id} initial={following} requested={requested} isPrivate={user.isPrivate} accent />
              </>
            )}
          </div>
        </div>

        <div className="mt-3">
          <h1 className="flex items-center gap-1.5 text-[22px] leading-tight font-semibold tracking-[-0.02em]">
            {user.name}
            {user.verified && <VerifiedBadge className="size-[18px]" />}
            {user.isPrivate && <Lock className="size-4 text-muted-foreground" aria-label="Приватний акаунт" />}
          </h1>
          <p className="text-sm text-muted-foreground">@{user.username}</p>
        </div>

        {statusLive && !isBlocked && (
          <motion.p
            layout
            className="mt-3 inline-flex max-w-full items-center gap-2 rounded-full border px-3 py-1.5 text-sm"
            style={{
              borderColor: "color-mix(in oklab, var(--accent-user) 35%, var(--border))",
              background: "color-mix(in oklab, var(--accent-user) 8%, transparent)",
            }}
          >
            <Quote className="size-3.5 shrink-0 text-[var(--accent-user)]" />
            <span className="truncate">{user.status}</span>
            {user.statusExpiresAt && (
              <span className="inline-flex shrink-0 items-center gap-1 font-mono text-[11px] text-muted-foreground">
                <Timer className="size-3" /> {remainingLabel(user.statusExpiresAt, now)}
              </span>
            )}
          </motion.p>
        )}

        {!isBlocked && user.bio && <p className="mt-3 text-[15px] leading-relaxed">{user.bio}</p>}

        {!isBlocked && (
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
            {user.location && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-4" /> {user.location}
              </span>
            )}
            {user.website && (
              <a href={`https://${user.website}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-[var(--accent-user)] hover:underline">
                <Link2 className="size-4" /> {user.website}
              </a>
            )}
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="size-4" /> На Lumyn з {formatJoined(user.joinedAt)}
            </span>
          </div>
        )}

        {!isBlocked && (
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1">
            <Stat value={user.followers} label={plural(user.followers, ["читач", "читачі", "читачів"])} href={`/${user.username}/followers`} />
            <Stat value={user.following} label="читає" href={`/${user.username}/following`} />
            <Stat value={user.postsCount} label={plural(user.postsCount, ["допис", "дописи", "дописів"])} />
          </div>
        )}

        {!isBlocked && !locked && (user.widgets?.top4?.length || user.widgets?.now_playing || isMe) ? (
          <div className="mt-4 grid gap-2 sm:grid-cols-[1.3fr_1fr]">
            <TopFour ids={user.widgets?.top4} pool={[...top4Users, ...friends, ...(isMe ? people : [])]} />
            {isMe ? <SpotifyNow userId={user.id} /> : <NowPlaying track={user.widgets?.now_playing} />}
          </div>
        ) : null}
      </div>

      {isBlocked ? (
        <div className="border-t">
          <GateCard
            icon={<Ban className="size-6" />}
            title={`Ви заблокували @${user.username}`}
            text="Ви не бачите дописів одне одного, не можете писати й підписуватися. Людина не отримує про це сповіщення."
          />
        </div>
      ) : locked ? (
        <div className="border-t">
          <GateCard
            icon={<Lock className="size-6" />}
            title="Це приватний акаунт"
            text={`Дописи @${user.username} бачать лише схвалені читачі. Надішліть запит — і чекайте на відповідь.`}
          />
        </div>
      ) : (
        <>
          {/* Вкладки */}
          <div role="tablist" className="sticky top-14 z-20 flex border-b bg-background/75 backdrop-blur-xl">
            {TABS.map((t) => (
              <button
                key={t.value}
                role="tab"
                aria-selected={tab === t.value}
                onClick={() => setTab(t.value)}
                className={cn(
                  "relative h-12 flex-1 text-sm font-medium transition-colors hover:bg-subtle",
                  tab === t.value ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t.label}
                {tab === t.value && (
                  <motion.span
                    layoutId="profile-tab"
                    transition={{ type: "spring", stiffness: 500, damping: 38 }}
                    className="absolute inset-x-6 bottom-0 h-[2px] rounded-full bg-[var(--accent-user)]"
                  />
                )}
              </button>
            ))}
          </div>

          {tab === "wall" && (
            <>
              {isMe && (
                <Composer
                  compact
                  placeholder="Що нового?"
                  onPublish={(p) => setWall((w) => [p, ...w])}
                  onSettled={(localId, saved) =>
                    setWall((w) => (saved ? w.map((p) => (p.id === localId ? saved : p)) : w.filter((p) => p.id !== localId)))
                  }
                />
              )}
              {wall.length === 0 && (
                <GateCard icon={<Pencil className="size-6" />} title="Поки тихо" text="Тут з'являться дописи." />
              )}
              {wall.map((p, i) => (
                <PostCard key={p.clientKey ?? p.id} post={p} index={i} />
              ))}
            </>
          )}

          {tab === "photos" && (
            <div className="grid grid-cols-3 gap-1 p-1">
              {photos.length === 0 && !isMockMode && (
                <div className="col-span-3">
                  <GateCard icon={<Pencil className="size-6" />} title="Фото поки немає" text="Тут з'являться фото з дописів." />
                </div>
              )}
              {(isMockMode ? [...photos, ...photos] : photos).map((src, i) => (
                <div key={i} className="relative aspect-square overflow-hidden bg-muted">
                  <Image src={src} alt="" fill sizes="220px" unoptimized={!isMockMode} className="object-cover transition-transform duration-300 hover:scale-105" />
                </div>
              ))}
            </div>
          )}

          {tab === "friends" && friends.length === 0 && (
            <GateCard icon={<Pencil className="size-6" />} title="Поки нікого" text={isMe ? "Тут будуть люди, яких ви читаєте." : "Тут будуть люди, яких читає ця людина."} />
          )}
          {tab === "communities" && communities.length === 0 && (
            <GateCard icon={<Pencil className="size-6" />} title="Спільнот поки немає" text={isMe ? "Тут будуть спільноти, у які ви вступили." : "Ця людина ще не вступила в жодну спільноту."} />
          )}
          {tab === "friends" && (
            <ul>
              {friends.map((f) => (
                <li key={f.id} className="flex items-center gap-3 border-b px-4 py-3">
                  <Link href={`/${f.username}`} className="flex min-w-0 flex-1 items-center gap-3">
                    <UserAvatar user={f} size="lg" showOnline />
                    <span className="min-w-0">
                      <span className="flex items-center gap-1 text-sm font-medium">
                        {f.name} {f.verified && <VerifiedBadge className="size-3.5" />}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">{f.status || `@${f.username}`}</span>
                    </span>
                  </Link>
                  <Button variant="secondary" size="xs" asChild>
                    <Link href={`/messages/${f.username}`}>Написати</Link>
                  </Button>
                </li>
              ))}
            </ul>
          )}

          {tab === "communities" && (
            <ul>
              {communities.map((c) => (
                <li key={c.id}>
                  <Link href={`/c/${c.slug}`} className="flex items-center gap-3 border-b px-4 py-3 transition-colors hover:bg-subtle">
                    <span
                      className="size-10 shrink-0 rounded-lg ring-1 ring-inset ring-foreground/10"
                      style={{ background: `linear-gradient(135deg, oklch(0.75 0.13 ${c.hue}), oklch(0.5 0.17 ${c.hue + 40}))` }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">{c.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {formatCount(c.members)} {plural(c.members, ["учасник", "учасники", "учасників"])}
                      </span>
                    </span>
                    {c.role && c.role !== "member" && <Badge variant="outline" className="capitalize">{c.role}</Badge>}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}

export function ProfileSkeleton() {
  return (
    <div aria-hidden>
      <div className="shimmer h-[180px] sm:h-[210px]" />
      <div className="px-4 pb-4">
        <div className="shimmer -mt-14 size-[108px] rounded-full ring-4 ring-background" />
        <div className="mt-3 space-y-2">
          <div className="shimmer h-6 w-44 rounded" />
          <div className="shimmer h-4 w-24 rounded" />
          <div className="shimmer mt-4 h-8 w-72 rounded-md" />
          <div className="shimmer h-4 w-full rounded" />
          <div className="shimmer h-4 w-2/3 rounded" />
        </div>
      </div>
    </div>
  )
}
