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

/** Смуга сторіс над стрічкою: своє коло + автори (непереглянуті з кільцевим градієнтом). */
export function StoriesBar() {
  const me = useMe()
  const [groups, setGroups] = useState<StoryGroup[] | null>(null)
  const [openAt, setOpenAt] = useState<number | null>(null)
  const [creatorOpen, setCreatorOpen] = useState(false)

  const reload = () => {
    if (isMockMode) return
    void getStoryFeed().then((res) => setGroups(res.ok && res.data ? res.data : []))
  }
  useEffect(reload, [])

  if (isMockMode || groups === null) return null

  const mine = groups.find((g) => g.isMe)

  return (
    <>
      <div className="no-scrollbar flex gap-3.5 overflow-x-auto border-b px-4 py-3">
        {/* моє коло — завжди справжній аватар поточного користувача */}
        <button
          type="button"
          onClick={() => (mine ? setOpenAt(groups.indexOf(mine)) : setCreatorOpen(true))}
          className="group flex w-16 shrink-0 flex-col items-center gap-1.5"
          aria-label={mine ? "Ваші історії" : "Додати історію"}
        >
          <span className="relative">
            <span
              className={cn(
                "grid size-10 place-items-center rounded-full p-[2px]",
                mine ? "bg-[conic-gradient(var(--brand),var(--glow),var(--brand))]" : "bg-muted",
              )}
            >
              <span className="grid size-full place-items-center rounded-full bg-background p-[2px]">
                <UserAvatar user={mine?.author ?? me} size="lg" className={cn("size-full", !mine && "opacity-80")} />
              </span>
            </span>
            {!mine && (
              <span className="absolute -right-0.5 -bottom-0.5 grid size-5 place-items-center rounded-full border-2 border-background bg-brand text-brand-foreground">
                <Plus className="size-3" strokeWidth={3} />
              </span>
            )}
          </span>
          <span className="w-full truncate text-center text-[11px] text-muted-foreground">{mine ? "Ваша історія" : "Додати"}</span>
        </button>

        {groups
          .filter((g) => !g.isMe)
          .map((g) => {
            const unseen = g.stories.some((s) => !s.seen)
            return (
              <button
                key={g.author.id}
                type="button"
                onClick={() => setOpenAt(groups.indexOf(g))}
                className="flex w-16 shrink-0 flex-col items-center gap-1.5"
              >
                <span
                  className={cn(
                    "grid size-10 place-items-center rounded-full p-[2px]",
                    unseen ? "bg-[conic-gradient(var(--brand),var(--glow),var(--brand))]" : "bg-muted",
                  )}
                >
                  <span className="grid size-full place-items-center rounded-full bg-background p-[2px]">
                    <UserAvatar user={g.author} size="lg" className="size-full" />
                  </span>
                </span>
                <span className="w-full truncate text-center text-[11px] text-muted-foreground">{g.author.name}</span>
              </button>
            )
          })}
      </div>

      {openAt !== null && (
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
