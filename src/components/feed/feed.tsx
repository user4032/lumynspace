"use client"

import { useMemo, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Check } from "lucide-react"
import type { FeedTab, Post } from "@/types"
import { useInfiniteFeed } from "@/hooks/useInfiniteFeed"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/layout/page-header"
import { cn } from "@/lib/utils"
import { Composer } from "./composer"
import { FeedTuner } from "./feed-tuner"
import { PostCard, PostSkeleton } from "./post-card"
import { FeedTunerContext } from "./post-meta"

const TABS: { value: FeedTab; label: string }[] = [
  { value: "for-you", label: "Для тебе" },
  { value: "following", label: "Підписки" },
]

export function FeedTabs({ value, onChange }: { value: FeedTab; onChange: (v: FeedTab) => void }) {
  return (
    <div role="tablist" aria-label="Стрічка" className="flex flex-1">
      {TABS.map((t) => {
        const active = t.value === value
        return (
          <button
            key={t.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.value)}
            className={cn(
              "relative flex h-[52px] flex-1 items-center justify-center text-[15px] font-medium transition-colors hover:bg-subtle",
              active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
            {active && (
              <motion.span
                layoutId="feed-tab-underline"
                className="absolute bottom-0 h-[2px] w-14 rounded-full bg-foreground"
                transition={{ type: "spring", stiffness: 500, damping: 38 }}
              />
            )}
          </button>
        )
      })}
    </div>
  )
}

function FeedList({ tab }: { tab: FeedTab }) {
  const { posts, firstPage, loading, hasMore, sentinelRef, prepend, settle, error, retry } = useInfiniteFeed(tab)
  const [freshIds, setFreshIds] = useState<Set<string>>(new Set())

  const onPublish = (post: Post) => {
    setFreshIds((s) => new Set(s).add(post.id))
    prepend(post)
  }

  const onSettled = (localId: string, post: Post | null) => {
    if (post) setFreshIds((s) => new Set(s).add(post.id))
    settle(localId, post)
  }

  // індекс у межах першої сторінки — для каскаду 40 мс
  const firstIndex = useMemo(() => {
    const m = new Map<string, number>()
    let i = 0
    for (const p of posts) if (firstPage.has(p.id)) m.set(p.id, i++)
    return m
  }, [posts, firstPage])

  return (
    <>
      <Composer onPublish={onPublish} onSettled={onSettled} />
      {tab === "following" && posts.length > 0 && (
        <p className="border-b px-4 py-2 text-xs text-muted-foreground">
          Лише ті, кого ви читаєте, від нових до старих. Без алгоритму.
        </p>
      )}
      <div>
        <AnimatePresence initial={false}>
          {posts.map((post) => (
            <PostCard
              key={post.clientKey ?? post.id}
              post={post}
              index={firstIndex.get(post.id) ?? 0}
              stagger={firstIndex.has(post.id)}
              animate={freshIds.has(post.id)}
            />
          ))}
        </AnimatePresence>
      </div>

      {loading && (
        <div>
          <PostSkeleton />
          <PostSkeleton media />
          <PostSkeleton />
        </div>
      )}

      {error && (
        <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
          <p className="text-sm text-muted-foreground">Не вдалося завантажити стрічку: {error}</p>
          <Button variant="secondary" size="sm" onClick={() => void retry()}>Спробувати ще</Button>
        </div>
      )}

      <div ref={sentinelRef} aria-hidden className="h-px" />

      {!hasMore && !loading && posts.length > 0 && (
        <div className="flex flex-col items-center gap-2 px-4 py-14 text-center">
          <span className="inline-flex size-9 items-center justify-center rounded-full border text-muted-foreground">
            <Check className="size-4" />
          </span>
          <p className="text-sm font-medium">Ви все переглянули</p>
          <p className="text-xs text-muted-foreground">Нові дописи з’являться тут автоматично.</p>
        </div>
      )}
    </>
  )
}

export function Feed() {
  const [tab, setTab] = useState<FeedTab>("for-you")
  const [tunerOpen, setTunerOpen] = useState(false)
  const tunerCtx = useMemo(
    () => ({
      open: () => {
        setTab("for-you")
        window.scrollTo({ top: 0, behavior: "smooth" })
        setTimeout(() => setTunerOpen(true), 250)
      },
    }),
    []
  )
  return (
    <FeedTunerContext.Provider value={tunerCtx}>
      <PageHeader className="md:top-14">
        <div className="flex items-center">
          <FeedTabs value={tab} onChange={setTab} />
          <AnimatePresence initial={false}>
            {tab === "for-you" && (
              <motion.div
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 52 }}
                exit={{ opacity: 0, width: 0 }}
                className="flex shrink-0 justify-center overflow-hidden"
              >
                <FeedTuner open={tunerOpen} onOpenChange={setTunerOpen} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </PageHeader>
      <FeedList key={tab} tab={tab} />
    </FeedTunerContext.Provider>
  )
}
