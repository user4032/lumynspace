"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useTheme } from "next-themes"
import { motion } from "framer-motion"
import { toast } from "sonner"
import { Check, Music2, Pipette, Quote, Timer } from "lucide-react"
import type { BannerStyle } from "@/types"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { UserAvatar } from "@/components/user-avatar"
import { useMounted, useThemeTransition } from "@/components/theme-toggle"
import { BannerArt } from "@/components/profile/profile-banner"
import { Sparkles, Flame, Moon, Laptop, Gamepad2, BookOpen, Plane, Flag } from "lucide-react"
import { Segmented } from "@/components/settings/settings-nav"
import { ProfilePhotos } from "@/components/settings/profile-photos"
import { DeleteAccountButton } from "@/components/settings/delete-account"
import { currentUser, followingIds, users } from "@/lib/mock-data"
import { ACCENTS, accentVars, isHexColor } from "@/lib/accent"
import { remainingLabel } from "@/lib/glow"
import { useNow } from "@/hooks/useNow"
import { useMe, useViewer, viewerActions } from "@/lib/viewer-store"
import { updateProfile } from "@/lib/actions/viewer"
import { isMockMode } from "@/lib/env"
import { cn } from "@/lib/utils"


const BANNERS: { value: BannerStyle; label: string }[] = [
  { value: "aurora", label: "Аврора" },
  { value: "mesh", label: "Меш" },
  { value: "grid", label: "Сітка" },
  { value: "solid", label: "Заливка" },
  { value: "image", label: "Фото" },
]

const STATUS_OPTIONS = [
  { icon: Sparkles, label: "Онлайн" },
  { icon: Flame, label: "У справах" },
  { icon: Moon, label: "Відпочиваю" },
  { icon: Laptop, label: "Працюю" },
  { icon: Gamepad2, label: "Граю" },
  { icon: BookOpen, label: "Вчуся" },
  { icon: Plane, label: "У дорозі" },
  { icon: Flag, label: "Україна" },
]

const EXPIRY = [
  { value: "1h", label: "1 год", ms: 3_600_000 },
  { value: "4h", label: "4 год", ms: 4 * 3_600_000 },
  { value: "24h", label: "24 год", ms: 24 * 3_600_000 },
  { value: "7d", label: "7 днів", ms: 7 * 24 * 3_600_000 },
  { value: "never", label: "Назавжди", ms: 0 },
] as const
type ExpiryKey = (typeof EXPIRY)[number]["value"]

function ThemePreview({ mode }: { mode: "light" | "dark" | "system" }) {
  const pane = (dark: boolean) => (
    <div className={cn("flex h-full flex-1 flex-col gap-1.5 p-2.5", dark ? "bg-black" : "bg-white")}>
      <div className={cn("h-1.5 w-8 rounded-full", dark ? "bg-neutral-700" : "bg-neutral-300")} />
      <div className={cn("h-1.5 w-12 rounded-full", dark ? "bg-neutral-800" : "bg-neutral-200")} />
      <div className={cn("mt-auto h-4 rounded-sm border", dark ? "border-neutral-800 bg-neutral-900" : "border-neutral-200 bg-neutral-50")} />
    </div>
  )
  return (
    <div className="flex h-20 overflow-hidden rounded-md border">
      {mode === "system" ? (<>{pane(false)}{pane(true)}</>) : pane(mode === "dark")}
    </div>
  )
}

function useDebouncedSave() {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pending = useRef<Parameters<typeof updateProfile>[0]>({})
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])
  return (patch: Parameters<typeof updateProfile>[0]) => {
    pending.current = { ...pending.current, ...patch }
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      const res = await updateProfile(pending.current)
      pending.current = {}
      if (!res.ok) toast.error(res.error)
    }, 500)
  }
}

function StylePreview() {
  const me = useMe()
  const now = useNow()
  return (
    <div style={accentVars(me.accentColor)} className="overflow-hidden rounded-xl border bg-background">
      <div className="relative h-24">
        <BannerArt style={me.bannerStyle ?? "aurora"} coverUrl={isMockMode ? currentUser.coverUrl : me.coverUrl} />
      </div>
      <div className="px-4 pb-4">
        <div className="flex items-end justify-between">
          <span className="relative -mt-8">
            <span aria-hidden className="absolute -inset-1 rounded-full opacity-70 blur-md" style={{ background: "var(--accent-user)" }} />
            <UserAvatar user={me} size="xl" className="relative size-16 rounded-full ring-4 ring-background" />
          </span>
          <motion.span layout className="rounded-full px-3 py-1 text-xs font-medium" style={{ background: "var(--accent-user)", color: "var(--accent-user-fg)" }}>
            Читати
          </motion.span>
        </div>
        <p className="mt-2 text-sm font-semibold">{me.name}</p>
        <p className="text-xs text-muted-foreground">@{me.username}</p>
        {me.status && (
          <p className="mt-2 inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs" style={{ borderColor: "color-mix(in oklab, var(--accent-user) 35%, var(--border))" }}>
            <Quote className="size-3 shrink-0 text-[var(--accent-user)]" />
            <span className="truncate">{me.status}</span>
            {me.statusExpiresAt && <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{remainingLabel(me.statusExpiresAt, now)}</span>}
          </p>
        )}
      </div>
    </div>
  )
}

export function SettingsView() {
  const { theme } = useTheme()
  const switchTheme = useThemeTransition()
  const mounted = useMounted()
  const { profile, people = [] } = useViewer()
  const me = useMe()
  const now = useNow()
  const saveLater = useDebouncedSave()
  const [name, setName] = useState(profile.name)
  const [bio, setBio] = useState(profile.bio)
  const [status, setStatus] = useState(profile.status)
  const [expiry, setExpiry] = useState<ExpiryKey>(profile.statusExpiresAt ? "4h" : "never")
  const [track, setTrack] = useState(profile.nowPlaying ?? { title: "", artist: "" })

  useEffect(() => {
    const t = setTimeout(() => {
      setName(profile.name)
      setBio(profile.bio)
      setStatus(profile.status)
      setTrack(profile.nowPlaying ?? { title: "", artist: "" })
    }, 0)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.username])

  const style = (patch: Partial<typeof profile>) => {
    viewerActions.updateProfile(patch)
    saveLater(patch)
  }

  const saveProfile = async () => {
    const opt = EXPIRY.find((e) => e.value === expiry)!
    const statusExpiresAt = status.trim() && opt.ms ? new Date(now + opt.ms).toISOString() : null
    const patch = { name: name.trim() || profile.name, bio, status: status.trim(), statusExpiresAt }
    viewerActions.updateProfile(patch)
    const res = await updateProfile(patch)
    if (res.ok) toast.success("Профіль збережено", { description: res.mock && isMockMode ? "Демо-режим: збережено в цьому браузері" : undefined })
    else toast.error(res.error)
  }

  const candidates = isMockMode ? users.filter((u) => u.id !== currentUser.id && !u.isPrivate) : people.filter((u) => u.id !== me.id)
  const toggleTop = (id: string) => {
    const has = profile.top4.includes(id)
    if (!has && profile.top4.length >= 4) {
      toast("У топі лише 4 місця", { description: "Приберіть когось, щоб додати нову людину." })
      return
    }
    style({ top4: has ? profile.top4.filter((x) => x !== id) : [...profile.top4, id] })
  }

  const connected = (profile as { spotifyConnected?: boolean }).spotifyConnected

  return (
    <>
      <Card id="profile" className="scroll-mt-20 gap-0 py-0">
        <CardHeader className="pt-5">
          <CardTitle>Профіль</CardTitle>
          <CardDescription>Так вас бачать інші. Нік змінюється лише під час реєстрації.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 pt-4 pb-5 sm:grid-cols-2">
          {!isMockMode && <ProfilePhotos />}
          <div className="grid gap-1.5">
            <Label htmlFor="name">Ім&apos;я</Label>
            <Input id="name" value={name} maxLength={50} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="username">Нік</Label>
            <div className="flex h-9 overflow-hidden rounded-md border border-input bg-subtle">
              <span className="flex items-center border-r px-3 font-mono text-xs text-muted-foreground">lumyn.space/</span>
              <input id="username" value={profile.username} readOnly className="min-w-0 flex-1 bg-transparent px-3 text-sm text-muted-foreground outline-none" />
            </div>
          </div>
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="status">Статус</Label>
            <div className="relative">
              <Quote className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input id="status" value={status} maxLength={140} onChange={(e) => setStatus(e.target.value)} className="pl-8" placeholder="чим живете зараз?" />
              <div className="flex flex-wrap gap-1.5 pt-1">
                {STATUS_OPTIONS.map((s) => (
                  <button key={s.label} type="button" onClick={() => setStatus(s.label)} className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs hover:bg-muted", status === s.label && "bg-muted")}>
                    <s.icon className="size-3" />
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Timer className="size-3.5" /> Зникне через</span>
              <Segmented id="expiry" value={expiry} onChange={setExpiry} options={EXPIRY.map((e) => ({ value: e.value, label: e.label }))} />
            </div>
          </div>
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="bio">Про себе</Label>
            <Textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)} maxLength={300} className="min-h-24" />
          </div>
        </CardContent>
        <CardFooter className="justify-between py-3">
          <span className="text-sm text-muted-foreground tabular">{bio.length}/300</span>
          <Button size="sm" onClick={saveProfile}>Зберегти</Button>
        </CardFooter>
      </Card>

      <Card id="style" className="scroll-mt-20 gap-0 py-0">
        <CardHeader className="pt-5">
          <CardTitle>Стиль профілю</CardTitle>
          <CardDescription>Акцент фарбує банер, кнопки й підсвітку ваших дописів у чужих стрічках. Зберігається одразу.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 pt-4 pb-5 lg:grid-cols-[1fr_260px]">
          <div className="space-y-6">
            <div>
              <Label className="mb-2.5">Акцент</Label>
              <div className="flex flex-wrap items-center gap-2.5">
                {ACCENTS.map((a) => {
                  const active = profile.accentColor === a.value
                  return (
                    <button key={a.value} type="button" onClick={() => style({ accentColor: a.value })} aria-label={a.name} aria-pressed={active} title={a.name} className="relative grid size-9 place-items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      {active && <motion.span layoutId="accent-ring" transition={{ type: "spring", stiffness: 500, damping: 32 }} className="absolute inset-0 rounded-full ring-2" style={{ ["--tw-ring-color" as string]: a.value }} />}
                      <span className="size-7 rounded-full shadow-inner transition-transform hover:scale-110" style={{ background: a.value }} />
                      {active && <Check className="absolute size-3.5" style={{ color: a.value === "#a3e635" || a.value === "#ffb224" || a.value === "#7dd3fc" ? "#000" : "#fff" }} />}
                    </button>
                  )
                })}
                <label className="relative grid size-9 cursor-pointer place-items-center rounded-full border border-dashed text-muted-foreground transition-colors hover:text-foreground" title="Свій колір">
                  <Pipette className="size-4" />
                  <input type="color" value={profile.accentColor} onChange={(e) => isHexColor(e.target.value) && style({ accentColor: e.target.value.toLowerCase() })} className="absolute inset-0 cursor-pointer opacity-0" aria-label="Свій колір" />
                </label>
                <span className="font-mono text-xs text-muted-foreground">{profile.accentColor}</span>
              </div>
            </div>

            <div style={accentVars(profile.accentColor)}>
              <Label className="mb-2.5">Банер</Label>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {BANNERS.map((b) => {
                  const active = profile.bannerStyle === b.value
                  return (
                    <button key={b.value} type="button" onClick={() => style({ bannerStyle: b.value })} className="group text-left outline-none">
                      <span className={cn("relative block h-14 overflow-hidden rounded-lg ring-offset-2 ring-offset-background transition-shadow", active ? "ring-2 ring-[var(--accent-user)]" : "ring-1 ring-border group-hover:ring-foreground/30")}>
                        <BannerArt style={b.value} coverUrl={isMockMode ? currentUser.coverUrl : me.coverUrl} />
                      </span>
                      <span className={cn("mt-1.5 block text-xs", active ? "font-medium" : "text-muted-foreground")}>{b.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <Label className="mb-1">Топ-4</Label>
              <p className="mb-2.5 text-xs text-muted-foreground">Четверо людей на видноті у профілі. Порядок — як оберете.</p>
              <div className="flex flex-wrap gap-2">
                {candidates.length === 0 && <p className="text-xs text-muted-foreground">Підпишіться на когось — і тут з&apos;являться люди для Топ-4.</p>}
                {candidates.map((u) => {
                  const idx = profile.top4.indexOf(u.id)
                  const on = idx >= 0
                  return (
                    <button key={u.id} type="button" onClick={() => toggleTop(u.id)} aria-pressed={on} className={cn("flex items-center gap-2 rounded-full border py-1 pr-3 pl-1 text-sm transition-colors", on ? "border-foreground/30 bg-muted" : "text-muted-foreground hover:text-foreground")}>
                      <span className="relative">
                        <UserAvatar user={u} size="sm" className="size-6" />
                        {on && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute -top-1 -right-1 grid size-3.5 place-items-center rounded-full bg-foreground font-mono text-[9px] text-background">{idx + 1}</motion.span>}
                      </span>
                      {u.name.split(" ")[0]}
                      {isMockMode && followingIds.has(u.id) && !on && <span className="text-[10px] text-muted-foreground">· читаєте</span>}
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <Label className="mb-2.5"><Music2 className="size-4" /> Зараз грає</Label>
              {connected ? (
  <div className="flex items-center gap-3">
    <span className="inline-flex items-center gap-1.5 text-sm text-green-500"><Music2 className="size-4" /> Spotify підключено</span>
    <Button variant="ghost" size="sm" onClick={async () => {
      await updateProfile({ widgets: { spotify_token: null, spotify_refresh: null } } as Parameters<typeof updateProfile>[0])
      toast.success("Spotify відключено")
      location.reload()
    }}>Від&apos;єднати</Button>
  </div>
) : (
                <div className="flex items-center gap-3">
  <Button variant="secondary" size="sm" asChild>
    <Link href="/api/spotify/login" prefetch={false}><Music2 className="size-4" /> Підключити Spotify</Link>
  </Button>
  <span className="text-xs text-muted-foreground">або введи вручну</span>
</div>
              )}
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <Input value={track.title} maxLength={60} placeholder="Трек" onChange={(e) => setTrack((t) => ({ ...t, title: e.target.value }))} onBlur={() => style({ nowPlaying: track.title.trim() ? { title: track.title.trim(), artist: track.artist.trim() } : null })} />
                <Input value={track.artist} maxLength={60} placeholder="Виконавець" onChange={(e) => setTrack((t) => ({ ...t, artist: e.target.value }))} onBlur={() => style({ nowPlaying: track.title.trim() ? { title: track.title.trim(), artist: track.artist.trim() } : null })} />
              </div>
            </div>
          </div>
          <div className="lg:sticky lg:top-20 lg:self-start">
            <p className="mb-2 text-xs font-medium text-muted-foreground">Попередній перегляд</p>
            <StylePreview />
          </div>
        </CardContent>
      </Card>

      <Card id="appearance" className="scroll-mt-20 gap-0 py-0">
        <CardHeader className="pt-5">
          <CardTitle>Тема</CardTitle>
          <CardDescription>Як виглядає Lumyn на цьому пристрої.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-3 gap-3 pt-4 pb-5">
          {(["system", "light", "dark"] as const).map((m) => {
            const active = mounted && theme === m
            return (
              <button key={m} onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); switchTheme(m, { x: r.left + r.width / 2, y: r.top + r.height / 2 }) }} className="group text-left outline-none">
                <div className={cn("relative rounded-lg p-0.5 transition-shadow", active ? "ring-2 ring-brand" : "ring-1 ring-transparent group-hover:ring-border")}>
                  <ThemePreview mode={m} />
                </div>
                <p className={cn("mt-2 text-sm", active ? "font-medium" : "text-muted-foreground")}>{m === "system" ? "Як у системі" : m === "light" ? "Світла" : "Темна"}</p>
              </button>
            )
          })}
        </CardContent>
      </Card>

      <Card id="notifications" className="scroll-mt-20 gap-0 py-0">
        <CardHeader className="pt-5">
          <CardTitle>Сповіщення</CardTitle>
          <CardDescription>Лише справжні події. Без «вас давно не було», без стріків і фейкових лічильників.</CardDescription>
        </CardHeader>
        <CardContent className="divide-y pt-2 pb-2">
          {[["Світло на ваших дописах", true], ["Відповіді та згадки", true], ["Нові читачі й запити", true], ["Друзі приєдналися до Lumyn", true], ["Особисті повідомлення", true]].map(([label, on]) => (
            <label key={label as string} className="flex items-center justify-between py-3 text-sm">
              {label}
              <Switch defaultChecked={on as boolean} />
            </label>
          ))}
        </CardContent>
      </Card>

      <Card id="danger" className="scroll-mt-20 gap-0 border-destructive/40 py-0">
        <CardHeader className="pt-5">
          <CardTitle>Видалити акаунт</CardTitle>
          <CardDescription>Профіль, дописи й повідомлення буде видалено назавжди. Цю дію неможливо скасувати.</CardDescription>
        </CardHeader>
        <CardFooter className="mt-5 justify-between border-destructive/30 bg-destructive/5 py-3">
          {isMockMode ? <Button variant="ghost" size="sm" onClick={() => { viewerActions.reset(); toast("Демо-дані скинуто") }}>Скинути демо</Button> : <span />}
          {isMockMode ? <Button variant="destructive" size="sm" onClick={() => toast.error("У демо-режимі акаунт не видаляється")}>Видалити акаунт</Button> : <DeleteAccountButton />}
        </CardFooter>
      </Card>
    </>
  )
}