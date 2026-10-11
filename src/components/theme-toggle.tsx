"use client"

import { useTheme } from "next-themes"
import { Laptop, Moon, Sun } from "lucide-react"
import { motion } from "framer-motion"
import { useSyncExternalStore } from "react"
import { flushSync } from "react-dom"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

const subscribe = () => () => {}
/** true після гідрації — щоб не було розбіжності SSR/клієнта для теми */
export function useMounted() {
  return useSyncExternalStore(subscribe, () => true, () => false)
}

/**
 * Зміна теми колом від координат кнопки (View Transitions API, 500 мс).
 * Без підтримки API або з prefers-reduced-motion — миттєва зміна.
 */
export function useThemeTransition() {
  const { setTheme } = useTheme()
  return (next: string, origin?: { x: number; y: number }) => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const doc = document as Document & { startViewTransition?: (cb: () => void) => { ready: Promise<void> } }
    if (!doc.startViewTransition || reduce) {
      setTheme(next)
      return
    }
    const x = origin?.x ?? window.innerWidth / 2
    const y = origin?.y ?? 0
    const r = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y))
    const resolved = next === "system" ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : next
    const t = doc.startViewTransition(() => {
      flushSync(() => setTheme(next))
      // next-themes застосовує клас в ефекті — ставимо його синхронно, щоб знімок «після» був правильним
      document.documentElement.classList.remove("light", "dark")
      document.documentElement.classList.add(resolved)
      document.documentElement.style.colorScheme = resolved
    })
    void t.ready.then(() => {
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
        { duration: 500, easing: "cubic-bezier(0.22, 1, 0.36, 1)", pseudoElement: "::view-transition-new(root)" }
      )
    })
  }
}

export function ThemeToggle() {
  const { resolvedTheme } = useTheme()
  const mounted = useMounted()
  const switchTheme = useThemeTransition()
  const isDark = !mounted || resolvedTheme === "dark"

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Перемкнути тему"
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect()
            switchTheme(isDark ? "light" : "dark", { x: r.left + r.width / 2, y: r.top + r.height / 2 })
          }}
        >
          <motion.span
            key={isDark ? "moon" : "sun"}
            initial={{ rotate: -90, opacity: 0, scale: 0.6 }}
            animate={{ rotate: 0, opacity: 1, scale: 1 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="inline-flex"
          >
            {isDark ? <Moon /> : <Sun />}
          </motion.span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>{isDark ? "Світла тема" : "Темна тема"}</TooltipContent>
    </Tooltip>
  )
}

/** Сегментований перемикач теми (як у футері vercel.com) */
export function ThemeSwitcher({ className }: { className?: string }) {
  const { theme } = useTheme()
  const switchTheme = useThemeTransition()
  const mounted = useMounted()
  const options = [
    { value: "system", icon: Laptop, label: "Системна" },
    { value: "light", icon: Sun, label: "Світла" },
    { value: "dark", icon: Moon, label: "Темна" },
  ]
  return (
    <div role="radiogroup" aria-label="Тема" className={cn("inline-flex items-center rounded-full border p-0.5", className)}>
      {options.map((o) => {
        const active = mounted && theme === o.value
        return (
          <button
            key={o.value}
            role="radio"
            aria-checked={active}
            aria-label={o.label}
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect()
              switchTheme(o.value, { x: r.left + r.width / 2, y: r.top + r.height / 2 })
            }}
            className={cn(
              "relative inline-flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground",
              active && "text-foreground"
            )}
          >
            {active && (
              <motion.span
                layoutId="theme-switcher-pill"
                className="absolute inset-0 rounded-full bg-muted ring-1 ring-border"
                transition={{ type: "spring", stiffness: 500, damping: 35 }}
              />
            )}
            <o.icon className="relative size-3.5" />
          </button>
        )
      })}
    </div>
  )
}
