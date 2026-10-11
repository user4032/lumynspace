"use client"

import { useOptimistic, useState, useTransition } from "react"
import { toast } from "sonner"
import { Check, Clock, Lock, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toggleFollow } from "@/lib/actions/social"
import { cn } from "@/lib/utils"

type FollowState = "none" | "pending" | "following"

export function FollowButton({
  userId,
  initial = false,
  requested = false,
  isPrivate = false,
  accent = false,
  size = "sm",
  className,
}: {
  userId: string
  initial?: boolean
  /** запит уже надіслано (follows.status = pending) */
  requested?: boolean
  /** приватний акаунт → «Надіслати запит» / «Запит надіслано» (follows.status = pending) */
  isPrivate?: boolean
  /** пофарбувати в акцент профілю */
  accent?: boolean
  size?: "xs" | "sm" | "default"
  className?: string
}) {
  const [state, setState] = useState<FollowState>(initial ? "following" : requested ? "pending" : "none")
  const [optimistic, setOptimistic] = useOptimistic(state)
  const [, startTransition] = useTransition()

  const onClick = () => {
    const next: FollowState = optimistic === "none" ? (isPrivate ? "pending" : "following") : "none"
    startTransition(async () => {
      setOptimistic(next)
      const res = await toggleFollow(userId, next !== "none")
      if (res.ok) {
        setState(next)
        if (next === "pending") toast("Запит надіслано", { description: "Ви побачите дописи, щойно його схвалять." })
      } else toast.error(res.error)
    })
  }

  const active = optimistic !== "none"

  return (
    <Button
      size={size}
      variant={active ? "secondary" : "default"}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      aria-pressed={active}
      style={
        accent && !active
          ? { background: "var(--accent-user)", color: "var(--accent-user-fg)" }
          : undefined
      }
      className={cn("group/follow min-w-[92px] rounded-full", size === "xs" && "h-7 min-w-[84px] px-3", accent && !active && "hover:opacity-90", className)}
    >
      {optimistic === "following" ? (
        <>
          <Check className="group-hover/follow:hidden" />
          <span className="group-hover/follow:hidden">Читаю</span>
          <span className="hidden text-destructive group-hover/follow:inline">Відписатися</span>
        </>
      ) : optimistic === "pending" ? (
        <>
          <Clock className="group-hover/follow:hidden" />
          <span className="group-hover/follow:hidden">Запит надіслано</span>
          <span className="hidden group-hover/follow:inline">Скасувати</span>
        </>
      ) : isPrivate ? (
        <>
          <Lock /> Надіслати запит
        </>
      ) : (
        <>
          <Plus /> Читати
        </>
      )}
    </Button>
  )
}
