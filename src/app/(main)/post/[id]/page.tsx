import type { Metadata } from "next"
import { connection } from "next/server"
import Link from "next/link"
import { Suspense } from "react"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/layout/page-header"
import { PostSkeleton } from "@/components/feed/post-card"
import { PostDetail } from "@/components/feed/post-detail"
import { getPost, repliesFor } from "@/lib/mock-data"
import { isMockMode } from "@/lib/env"
import { getPostWithReplies } from "@/lib/queries"
import type { Post } from "@/types"

async function loadPost(id: string): Promise<{ post: Post; replies: Post[] } | null> {
  if (!isMockMode) return getPostWithReplies(id)
  const post = getPost(id)
  return post ? { post, replies: repliesFor(post.id) } : null
}

export async function generateMetadata({ params }: PageProps<"/post/[id]">): Promise<Metadata> {
  // лише під час запиту: Supabase читає сесію (Date.now()) — у пререндері це заборонено
  await connection()
  const { id } = await params
  const post = (await loadPost(id))?.post
  if (!post) return { title: "Допис не знайдено" }
  const title = `${post.author.name}: «${post.content.slice(0, 60)}${post.content.length > 60 ? "…" : ""}»`
  return {
    title,
    description: post.content.slice(0, 160),
    openGraph: { title, description: post.content.slice(0, 160), images: [`/api/og?id=${post.id}`] },
    twitter: { card: "summary_large_image", images: [`/api/og?id=${post.id}`] },
  }
}

async function PostContent({ params }: { params: PageProps<"/post/[id]">["params"] }) {
  await connection()
  const { id } = await params
  const data = await loadPost(id)
  if (!data) notFound()
  // гість бачить сам пост (RLS віддає лише публічне), але без композера й дій
  let guest = false
  if (!isMockMode) {
    const { getSupabaseServerClient } = await import("@/lib/supabase/server")
    const supabase = await getSupabaseServerClient()
    const { data: claims } = await supabase!.auth.getClaims()
    guest = !claims?.claims?.sub
  }
  return <PostDetail post={data.post} replies={data.replies} guest={guest} />
}

export default function PostPage({ params }: PageProps<"/post/[id]">) {
  return (
    <>
      <PageHeader
        title="Допис"
        back={
          <Button variant="ghost" size="icon-sm" asChild className="-ml-1.5 rounded-full">
            <Link href="/" aria-label="Назад">
              <ArrowLeft />
            </Link>
          </Button>
        }
      />
      <Suspense fallback={<><PostSkeleton media /><PostSkeleton /><PostSkeleton /></>}>
        <PostContent params={params} />
      </Suspense>
    </>
  )
}
