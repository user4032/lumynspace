import Link from "next/link"
import { Suspense } from "react"
import Image from "next/image"
import { ArrowUpRight, Flame, Radio, Users } from "lucide-react"
import { formatCount, plural } from "@/lib/format"
import { communities as mockCommunities, suggestedUsers, trends as mockTrends } from "@/lib/mock-data"
import { isMockMode } from "@/lib/env"
import { listCommunities, listSuggestedPeople, listTrends } from "@/lib/queries"
import type { Community, Trend, User } from "@/types"
import { UserAvatar } from "@/components/user-avatar"
import { VerifiedBadge } from "@/components/verified-badge"
import { FollowButton } from "@/components/profile/follow-button"

function RailSection({
  title,
  href,
  icon: Icon,
  children,
}: {
  title: string
  href?: string
  icon: React.ComponentType<{ className?: string }>
  children: React.ReactNode
}) {
  return (
    <section className="rounded-2xl bg-card p-3.5">
      <div className="mb-2 flex items-center justify-between px-1">
        <h3 className="eyebrow flex items-center gap-1.5">
          <Icon className="size-3.5 text-brand" />
          {title}
        </h3>
        {href && (
          <Link
            href={href}
            className="flex items-center gap-0.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
          >
            Усі <ArrowUpRight className="size-3" />
          </Link>
        )}
      </div>
      {children}
    </section>
  )
}

const Empty = ({ children }: { children: React.ReactNode }) => (
  <p className="px-1.5 pb-1 text-xs text-muted-foreground">{children}</p>
)

function RailContent({ trends, people, communities }: { trends: Trend[]; people: User[]; communities: Community[] }) {
  return (
    <>
      <RailSection title="Зараз у Lumyn" icon={Radio}>
        {people.length === 0 ? (
          <Empty>Поки нікого порадити</Empty>
        ) : (
          <ul className="space-y-0.5">
            {people.map((u) => (
              <li key={u.id}>
                <div className="group flex items-center gap-2.5 rounded-xl px-1.5 py-1.5 transition-colors hover:bg-subtle">
                  <Link href={`/${u.username}`} className="shrink-0">
                    <UserAvatar user={u} size="md" showOnline />
                  </Link>
                  <Link href={`/${u.username}`} className="min-w-0 flex-1">
                    <span className="flex items-center gap-1 text-[13.5px] font-medium">
                      <span className="truncate">{u.name}</span>
                      {u.verified && <VerifiedBadge className="size-3.5" />}
                    </span>
                    <span className="block truncate text-[11.5px] text-muted-foreground">
                      @{u.username} · {formatCount(u.followers)} {plural(u.followers, ["читач", "читачі", "читачів"])}
                    </span>
                  </Link>
                  <FollowButton userId={u.id} size="xs" />
                </div>
              </li>
            ))}
          </ul>
        )}
      </RailSection>

      <RailSection title="Спільноти" href="/communities" icon={Users}>
        {communities.length === 0 ? (
          <Empty>Спільнот ще немає</Empty>
        ) : (
          <ul className="space-y-0.5">
            {communities.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/c/${c.slug}`}
                  className="group flex items-center gap-2.5 rounded-xl px-1.5 py-1.5 transition-colors hover:bg-subtle"
                >
                  {c.avatarUrl ? (
                    <Image
                      src={c.avatarUrl}
                      alt=""
                      width={32}
                      height={32}
                      className="size-8 shrink-0 rounded-lg object-cover ring-1 ring-inset ring-foreground/10"
                    />
                  ) : (
                    <span
                      className="size-8 shrink-0 rounded-lg ring-1 ring-inset ring-foreground/10"
                      style={{ background: `linear-gradient(135deg, oklch(0.75 0.13 ${c.hue}), oklch(0.5 0.17 ${c.hue + 40}))` }}
                    />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-medium">{c.name}</span>
                    <span className="block text-[11.5px] text-muted-foreground">
                      {formatCount(c.members)} {plural(c.members, ["учасник", "учасники", "учасників"])}
                    </span>
                  </span>
                  <ArrowUpRight className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </RailSection>

      {trends.length > 0 && (
        <RailSection title="Теми дня" href="/explore" icon={Flame}>
          <ol className="space-y-0.5">
            {trends.map((t, i) => (
              <li key={t.tag}>
                <Link
                  href={`/hashtag/${t.tag}`}
                  className="group flex items-start gap-2.5 rounded-xl px-1.5 py-1.5 transition-colors hover:bg-subtle"
                >
                  <span className="mt-px w-5 shrink-0 font-mono text-[11px] text-brand/80 tabular">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-medium transition-colors group-hover:text-brand">
                      #{t.tag}
                    </span>
                    <span className="block text-[11.5px] text-muted-foreground">
                      {t.category} · {formatCount(t.posts)} {plural(t.posts, ["допис", "дописи", "дописів"])}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </RailSection>
      )}
    </>
  )
}

async function LiveRail() {
  const [people, { mine, recommended }, trends] = await Promise.all([
    listSuggestedPeople(3),
    listCommunities(3),
    listTrends(4),
  ])
  return <RailContent trends={trends} people={people} communities={[...recommended, ...mine].slice(0, 3)} />
}

export function RightRail() {
  return (
    <aside className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-[300px] shrink-0 flex-col gap-3 overflow-y-auto py-4 pl-5 no-scrollbar lg:flex group-has-[[data-layout=wide]]/shell:hidden">
      {isMockMode ? (
        <RailContent trends={mockTrends.slice(0, 4)} people={suggestedUsers.slice(0, 3)} communities={mockCommunities.slice(3, 6)} />
      ) : (
        <Suspense fallback={<div className="shimmer h-40 rounded-2xl" aria-hidden />}>
          <LiveRail />
        </Suspense>
      )}

      <footer className="flex flex-wrap gap-x-3 gap-y-1 px-2 pb-4 text-[11px] text-muted-foreground">
        <Link href="/guidelines" className="hover:text-foreground">Правила</Link>
        <Link href="/about" className="hover:text-foreground">Про нас</Link>
        <Link href="/contact" className="hover:text-foreground">Контакти</Link>
        <Link href="/terms" className="hover:text-foreground">Умови</Link>
        <Link href="/privacy" className="hover:text-foreground">Конфіденційність</Link>
        <span className="w-full pt-1 opacity-70">© 2026 Lumyn</span>
      </footer>
    </aside>
  )
}
