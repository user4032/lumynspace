import type { Metadata } from "next"
import { Suspense } from "react"
import { connection } from "next/server"
import Link from "next/link"
import { ArrowLeft, Hash } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/layout/page-header"
import { PostCard, PostSkeleton } from "@/components/feed/post-card"
import { isMockMode } from "@/lib/env"
import { getSupabaseServerClient } from "@/lib/supabase/server"
import { resolveFeedRows } from "@/lib/feed-map"
import type { FeedPostRow } from "@/types/database"
import type { Post } from "@/types"

type Props = { params: Promise<{ tag: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { tag } = await params
  return { title: `#${decodeURIComponent(tag)} — Lumyn` }
}

export default function HashtagPage({ params }: Props) {
  return (
    <Suspense fallback={<PostSkeleton media />}>
      <HashtagFeed params={params} />
    </Suspense>
  )
}

async function HashtagFeed({ params }: Props) {
  await connection()
  const tag = decodeURIComponent((await params).tag ?? "").slice(0, 40)
  const header = (
    <PageHeader
      title={`#${tag}`}
      subtitle="Дописи з цим хештегом"
      back={
        <Button variant="ghost" size="icon-sm" asChild className="-ml-1.5 rounded-full">
          <Link href="/explore" aria-label="До огляду">
            <ArrowLeft />
          </Link>
        </Button>
      }
    />
  )
  if (!/^[\p{L}\p{N}_]+$/u.test(tag))
    return (
      <>
        {header}
        <p className="px-5 py-10 text-sm text-muted-foreground">Такого хештегу не існує.</p>
      </>
    )

  const posts = isMockMode ? [] : await postsForTag(tag)
  if (!posts.length)
    return (
      <>
      {header}
      <div className="flex flex-col items-center gap-3 px-6 py-20 text-center">
        <span className="grid size-12 place-items-center rounded-2xl border bg-subtle">
          <Hash className="size-5 text-muted-foreground" />
        </span>
        <p className="text-sm font-medium">Під #{tag} поки нічого</p>
        <p className="max-w-64 text-sm text-muted-foreground">Станьте першим: додайте #{tag} до свого допису.</p>
        <Link href="/?compose=1" className="mt-1 text-sm font-medium underline underline-offset-4">
          Написати допис
        </Link>
      </div>
      </>
    )
  return (
    <>
      {header}
      {posts.map((p, i) => (
        <PostCard key={p.clientKey ?? p.id} post={p} index={i} stagger />
      ))}
    </>
  )
}

/** Публічна стрічка за хештегом: ilike-запит + точний фільтр межі слова (#tag не збігається з #tagplus) */
async function postsForTag(tag: string): Promise<Post[]> {
  const supabase = await getSupabaseServerClient()
  if (!supabase) return []
  const { data } = await supabase
    .from("feed_posts")
    .select("*")
    .is("reply_to", null)
    .ilike("content", `%#${tag}%`)
    .order("created_at", { ascending: false })
    .limit(60)
  const boundary = new RegExp(`#${tag}(?![\p{L}\p{N}_])`, "iu")
  const rows = ((data ?? []) as FeedPostRow[]).filter((r) => boundary.test(r.content ?? ""))
  return resolveFeedRows(supabase, rows)
}
