"use client"

import { useEffect, useState, type ReactNode } from "react"
import { Music2 } from "lucide-react"

type Track = { title: string; artist: string; url?: string; image?: string | null }

const POLL_MS = 30_000

/** «Зараз грає» з Last.fm; якщо нічого не грає — fallback (ручний трек). */
export function LastfmNow({ handle, fallback }: { handle: string; fallback?: ReactNode }) {
  const [track, setTrack] = useState<Track | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch(`/api/lastfm/now?u=${encodeURIComponent(handle)}`, { cache: "no-store" })
        if (!res.ok) throw new Error(String(res.status))
        const d = await res.json()
        if (!cancelled) setTrack(d.playing ? { title: d.title, artist: d.artist, url: d.url, image: d.image } : null)
      } catch {
        if (!cancelled) setTrack(null)
      }
    }
    void load()
    const id = setInterval(load, POLL_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [handle])

  if (!track) return <>{fallback ?? null}</>

  return (
    <a
      href={track.url}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-3 rounded-xl border bg-card/60 p-3 transition-colors hover:bg-muted/50"
    >
      {track.image ? (
        // eslint-disable-next-line @next/next/no-img-element -- обкладинка з Last.fm
        <img src={track.image} alt="" className="size-12 rounded-lg object-cover" />
      ) : (
        <span className="grid size-12 place-items-center rounded-lg bg-muted">
          <Music2 className="size-5" />
        </span>
      )}
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
          <span className="size-1.5 animate-pulse rounded-full bg-red-500" /> Зараз грає · Last.fm
        </p>
        <p className="truncate text-sm font-medium">{track.title}</p>
        <p className="truncate text-xs text-muted-foreground">{track.artist}</p>
      </div>
    </a>
  )
}
