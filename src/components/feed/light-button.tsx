"use client"

import { useEffect, useRef, useState } from "react"
import { AnimatePresence, motion, useAnimate, useReducedMotion } from "framer-motion"
import { SparkIcon } from "@/components/icons"
import { formatCount } from "@/lib/format"
import { cn } from "@/lib/utils"

const SPARKS = 8

/**
 * Кнопка «Світло».
 *  • натиск: scale .9; після кліку іконка [1 → 1.15 → 1] пружиною (stiffness 500, damping 15)
 *  • радіальне світіння: scale 0 → 2.2, opacity .6 → 0 за 400 мс
 *  • 8 іскор по колу на 18–24 px, 500 мс, easeOut
 *  • лічильник: AnimatePresence popLayout, y 8 → 0 / 0 → −8, 200 мс
 *  • prefers-reduced-motion → лише прозорість
 */
export function LightButton({
  lit,
  count,
  onToggle,
  size = "md",
  className,
}: {
  lit: boolean
  count: number
  onToggle: () => void
  size?: "md" | "lg"
  className?: string
}) {
  const reduce = useReducedMotion()
  const [scope, animate] = useAnimate<HTMLSpanElement>()
  const [burst, setBurst] = useState(0)
  const prevLit = useRef(lit)

  useEffect(() => {
    if (lit && !prevLit.current && !reduce && scope.current) {
      void animate(scope.current, { scale: 1.15 }, { duration: 0.09, ease: "easeOut" }).then(() =>
        animate(scope.current, { scale: 1 }, { type: "spring", stiffness: 500, damping: 15 })
      )
    }
    prevLit.current = lit
  }, [lit, reduce, animate, scope])

  const icon = size === "lg" ? "size-[20px]" : "size-[18px]"

  return (
    <motion.button
      type="button"
      aria-label={lit ? "Прибрати світло" : "Дати світло"}
      aria-pressed={lit}
      whileTap={reduce ? undefined : { scale: 0.9 }}
      onClick={(e) => {
        e.stopPropagation()
        if (!lit) setBurst((b) => b + 1)
        onToggle()
      }}
      className={cn(
        "group/light -ml-2 inline-flex h-8 items-center gap-1 rounded-full pr-2 outline-none focus-visible:ring-2 focus-visible:ring-ring",
        lit ? "text-glow" : "text-muted-foreground hover:text-glow",
        className
      )}
    >
      <span className="relative inline-flex rounded-full p-1.5 transition-colors group-hover/light:bg-glow/10">
        {/* світіння + іскри — новий ключ на кожне «світло», щоб анімація стартувала заново */}
        <AnimatePresence>
          {burst > 0 && lit && (
            <span key={burst} aria-hidden className="pointer-events-none absolute inset-0">
              <motion.span
                className="absolute inset-0 rounded-full"
                style={{ background: "radial-gradient(circle, var(--glow) 0%, transparent 65%)" }}
                initial={reduce ? { opacity: 0.6 } : { scale: 0, opacity: 0.6 }}
                animate={reduce ? { opacity: 0 } : { scale: 2.2, opacity: 0 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
              />
              {!reduce &&
                Array.from({ length: SPARKS }).map((_, i) => {
                  const angle = (i / SPARKS) * Math.PI * 2 - Math.PI / 2
                  const dist = i % 2 === 0 ? 24 : 18
                  return (
                    <motion.span
                      key={i}
                      className={cn("absolute top-1/2 left-1/2 -mt-[2px] -ml-[2px] rounded-full bg-glow", i % 2 ? "size-[3px]" : "size-1")}
                      initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                      animate={{ x: Math.cos(angle) * dist, y: Math.sin(angle) * dist, opacity: 0, scale: 0.4 }}
                      transition={{ duration: 0.5, ease: "easeOut" }}
                    />
                  )
                })}
            </span>
          )}
        </AnimatePresence>
        <span ref={scope} className="relative block">
          <SparkIcon filled={lit} className={cn(icon, lit && "drop-shadow-[0_0_6px_var(--glow)]")} />
        </span>
      </span>
      <span className="relative inline-flex h-4 min-w-[1ch] overflow-hidden text-[13px] tabular">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={count}
            initial={reduce ? { opacity: 0 } : { y: 8, opacity: 0 }}
            animate={reduce ? { opacity: 1 } : { y: 0, opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { y: -8, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="leading-4"
          >
            {count > 0 ? formatCount(count) : ""}
          </motion.span>
        </AnimatePresence>
      </span>
    </motion.button>
  )
}
