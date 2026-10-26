"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { GitHubIcon, GoogleIcon } from "@/components/brand-icons"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { isSupabaseConfigured } from "@/lib/env"

type Provider = "github" | "google"

export function OAuthButtons() {
  const [pending, setPending] = useState<Provider | null>(null)

  const signIn = async (provider: Provider) => {
    const supabase = getSupabaseBrowserClient()
    if (!supabase) return
    setPending(provider)
    // після входу повертаємось туди, звідки прийшли (?next= від проксі), а не на головну
    const next = new URLSearchParams(window.location.search).get("next") ?? "/"
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    })
    if (error) {
      toast.error("Не вдалося увійти", { description: error.message })
      setPending(null)
    }
  }

  const disabled = !isSupabaseConfigured || pending !== null

  return (
    <div className="grid gap-2.5">
      <Button variant="default" size="lg" className="h-11 w-full" disabled={disabled} onClick={() => signIn("github")}>
        {pending === "github" ? <Loader2 className="animate-spin" /> : <GitHubIcon className="size-[18px]" />}
        Продовжити з GitHub
      </Button>
      <Button variant="secondary" size="lg" className="h-11 w-full" disabled={disabled} onClick={() => signIn("google")}>
        {pending === "google" ? <Loader2 className="animate-spin" /> : <GoogleIcon className="size-[18px]" />}
        Продовжити з Google
      </Button>
    </div>
  )
}
