import { AlertTriangle, LifeBuoy, Lock, Mail, Megaphone } from "lucide-react"
import { pageMeta } from "@/lib/seo"
import { LegalShell } from "@/components/legal-shell"

export const metadata = pageMeta(
  "Контакти",
  "Як зв'язатися з командою Lumyn: підтримка, приватність, безпека, пресса.",
  "/contact"
)

function TelegramIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z" />
    </svg>
  )
}

const CHANNELS = [
  {
    icon: LifeBuoy,
    title: "Підтримка",
    desc: "Проблеми з акаунтом, скарги, апеляції рішень модератора.",
    mail: "support@lumyn.space",
    eta: "відповідаємо до 72 годин",
  },
  {
    icon: Lock,
    title: "Приватність",
    desc: "Запити щодо ваших даних: копія, виправлення, видалення (GDPR/ст. 12 ЗУ «Про захист персональних даних»).",
    mail: "privacy@lumyn.space",
    eta: "до 30 днів, як вимагає закон",
  },
  {
    icon: AlertTriangle,
    title: "Безпека",
    desc: "Знайшли ваду в безпеці? Пишіть сюди, не публічно — розглянемо і подякуємо в responsible disclosure.",
    mail: "security@lumyn.space",
    eta: "перша відповідь до 48 годин",
  },
  {
    icon: Megaphone,
    title: "Пресса і співпраця",
    desc: "Коментарі, інтерв'ю, партнерства — загальні питання також сюди.",
    mail: "hello@lumyn.space",
    eta: "зазвичай того ж дня",
  },
]

export default function ContactPage() {
  return (
    <LegalShell>
      <div className="mx-auto max-w-5xl px-5 py-12 sm:py-16">
        <header className="max-w-2xl">
          <h1 className="text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">Контакти</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
            Листи читають люди, а не боти. Оберіть тему — і потрапите точно до тієї людини, яка
            вирішить ваше питання.
          </p>
        </header>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {CHANNELS.map((c) => (
            <a
              key={c.title}
              href={`mailto:${c.mail}`}
              className="group rounded-2xl border bg-subtle/40 p-5 transition-colors hover:bg-subtle/70"
            >
              <div className="flex items-center justify-between">
                <span className="grid size-10 place-items-center rounded-xl border bg-background">
                  <c.icon className="size-5 text-brand" />
                </span>
                <Mail className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
              <h2 className="mt-4 text-[15px] font-semibold">{c.title}</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{c.desc}</p>
              <p className="mt-3 font-mono text-[13px] text-foreground">{c.mail}</p>
              <p className="mt-1 text-xs text-muted-foreground">{c.eta}</p>
            </a>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-3 rounded-2xl border bg-background p-5">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl border bg-subtle">
            <TelegramIcon className="size-5 text-brand" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Швидше в Telegram</p>
            <p className="text-sm text-muted-foreground">Для термінових питань безпеки й модерації.</p>
          </div>
          <a
            href="https://t.me/d4nys"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
          >
            @d4nys
          </a>
        </div>
      </div>
    </LegalShell>
  )
}
