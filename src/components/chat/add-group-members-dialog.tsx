"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Check, Loader2, Search } from "lucide-react"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { UserAvatar } from "@/components/user-avatar"
import { Button } from "@/components/ui/button"
import { addGroupMembers, searchPeople } from "@/lib/actions/social"

type Person = { id: string; username: string; name: string; avatarUrl: string | null }

/** «Додати до групи»: пошук людей, мультивибір, без тих, хто вже в групі. */
export function AddGroupMembersDialog({
  open,
  onOpenChange,
  convId,
  existingIds,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  convId: string
  /** id усіх поточних учасників (включно зі мною) */
  existingIds: string[]
}) {
  const router = useRouter()
  const [q, setQ] = useState("")
  const [people, setPeople] = useState<Person[]>([])
  const [loading, setLoading] = useState(false)
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
    setQ("")
    setPicked([])
  }

  const toggle = (p: Person) => setPicked((list) => (list.some((x) => x.id === p.id) ? list.filter((x) => x.id !== p.id) : [...list, p]))

  const confirm = () =>
    startTransition(async () => {
      const res = await addGroupMembers(convId, picked.map((p) => p.id))
      if (res.ok) {
        toast.success(res.data === 0 ? "Усі вже в групі" : `Додано: ${res.data ?? picked.length}`)
        close()
        router.refresh()
      } else toast.error(res.error)
    })

  const visible = people.filter((p) => !existingIds.includes(p.id))

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(v) : close())}>
      <DialogContent className="gap-3 sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Додати до групи</DialogTitle>
          <DialogDescription>Оберіть людей, яких потрібно додати.</DialogDescription>
        </DialogHeader>

        <label className="flex h-10 items-center gap-2 rounded-md border bg-subtle px-3 text-sm focus-within:border-ring">
          <Search className="size-4 text-muted-foreground" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Кого додати?"
            className="flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
          />
        </label>

        {picked.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {picked.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => toggle(p)}
                className="inline-flex items-center gap-1.5 rounded-full border bg-muted px-2.5 py-1 text-xs font-medium hover:bg-subtle"
              >
                {p.name} <span aria-hidden>×</span>
              </button>
            ))}
          </div>
        )}

        <ul className="max-h-80 overflow-y-auto">
          {visible.map((p) => {
            const chosen = picked.some((x) => x.id === p.id)
            return (
              <li key={p.id}>
                <button type="button" onClick={() => toggle(p)} className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-subtle">
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
          {!loading && visible.length === 0 && <li className="px-2 py-6 text-center text-sm text-muted-foreground">Нікого не знайдено</li>}
        </ul>

        <Button className="rounded-full" disabled={!picked.length || pending} onClick={confirm}>
          {pending ? <Loader2 className="animate-spin" /> : `Додати${picked.length ? ` · ${picked.length}` : ""}`}
        </Button>
      </DialogContent>
    </Dialog>
  )
}