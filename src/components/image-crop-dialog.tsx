"use client"

import { useEffect, useRef, useState } from "react"
import { Loader2, RotateCcw, ZoomIn, ZoomOut } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Slider } from "@/components/ui/slider"
import { cropArea, cropImageToFile, coverScale, type CropOffset } from "@/lib/image-crop"
import { cn } from "@/lib/utils"

export type CropKind = "avatar" | "cover"

/** Кінцевий розмір файлу: аватар квадратний, обкладинка 3:1 (як у профілі). */
const SPEC = {
  avatar: {
    width: 512,
    height: 512,
    action: "Обрізати аватар",
    hint: "Перетягніть фото, щоб вибрати кадр. У профілі видно круглу частину.",
    aspect: "aspect-square",
    frame: "mx-auto w-full max-w-[300px] rounded-xl",
  },
  cover: {
    width: 1600,
    height: 534,
    action: "Обрізати обкладинку",
    hint: "Перетягніть фото, щоб вибрати кадр. Співвідношення сторін — 3:1.",
    aspect: "aspect-[3/1]",
    frame: "w-full rounded-xl",
  },
} as const

const MIN_ZOOM = 1
const MAX_ZOOM = 4

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

/**
 * Кроп як у Discord/Telegram: тягнеш фото, масштабуєш повзунком.
 * Геометрія береться з `@/lib/image-crop`, тому прев'ю й файл збігаються 1:1.
 */
export function ImageCropDialog({
  file,
  kind,
  onClose,
  onConfirm,
}: {
  file: File
  kind: CropKind
  onClose: () => void
  /** true → діалог закриється; false → лишиться відкритим (помилка вже показана тостом). */
  onConfirm: (file: File) => Promise<boolean>
}) {
  const spec = SPEC[kind]
  const [src, setSrc] = useState<string | null>(null)
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null)
  const [viewport, setViewport] = useState({ width: 0, height: 0 })
  const [zoom, setZoom] = useState(MIN_ZOOM)
  const [offset, setOffset] = useState<CropOffset>({ x: 0, y: 0 })
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ id: number; x: number; y: number; ox: number; oy: number } | null>(null)

  // FileReader (а не object URL) — безпечно для StrictMode: URL не ревокається під час повторного маунту
  useEffect(() => {
    let cancelled = false
    const reader = new FileReader()
    reader.onload = () => {
      if (!cancelled && typeof reader.result === "string") setSrc(reader.result)
    }
    reader.onerror = () => {
      if (!cancelled) setFailed(true)
    }
    reader.readAsDataURL(file)
    return () => {
      cancelled = true
      if (reader.readyState === FileReader.LOADING) reader.abort()
    }
  }, [file])

  const DEFAULT_VIEWPORT = { width: 200, height: 200 }
  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    setViewport(DEFAULT_VIEWPORT)
    const ro = new ResizeObserver(([entry]) => {
      const rect = entry.contentRect
      setViewport({ width: rect.width, height: rect.height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const ready = Boolean(natural && viewport.width > 0)
  const scale = ready && natural ? coverScale(natural.width, natural.height, viewport.width, viewport.height) * zoom : 1
  const area =
    ready && natural ? cropArea({ imageWidth: natural.width, imageHeight: natural.height, viewport, zoom, offset }) : null

  // зсув, уже обрізаний по краях — прев'ю показує рівно те, що піде у файл
  const display =
    area && natural
      ? {
          x: (natural.width / 2 - area.sw / 2 - area.sx) * scale,
          y: (natural.height / 2 - area.sh / 2 - area.sy) * scale,
        }
      : { x: 0, y: 0 }

  const limits = (z: number) => {
    if (!natural || !viewport.width) return { x: 0, y: 0 }
    const s = coverScale(natural.width, natural.height, viewport.width, viewport.height) * Math.max(MIN_ZOOM, z)
    const sw = Math.min(natural.width, viewport.width / s)
    const sh = Math.min(natural.height, viewport.height / s)
    return {
      x: Math.max(0, ((natural.width - sw) / 2) * s),
      y: Math.max(0, ((natural.height - sh) / 2) * s),
    }
  }

  const changeZoom = (next: number) => {
    const z = clamp(next, MIN_ZOOM, MAX_ZOOM)
    const lim = limits(z)
    setZoom(z)
    setOffset((o) => ({ x: clamp(o.x, -lim.x, lim.x), y: clamp(o.y, -lim.y, lim.y) }))
  }

  const reset = () => {
    setZoom(MIN_ZOOM)
    setOffset({ x: 0, y: 0 })
  }

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!natural) return
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y }
  }

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    const lim = limits(zoom)
    setOffset({
      x: clamp(d.ox + e.clientX - d.x, -lim.x, lim.x),
      y: clamp(d.oy + e.clientY - d.y, -lim.y, lim.y),
    })
  }

  const endDrag = () => {
    drag.current = null
  }

  const save = async () => {
    const img = imgRef.current
    if (!img || !area || saving) return
    setSaving(true)
    try {
      const cropped = await cropImageToFile(img, area, spec.width, spec.height, `lumyn-${kind}`)
      const ok = await onConfirm(cropped)
      if (ok) onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не вдалося обробити фото")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && !saving && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{spec.action}</DialogTitle>
          <DialogDescription>{spec.hint}</DialogDescription>
        </DialogHeader>

        <div
          ref={viewportRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          className={cn(
            "relative touch-none overflow-hidden bg-black select-none",
            spec.aspect,
            spec.frame,
            ready ? "cursor-grab active:cursor-grabbing" : "cursor-wait",
          )}
        >
          {src && (
            // eslint-disable-next-line @next/next/no-img-element -- локальний data: URL для прев'ю
            <img
              ref={imgRef}
              src={src}
              alt=""
              draggable={false}
              onLoad={(e) => {
                const el = e.currentTarget
                if (el.naturalWidth && el.naturalHeight) setNatural({ width: el.naturalWidth, height: el.naturalHeight })
              }}
              onError={() => setFailed(true)}
              className={cn("pointer-events-none absolute max-w-none", ready ? "opacity-100" : "opacity-0")}
              style={
                natural
                  ? {
                      width: natural.width,
                      height: natural.height,
                      left: "50%",
                      top: "50%",
                      marginLeft: -natural.width / 2,
                      marginTop: -natural.height / 2,
                      transform: `translate(${display.x}px, ${display.y}px) scale(${scale})`,
                      transformOrigin: "center",
                    }
                  : { width: 1, height: 1, left: "50%", top: "50%" }
              }
            />
          )}

          {/* затемнення поза кругом — показує, як аватар виглядатиме в профілі */}
          {kind === "avatar" && (
            <span
              className="pointer-events-none absolute inset-0"
              style={{
                background: "radial-gradient(circle closest-side, transparent 98.5%, rgba(0,0,0,0.6) 99%)",
              }}
            />
          )}
          {kind === "cover" && (
            <span className="pointer-events-none absolute inset-0 opacity-50">
              <span className="absolute inset-y-0 left-1/3 w-px bg-white/40" />
              <span className="absolute inset-y-0 left-2/3 w-px bg-white/40" />
              <span className="absolute inset-x-0 top-1/3 h-px bg-white/40" />
              <span className="absolute inset-x-0 top-2/3 h-px bg-white/40" />
            </span>
          )}
          <span
            className={cn(
              "pointer-events-none absolute inset-0 ring-1 ring-inset",
              kind === "avatar" ? "rounded-full ring-white/40" : "rounded-xl ring-white/25",
            )}
          />

          {!ready && (
            <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-xs text-white/70">
              {failed ? (
                "Не вдалося відкрити фото"
              ) : (
                <>
                  <Loader2 className="size-5 animate-spin" />
                  Завантаження…
                </>
              )}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Зменшити" onClick={() => changeZoom(zoom - 0.25)} disabled={zoom <= MIN_ZOOM}>
            <ZoomOut />
          </Button>
          <Slider
            aria-label="Масштаб"
            value={[zoom]}
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={0.01}
            disabled={!ready}
            onValueChange={([v]) => changeZoom(v ?? MIN_ZOOM)}
          />
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Збільшити" onClick={() => changeZoom(zoom + 0.25)} disabled={zoom >= MAX_ZOOM}>
            <ZoomIn />
          </Button>
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Скинути кадр" onClick={reset} disabled={!ready}>
            <RotateCcw />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {spec.width} × {spec.height} px · WebP
        </p>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Скасувати
          </Button>
          <Button onClick={() => void save()} disabled={!ready || failed || saving}>
            {saving && <Loader2 className="animate-spin" />} Зберегти
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
