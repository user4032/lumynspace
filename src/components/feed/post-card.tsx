"use client"

import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { useRef, useState, useTransition, ViewTransition } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Download, Repeat2 } from "lucide-react"
import type { Post } from "@/types"
import { formatFullDate, timeAgo } from "@/lib/format"
import { lifeFraction } from "@/lib/glow"
import { accentVars } from "@/lib/accent"
import { cn } from "@/lib/utils"
import { usePostLight } from "@/hooks/usePostLight"
import { usePostViews } from "@/hooks/usePostViews"
import { useNow } from "@/hooks/useNow"
import { UserAvatar } from "@/components/user-avatar"
import { VerifiedBadge } from "@/components/verified-badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useModeration } from "@/components/moderation/use-moderation"
import { editPost } from "@/lib/actions/posts"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { CodeBlock } from "./code-block"
import { VideoPlayer } from "./video-player"
import { PollView } from "./poll-view"
import { PhotoLightbox } from "./photo-lightbox"
import { PostActions } from "./post-actions"
import { PostMenu } from "./post-menu"
import { CloseFriendsChip, CommunityLink, GlowBadge, PermanentBadge, ReasonChip } from "./post-meta"
import { RichText } from "./rich-text"

export function PostMediaView({ post }: { post: Post }) {
  const [lightbox, setLightbox] = useState<number | null>(null)
  const photos = post.media.flatMap((m) => (m.type === "image" ? [{ url: m.url, alt: m.alt, width: m.width, height: m.height }] : []))

  if (!post.media.length && !post.poll) return null
  return (
    <div className="mt-3 space-y-3">
      {post.media.map((m, i) => {
        if (m.type === "image")
          return (
            <div key={i} className="group/img relative overflow-hidden rounded-xl border bg-muted">
              <a
                href={`${m.url}${m.url.includes("?") ? "&" : "?"}download=`}
                download
                aria-label="Завантажити фото"
                onClick={(e) => e.stopPropagation()}
                className="absolute top-2 right-2 z-10 inline-flex size-8 items-center justify-center rounded-full bg-black/60 text-white opacity-0 backdrop-blur transition-opacity group-hover/img:opacity-100 focus-visible:opacity-100"
              >
                <Download className="size-4" />
              </a>
              <button
                type="button"
                aria-label="Відкрити фото"
                onClick={(e) => {
                  e.stopPropagation()
                  setLightbox(photos.findIndex((p) => p.url === m.url))
                }}
                className="block w-full cursor-zoom-in"
              >
                <Image
                  src={m.url}
                  alt={m.alt ?? ""}
                  width={m.width ?? 1200}
                  height={m.height ?? 800}
                  sizes="(max-width: 768px) 100vw, 680px"
                  className="max-h-[80vh] w-full object-contain bg-black/5 transition-transform duration-500 ease-out hover:scale-[1.01]"
                />
              </button>
            </div>
          )
        if (m.type === "video") return <VideoPlayer key={i} media={m} />
        if (m.type === "code") return <CodeBlock key={i} media={m} />
        return null
      })}
      {post.poll && <PollView postId={post.id} poll={post.poll} />}

      {lightbox !== null && photos[lightbox] && (
        <AnimatePresence>
          <PhotoLightbox photos={photos} index={lightbox} onClose={() => setLightbox(null)} />
        </AnimatePresence>
      )}
    </div>
  )
}

/** Вбудована цитата (репост із коментарем) */
export function QuotedPost({ quote }: { quote: NonNullable<Post["quote"]> }) {
  const now = useNow()
  return (
    <Link
      href={`/post/${quote.id}`}
      onClick={(e) => e.stopPropagation()}
      className="mt-3 block rounded-xl border px-3 py-2.5 transition-colors hover:bg-subtle/60"
    >
      <span className="flex items-center gap-1.5 text-[13px]">
        <UserAvatar user={quote.author} size="md" className="size-5" />
        <span className="truncate font-semibold">{quote.author.name}</span>
        {quote.author.verified && <VerifiedBadge className="size-3.5" />}
        <span className="truncate text-muted-foreground">@{quote.author.username}</span>
        <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">{now ? timeAgo(quote.createdAt, now) : ""}</span>
      </span>
      <span className="mt-1 block line-clamp-6 text-sm leading-snug whitespace-pre-wrap text-foreground/80">
        {quote.content || "(медіа-допис)"}
      </span>
    </Link>
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

/** Інлайн-редагування свого допису: onDone(saved|null) — збережено чи скасовано */
export function PostEditBox({ post, onDone }: { post: Post; onDone: (saved: Post | null) => void }) {
  const [text, setText] = useState(post.content)
  const [pending, startTransition] = useTransition()
  const save = () =>
    startTransition(async () => {
      const res = await editPost(post.id, text)
      if (res.ok) onDone({ ...post, content: text.trim(), edited: true })
      else toast.error(res.error)
    })
  return (
    <div className="mt-0.5" onClick={(e) => e.stopPropagation()}>
      <textarea
        autoFocus
        value={text}
        maxLength={2000}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") onDone(null)
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) save()
        }}
        aria-label="Редагувати допис"
        className="field-sizing-content block max-h-[50vh] min-h-20 w-full resize-none rounded-lg border bg-background p-2.5 text-[15px] leading-[1.55] outline-none focus:border-ring"
      />
      <div className="mt-2 flex items-center justify-end gap-2">
        <Button variant="ghost" size="sm" className="rounded-full" onClick={() => onDone(null)}>
          Скасувати
        </Button>
        <Button size="sm" className="rounded-full" disabled={!text.trim() || pending} onClick={save}>
          Зберегти
        </Button>
      </div>
    </div>
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
  const [editing, setEditing] = useState(false)
  const [edited, setEdited] = useState<Post | null>(null)
  const shown = edited ?? post
  const light = usePostLight(post, () => setFlash((f) => f + 1))
  const { ref: spotRef, onPointerMove } = useSpotlight<HTMLElement>()
  const { views, ref: viewsRef } = usePostViews(post)

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
        ref={(el: HTMLElement | null) => {
          spotRef.current = el
          viewsRef.current = el
        }}
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
        style={
          {
            ...accentVars(post.author.accentColor),
          } as React.CSSProperties
        }
        className="spotlight group/post relative mx-3 my-2.5 cursor-pointer overflow-hidden rounded-2xl bg-card px-4 pt-4 pb-2 transition-colors hover:bg-raised"
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
              {shown.edited && <span className="text-xs text-muted-foreground">· змінено</span>}
              {isGlow && <GlowBadge post={{ expiresAt: light.expiresAt, lights: light.lights }} now={now} className="ml-1" />}
              {becamePermanent && (
                <motion.span initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="ml-1">
                  <PermanentBadge />
                </motion.span>
              )}
              <PostMenu post={post} onEdit={() => setEditing(true)} />
            </header>

            <div className={cn(isGlow && "glow-fade")} style={isGlow ? ({ "--life": life } as React.CSSProperties) : undefined}>
              {editing ? (
                <PostEditBox
                  post={shown}
                  onDone={(saved) => {
                    setEditing(false)
                    if (saved) setEdited(saved)
                  }}
                />
              ) : (
                <>
                  {shown.content && (
                    <p className="mt-0.5 text-[15px] leading-[1.55] break-words whitespace-pre-wrap text-foreground/95">
                      <RichText text={shown.content} />
                    </p>
                  )}
                  <PostMediaView post={post} />
                  {post.quote && <QuotedPost quote={post.quote} />}
                </>
              )}
            </div>

            <div className="mt-1.5">
              <PostActions post={post} light={light} views={views} />
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
    <div className={cn("mx-3 my-2.5 flex gap-3 rounded-2xl bg-card px-4 py-4", className)} aria-hidden>
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
