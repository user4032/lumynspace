"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { Clapperboard, MessageCircle, Volume2, VolumeX, X } from "lucide-react"
import type { Post } from "@/types"
import { UserAvatar } from "@/components/user-avatar"
import { VerifiedBadge } from "@/components/verified-badge"
import { LightButton } from "@/components/feed/light-button"
import { ShareMenu } from "@/components/feed/post-actions"
import { RichText } from "@/components/feed/rich-text"
import { PostCard } from "@/components/feed/post-card"
import { Composer } from "@/components/feed/composer"
import { usePostLight } from "@/hooks/usePostLight"
import { useNow } from "@/hooks/useNow"
import { formatCount, timeAgo } from "@/lib/format"
import { accentVars } from "@/lib/accent"
import { isMockMode } from "@/lib/env"
import { cn } from "@/lib/utils"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { resolveFeedRows } from "@/lib/feed-map"
import type { FeedPostRow } from "@/types/database"

/** Один кліп: вертикальне відео на весь екран, автовідтворення при скролі */
function Clip({ post, index }: { post: Post; index: number }) {
  const video = post.media.find((m) => m.type === "video")
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [muted, setMuted] = useState(true)
  const [flash, setFlash] = useState(0)
  const [openComments, setOpenComments] = useState(false)
  const [replies, setReplies] = useState<Post[]>([])
  const [loadingReplies, setLoadingReplies] = useState(false)
  const light = usePostLight(post, () => setFlash((f) => f + 1))
  const now = useNow()

  useEffect(() => {
    if (!openComments || replies.length || loadingReplies) return
    setLoadingReplies(true)
    const supabase = getSupabaseBrowserClient()
    if (!supabase) {
      setLoadingReplies(false)
      return
    }
    void supabase
      .from("feed_posts")
      .select("*")
      .eq("reply_to", post.id)
      .order("created_at", { ascending: true })
      .limit(100)
      .then(async ({ data }) => {
        if (data) {
          const resolved = await resolveFeedRows(supabase, data as FeedPostRow[])
          setReplies(resolved)
        }
        setLoadingReplies(false)
      })
  }, [openComments, post.id, replies.length, loadingReplies])

  useEffect(() => {
    const el = videoRef.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && e.intersectionRatio > 0.6) void el.play().catch(() => undefined)
          else el.pause()
        }
      },
      { threshold: [0, 0.6, 1] }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  if (video?.type !== "video") return null

  const togglePlay = () => {
    const el = videoRef.current
    if (!el) return
    if (el.paused) void el.play().catch(() => undefined)
    else el.pause()
  }

  return (
    <section
      style={accentVars(post.author.accentColor)}
      className="relative flex h-full w-full snap-start snap-always items-center justify-center overflow-hidden bg-black"
    >
      {/* спалах світла */}
      {flash > 0 && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 z-10"
          style={{ boxShadow: "inset 0 0 120px -20px color-mix(in oklab, var(--glow) 60%, transparent)" }}
        />
      )}

      {/* розмите тло-заливка: горизонтальні відео без чорних смуг */}
      <video
        src={video.url}
        muted
        loop
        playsInline
        autoPlay
        preload="metadata"
        aria-hidden
        className="absolute inset-0 size-full scale-110 object-cover blur-2xl brightness-[0.35] saturate-150"
      />
      <video
        ref={videoRef}
        src={video.url}
        muted={muted}
        loop
        playsInline
        preload={index < 2 ? "auto" : "metadata"}
        onClick={togglePlay}
        className="relative h-full w-full cursor-pointer object-contain"
      />

      {/* затемнення під текстом */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-black/75 to-transparent" />

      {/* звук */}
      <button
        type="button"
        aria-label={muted ? "Увімкнути звук" : "Вимкнути звук"}
        onClick={() => setMuted((m) => !m)}
        className="absolute top-3 right-3 z-20 grid size-9 place-items-center rounded-full bg-black/50 text-white backdrop-blur transition-colors hover:bg-black/70"
      >
        {muted ? <VolumeX className="size-4.5" /> : <Volume2 className="size-4.5" />}
      </button>

      {/* дії праворуч */}
      <div className="absolute right-2.5 bottom-24 z-20 flex flex-col items-center gap-4 text-white">
        <div className="flex flex-col items-center gap-1">
          <LightButton lit={light.lit} count={light.lights} onToggle={light.toggle} size="lg" className="text-white hover:text-white" />
        </div>
        <button
          type="button"
          aria-label={`${formatCount(post.replies)} відповідей`}
          onClick={(e) => {
            e.stopPropagation()
            setOpenComments(true)
          }}
          className="flex flex-col items-center gap-1 transition-opacity hover:opacity-80"
        >
          <span className="grid size-11 place-items-center rounded-full bg-black/40 backdrop-blur">
            <MessageCircle className="size-5.5" />
          </span>
          <span className="font-mono text-[11px] tabular">{formatCount(post.replies)}</span>
        </button>
        <ShareMenu post={post} iconClass="size-5.5" />
      </div>

      {/* автор і опис */}
      <div className="absolute inset-x-0 bottom-0 z-20 p-4 pb-6 pr-20 text-white">
        <Link href={`/${post.author.username}`} className="flex items-center gap-2.5">
          <UserAvatar user={post.author} size="lg" className="ring-2 ring-white/25" />
          <span className="min-w-0">
            <span className="flex items-center gap-1 truncate text-sm font-semibold">
              {post.author.name}
              {post.author.verified && <VerifiedBadge className="size-3.5" />}
            </span>
            <span className="block truncate text-xs text-white/70">
              @{post.author.username} · {now ? timeAgo(post.createdAt, now) : ""}
            </span>
          </span>
        </Link>
        {post.content && (
          <p className="mt-2.5 line-clamp-2 text-sm leading-snug text-white/90">
            <RichText text={post.content} />
          </p>
        )}
      </div>

      {/* Панель коментарів */}
      {openComments && (
        <>
          <div
            aria-hidden
            className="absolute inset-0 z-30 bg-black/60 backdrop-blur-sm"
            onClick={() => setOpenComments(false)}
          />
          <aside className="absolute top-0 right-0 z-40 flex h-full w-full max-w-md flex-col border-l border-white/10 bg-background text-foreground shadow-2xl animate-in slide-in-from-right duration-200">
            <header className="flex items-center justify-between border-b px-4 py-3">
              <p className="text-sm font-semibold">Коментарі</p>
              <button
                type="button"
                aria-label="Закрити"
                onClick={() => setOpenComments(false)}
                className="grid size-8 place-items-center rounded-full hover:bg-muted"
              >
                <X className="size-4" />
              </button>
            </header>
            <div className="flex-1 overflow-y-auto">
              <div className="border-b">
                <PostCard post={post} index={0} />
              </div>
              <div className="px-4 py-3 text-sm text-muted-foreground">Відповіді</div>
              {loadingReplies && (
                <div className="space-y-2 px-4">
                  <div className="shimmer h-16 rounded-xl" />
                  <div className="shimmer h-16 rounded-xl" />
                </div>
              )}
              {!loadingReplies && replies.length === 0 && (
                <div style={{ minHeight: "200px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <p className="px-4 text-center text-sm text-muted-foreground">Поки немає відповідей</p>
                </div>
              )}
              {replies.map((r, i) => (
                <PostCard key={r.clientKey ?? r.id} post={r} index={i} />
              ))}
            </div>
            <div className="border-t">
              <Composer compact replyTo={post.id} placeholder={`Відповісти @${post.author.username}…`} submitLabel="Відповісти" onPublish={(p) => setReplies((prev) => [p, ...prev])} surface="flat" />
            </div>
          </aside>
        </>
      )}
    </section>
  )
}

/** Стрічка кліпів: вертикальний snap-скрол, як у Shorts/Reels */
export function ClipsFeed({ posts }: { posts: Post[] }) {
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    // хапає клавіші ↑/↓ для перемикання кліпів
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return
      const el = containerRef.current
      if (!el) return
      e.preventDefault()
      el.scrollBy({ top: (e.key === "ArrowDown" ? 1 : -1) * el.clientHeight, behavior: "smooth" })
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  if (!posts.length)
    return (
      <div className="flex h-[calc(100dvh-3.5rem)] flex-col items-center justify-center gap-3 px-6 text-center">
        <span className={cn("grid size-14 place-items-center rounded-2xl border bg-subtle", isMockMode && "opacity-70")}>
          <Clapperboard className="size-6 text-muted-foreground" />
        </span>
        <p className="text-sm font-medium">Кліпів поки немає</p>
        <p className="max-w-72 text-sm text-muted-foreground">
          Додайте до допису відео — і воно з&apos;явиться тут, у вертикальній стрічці.
        </p>
        <Link href="/?compose=1" className="mt-1 text-sm font-medium underline underline-offset-4">
          Зняти перший кліп
        </Link>
      </div>
    )

  return (
    <div
      ref={containerRef}
      className="no-scrollbar h-[calc(100dvh-3.5rem-4rem)] snap-y snap-mandatory overflow-y-auto overscroll-contain md:h-[calc(100dvh-3.5rem)]"
    >
      {posts.map((p, i) => (
        <Clip key={p.clientKey ?? p.id} post={p} index={i} />
      ))}
    </div>
  )
}
