"use client"

import Image from "next/image"
import { useRouter } from "next/navigation"
import { useOptimistic, useState, useTransition } from "react"
import { motion } from "framer-motion"
import { Check, Clock, Globe, Lock, Plus, Search, Settings2, X } from "lucide-react"
import { toast } from "sonner"
import type { Community, CommunityRole, Post, User } from "@/types"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { CommunityIcon } from "@/components/community-icon"
import { UserAvatar } from "@/components/user-avatar"
import { Composer } from "@/components/feed/composer"
import { PostCard } from "@/components/feed/post-card"
import { joinCommunity } from "@/lib/actions/social"
import { requestToJoin } from "@/lib/actions/communities"
import { CommunitySettingsDialog, JoinRequests, MemberMenu } from "@/components/community-admin"
import { formatCount, plural } from "@/lib/format"
import { isMockMode } from "@/lib/env"
import { cn } from "@/lib/utils"

const ROLE_LABEL: Record<CommunityRole, string> = {
  owner: "Власник",
  admin: "Адмін",
  mod: "Модератор",
  member: "Учасник",
}

type Tab = "feed" | "about" | "members" | "requests"

export function CommunityView({
  community,
  posts,
  members,
  requests = [],
  meId = null,
}: {
  community: Community
  posts: Post[]
  members: { user: User; role: CommunityRole }[]
  /** Supabase: запити на вступ (для owner/admin/mod) */
  requests?: { user: User; createdAt: string }[]
  meId?: string | null
}) {
  const router = useRouter()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [requested, setRequested] = useState(Boolean(community.requested))
  // Supabase: у приватну спільноту — лише за запитом
  const needsRequest = !isMockMode && community.isPrivate && !community.role
  const canManage = !isMockMode && (community.role === "owner" || community.role === "admin")
  const canModerate = !isMockMode && (community.role === "owner" || community.role === "admin" || community.role === "mod")
  const showMembers = isMockMode || canModerate || community.membersVisible !== false
  const showRequests = canModerate && community.isPrivate
  const [tab, setTab] = useState<Tab>("feed")
  const [joined, setJoined] = useState(Boolean(community.role))
  const [optimisticJoined, setOptimisticJoined] = useOptimistic(joined)
  const [, startTransition] = useTransition()
  const [feed, setFeed] = useState(posts)
  const [query, setQuery] = useState("")

  const needle = query.trim().toLowerCase()
  const searching = needle.length > 0
  const matches = (user: User) =>
    !searching || user.name.toLowerCase().includes(needle) || user.username.toLowerCase().includes(needle)
  const filteredMembers = members.filter(({ user }) => matches(user))
  const filteredRequests = requests.filter(({ user }) => matches(user))
  const tabs: { value: Tab; label: string }[] = [
    { value: "feed", label: "Стрічка" },
    { value: "about", label: "Про спільноту" },
    ...(showMembers ? [{ value: "members" as const, label: "Учасники" }] : []),
    ...(showRequests ? [{ value: "requests" as const, label: "Заявки" }] : []),
  ]

  const renderMembers = (list: { user: User; role: CommunityRole }[]) => (
    <ul>
      {list.map(({ user, role }) => (
        <li key={user.id} className="flex items-center gap-3 border-b px-4 py-3">
          <UserAvatar user={user} size="lg" showOnline />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{user.name}</p>
            <p className="text-xs text-muted-foreground">@{user.username}</p>
          </div>
          <Badge variant={role === "member" ? "secondary" : "outline"} className={cn(role === "owner" && "border-brand/40 text-brand")}>
            {ROLE_LABEL[role]}
          </Badge>
          {!isMockMode && community.role && user.id !== meId && (
            <MemberMenu communityId={community.id} user={user} role={role} myRole={community.role} />
          )}
        </li>
      ))}
    </ul>
  )

  const toggleRequest = () => {
    const next = !requested
    startTransition(async () => {
      const res = await requestToJoin(community.id, next)
      if (res.ok) {
        setRequested(next)
        toast.success(next ? "Запит надіслано — адміни розглянуть його" : "Запит скасовано")
      } else toast.error(res.error)
    })
  }

  const toggle = () => {
    if (needsRequest) return toggleRequest()
    const next = !optimisticJoined
    startTransition(async () => {
      setOptimisticJoined(next)
      const res = await joinCommunity(community.id, next)
      if (res.ok) {
        setJoined(next)
        toast.success(next ? `Ви вступили в «${community.name}»` : "Ви вийшли зі спільноти")
        if (!isMockMode) router.refresh()
      } else toast.error(res.error)
    })
  }

  return (
    <div>
      <div className="relative h-36 overflow-hidden border-b bg-muted sm:h-44">
        {community.coverUrl && <Image src={community.coverUrl} alt="" fill priority sizes="640px" className="object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
      </div>

      <div className="px-4 pb-4">
        <div className="flex items-end justify-between">
          <div className="-mt-9 rounded-xl bg-background p-1">
            <CommunityIcon community={community} className="size-[72px] rounded-[10px] text-2xl" />
          </div>
          <div className="flex gap-2">
            {(community.role === "owner" || community.role === "admin") && (
              <Button variant="secondary" size="icon-sm" className="rounded-full" aria-label="Керування" onClick={() => canManage && setSettingsOpen(true)}>
                <Settings2 />
              </Button>
            )}
            <Button variant={optimisticJoined ? "secondary" : "default"} size="sm" className="min-w-[110px] rounded-full" onClick={toggle}>
              {needsRequest ? (
                requested ? <><Clock /> Запит надіслано</> : <><Plus /> Надіслати запит</>
              ) : optimisticJoined ? (
                <><Check /> Ви учасник</>
              ) : (
                <><Plus /> Вступити</>
              )}
            </Button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <h1 className="text-[22px] font-semibold tracking-[-0.02em]">{community.name}</h1>
          {community.role && community.role !== "member" && <Badge variant="outline">{ROLE_LABEL[community.role]}</Badge>}
        </div>
        <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
          {community.isPrivate ? <Lock className="size-3.5" /> : <Globe className="size-3.5" />}
          {community.isPrivate ? "Приватна" : "Публічна"} спільнота · c/{community.slug}
        </p>
        <p className="mt-3 text-[15px] leading-relaxed">{community.description}</p>
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          <span><b className="font-semibold tabular">{formatCount(community.members)}</b> <span className="text-muted-foreground">{plural(community.members, ["учасник", "учасники", "учасників"])}</span></span>
          {isMockMode && <span><b className="font-semibold tabular">{community.postsPerDay}</b> <span className="text-muted-foreground">дописів на день</span></span>}
          <div className="flex gap-1.5">
            {community.tags.map((t) => (
              <Badge key={t} variant="secondary" className="font-normal">{t}</Badge>
            ))}
          </div>
        </div>
      </div>

      <div role="tablist" className="sticky top-14 z-20 flex border-b bg-background/75 backdrop-blur-xl">
        {tabs.map(({ value, label }) => (
          <button
            key={value}
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={cn(
              "relative h-12 flex-1 text-sm font-medium transition-colors hover:bg-subtle",
              tab === value ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {label}
            {tab === value && <motion.span layoutId="community-tab" className="absolute inset-x-8 bottom-0 h-[2px] rounded-full bg-foreground" />}
          </button>
        ))}
      </div>

      {tab === "feed" && (
        <>
          {optimisticJoined && (
            <Composer compact communityId={community.id} placeholder={`Написати в ${community.name}…`} onPublish={(p) => setFeed((f) => [{ ...p, community: { slug: community.slug, name: community.name } }, ...f])} />
          )}
          {needsRequest ? (
            <p className="px-4 py-16 text-center text-sm text-muted-foreground">
              <Lock className="mx-auto mb-2 size-5" />
              Приватна спільнота. Дописи бачать лише учасники.
            </p>
          ) : feed.length ? (
            feed.map((p, i) => <PostCard key={p.id} post={p} index={i} />)
          ) : (
            <p className="px-4 py-16 text-center text-sm text-muted-foreground">Тут ще немає дописів. Будьте першими!</p>
          )}
        </>
      )}

      {tab === "about" && !isMockMode && (
        <p className="px-4 py-16 text-center text-sm text-muted-foreground">
          {community.description || "Опису й правил поки немає"}
        </p>
      )}

      {tab === "about" && isMockMode && (
        <div className="space-y-4 p-4">
          <div className="rounded-lg border">
            <div className="border-b px-4 py-3 text-sm font-semibold">Правила</div>
            <ol className="divide-y text-sm">
              {["Поважайте одне одного", "Без спаму й самопіару", "Код — у блоках коду", "Питання — з контекстом і прикладом"].map((r, i) => (
                <li key={r} className="flex gap-3 px-4 py-3">
                  <span className="font-mono text-xs text-muted-foreground tabular">{String(i + 1).padStart(2, "0")}</span>
                  {r}
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}

      {(tab === "members" || tab === "requests") && (
        <>
          <div className="border-b p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Пошук учасників і заявок…"
                aria-label="Пошук учасників і заявок"
                className="h-9 pr-8 pl-8"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Очистити пошук"
                  className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-muted-foreground transition-colors hover:bg-subtle hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          </div>

          {tab === "requests" && (
            <>
              <JoinRequests communityId={community.id} requests={filteredRequests} title="Заявки на вступ" />
              {filteredRequests.length === 0 && (
                <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                  {searching ? "Заявок не знайдено" : "Нових заявок немає"}
                </p>
              )}
            </>
          )}

          {tab === "members" && searching && showRequests && filteredRequests.length > 0 && (
            <JoinRequests communityId={community.id} requests={filteredRequests} title="Заявки на вступ" />
          )}

          {(tab === "members" || (tab === "requests" && searching)) && (
            <section>
              <h3 className="px-4 pt-3 pb-1 text-xs font-medium text-muted-foreground">Учасники · {filteredMembers.length}</h3>
              {filteredMembers.length ? (
                renderMembers(filteredMembers)
              ) : (
                <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                  {searching ? "Учасників не знайдено" : "Учасників поки немає"}
                </p>
              )}
            </section>
          )}
        </>
      )}
      {canManage && <CommunitySettingsDialog community={community} open={settingsOpen} onOpenChange={setSettingsOpen} />}
    </div>
  )
}
