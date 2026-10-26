import { NextResponse, type NextRequest } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase/server"

const LASTFM_USER_RE = /^[A-Za-z][\w-]{1,14}$/

/** Зараз грає (Last.fm). ?u=<нік Lumyn> — чужий профіль, без параметра — мій. */
export async function GET(request: NextRequest) {
  const supabase = await getSupabaseServerClient()
  const key = process.env.LASTFM_API_KEY
  if (!supabase || !key) return NextResponse.json({ playing: false })

  const handle = request.nextUrl.searchParams.get("u")?.toLowerCase()
  let query = supabase.from("profiles").select("widgets")
  if (handle) query = query.eq("username", handle)
  else {
    const { data: claims } = await supabase.auth.getClaims()
    const me = claims?.claims?.sub as string | undefined
    if (!me) return NextResponse.json({ playing: false })
    query = query.eq("id", me)
  }
  const { data: profile } = await query.maybeSingle()
  const username = (profile?.widgets as Record<string, unknown> | null)?.lastfm_username
  if (typeof username !== "string" || !LASTFM_USER_RE.test(username)) return NextResponse.json({ playing: false })

  const url = `https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${encodeURIComponent(username)}&api_key=${key}&format=json&limit=1`
  const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(5000) }).catch(() => null)
  if (!res?.ok) return NextResponse.json({ playing: false })
  const json = await res.json().catch(() => null)
  const track = json?.recenttracks?.track?.[0]
  if (!track || track["@attr"]?.nowplaying !== "true") return NextResponse.json({ playing: false })

  return NextResponse.json(
    {
      playing: true,
      title: track.name,
      artist: track.artist?.["#text"] ?? "",
      album: track.album?.["#text"] ?? "",
      image: track.image?.find((i: { size: string }) => i.size === "large")?.["#text"] || null,
      url: track.url,
    },
    { headers: { "Cache-Control": "private, max-age=20" } },
  )
}
