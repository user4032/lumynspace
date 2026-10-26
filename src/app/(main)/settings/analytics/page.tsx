import type { Metadata } from "next"
import { Suspense } from "react"
import Link from "next/link"
import { ArrowRight, Eye, MessageCircle, Repeat2, Sparkles, UserPlus } from "lucide-react"
import { PageHeader } from "@/components/layout/page-header"
import { SparkIcon } from "@/components/icons"
import { formatCount } from "@/lib/format"
import { getAuthorStats, type AuthorStats } from "@/lib/queries"

export const metadata: Metadata = { title: "Ваша активність" }

function Stat({ icon: Icon, label, value, hint }: { icon: typeof Eye; label: string; value: number; hint?: string }) {
  return (
    <div className="rounded-2xl border bg-subtle/40 p-4">
      <span className="grid size-9 place-items-center rounded-lg border bg-background">
        <Icon className="size-4 text-brand" />
      </span>
      <p className="mt-3 font-mono text-2xl font-semibold tabular">{formatCount(value)}</p>
      <p className="mt-0.5 text-sm font-medium">{label}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

async function Analytics() {
  const stats = await getAuthorStats()
  if (!stats)
    return (
      <p className="px-5 py-16 text-center text-sm text-muted-foreground">
        Статистика з&apos;явиться після запуску <code className="rounded bg-muted px-1">apply-pending-6.sql</code> у Supabase.
      </p>
    )
  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={Eye} label="Перегляди" value={stats.views7d} hint="за 7 днів" />
        <Stat icon={Sparkles} label="Світло" value={stats.lights7d} hint="за 7 днів" />
        <Stat icon={UserPlus} label="Нові читачі" value={stats.followers7d} hint="за 7 днів" />
        <Stat icon={Eye} label="Усього переглядів" value={stats.totalViews} hint="за весь час" />
      </div>

      <h2 className="mt-10 text-lg font-semibold tracking-tight">Топ-дописи за переглядами</h2>
      {stats.topPosts.length ? (
        <ul className="mt-3 divide-y">
          {stats.topPosts.map((p, i) => (
            <li key={p.id}>
              <Link href={`/post/${p.id}`} className="group flex items-center gap-3 py-3">
                <span className="w-5 shrink-0 font-mono text-xs text-muted-foreground tabular">{String(i + 1).padStart(2, "0")}</span>
                <span className="min-w-0 flex-1 truncate text-sm text-foreground/90 group-hover:text-foreground">{p.excerpt || "(медіа-допис)"}</span>
                <span className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1 tabular">
                    <Eye className="size-3.5" /> {formatCount(p.views)}
                  </span>
                  <span className="inline-flex items-center gap-1 tabular">
                    <SparkIcon filled className="size-3" /> {formatCount(p.lights)}
                  </span>
                  <span className="hidden items-center gap-1 tabular sm:inline-flex">
                    <MessageCircle className="size-3.5" /> {formatCount(p.replies)}
                  </span>
                  <ArrowRight className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">Ще нема дописів — світіть перший, і тут з&apos;являться цифри.</p>
      )}
    </>
  )
}

export default function AnalyticsPage() {
  return (
    <>
      <PageHeader title="Ваша активність" subtitle="Перегляди, світло й нові читачі — лише для ваших очей" />
      <div className="px-4 py-6 sm:px-5">
        <Suspense fallback={<p className="py-16 text-center text-sm text-muted-foreground">Збираємо цифри…</p>}>
          <Analytics />
        </Suspense>
      </div>
    </>
  )
}
