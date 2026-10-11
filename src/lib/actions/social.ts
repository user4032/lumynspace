"use server"

import { getSupabaseServerClient } from "@/lib/supabase/server"
import type { ActionResult } from "./posts"

export async function toggleFollow(targetUserId: string, follow: boolean): Promise<ActionResult> {
  const supabase = await getSupabaseServerClient()
  if (!supabase) {
    await new Promise((r) => setTimeout(r, 300))
    return { ok: true, mock: true }
  }
  const { data } = await supabase.auth.getClaims()
  const me = data?.claims?.sub as string | undefined
  if (!me) return { ok: false, error: "Увійдіть, щоб підписуватися" }
  if (me === targetUserId) return { ok: false, error: "Не можна підписатися на себе" }

  const { error } = follow
    ? await supabase.from("follows").insert({ follower_id: me, following_id: targetUserId })
    : await supabase.from("follows").delete().match({ follower_id: me, following_id: targetUserId })
  return error ? { ok: false, error: error.message } : { ok: true }
}

export async function joinCommunity(communityId: string, join: boolean): Promise<ActionResult> {
  const supabase = await getSupabaseServerClient()
  if (!supabase) {
    await new Promise((r) => setTimeout(r, 300))
    return { ok: true, mock: true }
  }
  const { data } = await supabase.auth.getClaims()
  const me = data?.claims?.sub as string | undefined
  if (!me) return { ok: false, error: "Увійдіть, щоб вступити" }

  if (join) {
    const { error } = await supabase.from("community_members").insert({ community_id: communityId, user_id: me })
    if (error?.code === "42501") return { ok: false, error: "Це приватна спільнота — надішліть запит" }
    return error ? { ok: false, error: error.message } : { ok: true }
  }
  const { data: left, error } = await supabase
    .from("community_members")
    .delete()
    .match({ community_id: communityId, user_id: me })
    .select("user_id")
  if (error) return { ok: false, error: error.message }
  // RLS не дає власнику вийти (видалено 0 рядків)
  if (!left?.length) return { ok: false, error: "Власник не може вийти зі своєї спільноти" }
  return { ok: true }
}

export async function sendMessage(conversationId: string, content: string): Promise<ActionResult<string>> {
  const text = content.trim()
  if (!text) return { ok: false, error: "Порожнє повідомлення" }
  const supabase = await getSupabaseServerClient()
  if (!supabase) return { ok: true, mock: true }
  const { data } = await supabase.auth.getClaims()
  const me = data?.claims?.sub as string | undefined
  if (!me) return { ok: false, error: "Увійдіть, щоб писати" }

  if (text.length > 4000) return { ok: false, error: "Максимум 4000 символів" }
  const { data: row, error } = await supabase
    .from("messages")
    .insert({ conversation_id: conversationId, sender_id: me, content: text })
    .select("id")
    .single()
  if (error?.code === "42501") return { ok: false, error: "Не можна написати: блокування або налаштування приватності" }
  return error ? { ok: false, error: error.message } : { ok: true, data: row.id }
}

/** DM: знайти або створити розмову з людиною (RPC start_direct_conversation враховує блоки й dm_policy). */
export async function startDirectConversation(otherUserId: string): Promise<ActionResult<string>> {
  const supabase = await getSupabaseServerClient()
  if (!supabase) return { ok: true, mock: true }
  const { data, error } = await supabase.rpc("start_direct_conversation", { other_user: otherUserId })
  if (error?.code === "42501") return { ok: false, error: "Не можна написати: блокування або налаштування приватності" }
  if (error || !data) return { ok: false, error: error?.message ?? "Не вдалося почати розмову" }
  return { ok: true, data: data as string }
}

/** Позначити розмову прочитаною (мій рядок conversation_members). */
export async function markConversationRead(conversationId: string): Promise<ActionResult> {
  const supabase = await getSupabaseServerClient()
  if (!supabase) return { ok: true, mock: true }
  const { data } = await supabase.auth.getClaims()
  const me = data?.claims?.sub as string | undefined
  if (!me) return { ok: false, error: "Увійдіть" }
  // 0004: RPC ще й гасить «message»-сповіщення цієї розмови
  const rpc = await supabase.rpc("mark_conversation_read", { p_conversation: conversationId })
  if (!rpc.error) return { ok: true }
  const { error } = await supabase
    .from("conversation_members")
    .update({ last_read_at: new Date().toISOString() })
    .match({ conversation_id: conversationId, user_id: me })
  return error ? { ok: false, error: error.message } : { ok: true }
}

/** Позначити сповіщення прочитаними (усі мої або вибрані). */
export async function markNotificationsRead(ids?: string[]): Promise<ActionResult> {
  const supabase = await getSupabaseServerClient()
  if (!supabase) return { ok: true, mock: true }
  const { data } = await supabase.auth.getClaims()
  const me = data?.claims?.sub as string | undefined
  if (!me) return { ok: false, error: "Увійдіть" }
  let q = supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("recipient_id", me).is("read_at", null)
  if (ids?.length) q = q.in("id", ids)
  const { error } = await q
  return error ? { ok: false, error: error.message } : { ok: true }
}

/** Пошук людей для «Нове повідомлення» (RLS ховає заблокованих). */
export async function searchPeople(query: string): Promise<ActionResult<{ id: string; username: string; name: string; avatarUrl: string | null }[]>> {
  const supabase = await getSupabaseServerClient()
  if (!supabase) return { ok: true, mock: true, data: [] }
  const { data: claims } = await supabase.auth.getClaims()
  const me = claims?.claims?.sub as string | undefined
  const q = query.replace(/[%_,()*\\]/g, " ").trim().slice(0, 40)
  let req = supabase.from("profiles").select("id, username, display_name, avatar_url").not("onboarded_at", "is", null).limit(8)
  if (q) req = req.or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
  if (me) req = req.neq("id", me)
  const { data, error } = await req
  if (error) return { ok: false, error: error.message }
  return {
    ok: true,
    data: (data ?? []).map((r) => ({ id: r.id, username: r.username, name: r.display_name || r.username, avatarUrl: r.avatar_url })),
  }
}
