import type { Metadata } from "next"
import { Suspense } from "react"
import Link from "next/link"
import { Bookmark } from "lucide-react"
import { PageHeader } from "@/components/layout/page-header"
import { PostCard, PostSkeleton } from "@/components/feed/post-card"
import { isMockMode } from "@/lib/env"
import { getBookmarkedPosts } from "@/lib/queries"

export const metadata: Metadata = { title: "Збережені" }

async function BookmarksList() {
  const posts = await getBookmarkedPosts()
  if (!posts.length)
    return (
      <div className="flex flex-col items-center gap-3 px-6 py-24 text-center">
        <span className="grid size-14 place-items-center rounded-2xl border bg-subtle">
          <Bookmark className="size-6 text-muted-foreground" />
        </span>
        <p className="text-sm font-medium">Тут поки порожньо</p>
        <p className="max-w-64 text-sm text-muted-foreground">
          Тицьніть іконку закладки під дописом — і він зберігся тут, навіть якщо автор видалить його згодом.
        </p>
        <Link href="/" className="mt-2 text-sm font-medium text-foreground underline underline-offset-4">
          До стрічки
        </Link>
      </div>
    )
  return (
    <>
      {posts.map((p, i) => (
        <PostCard key={p.id} post={p} index={i} stagger />
      ))}
    </>
  )
}

export default function BookmarksPage() {
  return (
    <>
      <PageHeader title="Збережені" subtitle="Тільки для вас — ніхто інший не бачить цього списку" />
      {isMockMode ? (
        <BookmarksList />
      ) : (
        <Suspense fallback={<PostSkeleton media />}>
          <BookmarksList />
        </Suspense>
      )}
    </>
  )
}
