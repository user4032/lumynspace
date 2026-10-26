"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2, MailCheck } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"

/** Людські повідомлення замість технічних відповідей Supabase */
const ERRORS: [RegExp, string][] = [
  [/invalid login credentials/i, "Невірна пошта або пароль"],
  [/user already registered/i, "Акаунт з цією поштою вже є — увійдіть"],
  [/email not confirmed/i, "Спершу підтвердіть пошту — лист уже у вашій скриньці"],
  [/password should be at least 6 characters/i, "Пароль — щонайменше 6 символів"],
  [/unable to validate email/i, "Перевірте адресу пошти"],
  [/(rate limit|too many)/i, "Забагато спроб — спробуйте за хвилину"],
]

const humanError = (message: string) => ERRORS.find(([re]) => re.test(message))?.[1] ?? "Щось пішло не так. Спробуйте ще раз."

/**
 * Вхід і реєстрація поштою+паролем.
 * ?next=… — куди повернутись після входу (проксі додає для пости за посиланням тощо).
 */
export function EmailAuthForm() {
  const router = useRouter()
  const params = useSearchParams()
  const [mode, setMode] = useState<"login" | "signup" | "reset">("login")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [sent, setSent] = useState(false)
  // 2FA: виклик після правильного пароля
  const [mfa, setMfa] = useState<{ factorId: string; challengeId: string } | null>(null)
  const [mfaCode, setMfaCode] = useState("")

  const nextParam = params.get("next") ?? "/"
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/"
  // невдалий OAuth-колбек приходить із ?error=auth
  const shownError = error ?? (params.get("error") === "auth" ? "Не вдалося завершити вхід — спробуйте ще раз" : null)

  /** 2FA: підтвердити код виклику */
  const verifyMfa = async () => {
    const supabase = getSupabaseBrowserClient()
    if (!supabase || !mfa) return
    setPending(true)
    const { error } = await supabase.auth.mfa.verify({ factorId: mfa.factorId, challengeId: mfa.challengeId, code: mfaCode.trim() })
    setPending(false)
    if (error) return setError("Код не підійшов — спробуйте ще раз")
    router.refresh()
    router.push(next)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const supabase = getSupabaseBrowserClient()
    if (!supabase) return setError("Вхід вимкнено: Supabase не налаштовано")
    const mail = email.trim().toLowerCase()
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) return setError("Перевірте адресу пошти")

    setError(null)
    setPending(true)

    // «Забули пароль?» — надсилаємо лист відновлення
    if (mode === "reset") {
      const { error: err } = await supabase.auth.resetPasswordForEmail(mail, {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/auth/reset")}`,
      })
      setPending(false)
      if (err) return setError(humanError(err.message))
      setSent(true)
      return
    }

    if (password.length < 6) return setError("Пароль — щонайменше 6 символів")

    if (mode === "login") {
      const { error: err } = await supabase.auth.signInWithPassword({ email: mail, password })
      if (err) {
        setPending(false)
        return setError(humanError(err.message))
      }
      // 2FA: якщо підключено верифікований фактор — просимо код
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
      if (aal && aal.currentLevel === "aal1" && aal.nextLevel === "aal2") {
        const { data: list } = await supabase.auth.mfa.listFactors()
        const factor = ((list?.totp ?? []) as { id: string; status: string }[]).find((f) => f.status === "verified")
        if (factor) {
          const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({ factorId: factor.id })
          setPending(false)
          if (!chErr && ch) return setMfa({ factorId: factor.id, challengeId: ch.id })
        }
      }
      setPending(false)
      router.refresh()
      router.push(next)
      return
    }
    const { data, error: err } = await supabase.auth.signUp({
      email: mail,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    })
    setPending(false)
    if (err) return setError(humanError(err.message))
    // потрібне підтвердження пошти → сесії ще нема
    if (data.session) {
      toast.success("Акаунт створено")
      router.refresh()
      router.push("/onboarding")
    } else setSent(true)
  }

  if (sent)
    return (
      <div className="rounded-xl border bg-subtle/60 p-5 text-center">
        <MailCheck className="mx-auto size-8 text-brand" />
        <p className="mt-3 text-sm font-medium">
          {mode === "reset" ? "Лист для відновлення надіслали" : "Лист летить до вас"}
        </p>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          {mode === "reset" ? (
            <>
              Відкрийте поштову скриньку <b className="text-foreground">{email.trim()}</b> і
              перейдіть за посиланням — там задаєте новий пароль.
            </>
          ) : (
            <>
              Відкрийте поштову скриньку <b className="text-foreground">{email.trim()}</b> і підтвердьте адресу — звідти вас одразу впустить у Lumyn.
            </>
          )}
        </p>
        <p className="mt-3 text-xs text-muted-foreground">Листа нема? Загляньте у «Спам» або почекайте хвилину-другу.</p>
      </div>
    )

  if (mfa)
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void verifyMfa()
        }}
        className="grid gap-3"
      >
        <p className="rounded-lg border bg-subtle/60 p-3 text-sm text-muted-foreground">
          Введіть 6-значний код із застосунку-автентифікатора.
        </p>
        <Input
          autoFocus
          value={mfaCode}
          onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="••••••"
          inputMode="numeric"
          className="h-11 text-center font-mono text-lg tracking-[0.4em]"
        />
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" className="h-11 w-full" disabled={mfaCode.length !== 6 || pending}>
          {pending ? <Loader2 className="animate-spin" /> : "Підтвердити і увійти"}
        </Button>
      </form>
    )

  return (
    <form onSubmit={submit} className="grid gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor="email">Пошта</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="h-11"
        />
      </div>
      {mode !== "reset" && (
        <div className="grid gap-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Пароль</Label>
            {mode === "login" && (
              <button
                type="button"
                onClick={() => {
                  setMode("reset")
                  setError(null)
                }}
                className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
              >
                Забули пароль?
              </button>
            )}
          </div>
          <Input
            id="password"
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={mode === "login" ? "••••••••" : "Мінімум 6 символів"}
            className="h-11"
          />
        </div>
      )}

      {shownError && (
        <p role="alert" className="text-sm text-destructive">
          {shownError}
        </p>
      )}

      <Button type="submit" size="lg" className="h-11 w-full" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : mode === "login" ? "Увійти" : mode === "signup" ? "Створити акаунт" : "Надіслати лист"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        {mode === "login" && (
          <>
            Вперше тут?{" "}
            <button type="button" onClick={() => { setMode("signup"); setError(null) }} className="font-medium text-foreground underline underline-offset-4">
              Створити акаунт
            </button>
          </>
        )}
        {mode === "signup" && (
          <>
            Уже маєте акаунт?{" "}
            <button type="button" onClick={() => { setMode("login"); setError(null) }} className="font-medium text-foreground underline underline-offset-4">
              Увійти
            </button>
          </>
        )}
        {mode === "reset" && (
          <>
            Згадали пароль?{" "}
            <button type="button" onClick={() => { setMode("login"); setError(null) }} className="font-medium text-foreground underline underline-offset-4">
              Повернутися до входу
            </button>
          </>
        )}
      </p>
    </form>
  )
}
