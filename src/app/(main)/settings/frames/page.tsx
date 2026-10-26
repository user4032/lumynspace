"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Ticket, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/layout/page-header"
import { UserAvatar } from "@/components/user-avatar"
import { FRAMES, FRAMES_SEASONAL, HALLOWEEN_UNTIL, frameActive, frameByKey } from "@/lib/frames"
import { activateFrameCode, clearMyFrame, listMyFrames, selectMyFrame, type OwnedFrameRow } from "@/lib/actions/frames"
import { useMe, viewerActions } from "@/lib/viewer-store"
import { formatFullDate } from "@/lib/format"
import { cn } from "@/lib/utils"
import { isMockMode } from "@/lib/env"
import { BuyButton } from "@/components/buy-button"

const ADMIN_TG = "d4nys"

export default function FramesPage() {
  const router = useRouter()
  const me = useMe()
  const [code, setCode] = useState("")
  const [pending, startTransition] = useTransition()
  const [clearing, startClear] = useTransition()

  // власна рамка з profiles (клієнтська гідратація через viewer-store недоступна — тягнемо напряму)
  const [mine, setMine] = useState<{ frame: string | null; expiresAt: string | null }>({ frame: null, expiresAt: null })
  /** колекція всіх активованих рамок (0023) */
  const [owned, setOwned] = useState<OwnedFrameRow[]>([])
  const [selectingFrame, setSelectingFrame] = useState<string | null>(null)
  const [season, setSeason] = useState<{ live: boolean; days: number } | null>(null)
  useEffect(() => {
    const t = setTimeout(() => {
      const days = Math.max(0, Math.ceil((Date.parse(HALLOWEEN_UNTIL) - Date.now()) / 86400000))
      setSeason({ live: days > 0, days })
    }, 0)
    return () => clearTimeout(t)
  }, [])
  useEffect(() => {
    if (isMockMode) return
    void (async () => {
      const framesRes = await listMyFrames()
      if (framesRes.ok && framesRes.data) setOwned(framesRes.data)
      const { getSupabaseBrowserClient } = await import("@/lib/supabase/client")
      const supabase = getSupabaseBrowserClient()
      if (!supabase) return
      const { data } = await supabase.auth.getUser()
      const uid = data.user?.id
      if (!uid) return
      const { data: prof } = await supabase.from("profiles").select("frame, frame_expires_at").eq("id", uid).maybeSingle()
      const p = prof as { frame?: string | null; frame_expires_at?: string | null } | null
      setMine({ frame: p?.frame ?? null, expiresAt: p?.frame_expires_at ?? null })
    })()
  }, [])

  const active = frameActive(mine.frame, mine.expiresAt) ? mine.frame : null
  const activeInfo = frameByKey(active)

  const buyLink = (f: { key: string; name: string; price: number; seasonal?: unknown }) =>
    `https://t.me/${ADMIN_TG}?text=${encodeURIComponent(`Привіт! Я @${me.username || "користувач Lumyn"}, хочу купити рамку «${f.name}» (${f.price} грн${f.seasonal ? " / 30 днів" : ", назавжди"}).`)}`

  const activate = () =>
    startTransition(async () => {
      const res = await activateFrameCode(code)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      if (res.data) {
        toast.success(`Рамку «${frameByKey(res.data.frame)?.name ?? res.data.frame}» активовано`, {
          description: res.data.expiresAt ? `Діє до ${formatFullDate(res.data.expiresAt)}` : "Діє назавжди",
        })
        void import("@/components/confetti").then(({ fireConfetti }) => fireConfetti())
        setCode("")
        setMine({ frame: res.data.frame, expiresAt: res.data.expiresAt })
        viewerActions.updateSelf({ frame: res.data.frame, frameExpiresAt: res.data.expiresAt || null })
        const framesRes = await listMyFrames()
        if (framesRes.ok && framesRes.data) setOwned(framesRes.data)
        router.refresh()
      } else toast("Демо-режим: активація лише з Supabase")
    })

  const choose = (frame: string) => {
    if (selectingFrame) return
    setSelectingFrame(frame)
    void (async () => {
      const res = await selectMyFrame(frame)
      setSelectingFrame(null)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      if (res.data) {
        setMine({ frame: res.data.frame, expiresAt: res.data.expiresAt })
        viewerActions.updateSelf({ frame: res.data.frame, frameExpiresAt: res.data.expiresAt })
        toast.success(`Рамку «${frameByKey(res.data.frame)?.name ?? res.data.frame}» обрано`)
        router.refresh()
      }
    })()
  }

  const remove = () =>
    startClear(async () => {
      const res = await clearMyFrame()
      if (res.ok) {
        toast("Рамку прибрано")
        setMine({ frame: null, expiresAt: null })
        viewerActions.updateSelf({ frame: null, frameExpiresAt: null })
      } else if (res.error) toast.error(res.error)
    })

  return (
    <>
      <PageHeader title="Рамки профілю" subtitle="Прикраса навколо аватара — помітно всюди: у стрічці, чатах і коментарях" />

      <div className="space-y-4 px-4 py-5 sm:px-5">
        {/* активна рамка */}
        {active && activeInfo ? (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-subtle/50 p-4">
            <UserAvatar user={me} size="lg" frame={active} frameExpiresAt={mine.expiresAt} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">
                Активна: {activeInfo.name}
                <span className="text-muted-foreground"> · {mine.expiresAt ? `до ${formatFullDate(mine.expiresAt)}` : "назавжди"}</span>
              </p>
              <p className="text-xs text-muted-foreground">{activeInfo.desc}</p>
            </div>
            <Button variant="outline" size="sm" className="rounded-full" disabled={clearing} onClick={remove}>
              {clearing ? <Loader2 className="animate-spin" /> : <X className="size-4" />} Прибрати
            </Button>
          </div>
        ) : null}

        {/* промокод */}
        <div className="rounded-xl border p-4">
          <p className="flex items-center gap-2 text-sm font-medium">
            <Ticket className="size-4 text-brand" /> Маєте промокод?
          </p>
          <div className="mt-2.5 flex max-w-md gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 14))}
              placeholder="LUMN-XXXX-XXXX"
              className="h-10 flex-1 rounded-md border bg-subtle px-3 font-mono text-sm tracking-wider outline-none focus:border-ring"
            />
            <Button className="rounded-full" disabled={code.length < 10 || pending} onClick={activate}>
              {pending ? <Loader2 className="animate-spin" /> : "Активувати"}
            </Button>
          </div>
        </div>

        {/* колекція активованих рамок */}
        {owned.length > 0 && (
          <div>
            <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
              Моя колекція
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">{owned.length}</span>
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {owned.map((o) => {
                const info = frameByKey(o.frame)
                if (!info) return null
                const isActive = active === o.frame
                return (
                  <div
                    key={o.frame}
                    className={cn("flex items-center gap-4 rounded-xl border p-4", isActive ? "border-brand/40 bg-brand/5" : "bg-subtle/40")}
                  >
                    <UserAvatar
                      user={me}
                      size="xl"
                      frame={o.frame}
                      frameExpiresAt={o.expires_at ?? "2099-01-01"}
                      className="shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 text-sm font-semibold">
                        {info.name}
                        {isActive && <span className="rounded-full bg-brand/15 px-2 py-0.5 text-[10px] font-medium text-brand">активна</span>}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{info.desc}</p>
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        {o.expires_at ? `до ${formatFullDate(o.expires_at)}` : "назавжди"}
                      </p>
                    </div>
                    <Button
                      variant={isActive ? "secondary" : "outline"}
                      size="sm"
                      className="rounded-full"
                      disabled={isActive || Boolean(selectingFrame)}
                      onClick={() => choose(o.frame)}
                    >
                      {isActive ? "Обрана" : selectingFrame === o.frame ? <Loader2 className="animate-spin" /> : "Вибрати"}
                    </Button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* хелловін-лімітед */}
        {season?.live && (
          <div>
            <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
              🎃 Хелловін-лімітед
              <span className="rounded-full bg-brand/15 px-2 py-0.5 text-[10px] font-medium text-brand">
                ще {season.days} {season.days === 1 ? "день" : "днів"}
              </span>
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {FRAMES_SEASONAL.map((f) => (
                <div key={f.key} className="flex items-center gap-4 rounded-xl border border-brand/30 bg-subtle/40 p-4">
                  <UserAvatar user={me} size="xl" frame={f.key} frameExpiresAt="2099-01-01" className="shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 text-sm font-semibold">
                      {f.name}
                      {active === f.key && <span className="rounded-full bg-brand/15 px-2 py-0.5 text-[10px] font-medium text-brand">активна</span>}
                    </p>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{f.desc}</p>
                    <p className="mt-1.5 font-mono text-sm font-semibold">{f.price} грн <span className="font-normal text-muted-foreground">/ 30 днів</span></p>
                  </div>
                  <BuyButton
                    href={buyLink({ ...f, name: `${f.name} (Хелловін)` })}
                    disabled={active === f.key}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* каталог */}
        <div className="grid gap-3 sm:grid-cols-2">
          {FRAMES.map((f) => (
            <div key={f.key} className="flex items-center gap-4 rounded-xl border bg-subtle/40 p-4">
              <UserAvatar user={me} size="xl" frame={f.key} frameExpiresAt="2099-01-01" className="shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 text-sm font-semibold">
                  {f.name}
                  {active === f.key && <span className="rounded-full bg-brand/15 px-2 py-0.5 text-[10px] font-medium text-brand">активна</span>}
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{f.desc}</p>
                <p className="mt-1.5 font-mono text-sm font-semibold">{f.price} грн <span className="font-normal text-muted-foreground">· назавжди</span></p>
              </div>
              <BuyButton href={buyLink(f)} disabled={active === f.key} />
            </div>
          ))}
        </div>

        <p className="pb-4 text-xs leading-relaxed text-muted-foreground">
          Купівля: натискаєте «Купити» — відкриється чат з адміністратором у Telegram із готовим повідомленням. Після оплати
          отримаєте одноразовий промокод і активуєте його у полі вище. Рамка — суто косметика: жодних переваг у стрічці.
        </p>
      </div>
    </>
  )
}
