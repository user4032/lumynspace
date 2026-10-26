"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { AnimatePresence, motion } from "framer-motion"
import { ChevronLeft, ChevronRight, Download, X } from "lucide-react"

/** Повноекранний переглядач фото поста: стрілки, клавіатура, свайпи, лічильник. */
export function PhotoLightbox({
  photos,
  index,
  onClose,
}: {
  photos: { url: string; alt?: string; width?: number; height?: number }[]
  index: number
  onClose: () => void
}) {
  const [i, setI] = useState(index)

  const next = useCallback(() => setI((x) => (x + 1) % photos.length), [photos.length])
  const prev = useCallback(() => setI((x) => (x - 1 + photos.length) % photos.length), [photos.length])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
      if (e.key === "ArrowRight") next()
      if (e.key === "ArrowLeft") prev()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [next, prev, onClose])

  // не даємо сторінці скролитися під повноекранним переглядом
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  // свайпи на телефоні
  const touchX = useRef(0)
  const onStart = (e: React.TouchEvent) => {
    touchX.current = e.touches[0].clientX
  }
  const onEnd = (e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchX.current
    if (Math.abs(dx) > 48) (dx < 0 ? next : prev)()
  }

  const photo = photos[i]
  if (!photo) return null

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex flex-col bg-black"
      role="dialog"
      aria-modal="true"
      aria-label="Перегляд фото"
      onClick={onClose}
      onTouchStart={onStart}
      onTouchEnd={onEnd}
    >
      {/* верх: лічильник і дії */}
      <div className="flex items-center justify-between p-3 text-white" onClick={(e) => e.stopPropagation()}>
        <span className="font-mono text-sm tabular">
          {i + 1} / {photos.length}
        </span>
        <span className="flex items-center gap-1">
          <a
            href={`${photo.url}${photo.url.includes("?") ? "&" : "?"}download=`}
            download
            aria-label="Завантажити фото"
            className="grid size-9 place-items-center rounded-full text-white/85 transition-colors hover:bg-white/10 hover:text-white"
          >
            <Download className="size-5" />
          </a>
          <button
            type="button"
            aria-label="Закрити"
            onClick={onClose}
            className="grid size-9 place-items-center rounded-full text-white/85 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="size-5" />
          </button>
        </span>
      </div>

      {/* фото */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden px-2 pb-4">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={photo.url}
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="flex max-h-full max-w-full items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- Storage URL повного розміру */}
            <img src={photo.url} alt={photo.alt ?? ""} className="max-h-[82dvh] max-w-full select-none object-contain" draggable={false} />
          </motion.div>
        </AnimatePresence>

        {photos.length > 1 && (
          <>
            <button
              type="button"
              aria-label="Попереднє фото"
              onClick={(e) => {
                e.stopPropagation()
                prev()
              }}
              className="absolute left-2 grid size-10 place-items-center rounded-full bg-black/40 text-white backdrop-blur transition-colors hover:bg-black/60"
            >
              <ChevronLeft className="size-6" />
            </button>
            <button
              type="button"
              aria-label="Наступне фото"
              onClick={(e) => {
                e.stopPropagation()
                next()
              }}
              className="absolute right-2 grid size-10 place-items-center rounded-full bg-black/40 text-white backdrop-blur transition-colors hover:bg-black/60"
            >
              <ChevronRight className="size-6" />
            </button>
          </>
        )}
      </div>

      {/* мініатюри, якщо фото кілька */}
      {photos.length > 1 && (
        <div className="flex justify-center gap-2 overflow-x-auto p-3" onClick={(e) => e.stopPropagation()}>
          {photos.map((p, idx) => (
            <button
              key={`${p.url}-${idx}`}
              type="button"
              onClick={() => setI(idx)}
              aria-label={`Фото ${idx + 1}`}
              className={`size-12 shrink-0 overflow-hidden rounded-md transition-opacity ${idx === i ? "ring-2 ring-white" : "opacity-50 hover:opacity-80"}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- мініатюра */}
              <img src={p.url} alt="" className="size-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </motion.div>,
    document.body,
  )
}
