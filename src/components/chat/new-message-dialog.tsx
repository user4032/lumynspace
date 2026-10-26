"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Check, Loader2, Search, Users2 } from "lucide-react"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { UserAvatar } from "@/components/user-avatar"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { createGroupConversation, searchPeople } from "@/lib/actions/social"
import { isMockMode } from "@/lib/env"

type Person = { id: string; username: string; name: string; avatarUrl: string | null }

/** «Нове повідомлення»: пряма розмова (нік) або група (назва + люди) */
export function NewMessageDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const router = useRouter()
  const [tab, setTab] = useState<"dm" | "group">("dm")
  const [q, setQ] = useState("")
  const [people, setPeople] = useState<Person[]>([])
  const [loading, setLoading] = useState(false)
  // група
  const [groupTitle, setGroupTitle] = useState("")
  const [picked, setPicked] = useState<Person[]>([])
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    if (!open) return
    let alive = true
    const t = setTimeout(async () => {
      setLoading(true)
      const res = await searchPeople(q)
      if (!alive) return
      setLoading(false)
      setPeople(res.ok ? (res.data ?? []) : [])
    }, 250)
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [q, open])

  const close = () => {
    onOpenChange(false)
    setTab("dm")
    setQ("")
    setGroupTitle("")
    setPicked([])
  }

  const createGroup = () => {
    if (isMockMode) return toast("Групи працюють лише з Supabase")
    startTransition(async () => {
      const res = await createGroupConversation(groupTitle, picked.map((p) => p.id))
      if (res.ok && res.data) {
        close()
        router.push(`/messages/${res.data}`)
      } else toast.error(res.ok ? "Не вдалося створити групу" : res.error)
    })
  }

  const togglePicked = (p: Person) =>
    setPicked((list) => (list.some((x) => x.id === p.id) ? list.filter((x) => x.id !== p.id) : [...list, p]))

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(v) : close())}>
      <DialogContent className="gap-3 sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Нове повідомлення</DialogTitle>
          <DialogDescription>Пряма розмова або група для кількох людей.</DialogDescription>
        </DialogHeader>

        <div className="flex gap-1 rounded-lg bg-muted p-1 text-sm" role="tablist">
          {(
            [
              { key: "dm", label: "Одна людина" },
              { key: "group", label: "Група" },
            ] as const
          ).map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "flex-1 rounded-md px-3 py-1.5 font-medium transition-colors",
                tab === t.key ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "group" && (
          <label className="flex h-10 items-center gap-2 rounded-md border bg-subtle px-3 text-sm focus-within:border-ring">
            <Users2 className="size-4 text-muted-foreground" />
            <input
              autoFocus
              value={groupTitle}
              maxLength={80}
              onChange={(e) => setGroupTitle(e.target.value)}
              placeholder="Назва групи"
              className="flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
            />
          </label>
        )}

        <label className="flex h-10 items-center gap-2 rounded-md border bg-subtle px-3 text-sm focus-within:border-ring">
          <Search className="size-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={tab === "dm" ? "Кому написати?" : "Кого додати до групи?"}
            className="flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
          />
        </label>

        {tab === "group" && picked.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {picked.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => togglePicked(p)}
                className="inline-flex items-center gap-1.5 rounded-full border bg-muted px-2.5 py-1 text-xs font-medium hover:bg-subtle"
              >
                {p.name} <span aria-hidden>×</span>
              </button>
            ))}
          </div>
        )}

        <ul className="max-h-80 overflow-y-auto">
          {people.map((p) => {
            const chosen = tab === "group" && picked.some((x) => x.id === p.id)
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => {
                    if (tab === "dm") {
                      close()
                      router.push(`/messages/${p.username}`)
                    } else togglePicked(p)
                  }}
                  className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-subtle"
                >
                  <UserAvatar user={{ username: p.username, name: p.name, avatarUrl: p.avatarUrl }} size="md" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{p.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">@{p.username}</span>
                  </span>
                  {chosen && (
                    <span className="grid size-5 shrink-0 place-items-center rounded-full bg-brand text-brand-foreground">
                      <Check className="size-3" strokeWidth={3} />
                    </span>
                  )}
                </button>
              </li>
            )
          })}
          {!loading && people.length === 0 && <li className="px-2 py-6 text-center text-sm text-muted-foreground">Нікого не знайдено</li>}
        </ul>

        {tab === "group" && (
          <Button className="rounded-full" disabled={!groupTitle.trim() || !picked.length || pending} onClick={createGroup}>
            {pending ? <Loader2 className="animate-spin" /> : `Створити групу${picked.length ? ` · ${picked.length + 1}` : ""}`}
          </Button>
        )}
      </DialogContent>
    </Dialog>
  )
}
