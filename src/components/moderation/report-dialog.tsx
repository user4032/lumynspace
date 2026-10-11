"use client"

import { useState, useTransition } from "react"
import { motion } from "framer-motion"
import { Check, Flag } from "lucide-react"
import { toast } from "sonner"
import type { ReportReason } from "@/types"
import type { ReportTarget } from "@/types/database"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { reportContent } from "@/lib/actions/viewer"
import { cn } from "@/lib/utils"

export const REPORT_REASONS: { value: ReportReason; label: string; hint: string }[] = [
  { value: "spam", label: "Спам або шахрайство", hint: "реклама, фейкові розіграші, фішинг" },
  { value: "harassment", label: "Цькування чи образи", hint: "булінг, погрози, приниження" },
  { value: "hate", label: "Мова ворожнечі", hint: "дискримінація за ознакою" },
  { value: "violence", label: "Насильство", hint: "заклики, жорсткий контент" },
  { value: "nudity", label: "Відверті матеріали", hint: "оголеність, сексуальний контент" },
  { value: "self_harm", label: "Самоушкодження", hint: "людині може знадобитися допомога" },
  { value: "minor_safety", label: "Загроза неповнолітнім", hint: "розглядаємо першочергово" },
  { value: "impersonation", label: "Видає себе за іншого", hint: "фейковий акаунт" },
  { value: "other", label: "Інше", hint: "опишіть нижче" },
]

export function ReportDialog({
  open,
  onOpenChange,
  targetType,
  targetId,
  subject,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  targetType: ReportTarget
  targetId: string
  /** «допис @olena» / «профіль @olena» */
  subject: string
}) {
  const [reason, setReason] = useState<ReportReason | null>(null)
  const [details, setDetails] = useState("")
  const [pending, startTransition] = useTransition()

  const submit = () => {
    if (!reason) return
    startTransition(async () => {
      const res = await reportContent({ targetType, targetId, reason, details })
      if (!res.ok) return void toast.error(res.error)
      onOpenChange(false)
      setReason(null)
      setDetails("")
      toast.success("Дякуємо, скаргу надіслано", {
        description: res.mock
          ? "Демо-режим: скарга не надсилається на сервер"
          : "Модерація розгляне її. Ви можете також заблокувати автора.",
      })
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 p-0 sm:max-w-md" onClick={(e) => e.stopPropagation()}>
        <DialogHeader className="border-b px-5 pt-5 pb-4">
          <DialogTitle className="flex items-center gap-2">
            <Flag className="size-4 text-destructive" /> Поскаржитися
          </DialogTitle>
          <DialogDescription>Що не так із {subject}? Автор не дізнається, хто надіслав скаргу.</DialogDescription>
        </DialogHeader>
        <div role="radiogroup" aria-label="Причина" className="max-h-[46vh] overflow-y-auto p-2">
          {REPORT_REASONS.map((r) => {
            const active = reason === r.value
            return (
              <button
                key={r.value}
                role="radio"
                aria-checked={active}
                onClick={() => setReason(r.value)}
                className={cn(
                  "relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted",
                  active && "bg-muted"
                )}
              >
                <span
                  className={cn(
                    "flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors",
                    active && "border-foreground bg-foreground text-background"
                  )}
                >
                  {active && (
                    <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}>
                      <Check className="size-2.5" strokeWidth={3} />
                    </motion.span>
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{r.label}</span>
                  <span className="block text-xs text-muted-foreground">{r.hint}</span>
                </span>
              </button>
            )
          })}
        </div>
        <div className="space-y-3 border-t p-4">
          <Textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            maxLength={1000}
            placeholder="Деталі (необов'язково)"
            className="min-h-16"
          />
          {reason === "self_harm" && (
            <p className="rounded-md border bg-subtle p-2.5 text-xs leading-relaxed text-muted-foreground">
              Якщо комусь загрожує небезпека, зателефонуйте 112. Лінія психологічної підтримки Lifeline Ukraine: 7333.
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              Скасувати
            </Button>
            <Button size="sm" variant="destructive" disabled={!reason || pending} onClick={submit}>
              {pending ? "Надсилаємо…" : "Надіслати скаргу"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
