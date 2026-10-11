"use client"

import { useOptimistic, useState, useTransition } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { BarChart3, Bookmark, Download, ImageIcon, Link2, MessageCircle, Repeat2, Share } from "lucide-react"
import { toast } from "sonner"
import type { Post } from "@/types"
import { toggleRepost } from "@/lib/actions/posts"
import { formatCount } from "@/lib/format"
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { LightButton } from "./light-button"

function AnimatedCount({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn("relative inline-flex h-4 min-w-[1ch] overflow-hidden text-[13px] tabular", className)}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={value}
          initial={{ y: 8, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -8, opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="leading-4"
        >
          {value > 0 ? formatCount(value) : ""}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}

function ActionButton({
  label,
  active,
  onClick,
  children,
  className,
}: {
  label: string
  active?: boolean
  onClick?: () => void
  children: React.ReactNode
  className?: string
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={(e) => {
        e.stopPropagation()
        onClick?.()
      }}
      className={cn(
        "group/action -ml-2 inline-flex h-8 items-center gap-1 rounded-full pr-2 text-muted-foreground transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
    >
      {children}
    </button>
  )
}

/** Меню «Поділитися»: посилання + картка-картинка 1080×1350 для сторіс */
export function ShareMenu({ post, iconClass, children }: { post: Post; iconClass?: string; children?: React.ReactNode }) {
  const copy = async () => {
    const url = `${window.location.origin}/post/${post.id}`
    await navigator.clipboard?.writeText(url).catch(() => {})
    toast.success("Посилання скопійовано")
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Поділитися"
        onClick={(e) => e.stopPropagation()}
        className="group/action inline-flex h-8 items-center rounded-full text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        {children ?? (
          <span className="rounded-full p-1.5 transition-colors group-hover/action:bg-muted">
            <Share className={iconClass} />
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Поділитися</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => void copy()}>
          <Link2 /> Копіювати посилання
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={`/api/share/${post.id}?download=1`} download={`lumyn-${post.id}.png`} onClick={() => toast("Готуємо картинку 1080×1350…")}>
            <Download /> Зберегти як картинку
          </a>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <a href={`/api/share/${post.id}`} target="_blank" rel="noreferrer">
            <ImageIcon /> Переглянути картку для сторіс
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

type LightProps = { lights: number; lit: boolean; toggle: () => void }

export function PostActions({ post, light, size = "md" }: { post: Post; light: LightProps; size?: "md" | "lg" }) {
  const [counts, setCounts] = useState({ reposts: post.reposts, reposted: post.reposted })
  const [optimistic, setOptimistic] = useOptimistic(counts)
  const [, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)

  const repost = () => {
    const next = { reposted: !counts.reposted, reposts: counts.reposts + (counts.reposted ? -1 : 1) }
    startTransition(async () => {
      setOptimistic(next)
      const res = await toggleRepost(post.id, next.reposted)
      if (res.ok) {
        setCounts(next)
        toast(next.reposted ? "Репост додано у вашу стрічку" : "Репост скасовано")
      } else toast.error(res.error)
    })
  }

  const icon = size === "lg" ? "size-[19px]" : "size-[17px]"
  const hoverBg = "rounded-full p-1.5 transition-colors"

  return (
    <div className={cn("flex items-center justify-between", size === "lg" ? "max-w-none" : "max-w-[440px]")}>
      <ActionButton label="Відповісти" className="hover:text-foreground">
        <span className={cn(hoverBg, "group-hover/action:bg-muted")}>
          <MessageCircle className={icon} />
        </span>
        <AnimatedCount value={post.replies} />
      </ActionButton>

      <ActionButton
        label="Репост"
        active={optimistic.reposted}
        onClick={repost}
        className={cn("hover:text-foreground", optimistic.reposted && "text-foreground")}
      >
        <motion.span
          className={cn(hoverBg, "group-hover/action:bg-muted")}
          animate={optimistic.reposted ? { rotate: [0, 180] } : { rotate: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
        >
          <Repeat2 className={icon} strokeWidth={optimistic.reposted ? 2.4 : 2} />
        </motion.span>
        <AnimatedCount value={optimistic.reposts} />
      </ActionButton>

      <LightButton lit={light.lit} count={light.lights} onToggle={light.toggle} size={size} />

      <ActionButton label="Перегляди" className="hidden hover:text-foreground sm:inline-flex">
        <span className={cn(hoverBg, "group-hover/action:bg-muted")}>
          <BarChart3 className={icon} />
        </span>
        <AnimatedCount value={post.lights * 9 + post.replies * 31} />
      </ActionButton>

      <div className="flex items-center">
        <ActionButton
          label="Зберегти"
          active={saved}
          onClick={() => {
            setSaved((s) => !s)
            toast(saved ? "Видалено із закладок" : "Додано в закладки")
          }}
          className={cn("ml-0 pr-0 hover:text-foreground", saved && "text-foreground")}
        >
          <span className={cn(hoverBg, "group-hover/action:bg-muted")}>
            <Bookmark className={icon} fill={saved ? "currentColor" : "none"} />
          </span>
        </ActionButton>
        <ShareMenu post={post} iconClass={icon} />
      </div>
    </div>
  )
}
