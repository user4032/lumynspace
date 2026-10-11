"use client"

import { toast } from "sonner"
import { setBlocked, setMuted } from "@/lib/actions/viewer"
import { viewerActions } from "@/lib/viewer-store"
import type { User } from "@/types"

type Target = Pick<User, "id" | "username">

async function persist(fn: () => Promise<{ ok: boolean; error?: string }>, revert: () => void) {
  const res = await fn()
  if (!res.ok) {
    revert()
    toast.error(res.error ?? "Не вдалося")
  }
}

function mute(user: Target, on = true) {
  viewerActions.toggle("muted", user.id, on)
  void persist(() => setMuted(user.id, on), () => viewerActions.toggle("muted", user.id, !on))
  if (on)
    toast(`@${user.username} заглушено`, {
      description: "Ви не бачитимете дописів і сповіщень. Автор про це не дізнається.",
      action: { label: "Скасувати", onClick: () => mute(user, false) },
    })
  else toast(`@${user.username} знову у стрічці`)
}

function block(user: Target, on = true) {
  viewerActions.toggle("blocked", user.id, on)
  void persist(() => setBlocked(user.id, on), () => viewerActions.toggle("blocked", user.id, !on))
  if (on)
    toast(`@${user.username} заблоковано`, {
      description: "Ви не бачите одне одного, підписки розірвано, писати не можна.",
      action: { label: "Скасувати", onClick: () => block(user, false) },
    })
  else toast(`@${user.username} розблоковано`)
}

function hidePost(postId: string) {
  viewerActions.toggle("hiddenPosts", postId, true)
  toast("Менше такого у стрічці", {
    action: { label: "Скасувати", onClick: () => viewerActions.toggle("hiddenPosts", postId, false) },
  })
}

/** Блок / мют / «не цікаво» з миттєвим ефектом і кнопкою «Скасувати». */
export function useModeration() {
  return { mute, block, hidePost }
}
