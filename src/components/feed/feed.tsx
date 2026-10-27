"use client"

import { useMemo, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { ArrowUp, Check } from "lucide-react"
import type { FeedTab, Post } from "@/types"
import { useInfiniteFeed } from "@/hooks/useInfiniteFeed"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Composer } from "./composer"
import { FeedTuner } from "./feed-tuner"
import { StoriesBar } from "@/components/stories/stories-bar"
import { PostCard, PostSkeleton } from "./post-card"
import { FeedTunerContext } from "./post-meta"

const TABS: { value: FeedTab; label: string }[] = [
  { value: "for-you", label: "Потік" },
  { value: "following", label: "Коло" },
]

export function FeedTabs({ value, onChange }: { value: FeedTab; onChange: (v: FeedTab) => void }) {
  return (
    <div role="tablist" aria-label="Стрічка" className="flex flex-1 gap-1 rounded-full bg-subtle p-1">
      {TABS.map((t) => {
        const active = t.value === value
        return (
          <button
            key={t.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.value)}
            className={cn(
              "h-8 flex-1 rounded-full text-[13.5px] font-medium transition-colors",
              active ? "bg-card text-foreground shadow-[0_1px_3px_rgb(0_0_0/0.35)]" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
          </button>
        )
      })}
    </div>
  )
}

function FeedList({ tab }: { tab: FeedTab }) {
  const { posts, firstPage, loading, hasMore, sentinelRef, prepend, settle, error, retry, newCount, clearNew } = useInfiniteFeed(tab)
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
      <StoriesBar />
      <Composer surface="card" onPublish={onPublish} onSettled={onSettled} />
      <AnimatePresence initial={false}>
        {newCount > 0 && (
          <motion.button
            key="new-posts"
            type="button"
            initial={{ y: -10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -10, opacity: 0 }}
            onClick={() => {
              clearNew()
              window.scrollTo({ top: 0, behavior: "smooth" })
            }}
            className="z-20 mx-auto -mb-2 flex items-center gap-1.5 rounded-full border bg-background/95 px-3.5 py-1.5 text-xs font-medium shadow-md backdrop-blur"
          >
            <ArrowUp className="size-3.5 text-brand" />
            {newCount} {newCount === 1 ? "новий допис" : "нових дописів"} — від вашого останнього візиту
          </motion.button>
        )}
      </AnimatePresence>
      {tab === "following" && posts.length > 0 && (
        <p className="mx-3 my-2.5 rounded-xl bg-subtle/60 px-3 py-2 text-xs text-muted-foreground">
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
      <div className="sticky top-14 z-30 bg-background/65 px-3 py-2.5 backdrop-blur-xl">
        <div className="flex items-center gap-1.5">
          <FeedTabs value={tab} onChange={setTab} />
          <AnimatePresence initial={false}>
            {tab === "for-you" && (
              <motion.div
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 40 }}
                exit={{ opacity: 0, width: 0 }}
                className="flex shrink-0 justify-center overflow-hidden"
              >
                <div className="grid size-10 shrink-0 place-items-center rounded-full bg-subtle">
                  <FeedTuner open={tunerOpen} onOpenChange={setTunerOpen} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      <FeedList key={tab} tab={tab} />
    </FeedTunerContext.Provider>
  )
}
