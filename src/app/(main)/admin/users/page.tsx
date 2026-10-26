import type { Metadata } from "next"
import { Suspense } from "react"
import Link from "next/link"
import { requireAdmin } from "@/lib/admin"
import { AdminNav } from "@/components/admin/admin-nav"
import { AdminUserActions } from "@/components/admin/admin-user-actions"
import { VerifiedBadge } from "@/components/verified-badge"
import { UserAvatar } from "@/components/user-avatar"

export const metadata: Metadata = { title: "Адмін · Користувачі" }

type Row = {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  cover_url: string | null
  verified: boolean
  is_admin: boolean
  followers_count: number
  posts_count: number
  created_at: string
}

export default function AdminUsersPage({ searchParams }: PageProps<"/admin/users">) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <AdminNav active="users" />
      <h1 className="text-2xl font-semibold">Користувачі</h1>
      <Suspense fallback={<p className="mt-6 text-sm text-muted-foreground">Завантаження…</p>}>
        <UsersList searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

async function UsersList({ searchParams }: { searchParams: PageProps<"/admin/users">["searchParams"] }) {
  const { rpc } = await requireAdmin()
  const sp = await searchParams
  const q = typeof sp.q === "string" ? sp.q.trim() : ""
  const { data, error } = await rpc("admin_search_users", { p_query: q, p_limit: 100 })
  const users = (data ?? []) as Row[]

  return (
    <>
      <form className="mt-4 flex gap-2" action="/admin/users">
        <input
          name="q"
          defaultValue={q}
          placeholder="Пошук за ніком або ім'ям"
          className="h-9 flex-1 rounded-md border bg-transparent px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <button type="submit" className="h-9 rounded-md bg-foreground px-4 text-sm text-background">Знайти</button>
      </form>
      {error && <p className="mt-4 text-sm text-destructive">{error.message}</p>}
      <p className="mt-3 text-xs text-muted-foreground">{users.length} знайдено</p>

      <ul className="mt-4 space-y-4">
        {users.map((u) => (
          <li key={u.id} className="overflow-hidden rounded-xl border">
            <div className="h-20 bg-muted bg-cover bg-center" style={u.cover_url ? { backgroundImage: `url(${JSON.stringify(u.cover_url)})` } : undefined} />
            <div className="flex flex-col gap-3 p-4">
              <div className="flex items-center gap-3">
                <UserAvatar user={{ username: u.username, name: u.display_name || u.username, avatarUrl: u.avatar_url }} size="lg" />
                <div className="min-w-0">
                  <Link href={`/${u.username}`} className="flex items-center gap-1 truncate font-medium hover:underline">
                    {u.display_name || u.username} {u.verified && <VerifiedBadge />}
                    {u.is_admin && <span className="ml-1 rounded-full border px-1.5 text-[10px] uppercase text-muted-foreground">admin</span>}
                  </Link>
                  <div className="truncate text-sm text-muted-foreground">
                    @{u.username} · {u.followers_count} читачів · {u.posts_count} дописів
                  </div>
                </div>
              </div>
              <AdminUserActions
                user={{ id: u.id, username: u.username, verified: u.verified, hasAvatar: Boolean(u.avatar_url), hasBanner: Boolean(u.cover_url), isAdmin: u.is_admin }}
              />
            </div>
          </li>
        ))}
      </ul>
    </>
  )
}
