import { pageMeta } from "@/lib/seo"
import Link from "next/link"

export const metadata = pageMeta("Контакти", "Зв'язок із командою Lumyn: загальні питання, підтримка, приватність.", "/contact")

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-3xl items-center px-4">
          <Link href="/" className="flex items-center gap-2 text-sm font-medium">
            <span className="text-lg">✦</span> Lumyn
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-3xl font-semibold">Контакти</h1>
        <ul className="mt-6 space-y-3 text-muted-foreground">
          <li>Загальні питання: <a href="mailto:hello@lumyn.space" className="underline">hello@lumyn.space</a></li>
          <li>Підтримка: <a href="mailto:support@lumyn.space" className="underline">support@lumyn.space</a></li>
          <li>Приватність: <a href="mailto:privacy@lumyn.space" className="underline">privacy@lumyn.space</a></li>
        </ul>
        <div className="mt-8">
          <Link href="/welcome" className="text-sm text-muted-foreground hover:text-foreground">← На головну</Link>
        </div>
      </main>
    </div>
  )
}