import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { Suspense } from "react"
import Form from "next/form"
import { Lock, Search, TrendingUp, X } from "lucide-react"
import { PageHeader } from "@/components/layout/page-header"
import { UserAvatar } from "@/components/user-avatar"
import { VerifiedBadge } from "@/components/verified-badge"
import { FollowButton } from "@/components/profile/follow-button"
import { photos, trends, users } from "@/lib/mock-data"
import { formatCount, plural } from "@/lib/format"
import { isMockMode } from "@/lib/env"
import { listRecentPhotos, listSuggestedPeople, listTrends, searchAll } from "@/lib/queries"
import { CommunityIcon } from "@/components/community-icon"
import { PostCard } from "@/components/feed/post-card"
import type { Trend, User } from "@/types"

export const metadata: Metadata = { title: "Огляд" }

type SearchParams = Promise<{ q?: string | string[] }>

const readQuery = async (searchParams: SearchParams) => {
  const q = (await searchParams).q
  return (Array.isArray(q) ? q[0] : q)?.trim().slice(0, 60) ?? ""
}

async function LiveExplore({ searchParams }: { searchParams: SearchParams }) {
  const q = await readQuery(searchParams)
  if (q) return <SearchResultsView query={q} />
  const [people, photos, trends] = await Promise.all([listSuggestedPeople(6), listRecentPhotos(12), listTrends(10)])
  return <ExploreSections trends={trends} people={people} photos={photos.map((p) => p.src)} />
}

async function SearchResultsView({ query }: { query: string }) {
  const { people, communities, posts } = await searchAll(query)
  const nothing = people.length + communities.length + posts.length === 0
  return (
    <>
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <h2 className="min-w-0 truncate text-[17px] font-semibold tracking-tight">Результати для «{query}»</h2>
        <Link href="/explore" className="flex shrink-0 items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <X className="size-4" /> Скинути
        </Link>
      </div>
      {nothing && <p className="p-8 text-center text-sm text-muted-foreground">Нічого не знайдено. Спробуйте інший запит.</p>}
      {people.length > 0 && (
        <section className="border-b p-4">
          <h3 className="mb-3 text-sm font-semibold text-muted-foreground">Люди</h3>
          <ul className="space-y-1">
            {people.map((u) => (
              <li key={u.id} className="flex items-center gap-3 rounded-lg p-2 hover:bg-subtle">
                <Link href={`/${u.username}`} className="flex min-w-0 flex-1 items-center gap-3">
                  <UserAvatar user={u} />
                  <span className="min-w-0">
                    <span className="flex items-center gap-1 truncate text-sm font-medium">{u.name} {u.verified && <VerifiedBadge className="size-3.5" />}</span>
                    <span className="block truncate text-xs text-muted-foreground">@{u.username}</span>
                  </span>
                </Link>
                <FollowButton userId={u.id} size="xs" />
              </li>
            ))}
          </ul>
        </section>
      )}
      {communities.length > 0 && (
        <section className="border-b p-4">
          <h3 className="mb-3 text-sm font-semibold text-muted-foreground">Спільноти</h3>
          <ul className="space-y-1">
            {communities.map((c) => (
              <li key={c.id}>
                <Link href={`/c/${c.slug}`} className="flex items-center gap-3 rounded-lg p-2 hover:bg-subtle">
                  <CommunityIcon community={c} className="size-9" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1 truncate text-sm font-medium">{c.name} {c.isPrivate && <Lock className="size-3 text-muted-foreground" />}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {formatCount(c.members)} {plural(c.members, ["учасник", "учасники", "учасників"])}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {posts.length > 0 && (
        <section>
          <h3 className="px-4 pt-4 pb-1 text-sm font-semibold text-muted-foreground">Дописи</h3>
          {posts.map((p, i) => <PostCard key={p.id} post={p} index={i} />)}
        </section>
      )}
    </>
  )
}

async function SearchInput({ searchParams }: { searchParams: SearchParams }) {
  const q = isMockMode ? "" : await readQuery(searchParams)
  return <SearchField defaultValue={q} />
}

function SearchField({ defaultValue = "" }: { defaultValue?: string }) {
  return (
    <Form action="/explore" className="p-3" role="search">
      <label className="flex h-10 items-center gap-2.5 rounded-full border bg-subtle px-4 text-sm focus-within:border-ring">
        <Search className="size-4 text-muted-foreground" />
        <input
          key={defaultValue}
          name="q"
          defaultValue={defaultValue}
          maxLength={60}
          placeholder="Пошук людей, дописів, спільнот, #тегів"
          className="flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
        />
      </label>
    </Form>
  )
}

export default function ExplorePage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <>
      <PageHeader>
        <Suspense fallback={<SearchField />}>
          <SearchInput searchParams={searchParams} />
        </Suspense>
      </PageHeader>

      {isMockMode ? (
        <ExploreSections trends={trends} people={users.slice(1, 7)} photos={photos} />
      ) : (
        <Suspense fallback={<div className="space-y-2 p-4" aria-hidden><div className="shimmer h-10 rounded" /><div className="shimmer h-24 rounded-lg" /></div>}>
          <LiveExplore searchParams={searchParams} />
        </Suspense>
      )}
    </>
  )
}

function ExploreSections({ trends, people, photos }: { trends: Trend[]; people: User[]; photos: string[] }) {
  return (
    <>
      <section className="border-b">
        <h2 className="flex items-center gap-2 px-4 pt-4 pb-2 text-[17px] font-semibold tracking-tight">
          <TrendingUp className="size-4" /> Тренди для вас
        </h2>
        {trends.length === 0 && <p className="px-4 pt-1 pb-4 text-sm text-muted-foreground">Трендів поки немає</p>}
        <ul>
          {trends.map((t, i) => (
            <li key={t.tag}>
              <Link href={`/explore?q=${encodeURIComponent("#" + t.tag)}`} className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-subtle">
                <span className="w-5 font-mono text-sm text-muted-foreground tabular">{String(i + 1).padStart(2, "0")}</span>
                <span className="flex-1">
                  <span className="block text-xs text-muted-foreground">{t.category}</span>
                  <span className="block font-semibold">#{t.tag}</span>
                </span>
                <span className="font-mono text-xs text-muted-foreground">
                  {formatCount(t.posts)} {plural(t.posts, ["допис", "дописи", "дописів"])}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="border-b p-4">
        <h2 className="mb-3 text-[17px] font-semibold tracking-tight">Люди</h2>
        {people.length === 0 && <p className="text-sm text-muted-foreground">Поки нікого порадити</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          {people.map((u) => (
            <div key={u.id} className="flex items-start gap-3 rounded-lg border p-3">
              <Link href={`/${u.username}`}>
                <UserAvatar user={u} size="lg" showOnline />
              </Link>
              <div className="min-w-0 flex-1">
                <Link href={`/${u.username}`} className="flex items-center gap-1 text-sm font-medium hover:underline">
                  <span className="truncate">{u.name}</span> {u.verified && <VerifiedBadge className="size-3.5" />}
                </Link>
                <p className="truncate text-xs text-muted-foreground">@{u.username}</p>
                <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{u.bio}</p>
              </div>
              <FollowButton userId={u.id} size="xs" />
            </div>
          ))}
        </div>
      </section>

      <section className="p-4">
        <h2 className="mb-3 text-[17px] font-semibold tracking-tight">Медіа</h2>
        {photos.length === 0 && <p className="text-sm text-muted-foreground">Фото поки немає</p>}
        <div className="grid grid-cols-3 gap-1.5">
          {photos.map((src, i) => (
            <div key={i} className="relative aspect-square overflow-hidden rounded-md bg-muted">
              <Image src={src} alt="" fill sizes="200px" unoptimized={!isMockMode} className="object-cover transition-transform duration-300 hover:scale-105" />
            </div>
          ))}
        </div>
      </section>
    </>
  )
}
