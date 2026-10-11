"use server"

import { getSupabaseServerClient } from "@/lib/supabase/server"
import type { PostAudience, PostMedia, PostMode } from "@/types"

export type ActionResult<T = undefined> =
  | { ok: true; mock?: boolean; data?: T }
  | { ok: false; error: string }

const mockDelay = (ms = 350) => new Promise((r) => setTimeout(r, ms))
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
/** оптимістичний допис (local-…) ще не має id у БД */
const notSavedYet = (postId: string) => !UUID_RE.test(postId)

async function requireUser() {
  const supabase = await getSupabaseServerClient()
  if (!supabase) return { supabase: null, userId: null } as const
  const { data } = await supabase.auth.getClaims()
  return { supabase, userId: (data?.claims?.sub as string | undefined) ?? null } as const
}

export async function createPost(input: {
  content: string
  media?: PostMedia[]
  communityId?: string | null
  replyTo?: string | null
  mode?: PostMode
  audience?: PostAudience
  /** для audience = "circle" */
  circleId?: string | null
}): Promise<ActionResult<{ id: string }>> {
  const content = input.content.trim()
  if (!content && !input.media?.length) return { ok: false, error: "Допис порожній" }
  if (content.length > 2000) return { ok: false, error: "Максимум 2000 символів" }

  const { supabase, userId } = await requireUser()
  if (!supabase) {
    await mockDelay()
    return { ok: true, mock: true }
  }
  if (!userId) return { ok: false, error: "Увійдіть, щоб публікувати" }

  const { data, error } = await supabase
    .from("posts")
    .insert({
      author_id: userId,
      content,
      media: input.media ?? [],
      community_id: input.communityId ?? null,
      reply_to: input.replyTo ?? null,
      // термін Glow і лічильники виставляє тригер posts_normalize
      mode: input.replyTo ? "permanent" : (input.mode ?? "permanent"),
      audience: input.audience ?? "public",
      circle_id: input.audience === "circle" ? (input.circleId ?? null) : null,
    })
    .select("id")
    .single()
  if (error) return { ok: false, error: error.message }
  return { ok: true, data: { id: data.id } }
}

/** «Світло» замість лайка. Термін Glow і постійність рахує тригер apply_light_change. */
export async function toggleLight(postId: string, light: boolean): Promise<ActionResult> {
  const { supabase, userId } = await requireUser()
  if (!supabase) {
    await mockDelay()
    return { ok: true, mock: true }
  }
  if (!userId) return { ok: false, error: "Увійдіть, щоб дати світло" }
  if (notSavedYet(postId)) return { ok: false, error: "Допис ще зберігається — спробуйте за мить" }

  const { error } = light
    ? await supabase.from("lights").insert({ user_id: userId, post_id: postId })
    : await supabase.from("lights").delete().match({ user_id: userId, post_id: postId })
  return error ? { ok: false, error: error.message } : { ok: true }
}

export async function toggleRepost(postId: string, repost: boolean): Promise<ActionResult> {
  const { supabase, userId } = await requireUser()
  if (!supabase) {
    await mockDelay()
    return { ok: true, mock: true }
  }
  if (!userId) return { ok: false, error: "Увійдіть, щоб робити репости" }
  if (notSavedYet(postId)) return { ok: false, error: "Допис ще зберігається — спробуйте за мить" }

  const { error } = repost
    ? await supabase.from("posts").insert({ author_id: userId, repost_of: postId })
    : await supabase
        .from("posts")
        .delete()
        .match({ author_id: userId, repost_of: postId, content: "" })
  return error ? { ok: false, error: error.message } : { ok: true }
}

export async function votePoll(postId: string, optionIndex: number): Promise<ActionResult> {
  const { supabase, userId } = await requireUser()
  if (!supabase) {
    await mockDelay()
    return { ok: true, mock: true }
  }
  if (!userId) return { ok: false, error: "Увійдіть, щоб голосувати" }
  if (notSavedYet(postId)) return { ok: false, error: "Допис ще зберігається — спробуйте за мить" }

  const { error } = await supabase
    .from("poll_votes")
    .insert({ post_id: postId, user_id: userId, option_index: optionIndex })
  return error ? { ok: false, error: error.message } : { ok: true }
}
