"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { motion, useReducedMotion } from "framer-motion"
import { ArrowRight, Check, Loader2, Timer, X } from "lucide-react"
import { Logo } from "@/components/logo"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SparkIcon } from "@/components/icons"
import { LightButton } from "@/components/feed/light-button"
import { Slider } from "@/components/ui/slider"
import { BannerArt } from "@/components/profile/profile-banner"
import { checkHandle, reserveHandle } from "@/lib/actions/viewer"
import { cn } from "@/lib/utils"

const HANDLE_RE = /^[a-z0-9_]{3,24}$/

function SectionLabel({ n, children }: { n: string; children: React.ReactNode }) {
  return (
    <p className="font-mono text-xs text-brand">
      {n} · {children}
    </p>
  )
}

/** Жива міні-картка: світло додає годину життя */
function GlowDemo() {
  const [lights, setLights] = useState(6)
  const [lit, setLit] = useState(false)
  const life = Math.min(1, (24 + lights) / 72)
  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="flex items-center justify-between text-xs">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-glow/15 px-2 py-0.5 font-medium text-glow">
          <SparkIcon filled className="size-3" /> Світло
        </span>
        <span className="inline-flex items-center gap-1 font-mono text-muted-foreground">
          <Timer className="size-3" /> ще {24 + lights} год
        </span>
      </div>
      <p className="mt-3 text-[15px] leading-relaxed">
        Допис живе добу. Кожне світло додає годину — аж до 72. На 25 світлах лишається назавжди.
      </p>
      <div className="mt-3 h-1 overflow-hidden rounded-full bg-muted">
        <motion.div className="h-full rounded-full bg-glow" animate={{ width: `${life * 100}%` }} transition={{ type: "spring", stiffness: 200, damping: 25 }} />
      </div>
      <div className="mt-3 flex items-center gap-3 text-muted-foreground">
        <LightButton
          lit={lit}
          count={lights}
          onToggle={() => {
            setLit((v) => !v)
            setLights((n) => (lit ? n - 1 : n + 1))
          }}
        />
        <span className="text-xs">натисніть — допис поживе довше</span>
      </div>
    </div>
  )
}

/** Міні-тюнер: рухаєш повзунок — міняється склад стрічки */
function TunerDemo() {
  const [social, setSocial] = useState(0.5)
  const friends = Math.round(85 - social * 70)
  const recs = 100 - friends
  return (
    <div className="rounded-2xl border bg-card p-4">
      <p className="text-sm font-medium">Стрічка, яку крутите ви</p>
      <div className="mt-4 flex items-center gap-3 text-xs text-muted-foreground">
        <span className={cn(social < 0.5 && "text-foreground")}>друзі</span>
        <Slider value={[social]} min={0} max={1} step={0.01} onValueChange={([v]) => setSocial(v)} aria-label="Друзі чи рекомендації" className="flex-1" />
        <span className={cn(social > 0.5 && "text-foreground")}>нове</span>
      </div>
      <div className="mt-4 flex h-8 overflow-hidden rounded-full text-[11px] font-medium">
        <motion.div className="flex items-center justify-center bg-foreground text-background" animate={{ width: `${friends}%` }} transition={{ type: "spring", stiffness: 260, damping: 30 }}>
          друзі {friends}%
        </motion.div>
        <motion.div className="flex items-center justify-center bg-brand text-brand-foreground" animate={{ width: `${recs}%` }} transition={{ type: "spring", stiffness: 260, damping: 30 }}>
          нове {recs}%
        </motion.div>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Другий повзунок — текст чи медіа. І кожен допис каже, чому він тут.</p>
    </div>
  )
}

const HERO = [
  { name: "Олена", handle: "olena", hue: "#ff3d81", text: "зібрала токени кольорів — інтерфейс одразу став спокійнішим", life: 0.9, lights: 24, hours: "ще 47 год", rot: -7, x: -250, y: 34 },
  { name: "Максим", handle: "maksym_dev", hue: "#3b8eff", text: "ще одне світло — і цей допис лишиться назавжди", life: 1, lights: 24, hours: "майже назавжди", rot: 0, x: 0, y: 0 },
  { name: "Софія", handle: "sofia.codes", hue: "#2dd4bf", text: "о 3 ночі нарешті зрозуміла рекурсію. ділюся, поки не забула", life: 0.25, lights: 3, hours: "ще 6 год", rot: 7, x: 250, y: 40 },
]

/** Віяло з трьох карток під героєм: різний «вік» світла */
function HeroCards() {
  const reduce = useReducedMotion()
  const [lit, setLit] = useState(false)
  return (
    <div aria-hidden={false} className="relative mx-auto mt-16 hidden h-[260px] max-w-4xl md:block">
      {HERO.map((c, i) => (
        <motion.div
          key={c.handle}
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 40, rotate: 0, x: 0 }}
          animate={{ opacity: 1, y: c.y, rotate: c.rot, x: c.x }}
          transition={{ delay: 0.25 + i * 0.08, type: "spring", stiffness: 120, damping: 18 }}
          className={cn(
            "absolute top-0 left-1/2 w-[300px] -ml-[150px] rounded-2xl border bg-card/90 p-4 shadow-2xl backdrop-blur",
            i === 1 ? "z-10" : "z-0"
          )}
          style={{ ["--life" as string]: c.life }}
        >
          <div className="flex items-center gap-2.5">
            <span className="size-8 rounded-full" style={{ background: `linear-gradient(135deg, ${c.hue}, color-mix(in oklab, ${c.hue} 40%, #000))` }} />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold leading-tight">{c.name}</span>
              <span className="block text-xs text-muted-foreground">@{c.handle}</span>
            </span>
            <span className="font-mono text-[10px] text-glow">{c.hours}</span>
          </div>
          <p className="glow-fade mt-3 text-left text-sm leading-relaxed">{c.text}</p>
          <div className="mt-3 h-0.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-glow" style={{ width: `${c.life * 100}%`, opacity: 0.4 + c.life * 0.6 }} />
          </div>
          <div className="mt-2 flex items-center text-muted-foreground">
            {i === 1 ? (
              <LightButton lit={lit} count={c.lights + (lit ? 1 : 0)} onToggle={() => setLit((v) => !v)} />
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2 py-1 text-xs"><SparkIcon className="size-3.5" /> {c.lights}</span>
            )}
            {i === 1 && <span className="ml-auto text-[11px]">{lit ? "назавжди" : "натисніть ↑"}</span>}
          </div>
        </motion.div>
      ))}
    </div>
  )
}

function Waitlist() {
  const [handle, setHandle] = useState("")
  const [email, setEmail] = useState("")
  const [state, setState] = useState<"idle" | "checking" | "free" | "taken" | "bad">("idle")
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const checkId = useRef(0)

  useEffect(() => {
    const h = handle.trim().toLowerCase()
    const id = ++checkId.current
    if (!h || !HANDLE_RE.test(h)) {
      const t = setTimeout(() => id === checkId.current && setState(h ? "bad" : "idle"), 0)
      return () => clearTimeout(t)
    }
    const t0 = setTimeout(() => id === checkId.current && setState("checking"), 0)
    const t = setTimeout(async () => {
      setError(null)
      const res = await checkHandle(h, { forReservation: true })
      if (id !== checkId.current) return
      if (res.ok && res.data?.reservedByMe) {
        setState("taken")
        setError("Цей нік уже заброньовано на вашу пошту")
      } else {
        setState(res.ok && res.data?.available ? "free" : "taken")
      }
    }, 350)
    return () => {
      clearTimeout(t0)
      clearTimeout(t)
    }
  }, [handle])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    const res = await reserveHandle(handle, email)
    setBusy(false)
    if (res.ok) setDone(true)
    else setError(res.error ?? "Не вдалося")
  }

  if (done) {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border bg-card p-6 text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-close text-black">
          <Check className="size-5" />
        </span>
        <h3 className="mt-4 text-lg font-semibold tracking-tight">@{handle.toLowerCase()} заброньовано</h3>
        <p className="mt-1.5 text-sm text-muted-foreground">Напишемо на {email}, щойно відкриємо двері. Код від друга теж підійде — і швидше.</p>
        <Button asChild className="mt-5 rounded-full">
          <Link href="/onboarding">
            У мене вже є код <ArrowRight />
          </Link>
        </Button>
      </motion.div>
    )
  }

  return (
    <form id="waitlist" onSubmit={submit} className="rounded-2xl border bg-card p-6">
      <SectionLabel n="03">Забронюйте нік</SectionLabel>
      <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em]">Поки за запрошеннями. Нік — уже ваш.</h2>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="relative">
          <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">@</span>
          <Input
            required
            value={handle}
            maxLength={24}
            onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
            placeholder="ваш_нік"
            aria-label="Нік"
            className="h-11 pl-8 font-mono"
          />
          <span className="absolute top-1/2 right-3 -translate-y-1/2">
            {state === "checking" && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
            {state === "free" && <Check className="size-4 text-close" />}
            {(state === "taken" || state === "bad") && <X className="size-4 text-destructive" />}
          </span>
        </div>
        <Input
          required
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="пошта"
          aria-label="Пошта"
          className="h-11"
        />
      </div>
      <p className={cn("mt-2 h-4 text-xs", state === "taken" || state === "bad" ? "text-destructive" : "text-muted-foreground")}>
        {state === "free" && "вільно"}
        {state === "taken" && "цей нік уже зайнятий"}
        {state === "bad" && "3–24 символи: латиниця, цифри, _"}
      </p>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" size="lg" disabled={busy || state !== "free"} className="mt-2 w-full rounded-full sm:w-auto">
        Забронювати {busy ? <Loader2 className="animate-spin" /> : <ArrowRight />}
      </Button>
    </form>
  )
}

export function LandingView() {
  const reduce = useReducedMotion()

  return (
    <div className="relative min-h-dvh">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b bg-background/70 px-5 py-3 backdrop-blur-xl sm:px-8">
        <Logo />
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/onboarding">У мене є код</Link>
          </Button>
          <Button size="sm" className="rounded-full" asChild>
            <a href="#waitlist">Забронювати нік</a>
          </Button>
        </div>
      </header>

      <section className="relative overflow-hidden px-5 pt-20 pb-16 sm:px-8 sm:pt-28">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-32 -z-10 h-[480px] opacity-70">
          <BannerArt style="aurora" className="bg-transparent [mask-image:radial-gradient(ellipse_at_50%_30%,black_20%,transparent_70%)]" />
        </div>
        <motion.div initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }} className="mx-auto max-w-3xl text-center">
          <p className="inline-flex items-center gap-2 rounded-full border bg-background/60 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
            <span className="breathe size-1.5 rounded-full bg-glow" /> за запрошеннями · з 16 років
          </p>
          <h1 className="mt-6 bg-gradient-to-b from-foreground via-foreground to-foreground/55 bg-clip-text pb-1 text-5xl leading-[1.02] font-semibold tracking-[-0.045em] text-transparent sm:text-7xl">
            Соцмережа,
            <br />
            яка не кричить.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground">
            Замість лайків — світло. Допис живе, доки ним діляться. Стрічку налаштовуєте ви, а не алгоритм, якому вигідно, щоб ви не спали.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button size="lg" className="rounded-full px-6 shadow-[0_0_50px_-10px_var(--brand)]" asChild>
              <a href="#waitlist">
                Забронювати нік <ArrowRight />
              </a>
            </Button>
            <Button size="lg" variant="secondary" className="rounded-full px-6" asChild>
              <Link href="/onboarding">Увійти з кодом</Link>
            </Button>
          </div>
        </motion.div>
        <HeroCards />
      </section>

      <section className="mx-auto grid max-w-5xl gap-4 px-5 pb-20 sm:px-8 md:grid-cols-3">
        {[
          { n: "01", title: "Світло замість лайків", body: "Нескінченний лічильник нічого не каже. Світло дає допису час — і згасає разом із ним." },
          { n: "02", title: "Стрічка з кермом", body: "Два повзунки: друзі чи нове, текст чи медіа. Кожна картка пояснює, чому ви її бачите." },
          { n: "03", title: "Без темних патернів", body: "Жодних стріків, «вас давно не було» і фейкових сповіщень. Тиша — теж дизайн." },
        ].map((f, i) => (
          <motion.div
            key={f.n}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.06, duration: 0.4 }}
            className="rounded-2xl border bg-card/50 p-5"
          >
            <SectionLabel n={f.n}>{f.title}</SectionLabel>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
          </motion.div>
        ))}
      </section>

      <section className="mx-auto grid max-w-5xl items-center gap-10 px-5 pb-20 sm:px-8 lg:grid-cols-2">
        <div>
          <SectionLabel n="01">Світло</SectionLabel>
          <h2 className="mt-2 text-3xl font-semibold tracking-[-0.03em]">Допис, який дихає</h2>
          <p className="mt-3 text-muted-foreground">
            24 години життя. Кожне світло — плюс година, стеля 72. Двадцять п&apos;ять — і допис лишається назавжди. Решта тихо зникає, без архівів сорому.
          </p>
        </div>
        <GlowDemo />
      </section>

      <section className="mx-auto grid max-w-5xl items-center gap-10 px-5 pb-20 sm:px-8 lg:grid-cols-2">
        <div className="lg:order-2">
          <SectionLabel n="02">Тюнер</SectionLabel>
          <h2 className="mt-2 text-3xl font-semibold tracking-[-0.03em]">Ви вирішуєте, що бачити</h2>
          <p className="mt-3 text-muted-foreground">
            Хочете лише друзів — поверніть ліворуч. Хочете знаходити нових — праворуч. І завжди є вкладка «Підписки»: суто хронологія, без алгоритму взагалі.
          </p>
        </div>
        <TunerDemo />
      </section>

      <section className="mx-auto max-w-2xl px-5 pb-24 sm:px-8">
        <Waitlist />
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Lumyn не продає дані й не надсилає «ви пропустили 12 дописів».{" "}
          <Link href="/" className="underline-offset-4 hover:underline">Подивитися демо</Link>
        </p>
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-4 border-t px-5 py-5 text-xs text-muted-foreground sm:px-8">
  <Logo withWordmark={false} />
  <div className="flex gap-4">
    <Link href="/about" className="hover:text-foreground">Про нас</Link>
    <Link href="/contact" className="hover:text-foreground">Контакти</Link>
    <Link href="/terms" className="hover:text-foreground">Умови</Link>
    <Link href="/privacy" className="hover:text-foreground">Конфіденційність</Link>
    <Link href="/guidelines" className="hover:text-foreground">Правила спільноти</Link>
    </div>
  <span>Хмельницький</span>
</footer>
    </div>
  )
}
