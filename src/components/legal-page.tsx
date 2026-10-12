import Link from "next/link"

export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string
  updated: string
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-5">
          <Link href="/" className="flex items-center gap-2 text-sm font-medium">
            <span className="text-base">✦</span>
            <span>Lumyn</span>
          </Link>
          <nav className="flex gap-4 text-sm text-muted-foreground">
            <Link href="/terms" className="hover:text-foreground">Умови</Link>
            <Link href="/privacy" className="hover:text-foreground">Конфіденційність</Link>
            <Link href="/guidelines" className="hover:text-foreground">Правила</Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-5 pb-24 pt-12 sm:pt-16">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
        <p className="mt-3 text-sm text-muted-foreground">Останнє оновлення: {updated}</p>

        <div
          className="mt-10 text-[15px] leading-7 text-foreground/80 sm:text-base sm:leading-8
            [&_h2]:mb-3 [&_h2]:mt-12 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-foreground
            [&_p]:mb-4
            [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5
            [&_strong]:font-medium [&_strong]:text-foreground
            [&_a]:text-foreground [&_a]:underline [&_a]:decoration-border [&_a]:underline-offset-4 [&_a:hover]:decoration-foreground"
        >
          {children}
        </div>

        <div className="mt-16 border-t border-border/60 pt-6 text-sm">
          <Link href="/welcome" className="text-muted-foreground hover:text-foreground">
            ← На головну
          </Link>
        </div>
      </main>
    </div>
  )
}