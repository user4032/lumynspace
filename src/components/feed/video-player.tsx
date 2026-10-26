"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import { Download, Loader2, Maximize2, Minimize2, Pause, Play, Volume2, VolumeX } from "lucide-react"
import type { VideoMedia } from "@/types/database"
import { cn } from "@/lib/utils"

const fmt = (s: number) => (Number.isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}` : "0:00")

/** Плеєр Lumyn: перетягувальна шкала з буфером, клавіатура, спінер, фулскрін. */
export function VideoPlayer({ media }: { media: VideoMedia }) {
  const ref = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(true)
  const [time, setTime] = useState(0)
  const [dur, setDur] = useState(0)
  const [buffered, setBuffered] = useState(0)
  const [waiting, setWaiting] = useState(false)
  const [full, setFull] = useState(false)
  const userStarted = useRef(false)
  const barRef = useRef<HTMLDivElement>(null)
  const pathname = usePathname()

  // перехід на іншу сторінку сайту — глушимо відео одразу, ще до розмонтування
  useEffect(() => {
    const v = ref.current
    if (!v) return
    v.pause()
    v.currentTime = 0
    userStarted.current = false
  }, [pathname])

  // розмонтування / закриття сторінки: відпускаємо джерело, щоб звук не тягнувся
  useEffect(() => {
    const v = ref.current
    const stop = () => v?.pause()
    window.addEventListener("pagehide", stop)
    document.addEventListener("visibilitychange", stop)
    return () => {
      window.removeEventListener("pagehide", stop)
      document.removeEventListener("visibilitychange", stop)
      if (!v) return
      v.pause()
      v.removeAttribute("src")
      v.load()
    }
  }, [])

  const toggle = () => {
    const v = ref.current
    if (!v) return
    userStarted.current = true
    if (v.paused) {
      v.muted = muted
      void v.play()
    } else v.pause()
  }

  const seekTo = (clientX: number) => {
    const v = ref.current
    const bar = barRef.current
    if (!v || !bar || !dur) return
    const r = bar.getBoundingClientRect()
    v.currentTime = Math.min(Math.max((clientX - r.left) / r.width, 0), 1) * dur
    setTime(v.currentTime)
  }

  // перемотування перетягуванням (палець і миша)
  const onBarDown = (e: React.PointerEvent) => {
    seekTo(e.clientX)
    const move = (ev: PointerEvent) => seekTo(ev.clientX)
    const up = () => {
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", up)
    }
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", up)
  }

  const toggleFull = useCallback(async () => {
    const v = ref.current
    if (!v) return
    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => undefined)
      setFull(false)
    } else {
      await v.requestFullscreen?.().catch(() => undefined)
      setFull(true)
    }
  }, [])

  const onKey = (e: React.KeyboardEvent) => {
    const v = ref.current
    if (!v) return
    switch (e.key) {
      case " ":
      case "k":
        e.preventDefault()
        toggle()
        break
      case "ArrowRight":
        v.currentTime = Math.min(v.currentTime + 5, dur)
        break
      case "ArrowLeft":
        v.currentTime = Math.max(v.currentTime - 5, 0)
        break
      case "m": {
        const next = !muted
        setMuted(next)
        v.muted = next
        break
      }
      case "f":
        void toggleFull()
        break
    }
  }

  const hover = (on: boolean) => {
    const v = ref.current
    if (!v || userStarted.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    if (on) {
      v.muted = true
      void v.play().catch(() => undefined)
    } else v.pause()
  }

  return (
    <div
      className="group/video relative overflow-hidden rounded-xl border bg-black outline-none focus-visible:ring-2 focus-visible:ring-ring"
      tabIndex={0}
      onKeyDown={onKey}
      onMouseEnter={() => hover(true)}
      onMouseLeave={() => hover(false)}
      onClick={(e) => e.stopPropagation()}
    >
      <video
        ref={ref}
        src={`${media.url}#t=0.1`}
        poster={media.poster}
        width={media.width}
        height={media.height}
        muted={muted}
        playsInline
        preload="metadata"
        loop
        onClick={toggle}
        onDoubleClick={() => void toggleFull()}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDur(e.currentTarget.duration)}
        onProgress={(e) => {
          const v = e.currentTarget
          if (v.buffered.length) setBuffered(v.buffered.end(v.buffered.length - 1))
        }}
        onWaiting={() => setWaiting(true)}
        onPlaying={() => setWaiting(false)}
        onCanPlay={() => setWaiting(false)}
        className="max-h-[520px] w-full cursor-pointer object-contain"
      />

      {/* буферизація */}
      {waiting && playing && (
        <Loader2 className="pointer-events-none absolute top-1/2 left-1/2 size-8 -translate-x-1/2 -translate-y-1/2 animate-spin text-white/90" />
      )}

      {!playing && !waiting && (
        <button
          type="button"
          onClick={toggle}
          aria-label="Відтворити"
          className="absolute top-1/2 left-1/2 inline-flex size-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-black shadow-lg backdrop-blur transition-transform hover:scale-105"
        >
          <Play className="ml-0.5 size-6 fill-current" />
        </button>
      )}

      <div
        className={cn(
          "absolute inset-x-0 bottom-0 flex items-center gap-2 bg-gradient-to-t from-black/75 to-transparent px-3 pt-6 pb-2 text-white transition-opacity",
          playing ? "opacity-0 group-hover/video:opacity-100 focus-within:opacity-100" : "opacity-100",
        )}
      >
        <button type="button" onClick={toggle} aria-label={playing ? "Пауза" : "Відтворити"} className="rounded p-1 hover:bg-white/15">
          {playing ? <Pause className="size-4 fill-current" /> : <Play className="size-4 fill-current" />}
        </button>
        <div
          ref={barRef}
          role="slider"
          aria-label="Перемотування"
          aria-valuemin={0}
          aria-valuemax={Math.round(dur)}
          aria-valuenow={Math.round(time)}
          tabIndex={-1}
          onPointerDown={onBarDown}
          className="relative h-4 flex-1 cursor-pointer touch-none"
        >
          <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 overflow-hidden rounded-full bg-white/25">
            <div className="h-full rounded-full bg-white/35" style={{ width: dur ? `${(buffered / dur) * 100}%` : 0 }} />
          </div>
          <div
            className="absolute top-1/2 left-0 h-1.5 -translate-y-1/2 rounded-full bg-white"
            style={{ width: dur ? `${(time / dur) * 100}%` : 0 }}
          />
          <div
            className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow"
            style={{ left: dur ? `${(time / dur) * 100}%` : 0 }}
          />
        </div>
        <span className="shrink-0 font-mono text-[11px] tabular-nums">
          {fmt(time)} / {fmt(dur)}
        </span>
        <button
          type="button"
          onClick={() => {
            const next = !muted
            setMuted(next)
            if (ref.current) ref.current.muted = next
          }}
          aria-label={muted ? "Увімкнути звук" : "Вимкнути звук"}
          className="rounded p-1 hover:bg-white/15"
        >
          {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
        </button>
        <a href={`${media.url}?download=`} download aria-label="Завантажити відео" className="rounded p-1 hover:bg-white/15">
          <Download className="size-4" />
        </a>
        <button type="button" onClick={() => void toggleFull()} aria-label="На весь екран" className="rounded p-1 hover:bg-white/15">
          {full ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
        </button>
      </div>
    </div>
  )
}
