"use client"

import { useRef, useState } from "react"
import { toast } from "sonner"
import { ImagePlus, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { UserAvatar } from "@/components/user-avatar"
import { updateProfile } from "@/lib/actions/viewer"
import { IMAGE_ACCEPT, uploadImage } from "@/lib/storage"
import { setViewer, useMe, viewerActions } from "@/lib/viewer-store"

/** Supabase: аватар (бакет avatars) і обкладинка (бакет covers) */
export function ProfilePhotos() {
  const me = useMe()
  const [busy, setBusy] = useState<"avatar" | "cover" | null>(null)
  const avatarRef = useRef<HTMLInputElement>(null)
  const coverRef = useRef<HTMLInputElement>(null)

  const pick = (kind: "avatar" | "cover") => async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    setBusy(kind)
    const up = await uploadImage(kind === "avatar" ? "avatars" : "covers", file)
    if (!up.ok) {
      setBusy(null)
      toast.error(up.error)
      return
    }
    const res = await updateProfile(kind === "avatar" ? { avatarUrl: up.url } : { coverUrl: up.url, bannerStyle: "image" })
    setBusy(null)
    if (!res.ok) {
      toast.error(res.error)
      return
    }
    setViewer((s) => ({
      ...s,
      self: s.self ? { ...s.self, ...(kind === "avatar" ? { avatarUrl: up.url } : { coverUrl: up.url }) } : s.self,
    }))
    if (kind === "cover") viewerActions.updateProfile({ bannerStyle: "image" })
    toast.success(kind === "avatar" ? "Аватар оновлено" : "Обкладинку оновлено")
  }

  return (
    <div className="grid gap-1.5 sm:col-span-2">
      <Label>Фото</Label>
      <div className="flex flex-wrap items-center gap-3">
        <UserAvatar user={me} size="xl" className="size-14" />
        <Button type="button" variant="secondary" size="sm" disabled={busy !== null} onClick={() => avatarRef.current?.click()}>
          {busy === "avatar" ? <Loader2 className="animate-spin" /> : <ImagePlus />} Змінити аватар
        </Button>
        <Button type="button" variant="secondary" size="sm" disabled={busy !== null} onClick={() => coverRef.current?.click()}>
          {busy === "cover" ? <Loader2 className="animate-spin" /> : <ImagePlus />} Змінити обкладинку
        </Button>
        <input ref={avatarRef} type="file" accept={IMAGE_ACCEPT} hidden onChange={pick("avatar")} />
        <input ref={coverRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={pick("cover")} />
      </div>
      <p className="text-xs text-muted-foreground">JPG, PNG, WebP до 5 МБ. Обкладинка вмикає стиль банера «Фото».</p>
    </div>
  )
}
