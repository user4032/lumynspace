"use client"

import { useEffect, useState } from "react"
import type { StoryGroup } from "@/types"
import { UserAvatar } from "@/components/user-avatar"
import { getStoryFeed } from "@/lib/actions/stories"
import { isMockMode } from "@/lib/env"
import { cn } from "@/lib/utils"
import { StoryViewer } from "./story-viewer"

/** Смуга сторіс над стрічкою: лише інші автори (своя історія живе в рядку композера). */
export function StoriesBar() {
  const [groups, setGroups] = useState<StoryGroup[] | null>(null)
  const [openAt, setOpenAt] = useState<number | null>(null)

  const reload = () => {
    if (isMockMode) return
    void getStoryFeed().then((res) => setGroups(res.ok && res.data ? res.data : []))
  }
  useEffect(reload, [])

  if (isMockMode || groups === null) return null

  const others = groups.filter((g) => !g.isMe)
  if (others.length === 0) return null

  return (
    <>
      <div className="no-scrollbar mx-3 mb-2.5 flex gap-3.5 overflow-x-auto rounded-2xl bg-card px-3 py-2.5">
        {others.map((g) => {
          const unseen = g.stories.some((s) => !s.seen)
          return (
            <button
              key={g.author.id}
              type="button"
              onClick={() => setOpenAt(others.indexOf(g))}
              className="flex w-16 shrink-0 flex-col items-center gap-1.5"
            >
              <span
                className={cn(
                  "grid size-10 place-items-center rounded-full p-[2px]",
                  unseen ? "bg-[conic-gradient(var(--brand),var(--glow),var(--brand))]" : "bg-muted",
                )}
              >
                <span className="grid size-full place-items-center rounded-full bg-background p-[2px]">
                  <UserAvatar user={g.author} size="lg" className="size-full" />
                </span>
              </span>
              <span className="w-full truncate text-center text-[11px] text-muted-foreground">{g.author.name}</span>
            </button>
          )
        })}
      </div>

      {openAt !== null && (
        <StoryViewer
          groups={others}
          startIndex={openAt}
          onClose={() => {
            setOpenAt(null)
            reload()
          }}
          onDeleted={reload}
        />
      )}
    </>
  )
}
