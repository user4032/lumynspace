"use client"

import { Download, FileText, Mic } from "lucide-react"
import type { ChatAttachment, ChatStorySnapshot } from "@/types"
import { formatBytes, LEGACY_IMAGE_RE } from "@/lib/chat-files"
import { cn } from "@/lib/utils"
import { firstProfileUrl, linkifyText } from "@/lib/link-embeds"
import { ProfileLinkPreview } from "./profile-link-preview"
import { StoryReplyCard } from "./story-reply"

/** Текст + старі «голі» посилання на фото (рендеряться як картинки) */
export function splitLegacy(content: string): { text: string; images: string[] } {
  const images = content.match(LEGACY_IMAGE_RE) ?? []
  const text = images.reduce((t, u) => t.replace(u, ""), content).trim()
  return { text, images }
}

/** Короткий опис повідомлення для цитати-відповіді. */
export function messageSummary(content: string, attachments: ChatAttachment[] = []): string {
  const text = splitLegacy(content).text
  if (attachments.some((a) => a.kind === "story" && a.story)) return text ? `Історія · ${text}` : "Історія"
  return text
}

export function formatVoice(sec?: number) {
  if (!sec || sec < 0) return "0:00"
  return `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, "0")}`
}

export function MessageBody({
  content,
  attachments = [],
  urls,
  mine,
  onOpenStory,
}: {
  content: string
  attachments?: ChatAttachment[]
  urls: Record<string, string>
  mine: boolean
  onOpenStory?: (story: ChatStorySnapshot) => void
}) {
  const { text, images } = splitLegacy(content)
  const stories = attachments.flatMap((a) => (a.kind === "story" && a.story ? [a.story] : []))
  const pics = [
    ...images.map((u) => ({ key: u, src: u, name: "фото", width: undefined as number | undefined, height: undefined as number | undefined })),
    ...attachments
      .filter((a) => a.kind === "image")
      .map((a) => ({ key: a.path, src: urls[a.path], name: a.name, width: a.width, height: a.height })),
  ]
  const files = attachments.filter((a) => a.kind === "file")
  const voices = attachments.filter((a) => a.kind === "audio")
  // Discord-стиль: посилання на профіль Lumyn → картка з останнім дописом
  const profileUrl = firstProfileUrl(text)

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      {stories.map((s) => (
        <StoryReplyCard key={s.id} story={s} mine={mine} onOpen={onOpenStory ?? (() => undefined)} />
      ))}
      {pics.length > 0 && (
        <div className={cn("grid gap-1", pics.length > 1 && "grid-cols-2")}>
          {pics.map((p) =>
            p.src ? (
              <a key={p.key} href={p.src} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-xl" aria-label={`Відкрити ${p.name}`}>
                {/* eslint-disable-next-line @next/next/no-img-element -- підписані URL, змінні розміри */}
                <img
                  src={p.src}
                  alt={p.name}
                  width={p.width}
                  height={p.height}
                  loading="lazy"
                  className="max-h-80 w-full object-cover transition-opacity hover:opacity-90"
                />
              </a>
            ) : (
              <div key={p.key} className="aspect-[4/3] w-48 animate-pulse rounded-xl bg-muted" />
            ),
          )}
        </div>
      )}
      {voices.map((v) => (
        <div
          key={v.path}
          className={cn(
            "flex min-w-0 items-center gap-2.5 rounded-xl border px-3 py-1.5",
            mine ? "border-primary-foreground/20 bg-primary-foreground/10" : "bg-background",
          )}
        >
          <Mic className="size-4 shrink-0" />
          {urls[v.path] ? (
            // eslint-disable-next-line jsx-a11y/media-has-caption -- голосове без субтитрів
            <audio controls preload="metadata" src={urls[v.path]} className="h-9 min-w-0 flex-1" />
          ) : (
            <span className="h-9 flex-1 animate-pulse rounded-lg bg-muted" />
          )}
          <span className={cn("shrink-0 font-mono text-xs tabular", mine ? "text-primary-foreground/60" : "text-muted-foreground")}>
            {formatVoice(v.duration)}
          </span>
        </div>
      ))}
      {files.map((f) => (
        <a
          key={f.path}
          href={urls[f.path] ? `${urls[f.path]}&download=${encodeURIComponent(f.name)}` : undefined}
          className={cn(
            "flex min-w-0 items-center gap-3 rounded-xl border px-3 py-2",
            mine ? "border-primary-foreground/20 bg-primary-foreground/10" : "bg-background",
            !urls[f.path] && "pointer-events-none opacity-60",
          )}
        >
          <FileText className="size-5 shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{f.name}</span>
            <span className={cn("block text-xs", mine ? "text-primary-foreground/60" : "text-muted-foreground")}>
              {formatBytes(f.size)} · {f.mime.split("/")[1]?.toUpperCase() || "файл"}
            </span>
          </span>
          <Download className="size-4 shrink-0" />
        </a>
      ))}
      {text && <LinkifiedText text={text} />}
      {profileUrl && <ProfileLinkPreview url={profileUrl} mine={mine} />}
    </div>
  )
}

/** Текст із клікабельними http(s)-посиланнями (відкриваються у новій вкладці). */
function LinkifiedText({ text }: { text: string }) {
  return (
    <span className="[overflow-wrap:anywhere] whitespace-pre-wrap">
      {linkifyText(text).map((part, i) =>
        part.href ? (
          <a
            key={i}
            href={part.href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="font-medium underline decoration-current/40 underline-offset-2 transition-colors hover:decoration-current"
          >
            {part.text}
          </a>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </span>
  )
}
