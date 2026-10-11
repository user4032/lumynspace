import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Logo } from "@/components/logo"
import { ThemeSwitcher } from "@/components/theme-toggle"
import { Showcase } from "@/components/design/showcase"

export const metadata: Metadata = { title: "Дизайн-система" }

export default function DesignPage() {
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-40 border-b bg-background/75 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <Link href="/" aria-label="Назад" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="size-4" />
            </Link>
            <Logo />
            <span className="text-muted-foreground">/</span>
            <span className="text-sm font-medium">Дизайн-система</span>
          </div>
          <ThemeSwitcher />
        </div>
      </header>

      <div className="mx-auto max-w-[1400px] px-6 py-10">
        <p className="font-mono text-xs tracking-wider text-muted-foreground uppercase">Lumyn UI · v0.1</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">Дизайн-система</h1>
        <p className="mt-3 max-w-2xl text-[17px] leading-relaxed text-muted-foreground">
          Чорний фон, тонкі рамки 1px, Geist і один акцентний колір. Компоненти побудовані на shadcn/ui та Radix,
          анімації — Framer Motion. Нижче кожен компонент у світлій і темній темі одночасно.
        </p>

        <div className="mt-10 grid overflow-hidden rounded-xl border xl:grid-cols-2">
          <div className="xl:border-r">
            <Showcase mode="light" />
          </div>
          <div className="max-xl:border-t">
            <Showcase mode="dark" />
          </div>
        </div>
      </div>
    </div>
  )
}
