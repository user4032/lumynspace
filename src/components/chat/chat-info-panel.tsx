"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState, useTransition } from "react"
import { BellOff, Ban, Flag, LogOut, Users2, X } from "lucide-react"
import { toast } from "sonner"
import type { Conversation, Message } from "@/types"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { UserAvatar } from "@/components/user-avatar"
import { VerifiedBadge } from "@/components/verified-badge"
import { StatusIcon, isStatusIconKey } from "@/components/status-icon"
import { ReportDialog } from "@/components/moderation/report-dialog"
import { useModeration } from "@/components/moderation/use-moderation"
import { leaveGroup } from "@/lib/actions/social"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { formatBytes, useSignedUrls } from "@/lib/chat-files"
import { useNow } from "@/hooks/useNow"
import { splitLegacy } from "./message-body"

/** Панель «Інформація» в чаті: профіль, спільні читачі, медіа й файли, mute, блок/скарга. */
export function ChatInfoPanel({
  conversation,
  convId,
  messages,
  meId,
  blocked,
  onClose,
}: {
  conversation: Conversation
  convId: string
  messages: Message[]
  meId: string
  blocked: boolean
  onClose: () => void
}) {
  const user = conversation.user
  const now = useNow()
  const { block } = useModeration()
  const [reportOpen, setReportOpen] = useState(false)
  const [mutual, setMutual] = useState<number | null>(null)
  const [muted, setMuted] = useState<boolean | null>(null)
  const saved = /^[0-9a-f-]{36}$/i.test(convId)

  useEffect(() => {
    const supabase = getSupabaseBrowserClient()
    if (!supabase || !meId) return
    let cancelled = false
    void (async () => {
      // спільні: ті, кого я читаю, і хто читає співрозмовника
      const { data: mine } = await supabase.from("follows").select("following_id").eq("follower_id", meId).eq("status", "accepted").limit(1000)
      const ids = (mine ?? []).map((r) => r.following_id).filter((id) => id !== user.id)
      let n = 0
      if (ids.length) {
        const { count } = await supabase
          .from("follows")
          .select("follower_id", { count: "exact", head: true })
          .eq("following_id", user.id)
          .eq("status", "accepted")
          .in("follower_id", ids)
        n = count ?? 0
      }
      if (!cancelled) setMutual(n)
      if (saved) {
        const { data, error } = await supabase.from("conversation_members").select("muted" as "user_id").match({ conversation_id: convId, user_id: meId }).maybeSingle()
        if (!cancelled) setMuted(error ? null : Boolean((data as { muted?: boolean } | null)?.muted))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [meId, user.id, convId, saved])

  const toggleMute = async (v: boolean) => {
    const supabase = getSupabaseBrowserClient()
    if (!supabase) return
    setMuted(v)
    const { error } = await supabase.from("conversation_members").update({ muted: v } as never).match({ conversation_id: convId, user_id: meId })
    if (error) {
      setMuted(!v)
      toast.error(error.message)
    } else toast.success(v ? "Сповіщення вимкнено" : "Сповіщення увімкнено")
  }

  const atts = messages.flatMap((m) => m.attachments ?? [])
  const legacy = messages.flatMap((m) => splitLegacy(m.content).images)
  const urls = useSignedUrls(atts.map((a) => a.path))
  const media = [...legacy.map((u) => ({ key: u, src: u })), ...atts.filter((a) => a.kind === "image").map((a) => ({ key: a.path, src: urls[a.path] }))]
  const files = atts.filter((a) => a.kind === "file")
  const statusLive = user.status && (!user.statusExpiresAt || Date.parse(user.statusExpiresAt) > now)

  // Група: назва + учасники (медіа й mute — ті самі)
  if (conversation.group)
    return (
      <aside className="absolute inset-0 z-20 flex flex-col overflow-y-auto bg-background md:static md:w-80 md:shrink-0 md:border-l">
        <div className="flex h-14 shrink-0 items-center justify-between border-b px-4">
          <span className="text-sm font-semibold">Про групу</span>
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Закрити">
            <X />
          </Button>
        </div>
        <div className="flex flex-col items-center gap-1 px-4 pt-6 text-center">
          <span className="grid size-16 place-items-center rounded-full border bg-subtle">
            <Users2 className="size-7 text-muted-foreground" />
          </span>
          <p className="mt-2 font-semibold">{conversation.group.title}</p>
          <p className="text-sm text-muted-foreground">{conversation.group.members.length + 1} учасників</p>
        </div>
        <section className="mt-6 border-t px-2 py-3">
          <h3 className="px-2 text-xs font-medium tracking-wider text-muted-foreground uppercase">Учасники</h3>
          <ul className="mt-2 space-y-0.5">
            <li className="px-2">
              <span className="flex items-center gap-2.5 rounded-md px-1 py-1.5 text-sm">
                <UserAvatar user={{ username: meId, name: "Ви" }} size="md" className="size-8" />
                <span className="font-medium">Ви</span>
              </span>
            </li>
            {conversation.group.members.map((m) => (
              <li key={m.id}>
                <Link href={`/${m.username}`} className="flex items-center gap-2.5 rounded-md px-1 py-1.5 text-sm transition-colors hover:bg-muted">
                  <UserAvatar user={m} size="md" className="size-8" />
                  <span className="min-w-0 flex-1 truncate">
                    <span className="flex items-center gap-1 font-medium">
                      {m.name} {m.verified && <VerifiedBadge className="size-3.5" />}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">@{m.username}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
        <section className="mt-auto border-t px-4 py-4">
          {muted !== null && (
            <label className="flex items-center justify-between gap-3 py-2 text-sm">
              <span className="inline-flex items-center gap-2">
                <BellOff className="size-4" /> Вимкнути сповіщення
              </span>
              <Switch checked={muted} onCheckedChange={(v) => void toggleMute(v)} />
            </label>
          )}
          <LeaveGroupButton convId={convId} />
        </section>
      </aside>
    )

  return (
    <aside className="absolute inset-0 z-20 flex flex-col overflow-y-auto bg-background md:static md:w-80 md:shrink-0 md:border-l">
      <div className="flex h-14 shrink-0 items-center justify-between border-b px-4">
        <span className="text-sm font-semibold">Інформація</span>
        <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Закрити">
          <X />
        </Button>
      </div>
      <div className="flex flex-col items-center gap-1 px-4 pt-6 text-center">
        <UserAvatar user={user} size="xl" />
        <p className="mt-2 flex items-center gap-1 font-semibold">
          {user.name} {user.verified && <VerifiedBadge />}
        </p>
        <p className="text-sm text-muted-foreground">@{user.username}</p>
        {statusLive && (
          <p className="mt-2 inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs">
            {isStatusIconKey(user.statusIcon) && <StatusIcon icon={user.statusIcon} className="size-3.5" />}
            <span className="truncate">{user.status}</span>
          </p>
        )}
        {user.bio && <p className="mt-2 text-sm [overflow-wrap:anywhere]">{user.bio}</p>}
        <p className="mt-2 text-xs text-muted-foreground">
          {mutual === null ? "…" : mutual === 0 ? "Немає спільних знайомих" : `${mutual} спільних знайомих`}
        </p>
        <Button asChild variant="outline" size="sm" className="mt-3">
          <Link href={`/${user.username}`}>Профіль</Link>
        </Button>
      </div>

      <section className="mt-6 border-t px-4 py-4">
        <h3 className="text-xs font-medium tracking-wider text-muted-foreground uppercase">Медіа</h3>
        {media.length ? (
          <div className="mt-3 grid grid-cols-3 gap-1">
            {media.slice(-30).reverse().map((m) =>
              m.src ? (
                <a key={m.key} href={m.src} target="_blank" rel="noopener noreferrer" className="block aspect-square overflow-hidden rounded-md bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element -- підписані URL */}
                  <img src={m.src} alt="" loading="lazy" className="size-full object-cover" />
                </a>
              ) : (
                <div key={m.key} className="aspect-square animate-pulse rounded-md bg-muted" />
              ),
            )}
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">Поки немає</p>
        )}
        {files.length > 0 && (
          <>
            <h3 className="mt-5 text-xs font-medium tracking-wider text-muted-foreground uppercase">Файли</h3>
            <ul className="mt-2 space-y-1">
              {files.slice(-20).reverse().map((f) => (
                <li key={f.path}>
                  <a href={urls[f.path] ? `${urls[f.path]}&download=${encodeURIComponent(f.name)}` : undefined} className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted">
                    <span className="truncate">{f.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{formatBytes(f.size)}</span>
                  </a>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="border-t px-4 py-4">
        {muted !== null && (
          <label className="flex items-center justify-between gap-3 py-2 text-sm">
            <span className="inline-flex items-center gap-2">
              <BellOff className="size-4" /> Вимкнути сповіщення
            </span>
            <Switch checked={muted} onCheckedChange={(v) => void toggleMute(v)} />
          </label>
        )}
        <button type="button" onClick={() => block(user, !blocked)} className="flex w-full items-center gap-2 rounded-md py-2 text-sm text-destructive hover:underline">
          <Ban className="size-4" /> {blocked ? "Розблокувати" : "Заблокувати"} @{user.username}
        </button>
        <button type="button" onClick={() => setReportOpen(true)} className="flex w-full items-center gap-2 rounded-md py-2 text-sm text-destructive hover:underline">
          <Flag className="size-4" /> Поскаржитись
        </button>
      </section>
      <ReportDialog open={reportOpen} onOpenChange={setReportOpen} targetType="profile" targetId={user.id} subject={`профіль @${user.username}`} />
    </aside>
  )
}

function LeaveGroupButton({ convId }: { convId: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const leave = () =>
    startTransition(async () => {
      const res = await leaveGroup(convId)
      if (res.ok) {
        toast("Ви вийшли з групи")
        router.push("/messages")
        router.refresh()
      } else toast.error(res.error)
    })
  return (
    <button type="button" onClick={leave} disabled={pending} className="flex w-full items-center gap-2 rounded-md py-2 text-sm text-destructive hover:underline disabled:opacity-50">
      <LogOut className="size-4" /> Вийти з групи
    </button>
  )
}
