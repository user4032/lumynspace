import type { Metadata } from "next"
import { connection } from "next/server"
import { Suspense } from "react"
import { notFound } from "next/navigation"
import Link from "next/link"
import { getSupabaseServerClient } from "@/lib/supabase/server"
import { UserAvatar } from "@/components/user-avatar"
import { isMockMode } from "@/lib/env"
import { getUserByUsername, users } from "@/lib/mock-data"
import type { User } from "@/types"

type ListUser = Pick<User, "id" | "username" | "name" | "avatarUrl">

type ProfileRow = {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
}
type FollowRow = { profiles: ProfileRow | ProfileRow[] | null }

export const metadata: Metadata = { title: "Читає" }

export default function FollowingPage({ params }: PageProps<"/[username]/following">) {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Завантаження…</div>}>
      <Following params={params} />
    </Suspense>
  )
}

async function Following({ params }: { params: PageProps<"/[username]/following">["params"] }) {
  await connection()
  const { username } = await params
  const handle = decodeURIComponent(username)

  if (isMockMode) {
    const user = getUserByUsername(handle)
    if (!user) notFound()
    const list: ListUser[] = users
      .filter((u) => u.id !== user.id)
      .slice(0, 15)
      .map((u) => ({ id: u.id, username: u.username, name: u.name, avatarUrl: u.avatarUrl }))
    return <List title={`@${handle} читає`} users={list} />
  }

  const supabase = await getSupabaseServerClient()
  if (!supabase) return <p className="p-4 text-sm text-muted-foreground">Немає підключення</p>

  const { data: profile } = await supabase.from("profiles").select("id, username, hide_following").eq("username", handle).maybeSingle()
  if (!profile) notFound()

  const { data: claims } = await supabase.auth.getClaims()
  const isMe = claims?.claims?.sub === profile.id

  if (profile.hide_following && !isMe) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12 text-center">
        <p className="text-sm text-muted-foreground">Цей користувач приховав список тих, кого читає.</p>
      </div>
    )
  }

  const { data: rows } = await supabase
    .from("follows")
    .select("following_id, profiles!follows_following_id_fkey(id, username, display_name, avatar_url)")
    .eq("follower_id", profile.id)
    .eq("status", "accepted")
    .limit(200)

  const list: ListUser[] = ((rows ?? []) as unknown as FollowRow[])
    .flatMap((r) => (Array.isArray(r.profiles) ? r.profiles : r.profiles ? [r.profiles] : []))
    .map((p) => ({
      id: p.id,
      username: p.username,
      name: p.display_name || p.username,
      avatarUrl: p.avatar_url ?? undefined,
    }))

  return <List title={`@${handle} читає`} users={list} />
}

function List({ title, users }: { title: string; users: ListUser[] }) {
  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <h1 className="text-xl font-semibold">{title}</h1>
      <div className="mt-4 divide-y">
        {users.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Поки нікого</p>}
        {users.map((u) => (
          <Link key={u.id} href={`/${u.username}`} className="flex items-center gap-3 py-3 hover:bg-subtle">
            <UserAvatar user={{ username: u.username, name: u.name, avatarUrl: u.avatarUrl }} size="lg" />
            <div className="min-w-0">
              <div className="truncate font-medium">{u.name}</div>
              <div className="truncate text-sm text-muted-foreground">@{u.username}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}