import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { ImageResponse } from "next/og"
import type { NextRequest } from "next/server"
import { BrandCard, ShareCardView, shareCardFor } from "@/lib/share-card"

/** OG-картинка допису 1200×630: /api/og?id=<post id>. Без id — картка Lumyn. */
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id")
  const card = id ? await shareCardFor(id) : null
  if (id && !card) return new Response("Не знайдено", { status: 404 })

  const [regular, semibold] = await Promise.all([
    readFile(join(process.cwd(), "assets/fonts/Geist-Regular.ttf")),
    readFile(join(process.cwd(), "assets/fonts/Geist-SemiBold.ttf")),
  ])
  const fonts = [
    { name: "Geist", data: regular, weight: 400 as const, style: "normal" as const },
    { name: "Geist", data: semibold, weight: 600 as const, style: "normal" as const },
  ]

  return new ImageResponse(card ? <ShareCardView card={card} /> : <BrandCard />, { width: 1200, height: 630, fonts })
}
