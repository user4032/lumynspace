"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { UserAvatar } from "@/components/user-avatar"
import { VerifiedBadge } from "@/components/verified-badge"
import { formatCount, plural } from "@/lib/format"
import { cn } from "@/lib/utils"
import { getProfileEmbed, type ProfileEmbed } from "@/lib/actions/social"

/** Спільний кеш на сесію: однакові посилання в чаті не смикають сервер щоразу. */
const cache = new Map<string, ProfileEmbed | null>()

/** Embed профілю під повідомленням: аватар, статистика й останній допис. */
export function ProfileLinkPreview({ url, mine }: { url: string; mine: boolean }) {
  const [data, setData] = useState<ProfileEmbed | null | undefined>(() => cache.get(url))

  useEffect(() => {
    if (cache.has(url)) {
      setData(cache.get(url))
      return
    }
    let alive = true
    setData(undefined)
    getProfileEmbed(url)
      .then((res) => {
        cache.set(url, res)
        if (alive) setData(res)
      })
      .catch(() => {
        cache.set(url, null)
        if (alive) setData(null)
      })
    return () => {
      alive = false
    }
  }, [url])

  if (data === undefined) {
    return (
      <div className={cn("mt-1 w-full animate-pulse rounded-xl border p-3", mine ? "border-primary-foreground/20" : "border-border/70")}>
        <div className="flex items-center gap-2.5">
          <span className={cn("size-10 shrink-0 rounded-full", mine ? "bg-primary-foreground/20" : "bg-muted")} />
          <span className="flex-1 space-y-1.5">
            <span className={cn("block h-2.5 w-24 rounded", mine ? "bg-primary-foreground/20" : "bg-muted")} />
            <span className={cn("block h-2 w-16 rounded", mine ? "bg-primary-foreground/15" : "bg-muted")} />
          </span>
        </div>
      </div>
    )
  }
  if (!data) return null

  const muted = mine ? "text-primary-foreground/65" : "text-muted-foreground"
  const latest = data.latestPost

  return (
    <Link
      href={`/${data.username}`}
      className={cn(
        "mt-1 block w-full min-w-0 overflow-hidden rounded-xl border transition-colors",
        mine
          ? "border-primary-foreground/25 bg-primary-foreground/10 hover:bg-primary-foreground/15"
          : "border-border/70 bg-background hover:bg-subtle",
      )}
    >
      <span className="block h-1 w-full" style={{ background: `linear-gradient(90deg, ${data.accentColor}, transparent)` }} />
      <span className="flex min-w-0 items-start gap-2.5 p-2.5">
        <UserAvatar
          user={{ username: data.username, name: data.name, avatarUrl: data.avatarUrl, frame: data.frame, frameExpiresAt: data.frameExpiresAt }}
          size="lg"
        />
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-1">
            <span className={cn("truncate text-sm font-semibold", mine ? "text-primary-foreground" : "text-foreground")}>{data.name}</span>
            {data.verified && <VerifiedBadge className="size-3.5 shrink-0" />}
          </span>
          <span className={cn("block truncate text-xs", muted)}>@{data.username}</span>
          {data.bio && <span className={cn("mt-0.5 line-clamp-2 text-[11.5px] leading-snug", muted)}>{data.bio}</span>}
          <span className={cn("mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px]", muted)}>
            <span>
              <b className={cn("font-semibold tabular", mine ? "text-primary-foreground" : "text-foreground")}>{formatCount(data.followers)}</b>{" "}
              {plural(data.followers, ["підписник", "підписники", "підписників"])}
            </span>
            <span>
              <b className={cn("font-semibold tabular", mine ? "text-primary-foreground" : "text-foreground")}>{formatCount(data.following)}</b>{" "}
              {plural(data.following, ["підписка", "підписки", "підписок"])}
            </span>
            <span>
              <b className={cn("font-semibold tabular", mine ? "text-primary-foreground" : "text-foreground")}>{formatCount(data.postsCount)}</b>{" "}
              {plural(data.postsCount, ["допис", "дописи", "дописів"])}
            </span>
          </span>
        </span>
      </span>
      {latest && (latest.content || latest.imageUrl) && (
        <span className={cn("block border-t px-2.5 py-2", mine ? "border-primary-foreground/20" : "border-border/70")}>
          <span className={cn("mb-1 block text-[9.5px] font-medium tracking-wide uppercase", muted)}>Останній допис</span>
          {latest.content && (
            <span className={cn("block line-clamp-2 text-xs leading-snug", mine ? "text-primary-foreground/90" : "text-foreground/90")}>
              {latest.content}
            </span>
          )}
          {latest.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- Storage URL, довільні пропорції
            <img
              src={latest.imageUrl}
              alt=""
              loading="lazy"
              className="mt-1.5 max-h-36 w-full rounded-lg object-cover"
            />
          )}
        </span>
      )}
    </Link>
  )
}
