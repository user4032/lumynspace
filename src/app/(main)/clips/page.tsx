import type { Metadata } from "next"
import { Suspense } from "react"
import { ClipsFeed } from "@/components/clips/clips-feed"
import { isMockMode } from "@/lib/env"
import { listVideoPosts } from "@/lib/queries"
import type { Post } from "@/types"

export const metadata: Metadata = { title: "Кліпи — Lumyn" }

export default function ClipsPage() {
  return (
    <Suspense fallback={<div className="h-[calc(100dvh-3.5rem)] animate-pulse bg-black" />}>
      <Clips />
    </Suspense>
  )
}

async function Clips() {
  const posts: Post[] = isMockMode ? [] : await listVideoPosts(30)
  return <ClipsFeed posts={posts} />
}
