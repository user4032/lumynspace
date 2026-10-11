import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { ImageResponse } from "next/og"
import type { NextRequest } from "next/server"
import { ShareCardView, shareCardFor } from "@/lib/share-card"

/** Картка допису 1080×1350 для сторіз. ?download=1 → файл. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const card = await shareCardFor(id)
  if (!card) return new Response("Не знайдено", { status: 404 })

  const [regular, semibold] = await Promise.all([
    readFile(join(process.cwd(), "assets/fonts/Geist-Regular.ttf")),
    readFile(join(process.cwd(), "assets/fonts/Geist-SemiBold.ttf")),
  ])

  const res = new ImageResponse(<ShareCardView card={card} story />, {
    width: 1080,
    height: 1350,
    fonts: [
      { name: "Geist", data: regular, weight: 400, style: "normal" },
      { name: "Geist", data: semibold, weight: 600, style: "normal" },
    ],
  })

  if (request.nextUrl.searchParams.has("download")) {
    res.headers.set("Content-Disposition", `attachment; filename="lumyn-${id}.png"`)
  }
  return res
}
