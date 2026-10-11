import type { Metadata } from "next"
import { Suspense } from "react"
import { notFound } from "next/navigation"
import { CommunityView } from "@/components/community-view"
import { PostSkeleton } from "@/components/feed/post-card"
import { getCommunity, postsByCommunity, users } from "@/lib/mock-data"
import { isMockMode } from "@/lib/env"
import { getCommunityPage } from "@/lib/queries"
import type { CommunityRole } from "@/types"

export async function generateMetadata({ params }: PageProps<"/c/[slug]">): Promise<Metadata> {
  const { slug } = await params
  // Supabase: getCommunityPage сам чекає connection() (сесія читає Date.now())
  const c = isMockMode ? getCommunity(slug) : (await getCommunityPage(slug))?.community
  return { title: c ? c.name : "Спільноту не знайдено", description: c?.description }
}

async function Community({ params }: { params: PageProps<"/c/[slug]">["params"] }) {
  const { slug } = await params
  if (!isMockMode) {
    const data = await getCommunityPage(slug)
    if (!data) notFound()
    return (
      <CommunityView
        key={`${data.community.role ?? "guest"}:${data.community.requested ? 1 : 0}`}
        community={data.community}
        posts={data.posts}
        members={data.members}
        requests={data.requests}
        meId={data.meId}
      />
    )
  }
  const community = getCommunity(slug)
  if (!community) notFound()
  const roles: CommunityRole[] = ["owner", "admin", "mod", "mod", "member", "member", "member", "member"]
  const members = users.map((user, i) => ({ user, role: roles[i] ?? "member" }))
  return <CommunityView community={community} posts={postsByCommunity(slug)} members={members} />
}

export default function CommunityPage({ params }: PageProps<"/c/[slug]">) {
  return (
    <Suspense
      fallback={
        <div aria-hidden>
          <div className="shimmer h-36 sm:h-44" />
          <div className="space-y-2 p-4">
            <div className="shimmer -mt-12 size-[80px] rounded-xl" />
            <div className="shimmer h-6 w-48 rounded" />
            <div className="shimmer h-4 w-full rounded" />
          </div>
          <PostSkeleton />
          <PostSkeleton />
        </div>
      }
    >
      <Community params={params} />
    </Suspense>
  )
}
