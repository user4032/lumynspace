"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Ban, EyeOff, ExternalLink, Flag, MoreHorizontal, Pencil, Quote, Trash2, User as UserIcon, Volume2, VolumeX } from "lucide-react"
import type { Post } from "@/types"
import { deletePost } from "@/lib/actions/posts"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ReportDialog } from "@/components/moderation/report-dialog"
import { useModeration } from "@/components/moderation/use-moderation"
import { useMe, useViewer } from "@/lib/viewer-store"
import { cn } from "@/lib/utils"

export function PostMenu({ post, className, onEdit }: { post: Post; className?: string; onEdit?: () => void }) {
  const [reportOpen, setReportOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const router = useRouter()
  const muted = useViewer((s) => s.muted.includes(post.author.id))
  const mod = useModeration()
  const meId = useMe().id
  const mine = post.author.id === meId
  const href = `/post/${post.id}`

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Більше"
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "-my-1 ml-auto inline-flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground opacity-0 transition-[opacity,background-color] outline-none group-hover/post:opacity-100 hover:bg-muted hover:text-foreground focus-visible:opacity-100 aria-expanded:opacity-100 max-md:opacity-100",
            className
          )}
        >
          <MoreHorizontal className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56" onClick={(e) => e.stopPropagation()}>
          <DropdownMenuItem asChild>
            <Link href={href}>
              <ExternalLink /> Відкрити допис
            </Link>
          </DropdownMenuItem>

          <DropdownMenuItem onSelect={() => router.push(`/post/${post.id}?quote=1`)}>
            <Quote /> Цитувати
          </DropdownMenuItem>

          {mine && (
            <>
              <DropdownMenuSeparator />
              {onEdit && (
                <DropdownMenuItem onSelect={onEdit}>
                  <Pencil /> Редагувати
                </DropdownMenuItem>
              )}
              <DropdownMenuItem variant="destructive" onSelect={() => setConfirmDelete(true)}>
                <Trash2 /> Видалити
              </DropdownMenuItem>
            </>
          )}

          <DropdownMenuItem asChild>
            <Link href={`/${post.author.username}`}>
              <UserIcon /> Профіль @{post.author.username}
            </Link>
          </DropdownMenuItem>

          {!mine && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => mod.hidePost(post.id)}>
                <EyeOff /> Не цікаво
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => mod.mute(post.author, !muted)}>
                {muted ? <Volume2 /> : <VolumeX />} {muted ? "Повернути" : "Заглушити"} @{post.author.username}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => mod.block(post.author)}>
                <Ban /> Заблокувати @{post.author.username}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => setReportOpen(true)}>
                <Flag /> Поскаржитися
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {confirmDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70" onClick={() => setConfirmDelete(false)}>
          <div className="relative z-[101] w-full max-w-sm rounded-xl border bg-card p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold">Видалити допис?</h3>
            <p className="mt-1 text-sm text-muted-foreground">Цю дію не можна скасувати.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button className="rounded-md px-3 py-1.5 text-sm hover:bg-muted" onClick={() => setConfirmDelete(false)}>
                Скасувати
              </button>
              <button
                className="rounded-md bg-destructive px-3 py-1.5 text-sm text-destructive-foreground"
                onClick={async () => {
                  const res = await deletePost(post.id)
                  if (!res.ok) alert(res.error)
                  else location.reload()
                }}
              >
                Видалити
              </button>
            </div>
          </div>
        </div>
      )}

      {reportOpen && (
        <ReportDialog
          open={reportOpen}
          onOpenChange={setReportOpen}
          targetType="post"
          targetId={post.id}
          subject={`дописом @${post.author.username}`}
        />
      )}
    </>
  )
}