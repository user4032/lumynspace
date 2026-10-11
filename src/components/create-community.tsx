"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { createCommunity } from "@/lib/actions/communities"
import { isMockMode } from "@/lib/env"

const TRANSLIT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "h", ґ: "g", д: "d", е: "e", є: "ie", ж: "zh", з: "z", и: "y", і: "i", ї: "i", й: "i",
  к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts", ч: "ch",
  ш: "sh", щ: "shch", ь: "", ю: "iu", я: "ia", "'": "", "’": "",
}
const toSlug = (name: string) =>
  name
    .toLowerCase()
    .split("")
    .map((ch) => TRANSLIT[ch] ?? ch)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)

/** «Створити» спільноту (Supabase: я стаю власником) */
export function CreateCommunityButton() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [slugTouched, setSlugTouched] = useState(false)
  const [description, setDescription] = useState("")
  const [isPrivate, setIsPrivate] = useState(false)
  const [busy, setBusy] = useState(false)
  const finalSlug = slugTouched ? slug : toSlug(name)

  const submit = async () => {
    setBusy(true)
    const res = await createCommunity({ name, slug: finalSlug, description, isPrivate })
    setBusy(false)
    if (!res.ok) return void toast.error(res.error)
    toast.success(`Спільноту «${name.trim()}» створено`)
    setOpen(false)
    router.push(`/c/${res.data?.slug ?? finalSlug}`)
  }

  return (
    <>
      <Button
        size="sm"
        className="rounded-full"
        onClick={() => (isMockMode ? toast("У демо-режимі спільноти не створюються") : setOpen(true))}
      >
        <Plus /> Створити
      </Button>
      <Dialog open={open} onOpenChange={(v) => !busy && setOpen(v)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Нова спільнота</DialogTitle>
            <DialogDescription>Ви станете її власником і зможете призначати адмінів.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="nc-name">Назва</Label>
              <Input id="nc-name" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="Напр., Фронтенд Львів" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="nc-slug">Адреса</Label>
              <div className="flex h-9 overflow-hidden rounded-md border border-input">
                <span className="flex items-center border-r bg-subtle px-3 font-mono text-xs text-muted-foreground">c/</span>
                <input
                  id="nc-slug"
                  value={finalSlug}
                  maxLength={40}
                  onChange={(e) => {
                    setSlugTouched(true)
                    setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))
                  }}
                  className="min-w-0 flex-1 bg-transparent px-3 font-mono text-sm outline-none"
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="nc-desc">Опис</Label>
              <Textarea id="nc-desc" value={description} maxLength={500} onChange={(e) => setDescription(e.target.value)} className="min-h-20" />
            </div>
            <label className="flex items-center justify-between gap-4 text-sm">
              <span>
                Приватна
                <span className="block text-xs text-muted-foreground">Дописи бачать лише учасники, вступ — за запитом.</span>
              </span>
              <Switch checked={isPrivate} onCheckedChange={setIsPrivate} />
            </label>
          </div>
          <DialogFooter>
            <Button variant="ghost" disabled={busy} onClick={() => setOpen(false)}>Скасувати</Button>
            <Button disabled={busy || name.trim().length < 2 || finalSlug.length < 3} onClick={submit}>
              {busy && <Loader2 className="animate-spin" />} Створити
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
