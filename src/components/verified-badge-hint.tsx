"use client"

import { useEffect, useRef, useState } from "react"
import { Popover as PopoverPrimitive } from "radix-ui"
import { cn } from "@/lib/utils"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { VERIFIED_PATH } from "@/components/verified-path"

const HOVER_DELAY = 250

/** мишка з точним курсором → ховер-підказка; інакше (телефон) — тап */
const canHover = () => window.matchMedia("(hover: hover) and (pointer: fine)").matches

/**
 * Печатка верифікації з підказкою: ховер на десктопі, тап на телефоні.
 * Тап не веде на профіль — лише показує/ховає підказку.
 */
export function VerifiedBadgeHint({ className, shimmer = true }: { className?: string; shimmer?: boolean }) {
  const [open, setOpen] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    []
  )

  const enter = () => {
    if (!canHover()) return
    timer.current = setTimeout(() => setOpen(true), HOVER_DELAY)
  }
  const leave = () => {
    if (timer.current) clearTimeout(timer.current)
    if (canHover()) setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        asChild
        onClick={(e) => {
          // підказка замість переходу на профіль/пост
          e.preventDefault()
          e.stopPropagation()
          if (!canHover()) setOpen((o) => !o)
        }}
        onMouseEnter={enter}
        onMouseLeave={leave}
      >
        <span
          aria-label="Підтверджений акаунт"
          className={cn("lumyn-verified relative inline-flex size-4 shrink-0 cursor-help text-foreground", className)}
        >
          <svg viewBox="0 0 16 16" className="size-full" aria-hidden shapeRendering="geometricPrecision">
            <path d={VERIFIED_PATH} fill="currentColor" fillRule="evenodd" />
          </svg>
          {shimmer && <span aria-hidden className="lumyn-verified-shine pointer-events-none absolute inset-0" />}
        </span>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        collisionPadding={8}
        onCloseAutoFocus={(e) => e.preventDefault()}
        className="w-auto max-w-[240px] flex-row items-center gap-1.5 rounded-md bg-foreground px-2.5 py-1.5 text-xs font-medium text-background ring-0"
      >
        <svg viewBox="0 0 16 16" className="size-3.5 shrink-0" aria-hidden shapeRendering="geometricPrecision">
          <path d={VERIFIED_PATH} fill="currentColor" fillRule="evenodd" />
        </svg>
        Підтверджений акаунт
        <PopoverPrimitive.Arrow asChild>
          <svg viewBox="0 0 10 5" width={10} height={5} className="fill-foreground" aria-hidden>
            <path d="M5 5L0 0h10L5 5Z" />
          </svg>
        </PopoverPrimitive.Arrow>
      </PopoverContent>
    </Popover>
  )
}
