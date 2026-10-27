"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import { Download, Loader2, Maximize2, Minimize2, Pause, Play, Volume1, Volume2, VolumeX } from "lucide-react"
import type { VideoMedia } from "@/types/database"
import { cn } from "@/lib/utils"

const fmt = (s: number) => (Number.isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}` : "0:00")

/** Плеєр Lumyn: плаваюча панель керування, перемотування, гучність, клавіатура, фулскрін. */
export function VideoPlayer({ media }: { media: VideoMedia }) {
  const ref = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(true)
  const [volume, setVolume] = useState(1)
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

  // повноекранний режим могли закрити клавішею Esc — тримаємо стан синхронним
  useEffect(() => {
    const sync = () => setFull(Boolean(document.fullscreenElement))
    document.addEventListener("fullscreenchange", sync)
    return () => document.removeEventListener("fullscreenchange", sync)
  }, [])

  const applyVolume = (next: number) => {
    const v = ref.current
    const safe = Math.min(1, Math.max(0, Math.round(next * 100) / 100))
    const silent = safe === 0
    setVolume(safe)
    setMuted(silent)
    if (v) {
      v.volume = safe
      v.muted = silent
    }
  }

  const toggleMute = () => {
    const v = ref.current
    if (!v) return
    if (muted || volume === 0) {
      const next = volume > 0 ? volume : 0.6
      setVolume(next)
      setMuted(false)
      v.volume = next
      v.muted = false
    } else {
      setMuted(true)
      v.muted = true
    }
  }

  const toggle = () => {
    const v = ref.current
    if (!v) return
    userStarted.current = true
    if (v.paused) {
      v.volume = volume
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
        e.preventDefault()
        v.currentTime = Math.min(v.currentTime + 5, dur)
        break
      case "ArrowLeft":
        e.preventDefault()
        v.currentTime = Math.max(v.currentTime - 5, 0)
        break
      case "ArrowUp":
        e.preventDefault()
        applyVolume(volume + 0.1)
        break
      case "ArrowDown":
        e.preventDefault()
        applyVolume(volume - 0.1)
        break
      case "m":
        toggleMute()
        break
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

  const VolumeIcon = muted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2

  return (
    <div
      className="group/video relative overflow-hidden rounded-2xl border border-white/10 bg-black outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
        className="max-h-[560px] w-full cursor-pointer object-contain"
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
          className="absolute top-1/2 left-1/2 inline-flex size-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-black shadow-xl backdrop-blur transition-transform hover:scale-105"
        >
          <Play className="ml-0.5 size-5 fill-current" />
        </button>
      )}

      {/* плаваюча панель керування */}
      <div
        className={cn(
          "absolute inset-x-2 bottom-2 rounded-xl border border-white/10 bg-black/65 p-2 text-white shadow-[0_8px_24px_rgb(0_0_0/0.45)] backdrop-blur-md transition-opacity",
          playing ? "opacity-0 group-hover/video:opacity-100 focus-within:opacity-100" : "opacity-100",
        )}
      >
        <div
          ref={barRef}
          role="slider"
          aria-label="Перемотування"
          aria-valuemin={0}
          aria-valuemax={Math.round(dur)}
          aria-valuenow={Math.round(time)}
          tabIndex={-1}
          onPointerDown={onBarDown}
          className="group/bar relative h-3 cursor-pointer touch-none"
        >
          <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 overflow-hidden rounded-full bg-white/20 transition-[height] group-hover/bar:h-1.5">
            <div className="h-full rounded-full bg-white/30" style={{ width: dur ? `${(buffered / dur) * 100}%` : 0 }} />
          </div>
          <div
            className="absolute top-1/2 left-0 h-1 -translate-y-1/2 rounded-full bg-white transition-[height] group-hover/bar:h-1.5"
            style={{ width: dur ? `${(time / dur) * 100}%` : 0 }}
          />
          <div
            className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white opacity-0 shadow transition-opacity group-hover/bar:opacity-100"
            style={{ left: dur ? `${(time / dur) * 100}%` : 0 }}
          />
        </div>

        <div className="mt-1.5 flex items-center gap-0.5">
          <button
            type="button"
            onClick={toggle}
            aria-label={playing ? "Пауза" : "Відтворити"}
            className="grid size-7 place-items-center rounded-md transition-colors hover:bg-white/15"
          >
            {playing ? <Pause className="size-4 fill-current" /> : <Play className="size-4 fill-current" />}
          </button>
          <span className="ml-1 font-mono text-[11px] text-white/70 tabular-nums">
            {fmt(time)} <span className="text-white/30">/</span> {fmt(dur)}
          </span>

          <span className="flex-1" />

          {/* гучність: повзунок розкривається при наведенні, на мобільному видно одразу */}
          <div className="group/vol flex items-center">
            <button
              type="button"
              onClick={toggleMute}
              aria-label={muted ? "Увімкнути звук" : "Вимкнути звук"}
              className="grid size-7 place-items-center rounded-md transition-colors hover:bg-white/15"
            >
              <VolumeIcon className="size-4" />
            </button>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={Math.round((muted ? 0 : volume) * 100)}
              onChange={(e) => applyVolume(Number(e.target.value) / 100)}
              aria-label="Гучність"
              style={{
                background: `linear-gradient(to right, rgb(255 255 255 / 0.95) ${(muted ? 0 : volume) * 100}%, rgb(255 255 255 / 0.2) ${(muted ? 0 : volume) * 100}%)`,
              }}
              className="h-1 w-0 cursor-pointer appearance-none rounded-full opacity-0 outline-none transition-[width,opacity] duration-200 group-hover/vol:w-16 group-hover/vol:opacity-100 focus:w-16 focus:opacity-100 max-sm:w-14 max-sm:opacity-100 [&::-moz-range-thumb]:size-2.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-white [&::-moz-range-track]:bg-transparent [&::-webkit-slider-thumb]:size-2.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
            />
          </div>

          <a
            href={`${media.url}?download=`}
            download
            aria-label="Завантажити відео"
            className="grid size-7 place-items-center rounded-md transition-colors hover:bg-white/15"
          >
            <Download className="size-4" />
          </a>
          <button
            type="button"
            onClick={() => void toggleFull()}
            aria-label="На весь екран"
            className="grid size-7 place-items-center rounded-md transition-colors hover:bg-white/15"
          >
            {full ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
          </button>
        </div>
      </div>
    </div>
  )
}
