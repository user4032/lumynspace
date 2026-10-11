import type { Metadata } from "next"
import { connection } from "next/server"
import { notFound } from "next/navigation"
import Link from "next/link"
import { getSupabaseServerClient } from "@/lib/supabase/server"
import { UserAvatar } from "@/components/user-avatar"
import { isMockMode } from "@/lib/env"
import { getUserByUsername, users } from "@/lib/mock-data"

export const metadata: Metadata = { title: "Читачі" }

export default async function FollowersPage({ params }: PageProps<"/[username]/followers">) {
  await connection()
  const { username } = await params
  const handle = decodeURIComponent(username)

  if (isMockMode) {
    const user = getUserByUsername(handle)
    if (!user) notFound()
    const list = users.filter((u) => u.id !== user.id).slice(0, 20)
    return <List title={`Читачі @${handle}`} users={list} />
  }

  const supabase = await getSupabaseServerClient()
  if (!supabase) return <p className="p-4 text-sm text-muted-foreground">Немає підключення</p>

  const { data: profile } = await supabase.from("profiles").select("id, username, hide_following").eq("username", handle).maybeSingle()
  if (!profile) notFound()

  const { data: me } = await supabase.auth.getClaims()
  const isMe = me?.claims?.sub === profile.id

  // For followers we always show (or you can add hide_followers later)
  const { data: rows } = await supabase
    .from("follows")
    .select("follower_id, profiles!follows_follower_id_fkey(id, username, display_name, avatar_url)")
    .eq("following_id", profile.id)
    .eq("status", "accepted")
    .limit(200)

  const list = (rows ?? []).map((r: any) => r.profiles).filter(Boolean)

  return <List title={`Читачі @${handle}`} users={list} />
}

function List({ title, users }: { title: string; users: any[] }) {
  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <h1 className="text-xl font-semibold">{title}</h1>
      <div className="mt-4 divide-y">
        {users.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Поки нікого</p>}
        {users.map((u) => (
          <Link key={u.id} href={`/${u.username}`} className="flex items-center gap-3 py-3 hover:bg-subtle">
            <UserAvatar user={{ id: u.id, username: u.username, name: u.display_name ?? u.username, avatarUrl: u.avatar_url }} size={40} />
            <div className="min-w-0">
              <div className="truncate font-medium">{u.display_name || u.username}</div>
              <div className="truncate text-sm text-muted-foreground">@{u.username}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
