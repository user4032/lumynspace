"use client"

import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type ConfirmOptions = {
  title?: string
  description?: string
  confirmText?: string
  cancelText?: string
  destructive?: boolean
}

type ConfirmDialogProps = ConfirmOptions & {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void | Promise<void>
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title = "Підтвердити дію",
  description = "Цю дію неможливо скасувати.",
  confirmText = "Так",
  cancelText = "Скасувати",
  destructive = false,
  onConfirm,
}: ConfirmDialogProps) {
  const [pending, setPending] = useState(false)

  const handleConfirm = async () => {
    setPending(true)
    try {
      await onConfirm()
      onOpenChange(false)
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            {cancelText}
          </Button>
          <Button variant={destructive ? "destructive" : "default"} onClick={handleConfirm} disabled={pending}>
            {pending && <Loader2 className="mr-2 size-4 animate-spin" />}
            {confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

let resolver: ((v: boolean) => void) | null = null
let options: ConfirmOptions = {}

export function confirm(optionsIn: ConfirmOptions): Promise<boolean> {
  options = optionsIn
  const event = new CustomEvent("lumyn:confirm", { detail: options })
  window.dispatchEvent(event)
  return new Promise((resolve) => {
    resolver = resolve
  })
}

export function ConfirmDialogProvider() {
  const [open, setOpen] = useState(false)
  const [opts, setOpts] = useState<ConfirmOptions>({})

  useEffect(() => {
    if (typeof window === "undefined") return
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as ConfirmOptions
      setOpts(detail)
      setOpen(true)
    }
    window.addEventListener("lumyn:confirm", handler)
    return () => window.removeEventListener("lumyn:confirm", handler)
  }, [])

  const handleConfirm = () => {
    resolver?.(true)
    resolver = null
  }

  const handleOpenChange = (v: boolean) => {
    setOpen(v)
    if (!v) {
      resolver?.(false)
      resolver = null
    }
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={handleOpenChange}
      title={opts.title}
      description={opts.description}
      confirmText={opts.confirmText}
      cancelText={opts.cancelText}
      destructive={opts.destructive}
      onConfirm={handleConfirm}
    />
  )
}
