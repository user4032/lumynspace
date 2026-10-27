"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
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
    frame: "mx-auto w-full max-w-[280px] overflow-hidden rounded-2xl",
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
  const src = useMemo(() => URL.createObjectURL(file), [file])
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null)
  // 0×0 = ще не виміряно. Реальний розмір приходить з ResizeObserver.
  const [viewport, setViewport] = useState({ width: 0, height: 0 })
  // DialogContent живе в порталі й монтується після першого коміту,
  // тому елемент беремо через callback-ref, а не через useRef + effect([]).
  const [viewportEl, setViewportEl] = useState<HTMLDivElement | null>(null)
  const [zoom, setZoom] = useState(MIN_ZOOM)
  const [offset, setOffset] = useState<CropOffset>({ x: 0, y: 0 })
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const drag = useRef<{ id: number; x: number; y: number; ox: number; oy: number } | null>(null)

  useEffect(() => {
    return () => {
      URL.revokeObjectURL(src)
    }
  }, [src])

  // Розмір береться з layout-розміру (contentRect), а не з getBoundingClientRect:
  // останній враховує transform (анімація zoom-in діалогу) і дає завужений розмір.
  useEffect(() => {
    if (!viewportEl) return
    const ro = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect
      if (!rect || rect.width <= 0 || rect.height <= 0) return
      setViewport((prev) =>
        prev.width === rect.width && prev.height === rect.height
          ? prev
          : { width: rect.width, height: rect.height },
      )
    })
    ro.observe(viewportEl)
    return () => ro.disconnect()
  }, [viewportEl])

  // Маленький файл часто вже complete до підписки на onLoad.
  const setImgEl = useCallback((el: HTMLImageElement | null) => {
    imgRef.current = el
    if (el && el.complete && el.naturalWidth > 0 && el.naturalHeight > 0) {
      setNatural((prev) => prev ?? { width: el.naturalWidth, height: el.naturalHeight })
    }
  }, [])

  const ready = Boolean(natural && viewport.width > 0 && viewport.height > 0)

  const limits = (z: number) => {
    if (!natural || !viewport.width || !viewport.height) return { x: 0, y: 0 }
    const s = coverScale(natural.width, natural.height, viewport.width, viewport.height) * Math.max(MIN_ZOOM, z)
    const sw = Math.min(natural.width, viewport.width / s)
    const sh = Math.min(natural.height, viewport.height / s)
    return {
      x: Math.max(0, ((natural.width - sw) / 2) * s),
      y: Math.max(0, ((natural.height - sh) / 2) * s),
    }
  }

  // Зсув завжди тримаємо в межах, навіть якщо вьюпорт змінився після перетягування.
  const lim = limits(zoom)
  const effOffset: CropOffset = {
    x: clamp(offset.x, -lim.x, lim.x),
    y: clamp(offset.y, -lim.y, lim.y),
  }

  const scale =
    ready && natural
      ? coverScale(natural.width, natural.height, viewport.width, viewport.height) * Math.max(MIN_ZOOM, zoom)
      : 1
  const area =
    ready && natural
      ? cropArea({ imageWidth: natural.width, imageHeight: natural.height, viewport, zoom, offset: effOffset })
      : null

  const display =
    area && natural
      ? {
          x: (natural.width / 2 - area.sw / 2 - area.sx) * scale,
          y: (natural.height / 2 - area.sh / 2 - area.sy) * scale,
        }
      : { x: 0, y: 0 }

  const changeZoom = (next: number) => {
    const z = clamp(next, MIN_ZOOM, MAX_ZOOM)
    const l = limits(z)
    setZoom(z)
    setOffset(() => ({ x: clamp(effOffset.x, -l.x, l.x), y: clamp(effOffset.y, -l.y, l.y) }))
  }

  const reset = () => {
    setZoom(MIN_ZOOM)
    setOffset({ x: 0, y: 0 })
  }

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!ready) return
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, ox: effOffset.x, oy: effOffset.y }
  }

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    const l = limits(zoom)
    setOffset({
      x: clamp(d.ox + e.clientX - d.x, -l.x, l.x),
      y: clamp(d.oy + e.clientY - d.y, -l.y, l.y),
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
          ref={setViewportEl}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          className={cn(
            "relative touch-none overflow-hidden bg-[#000000] select-none",
            spec.aspect,
            spec.frame,
            ready ? "cursor-grab active:cursor-grabbing" : "cursor-wait",
          )}
        >
          {src && (
            // eslint-disable-next-line @next/next/no-img-element -- локальний blob: URL для прев'ю
            <img
              ref={setImgEl}
              src={src}
              alt=""
              draggable={false}
              onLoad={(e) => {
                const el = e.currentTarget
                if (el.naturalWidth && el.naturalHeight) {
                  setNatural({ width: el.naturalWidth, height: el.naturalHeight })
                }
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

          {/* Discord: коло = вписане коло квадрата-вьюпорта; затемнені лише 4 кути */}
          {kind === "avatar" && (
            <>
              <span
                className="pointer-events-none absolute inset-0"
                style={{
                  background:
                    "radial-gradient(circle closest-side at center, transparent 99%, rgba(0,0,0,0.5) 100%)",
                }}
              />
              {/* border (а не ring/box-shadow): лишається всередині квадрата й не обрізається overflow-hidden */}
              <span className="pointer-events-none absolute inset-0 rounded-full border-[3px] border-white" />
            </>
          )}

          {kind === "cover" && (
            <>
              <span className="pointer-events-none absolute inset-0 opacity-50">
                <span className="absolute inset-y-0 left-1/3 w-px bg-white/40" />
                <span className="absolute inset-y-0 left-2/3 w-px bg-white/40" />
                <span className="absolute inset-x-0 top-1/3 h-px bg-white/40" />
                <span className="absolute inset-x-0 top-2/3 h-px bg-white/40" />
              </span>
              <span className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-white/25" />
            </>
          )}

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