import { CalendarDays } from "lucide-react"
import { LegalShell } from "@/components/legal-shell"
import { LegalToc } from "@/components/legal-toc"

/** Лейаут юридичних сторінок: hero + sticky зміст + читабельна типографіка. */
export function LegalPage({
  title,
  updated,
  intro,
  children,
}: {
  title: string
  updated: string
  /** один-два речення над змістом — що тут і для чого */
  intro?: string
  children: React.ReactNode
}) {
  return (
    <LegalShell>
      <div className="mx-auto max-w-5xl px-5 py-12 sm:py-16">
        <header className="max-w-2xl">
          <h1 className="text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">{title}</h1>
          <p className="mt-2.5 inline-flex items-center gap-1.5 rounded-full border bg-subtle/60 px-3 py-1 text-xs text-muted-foreground">
            <CalendarDays className="size-3.5" />
            Оновлено {updated}
          </p>
          {intro && <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">{intro}</p>}
        </header>

        <div className="mt-10 grid gap-10 lg:grid-cols-[220px_minmax(0,1fr)]">
          <LegalToc />
          <div
            data-legal-content
            className="group max-w-2xl text-[15px] leading-7 text-foreground/80
              [&_h2]:mb-3 [&_h2]:mt-12 [&_h2]:scroll-mt-20 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-foreground
              [&_p]:mb-4
              [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5
              [&_strong]:font-medium [&_strong]:text-foreground
              [&_a]:text-foreground [&_a]:underline [&_a]:decoration-border [&_a]:underline-offset-4 [&_a:hover]:decoration-foreground
              [&_h2:first-child]:mt-0"
          >
            {children}
          </div>
        </div>
      </div>
    </LegalShell>
  )
}
