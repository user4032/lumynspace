import type { Metadata } from "next"
import { connection } from "next/server"
import { Suspense } from "react"
import { notFound } from "next/navigation"
import { ProfileSkeleton, ProfileView } from "@/components/profile/profile-view"
import { PostSkeleton } from "@/components/feed/post-card"
import { MockMeOr404 } from "@/components/profile/mock-me-or-404"
import { isMockMode } from "@/lib/env"
import { getProfileByUsername, getProfilePage, getUserCommunities } from "@/lib/queries"
import { communities, currentUser, followingIds, getUserByUsername, photos, postsByUser, users } from "@/lib/mock-data"
import type { Post } from "@/types"

export async function generateMetadata({ params }: PageProps<"/[username]">): Promise<Metadata> {
  // лише під час запиту: Supabase читає сесію (Date.now()) — у пререндері це заборонено
  await connection()
  const { username } = await params
  const handle = decodeURIComponent(username)
  const user = isMockMode ? getUserByUsername(handle) : await getProfileByUsername(handle)
  return { title: user ? `${user.name} (@${user.username})` : "Профіль не знайдено" }
}

/** Фото з дописів на стіні (Supabase) */
const photosFrom = (posts: Post[]) =>
  posts.flatMap((p) => p.media.flatMap((m) => (m.type === "image" ? [m.url] : []))).slice(0, 30)

async function Profile({ params }: { params: PageProps<"/[username]">["params"] }) {
  await connection()
  const { username } = await params
  const handle = decodeURIComponent(username)

  if (!isMockMode) {
    const data = await getProfilePage(handle)
    if (!data) notFound()
    const userCommunities = await getUserCommunities(data.user.id)
    return (
      <ProfileView
        user={data.user}
        isMe={data.isMe}
        following={data.following}
        requested={data.requested}
        posts={data.posts}
        friends={data.friends}
        top4Users={data.top4}
        photos={photosFrom(data.posts)}
        communities={userCommunities}
      />
    )
  }

  const user = getUserByUsername(handle)
  if (!user) {
    return (
      <MockMeOr404
        username={handle}
        user={currentUser}
        posts={postsByUser(currentUser.id)}
        friends={users.filter((u) => !u.isPrivate)}
        photos={photos}
        communities={communities.filter((c) => c.role)}
      />
    )
  }

  const isMe = user.id === currentUser.id
  return (
    <ProfileView
      user={user}
      isMe={isMe}
      following={followingIds.has(user.id)}
      posts={postsByUser(user.id)}
      friends={users.filter((u) => u.id !== user.id && !u.isPrivate)}
      photos={photos}
      communities={communities.filter((c) => c.role)}
    />
  )
}

export default function ProfilePage({ params }: PageProps<"/[username]">) {
  return (
    <Suspense
      fallback={
        <>
          <ProfileSkeleton />
          <PostSkeleton />
          <PostSkeleton media />
        </>
      }
    >
      <Profile params={params} />
    </Suspense>
  )
}
