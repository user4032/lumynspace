"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Logo } from "@/components/logo"
import { ThemeSwitcher, useMounted } from "@/components/theme-toggle"
import { cn } from "@/lib/utils"

const PAGES = [
  { href: "/about", label: "Про нас" },
  { href: "/guidelines", label: "Правила" },
  { href: "/terms", label: "Умови" },
  { href: "/privacy", label: "Приватність" },
  { href: "/contact", label: "Контакти" },
]

const FOOTER = [
  {
    title: "Продукт",
    links: [
      { href: "/welcome", label: "Почати" },
      { href: "/about", label: "Про нас" },
      { href: "/login", label: "Увійти" },
    ],
  },
  {
    title: "Норми",
    links: [
      { href: "/guidelines", label: "Правила спільноти" },
      { href: "/terms", label: "Умови використання" },
      { href: "/privacy", label: "Конфіденційність" },
    ],
  },
  {
    title: "Зв'язок",
    links: [
      { href: "/contact", label: "Контакти" },
      { href: "mailto:support@lumyn.space", label: "Підтримка" },
      { href: "mailto:privacy@lumyn.space", label: "Приватність" },
    ],
  },
]

/** Спільна оболонка інформаційних сторінок: хедер-табси + футер. */
export function LegalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const mounted = useMounted()
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-5">
          <Link href="/" aria-label="Lumyn — на головну" className="shrink-0">
            <Logo />
          </Link>
          <nav aria-label="Інформаційні сторінки" className="-mx-2 hidden items-center gap-1 sm:flex">
            {PAGES.map((p) => {
              const active = pathname === p.href
              return (
                <Link
                  key={p.href}
                  href={p.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors",
                    active ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  )}
                >
                  {p.label}
                </Link>
              )
            })}
          </nav>
          <ThemeSwitcher />
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-border/60">
        <div className="mx-auto grid max-w-5xl gap-8 px-5 py-12 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Logo />
            <p className="mt-3 max-w-56 text-[13px] leading-relaxed text-muted-foreground">
              Спокійна соцмережа, зроблена в Україні. Світло замість лайків, ви замість алгоритму.
            </p>
          </div>
          {FOOTER.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <p className="text-[13px] font-semibold">{col.title}</p>
              <ul className="mt-3 space-y-2">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link href={l.href} className="text-[13px] text-muted-foreground transition-colors hover:text-foreground">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="border-t border-border/60">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-5 py-4 text-xs text-muted-foreground">
            <span>© {mounted ? new Date().getFullYear() : 2026} Lumyn. Усі права захищено.</span>
            <span>Зроблено в Хмельницькому 🇺🇦</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
