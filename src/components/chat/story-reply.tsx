"use client"

import { useEffect } from "react"
import { Loader2, Play, X } from "lucide-react"
import type { ChatStorySnapshot } from "@/types"
import { SparkIcon } from "@/components/icons"
import { UserAvatar } from "@/components/user-avatar"
import { cn } from "@/lib/utils"

const isVideo = (mime: string) => mime.startsWith("video/")

function storyAuthor(story: ChatStorySnapshot) {
  return { ...story.author, online: false }
}

/** Компактне прев'ю історії у бульбашці чату — як у TikTok/Instagram. */
export function StoryReplyCard({
  story,
  mine,
  onOpen,
}: {
  story: ChatStorySnapshot
  mine: boolean
  onOpen: (story: ChatStorySnapshot) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(story)}
      aria-label={`Відкрити історію ${story.author.name}`}
      className={cn(
        "group/story relative block w-[7.75rem] shrink-0 overflow-hidden rounded-xl border text-left transition-transform active:scale-[0.98]",
        mine ? "border-primary-foreground/25" : "border-border/70",
      )}
    >
      <span className="relative block aspect-[9/15] bg-black">
        {isVideo(story.mime) ? (
          <video
            src={`${story.mediaUrl}#t=0.1`}
            muted
            playsInline
            preload="metadata"
            className="size-full object-cover"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- публічний Storage URL
          <img src={story.mediaUrl} alt="" loading="lazy" className="size-full object-cover" />
        )}
        <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/25" />
        <span className="absolute top-1.5 left-1.5 inline-flex items-center gap-1 rounded-full bg-black/45 px-1.5 py-0.5 text-[9.5px] font-medium tracking-wide text-white/90 uppercase backdrop-blur">
          <SparkIcon className="size-2.5 text-amber-300" /> Історія
        </span>
        {isVideo(story.mime) && (
          <span className="pointer-events-none absolute inset-0 grid place-items-center">
            <span className="grid size-8 place-items-center rounded-full bg-black/45 text-white backdrop-blur">
              <Play className="size-4 translate-x-px fill-current" />
            </span>
          </span>
        )}
        <span className="absolute inset-x-0 bottom-0 flex items-center gap-1.5 p-1.5 text-white">
          <UserAvatar user={storyAuthor(story)} size="sm" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[11px] leading-tight font-medium">{story.author.name}</span>
            <span className="block truncate text-[10px] leading-tight text-white/65">@{story.author.username}</span>
          </span>
        </span>
      </span>
    </button>
  )
}

/** Повноекранний перегляд знімка, коли сама історія вже зникла (24 год). */
export function StorySnapshotViewer({
  story,
  loading,
  unavailable,
  onClose,
}: {
  story: ChatStorySnapshot
  loading?: boolean
  unavailable?: boolean
  onClose: () => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-black/95 text-white"
      role="dialog"
      aria-modal="true"
      aria-label={`Історія ${story.author.name}`}
    >
      <div className="flex shrink-0 items-center gap-2.5 px-4 pt-4 pb-2">
        <UserAvatar user={storyAuthor(story)} size="md" className="rounded-full ring-1 ring-white/30" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{story.author.name}</p>
          <p className="truncate text-[11px] text-white/60">
            @{story.author.username} · {formatDate(story.createdAt)}
          </p>
        </div>
        <button
          type="button"
          aria-label="Закрити"
          onClick={onClose}
          className="grid size-8 place-items-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white"
        >
          <X className="size-5" />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center p-3">
        <div className="relative h-full max-h-[calc(100dvh-7rem)] w-full max-w-md overflow-hidden rounded-2xl bg-black">
          {isVideo(story.mime) ? (
            <video src={story.mediaUrl} controls autoPlay playsInline loop className="size-full object-contain" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- публічний Storage URL
            <img src={story.mediaUrl} alt={story.caption ?? ""} className="size-full object-contain" />
          )}

          {loading && (
            <span className="absolute inset-0 grid place-items-center bg-black/40">
              <Loader2 className="size-6 animate-spin text-white/80" />
            </span>
          )}

          {story.caption && !loading && (
            <p className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-4 pt-10 pb-4 text-center text-sm">
              {story.caption}
            </p>
          )}

          {unavailable && (
            <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/55 px-6 text-center backdrop-blur-[2px]">
              <span className="grid size-11 place-items-center rounded-full bg-white/10">
                <SparkIcon className="size-5 text-amber-300" />
              </span>
              <span className="text-sm font-semibold">Історія вже недоступна</span>
              <span className="text-xs text-white/60">Історії живуть 24 години — це збережене прев&apos;ю у чаті.</span>
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

function formatDate(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  return date.toLocaleDateString("uk-UA", { day: "numeric", month: "long", year: "numeric" })
}
