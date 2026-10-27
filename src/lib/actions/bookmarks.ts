"use server"

import { getSupabaseServerClient } from "@/lib/supabase/server"
import type { ActionResult } from "./posts"

async function requireUser() {
  const supabase = await getSupabaseServerClient()
  if (!supabase) return { supabase: null, userId: null } as const
  const { data } = await supabase.auth.getClaims()
  return { supabase, userId: (data?.claims?.sub as string | undefined) ?? null } as const
}

export type BookmarkCollection = {
  id: string
  name: string
  created_at: string
}

export async function listBookmarkCollections(): Promise<ActionResult<BookmarkCollection[]>> {
  const { supabase, userId } = await requireUser()
  if (!supabase) return { ok: true, mock: true, data: [] }
  if (!userId) return { ok: false, error: "Увійдіть, щоб керувати закладками" }

  const { data, error } = await supabase
    .from("bookmark_collections")
    .select("id, name, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })

  if (error) return { ok: false, error: error.message }
  return { ok: true, data: (data ?? []) as BookmarkCollection[] }
}

export async function createBookmarkCollection(name: string): Promise<ActionResult<BookmarkCollection>> {
  const { supabase, userId } = await requireUser()
  if (!supabase) return { ok: true, mock: true }
  if (!userId) return { ok: false, error: "Увійдіть, щоб створити папку" }

  const trimmed = name.trim().slice(0, 24)
  if (!trimmed) return { ok: false, error: "Введіть назву папки" }

  const { data, error } = await supabase
    .from("bookmark_collections")
    .insert({ user_id: userId, name: trimmed } as never)
    .select("id, name, created_at")
    .single()

  if (error) {
    if (error.code === "23505") return { ok: false, error: "Така папка вже існує" }
    return { ok: false, error: error.message }
  }
  return { ok: true, data: data as BookmarkCollection }
}

export async function renameBookmarkCollection(id: string, name: string): Promise<ActionResult> {
  const { supabase, userId } = await requireUser()
  if (!supabase) return { ok: true, mock: true }
  if (!userId) return { ok: false, error: "Увійдіть" }

  const trimmed = name.trim().slice(0, 24)
  if (!trimmed) return { ok: false, error: "Введіть назву папки" }

  const { error } = await supabase
    .from("bookmark_collections")
    .update({ name: trimmed, updated_at: new Date().toISOString() } as never)
    .eq("id", id)
    .eq("user_id", userId)

  if (error) {
    if (error.code === "23505") return { ok: false, error: "Така папка вже існує" }
    return { ok: false, error: error.message }
  }
  return { ok: true }
}

export async function deleteBookmarkCollection(id: string): Promise<ActionResult> {
  const { supabase, userId } = await requireUser()
  if (!supabase) return { ok: true, mock: true }
  if (!userId) return { ok: false, error: "Увійдіть" }

  const { error } = await supabase
    .from("bookmark_collections")
    .delete()
    .eq("id", id)
    .eq("user_id", userId)

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function moveBookmarkToCollection(postId: string, collectionId: string | null): Promise<ActionResult> {
  const { supabase, userId } = await requireUser()
  if (!supabase) return { ok: true, mock: true }
  if (!userId) return { ok: false, error: "Увійдіть" }

  if (collectionId) {
    const { data: col } = await supabase
      .from("bookmark_collections")
      .select("id")
      .eq("id", collectionId)
      .eq("user_id", userId)
      .maybeSingle()
    if (!col) return { ok: false, error: "Папка не знайдена" }

    const { error } = await supabase
      .from("bookmarks")
      .upsert({ user_id: userId, post_id: postId, collection_id: collectionId } as never, { onConflict: "user_id,post_id" })
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  }

  const { error } = await supabase
    .from("bookmarks")
    .update({ collection_id: null } as never)
    .eq("user_id", userId)
    .eq("post_id", postId)

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}
