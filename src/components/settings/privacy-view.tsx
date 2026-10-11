"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { Check, Copy, Lock, Plus, ShieldAlert, Ticket, VolumeX } from "lucide-react"
import type { DmPolicy, User } from "@/types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { UserAvatar } from "@/components/user-avatar"
import { Segmented } from "@/components/settings/settings-nav"
import { myInvites, users } from "@/lib/mock-data"
import { isMinor, useViewer, viewerActions } from "@/lib/viewer-store"
import { useNow } from "@/hooks/useNow"
import { createInvite, updatePrivacy } from "@/lib/actions/viewer"
import { useModeration } from "@/components/moderation/use-moderation"
import { isMockMode } from "@/lib/env"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { PUBLIC_PROFILE_COLUMNS, profileRowToUser, type PublicProfileRow } from "@/lib/profiles"

const demoById = new Map(users.map((u) => [u.id, u]))

type InviteItem = { code: string; usedBy: User | null }

async function fetchMyInvites(): Promise<InviteItem[] | null> {
  const supabase = getSupabaseBrowserClient()
  if (!supabase) return null
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return null
  const { data } = await supabase
    .from("invites")
    .select("code, used_by, created_at")
    .eq("inviter_id", auth.user.id)
    .order("created_at", { ascending: true })
  const rows = data ?? []
  const usedIds = rows.map((r) => r.used_by).filter((x): x is string => Boolean(x))
  const { data: profs } = usedIds.length
    ? await supabase.from("profiles").select(PUBLIC_PROFILE_COLUMNS).in("id", usedIds)
    : { data: [] }
  const byId = new Map(((profs ?? []) as PublicProfileRow[]).map((p) => [p.id, profileRowToUser(p)]))
  return rows.map((r) => ({ code: r.code, usedBy: r.used_by ? (byId.get(r.used_by) ?? null) : null }))
}

/** Мої інвайти: у демо — мок, із Supabase — таблиця invites (RLS: лише свої) */
function useMyInvites() {
  const [items, setItems] = useState<InviteItem[]>(isMockMode ? myInvites : [])
  useEffect(() => {
    if (isMockMode) return
    let cancelled = false
    void fetchMyInvites().then((list) => {
      if (!cancelled && list) setItems(list)
    })
    return () => {
      cancelled = true
    }
  }, [])
  const reload = async () => {
    const list = await fetchMyInvites()
    if (list) setItems(list)
  }
  return { items, reload }
}

const DM_OPTIONS: { value: DmPolicy; label: string }[] = [
  { value: "everyone", label: "Усі" },
  { value: "followers", label: "Читачі" },
  { value: "nobody", label: "Ніхто" },
]

export function PrivacyView() {
  const { privacy, blocked, muted, people = [] } = useViewer()
  const byId = isMockMode ? demoById : new Map(people.map((u) => [u.id, u]))
  const invites = useMyInvites()
  const [creating, setCreating] = useState(false)
  const newInvite = async () => {
    setCreating(true)
    const res = await createInvite()
    setCreating(false)
    if (!res.ok) return toast.error(res.error)
    toast.success(`Інвайт ${res.data?.code} створено`)
    void invites.reload()
  }
  const { block, mute } = useModeration()
  const now = useNow()
  const minor = isMinor(privacy.birthYear, new Date(now).getFullYear())
  const [copied, setCopied] = useState<string | null>(null)

  const set = async (patch: { isPrivate?: boolean; dmPolicy?: DmPolicy; hideFollowing?: boolean }) => {
    viewerActions.updatePrivacy(patch)
    const res = await updatePrivacy(patch)
    if (!res.ok) toast.error(res.error)
  }

  const copy = (code: string) => {
    void navigator.clipboard?.writeText(code).catch(() => {})
    setCopied(code)
    setTimeout(() => setCopied((c) => (c === code ? null : c)), 1500)
  }

  return (
    <>
      <Card id="account" className="gap-0 py-0">
        <CardHeader className="pt-5">
          <CardTitle>Приватний акаунт</CardTitle>
          <CardDescription>Дописи бачать лише схвалені читачі. Нові підписки стають запитами.</CardDescription>
        </CardHeader>
        <CardContent className="pt-4 pb-5">
          <label className="flex items-center justify-between gap-4 rounded-lg border px-4 py-3">
            <span className="flex items-start gap-3">
              <Lock className="mt-0.5 size-4 text-muted-foreground" />
              <span>
                <span className="block text-sm font-medium">Закритий профіль</span>
                <span className="block text-xs text-muted-foreground">
                  {minor ? "До 18 років увімкнено завжди — це не вимкнути." : "Можна змінити будь-коли. Запити, що чекають, схвалимо автоматично, якщо відкриєте профіль."}
                </span>
              </span>
            </span>
            <Switch checked={minor || privacy.isPrivate} disabled={minor} onCheckedChange={(v) => void set({ isPrivate: v })} aria-label="Приватний акаунт" />
          </label>
        </CardContent>
      </Card>

      <Card className="gap-0 py-0">
        <CardHeader className="pt-5">
          <CardTitle>Хто може писати вам</CardTitle>
          <CardDescription>Заблоковані не можуть писати ніколи — незалежно від цього налаштування.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 pt-4 pb-5">
          <Segmented
            id="dm"
            value={privacy.dmPolicy}
            onChange={(v) => void set({ dmPolicy: v })}
            options={DM_OPTIONS.map((o) => ({
              ...o,
              disabled: minor && o.value === "everyone",
              hint: minor && o.value === "everyone" ? "До 18 років «усі» недоступно" : undefined,
            }))}
          />
          <p className="text-xs text-muted-foreground">
            {privacy.dmPolicy === "everyone" && "Повідомлення може надіслати будь-хто."}
            {privacy.dmPolicy === "followers" && "Писати можуть ваші читачі й ті, кого читаєте ви."}
            {privacy.dmPolicy === "nobody" && "Нові розмови не починаються. Наявні чати лишаються."}
          </p>
          <label className="flex items-center justify-between gap-4 border-t pt-3 text-sm">
            Показувати статус «у мережі»
            <Switch checked={privacy.showOnline} onCheckedChange={(v) => viewerActions.updatePrivacy({ showOnline: v })} aria-label="Статус у мережі" />
          </label>
          <label className="flex items-center justify-between gap-4 border-t pt-3 text-sm">
            Приховати, кого я читаю
            <Switch
              checked={privacy.hideFollowing ?? false}
              onCheckedChange={(v) => void set({ hideFollowing: v })}
              aria-label="Приховати список читаю"
            />
          </label>
        </CardContent>
      </Card>

      <Card className="gap-0 py-0">
        <CardHeader className="pt-5">
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="size-4 text-brand" /> Якщо вам менше 18
          </CardTitle>
          <CardDescription>Не обмеження заради обмежень — просто менше шансів, що напише незнайомець.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 pt-4 pb-5 text-sm text-muted-foreground">
          <p>Акаунт автоматично приватний, а повідомлення — лише від читачів. Рік народження вказується один раз.</p>
          <p>Lumyn не показує стріків і «вас давно не було». Якщо щось лякає — поскаржтеся: скарги про безпеку неповнолітніх розглядаємо першими.</p>
          <p className="text-foreground">Потрібна жива людина? 112 — екстрена допомога, 7333 — Lifeline Ukraine (безкоштовно).</p>
        </CardContent>
      </Card>

      <Card className="gap-0 py-0">
        <CardHeader className="pt-5">
          <CardTitle className="flex items-center gap-2">
            <Ticket className="size-4 text-muted-foreground" /> Ваші інвайти
            <span className="font-mono text-xs font-normal text-muted-foreground">
              {isMockMode ? invites.items.filter((i) => !i.usedBy).length : invites.items.length}/5
            </span>
          </CardTitle>
          <CardDescription>П&apos;ять на акаунт. Один код — один друг, і ви одразу читаєте одне одного.</CardDescription>
        </CardHeader>
        <CardContent className="divide-y pt-2 pb-2">
          {!isMockMode && invites.items.length === 0 && (
            <p className="py-3 text-sm text-muted-foreground">Ще немає жодного коду. Створіть перший і надішліть другові.</p>
          )}
          {invites.items.map((inv) => (
            <div key={inv.code} className="flex items-center gap-3 py-2.5">
              <span className={inv.usedBy ? "font-mono text-sm tracking-wider text-muted-foreground line-through" : "font-mono text-sm tracking-wider"}>{inv.code}</span>
              {inv.usedBy ? (
                <Link href={`/${inv.usedBy.username}`} className="ml-auto flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground">
                  приєднався {inv.usedBy.name.split(" ")[0]}
                  <UserAvatar user={inv.usedBy} size="sm" className="size-5" />
                </Link>
              ) : (
                <Button variant="ghost" size="xs" className="ml-auto" onClick={() => copy(inv.code)}>
                  {copied === inv.code ? <Check /> : <Copy />} {copied === inv.code ? "Скопійовано" : "Копіювати"}
                </Button>
              )}
            </div>
          ))}
          {!isMockMode && invites.items.length < 5 && (
            <div className="py-2.5">
              <Button variant="secondary" size="sm" disabled={creating} onClick={() => void newInvite()}>
                <Plus /> Новий інвайт
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <PeopleList
        title="Заблоковані"
        empty="Нікого не заблоковано."
        ids={blocked}
        byId={byId}
        action={(id) => (
          <Button variant="secondary" size="xs" onClick={() => block({ id, username: byId.get(id)?.username ?? id }, false)}>
            Розблокувати
          </Button>
        )}
      />
      <PeopleList
        title="Заглушені"
        icon={<VolumeX className="size-4 text-muted-foreground" />}
        empty="Нікого не заглушено. Людина не дізнається, якщо ви її заглушите."
        ids={muted}
        byId={byId}
        action={(id) => (
          <Button variant="secondary" size="xs" onClick={() => mute({ id, username: byId.get(id)?.username ?? id }, false)}>
            Повернути
          </Button>
        )}
      />
    </>
  )
}

function PeopleList({
  title,
  icon,
  empty,
  ids,
  byId,
  action,
}: {
  title: string
  icon?: React.ReactNode
  empty: string
  ids: string[]
  byId: Map<string, User>
  action: (id: string) => React.ReactNode
}) {
  return (
    <Card className="gap-0 py-0">
      <CardHeader className="pt-5">
        <CardTitle className="flex items-center gap-2">
          {icon}
          {title}
          <span className="font-mono text-xs font-normal text-muted-foreground">{ids.length}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-2 pb-4">
        {ids.length === 0 ? (
          <p className="text-sm text-muted-foreground">{empty}</p>
        ) : (
          <ul className="divide-y">
            {ids.map((id) => {
              const u = byId.get(id)
              return (
                <li key={id} className="flex items-center gap-3 py-2.5">
                  {u ? (
                    <Link href={`/${u.username}`} className="flex min-w-0 flex-1 items-center gap-3">
                      <UserAvatar user={u} size="md" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{u.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">@{u.username}</span>
                      </span>
                    </Link>
                  ) : (
                    <span className="flex-1 font-mono text-sm">{id}</span>
                  )}
                  {action(id)}
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
