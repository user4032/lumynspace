"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Search } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { UserAvatar } from "@/components/user-avatar"
import { searchPeople } from "@/lib/actions/social"

type Person = { id: string; username: string; name: string; avatarUrl: string | null }

/** «Нове повідомлення»: пошук людини → /messages/<нік> (розмова створиться з першим повідомленням) */
export function NewMessageDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const router = useRouter()
  const [q, setQ] = useState("")
  const [people, setPeople] = useState<Person[]>([])
  const [loading, setLoading] = useState(false)

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-3 sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Нове повідомлення</DialogTitle>
          <DialogDescription>Знайдіть людину за ім&apos;ям або ніком.</DialogDescription>
        </DialogHeader>
        <label className="flex h-10 items-center gap-2 rounded-md border bg-subtle px-3 text-sm focus-within:border-ring">
          <Search className="size-4 text-muted-foreground" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Кому написати?"
            className="flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
          />
        </label>
        <ul className="max-h-80 overflow-y-auto">
          {people.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => {
                  onOpenChange(false)
                  router.push(`/messages/${p.username}`)
                }}
                className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-subtle"
              >
                <UserAvatar
                  user={{ username: p.username, name: p.name, avatarUrl: p.avatarUrl }}
                  size="md"
                />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{p.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">@{p.username}</span>
                </span>
              </button>
            </li>
          ))}
          {!loading && people.length === 0 && <li className="px-2 py-6 text-center text-sm text-muted-foreground">Нікого не знайдено</li>}
        </ul>
      </DialogContent>
    </Dialog>
  )
}
