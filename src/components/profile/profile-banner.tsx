"use client"

import Image from "next/image"
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion"
import type { BannerStyle } from "@/types"
import { cn } from "@/lib/utils"

/** Плями для «Аврори»: позиція, розмір, траєкторія, затримка */
const BLOBS = [
  { cls: "left-[-10%] top-[-40%] h-[130%] w-[60%]", dx: "80px", dy: "30px", s: 1.2, delay: "0s", color: "var(--accent-user)" },
  { cls: "right-[-8%] top-[-30%] h-[110%] w-[50%]", dx: "-90px", dy: "40px", s: 1.3, delay: "-6s", color: "oklch(from var(--accent-user) calc(l + 0.08) c calc(h + 45))" },
  { cls: "left-[28%] bottom-[-60%] h-[120%] w-[55%]", dx: "60px", dy: "-40px", s: 1.15, delay: "-12s", color: "oklch(from var(--accent-user) calc(l - 0.05) c calc(h - 35))" },
  { cls: "right-[22%] top-[10%] h-[70%] w-[30%]", dx: "-50px", dy: "-30px", s: 1.4, delay: "-3s", color: "color-mix(in oklab, var(--accent-user) 55%, #ffffff)" },
]

/** Фон банера в акценті користувача (без зовнішніх картинок, окрім стилю «image») */
export function BannerArt({ style, coverUrl, className }: { style: BannerStyle; coverUrl?: string | null; className?: string }) {
  return (
    <div className={cn("absolute inset-0 overflow-hidden bg-[color-mix(in_oklab,var(--accent-user)_16%,var(--background))]", className)}>
      {style === "aurora" &&
        BLOBS.map((b, i) => (
          <span
            key={i}
            className={cn("blob absolute rounded-full blur-2xl", b.cls)}
            style={
              {
                "--dx": b.dx,
                "--dy": b.dy,
                "--s": b.s,
                animationDelay: b.delay,
                background: `radial-gradient(closest-side, ${b.color}, transparent)`,
                opacity: 0.95,
              } as React.CSSProperties
            }
          />
        ))}
      {style === "mesh" && (
        <div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(at 15% 20%, color-mix(in oklab, var(--accent-user) 85%, transparent) 0, transparent 45%),
              radial-gradient(at 85% 10%, color-mix(in oklab, var(--accent-user) 45%, #ffffff) 0, transparent 40%),
              radial-gradient(at 70% 90%, color-mix(in oklab, var(--accent-user) 70%, #000000) 0, transparent 50%),
              radial-gradient(at 30% 100%, color-mix(in oklab, var(--accent-user) 35%, transparent) 0, transparent 45%)`,
          }}
        />
      )}
      {style === "grid" && (
        <>
          <div className="absolute inset-0 bg-grid opacity-70 [mask-image:radial-gradient(ellipse_at_50%_100%,black_20%,transparent_75%)]" />
          <span
            className="blob absolute bottom-[-60%] left-1/2 h-[120%] w-[80%] -translate-x-1/2 rounded-full blur-3xl"
            style={{ background: "radial-gradient(closest-side, var(--accent-user), transparent)", opacity: 0.55 } as React.CSSProperties}
          />
        </>
      )}
      {style === "solid" && (
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(135deg, var(--accent-user), color-mix(in oklab, var(--accent-user) 40%, #000))" }}
        />
      )}
      {style === "image" && coverUrl && <Image src={coverUrl} alt="" fill priority sizes="640px" className="object-cover" />}
      {/* легке зерно, щоб градієнти не «бандували» */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.12] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />
    </div>
  )
}

/** Банер профілю з паралаксом: y 0 → −40 px, opacity 1 → .6 при прокручуванні */
export function ProfileBanner({ style, coverUrl, children }: { style: BannerStyle; coverUrl?: string | null; children?: React.ReactNode }) {
  const reduce = useReducedMotion()
  const { scrollY } = useScroll()
  const y = useTransform(scrollY, [0, 240], [0, -40])
  const opacity = useTransform(scrollY, [0, 240], [1, 0.6])

  return (
    <div className="relative h-[180px] overflow-hidden border-b sm:h-[210px]">
      <motion.div className="absolute inset-0 -bottom-10" style={reduce ? { opacity } : { y, opacity }}>
        <BannerArt style={style} coverUrl={coverUrl} />
      </motion.div>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/50 via-transparent to-transparent" />
      {children}
    </div>
  )
}
