"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { BarChart3, Check, ChevronDown, Code2, Globe2, ImageIcon, Loader2, Plus, Smile, Users2, X } from "lucide-react"
import { toast } from "sonner"
import type { Post, PostAudience, PostMedia, PostMode } from "@/types"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { UserAvatar } from "@/components/user-avatar"
import { CloseFriendsIcon, SparkIcon } from "@/components/icons"
import { createPost } from "@/lib/actions/posts"
import { useMe, useViewer } from "@/lib/viewer-store"
import { computeExpiry, GLOW } from "@/lib/glow"
import { nowISO } from "@/lib/format"
import { cn } from "@/lib/utils"
import { isMockMode } from "@/lib/env"
import { IMAGE_ACCEPT, imageSize, uploadImage } from "@/lib/storage"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"

const MAX = 500
const MOCK_IMAGES = ["/mock/post-1.jpg", "/mock/post-2.jpg", "/mock/post-3.jpg", "/mock/post-4.jpg"]

/** SVG-кільце ліміту: акцент → бурштин (≤ 40) → червоне (≤ 10 і понад ліміт) */
function CharRing({ count }: { count: number }) {
  const r = 9
  const c = 2 * Math.PI * r
  const pct = Math.min(count / MAX, 1)
  const left = MAX - count
  const color = left <= 10 ? "var(--destructive)" : left <= 40 ? "var(--glow)" : "var(--brand)"
  return (
    <span className="relative inline-flex size-6 items-center justify-center" aria-label={`Залишилось ${left} символів`}>
      <motion.svg viewBox="0 0 24 24" className="size-6 -rotate-90" animate={{ scale: left <= 40 ? 1.12 : 1 }}>
        <circle cx="12" cy="12" r={r} fill="none" stroke="var(--border)" strokeWidth="2" />
        <motion.circle
          cx="12"
          cy="12"
          r={r}
          fill="none"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray={c}
          animate={{ strokeDashoffset: c * (1 - pct), stroke: color }}
          transition={{ duration: 0.15 }}
        />
      </motion.svg>
      {left <= 40 && (
        <span className={cn("absolute font-mono text-[9px] tabular", left <= 10 ? "text-destructive" : "text-muted-foreground")}>
          {left}
        </span>
      )}
    </span>
  )
}

/** Перемикач Glow: іскра, що «загоряється» */
function GlowToggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  const reduce = useReducedMotion()
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label="Glow-допис"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onChange(!on)}
          className={cn(
            "relative inline-flex h-8 items-center gap-1.5 overflow-hidden rounded-full border px-2.5 text-xs font-medium transition-colors",
            on ? "border-glow/40 bg-glow/10 text-glow" : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          <span className="relative inline-flex">
            <AnimatePresence>
              {on && !reduce && (
                <motion.span
                  key="halo"
                  className="absolute -inset-2 rounded-full"
                  style={{ background: "radial-gradient(circle, color-mix(in oklab, var(--glow) 60%, transparent), transparent 70%)" }}
                  initial={{ scale: 0.2, opacity: 0.9 }}
                  animate={{ scale: 1.6, opacity: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                />
              )}
            </AnimatePresence>
            <motion.span
              animate={on ? { rotate: [0, 90], scale: [0.8, 1.15, 1] } : { rotate: 0, scale: 1 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="relative inline-flex"
            >
              <SparkIcon filled={on} className={cn("size-4", on && "drop-shadow-[0_0_6px_var(--glow)]")} />
            </motion.span>
          </span>
          <span>{on ? `Glow · ${GLOW.baseHours} год` : "Glow"}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-64 text-balance">
        Glow-допис живе {GLOW.baseHours} год. Кожне світло — +{GLOW.hoursPerLight} год, {GLOW.permanentAt} світла — і він лишається назавжди.
      </TooltipContent>
    </Tooltip>
  )
}

type Circle = { id: string; name: string; emoji: string }

/** Supabase: мої кола (таблиця circles, RLS — лише власник) */
function useMyCircles(enabled: boolean) {
  const [circles, setCircles] = useState<Circle[]>([])
  useEffect(() => {
    const supabase = getSupabaseBrowserClient()
    if (!supabase || !enabled) return
    let alive = true
    void supabase
      .from("circles")
      .select("id, name, emoji")
      .order("created_at", { ascending: true })
      .then(({ data }) => alive && setCircles((data ?? []) as Circle[]))
    return () => {
      alive = false
    }
  }, [enabled])
  return circles
}

function AudiencePicker({
  value,
  circleId,
  onChange,
}: {
  value: PostAudience
  circleId: string | null
  onChange: (v: PostAudience, circleId?: string | null) => void
}) {
  const closeCount = useViewer((s) => s.closeFriends.length)
  const circles = useMyCircles(!isMockMode)
  const options = [
    { value: "public" as const, label: "Усі", hint: "Будь-хто в Lumyn", icon: <Globe2 className="size-4" /> },
    {
      value: "close_friends" as const,
      label: "Близькі друзі",
      hint: `${closeCount} ${closeCount === 1 ? "людина" : "людей"} зі списку`,
      icon: <CloseFriendsIcon className="size-4 text-close" />,
    },
  ]
  const circle = value === "circle" ? circles.find((c) => c.id === circleId) : undefined
  const current = circle
    ? { value: "circle" as const, label: circle.name, hint: "", icon: <Users2 className="size-4" /> }
    : (options.find((o) => o.value === value) ?? options[0])
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        onMouseDown={(e) => e.preventDefault()}
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
          value === "close_friends" ? "border-close/40 bg-close/10 text-close" : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
      >
        {current.icon}
        <span className="max-sm:hidden">{current.label}</span>
        <ChevronDown className="size-3.5 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Хто побачить допис</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {options.map((o) => (
          <DropdownMenuItem key={o.value} onSelect={() => onChange(o.value, null)} className="py-2">
            {o.icon}
            <span className="flex-1">
              <span className="block text-sm">{o.label}</span>
              <span className="block text-xs text-muted-foreground">{o.hint}</span>
            </span>
            {value === o.value && <Check className="size-4" />}
          </DropdownMenuItem>
        ))}
        {circles.length > 0 && <DropdownMenuSeparator />}
        {circles.map((c) => (
          <DropdownMenuItem key={c.id} onSelect={() => onChange("circle", c.id)} className="py-2">
            <Users2 className="size-4" />
            <span className="flex-1">
              <span className="block text-sm">{c.name}</span>
              <span className="block text-xs text-muted-foreground">Лише люди з цього кола</span>
            </span>
            {value === "circle" && circleId === c.id && <Check className="size-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function Composer({
  onPublish,
  onSettled,
  placeholder = "Що нового?",
  compact = false,
  communityId = null,
  replyTo = null,
  submitLabel = "Опублікувати",
}: {
  onPublish?: (post: Post) => void
  /** Supabase: допис збережено (post зі справжнім id) або не вдалося (null — прибрати оптимістичний) */
  onSettled?: (localId: string, post: Post | null) => void
  placeholder?: string
  compact?: boolean
  communityId?: string | null
  replyTo?: string | null
  submitLabel?: string
}) {
  const me = useMe()
  const [text, setText] = useState("")
  const [image, setImage] = useState<string | null>(null)
  const [code, setCode] = useState<{ lang: string; code: string } | null>(null)
  const [poll, setPoll] = useState<string[] | null>(null)
  const [mode, setMode] = useState<PostMode>("permanent")
  const [audience, setAudience] = useState<PostAudience>("public")
  const [circleId, setCircleId] = useState<string | null>(null)
  const [imageMeta, setImageMeta] = useState<{ width: number; height: number } | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(compact)
  const [pending, startTransition] = useTransition()
  const ref = useRef<HTMLTextAreaElement>(null)
  const shellRef = useRef<HTMLDivElement>(null)
  const topLevel = !replyTo

  const dirty = text.length > 0 || !!image || !!code || !!poll

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("compose") !== "1") return
    const t = setTimeout(() => {
      setOpen(true)
      ref.current?.focus()
    }, 0)
    return () => clearTimeout(t)
  }, [])

  // клік поза порожнім композером → назад у «пігулку»
  useEffect(() => {
    if (compact || !open) return
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node
      if (shellRef.current?.contains(t) || (t as HTMLElement).closest?.("[data-radix-popper-content-wrapper]")) return
      if (!dirty) setOpen(false)
    }
    document.addEventListener("pointerdown", onDown)
    return () => document.removeEventListener("pointerdown", onDown)
  }, [open, dirty, compact])

  const pollValid = !poll || poll.filter((o) => o.trim()).length >= 2
  const canPost = (text.trim().length > 0 || image || code?.code.trim() || poll) && text.length <= MAX && pollValid && !pending && !uploading
  const showTools = !compact || text.length > 0 || image || code || poll || open

  const reset = () => {
    setText("")
    setImage(null)
    setImageMeta(null)
    setCircleId(null)
    setCode(null)
    setPoll(null)
    setMode("permanent")
    setAudience("public")
  }

  // Supabase Storage: post-media/<uid>/<uuid>.<ext>
  const onPickImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    setUploading(true)
    const [res, size] = await Promise.all([uploadImage("post-media", file), imageSize(file)])
    setUploading(false)
    if (!res.ok) {
      toast.error(res.error)
      return
    }
    setImage(res.url)
    setImageMeta(size)
  }

  const submit = () => {
    if (!canPost) return
    const media: PostMedia[] = []
    if (image) media.push({ type: "image", url: image, width: imageMeta?.width ?? 1200, height: imageMeta?.height ?? 800 })
    if (code?.code.trim()) media.push({ type: "code", lang: code.lang, code: code.code })
    const options = poll?.map((o) => o.trim()).filter(Boolean) ?? []
    if (poll) media.push({ type: "poll", options })

    const createdAt = nowISO()
    const postMode: PostMode = topLevel ? mode : "permanent"
    const optimisticPost: Post = {
      id: `local-${crypto.randomUUID()}`,
      author: me,
      content: text.trim(),
      media: media.filter((m) => m.type !== "poll"),
      poll: poll ? { options, votes: options.map(() => 0), votedIndex: null, endsAt: "soon" } : null,
      createdAt,
      lights: 0,
      lit: false,
      replies: 0,
      reposts: 0,
      reposted: false,
      replyTo,
      mode: postMode,
      expiresAt: postMode === "glow" ? computeExpiry(createdAt, 0) : null,
      audience: topLevel ? audience : "public",
    }
    const postCircleId = circleId
    onPublish?.(optimisticPost)
    reset()
    if (!compact) setOpen(false)

    startTransition(async () => {
      const res = await createPost({
        content: optimisticPost.content,
        media,
        communityId,
        replyTo,
        mode: optimisticPost.mode,
        audience: optimisticPost.audience,
        circleId: optimisticPost.audience === "circle" ? postCircleId : null,
      })
      if (res.ok && !res.mock && res.data?.id)
        onSettled?.(optimisticPost.id, { ...optimisticPost, id: res.data.id, clientKey: optimisticPost.id })
      if (!res.ok) onSettled?.(optimisticPost.id, null)
      if (res.ok)
        toast.success(
          replyTo ? "Відповідь надіслано" : optimisticPost.mode === "glow" ? "Glow-допис світиться" : "Допис опубліковано",
          {
            description: res.mock
              ? "Демо-режим: збережено лише локально"
              : optimisticPost.mode === "glow"
                ? `Згасне через ${GLOW.baseHours} год, якщо не отримає світла`
                : undefined,
          }
        )
      else toast.error(res.error)
    })
  }

  return (
    <div className={cn("border-b px-4", compact ? "py-3" : "py-3.5")}>
      <motion.div
        ref={shellRef}
        layout
        transition={{ type: "spring", stiffness: 420, damping: 36 }}
        style={{ borderRadius: compact ? 0 : open ? 14 : 999 }}
        className={cn(
          "relative",
          !compact && "border bg-subtle/60",
          !compact && open && "bg-background shadow-[0_0_0_4px_color-mix(in_oklab,var(--foreground)_3%,transparent)]",
          !compact && mode === "glow" && open && "border-glow/35 shadow-[0_0_0_4px_color-mix(in_oklab,var(--glow)_8%,transparent),0_0_40px_-16px_var(--glow)]"
        )}
      >
        {!compact && !open ? (
          <motion.button
            layout="position"
            type="button"
            onClick={() => {
              setOpen(true)
              requestAnimationFrame(() => ref.current?.focus())
            }}
            className="flex w-full items-center gap-3 py-1.5 pr-2 pl-1.5 text-left"
          >
            <UserAvatar user={me} size="md" className="size-8" />
            <span className="flex-1 text-[15px] text-muted-foreground">{placeholder}</span>
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <span className="inline-flex size-8 items-center justify-center rounded-full"><ImageIcon className="size-4" /></span>
              <span className="inline-flex size-8 items-center justify-center rounded-full text-glow"><SparkIcon className="size-4" /></span>
            </span>
          </motion.button>
        ) : (
          <motion.div layout="position" className={cn("flex gap-3", !compact && "p-3")}>
            <UserAvatar user={me} size={compact ? "lg" : "md"} className={cn(!compact && "mt-0.5")} />
            <div className="min-w-0 flex-1">
              <textarea
                ref={ref}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onFocus={() => setOpen(true)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit()
                  if (e.key === "Escape" && !dirty && !compact) setOpen(false)
                }}
                placeholder={mode === "glow" ? "Щось на сьогодні — згасне за добу, якщо не засвітиться…" : placeholder}
                rows={1}
                aria-label="Текст допису"
                className={cn(
                  "field-sizing-content block max-h-[50vh] min-h-[44px] w-full resize-none bg-transparent pt-1.5 text-[17px] leading-[1.5] outline-none placeholder:text-muted-foreground/80",
                  compact && "min-h-9 pt-1.5 text-[15px]"
                )}
              />

              <AnimatePresence initial={false}>
                {image && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="relative mt-2 overflow-hidden rounded-xl border"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- прев'ю локального файлу */}
                    <img src={image} alt="" className="max-h-72 w-full object-cover" />
                    <button
                      onClick={() => setImage(null)}
                      aria-label="Прибрати зображення"
                      className="absolute top-2 right-2 inline-flex size-7 items-center justify-center rounded-full bg-black/70 text-white backdrop-blur transition-colors hover:bg-black"
                    >
                      <X className="size-4" />
                    </button>
                  </motion.div>
                )}

                {code && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-2 overflow-hidden rounded-lg border bg-subtle"
                  >
                    <div className="flex h-9 items-center justify-between border-b px-3">
                      <select
                        value={code.lang}
                        onChange={(e) => setCode({ ...code, lang: e.target.value })}
                        aria-label="Мова коду"
                        className="bg-transparent font-mono text-xs text-muted-foreground outline-none"
                      >
                        {["tsx", "ts", "js", "sql", "rust", "py", "css", "bash"].map((l) => (
                          <option key={l} value={l}>{l}</option>
                        ))}
                      </select>
                      <button onClick={() => setCode(null)} aria-label="Прибрати код" className="text-muted-foreground hover:text-foreground">
                        <X className="size-4" />
                      </button>
                    </div>
                    <textarea
                      value={code.code}
                      onChange={(e) => setCode({ ...code, code: e.target.value })}
                      placeholder="// вставте код"
                      spellCheck={false}
                      className="field-sizing-content block min-h-24 w-full resize-none bg-transparent p-3 font-mono text-[12.5px] leading-[1.7] outline-none"
                    />
                  </motion.div>
                )}

                {poll && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-2 space-y-2 overflow-hidden rounded-lg border p-3"
                  >
                    {poll.map((opt, i) => (
                      <input
                        key={i}
                        value={opt}
                        maxLength={40}
                        onChange={(e) => setPoll(poll.map((o, j) => (j === i ? e.target.value : o)))}
                        placeholder={`Варіант ${i + 1}`}
                        className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-ring"
                      />
                    ))}
                    <div className="flex items-center justify-between">
                      {poll.length < 4 ? (
                        <Button variant="ghost" size="xs" onClick={() => setPoll([...poll, ""])}>
                          <Plus /> Додати варіант
                        </Button>
                      ) : <span />}
                      <Button variant="ghost" size="xs" onClick={() => setPoll(null)} className="text-destructive hover:text-destructive">
                        Прибрати опитування
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence initial={false}>
                {showTools && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.18 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t pt-2.5">
                      <div className="-ml-2 flex items-center">
                        {/* у демо — випадкове стокове фото; справжнє завантаження з'явиться разом із Supabase Storage */}
                        {isMockMode ? (
                          <ToolButton label="Зображення" onClick={() => setImage(MOCK_IMAGES[Math.floor(Date.now() / 1000) % MOCK_IMAGES.length])}>
                            <ImageIcon />
                          </ToolButton>
                        ) : (
                          <>
                            <ToolButton label={uploading ? "Завантаження…" : "Зображення"} active={!!image} onClick={() => fileRef.current?.click()}>
                              {uploading ? <Loader2 className="animate-spin" /> : <ImageIcon />}
                            </ToolButton>
                            <input ref={fileRef} type="file" accept={IMAGE_ACCEPT} hidden onChange={onPickImage} />
                          </>
                        )}
                        <ToolButton label="Блок коду" active={!!code} onClick={() => setCode(code ? null : { lang: "tsx", code: "" })}>
                          <Code2 />
                        </ToolButton>
                        <ToolButton label="Опитування" active={!!poll} onClick={() => setPoll(poll ? null : ["", ""])}>
                          <BarChart3 />
                        </ToolButton>
                        <ToolButton label="Емодзі" onClick={() => setText((t) => t + " 🙂")}>
                          <Smile />
                        </ToolButton>
                        {topLevel && (
                          <span className="ml-1.5 flex items-center gap-1.5">
                            <GlowToggle on={mode === "glow"} onChange={(v) => setMode(v ? "glow" : "permanent")} />
                            <AudiencePicker
                              value={audience}
                              circleId={circleId}
                              onChange={(v, c) => {
                                setAudience(v)
                                setCircleId(c ?? null)
                              }}
                            />
                          </span>
                        )}
                      </div>
                      <div className="ml-auto flex items-center gap-3">
                        {text.length > 0 && <CharRing count={text.length} />}
                        {text.length > 0 && <span className="h-6 w-px bg-border" />}
                        <Button
                          size="sm"
                          disabled={!canPost}
                          onClick={submit}
                          className={cn("rounded-full px-4", mode === "glow" && topLevel && "bg-glow text-black hover:bg-glow/90")}
                        >
                          {mode === "glow" && topLevel ? "Засвітити" : submitLabel}
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  )
}

function ToolButton({
  label,
  onClick,
  active,
  children,
}: {
  label: string
  onClick: () => void
  active?: boolean
  children: React.ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={label}
          aria-pressed={active}
          onClick={onClick}
          onMouseDown={(e) => e.preventDefault()}
          className={cn("rounded-full text-brand hover:bg-brand/10 hover:text-brand", active && "bg-brand/10")}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}
