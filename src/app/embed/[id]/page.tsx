import type { Metadata } from "next"
import { Suspense } from "react"
import { connection } from "next/server"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { LogoMark } from "@/components/logo"
import { UserAvatar } from "@/components/user-avatar"
import { VerifiedBadge } from "@/components/verified-badge"
import { getPostWithReplies } from "@/lib/queries"
import { formatCount } from "@/lib/format"
import { SparkIcon } from "@/components/icons"

export const metadata: Metadata = {
  title: "Допис у Lumyn",
  robots: { index: false },
}

/** Компактна картка поста для вбудовування на сайтах (iframe /embed/<id>). */
export default function EmbedPage({ params }: PageProps<"/embed/[id]">) {
  return (
    <Suspense fallback={<main className="grid min-h-dvh place-items-center bg-background" />}>
      <EmbedCard params={params} />
    </Suspense>
  )
}

async function EmbedCard({ params }: { params: PageProps<"/embed/[id]">["params"] }) {
  await connection()
  const { id } = await params
  const data = await getPostWithReplies(id)
  const post = data?.post

  if (!post)
    return (
      <main className="grid min-h-dvh place-items-center bg-background p-6 text-center">
        <div>
          <LogoMark className="mx-auto size-8 opacity-60" />
          <p className="mt-3 text-sm text-muted-foreground">Допис недоступний — приватний або видалений.</p>
        </div>
      </main>
    )

  return (
    <main className="flex min-h-dvh flex-col justify-between bg-background p-5">
      <div>
        <div className="flex items-center gap-2.5">
          <UserAvatar user={{ username: post.author.username, name: post.author.name, avatarUrl: post.author.avatarUrl }} size="lg" className="size-10" />
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1 truncate text-sm font-semibold">
              {post.author.name}
              {post.author.verified && <VerifiedBadge className="size-3.5" />}
            </p>
            <p className="truncate text-xs text-muted-foreground">@{post.author.username}</p>
          </div>
          <Link href={`/post/${post.id}`} target="_blank" className="flex items-center gap-1 text-sm font-semibold" style={{ color: "var(--brand)" }}>
            Lumyn <ArrowRight className="size-3.5" />
          </Link>
        </div>

        <p className="mt-4 line-clamp-10 text-[15px] leading-relaxed whitespace-pre-wrap">{post.content}</p>

        <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <SparkIcon filled className="size-3.5" /> {formatCount(post.lights)}
          </span>
          <span>{formatCount(post.replies)} відповідей</span>
          <span>{formatCount(post.reposts)} репостів</span>
        </div>
      </div>

      <p className="mt-6 text-[11px] text-muted-foreground">З Lumyn — соцмережі, яка не кричить.</p>
    </main>
  )
}
