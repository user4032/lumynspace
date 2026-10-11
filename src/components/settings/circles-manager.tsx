"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { Check, Loader2, Plus, Trash2, Users2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { UserAvatar } from "@/components/user-avatar"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { useViewer } from "@/lib/viewer-store"
import { plural } from "@/lib/format"
import { cn } from "@/lib/utils"

type CircleItem = { id: string; name: string; members: string[] }

/**
 * Кола — власні аудиторії для дописів (аудиторія «circle» у композері).
 * Працює напряму через браузерний клієнт: RLS дозволяє лише власнику бачити й змінювати свої кола.
 */
export function CirclesManager() {
  const { people = [], blocked } = useViewer()
  const [circles, setCircles] = useState<CircleItem[] | null>(null)
  const [name, setName] = useState("")
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)

  const load = useCallback(async () => {
    const supabase = getSupabaseBrowserClient()
    if (!supabase) return setCircles([])
    const { data, error } = await supabase
      .from("circles")
      .select("id, name, circle_members(user_id)")
      .order("created_at", { ascending: true })
    if (error) {
      toast.error("Не вдалося завантажити кола")
      return setCircles([])
    }
    setCircles(
      ((data ?? []) as unknown as { id: string; name: string; circle_members: { user_id: string }[] | null }[]).map((c) => ({
        id: c.id,
        name: c.name,
        members: (c.circle_members ?? []).map((m) => m.user_id),
      }))
    )
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- початкове завантаження з Supabase
    void load()
  }, [load])

  const create = async () => {
    const supabase = getSupabaseBrowserClient()
    const n = name.trim()
    if (!supabase || !n) return
    if (n.length > 40) return void toast.error("Назва — до 40 символів")
    setBusy(true)
    const { data, error } = await supabase.from("circles").insert({ name: n }).select("id, name").single()
    setBusy(false)
    if (error || !data) return void toast.error("Не вдалося створити коло")
    setCircles((cs) => [...(cs ?? []), { id: data.id, name: data.name, members: [] }])
    setName("")
    setEditing(data.id)
  }

  const remove = async (c: CircleItem) => {
    if (!window.confirm(`Видалити коло «${c.name}»? Дописи для цього кола теж буде видалено.`)) return
    const supabase = getSupabaseBrowserClient()
    if (!supabase) return
    const { error } = await supabase.from("circles").delete().eq("id", c.id)
    if (error) return void toast.error("Не вдалося видалити коло")
    setCircles((cs) => (cs ?? []).filter((x) => x.id !== c.id))
    toast(`Коло «${c.name}» видалено`)
  }

  const toggleMember = async (circleId: string, userId: string, on: boolean) => {
    const supabase = getSupabaseBrowserClient()
    if (!supabase) return
    const patch = (fn: (m: string[]) => string[]) =>
      setCircles((cs) => (cs ?? []).map((c) => (c.id === circleId ? { ...c, members: fn(c.members) } : c)))
    patch((m) => (on ? [...m, userId] : m.filter((x) => x !== userId)))
    const { error } = on
      ? await supabase.from("circle_members").insert({ circle_id: circleId, user_id: userId })
      : await supabase.from("circle_members").delete().eq("circle_id", circleId).eq("user_id", userId)
    if (error && error.code !== "23505") {
      patch((m) => (on ? m.filter((x) => x !== userId) : [...m, userId]))
      toast.error("Не вдалося оновити коло")
    }
  }

  const current = circles?.find((c) => c.id === editing)
  const candidates = people.filter((u) => !blocked.includes(u.id))

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="pt-5">
        <CardTitle className="flex items-center gap-2">
          <Users2 className="size-4" /> Кола
          {circles && <span className="font-mono text-xs font-normal text-muted-foreground">{circles.length}</span>}
        </CardTitle>
        <CardDescription>
          Власні аудиторії: оберіть коло в композері — і допис побачать лише його учасники. Учасники не знають, у яких колах вони є.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 pt-3 pb-4">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            void create()
          }}
        >
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="Назва кола, напр. «Колеги»" />
          <Button type="submit" disabled={busy || !name.trim()}>
            {busy ? <Loader2 className="animate-spin" /> : <Plus />} Створити
          </Button>
        </form>
        {circles === null && <div className="shimmer h-12 rounded-lg" aria-hidden />}
        {circles?.length === 0 && <p className="text-sm text-muted-foreground">Кіл поки немає.</p>}
        <ul className="divide-y">
          {circles?.map((c) => (
            <li key={c.id} className="flex items-center gap-3 py-2.5">
              <span className="grid size-9 place-items-center rounded-full bg-subtle">
                <Users2 className="size-4 text-muted-foreground" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{c.name}</span>
                <span className="block text-xs text-muted-foreground">
                  {c.members.length} {plural(c.members.length, ["учасник", "учасники", "учасників"])}
                </span>
              </span>
              <Button size="sm" variant="outline" className="rounded-full" onClick={() => setEditing(c.id)}>
                Учасники
              </Button>
              <Button size="icon" variant="ghost" aria-label={`Видалити коло ${c.name}`} onClick={() => void remove(c)}>
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      </CardContent>

      <Dialog open={Boolean(current)} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Коло «{current?.name}»</DialogTitle>
            <DialogDescription>Додавайте людей, яких ви читаєте.</DialogDescription>
          </DialogHeader>
          {candidates.length === 0 && <p className="text-sm text-muted-foreground">Підпишіться на людей — і зможете додати їх до кола.</p>}
          <ul className="-mx-2 max-h-[50vh] divide-y overflow-y-auto">
            {current &&
              candidates.map((u) => {
                const on = current.members.includes(u.id)
                return (
                  <li key={u.id} className="flex items-center gap-3 px-2 py-2">
                    <UserAvatar user={u} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{u.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">@{u.username}</span>
                    </span>
                    <button
                      type="button"
                      aria-pressed={on}
                      onClick={() => void toggleMember(current.id, u.id, !on)}
                      className={cn(
                        "inline-flex min-w-[92px] items-center justify-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-colors",
                        on ? "bg-foreground text-background" : "border text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {on ? <><Check className="size-3" /> У колі</> : <><Plus className="size-3" /> Додати</>}
                    </button>
                  </li>
                )
              })}
          </ul>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
