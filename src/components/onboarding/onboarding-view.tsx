"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { ArrowLeft, ArrowRight, Check, Loader2, Lock, Ticket, X } from "lucide-react"
import { Logo } from "@/components/logo"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { UserAvatar } from "@/components/user-avatar"
import { BannerArt } from "@/components/profile/profile-banner"
import { ACCENTS, accentVars } from "@/lib/accent"
import { checkHandle, completeOnboarding, getOnboardingStatus } from "@/lib/actions/viewer"
import { isMinor, useMe, viewerActions } from "@/lib/viewer-store"
import { currentUser } from "@/lib/mock-data"
import { isMockMode } from "@/lib/env"
import { cn } from "@/lib/utils"

const STEPS = ["Нік", "Вік", "Інвайт", "Акцент"]
const HANDLE_RE = /^[a-z0-9_]{3,24}$/
const CODE_RE = /^[A-Z0-9]{4}-[A-Z0-9]{4}$/
const THIS_YEAR = 2026

type HandleState = "idle" | "checking" | "free" | "taken" | "bad"

const HINTS = [
  "Нік — це адреса. Обирайте такий, який не соромно надрукувати на футболці.",
  "",
  "Один код — один друг. Ви одразу читатимете одне одного.",
  "Цей колір супроводжуватиме кожен ваш допис — у стрічці, в картках для сторіз, у профілі.",
]

export function OnboardingView() {
  const router = useRouter()
  const reduce = useReducedMotion()
  const [step, setStep] = useState(0)
  const [dir, setDir] = useState(1)
  const [handle, setHandle] = useState("")
  const [handleState, setHandleState] = useState<HandleState>("idle")
  const [year, setYear] = useState("")
  const [code, setCode] = useState("")
  const [accent, setAccent] = useState(ACCENTS[0].value)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const checkId = useRef(0)
  const me = useMe()
  // Supabase: код обов'язковий, лише якщо в системі вже є інвайти (перший користувач заходить без коду)
  const [inviteRequired, setInviteRequired] = useState(true)
  const [needsMigration, setNeedsMigration] = useState(false)

  useEffect(() => {
    if (isMockMode) return
    let cancelled = false
    void getOnboardingStatus().then((res) => {
      if (cancelled || !res.ok || !res.data) return
      if (res.data.onboarded) {
        router.replace(res.data.username ? `/${res.data.username}` : "/")
        return
      }
      setInviteRequired(res.data.inviteRequired)
      setNeedsMigration(res.data.needsMigration)
      // нік, виданий при реєстрації (логін GitHub тощо), — як підказка
      const suggested = res.data.username
      setHandle((h) => h || suggested)
    })
    return () => {
      cancelled = true
    }
  }, [router])

  const yearNum = Number(year)
  const yearValid = year.length === 4 && yearNum >= THIS_YEAR - 100 && yearNum <= THIS_YEAR - 16
  const minor = yearValid && isMinor(yearNum, THIS_YEAR)
  const tooYoung = year.length === 4 && yearNum > THIS_YEAR - 16

  useEffect(() => {
    const h = handle.trim().toLowerCase()
    const id = ++checkId.current
    if (!h || !HANDLE_RE.test(h)) {
      const t = setTimeout(() => id === checkId.current && setHandleState(h ? "bad" : "idle"), 0)
      return () => clearTimeout(t)
    }
    const t0 = setTimeout(() => id === checkId.current && setHandleState("checking"), 0)
    const t = setTimeout(async () => {
      const res = await checkHandle(h)
      if (id !== checkId.current) return
      setHandleState(res.ok && res.data?.available ? "free" : "taken")
    }, 350)
    return () => {
      clearTimeout(t0)
      clearTimeout(t)
    }
  }, [handle])

  const go = (next: number) => {
    setError(null)
    setDir(next > step ? 1 : -1)
    setStep(next)
  }

  const codeOk = inviteRequired ? CODE_RE.test(code) : code === "" || CODE_RE.test(code)
  const canNext = [handleState === "free", yearValid, codeOk, true][step]

  const finish = () => {
    setError(null)
    startTransition(async () => {
      const res = await completeOnboarding({ username: handle, birthYear: yearNum, inviteCode: code, accentColor: accent })
      if (!res.ok) {
        if (res.error?.includes("Інвайт")) go(2)
        else if (res.error?.includes("нік")) go(0)
        setError(res.error ?? "Щось пішло не так")
        return
      }
      viewerActions.completeOnboarding({ username: handle.trim().toLowerCase(), accentColor: accent, birthYear: yearNum })
      router.push(`/${handle.trim().toLowerCase()}`)
    })
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key !== "Enter") return
    if (step < 3 && canNext) go(step + 1)
    else if (step === 3) finish()
  }

  const previewUser = { ...(isMockMode ? currentUser : me), name: handle ? handle : "Це ви", username: handle || "ваш_нік", accentColor: accent }

  return (
    <div className="relative grid min-h-dvh lg:grid-cols-[1fr_1.05fr]" style={accentVars(accent)} onKeyDown={onKey}>
      <main className="relative flex flex-col overflow-hidden px-6 py-6 sm:px-12">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-40 -z-10 h-80 opacity-50 lg:hidden">
          <BannerArt style="aurora" className="bg-transparent [mask-image:linear-gradient(black,transparent)]" />
        </div>
        <div className="flex items-center justify-between">
          <Logo />
          <span className="font-mono text-xs text-muted-foreground tabular">
            {step + 1} / {STEPS.length}
          </span>
        </div>

        <div className="mt-6 flex gap-1.5" aria-hidden>
          {STEPS.map((s, i) => (
            <span key={s} className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
              <motion.span
                className="block h-full rounded-full bg-[var(--accent-user)]"
                initial={false}
                animate={{ width: i <= step ? "100%" : "0%" }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              />
            </span>
          ))}
        </div>

        <div className="relative mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
          <AnimatePresence mode="wait" custom={dir} initial={false}>
            <motion.div
              key={step}
              initial={reduce ? { opacity: 0 } : { opacity: 0, x: dir * 28, filter: "blur(4px)" }}
              animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, x: dir * -28, filter: "blur(4px)" }}
              transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
            >
              <p className="font-mono text-xs text-[var(--accent-user)]">0{step + 1} · {STEPS[step]}</p>
              {step === 0 && (
                <>
                  <h1 className="mt-2 text-[30px] leading-tight font-semibold tracking-[-0.035em]">Як вас називати?</h1>
                  <p className="mt-2 text-sm text-muted-foreground">Латиниця, цифри й підкреслення, 3–24 символи. Змінити потім не вийде — тож без поспіху.</p>
                  <Label htmlFor="handle" className="mt-7">Нік</Label>
                  <div className="relative mt-1.5">
                    <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">@</span>
                    <Input
                      id="handle"
                      autoFocus
                      autoCapitalize="off"
                      autoCorrect="off"
                      spellCheck={false}
                      value={handle}
                      maxLength={24}
                      onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                      placeholder="nick_name"
                      className="h-11 pl-8 font-mono text-base"
                    />
                    <span className="absolute top-1/2 right-3 -translate-y-1/2">
                      {handleState === "checking" && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
                      {handleState === "free" && (
                        <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="grid size-5 place-items-center rounded-full bg-close text-black">
                          <Check className="size-3" strokeWidth={3} />
                        </motion.span>
                      )}
                      {(handleState === "taken" || handleState === "bad") && <X className="size-4 text-destructive" />}
                    </span>
                  </div>
                  <p className={cn("mt-2 h-4 text-xs", handleState === "taken" || handleState === "bad" ? "text-destructive" : "text-close")}>
                    {handleState === "free" && `lumyn.space/${handle} — вільно`}
                    {handleState === "taken" && "Зайнято. Спробуйте інший."}
                    {handleState === "bad" && "Щонайменше 3 символи."}
                  </p>
                </>
              )}

              {step === 1 && (
                <>
                  <h1 className="mt-2 text-[30px] leading-tight font-semibold tracking-[-0.035em]">Рік народження</h1>
                  <p className="mt-2 text-sm text-muted-foreground">Lumyn — з 16 років. Рік бачите лише ви, і змінити його не можна.</p>
                  <Label htmlFor="year" className="mt-7">Рік</Label>
                  <Input
                    id="year"
                    autoFocus
                    inputMode="numeric"
                    value={year}
                    maxLength={4}
                    onChange={(e) => setYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    placeholder="2007"
                    className="mt-1.5 h-11 max-w-36 font-mono text-lg tracking-widest"
                  />
                  <AnimatePresence mode="wait">
                    {(tooYoung || yearValid) && (
                      <motion.div
                        key={tooYoung ? "young" : minor ? "minor" : "adult"}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className={cn(
                          "mt-4 flex gap-2.5 rounded-lg border p-3 text-sm",
                          tooYoung ? "border-destructive/40 bg-destructive/5 text-destructive" : "bg-subtle text-muted-foreground"
                        )}
                      >
                        {minor && <Lock className="mt-0.5 size-4 shrink-0 text-[var(--accent-user)]" />}
                        <span>
                          {tooYoung && "Повертайтеся, коли виповниться 16. Ми нікуди не дінемося."}
                          {minor && "До 18 років акаунт буде приватним, а писати вам зможуть лише читачі. Це для вашої безпеки — не для галочки."}
                          {yearValid && !minor && "Приватність налаштуєте самі — у налаштуваннях."}
                        </span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </>
              )}

              {step === 2 && (
                <>
                  <h1 className="mt-2 text-[30px] leading-tight font-semibold tracking-[-0.035em]">Код від друга</h1>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Поки Lumyn за запрошеннями — так тут з&apos;являються свої, а не боти. У кожного є 5 кодів.
                  </p>
                  <Label htmlFor="code" className="mt-7">Інвайт</Label>
                  <div className="relative mt-1.5">
                    <Ticket className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="code"
                      autoFocus
                      autoCapitalize="characters"
                      value={code}
                      maxLength={9}
                      onChange={(e) => {
                        const raw = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8)
                        setCode(raw.length > 4 ? `${raw.slice(0, 4)}-${raw.slice(4)}` : raw)
                      }}
                      placeholder="XXXX-XXXX"
                      className="h-11 pl-9 font-mono text-base tracking-[0.25em]"
                    />
                  </div>
                  {inviteRequired ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Немає коду? <Link href="/welcome#waitlist" className="text-foreground underline-offset-4 hover:underline">Забронюйте нік</Link> — напишемо, щойно відкриємося.
                      {isMockMode && <span className="mt-1 block font-mono">демо: LUMN-2026</span>}
                      {needsMigration && (
                        <span className="mt-1 block">Перший вхід без коду запрацює після міграції 0003_first_user_invites.sql.</span>
                      )}
                    </p>
                  ) : (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Ви серед перших — код не потрібен, можна просто натиснути «Далі». Свої 5 інвайтів знайдете в налаштуваннях приватності.
                    </p>
                  )}
                </>
              )}

              {step === 3 && (
                <>
                  <h1 className="mt-2 text-[30px] leading-tight font-semibold tracking-[-0.035em]">Ваш колір</h1>
                  <p className="mt-2 text-sm text-muted-foreground">Фарбує банер, кнопки й підсвітку ваших дописів. Змінюється будь-коли.</p>
                  <div className="mt-7 grid grid-cols-4 gap-3 sm:flex sm:flex-wrap">
                    {ACCENTS.map((a) => {
                      const active = accent === a.value
                      return (
                        <button
                          key={a.value}
                          type="button"
                          onClick={() => setAccent(a.value)}
                          aria-label={a.name}
                          aria-pressed={active}
                          className="relative grid size-12 place-items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {active && (
                            <motion.span
                              layoutId="onb-accent"
                              transition={{ type: "spring", stiffness: 500, damping: 30 }}
                              className="absolute inset-0 rounded-full ring-2"
                              style={{ ["--tw-ring-color" as string]: a.value }}
                            />
                          )}
                          <span className="size-9 rounded-full transition-transform hover:scale-110" style={{ background: a.value, boxShadow: active ? `0 0 24px ${a.value}` : undefined }} />
                        </button>
                      )
                    })}
                  </div>
                  <p className="mt-4 font-mono text-xs text-muted-foreground">
                    {ACCENTS.find((a) => a.value === accent)?.name} · {accent}
                  </p>
                </>
              )}
            </motion.div>
          </AnimatePresence>

          <p className="mt-4 h-5 text-sm text-destructive" role="alert">{error}</p>

          <div className="mt-4 flex items-center gap-3">
            {step > 0 && (
              <Button variant="ghost" onClick={() => go(step - 1)} disabled={pending}>
                <ArrowLeft /> Назад
              </Button>
            )}
            {step < 3 ? (
              <Button size="lg" className="ml-auto rounded-full px-6" disabled={!canNext} onClick={() => go(step + 1)}>
                Далі <ArrowRight />
              </Button>
            ) : (
              <Button
                size="lg"
                className="ml-auto rounded-full px-6 shadow-[0_0_40px_-8px_var(--accent-user)]"
                disabled={pending}
                onClick={finish}
                style={{ background: "var(--accent-user)", color: "var(--accent-user-fg)" }}
              >
                Засвітитися {pending ? <Loader2 className="animate-spin" /> : <ArrowRight />}
              </Button>
            )}
          </div>
        </div>
        <p className="text-center text-xs text-muted-foreground">Без стріків. Без «вас давно не було». Без продажу ваших даних.</p>
      </main>

      <aside className="relative hidden overflow-hidden border-l lg:block">
        <BannerArt style="aurora" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
        <div className="absolute inset-x-12 bottom-12">
          <motion.div layout className="max-w-sm rounded-2xl border border-white/15 bg-black/45 p-5 text-white shadow-2xl backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <span className="relative">
                <span aria-hidden className="absolute -inset-1.5 rounded-full opacity-80 blur-md" style={{ background: "var(--accent-user)" }} />
                <UserAvatar user={previewUser} size="xl" className="relative rounded-full ring-2 ring-black/40" />
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 truncate text-[15px] font-semibold">
                  {previewUser.name}
                  {minor && <Lock className="size-3.5 text-white/70" />}
                </span>
                <span className="block truncate font-mono text-xs text-white/70">@{previewUser.username}</span>
              </span>
              <span className="ml-auto rounded-full px-3 py-1 text-xs font-medium" style={{ background: "var(--accent-user)", color: "var(--accent-user-fg)" }}>
                Читати
              </span>
            </div>
            <AnimatePresence mode="wait">
              <motion.p key={step + String(minor)} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-4 text-sm leading-relaxed text-white/85">
                {step === 1 ? (minor ? "До 18 — приватний акаунт і повідомлення лише від читачів." : "Ваш простір, ваші правила приватності.") : HINTS[step]}
              </motion.p>
            </AnimatePresence>
          </motion.div>
        </div>
      </aside>
    </div>
  )
}
