"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { deleteAccount } from "@/lib/actions/viewer"
import { removeAllMyFiles } from "@/lib/storage"
import { useMe, viewerActions } from "@/lib/viewer-store"

/** Supabase: підтвердження ніком → файли зі Storage → RPC delete_my_account → вихід */
export function DeleteAccountButton() {
  const me = useMe()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [handle, setHandle] = useState("")
  const [busy, setBusy] = useState(false)
  const matches = Boolean(me.username) && handle.trim().toLowerCase() === me.username

  const confirm = async () => {
    if (!matches) return
    setBusy(true)
    await removeAllMyFiles().catch(() => undefined)
    const res = await deleteAccount(handle)
    setBusy(false)
    if (!res.ok) {
      toast.error(res.error)
      return
    }
    viewerActions.reset()
    try {
      window.localStorage.removeItem("lumyn:viewer:live:v1")
    } catch {}
    setOpen(false)
    toast.success("Акаунт видалено")
    router.replace("/welcome")
    router.refresh()
  }

  return (
    <>
      <Button variant="destructive" size="sm" onClick={() => setOpen(true)}>
        Видалити акаунт
      </Button>
      <Dialog open={open} onOpenChange={(v) => !busy && setOpen(v)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Видалити акаунт назавжди?</DialogTitle>
            <DialogDescription>
              Профіль, дописи, фото, повідомлення й підписки буде видалено. Відновити їх не вийде. Щоб підтвердити, введіть свій нік{" "}
              <span className="font-mono text-foreground">{me.username}</span>.
            </DialogDescription>
          </DialogHeader>
          <Input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder={me.username} autoComplete="off" aria-label="Нік для підтвердження" />
          <DialogFooter>
            <Button variant="ghost" disabled={busy} onClick={() => setOpen(false)}>
              Скасувати
            </Button>
            <Button variant="destructive" disabled={!matches || busy} onClick={confirm}>
              {busy && <Loader2 className="animate-spin" />} Видалити назавжди
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
