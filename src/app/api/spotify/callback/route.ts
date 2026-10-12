import { NextRequest, NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase/server"

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code")
  if (!code) return NextResponse.redirect("https://lumyn.space/settings?error=spotify")

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: "https://lumyn.space/api/spotify/callback",
  })

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  })
  const tokens = await res.json()
  if (!tokens.access_token) return NextResponse.redirect("https://lumyn.space/settings?error=spotify")

  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase!.auth.getUser()
  if (user) {
    await supabase!.from("profiles").update({
      widgets: { spotify_token: tokens.access_token, spotify_refresh: tokens.refresh_token },
    }).eq("id", user.id)
  }

  return NextResponse.redirect("https://lumyn.space/settings?spotify=connected")
  
}