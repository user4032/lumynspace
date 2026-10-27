"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { CheckCircle2, KeyRound, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Logo } from "@/components/logo"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { isSupabaseConfigured } from "@/lib/env"

export default function ResetPasswordPage() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const [allowed, setAllowed] = useState(false)
  const [password, setPassword] = useState("")
  const [done, setDone] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // посилання з листа створює сесію в callback — тут просто перевіряємо її
  useEffect(() => {
    const supabase = getSupabaseBrowserClient()
    let cancelled = false
    const check = supabase
      ? supabase.auth.getUser().then(({ data }) => Boolean(data.user))
      : Promise.resolve(false)
    void check.then((ok) => {
      if (!cancelled) {
        setAllowed(ok)
        setChecking(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const supabase = getSupabaseBrowserClient()
    if (!supabase) return
    if (password.length < 6) return setError("Пароль — щонайменше 6 символів")
    setError(null)
    setPending(true)
    const { error: err } = await supabase.auth.updateUser({ password })
    setPending(false)
    if (err) return setError("Не вдалося зберегти пароль — спробуйте ще раз або попросіть новий лист")
    setDone(true)
    toast.success("Пароль оновлено")
    setTimeout(() => router.push("/"), 1600)
  }

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-grid mask-radial opacity-60" />
      <div
        aria-hidden
        className="pointer-events-none absolute top-[-20%] left-1/2 h-[560px] w-[860px] -translate-x-1/2 rounded-full opacity-30 blur-3xl dark:opacity-25"
        style={{ background: "radial-gradient(closest-side, var(--brand), transparent)" }}
      />
      <header className="relative flex h-16 items-center px-6">
        <Link href="/" className="flex items-center gap-2">
          <Logo />
        </Link>
      </header>
      <main className="relative flex flex-1 items-center justify-center px-4 pb-16">
        <div className="w-full max-w-[380px]">
          {checking ? (
            <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Перевіряємо посилання…
            </p>
          ) : done ? (
            <div className="flex flex-col items-center text-center">
              <CheckCircle2 className="size-10 text-brand" />
              <h1 className="mt-4 text-xl font-semibold">Пароль оновлено</h1>
              <p className="mt-1.5 text-sm text-muted-foreground">Зараз перенаправимо у Lumyn…</p>
            </div>
          ) : !allowed || !isSupabaseConfigured ? (
            <div className="flex flex-col items-center text-center">
              <KeyRound className="size-10 text-muted-foreground" />
              <h1 className="mt-4 text-xl font-semibold">Посилання застаріло</h1>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                Листи для відновлення живуть недовго — попросіть новий на сторінці входу.
              </p>
              <Button asChild className="mt-6 rounded-full px-6">
                <Link href="/login">До входу</Link>
              </Button>
            </div>
          ) : (
            <>
              <div className="flex flex-col items-center text-center">
                <h1 className="text-[26px] leading-tight font-semibold tracking-[-0.03em]">Новий пароль</h1>
                <p className="mt-2 text-sm text-muted-foreground">Придумайте пароль, який не забудете — мінімум 6 символів.</p>
              </div>
              <form onSubmit={submit} className="mt-8 grid gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="new-password">Пароль</Label>
                  <Input
                    id="new-password"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="h-11"
                    autoFocus
                  />
                </div>
                {error && (
                  <p role="alert" className="text-sm text-destructive">
                    {error}
                  </p>
                )}
                <Button type="submit" size="lg" className="h-11 w-full" disabled={pending}>
                  {pending ? <Loader2 className="animate-spin" /> : "Зберегти пароль"}
                </Button>
              </form>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
