"use client"

import { useEffect, useState } from "react"
import { Music2 } from "lucide-react"

type Track = { title: string; artist: string; url?: string; image?: string }

const POLL_MS = 30_000

export function SpotifyNow({ userId }: { userId: string }) {
  const [track, setTrack] = useState<Track | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const res = await fetch("/api/spotify/now", { cache: "no-store" })
        if (!res.ok) throw new Error(String(res.status))
        const d = await res.json()
        if (cancelled) return
        setTrack(
          d.playing
            ? { title: d.title, artist: d.artist, url: d.url, image: d.image }
            : null,
        )
      } catch {
        if (!cancelled) setTrack(null)
      }
    }

    load()
    const id = setInterval(load, POLL_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [userId])

  if (!track) return null

  return (
    <a
      href={track.url}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-3 rounded-xl border bg-card/60 p-3 transition-colors hover:bg-muted/50"
    >
      {track.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={track.image} alt="" className="size-12 rounded-lg object-cover" />
      ) : (
        <span className="grid size-12 place-items-center rounded-lg bg-green-500/20">
          <Music2 className="size-5 text-green-500" />
        </span>
      )}
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{track.title}</p>
        <p className="truncate text-xs text-muted-foreground">{track.artist}</p>
      </div>
    </a>
  )
}