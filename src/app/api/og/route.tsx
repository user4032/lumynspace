import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { ImageResponse } from "next/og"
import type { NextRequest } from "next/server"
import { BrandCard, ProfileShareCardView, ShareCardView, shareCardFor, shareCardForProfile } from "@/lib/share-card"

/** OG-картинка: /api/og?id=<post id> для допису, /api/og?u=<username> для профілю, без параметрів — картка Lumyn. */
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id")
  const username = request.nextUrl.searchParams.get("u")
  const card = id ? await shareCardFor(id) : null
  const profile = !id && username ? await shareCardForProfile(username) : null
  if (id && !card) return new Response("Не знайдено", { status: 404 })
  if (username && !id && !profile) return new Response("Не знайдено", { status: 404 })

  const [regular, semibold] = await Promise.all([
    readFile(join(process.cwd(), "assets/fonts/Geist-Regular.ttf")),
    readFile(join(process.cwd(), "assets/fonts/Geist-SemiBold.ttf")),
  ])
  const fonts = [
    { name: "Geist", data: regular, weight: 400 as const, style: "normal" as const },
    { name: "Geist", data: semibold, weight: 600 as const, style: "normal" as const },
  ]

  return new ImageResponse(
    card ? <ShareCardView card={card} /> : profile ? <ProfileShareCardView card={profile} /> : <BrandCard />,
    { width: 1200, height: 630, fonts },
  )
}
