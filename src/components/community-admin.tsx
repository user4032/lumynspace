"use client"

import { useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Check, ImagePlus, Loader2, MoreHorizontal, X } from "lucide-react"
import type { Community, CommunityRole, User } from "@/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { UserAvatar } from "@/components/user-avatar"
import { ImageCropDialog } from "@/components/image-crop-dialog"
import { removeMember, respondJoinRequest, setMemberRole, updateCommunity } from "@/lib/actions/communities"
import { IMAGE_ACCEPT, uploadImage } from "@/lib/storage"
import { timeAgoLong } from "@/lib/format"
import { useNow } from "@/hooks/useNow"

const ROLE_LABEL: Record<CommunityRole, string> = { owner: "Власник", admin: "Адмін", mod: "Модератор", member: "Учасник" }
const RANK: Record<CommunityRole, number> = { owner: 3, admin: 2, mod: 1, member: 0 }

/** Налаштування спільноти: назва, опис, приватність, аватар і обкладинка (Storage: community-media). */
export function CommunitySettingsDialog({
  community,
  open,
  onOpenChange,
}: {
  community: Community
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const router = useRouter()
  const [name, setName] = useState(community.name)
  const [description, setDescription] = useState(community.description)
  const [isPrivate, setIsPrivate] = useState(community.isPrivate)
  const [membersVisible, setMembersVisible] = useState(community.membersVisible !== false)
  const [busy, setBusy] = useState<null | "save" | "avatar" | "cover">(null)
  const [draft, setDraft] = useState<{ file: File; kind: "avatar" | "cover" } | null>(null)
  const avatarRef = useRef<HTMLInputElement>(null)
  const coverRef = useRef<HTMLInputElement>(null)

  const apply = async (kind: "avatar" | "cover", file: File) => {
    setBusy(kind)
    const up = await uploadImage("community-media", file)
    if (!up.ok) {
      setBusy(null)
      toast.error(up.error)
      return false
    }
    const res = await updateCommunity(community.id, kind === "avatar" ? { avatarUrl: up.url } : { coverUrl: up.url })
    setBusy(null)
    if (!res.ok) {
      toast.error(res.error)
      return false
    }
    toast.success(kind === "avatar" ? "Аватар спільноти оновлено" : "Обкладинку оновлено")
    router.refresh()
    return true
  }

  const pick = (kind: "avatar" | "cover") => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    if (file.type === "image/gif") {
      toast.error("GIF не підтримується — використайте JPG, PNG або WebP")
      return
    }
    setDraft({ file, kind })
  }

  const save = async () => {
    setBusy("save")
    const res = await updateCommunity(community.id, {
      name,
      description,
      isPrivate,
      ...(membersVisible !== (community.membersVisible !== false) ? { membersVisible } : {}),
    })
    setBusy(null)
    if (!res.ok) return void toast.error(res.error)
    toast.success("Спільноту збережено")
    onOpenChange(false)
    router.refresh()
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Керування спільнотою</DialogTitle>
            <DialogDescription>c/{community.slug}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" size="sm" disabled={busy !== null} onClick={() => avatarRef.current?.click()}>
                {busy === "avatar" ? <Loader2 className="animate-spin" /> : <ImagePlus />} Аватар
              </Button>
              <Button type="button" variant="secondary" size="sm" disabled={busy !== null} onClick={() => coverRef.current?.click()}>
                {busy === "cover" ? <Loader2 className="animate-spin" /> : <ImagePlus />} Обкладинка
              </Button>
              <input ref={avatarRef} type="file" accept={IMAGE_ACCEPT} hidden onChange={pick("avatar")} />
              <input ref={coverRef} type="file" accept={IMAGE_ACCEPT} hidden onChange={pick("cover")} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="c-name">Назва</Label>
              <Input id="c-name" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="c-desc">Опис і правила</Label>
              <Textarea id="c-desc" value={description} maxLength={500} onChange={(e) => setDescription(e.target.value)} className="min-h-24" />
            </div>
            <label className="flex items-center justify-between gap-4 text-sm">
              <span>
                Приватна спільнота
                <span className="block text-xs text-muted-foreground">Дописи бачать лише учасники, вступ — за запитом.</span>
              </span>
              <Switch checked={isPrivate} onCheckedChange={setIsPrivate} />
            </label>
            <label className="flex items-center justify-between gap-4 text-sm">
              <span>
                Показувати учасників
                <span className="block text-xs text-muted-foreground">Якщо вимкнено, список бачать лише власник, адміни й модератори.</span>
              </span>
              <Switch checked={membersVisible} onCheckedChange={setMembersVisible} />
            </label>
            <p className="text-xs text-muted-foreground">
              Заявки на вступ бачать лише власник, адміни й модератори — в окремій вкладці.
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Скасувати</Button>
            <Button disabled={busy !== null} onClick={save}>
              {busy === "save" && <Loader2 className="animate-spin" />} Зберегти
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {draft && (
        <ImageCropDialog
          key={`${draft.kind}-${draft.file.name}-${draft.file.size}-${draft.file.lastModified}`}
          file={draft.file}
          kind={draft.kind}
          onClose={() => setDraft(null)}
          onConfirm={(cropped) => (draft ? apply(draft.kind, cropped) : Promise.resolve(false))}
        />
      )}
    </>
  )
}

/** Меню учасника: ролі й вилучення (права перевіряє RLS; тут — лише що показати). */
export function MemberMenu({
  communityId,
  user,
  role,
  myRole,
}: {
  communityId: string
  user: User
  role: CommunityRole
  myRole: CommunityRole
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  if (role === "owner" || RANK[myRole] <= RANK[role]) return null
  const roles: Exclude<CommunityRole, "owner">[] = myRole === "owner" ? ["admin", "mod", "member"] : myRole === "admin" ? ["mod", "member"] : []

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, done: string) =>
    start(async () => {
      const res = await fn()
      if (!res.ok) toast.error(res.error ?? "Помилка")
      else {
        toast.success(done)
        router.refresh()
      }
    })

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Дії з @${user.username}`} disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <MoreHorizontal />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {roles.length > 0 && <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Роль</DropdownMenuLabel>}
        {roles.map((r) => (
          <DropdownMenuItem key={r} onSelect={() => run(() => setMemberRole(communityId, user.id, r), `@${user.username}: ${ROLE_LABEL[r].toLowerCase()}`)}>
            {ROLE_LABEL[r]}
            {r === role && <Check className="ml-auto size-4" />}
          </DropdownMenuItem>
        ))}
        {roles.length > 0 && <DropdownMenuSeparator />}
        <DropdownMenuItem
          variant="destructive"
          onSelect={() => run(() => removeMember(communityId, user.id), `@${user.username} більше не учасник`)}
        >
          Вилучити зі спільноти
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Запити на вступ у приватну спільноту */
export function JoinRequests({ communityId, requests, title = "Запити на вступ" }: { communityId: string; requests: { user: User; createdAt: string }[]; title?: string }) {
  const router = useRouter()
  const now = useNow()
  const [pending, start] = useTransition()
  const [done, setDone] = useState<string[]>([])
  const list = requests.filter((r) => !done.includes(r.user.id))
  if (!list.length) return null

  const respond = (userId: string, accept: boolean) =>
    start(async () => {
      const res = await respondJoinRequest(communityId, userId, accept)
      if (!res.ok) return void toast.error(res.error)
      setDone((d) => [...d, userId])
      toast.success(accept ? "Запит схвалено" : "Запит відхилено")
      router.refresh()
    })

  return (
    <section className="border-b">
      <h3 className="px-4 pt-3 pb-1 text-xs font-medium text-muted-foreground">{title} · {list.length}</h3>
      <ul>
        {list.map(({ user, createdAt }) => (
          <li key={user.id} className="flex items-center gap-3 px-4 py-2.5">
            <UserAvatar user={user} size="md" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{user.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                @{user.username}
                {now ? ` · ${timeAgoLong(createdAt, now)}` : ""}
              </p>
            </div>
            <Button size="xs" disabled={pending} onClick={() => respond(user.id, true)}>
              <Check /> Прийняти
            </Button>
            <Button size="xs" variant="ghost" disabled={pending} onClick={() => respond(user.id, false)} aria-label="Відхилити">
              <X />
            </Button>
          </li>
        ))}
      </ul>
    </section>
  )
}
