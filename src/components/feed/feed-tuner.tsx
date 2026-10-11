"use client"

import { useEffect, useRef, useState } from "react"
import { motion } from "framer-motion"
import { AlignLeft, Compass, ImageIcon, RotateCcw, SlidersHorizontal, Users } from "lucide-react"
import type { FeedPrefs } from "@/types"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Slider } from "@/components/ui/slider"
import { Button } from "@/components/ui/button"
import { saveFeedPrefs } from "@/lib/actions/viewer"
import { useViewer, viewerActions } from "@/lib/viewer-store"
import { cn } from "@/lib/utils"

function describe(p: FeedPrefs) {
  const social =
    p.social < 0.34 ? "переважно друзі" : p.social > 0.66 ? "більше відкриттів" : "друзі + відкриття"
  const media = p.media < 0.34 ? "більше тексту" : p.media > 0.66 ? "більше фото й коду" : "текст і медіа порівну"
  return `${social} · ${media}`
}

function TunerRow({
  label,
  left,
  right,
  value,
  onChange,
  onCommit,
}: {
  label: string
  left: { icon: React.ReactNode; text: string }
  right: { icon: React.ReactNode; text: string }
  value: number
  onChange: (v: number) => void
  onCommit: (v: number) => void
}) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className={cn("inline-flex items-center gap-1.5 transition-colors", value < 0.5 && "text-foreground")}>
          {left.icon}
          {left.text}
        </span>
        <span className="font-mono text-[10px] tabular opacity-70">{Math.round(value * 100)}</span>
        <span className={cn("inline-flex items-center gap-1.5 transition-colors", value > 0.5 && "text-foreground")}>
          {right.text}
          {right.icon}
        </span>
      </div>
      <Slider
        aria-label={label}
        min={0}
        max={1}
        step={0.05}
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        onValueCommit={([v]) => onCommit(v)}
      />
    </div>
  )
}

/** Тюнер стрічки «Для тебе»: ваги зберігаються в profiles.feed_prefs і йдуть у for_you_feed() */
export function FeedTuner({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const prefs = useViewer((s) => s.feedPrefs)
  const [draft, setDraft] = useState(prefs)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setDraft(prefs), 0)
    return () => clearTimeout(t)
  }, [prefs])

  const commit = (next: FeedPrefs) => {
    viewerActions.setFeedPrefs(next)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => void saveFeedPrefs(next), 500)
  }

  const changed = Math.abs(prefs.social - 0.5) > 0.01 || Math.abs(prefs.media - 0.5) > 0.01

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger
        aria-label="Тюнер стрічки"
        className={cn(
          "relative inline-flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-muted data-[state=open]:text-foreground"
        )}
      >
        <SlidersHorizontal className="size-[17px]" />
        {changed && <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-brand ring-2 ring-background" />}
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-[320px] gap-0 p-0">
        <div className="flex items-start justify-between gap-3 border-b px-4 pt-3.5 pb-3">
          <div>
            <p className="text-sm font-semibold tracking-tight">Тюнер стрічки</p>
            <motion.p key={describe(draft)} initial={{ opacity: 0, y: 2 }} animate={{ opacity: 1, y: 0 }} className="mt-0.5 text-xs text-muted-foreground">
              {describe(draft)}
            </motion.p>
          </div>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Скинути"
            disabled={!changed}
            onClick={() => commit({ social: 0.5, media: 0.5 })}
            className="rounded-full"
          >
            <RotateCcw />
          </Button>
        </div>
        <div className="space-y-5 px-4 py-4">
          <TunerRow
            label="Друзі або рекомендації"
            left={{ icon: <Users className="size-3.5" />, text: "Друзі" }}
            right={{ icon: <Compass className="size-3.5" />, text: "Рекомендації" }}
            value={draft.social}
            onChange={(v) => setDraft((d) => ({ ...d, social: v }))}
            onCommit={(v) => commit({ ...draft, social: v })}
          />
          <TunerRow
            label="Текст або медіа"
            left={{ icon: <AlignLeft className="size-3.5" />, text: "Текст" }}
            right={{ icon: <ImageIcon className="size-3.5" />, text: "Медіа" }}
            value={draft.media}
            onChange={(v) => setDraft((d) => ({ ...d, media: v }))}
            onCommit={(v) => commit({ ...draft, media: v })}
          />
        </div>
        <p className="border-t bg-subtle px-4 py-2.5 text-[11px] leading-relaxed text-muted-foreground">
          Стрічка ваша, а не алгоритму. Біля кожної рекомендації є «чому я це бачу».
        </p>
      </PopoverContent>
    </Popover>
  )
}
