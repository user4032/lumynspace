import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { Suspense } from "react"
import { Lock } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { PageHeader } from "@/components/layout/page-header"
import { CommunityIcon } from "@/components/community-icon"
import { CreateCommunityButton } from "@/components/create-community"
import { communities } from "@/lib/mock-data"
import { formatCount, plural } from "@/lib/format"
import { isMockMode } from "@/lib/env"
import { listCommunities } from "@/lib/queries"
import type { Community } from "@/types"

export const metadata: Metadata = { title: "Спільноти" }

const ROLE_LABEL = { owner: "Власник", admin: "Адмін", mod: "Модератор", member: "Учасник" } as const

async function LiveCommunities() {
  const { mine, recommended } = await listCommunities()
  return <CommunityLists mine={mine} recommended={recommended} />
}

export default function CommunitiesPage() {
  return (
    <>
      <PageHeader title="Спільноти" subtitle="Знаходьте своїх людей">
        <div className="absolute top-3 right-4">
          <CreateCommunityButton />
        </div>
      </PageHeader>

      {isMockMode ? (
        <CommunityLists mine={communities.filter((c) => c.role)} recommended={communities.filter((c) => !c.role)} />
      ) : (
        <Suspense fallback={<div className="space-y-2 p-4" aria-hidden><div className="shimmer h-16 rounded-lg" /><div className="shimmer h-16 rounded-lg" /></div>}>
          <LiveCommunities />
        </Suspense>
      )}
    </>
  )
}

function CommunityLists({ mine, recommended }: { mine: Community[]; recommended: Community[] }) {
  if (!mine.length && !recommended.length) {
    return <p className="px-4 py-16 text-center text-sm text-muted-foreground">Спільнот ще немає</p>
  }
  return (
    <>
      <section className="border-b p-4">
        <h2 className="mb-3 text-sm font-semibold tracking-tight">Мої спільноти</h2>
        {mine.length === 0 && <p className="text-sm text-muted-foreground">Ви ще не вступили в жодну спільноту</p>}
        <ul className="divide-y rounded-lg border empty:hidden">
          {mine.map((c) => (
            <li key={c.id}>
              <Link href={`/c/${c.slug}`} className="flex items-center gap-3 px-3 py-3 transition-colors first:rounded-t-lg last:rounded-b-lg hover:bg-subtle">
                <CommunityIcon community={c} />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-sm font-medium">
                    {c.name} {c.isPrivate && <Lock className="size-3 text-muted-foreground" />}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{c.description}</p>
                </div>
                {c.role && c.role !== "member" && <Badge variant="outline">{ROLE_LABEL[c.role]}</Badge>}
                <span className="hidden font-mono text-xs text-muted-foreground tabular sm:inline">{formatCount(c.members)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {recommended.length > 0 && (
      <section className="p-4">
        <h2 className="mb-3 text-sm font-semibold tracking-tight">Рекомендовані</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {recommended.map((c) => (
            <Link key={c.id} href={`/c/${c.slug}`} className="group overflow-hidden rounded-lg border transition-colors hover:border-input">
              <div className="relative h-20 bg-muted">
                {c.coverUrl && <Image src={c.coverUrl} alt="" fill sizes="300px" className="object-cover opacity-90 transition-transform duration-500 group-hover:scale-105" />}
              </div>
              <div className="p-3">
                <CommunityIcon community={c} className="-mt-8 size-10 ring-4 ring-background" />
                <p className="mt-2 text-sm font-semibold">{c.name}</p>
                <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{c.description}</p>
                <p className="mt-2 font-mono text-[11px] text-muted-foreground">
                  {formatCount(c.members)} {plural(c.members, ["учасник", "учасники", "учасників"])}{isMockMode && ` · ${c.postsPerDay}/день`}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>
      )}
    </>
  )
}
