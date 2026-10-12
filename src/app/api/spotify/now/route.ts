import { NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase/server"

const NOT_PLAYING = { playing: false }
const NOW_URL = "https://api.spotify.com/v1/me/player/currently-playing"

type Widgets = { spotify_token?: string; spotify_refresh?: string }

type SpotifyNowResponse = {
  is_playing?: boolean
  currently_playing_type?: string
  item?: {
    name: string
    artists?: { name: string }[]
    external_urls?: { spotify: string }
    album?: { images?: { url: string }[] }
  } | null
}

async function refresh(refreshToken: string) {
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization:
        "Basic " +
        Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString("base64"),
    },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }),
  })
  return res.ok
    ? ((await res.json()) as { access_token?: string; refresh_token?: string })
    : null
}

function parse(data: SpotifyNowResponse) {
  const item = data.item
  if (!item || data.is_playing === false || data.currently_playing_type === "ad") return NOT_PLAYING
  return {
    playing: true,
    title: item.name,
    // подкасти/епізоди не мають artists
    artist: (item.artists ?? []).map((a) => a.name).join(", "),
    url: item.external_urls?.spotify,
    image: item.album?.images?.[0]?.url,
  }
}

async function fetchNow(token: string) {
  return fetch(NOW_URL, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" })
}

export async function GET() {
  const supabase = await getSupabaseServerClient()
  if (!supabase) return NextResponse.json(NOT_PLAYING)
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json(NOT_PLAYING)

  const { data: profile } = await supabase.from("profiles").select("widgets").eq("id", user.id).maybeSingle()
  const widgets = (profile?.widgets ?? {}) as Widgets

  async function renew() {
    if (!widgets.spotify_refresh) return null
    const fresh = await refresh(widgets.spotify_refresh)
    if (!fresh?.access_token) return null
    await supabase!
      .from("profiles")
      .update({
        widgets: {
          ...widgets,
          spotify_token: fresh.access_token,
          // Spotify іноді повертає новий refresh_token
          ...(fresh.refresh_token ? { spotify_refresh: fresh.refresh_token } : {}),
        },
      })
      .eq("id", user!.id)
    return fresh.access_token
  }

  let token = widgets.spotify_token ?? (await renew())
  if (!token) return NextResponse.json(NOT_PLAYING)

    let res = await fetchNow(token)
  if (res.status === 401) {
    const renewed = await renew()
    if (!renewed) return NextResponse.json(NOT_PLAYING)
    token = renewed
    res = await fetchNow(renewed)
  }

  // 204 = нічого не грає
  if (!res.ok || res.status === 204) return NextResponse.json(NOT_PLAYING)
  return NextResponse.json(parse((await res.json()) as SpotifyNowResponse))
}