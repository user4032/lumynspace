"use client"

import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { useRef, useState, ViewTransition } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Repeat2 } from "lucide-react"
import type { Post } from "@/types"
import { formatFullDate, timeAgo } from "@/lib/format"
import { lifeFraction } from "@/lib/glow"
import { accentVars } from "@/lib/accent"
import { cn } from "@/lib/utils"
import { usePostLight } from "@/hooks/usePostLight"
import { useNow } from "@/hooks/useNow"
import { UserAvatar } from "@/components/user-avatar"
import { VerifiedBadge } from "@/components/verified-badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useModeration } from "@/components/moderation/use-moderation"
import { CodeBlock } from "./code-block"
import { PollView } from "./poll-view"
import { PostActions } from "./post-actions"
import { PostMenu } from "./post-menu"
import { CloseFriendsChip, CommunityLink, GlowBadge, PermanentBadge, ReasonChip } from "./post-meta"
import { RichText } from "./rich-text"

export function PostMediaView({ post }: { post: Post }) {
  if (!post.media.length && !post.poll) return null
  return (
    <div className="mt-3 space-y-3">
      {post.media.map((m, i) => {
        if (m.type === "image")
          return (
            <div key={i} className="overflow-hidden rounded-xl border bg-muted">
              <Image
                src={m.url}
                alt={m.alt ?? ""}
                width={m.width ?? 1200}
                height={m.height ?? 800}
                sizes="(max-width: 768px) 100vw, 560px"
                className="max-h-[520px] w-full object-cover transition-transform duration-500 ease-out hover:scale-[1.015]"
              />
            </div>
          )
        if (m.type === "code") return <CodeBlock key={i} media={m} />
        return null
      })}
      {post.poll && <PollView postId={post.id} poll={post.poll} />}
    </div>
  )
}

/** Прожектор: координати курсора → CSS-змінні (без ре-рендерів) */
export function useSpotlight<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const onPointerMove = (e: React.PointerEvent<T>) => {
    const el = ref.current
    if (!el || e.pointerType !== "mouse") return
    const r = el.getBoundingClientRect()
    el.style.setProperty("--x", `${e.clientX - r.left}px`)
    el.style.setProperty("--y", `${e.clientY - r.top}px`)
  }
  return { ref, onPointerMove }
}

/** «Спалах» картки на світло: тінь акцентом світла 0 → сильна → 0 за 300 мс */
export function LightFlash({ flash }: { flash: number }) {
  return (
    <AnimatePresence>
      {flash > 0 && (
        <motion.span
          key={flash}
          aria-hidden
          className="pointer-events-none absolute inset-0 z-10"
          style={{
            boxShadow:
              "inset 0 0 0 1px color-mix(in oklab, var(--glow) 70%, transparent), inset 0 0 48px -12px color-mix(in oklab, var(--glow) 55%, transparent)",
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 0] }}
          transition={{ duration: 0.3, times: [0, 0.35, 1], ease: "easeOut" }}
        />
      )}
    </AnimatePresence>
  )
}

export function PostCard({
  post,
  index = 0,
  animate = false,
  stagger = false,
}: {
  post: Post
  index?: number
  /** щойно опублікований — з'являється згори */
  animate?: boolean
  /** перша сторінка стрічки — каскад 40 мс */
  stagger?: boolean
}) {
  const router = useRouter()
  const now = useNow()
  const mod = useModeration()
  const href = `/post/${post.id}`
  const [flash, setFlash] = useState(0)
  const light = usePostLight(post, () => setFlash((f) => f + 1))
  const { ref, onPointerMove } = useSpotlight<HTMLElement>()

  const isGlow = light.mode === "glow"
  const becamePermanent = post.mode === "glow" && light.mode === "permanent"
  const life = isGlow ? lifeFraction(light.expiresAt, now) : 1

  const onCardClick = (e: React.MouseEvent<HTMLElement>) => {
    const target = e.target as HTMLElement
    if (target.closest("a,button,[role=menuitem],[role=dialog],input,textarea")) return
    if (window.getSelection()?.toString()) return
    router.push(href)
  }

  const meta = post.repostedBy || post.community || post.reason || post.audience === "close_friends"

  return (
    <ViewTransition name={`post-${post.id}`} share="morph" default="none">
      <motion.article
        ref={ref}
        layout="position"
        initial={animate ? { opacity: 0, y: -12 } : stagger ? { opacity: 0, y: 12 } : { opacity: 0 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, height: 0, paddingTop: 0, paddingBottom: 0 }}
        transition={{
          duration: stagger ? 0.25 : 0.2,
          delay: stagger ? Math.min(index, 8) * 0.04 : 0,
          ease: [0.22, 1, 0.36, 1],
          layout: { type: "spring", stiffness: 380, damping: 36 },
        }}
        onClick={onCardClick}
        onPointerMove={onPointerMove}
        style={accentVars(post.author.accentColor)}
        data-glow={isGlow || undefined}
        className="spotlight group/post relative cursor-pointer overflow-hidden border-b px-4 pt-3.5 pb-2 transition-colors hover:bg-subtle/60"
      >
        <LightFlash flash={flash} />

        {meta && (
          <div className="mb-1.5 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 pl-[52px] text-xs font-medium text-muted-foreground">
            {post.repostedBy && (
              <span className="inline-flex items-center gap-1.5">
                <Repeat2 className="size-3.5" />
                <Link href={`/${post.repostedBy.username}`} className="hover:text-foreground hover:underline">
                  {post.repostedBy.name} поширив(-ла)
                </Link>
              </span>
            )}
            {post.reason ? (
              <ReasonChip reason={post.reason} onHide={() => mod.hidePost(post.id)} />
            ) : (
              post.community && !post.repostedBy && <CommunityLink community={post.community} />
            )}
            {post.audience === "close_friends" && <CloseFriendsChip />}
          </div>
        )}

        <div className="flex gap-3">
          <Link href={`/${post.author.username}`} className="h-fit shrink-0 rounded-full">
            <UserAvatar user={post.author} size="lg" />
          </Link>

          <div className="min-w-0 flex-1">
            <header className="flex items-center gap-1.5 text-[14.5px] leading-5">
              <Link href={`/${post.author.username}`} className="flex min-w-0 items-center gap-1 font-semibold hover:underline">
                <span className="truncate">{post.author.name}</span>
                {post.author.verified && <VerifiedBadge />}
              </Link>
              <span className="truncate text-muted-foreground max-sm:hidden">@{post.author.username}</span>
              <span className="text-muted-foreground">·</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link href={href} className="shrink-0 text-muted-foreground hover:underline">
                    <time dateTime={post.createdAt}>{now ? timeAgo(post.createdAt, now) : ""}</time>
                  </Link>
                </TooltipTrigger>
                <TooltipContent>{formatFullDate(post.createdAt)}</TooltipContent>
              </Tooltip>
              {isGlow && <GlowBadge post={{ expiresAt: light.expiresAt, lights: light.lights }} now={now} className="ml-1" />}
              {becamePermanent && (
                <motion.span initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="ml-1">
                  <PermanentBadge />
                </motion.span>
              )}
              <PostMenu post={post} />
            </header>

            <div className={cn(isGlow && "glow-fade")} style={isGlow ? ({ "--life": life } as React.CSSProperties) : undefined}>
              {post.content && (
                <p className="mt-0.5 text-[15px] leading-[1.55] break-words whitespace-pre-wrap text-foreground/95">
                  <RichText text={post.content} />
                </p>
              )}
              <PostMediaView post={post} />
            </div>

            <div className="mt-1.5">
              <PostActions post={post} light={light} />
            </div>
          </div>
        </div>

        {isGlow && (
          <div aria-hidden className="absolute inset-x-0 bottom-0 h-[2px] bg-glow/10">
            <motion.div
              className="life-bar h-full rounded-r-full"
              initial={false}
              animate={{ width: `${Math.max(life * 100, 2)}%` }}
              transition={{ type: "spring", stiffness: 200, damping: 30 }}
            />
          </div>
        )}
      </motion.article>
    </ViewTransition>
  )
}

export function PostSkeleton({ media = false, className }: { media?: boolean; className?: string }) {
  return (
    <div className={cn("flex gap-3 border-b px-4 py-4", className)} aria-hidden>
      <div className="shimmer size-10 shrink-0 rounded-full" />
      <div className="flex-1 space-y-2.5 pt-0.5">
        <div className="flex items-center gap-2">
          <div className="shimmer h-3.5 w-28 rounded" />
          <div className="shimmer h-3.5 w-20 rounded" />
        </div>
        <div className="shimmer h-3.5 w-[92%] rounded" />
        <div className="shimmer h-3.5 w-[70%] rounded" />
        {media && <div className="shimmer mt-3 aspect-[3/2] w-full rounded-xl" />}
        <div className="flex max-w-[440px] justify-between pt-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="shimmer h-3.5 w-8 rounded" />
          ))}
        </div>
      </div>
    </div>
  )
}
