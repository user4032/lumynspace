"use client"

import Link from "next/link"
import { useState, ViewTransition } from "react"
import type { Post } from "@/types"
import { UserAvatar } from "@/components/user-avatar"
import { VerifiedBadge } from "@/components/verified-badge"
import { FollowButton } from "@/components/profile/follow-button"
import { formatCount, formatFullDate, plural } from "@/lib/format"
import { GLOW, lifeFraction } from "@/lib/glow"
import { accentVars } from "@/lib/accent"
import { cn } from "@/lib/utils"
import { usePostLight } from "@/hooks/usePostLight"
import { useNow } from "@/hooks/useNow"
import { useMe } from "@/lib/viewer-store"
import { Composer } from "./composer"
import { PostActions } from "./post-actions"
import { LightFlash, PostCard, PostMediaView, useSpotlight } from "./post-card"
import { PostMenu } from "./post-menu"
import { CloseFriendsChip, GlowBadge, PermanentBadge } from "./post-meta"
import { RichText } from "./rich-text"

export function PostDetail({ post, replies: initialReplies }: { post: Post; replies: Post[] }) {
  const [replies, setReplies] = useState(initialReplies)
  const [flash, setFlash] = useState(0)
  const light = usePostLight(post, () => setFlash((f) => f + 1))
  const now = useNow()
  const me = useMe()
  const { ref, onPointerMove } = useSpotlight<HTMLElement>()
  const views = light.lights * 9 + post.replies * 31
  const isGlow = light.mode === "glow"
  const life = isGlow ? lifeFraction(light.expiresAt, now) : 1

  return (
    <>
      <ViewTransition name={`post-${post.id}`} share="morph" default="none">
        <article
          ref={ref}
          onPointerMove={onPointerMove}
          style={accentVars(post.author.accentColor)}
          className="spotlight group/post relative overflow-hidden border-b px-4 pt-4"
        >
          <LightFlash flash={flash} />
          <div className="flex items-center gap-3">
            <Link href={`/${post.author.username}`}>
              <UserAvatar user={post.author} size="lg" />
            </Link>
            <div className="min-w-0 flex-1">
              <Link href={`/${post.author.username}`} className="flex items-center gap-1 font-semibold hover:underline">
                {post.author.name} {post.author.verified && <VerifiedBadge />}
              </Link>
              <p className="text-sm text-muted-foreground">@{post.author.username}</p>
            </div>
            {post.author.id !== me.id && <FollowButton userId={post.author.id} />}
            <PostMenu post={post} className="ml-0 opacity-100" />
          </div>

          {(isGlow || post.audience === "close_friends" || (post.mode === "glow" && !isGlow)) && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {isGlow && <GlowBadge post={{ expiresAt: light.expiresAt, lights: light.lights }} now={now} />}
              {post.mode === "glow" && !isGlow && <PermanentBadge />}
              {post.audience === "close_friends" && <CloseFriendsChip />}
              {isGlow && (
                <span className="text-xs text-muted-foreground">
                  ще {Math.max(0, GLOW.permanentAt - light.lights)} світла до «назавжди»
                </span>
              )}
            </div>
          )}

          <div className={cn(isGlow && "glow-fade")} style={isGlow ? ({ "--life": life } as React.CSSProperties) : undefined}>
            {post.content && (
              <p className="mt-4 text-[17px] leading-[1.6] break-words whitespace-pre-wrap">
                <RichText text={post.content} />
              </p>
            )}
            <PostMediaView post={post} />
          </div>

          <p className="mt-4 text-sm text-muted-foreground">
            <time dateTime={post.createdAt}>{formatFullDate(post.createdAt)}</time>
            <span className="mx-1.5">·</span>
            <span className="font-medium text-foreground tabular">{formatCount(views)}</span>{" "}
            {plural(views, ["перегляд", "перегляди", "переглядів"])}
          </p>

          <div className="mt-3 flex gap-5 border-y py-3 text-sm">
            <span><b className="font-semibold tabular">{formatCount(post.reposts)}</b> <span className="text-muted-foreground">{plural(post.reposts, ["репост", "репости", "репостів"])}</span></span>
            <span><b className="font-semibold tabular">{formatCount(light.lights)}</b> <span className="text-muted-foreground">світла</span></span>
            <span><b className="font-semibold tabular">{formatCount(post.replies)}</b> <span className="text-muted-foreground">{plural(post.replies, ["відповідь", "відповіді", "відповідей"])}</span></span>
          </div>

          <div className="py-1">
            <PostActions post={post} light={light} size="lg" />
          </div>

          {isGlow && (
            <div aria-hidden className="absolute inset-x-0 bottom-0 h-[2px] bg-glow/10">
              <div className="life-bar h-full rounded-r-full transition-[width] duration-500" style={{ width: `${Math.max(life * 100, 2)}%` }} />
            </div>
          )}
        </article>
      </ViewTransition>

      {/* тред з'являється після розгортання картки (затримка 150 мс) */}
      <ViewTransition enter="thread-in" default="none">
        <div>
          <Composer
            compact
            replyTo={post.id}
            placeholder={`Відповісти @${post.author.username}…`}
            submitLabel="Відповісти"
            onPublish={(p) => setReplies((r) => [p, ...r])}
            onSettled={(localId, saved) =>
              setReplies((r) => (saved ? r.map((p) => (p.id === localId ? saved : p)) : r.filter((p) => p.id !== localId)))
            }
          />
          {replies.map((r, i) => (
            <PostCard key={r.clientKey ?? r.id} post={r} index={i} animate={Boolean(r.clientKey) || r.id.startsWith("local-")} />
          ))}
        </div>
      </ViewTransition>
    </>
  )
}
