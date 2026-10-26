"use client"

import { useEffect, useState, useTransition } from "react"
import Link from "next/link"
import { Ban, Copy, Loader2, Plus, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/layout/page-header"
import { AdminNav } from "@/components/admin/admin-nav"
import { FRAMES, FRAMES_SEASONAL, FRAMES_HIDDEN, frameByKey } from "@/lib/frames"
import { createFrameCodes, listFrameCodes, revokeFrameCode, type FrameCodeRow } from "@/lib/actions/frames"
import { formatFullDate } from "@/lib/format"
import { cn } from "@/lib/utils"
import { isMockMode } from "@/lib/env"

export default function AdminAccessoriesPage() {
  const [rows, setRows] = useState<FrameCodeRow[] | null>(null)
  const [frame, setFrame] = useState<string>(FRAMES[0].key)
  const [count, setCount] = useState(5)
  const [days, setDays] = useState(30)
  const [fresh, setFresh] = useState<string[]>([])
  const [pending, startTransition] = useTransition()

  const reload = () => {
    void listFrameCodes().then((res) => {
      if (res.ok) setRows(res.data ?? [])
      else if (res.error) toast.error(res.error)
    })
  }
  useEffect(reload, [])

  const generate = () =>
    startTransition(async () => {
      const res = await createFrameCodes(frame, count, days)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      if (res.data) {
        setFresh(res.data)
        toast.success(`Згенеровано ${res.data.length} кодів`)
        reload()
      }
    })

  const revoke = (code: string) =>
    startTransition(async () => {
      const res = await revokeFrameCode(code)
      if (res.ok) {
        toast("Код деактивовано, рамку у користувача прибрано")
        reload()
      } else toast.error(res.error)
    })

  const copy = (text: string) => {
    void navigator.clipboard?.writeText(text).then(() => toast.success("Скопійовано"))
  }

  return (
    <>
      <PageHeader title="Рамки — промокоди" />
      <div className="px-4 py-5 sm:px-5">
        <AdminNav active="accessories" />

        {/* генерація */}
        <div className="mb-6 rounded-xl border bg-subtle/40 p-4">
          <p className="text-sm font-medium">Згенерувати коди</p>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <label className="text-xs text-muted-foreground">
              Рамка
              <select
                value={frame}
                onChange={(e) => setFrame(e.target.value)}
                className="mt-1 block h-9 rounded-md border bg-background px-2 text-sm text-foreground outline-none"
              >
                {[...FRAMES_SEASONAL, ...FRAMES, ...FRAMES_HIDDEN].map((f) => (
                  <option key={f.key} value={f.key}>
                    {f.name}{f.seasonal ? " 🎃" : ""} ({f.price ? `${f.price} грн` : "тільки код"})
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-muted-foreground">
              Кількість
              <input
                type="number"
                min={1}
                max={50}
                value={count}
                onChange={(e) => setCount(Number(e.target.value) || 1)}
                className="mt-1 block h-9 w-20 rounded-md border bg-background px-2 text-sm text-foreground outline-none"
              />
            </label>
            {frame.startsWith("hw-") ? (
              <label className="text-xs text-muted-foreground">
                Днів
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={days}
                  onChange={(e) => setDays(Number(e.target.value) || 30)}
                  className="mt-1 block h-9 w-20 rounded-md border bg-background px-2 text-sm text-foreground outline-none"
                />
              </label>
            ) : (
              <span className="mb-2 inline-block rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">назавжди</span>
            )}
            <Button className="rounded-full" disabled={pending} onClick={generate}>
              {pending ? <Loader2 className="animate-spin" /> : <Plus className="size-4" />} Згенерувати
            </Button>
            <Button variant="ghost" size="sm" className="rounded-full" onClick={reload}>
              <RefreshCw className="size-4" /> Оновити
            </Button>
          </div>

          {fresh.length > 0 && (
            <div className="mt-3 rounded-lg border bg-background p-3">
              <p className="text-xs font-medium text-brand">Нові коди — скопіюй і надішли покупцеві:</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {fresh.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => copy(c)}
                    className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-xs hover:bg-muted"
                  >
                    {c} <Copy className="size-3" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* список */}
        {rows === null ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Завантаження…</p>
        ) : rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Кодів ще нема — згенеруй першу партію.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-subtle/60 text-left text-xs tracking-wide text-muted-foreground uppercase">
                  <th className="px-3 py-2.5">Код</th>
                  <th className="px-3 py-2.5">Рамка</th>
                  <th className="px-3 py-2.5">Статус</th>
                  <th className="px-3 py-2.5">Хто активував</th>
                  <th className="px-3 py-2.5">Створено</th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((r) => (
                  <tr key={r.code} className={cn(r.revoked && "opacity-55")}>
                    <td className="px-3 py-2">
                      <button type="button" onClick={() => copy(r.code)} className="inline-flex items-center gap-1.5 font-mono text-xs hover:text-brand">
                        {r.code} <Copy className="size-3" />
                      </button>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{frameByKey(r.frame)?.name ?? r.frame}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {r.revoked ? (
                        <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive">деактивовано</span>
                      ) : r.used_by ? (
                        <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-600 dark:text-emerald-400">активовано</span>
                      ) : (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">вільний</span>
                      )}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {r.used_by ? (
                        <Link href={`/${r.used_username ?? ""}`} className="hover:underline">
                          @{r.used_username ?? r.used_by.slice(0, 8)}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                      {r.used_at && <span className="block text-xs text-muted-foreground">{formatFullDate(r.used_at)}</span>}
                    </td>
                    <td className="px-3 py-2 text-xs whitespace-nowrap text-muted-foreground">{formatFullDate(r.created_at)}</td>
                    <td className="px-3 py-2 text-right">
                      {!r.revoked && (
                        <Button
                          variant="ghost"
                          size="xs"
                          className="text-destructive hover:text-destructive"
                          disabled={pending}
                          onClick={() => revoke(r.code)}
                        >
                          <Ban className="size-3.5" /> {r.used_by ? "Деактивувати (повернення)" : "Заблокувати"}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!isMockMode && (
          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
            Деактивація повертає код у «деактивовано» й одразу гасить рамку в користувача — для повернення коштів. Нові коди
            формату LUMN-XXXX-XXXX, одноразові. Звичайні рамки видаються назавжди, хелловінські 🎃 — на вказану кількість днів.
          </p>
        )}
      </div>
    </>
  )
}
