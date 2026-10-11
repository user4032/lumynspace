"use client"

import Link from "next/link"
import { createContext, useContext } from "react"
import { HelpCircle, SlidersHorizontal, TrendingUp, UserPlus, Users } from "lucide-react"
import type { Post, PostReason } from "@/types"
import { GLOW, remainingLabel } from "@/lib/glow"
import { cn } from "@/lib/utils"
import { CloseFriendsIcon, SparkIcon } from "@/components/icons"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Button } from "@/components/ui/button"

/** Відкрити тюнер стрічки з будь-якої картки («чому я це бачу» → «Налаштувати») */
export const FeedTunerContext = createContext<{ open: () => void } | null>(null)

const REASON_TEXT: Record<PostReason["type"], { short: (r: PostReason) => React.ReactNode; long: string }> = {
  friend_light: {
    short: (r) => (
      <>
        <span className="text-foreground">{r.actor?.name.split(" ")[0] ?? "Друг"}</span> дав(-ла) світло
      </>
    ),
    long: "Хтось, кого ви читаєте, дав цьому допису світло. Чим правіше повзунок «рекомендації», тим більше такого.",
  },
  community_popular: {
    short: (r) => (
      <>
        Популярне в <span className="text-foreground">{r.community?.name ?? "спільноті"}</span>
      </>
    ),
    long: "Допис набирає світло у спільноті, де ви учасник.",
  },
  new_author: {
    short: () => <>Новий автор у Lumyn</>,
    long: "Ми трохи підсвічуємо новачків, щоб їх помітили. Без накруток: лише дописи, які вже отримують світло.",
  },
  popular: {
    short: () => <>Популярне зараз</>,
    long: "Багато світла за останні години серед людей зі схожими інтересами.",
  },
}

const REASON_ICON = { friend_light: SparkIcon, community_popular: Users, new_author: UserPlus, popular: TrendingUp }

/** «Чому я це бачу» — чип над рекомендованим дописом */
export function ReasonChip({ reason, onHide }: { reason: PostReason; onHide: () => void }) {
  const tuner = useContext(FeedTunerContext)
  const text = REASON_TEXT[reason.type]
  const Icon = REASON_ICON[reason.type]
  return (
    <Popover>
      <PopoverTrigger
        onClick={(e) => e.stopPropagation()}
        className="group/reason inline-flex h-5 max-w-full items-center gap-1.5 rounded-full text-xs text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Icon className="size-3.5 shrink-0" />
        <span className="truncate">{text.short(reason)}</span>
        <HelpCircle className="size-3 shrink-0 opacity-0 transition-opacity group-hover/reason:opacity-100" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-3.5" onClick={(e) => e.stopPropagation()}>
        <p className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">Чому я це бачу</p>
        <p className="text-sm leading-relaxed">{text.long}</p>
        <div className="flex gap-2 pt-1">
          {tuner && (
            <Button size="xs" variant="secondary" onClick={tuner.open}>
              <SlidersHorizontal /> Налаштувати стрічку
            </Button>
          )}
          <Button size="xs" variant="ghost" onClick={onHide}>
            Менше такого
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

export function CloseFriendsChip() {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex h-5 items-center gap-1 rounded-full bg-close/12 px-2 text-[11px] font-medium text-close">
          <CloseFriendsIcon className="size-3" /> Близькі друзі
        </span>
      </TooltipTrigger>
      <TooltipContent>Бачать лише люди зі списку близьких друзів автора</TooltipContent>
    </Tooltip>
  )
}

/** «Glow · ще 7 год» у шапці допису */
export function GlowBadge({ post, now, className }: { post: Pick<Post, "expiresAt" | "lights">; now: number; className?: string }) {
  const left = Math.max(0, GLOW.permanentAt - post.lights)
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "inline-flex h-5 shrink-0 items-center gap-1 rounded-full border border-glow/30 bg-glow/10 px-1.5 font-mono text-[10.5px] font-medium text-glow tabular",
            className
          )}
        >
          <SparkIcon filled className="size-2.5" />
          <span suppressHydrationWarning>{remainingLabel(post.expiresAt, now)}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-60 text-balance">
        Glow-допис згасне, якщо не отримає світла. Кожне світло — +{GLOW.hoursPerLight} год (до {GLOW.maxHours} год).
        {left > 0 ? ` Ще ${left} — і він лишиться назавжди.` : ""}
      </TooltipContent>
    </Tooltip>
  )
}

export function PermanentBadge() {
  return (
    <span className="inline-flex h-5 shrink-0 items-center gap-1 rounded-full border px-1.5 font-mono text-[10.5px] text-muted-foreground">
      <SparkIcon filled className="size-2.5 text-glow" /> назавжди
    </span>
  )
}

export function CommunityLink({ community }: { community: { slug: string; name: string } }) {
  return (
    <Link href={`/c/${community.slug}`} className="inline-flex items-center gap-1.5 hover:text-foreground hover:underline">
      <Users className="size-3.5" />
      {community.name}
    </Link>
  )
}
