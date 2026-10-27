"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { adminDeletePost, adminResolveReport, type AdminResult } from "@/lib/actions/admin"
import { confirm } from "@/components/ui/confirm-dialog"

export function ReportActions({ reportId, postId }: { reportId: string; postId: string | null }) {
  const router = useRouter()
  const [busy, start] = useTransition()
  const run = (fn: () => Promise<AdminResult>, done: string, ask?: string) => {
    start(async () => {
      if (ask && !(await confirm({ title: "Підтвердити дію", description: ask, confirmText: "Видалити", cancelText: "Скасувати", destructive: true }))) return
      const res = await fn()
      if (!res.ok) toast.error(res.error)
      else {
        toast.success(done)
        router.refresh()
      }
    })
  }
  return (
    <div className="flex flex-wrap gap-2">
      <Button size="xs" variant="outline" disabled={busy} onClick={() => run(() => adminResolveReport(reportId, "resolved"), "Позначено як вирішене")}>
        Вирішено
      </Button>
      <Button size="xs" variant="ghost" disabled={busy} onClick={() => run(() => adminResolveReport(reportId, "dismissed"), "Скаргу відхилено")}>
        Відхилити
      </Button>
      {postId && (
        <Button
          size="xs"
          variant="destructive"
          disabled={busy}
          onClick={() => run(() => adminDeletePost(postId, reportId), "Допис видалено", "Видалити допис назавжди?")}
        >
          Видалити допис
        </Button>
      )}
    </div>
  )
}
