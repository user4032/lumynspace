"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { motion } from "framer-motion"
import { Palette, Shield } from "lucide-react"
import { CloseFriendsIcon } from "@/components/icons"
import { cn } from "@/lib/utils"

export const SETTINGS_NAV = [
  { href: "/settings", label: "Профіль і стиль", icon: Palette },
  { href: "/settings/privacy", label: "Приватність і безпека", icon: Shield },
  { href: "/settings/close-friends", label: "Близькі друзі", icon: CloseFriendsIcon },
] as const

export function SettingsNav() {
  const pathname = usePathname()
  return (
    <nav aria-label="Розділи налаштувань" className="no-scrollbar -mx-4 flex gap-1 overflow-x-auto px-4 md:sticky md:top-20 md:mx-0 md:h-fit md:flex-col md:gap-0.5 md:px-0">
      {SETTINGS_NAV.map((s) => {
        const active = pathname === s.href
        const Icon = s.icon
        return (
          <Link
            key={s.href}
            href={s.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex shrink-0 items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors",
              active ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {active && (
              <motion.span
                layoutId="settings-nav"
                transition={{ type: "spring", stiffness: 500, damping: 40 }}
                className="absolute inset-0 rounded-md bg-muted"
              />
            )}
            <Icon className="relative size-4" />
            <span className="relative">{s.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}

/** Сегментований перемикач у стилі Vercel */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  id,
  className,
}: {
  value: T
  options: { value: T; label: string; disabled?: boolean; hint?: string }[]
  onChange: (v: T) => void
  id: string
  className?: string
}) {
  return (
    <div role="radiogroup" className={cn("inline-flex flex-wrap gap-0.5 rounded-lg border bg-subtle p-0.5", className)}>
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={o.disabled}
            title={o.hint}
            onClick={() => onChange(o.value)}
            className={cn(
              "relative rounded-md px-3 py-1 text-[13px] transition-colors disabled:cursor-not-allowed disabled:opacity-40",
              active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {active && (
              <motion.span
                layoutId={`seg-${id}`}
                transition={{ type: "spring", stiffness: 500, damping: 38 }}
                className="absolute inset-0 rounded-md bg-background shadow-sm ring-1 ring-border"
              />
            )}
            <span className="relative">{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}
