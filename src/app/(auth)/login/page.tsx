import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"
import { ArrowRight, Info } from "lucide-react"
import { LogoMark } from "@/components/logo"
import { EmailAuthForm } from "@/components/auth/email-form"
import { OAuthButtons } from "@/components/oauth-buttons"
import { ThemeSwitcher } from "@/components/theme-toggle"
import { isSupabaseConfigured } from "@/lib/env"

export const metadata: Metadata = { title: "Вхід" }

export default function LoginPage() {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden">
      {/* Фон: сітка + світіння */}
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-grid mask-radial opacity-60" />
      <div
        aria-hidden
        className="pointer-events-none absolute top-[-20%] left-1/2 h-[560px] w-[860px] -translate-x-1/2 rounded-full opacity-30 blur-3xl dark:opacity-25"
        style={{ background: "radial-gradient(closest-side, var(--brand), transparent)" }}
      />

      <header className="relative flex h-16 items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2 text-[17px] leading-none font-semibold tracking-[-0.03em]">
          <LogoMark /> Lumyn
        </Link>
        <ThemeSwitcher />
      </header>

      <main className="relative flex flex-1 items-center justify-center px-4 pb-16">
        <div className="w-full max-w-[380px]">
          <div className="flex flex-col items-center text-center">
            <span className="relative inline-flex size-14 items-center justify-center rounded-2xl border bg-background shadow-[0_0_0_6px_color-mix(in_oklab,var(--foreground)_4%,transparent)]">
              <LogoMark className="size-7" />
            </span>
            <h1 className="mt-6 text-[28px] leading-tight font-semibold tracking-[-0.04em]">Увійти в Lumyn</h1>
            <p className="mt-2 text-[15px] text-balance text-muted-foreground">
              Соцмережа для тих, хто будує. Стрічка, спільноти й розмови — в одному місці.
            </p>
          </div>

          <div className="mt-8">
            <Suspense>
              <EmailAuthForm />
            </Suspense>
          </div>

          <div className="my-6 flex items-center gap-3" aria-hidden>
            <span className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">або</span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <OAuthButtons />

          {!isSupabaseConfigured && (
            <div className="mt-5 rounded-lg border border-dashed bg-subtle/80 p-3.5 text-sm backdrop-blur">
              <p className="flex items-center gap-2 font-medium">
                <Info className="size-4 text-brand" /> Вхід вимкнено: Supabase не налаштовано
              </p>
              <p className="mt-1.5 leading-relaxed text-muted-foreground">
                Додайте <code className="rounded bg-muted px-1 py-0.5 font-mono text-[12px] text-foreground">NEXT_PUBLIC_SUPABASE_URL</code> і{" "}
                <code className="rounded bg-muted px-1 py-0.5 font-mono text-[12px] text-foreground">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> у{" "}
                <code className="font-mono text-[12px] text-foreground">.env.local</code>.
              </p>
              <Link href="/" className="mt-3 inline-flex items-center gap-1 font-medium text-foreground hover:underline">
                Відкрити демо з мок-даними <ArrowRight className="size-3.5" />
              </Link>
            </div>
          )}

          <p className="mt-8 text-center text-xs leading-relaxed text-balance text-muted-foreground">
            Продовжуючи, ви погоджуєтеся з <Link href="/terms" className="text-foreground underline underline-offset-2">Умовами</Link> та{" "}
            <Link href="/privacy" className="text-foreground underline underline-offset-2">Політикою конфіденційності</Link>.
          </p>
        </div>
      </main>
    </div>
  )
}
