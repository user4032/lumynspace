"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { adminDeleteUser, adminResetAvatar, adminResetBanner, adminSetVerified, type AdminResult } from "@/lib/actions/admin"

type Target = { id: string; username: string; verified: boolean; hasAvatar: boolean; hasBanner: boolean; isAdmin: boolean }
type Pending = { title: string; text: string; run: () => Promise<AdminResult>; danger?: boolean; typed?: boolean; done: string }

/** Кнопки модерації користувача з підтвердженням. Права перевіряє SQL. */
export function AdminUserActions({ user, compact = false }: { user: Target; compact?: boolean }) {
  const router = useRouter()
  const [pending, setPending] = useState<Pending | null>(null)
  const [typed, setTyped] = useState("")
  const [busy, start] = useTransition()

  const ask = (p: Pending) => {
    setTyped("")
    setPending(p)
  }
  const confirm = () => {
    if (!pending) return
    start(async () => {
      const res = await pending.run()
      if (!res.ok) toast.error(res.error)
      else {
        toast.success(pending.done)
        setPending(null)
        router.refresh()
      }
    })
  }
  const size = compact ? ("xs" as const) : ("sm" as const)

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        size={size}
        variant="outline"
        onClick={() =>
          ask({
            title: user.verified ? "Зняти верифікацію?" : "Видати верифікацію?",
            text: `@${user.username} ${user.verified ? "втратить" : "отримає"} знак підтвердженого акаунта.`,
            run: () => adminSetVerified(user.id, !user.verified),
            done: user.verified ? "Верифікацію знято" : "Верифікацію видано",
          })
        }
      >
        {user.verified ? "Зняти галочку" : "Верифікувати"}
      </Button>
      <Button
        size={size}
        variant="outline"
        disabled={!user.hasAvatar}
        onClick={() =>
          ask({ title: "Скинути аватар?", text: `Аватар @${user.username} буде видалено.`, run: () => adminResetAvatar(user.id), done: "Аватар скинуто" })
        }
      >
        Скинути аватар
      </Button>
      <Button
        size={size}
        variant="outline"
        disabled={!user.hasBanner}
        onClick={() =>
          ask({ title: "Скинути банер?", text: `Банер @${user.username} буде видалено.`, run: () => adminResetBanner(user.id), done: "Банер скинуто" })
        }
      >
        Скинути банер
      </Button>
      {!user.isAdmin && (
        <Button
          size={size}
          variant="destructive"
          onClick={() =>
            ask({
              title: "Видалити акаунт назавжди?",
              text: `Профіль, дописи, файли й повідомлення @${user.username} буде видалено без відновлення. Введіть нік для підтвердження.`,
              run: () => adminDeleteUser(user.id),
              danger: true,
              typed: true,
              done: "Акаунт видалено",
            })
          }
        >
          Видалити акаунт
        </Button>
      )}

      <Dialog open={Boolean(pending)} onOpenChange={(v) => !busy && !v && setPending(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{pending?.title}</DialogTitle>
            <DialogDescription>{pending?.text}</DialogDescription>
          </DialogHeader>
          {pending?.typed && (
            <Input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={user.username} autoComplete="off" aria-label="Нік для підтвердження" />
          )}
          <DialogFooter>
            <Button variant="ghost" disabled={busy} onClick={() => setPending(null)}>
              Скасувати
            </Button>
            <Button
              variant={pending?.danger ? "destructive" : "default"}
              disabled={busy || (pending?.typed && typed.trim().toLowerCase() !== user.username.toLowerCase())}
              onClick={confirm}
            >
              {busy && <Loader2 className="size-4 animate-spin" />}
              Підтвердити
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
