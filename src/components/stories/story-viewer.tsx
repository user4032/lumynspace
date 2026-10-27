"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { AnimatePresence, motion } from "framer-motion"
import { ArrowUp, ChevronLeft, ChevronRight, Eye, Loader2, Smile, Trash2, X } from "lucide-react"
import { toast } from "sonner"
import type { StoryActor, StoryGroup, StoryInsights } from "@/types"
import { SparkIcon } from "@/components/icons"
import { UserAvatar } from "@/components/user-avatar"
import { VerifiedBadge } from "@/components/verified-badge"
import {
  deleteStory,
  getStoryInsights,
  markStoriesSeen,
  replyToStory,
  setStoryReaction,
  toggleStoryLight,
} from "@/lib/actions/stories"
import { STORY_REACTIONS } from "@/lib/stories"
import { timeAgo } from "@/lib/format"
import { cn } from "@/lib/utils"
import { useNow } from "@/hooks/useNow"

/** Повноекранний переглядач сторіс: прогрес-бари, автоперехід, тапи вліво/вправо, взаємодії. */
export function StoryViewer({
  groups,
  startIndex,
  onClose,
  onDeleted,
}: {
  groups: StoryGroup[]
  startIndex: number
  onClose: () => void
  onDeleted: () => void
}) {
  const [gi, setGi] = useState(startIndex)
  const [si, setSi] = useState(0)
  const seenIds = useRef<Set<string>>(new Set())
  const videoRef = useRef<HTMLVideoElement>(null)
  const elapsedRef = useRef(0)
  const now = useNow()
  const group = groups[gi]

  // взаємодії глядача (перекривають дані зі стрічки після натискання)
  const [lightOverride, setLightOverride] = useState<Record<string, { on: boolean; count: number }>>({})
  const [reactionOverride, setReactionOverride] = useState<Record<string, string | null>>({})
  const [lightPending, setLightPending] = useState(false)
  const [reply, setReply] = useState("")
  const [composerFocused, setComposerFocused] = useState(false)
  const [reactionOpen, setReactionOpen] = useState(false)
  const [sending, setSending] = useState(false)
  const [lightPulse, setLightPulse] = useState(0)
  const [reactionBurst, setReactionBurst] = useState<{ emoji: string; id: number } | null>(null)
  // перебіг показу поточного сторіс (0..1) для верхнього прогресу й таймера
  const [progress, setProgress] = useState(0)
  const [videoTime, setVideoTime] = useState(0)
  const [videoDuration, setVideoDuration] = useState(0)
  // статистика автора
  const [insightsOpen, setInsightsOpen] = useState(false)
  const [insights, setInsights] = useState<StoryInsights | null>(null)
  const [insightsLoading, setInsightsLoading] = useState(false)

  const next = useCallback(() => {
    setSi((s) => {
      if (!group) return s
      if (s + 1 < group.stories.length) return s + 1
      // наступний автор або закриття
      if (gi + 1 < groups.length) {
        setGi(gi + 1)
        return 0
      }
      onClose()
      return s
    })
  }, [group, gi, groups.length, onClose])

  const prev = () => {
    if (si > 0) return setSi(si - 1)
    if (gi > 0) {
      setGi(gi - 1)
      setSi(0)
    }
  }

  // позначаємо переглянутими (по одному запиту на сторіс, мовчки)
  useEffect(() => {
    const st = group?.stories[si]
    if (!st || st.seen || seenIds.current.has(st.id)) return
    seenIds.current.add(st.id)
    void markStoriesSeen([st.id]).catch(() => undefined)
  }, [group, si])

  const story = group?.stories[si]
  const storyId = story?.id
  const isVideo = story?.mime.startsWith("video/") ?? false
  const paused = composerFocused || reactionOpen || insightsOpen

  // новий сторіс — чистий композер і закрита статистика
  /* eslint-disable react-hooks/set-state-in-effect -- навмисне скидання тимчасового UI при зміні сторіс */
  useEffect(() => {
    setReply("")
    setComposerFocused(false)
    setReactionOpen(false)
    setInsightsOpen(false)
    setInsights(null)
    elapsedRef.current = 0
    setProgress(0)
    setVideoTime(0)
    setVideoDuration(0)
  }, [storyId])
  /* eslint-enable react-hooks/set-state-in-effect */

  // автоперехід для картинок + живий прогрес (пауза, поки відповідаємо / обираємо реакцію / дивимось статистику)
  useEffect(() => {
    if (!story || isVideo || paused) return
    const total = Math.max(3, story.durationSec) * 1000
    const started = Date.now() - elapsedRef.current
    let done = false
    const tick = () => {
      if (done) return
      const elapsed = Math.min(total, Date.now() - started)
      elapsedRef.current = elapsed
      setProgress(elapsed / total)
      if (elapsed >= total) {
        done = true
        next()
      }
    }
    tick()
    const t = setInterval(tick, 100)
    return () => clearInterval(t)
  }, [story, isVideo, paused, next])

  // відео теж ставимо на паузу під час взаємодій
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    if (paused) v.pause()
    else void v.play().catch(() => undefined)
  }, [paused, storyId])

  // Esc
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return onClose()
      const target = e.target as HTMLElement | null
      // стрілки в полі відповіді мають рухати каретку, а не гортати сторіс
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return
      if (e.key === "ArrowRight") next()
      if (e.key === "ArrowLeft") prev()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })

  if (!group || !story) return null

  const light = lightOverride[story.id] ?? { on: story.litByMe, count: story.lightCount }
  const myReaction = story.id in reactionOverride ? reactionOverride[story.id] : story.myReaction
  const totalSec = Math.max(3, story.durationSec)
  const playbackSec = isVideo ? videoDuration || totalSec : totalSec
  const elapsedSec = isVideo ? videoTime : progress * totalSec

  const toggleLight = async () => {
    if (group.isMe || lightPending) return
    setLightPending(true)
    const res = await toggleStoryLight(story.id)
    setLightPending(false)
    if (res.ok && res.data) {
      setLightOverride((prev) => ({ ...prev, [story.id]: res.data! }))
      setLightPulse((n) => n + 1)
    } else if (!res.ok) toast.error(res.error)
  }

  const react = async (emoji: string) => {
    if (group.isMe) return
    const nextEmoji = myReaction === emoji ? null : emoji
    const res = await setStoryReaction(story.id, nextEmoji)
    if (res.ok) {
      setReactionOverride((prev) => ({ ...prev, [story.id]: nextEmoji }))
      setReactionOpen(false)
      if (nextEmoji) setReactionBurst((prev) => ({ emoji: nextEmoji, id: (prev?.id ?? 0) + 1 }))
    } else toast.error(res.error)
  }

  const sendReply = async () => {
    if (group.isMe || sending) return
    const text = reply.trim()
    if (!text) return
    setSending(true)
    const res = await replyToStory(story.id, text)
    setSending(false)
    if (res.ok) {
      setReply("")
      setComposerFocused(false)
      ;(document.activeElement as HTMLElement | null)?.blur()
      toast.success("Відповідь надіслано в приватні повідомлення")
    } else toast.error(res.error)
  }

  const openInsights = async () => {
    if (!group.isMe) return
    setInsightsOpen(true)
    setInsights(null)
    setInsightsLoading(true)
    const res = await getStoryInsights(story.id)
    setInsightsLoading(false)
    if (res.ok && res.data) setInsights(res.data)
    else if (!res.ok) toast.error(res.error)
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/95"
        role="dialog"
        aria-modal="true"
        aria-label={`Історії ${group.author.name}`}
      >
        {/* центр: вертикальне медіа */}
        <div className="relative h-full max-h-dvh w-full max-w-md overflow-hidden sm:h-[92dvh] sm:rounded-2xl">
          {/* прогрес */}
          <div className="absolute inset-x-0 top-0 z-20 flex gap-1 p-2.5">
            {group.stories.map((s, i) => (
              <span key={s.id} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/20 shadow-[0_0_0_1px_rgb(0_0_0/0.2)]">
                <span
                  className="block h-full rounded-full bg-white shadow-[0_0_12px_rgb(255_255_255/0.6)] transition-[width] duration-150 ease-linear"
                  style={{
                    width: i < si ? "100%" : i === si ? `${Math.min(100, progress * 100)}%` : "0%",
                    opacity: i > si ? 0.35 : 1,
                  }}
                />
              </span>
            ))}
          </div>

          {/* шапка */}
          <div className="absolute inset-x-0 top-4 z-20 mt-2 flex items-center gap-2.5 px-4 pt-2 text-white">
            <Link href={`/${group.author.username}`} onClick={onClose} className="flex min-w-0 items-center gap-2.5">
              <UserAvatar user={group.author} size="md" className="rounded-full ring-1 ring-white/30" />
              <span className="min-w-0">
                <span className="flex items-center gap-1 truncate text-sm font-semibold">
                  {group.author.name}
                  {group.author.verified && <VerifiedBadge className="size-3.5" />}
                </span>
                <span className="block text-[11px] text-white/60">
                  {now ? timeAgo(story.createdAt, now) : ""}
                  <span className="ml-1.5 text-white/45 tabular-nums">
                    · {clock(elapsedSec)} / {clock(playbackSec)}
                  </span>
                </span>
              </span>
            </Link>
            <span className="ml-auto flex items-center gap-1">
              {group.isMe && (
                <button
                  type="button"
                  aria-label="Статистика історії"
                  onClick={() => void openInsights()}
                  className="flex h-8 items-center gap-1.5 rounded-full bg-white/10 px-2.5 text-xs font-medium text-white/90 backdrop-blur transition-colors hover:bg-white/20"
                >
                  <Eye className="size-3.5" /> {story.viewCount}
                  <SparkIcon className="size-3.5 text-amber-300" /> {light.count}
                  {story.reactionCount > 0 && (
                    <>
                      <Smile className="size-3.5" /> {story.reactionCount}
                    </>
                  )}
                </button>
              )}
              {group.isMe && (
                <button
                  type="button"
                  aria-label="Видалити історію"
                  onClick={() => {
                    void deleteStory(story.id).then((res) => {
                      if (res.ok) {
                        toast("Історію видалено")
                        onDeleted()
                        onClose()
                      } else toast.error(res.error)
                    })
                  }}
                  className="grid size-8 place-items-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <Trash2 className="size-4" />
                </button>
              )}
              <button
                type="button"
                aria-label="Закрити"
                onClick={onClose}
                className="grid size-8 place-items-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white"
              >
                <X className="size-5" />
              </button>
            </span>
          </div>

          {/* медіа */}
          {isVideo ? (
            <video
              ref={videoRef}
              key={story.id}
              src={story.mediaUrl}
              className="size-full bg-black object-contain"
              autoPlay
              playsInline
              onLoadedMetadata={(e) => {
                const duration = e.currentTarget.duration
                if (Number.isFinite(duration) && duration > 0) setVideoDuration(duration)
              }}
              onTimeUpdate={(e) => {
                const video = e.currentTarget
                setVideoTime(video.currentTime || 0)
                if (Number.isFinite(video.duration) && video.duration > 0) setProgress(video.currentTime / video.duration)
              }}
              onEnded={next}
              onError={next}
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- Storage URL
            <img key={story.id} src={story.mediaUrl} alt={story.caption ?? ""} className="size-full bg-black object-contain" />
          )}

          {/* низ: підпис + реакції + відповідь + світло */}
          {(story.caption || !group.isMe) && (
            <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/85 via-black/45 to-transparent px-3 pt-10 pb-3 text-white">
              {story.caption && <p className="mb-2 text-center text-sm">{story.caption}</p>}

              {!group.isMe && (
                <>
                  <AnimatePresence>
                    {reactionOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.9 }}
                        transition={{ type: "spring", stiffness: 420, damping: 30 }}
                        className="mb-2 flex justify-center gap-0.5 rounded-full bg-black/45 p-1 backdrop-blur"
                      >
                        {STORY_REACTIONS.map((emoji, i) => (
                          <motion.button
                            key={emoji}
                            type="button"
                            aria-label={`Реакція ${emoji}`}
                            aria-pressed={myReaction === emoji}
                            onClick={() => void react(emoji)}
                            initial={{ opacity: 0, scale: 0.4, y: 6 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            transition={{ delay: i * 0.03, type: "spring", stiffness: 500, damping: 26 }}
                            whileHover={{ scale: 1.18 }}
                            whileTap={{ scale: 0.85 }}
                            className={cn(
                              "grid size-9 place-items-center rounded-full text-lg",
                              myReaction === emoji && "bg-white/25",
                            )}
                          >
                            {emoji}
                          </motion.button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="flex items-center gap-2">
                    <div className="relative min-w-0 flex-1">
                      <input
                        key={story.id}
                        value={reply}
                        onChange={(e) => setReply(e.target.value)}
                        onFocus={() => setComposerFocused(true)}
                        onBlur={() => setComposerFocused(false)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault()
                            void sendReply()
                          }
                        }}
                        maxLength={1000}
                        placeholder="Відповісти на історію…"
                        className="h-10 w-full rounded-full border border-white/25 bg-white/10 pr-11 pl-4 text-sm text-white outline-none backdrop-blur placeholder:text-white/50 focus:border-white/50"
                      />
                      <AnimatePresence initial={false}>
                        {reply.trim().length > 0 && (
                          <motion.button
                            type="button"
                            aria-label="Надіслати відповідь"
                            onClick={() => void sendReply()}
                            disabled={sending}
                            initial={{ opacity: 0, scale: 0.5, x: 6 }}
                            animate={{ opacity: 1, scale: 1, x: 0 }}
                            exit={{ opacity: 0, scale: 0.5, x: 6 }}
                            transition={{ type: "spring", stiffness: 520, damping: 28 }}
                            className="absolute top-1/2 right-1.5 grid size-7 -translate-y-1/2 place-items-center rounded-full bg-white text-black shadow-lg disabled:opacity-70"
                          >
                            {sending ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" strokeWidth={2.5} />}
                          </motion.button>
                        )}
                      </AnimatePresence>
                    </div>
                    <div className="relative shrink-0">
                      <button
                        type="button"
                        aria-label="Обрати реакцію"
                        onClick={() => setReactionOpen((v) => !v)}
                        className={cn(
                          "relative grid size-10 place-items-center rounded-full bg-white/10 text-white/90 backdrop-blur transition-colors hover:bg-white/20",
                          reactionOpen && "bg-white/20",
                        )}
                      >
                        {myReaction ? (
                          <motion.span
                            key={myReaction}
                            initial={{ scale: 0.4, rotate: -25, opacity: 0 }}
                            animate={{ scale: 1, rotate: 0, opacity: 1 }}
                            transition={{ type: "spring", stiffness: 500, damping: 20 }}
                            className="text-lg"
                          >
                            {myReaction}
                          </motion.span>
                        ) : (
                          <Smile className="size-5" />
                        )}
                      </button>
                      {reactionBurst && (
                        <span className="pointer-events-none absolute -top-3 left-1/2 -translate-x-1/2">
                          <motion.span
                            key={reactionBurst.id}
                            initial={{ opacity: 0, y: 0, scale: 0.5 }}
                            animate={{ opacity: [0, 1, 1, 0], y: [0, -12, -34, -54], scale: [0.5, 1.35, 1.15, 1] }}
                            transition={{ duration: 0.85, times: [0, 0.18, 0.7, 1], ease: "easeOut" }}
                            onAnimationComplete={() => setReactionBurst(null)}
                            className="block text-2xl"
                          >
                            {reactionBurst.emoji}
                          </motion.span>
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      aria-label={light.on ? "Прибрати світло" : "Дати світло"}
                      aria-pressed={light.on}
                      onClick={() => void toggleLight()}
                      disabled={lightPending}
                      className={cn(
                        "group/light relative inline-flex h-10 shrink-0 items-center gap-0.5 rounded-full pr-2 outline-none backdrop-blur transition-colors focus-visible:ring-2 focus-visible:ring-white/40 disabled:opacity-50",
                        light.on
                          ? "bg-amber-400/15 text-amber-300"
                          : "bg-white/10 text-white/80 hover:bg-white/20 hover:text-amber-200",
                      )}
                    >
                      <span className="relative inline-flex rounded-full p-1.5 transition-colors group-hover/light:bg-amber-400/10">
                        {lightPulse > 0 && (
                          <motion.span
                            key={lightPulse}
                            initial={{ opacity: 0.55, scale: 0.4 }}
                            animate={{ opacity: 0, scale: 2.1 }}
                            transition={{ duration: 0.55, ease: "easeOut" }}
                            className="pointer-events-none absolute inset-0 rounded-full bg-amber-300/50"
                          />
                        )}
                        <motion.span
                          key={`light-icon-${lightPulse}`}
                          initial={lightPulse > 0 ? { scale: 0.65, rotate: -20 } : false}
                          animate={{ scale: 1, rotate: 0 }}
                          transition={{ type: "spring", stiffness: 500, damping: 18 }}
                          className="relative block"
                        >
                          {lightPending ? (
                            <Loader2 className="size-[18px] animate-spin" />
                          ) : (
                            <svg
                              viewBox="0 0 24 24"
                              aria-hidden="true"
                              className="size-[18px]"
                              fill={light.on ? "currentColor" : "none"}
                              stroke="currentColor"
                              strokeWidth={1.8}
                              strokeLinejoin="round"
                            >
                              <path d="M12 2.5c.45 5 4.5 9.05 9.5 9.5-5 .45-9.05 4.5-9.5 9.5-.45-5-4.5-9.05-9.5-9.5 5-.45 9.05-4.5 9.5-9.5Z" />
                            </svg>
                          )}
                        </motion.span>
                      </span>
                      <span className="relative inline-flex h-4 min-w-[1ch] overflow-hidden text-[13px] tabular-nums">
                        <AnimatePresence mode="popLayout" initial={false}>
                          <motion.span
                            key={light.count}
                            initial={{ y: 10, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: -10, opacity: 0 }}
                            transition={{ duration: 0.18 }}
                            className="leading-4"
                          >
                            {light.count}
                          </motion.span>
                        </AnimatePresence>
                      </span>
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* навігація: тап-зони + стрілки */}
          <button type="button" aria-label="Попередня" onClick={prev} className="absolute inset-y-0 left-0 z-10 w-1/4" />
          <button type="button" aria-label="Наступна" onClick={next} className="absolute inset-y-0 right-0 z-10 w-1/4" />
          {gi > 0 && (
            <button
              type="button"
              aria-label="Попередній автор"
              onClick={() => {
                setGi(gi - 1)
                setSi(0)
              }}
              className="absolute top-1/2 left-1 z-20 hidden size-9 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white backdrop-blur hover:bg-white/20 sm:grid"
            >
              <ChevronLeft className="size-5" />
            </button>
          )}
          {gi + 1 < groups.length && (
            <button
              type="button"
              aria-label="Наступний автор"
              onClick={() => {
                setGi(gi + 1)
                setSi(0)
              }}
              className="absolute top-1/2 right-1 z-20 hidden size-9 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white backdrop-blur hover:bg-white/20 sm:grid"
            >
              <ChevronRight className="size-5" />
            </button>
          )}

          {/* статистика автора */}
          {insightsOpen && (
            <div className="absolute inset-0 z-30 flex flex-col bg-black/90 text-white backdrop-blur-sm">
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                <span className="text-sm font-semibold">Статистика історії</span>
                <button
                  type="button"
                  aria-label="Закрити статистику"
                  onClick={() => setInsightsOpen(false)}
                  className="grid size-8 place-items-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <X className="size-5" />
                </button>
              </div>
              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
                {insightsLoading ? (
                  <div className="flex justify-center py-10">
                    <Loader2 className="size-5 animate-spin text-white/60" />
                  </div>
                ) : insights ? (
                  <>
                    <section>
                      <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-white/60 uppercase">
                        <Eye className="size-3.5" /> Перегляди · {insights.views.length}
                      </h3>
                      {insights.views.length ? (
                        <ul className="space-y-2.5">
                          {insights.views.map((v) => (
                            <InsightPerson key={`${v.user.id}-${v.at}`} user={v.user} at={now ? timeAgo(v.at, now) : ""} />
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-white/45">Ще ніхто не дивився</p>
                      )}
                    </section>

                    <section>
                      <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-white/60 uppercase">
                        <SparkIcon className="size-3.5 text-amber-300" /> Світло · {insights.lights.length}
                      </h3>
                      {insights.lights.length ? (
                        <ul className="space-y-2.5">
                          {insights.lights.map((l) => (
                            <InsightPerson key={`${l.user.id}-${l.at}`} user={l.user} at={now ? timeAgo(l.at, now) : ""} />
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-white/45">Ще ніхто не світив</p>
                      )}
                    </section>

                    <section>
                      <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-white/60 uppercase">
                        <Smile className="size-3.5" /> Реакції · {insights.reactions.reduce((n, r) => n + r.users.length, 0)}
                      </h3>
                      {insights.reactions.length ? (
                        <div className="space-y-3">
                          {insights.reactions.map((r) => (
                            <div key={r.emoji}>
                              <p className="mb-1 text-sm">
                                {r.emoji} <span className="text-white/50">{r.users.length}</span>
                              </p>
                              <ul className="space-y-2.5">
                                {r.users.map((u) => (
                                  <InsightPerson key={`${r.emoji}-${u.id}`} user={u} />
                                ))}
                              </ul>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-white/45">Ще немає реакцій</p>
                      )}
                    </section>
                  </>
                ) : (
                  <p className="py-8 text-center text-sm text-white/50">Не вдалося завантажити статистику</p>
                )}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

/** 0:05 — хвилини:секунди для таймера програвання. */
function clock(seconds: number) {
  const total = Math.max(0, Math.floor(seconds))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`
}

function InsightPerson({ user, at }: { user: StoryActor; at?: string }) {
  return (
    <li>
      <Link
        href={`/${user.username}`}
        className="-mx-1.5 flex items-center gap-2.5 rounded-lg px-1.5 py-1 transition-colors hover:bg-white/10"
      >
        <UserAvatar user={user} size="sm" />
        <span className="min-w-0 flex-1 truncate text-sm">
          {user.name} <span className="text-white/45">@{user.username}</span>
        </span>
        {at && <span className="shrink-0 text-[11px] text-white/40">{at}</span>}
        <ChevronRight className="size-3.5 shrink-0 text-white/30" />
      </Link>
    </li>
  )
}
