"use client"

import { useEffect, useState } from "react"
import { Loader2, ShieldCheck } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"

type Factor = { id: string; status: string; friendly_name?: string | null }

/** Двокрокова перевірка (TOTP): Google Authenticator, 1Password тощо. */
export function TwoFactor() {
  const supabase = getSupabaseBrowserClient()
  const [factors, setFactors] = useState<Factor[] | null>(null)
  const [qr, setQr] = useState<string | null>(null)
  const [secret, setSecret] = useState<string | null>(null)
  const [factorId, setFactorId] = useState<string | null>(null)
  const [code, setCode] = useState("")
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (!supabase) return
    let cancelled = false
    void supabase.auth.mfa.listFactors().then(({ data }) => {
      if (!cancelled) setFactors((data?.totp ?? []) as Factor[])
    })
    return () => {
      cancelled = true
    }
  }, [supabase])

  if (!supabase || factors === null) return null
  const active = factors.some((f) => f.status === "verified")

  const start = async () => {
    setPending(true)
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "Lumyn" })
    setPending(false)
    if (error || !data) return toast.error(error?.message ?? "Не вдалося почати")
    setQr(data.totp.qr_code)
    setSecret(data.totp.secret)
    setFactorId(data.id)
  }

  const verify = async () => {
    if (!factorId) return
    setPending(true)
    const { data: challenge, error: chErr } = await supabase.auth.mfa.challenge({ factorId })
    if (chErr || !challenge) {
      setPending(false)
      return toast.error("Не вдалося створити виклик")
    }
    const { error } = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.id, code: code.trim() })
    setPending(false)
    if (error) return toast.error("Код не підійшов — перевірте застосунок і спробуйте ще раз")
    toast.success("Двокрокову перевірку увімкнено")
    setQr(null)
    setSecret(null)
    setFactorId(null)
    setCode("")
    setFactors(null)
    void supabase.auth.mfa.listFactors().then(({ data: d }) => setFactors((d?.totp ?? []) as Factor[]))
  }

  const disable = async () => {
    const f = factors.find((x) => x.status === "verified")
    if (!f) return
    setPending(true)
    const { error } = await supabase.auth.mfa.unenroll({ factorId: f.id })
    setPending(false)
    if (error) return toast.error(error.message)
    toast("Двокрокову перевірку вимкнено")
    setFactors(null)
    void supabase.auth.mfa.listFactors().then(({ data: d }) => setFactors((d?.totp ?? []) as Factor[]))
  }

  return (
    <Card id="twofa" className="gap-0 py-0">
      <CardHeader className="pt-5">
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="size-4.5 text-brand" /> Двокрокова перевірка
        </CardTitle>
        <CardDescription>
          {active
            ? "Увімкнено: при вході поштою проситимемо код із застосунку-автентифікатора."
            : "Додатковий код із Google Authenticator чи 1Password при вході поштою+паролем."}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-4 pb-5">
        {active ? (
          <Button variant="outline" className="rounded-full" disabled={pending} onClick={disable}>
            {pending ? <Loader2 className="animate-spin" /> : "Вимкнути"}
          </Button>
        ) : qr ? (
          <div className="grid gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- data:URL з Supabase */}
            <img src={qr} alt="QR-код для автентифікатора" className="size-44 rounded-lg border bg-white p-2" />
            {secret && (
              <p className="font-mono text-xs break-all text-muted-foreground">
                Не сканується? Введіть секрет вручну: {secret}
              </p>
            )}
            <div className="flex max-w-64 gap-2">
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="6-значний код"
                inputMode="numeric"
                className="font-mono tracking-widest"
              />
              <Button className="rounded-full" disabled={code.length !== 6 || pending} onClick={verify}>
                {pending ? <Loader2 className="animate-spin" /> : "Підтвердити"}
              </Button>
            </div>
          </div>
        ) : (
          <Button className="rounded-full" disabled={pending} onClick={start}>
            {pending ? <Loader2 className="animate-spin" /> : "Увімкнути"}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
