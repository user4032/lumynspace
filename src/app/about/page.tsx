import Link from "next/link"
import { ArrowRight, Compass, Eye, HeartHandshake, ShieldCheck } from "lucide-react"
import { pageMeta } from "@/lib/seo"
import { LegalShell } from "@/components/legal-shell"
import { SparkIcon } from "@/components/icons"
import { Button } from "@/components/ui/button"

export const metadata = pageMeta("Про нас", "Lumyn — спокійна українська соцмережа: світло замість лайків, стрічка без алгоритмів-маніпуляцій.", "/about")

const PRINCIPLES = [
  {
    icon: SparkIcon,
    title: "Світло замість лайків",
    text: "Допис живе 24 години. Кожне світло додає годину життя, 25 світлів — і він лишається назавжди. Ділишся тим, що справді варте уваги.",
  },
  {
    icon: Compass,
    title: "Стрічка з кермом",
    text: "Два повзунки — «друзі чи нове» та «текст чи медіа» — замість чорного ящика. Вкладка «Підписки» — чиста хронологія без вставок.",
  },
  {
    icon: ShieldCheck,
    title: "Приватність за замовчуванням",
    text: "Мінімум даних, ніякого продажу третім сторонам, жодних трекерів. Кола, близькі друзі, приватні акаунти — від першого дня.",
  },
  {
    icon: HeartHandshake,
    title: "Без темних патернів",
    text: "Немає стріків, немає фейкових сповіщень, немає нескінченної стрічки «лише ще одна». Повага до вашої уваги — частина продукту.",
  },
]

export default function AboutPage() {
  return (
    <LegalShell>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border/60">
        <div
          aria-hidden
          className="pointer-events-none absolute top-[-40%] left-1/2 h-[480px] w-[820px] -translate-x-1/2 rounded-full opacity-25 blur-3xl"
          style={{ background: "radial-gradient(closest-side, var(--brand), transparent)" }}
        />
        <div className="relative mx-auto max-w-3xl px-5 py-20 text-center sm:py-28">
          <span className="inline-flex items-center gap-1.5 rounded-full border bg-subtle/60 px-3 py-1 text-xs font-medium">
            <SparkIcon filled className="size-3.5" />
            Українська соцмережа
          </span>
          <h1 className="mt-5 text-4xl leading-[1.05] font-semibold tracking-[-0.04em] sm:text-[56px]">
            Соцмережа, яка не кричить
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-[17px] leading-relaxed text-muted-foreground">
            Lumyn — місце, де дописи живуть, доки ними діляться, а стрічку налаштовуєте ви, а не
            алгоритм. Робимо спокійну альтернативу — тут, в Україні, без продажу даних і уваги.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg" className="rounded-full px-6">
              <Link href="/welcome">
                Спробувати Lumyn <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="rounded-full px-6">
              <Link href="/guidelines">Наші правила</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Принципи */}
      <section className="mx-auto max-w-5xl px-5 py-16 sm:py-20">
        <h2 className="text-2xl font-semibold tracking-[-0.03em]">У що ми віримо</h2>
        <p className="mt-2 max-w-xl text-[15px] text-muted-foreground">
          Чотири рішення, які відрізняють Lumyn від усього, до чого ви звикли.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {PRINCIPLES.map((p) => (
            <div key={p.title} className="rounded-2xl border bg-subtle/40 p-5 transition-colors hover:bg-subtle/70">
              <span className="grid size-10 place-items-center rounded-xl border bg-background">
                <p.icon className="size-5 text-brand" />
              </span>
              <h3 className="mt-4 text-[15px] font-semibold">{p.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{p.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Хто ми */}
      <section className="border-t border-border/60 bg-subtle/30">
        <div className="mx-auto grid max-w-5xl gap-10 px-5 py-16 sm:py-20 lg:grid-cols-[1fr_320px]">
          <div>
            <h2 className="text-2xl font-semibold tracking-[-0.03em]">Хто стоїть за проєктом</h2>
            <div className="mt-4 max-w-xl space-y-4 text-[15px] leading-relaxed text-muted-foreground">
              <p>
                Lumyn — незалежний проєкт, зроблений в Україні без венчурного капіталу і без
                «зростання будь-якою ціною». Юридичну особу реєструємо — як тільки це станеться,
                оновимо цю сторінку і реквізити в <Link href="/terms" className="text-foreground underline underline-offset-4">Умовах</Link>.
              </p>
              <p>
                Ми маленькі — і це наша перевага: кожна скарга і кожен лист читає людина, а не
                скрипт. Пишіть нам: гарні ідеї чуємо, погані — визнаємо.
              </p>
            </div>
          </div>
          <div className="h-fit rounded-2xl border bg-background p-5">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Eye className="size-4 text-brand" /> Наші зобов&apos;язання
            </p>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed text-muted-foreground">
              <li>Не продаємо й не передаємо ваші дані.</li>
              <li>Не використовуємо контент для тренування моделей без згоди.</li>
              <li>Не додаємо рекламні трекери — ніколи.</li>
              <li>Даємо видалити акаунт і дані в один клік.</li>
            </ul>
          </div>
        </div>
      </section>
    </LegalShell>
  )
}
