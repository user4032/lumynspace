"use server"

import { getSupabaseServerClient } from "@/lib/supabase/server"
import type { CommunityRole } from "@/types"
import type { ActionResult } from "./posts"

const SLUG_RE = /^[a-z0-9-]{3,40}$/
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function session() {
  const supabase = await getSupabaseServerClient()
  if (!supabase) return { supabase: null, me: null } as const
  const { data } = await supabase.auth.getClaims()
  return { supabase, me: (data?.claims?.sub as string | undefined) ?? null } as const
}

const DEMO = { ok: false, error: "У демо-режимі спільноти не змінюються" } as const

/** Нова спільнота: тригер add_community_owner робить мене owner. */
export async function createCommunity(input: {
  name: string
  slug: string
  description: string
  isPrivate: boolean
}): Promise<ActionResult<{ slug: string }>> {
  const name = input.name.trim()
  const slug = input.slug.trim().toLowerCase()
  if (name.length < 2 || name.length > 60) return { ok: false, error: "Назва: 2–60 символів" }
  if (!SLUG_RE.test(slug)) return { ok: false, error: "Адреса: 3–40 символів, латиниця, цифри, дефіс" }
  const { supabase, me } = await session()
  if (!supabase) return DEMO
  if (!me) return { ok: false, error: "Увійдіть" }
  const { error } = await supabase.from("communities").insert({
    name,
    slug,
    description: input.description.trim().slice(0, 500),
    is_private: input.isPrivate,
    owner_id: me,
  })
  if (error?.code === "23505") return { ok: false, error: "Така адреса вже зайнята" }
  if (error) return { ok: false, error: error.message }
  return { ok: true, data: { slug } }
}

/** Назва/опис/приватність/фото (owner, admin — RLS communities_update_admins). */
export async function updateCommunity(
  id: string,
  patch: { name?: string; description?: string; isPrivate?: boolean; membersVisible?: boolean; avatarUrl?: string | null; coverUrl?: string | null }
): Promise<ActionResult> {
  if (!UUID_RE.test(id)) return { ok: false, error: "Спільноту не знайдено" }
  const { supabase, me } = await session()
  if (!supabase) return DEMO
  if (!me) return { ok: false, error: "Увійдіть" }
  const row: { name?: string; description?: string; is_private?: boolean; members_visible?: boolean; avatar_url?: string | null; cover_url?: string | null } = {}
  if (patch.name !== undefined) {
    const n = patch.name.trim()
    if (n.length < 2 || n.length > 60) return { ok: false, error: "Назва: 2–60 символів" }
    row.name = n
  }
  if (patch.description !== undefined) row.description = patch.description.trim().slice(0, 500)
  if (patch.isPrivate !== undefined) row.is_private = patch.isPrivate
  if (patch.membersVisible !== undefined) row.members_visible = patch.membersVisible
  for (const [k, v] of [["avatar_url", patch.avatarUrl], ["cover_url", patch.coverUrl]] as const) {
    if (v === undefined) continue
    if (v && (!/^https:\/\//.test(v) || v.length > 500)) return { ok: false, error: "Некоректне посилання на фото" }
    row[k] = v
  }
  const { data, error } = await supabase.from("communities").update(row).eq("id", id).select("id")
  if (error) return { ok: false, error: error.message }
  if (!data?.length) return { ok: false, error: "Змінювати можуть лише власник і адміни" }
  return { ok: true }
}

/** Запит у приватну спільноту (або скасування запиту). */
export async function requestToJoin(communityId: string, on: boolean): Promise<ActionResult> {
  const { supabase, me } = await session()
  if (!supabase) return { ok: true, mock: true }
  if (!me) return { ok: false, error: "Увійдіть" }
  const { error } = on
    ? await supabase.from("community_join_requests").insert({ community_id: communityId, user_id: me })
    : await supabase.from("community_join_requests").delete().match({ community_id: communityId, user_id: me })
  if (error?.code === "23505") return { ok: true }
  return error ? { ok: false, error: error.message } : { ok: true }
}

export async function respondJoinRequest(communityId: string, userId: string, accept: boolean): Promise<ActionResult> {
  const { supabase, me } = await session()
  if (!supabase) return DEMO
  if (!me) return { ok: false, error: "Увійдіть" }
  const { error } = await supabase.rpc("respond_join_request", { p_community: communityId, p_user: userId, p_accept: accept })
  if (error?.code === "42501") return { ok: false, error: "Запити розглядають власник, адміни й модератори" }
  return error ? { ok: false, error: error.message } : { ok: true }
}

/** Роль учасника (RLS: owner — будь-яку, крім owner; admin — mod/member). */
export async function setMemberRole(communityId: string, userId: string, role: Exclude<CommunityRole, "owner">): Promise<ActionResult> {
  const { supabase, me } = await session()
  if (!supabase) return DEMO
  if (!me) return { ok: false, error: "Увійдіть" }
  const { data, error } = await supabase
    .from("community_members")
    .update({ role })
    .match({ community_id: communityId, user_id: userId })
    .select("user_id")
  if (error) return { ok: false, error: error.message }
  if (!data?.length) return { ok: false, error: "Недостатньо прав для цієї ролі" }
  return { ok: true }
}

/** Прибрати учасника зі спільноти (owner/admin/mod; власника — ніколи). */
export async function removeMember(communityId: string, userId: string): Promise<ActionResult> {
  const { supabase, me } = await session()
  if (!supabase) return DEMO
  if (!me) return { ok: false, error: "Увійдіть" }
  const { data, error } = await supabase
    .from("community_members")
    .delete()
    .match({ community_id: communityId, user_id: userId })
    .select("user_id")
  if (error) return { ok: false, error: error.message }
  if (!data?.length) return { ok: false, error: "Недостатньо прав" }
  return { ok: true }
}
