import type { MetadataRoute } from "next"
import { getPublicPostIds } from "@/lib/queries"
import { isMockMode } from "@/lib/env"

const SITE = "https://lumyn.space"
const UPDATED = new Date("2026-10-14")

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages: MetadataRoute.Sitemap = [
    { url: `${SITE}/welcome`, lastModified: UPDATED, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE}/login`, lastModified: UPDATED, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE}/about`, lastModified: UPDATED, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE}/guidelines`, lastModified: new Date("2026-10-24"), changeFrequency: "yearly", priority: 0.4 },
    { url: `${SITE}/terms`, lastModified: new Date("2026-10-24"), changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE}/privacy`, lastModified: new Date("2026-10-24"), changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE}/contact`, lastModified: UPDATED, changeFrequency: "monthly", priority: 0.4 },
  ]

  // публічні дописи (anon-RLS: лише публічні й живі) — для індексації прев'ю
  const posts = isMockMode ? [] : await getPublicPostIds(200)
  for (const p of posts)
    pages.push({ url: `${SITE}/post/${p.id}`, lastModified: new Date(p.created_at), changeFrequency: "daily", priority: 0.7 })

  return pages
}
