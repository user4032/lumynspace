"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { Loader2, Plus, X } from "lucide-react"
import { toast } from "sonner"
import type { StoryGroup } from "@/types"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { UserAvatar } from "@/components/user-avatar"
import { createStory, getStoryFeed } from "@/lib/actions/stories"
import { uploadImage, POST_MEDIA_ACCEPT } from "@/lib/storage"
import { isMockMode } from "@/lib/env"
import { cn } from "@/lib/utils"
import { useMe } from "@/lib/viewer-store"
import { StoryViewer } from "./story-viewer"

/**
 * Своя історія в рядку композера: аватар із бурштиновим кільцем, якщо історія вже є,
 * і з плюсом, якщо ще ні. Клік відкриває перегляд або створення.
 */
export function StoryEntry({ className }: { className?: string }) {
  const me = useMe()
  const [groups, setGroups] = useState<StoryGroup[] | null>(null)
  const [openAt, setOpenAt] = useState<number | null>(null)
  const [creatorOpen, setCreatorOpen] = useState(false)

  const reload = () => {
    if (isMockMode) return
    void getStoryFeed().then((res) => setGroups(res.ok && res.data ? res.data : []))
  }
  useEffect(reload, [])

  if (isMockMode) return null

  const mine = groups?.find((g) => g.isMe)
  const storyCount = mine?.stories.length ?? 0

  return (
    <>
      <button
        type="button"
        title={mine ? "Додати історію / Переглянути" : "Додати історію"}
        aria-label={mine ? "Додати або переглянути історії" : "Додати історію"}
        onClick={() => {
          if (mine && groups && storyCount > 0) {
            // Якщо є свої історії - можна як переглянути, так і додати нову
            // За замовчуванням відкриваємо перегляд, але також дозволяємо додавати через окрему дію
            // Клік відкриває перегляд, для додавання використовуємо + кнопку
            setOpenAt(groups.indexOf(mine))
          } else {
            setCreatorOpen(true)
          }
        }}
        className={cn(
          "group relative shrink-0 rounded-full outline-none transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-95",
          className,
        )}
      >
        <span
          className={cn(
            "grid size-8 place-items-center rounded-full",
            mine && storyCount >= 1 && "bg-[conic-gradient(var(--brand),var(--glow),var(--brand))] p-[2px]",
          )}
        >
          <span className={cn("grid size-full place-items-center rounded-full", mine && storyCount >= 1 && "bg-background p-[1.5px]")}>
            <UserAvatar user={mine?.author ?? me} size="md" className="size-full" />
          </span>
        </span>
        {mine && storyCount >= 1 && (
          <span className="absolute -top-0.5 -right-0.5 grid min-w-[16px] h-[16px] place-items-center rounded-full border-2 border-background bg-glow px-1 text-[9px] font-semibold text-black tabular-nums">
            {storyCount}
          </span>
        )}
        <button
          type="button"
          aria-label="Додати історію"
          onClick={(e) => {
            e.stopPropagation()
            setCreatorOpen(true)
          }}
          className="absolute -right-0.5 -bottom-0.5 grid size-[15px] place-items-center rounded-full border-2 border-background bg-brand text-brand-foreground shadow-[0_0_0_4px_color-mix(in_oklab,var(--brand)_12%,transparent)] transition-transform group-hover:scale-110"
        >
          <Plus className="size-2.5" strokeWidth={3.5} />
        </button>
      </button>

      {openAt !== null && groups && (
        <StoryViewer
          groups={groups}
          startIndex={openAt}
          onClose={() => {
            setOpenAt(null)
            reload()
          }}
          onDeleted={reload}
        />
      )}
      <StoryCreator open={creatorOpen} onOpenChange={setCreatorOpen} onDone={reload} />
    </>
  )
}

/** Створення сторіс: фото/відео (≤60 с) + підпис + «усі/близькі». */
function StoryCreator({ open, onOpenChange, onDone }: { open: boolean; onOpenChange: (v: boolean) => void; onDone: () => void }) {
  const [preview, setPreview] = useState<{ url: string; mime: string; duration: number } | null>(null)
  const [caption, setCaption] = useState("")
  const [close, setClose] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [pending, startTransition] = useTransition()
  const fileRef = useRef<HTMLInputElement>(null)
  const videoMeta = useRef<HTMLVideoElement>(null)

  const onFile = async (file: File) => {
    setUploading(true)
    const isVideo = file.type.startsWith("video/")
    const url = URL.createObjectURL(file)
    let duration = 5
    if (isVideo) duration = await new Promise<number>((resolve) => {
      const v = document.createElement("video")
      v.preload = "metadata"
      v.onloadedmetadata = () => resolve(Math.min(60, Math.max(3, Math.round(v.duration) || 5)))
      v.onerror = () => resolve(5)
      v.src = url
    })
    const res = await uploadImage("post-media", file)
    URL.revokeObjectURL(url)
    setUploading(false)
    if (!res.ok) return toast.error(res.error)
    setPreview({ url: res.url, mime: file.type, duration })
  }

  const publish = () => {
    if (!preview) return
    startTransition(async () => {
      const res = await createStory({
        mediaUrl: preview.url,
        mime: preview.mime,
        durationSec: preview.duration,
        caption,
        audience: close ? "close_friends" : "public",
      })
      if (res.ok) {
        toast.success(close ? "Історія — лише близьким" : "Історія опублікована", { description: "Зникне через 24 години." })
        onOpenChange(false)
        onDone()
      } else toast.error(res.error)
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          setPreview(null)
          setCaption("")
          setClose(false)
        }
        onOpenChange(v)
      }}
    >
      <DialogContent className="gap-3 sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Нова історія</DialogTitle>
        </DialogHeader>
        <input
          ref={fileRef}
          type="file"
          accept={POST_MEDIA_ACCEPT}
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            e.target.value = ""
            if (f) void onFile(f)
          }}
        />
        {preview ? (
          <>
            <div className="relative aspect-[9/16] max-h-[50vh] overflow-hidden rounded-xl border bg-black">
              {preview.mime.startsWith("video/") ? (
                <video ref={videoMeta} src={preview.url} muted loop playsInline autoPlay className="size-full object-cover" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element -- локальний прев'ю/Storage URL
                <img src={preview.url} alt="" className="size-full object-cover" />
              )}
              <button
                type="button"
                aria-label="Прибрати"
                onClick={() => setPreview(null)}
                className="absolute top-2 right-2 grid size-7 place-items-center rounded-full bg-black/60 text-white"
              >
                <X className="size-4" />
              </button>
            </div>
            <input
              value={caption}
              maxLength={200}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Підпис (необов'язково)"
              className="h-10 rounded-md border bg-subtle px-3 text-sm outline-none focus:border-ring"
            />
            <div className="flex gap-1 rounded-lg bg-muted p-1 text-sm">
              {[
                { v: false, label: "Усі" },
                { v: true, label: "Близькі друзі" },
              ].map((o) => (
                <button
                  key={String(o.v)}
                  type="button"
                  onClick={() => setClose(o.v)}
                  className={cn(
                    "flex-1 rounded-md px-3 py-1.5 font-medium transition-colors",
                    close === o.v ? "bg-background shadow-sm" : "text-muted-foreground",
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
            <Button className="rounded-full" disabled={pending} onClick={publish}>
              {pending ? <Loader2 className="animate-spin" /> : "Опублікувати"}
            </Button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex aspect-[3/1] w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed text-sm text-muted-foreground transition-colors hover:bg-subtle"
          >
            {uploading ? <Loader2 className="size-5 animate-spin" /> : <Plus className="size-5" />}
            {uploading ? "Завантаження…" : "Фото або відео до 60 секунд"}
          </button>
        )}
      </DialogContent>
    </Dialog>
  )
}
