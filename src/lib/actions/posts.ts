"use server"

import { getSupabaseServerClient } from "@/lib/supabase/server"
import { pushToUser } from "@/lib/push"
import type { PostAudience, PostMedia, PostMode } from "@/types"

export type ActionResult<T = undefined> =
  | { ok: true; mock?: boolean; data?: T }
  | { ok: false; error: string; needsOnboarding?: boolean }

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

/** Моє ім'я для тексту сповіщень (фолбек — «Хтось»). */
async function myName(supabase: NonNullable<Awaited<ReturnType<typeof getSupabaseServerClient>>>, me: string) {
  const { data } = await supabase.from("profiles").select("display_name, username").eq("id", me).maybeSingle()
  const row = data as { display_name?: string; username?: string } | null
  return row?.display_name || row?.username || "Хтось"
}

export async function createPost(input: {
  content: string
  media?: PostMedia[]
  communityId?: string | null
  replyTo?: string | null
  /** цитований допис (репост + власний текст) */
  repostOf?: string | null
  mode?: PostMode
  audience?: PostAudience
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

  const { data: prof } = await supabase.from("profiles").select("onboarded_at").eq("id", userId).maybeSingle()
  if (!prof?.onboarded_at) {
    return { ok: false, error: "Не вдалося опублікувати: завершіть онбординг або перевірте доступ", needsOnboarding: true }
  }
  
  const { data, error } = await supabase
    .from("posts")
    .insert({
      author_id: userId,
      content,
      media: input.media ?? [],
      community_id: input.communityId ?? null,
      reply_to: input.replyTo ?? null,
      repost_of: input.repostOf ?? null,
      mode: input.mode ?? "permanent",
      audience: input.audience ?? "public",
      circle_id: input.audience === "circle" ? (input.circleId ?? null) : null,
    } as never)
    .select("id")
    .single()

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Не вдалося опублікувати" }
  }

  // push автору допису, якому відповіли
  if (input.replyTo) {
    const { data: parent } = await supabase.from("posts").select("author_id").eq("id", input.replyTo).maybeSingle()
    const author = (parent as { author_id?: string } | null)?.author_id
    if (author && author !== userId)
      void pushToUser(author, {
        title: "Нова відповідь",
        body: `${await myName(supabase, userId)}: ${content.slice(0, 90)}`,
        url: `/post/${input.replyTo}`,
        tag: `reply:${input.replyTo}`,
      })
  }

  return { ok: true, data: { id: (data as { id: string }).id } }
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
    ? await supabase.from("lights").upsert({ user_id: userId, post_id: postId }, { onConflict: "user_id,post_id", ignoreDuplicates: true })
    : await supabase.from("lights").delete().match({ user_id: userId, post_id: postId })
  if (error) return { ok: false, error: error.message }

  // push автору: «ваш допис засвітили»
  if (light) {
    const { data: post } = await supabase.from("posts").select("author_id").eq("id", postId).maybeSingle()
    const author = (post as { author_id?: string } | null)?.author_id
    if (author && author !== userId)
      void pushToUser(author, {
        title: "Ваш допис засвітили",
        body: `${await myName(supabase, userId)} дав світла вашому допису`,
        url: `/post/${postId}`,
        tag: `light:${postId}`,
      })
  }
  return { ok: true }
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
  if (error) return { ok: false, error: error.message }

  // push автору оригіналу
  if (repost) {
    const { data: post } = await supabase.from("posts").select("author_id").eq("id", postId).maybeSingle()
    const author = (post as { author_id?: string } | null)?.author_id
    if (author && author !== userId)
      void pushToUser(author, {
        title: "Ваш допис поширили",
        body: `${await myName(supabase, userId)} поширив ваш допис у своїй стрічці`,
        url: `/post/${postId}`,
        tag: `repost:${postId}`,
      })
  }
  return { ok: true }
}

/** Закладка «Зберегти» (таблиця bookmarks, міграція 0011). */
export async function toggleBookmark(postId: string, saved: boolean): Promise<ActionResult> {
  const { supabase, userId } = await requireUser()
  if (!supabase) {
    await mockDelay()
    return { ok: true, mock: true }
  }
  if (!userId) return { ok: false, error: "Увійдіть, щоб зберігати дописи" }
  if (notSavedYet(postId)) return { ok: false, error: "Допис ще зберігається — спробуйте за мить" }

  const { error } = saved
    ? await supabase.from("bookmarks").upsert({ user_id: userId, post_id: postId }, { onConflict: "user_id,post_id", ignoreDuplicates: true })
    : await supabase.from("bookmarks").delete().match({ user_id: userId, post_id: postId })
  if (error?.code === "42P01") return { ok: false, error: "Закладки ще не налаштовано: запустіть apply-pending-5.sql у SQL Editor" }
  return error ? { ok: false, error: error.message } : { ok: true }
}

/** Редагувати свій допис (0013: edited_at = «змінено»). */
export async function editPost(postId: string, content: string): Promise<ActionResult> {
  const text = content.trim()
  if (!text) return { ok: false, error: "Допис не може бути порожнім" }
  if (text.length > 2000) return { ok: false, error: "Максимум 2000 символів" }
  const { supabase, userId } = await requireUser()
  if (!supabase) {
    await mockDelay()
    return { ok: true, mock: true }
  }
  if (!userId) return { ok: false, error: "Увійдіть" }
  if (notSavedYet(postId)) return { ok: false, error: "Допис ще зберігається — спробуйте за мить" }

  const { error } = await supabase
    .from("posts")
    .update({ content: text, edited_at: new Date().toISOString() } as never)
    .eq("id", postId)
    .eq("author_id", userId)
  if (error?.code === "42501") return { ok: false, error: "Редагувати можна лише власні дописи" }
  return error ? { ok: false, error: error.message } : { ok: true }
}

export async function deletePost(postId: string): Promise<ActionResult> {  const { supabase, userId } = await requireUser()
  if (!supabase) {
    await mockDelay()
    return { ok: true, mock: true }
  }
  if (!userId) return { ok: false, error: "Увійдіть" }
  if (notSavedYet(postId)) return { ok: false, error: "Допис ще зберігається" }

  const { error } = await supabase.from("posts").delete().eq("id", postId).eq("author_id", userId)
  return error ? { ok: false, error: error.message } : { ok: true }
}

export type PollState = { votes: number[]; votedIndex: number | null }

/** Реальний стан опитування: кількість голосів за варіант + мій вибір. */
async function readPollState(
  supabase: NonNullable<Awaited<ReturnType<typeof getSupabaseServerClient>>>,
  postId: string,
  optionCount: number,
  userId: string | null
): Promise<PollState> {
  const { data } = await supabase
    .from("poll_votes")
    .select("user_id, option_index")
    .eq("post_id", postId)
    .limit(5000)
  const votes = Array.from({ length: optionCount }, () => 0)
  let votedIndex: number | null = null
  for (const v of (data ?? []) as { user_id: string; option_index: number }[]) {
    if (v.option_index >= 0 && v.option_index < votes.length) votes[v.option_index]++
    if (userId && v.user_id === userId) votedIndex = v.option_index
  }
  return { votes, votedIndex }
}

export async function getPollState(postId: string, optionCount: number): Promise<ActionResult<PollState>> {
  const { supabase, userId } = await requireUser()
  if (!supabase) return { ok: true, mock: true }
  if (!userId) return { ok: false, error: "Увійдіть, щоб бачити результати" }
  if (notSavedYet(postId)) return { ok: false, error: "Допис ще зберігається — спробуйте за мить" }

  return { ok: true, data: await readPollState(supabase, postId, optionCount, userId) }
}

/** Голосування: один голос на користувача (PK post_id+user_id), повторний клік не ламає. */
export async function votePoll(postId: string, optionIndex: number, optionCount: number): Promise<ActionResult<PollState>> {
  const { supabase, userId } = await requireUser()
  if (!supabase) {
    await mockDelay()
    return { ok: true, mock: true }
  }
  if (!userId) return { ok: false, error: "Увійдіть, щоб голосувати" }
  if (notSavedYet(postId)) return { ok: false, error: "Допис ще зберігається — спробуйте за мить" }

  // другий голос того ж користувача мовчки ігноруємо (unique post_id+user_id)
  const { error } = await supabase
    .from("poll_votes")
    .upsert({ post_id: postId, user_id: userId, option_index: optionIndex }, { onConflict: "post_id,user_id", ignoreDuplicates: true })
  if (error) return { ok: false, error: error.message }
  return { ok: true, data: await readPollState(supabase, postId, optionCount, userId) }
}
