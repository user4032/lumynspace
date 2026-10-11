"use client"

import { useOptimistic, useState, useTransition } from "react"
import { motion } from "framer-motion"
import { Check } from "lucide-react"
import { toast } from "sonner"
import type { Poll } from "@/types"
import { votePoll } from "@/lib/actions/posts"
import { formatCount, plural } from "@/lib/format"
import { cn } from "@/lib/utils"

export function PollView({ postId, poll }: { postId: string; poll: Poll }) {
  const [state, setState] = useState(poll)
  const [optimistic, setOptimistic] = useOptimistic(state)
  const [, startTransition] = useTransition()

  const total = optimistic.votes.reduce((a, b) => a + b, 0)
  const voted = optimistic.votedIndex != null
  const max = Math.max(...optimistic.votes)

  const vote = (i: number) => {
    if (voted) return
    const next: Poll = {
      ...state,
      votedIndex: i,
      votes: state.votes.map((v, j) => (j === i ? v + 1 : v)),
    }
    startTransition(async () => {
      setOptimistic(next)
      const res = await votePoll(postId, i)
      if (res.ok) setState(next)
      else toast.error(res.error)
    })
  }

  return (
    <div className="space-y-1.5" onClick={(e) => e.stopPropagation()}>
      {optimistic.options.map((opt, i) => {
        const pct = total ? Math.round((optimistic.votes[i] / total) * 100) : 0
        const winner = voted && optimistic.votes[i] === max
        return voted ? (
          <div key={opt} className="relative flex h-9 items-center overflow-hidden rounded-md border px-3 text-sm">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className={cn("absolute inset-y-0 left-0", winner ? "bg-brand/15" : "bg-muted")}
            />
            <span className={cn("relative flex items-center gap-1.5", winner && "font-medium")}>
              {opt}
              {optimistic.votedIndex === i && <Check className="size-3.5 text-brand" />}
            </span>
            <span className={cn("relative ml-auto font-mono text-xs tabular", winner ? "text-foreground" : "text-muted-foreground")}>
              {pct}%
            </span>
          </div>
        ) : (
          <button
            key={opt}
            type="button"
            onClick={() => vote(i)}
            className="flex h-9 w-full items-center rounded-md border px-3 text-left text-sm font-medium transition-[border-color,background-color] hover:border-foreground/40 hover:bg-subtle"
          >
            {opt}
          </button>
        )
      })}
      <p className="pt-1 text-xs text-muted-foreground">
        {formatCount(total)} {plural(total, ["голос", "голоси", "голосів"])}
        {poll.endsAt ? " · 20 год до завершення" : " · Завершено"}
      </p>
    </div>
  )
}
