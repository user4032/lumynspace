import Link from "next/link"
import { Suspense } from "react"
import { ArrowUpRight } from "lucide-react"
import { formatCount, plural } from "@/lib/format"
import { communities as mockCommunities, suggestedUsers, trends as mockTrends } from "@/lib/mock-data"
import { isMockMode } from "@/lib/env"
import { listCommunities, listSuggestedPeople, listTrends } from "@/lib/queries"
import type { Community, Trend, User } from "@/types"
import { UserAvatar } from "@/components/user-avatar"
import { VerifiedBadge } from "@/components/verified-badge"
import { FollowButton } from "@/components/profile/follow-button"

function RailSection({ title, href, children }: { title: string; href?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border">
      <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        {href && (
          <Link href={href} className="flex items-center gap-0.5 text-xs text-muted-foreground transition-colors hover:text-foreground">
            Усі <ArrowUpRight className="size-3" />
          </Link>
        )}
      </div>
      <div className="pb-2">{children}</div>
    </section>
  )
}

const Empty = ({ children }: { children: React.ReactNode }) => <p className="px-4 pb-2 text-xs text-muted-foreground">{children}</p>

function RailContent({ trends, people, communities }: { trends: Trend[]; people: User[]; communities: Community[] }) {
  return (
    <>
      <RailSection title="Тренди" href="/explore">
        {trends.length === 0 && <Empty>Трендів поки немає</Empty>}
        <ul>
          {trends.map((t, i) => (
            <li key={t.tag}>
              <Link
                href={`/explore?q=${encodeURIComponent("#" + t.tag)}`}
                className="group flex items-start gap-3 px-4 py-2 transition-colors hover:bg-subtle"
              >
                <span className="mt-0.5 w-4 font-mono text-xs text-muted-foreground tabular">{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs text-muted-foreground">{t.category}</span>
                  <span className="block truncate text-sm font-medium">#{t.tag}</span>
                  <span className="block text-xs text-muted-foreground">
                    {formatCount(t.posts)} {plural(t.posts, ["допис", "дописи", "дописів"])}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </RailSection>

      <RailSection title="Кого читати">
        {people.length === 0 && <Empty>Поки нікого порадити</Empty>}
        <ul>
          {people.map((u) => (
            <li key={u.id} className="flex items-center gap-3 px-4 py-2">
              <Link href={`/${u.username}`} className="flex min-w-0 flex-1 items-center gap-3">
                <UserAvatar user={u} size="md" />
                <span className="min-w-0">
                  <span className="flex items-center gap-1 text-sm font-medium">
                    <span className="truncate">{u.name}</span>
                    {u.verified && <VerifiedBadge className="size-3.5" />}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">@{u.username}</span>
                </span>
              </Link>
              <FollowButton userId={u.id} size="xs" />
            </li>
          ))}
        </ul>
      </RailSection>

      <RailSection title="Спільноти" href="/communities">
        {communities.length === 0 && <Empty>Спільнот ще немає</Empty>}
        <ul>
          {communities.map((c) => (
            <li key={c.id}>
              <Link href={`/c/${c.slug}`} className="flex items-center gap-3 px-4 py-2 transition-colors hover:bg-subtle">
                <span
                  className="size-8 shrink-0 rounded-md ring-1 ring-inset ring-foreground/10"
                  style={{ background: `linear-gradient(135deg, oklch(0.75 0.13 ${c.hue}), oklch(0.5 0.17 ${c.hue + 40}))` }}
                />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{c.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {formatCount(c.members)} {plural(c.members, ["учасник", "учасники", "учасників"])}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </RailSection>
    </>
  )
}

async function LiveRail() {
  const [people, { mine, recommended }, trends] = await Promise.all([listSuggestedPeople(3), listCommunities(3), listTrends(5)])
  return <RailContent trends={trends} people={people} communities={[...recommended, ...mine].slice(0, 3)} />
}

export function RightRail() {
  return (
    <aside className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-[316px] shrink-0 flex-col gap-4 overflow-y-auto py-4 pl-6 no-scrollbar lg:flex group-has-[[data-layout=wide]]/shell:hidden">
      {isMockMode ? (
        <RailContent trends={mockTrends} people={suggestedUsers} communities={mockCommunities.slice(3, 6)} />
      ) : (
        <Suspense fallback={<div className="shimmer h-40 rounded-lg" aria-hidden />}>
          <LiveRail />
        </Suspense>
      )}

      <footer className="flex flex-wrap gap-x-3 gap-y-1 px-1 pb-4 text-xs text-muted-foreground">
        <Link href="/design" className="hover:text-foreground">Дизайн-система</Link>
        <Link href="/terms" className="hover:text-foreground">Умови</Link>
        <Link href="/privacy" className="hover:text-foreground">Конфіденційність</Link>
        <span className="flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-emerald-500" /> Усі системи працюють
        </span>
        <span className="w-full">© 2026 Lumyn</span>
      </footer>
    </aside>
  )
}
