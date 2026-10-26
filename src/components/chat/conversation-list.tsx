"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { PenSquare, Search, Users } from "lucide-react"
import type { Conversation } from "@/types"
import { Button } from "@/components/ui/button"
import { UserAvatar } from "@/components/user-avatar"
import { timeAgo } from "@/lib/format"
import { useNow } from "@/hooks/useNow"
import { cn } from "@/lib/utils"
import { isMockMode } from "@/lib/env"
import { useRealtime } from "@/hooks/useRealtime"
import { NewMessageDialog } from "./new-message-dialog"

/** Аватар розмови: група — коло з іконкою, пряма — аватар співрозмовника */
function ConversationAvatar({ c }: { c: Conversation }) {
  if (c.group)
    return (
      <span className="relative inline-flex size-10 shrink-0 items-center justify-center rounded-full border bg-subtle">
        <Users className="size-4.5 text-muted-foreground" />
        <span className="absolute -right-0.5 -bottom-0.5 grid size-4.5 place-items-center rounded-full border-2 border-background bg-muted">
          <UserAvatar user={c.group.members[0] ?? c.user} size="md" className="size-3 rounded-full" />
        </span>
      </span>
    )
  return <UserAvatar user={c.user} size="lg" showOnline />
}

export function ConversationList({ conversations, activeId, meId = "u_me" }: { conversations: Conversation[]; activeId?: string; meId?: string }) {
  const now = useNow()
  const router = useRouter()
  const [newOpen, setNewOpen] = useState(false)
  const [query, setQuery] = useState("")
  // Supabase: нове повідомлення в будь-якій моїй розмові (RLS) → оновити список і лічильники
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (refreshTimer.current) clearTimeout(refreshTimer.current) }, [])
  useRealtime<{ id: string }>({
    table: "messages",
    enabled: !isMockMode,
    onInsert: () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current)
      refreshTimer.current = setTimeout(() => router.refresh(), 400)
    },
  })
  const q = query.trim().toLowerCase()
  const shown = q
    ? conversations.filter(
        (c) =>
          (c.group ? c.group.title : c.user.name).toLowerCase().includes(q) ||
          c.user.username.includes(q) ||
          (c.group?.members.some((m) => m.name.toLowerCase().includes(q) || m.username.includes(q)) ?? false)
      )
    : conversations
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 shrink-0 items-center justify-between border-b px-4">
        <h1 className="text-[17px] font-semibold tracking-tight">Повідомлення</h1>
        <Button variant="ghost" size="icon-sm" aria-label="Нове повідомлення" onClick={() => !isMockMode && setNewOpen(true)}>
          <PenSquare />
        </Button>
      </div>
      <div className="p-3">
        <label className="flex h-9 items-center gap-2 rounded-md border bg-subtle px-3 text-sm focus-within:border-ring">
          <Search className="size-4 text-muted-foreground" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Пошук розмов" className="flex-1 bg-transparent outline-none placeholder:text-muted-foreground" />
        </label>
      </div>
      {conversations.length === 0 && (
        <p className="px-4 py-10 text-center text-sm text-muted-foreground">Поки немає розмов</p>
      )}
      <ul className="flex-1 overflow-y-auto px-2 pb-2 no-scrollbar">
        {shown.map((c) => {
          const last = c.messages[c.messages.length - 1]
          const active = c.id === activeId
          return (
            <li key={c.id}>
              <Link
                href={`/messages/${c.id}`}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-md px-2.5 py-2.5 transition-colors",
                  active ? "bg-muted" : "hover:bg-subtle"
                )}
              >
                <ConversationAvatar c={c} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className={cn("truncate text-sm", c.unread ? "font-semibold" : "font-medium")}>
                      {c.group ? `${c.group.title} · ${c.group.members.length + 1}` : c.user.name}
                    </span>
                    <span className="shrink-0 font-mono text-[11px] text-muted-foreground">{last && now ? timeAgo(last.createdAt, now) : ""}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className={cn("truncate text-[13px]", c.unread ? "text-foreground" : "text-muted-foreground")}>
                      {last?.senderId === meId && <span className="text-muted-foreground">Ви: </span>}
                      {!last?.content && last?.attachments?.length ? "Вкладення" : last?.content}
                    </span>
                    {c.unread > 0 && (
                      <span className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-brand px-1 font-mono text-[10px] font-semibold text-brand-foreground">
                        {c.unread}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            </li>
          )
        })}
      </ul>
      {!isMockMode && <NewMessageDialog open={newOpen} onOpenChange={setNewOpen} />}
    </div>
  )
}
