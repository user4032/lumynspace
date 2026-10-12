"use server"

import { getSupabaseServerClient } from "@/lib/supabase/server"
import type { BannerStyle, DmPolicy, FeedPrefs, ReportReason } from "@/types"
import type { Json, ProfileRow, ReportTarget } from "@/types/database"
import type { ActionResult } from "./posts"

const mockDelay = (ms = 250) => new Promise((r) => setTimeout(r, ms))

async function session() {
  const supabase = await getSupabaseServerClient()
  if (!supabase) return { supabase: null, me: null } as const
  const { data } = await supabase.auth.getClaims()
  return { supabase, me: (data?.claims?.sub as string | undefined) ?? null } as const
}

const HANDLE_RE = /^[a-z0-9_]{3,24}$/
const RESERVED = new Set([
  "settings", "terms", "privacy", "login", "api", "about", "welcome",
  "onboarding", "guidelines", "contact", "admin", "support", "help",
  "explore", "notifications", "messages", "post", "auth", "design",
  "communities", "c", "u", "me", "app", "www", "mail", "root",
])
const HEX_RE = /^#[0-9a-f]{6}$/

/* ── Профіль і кастомізація ─────────────────────────────────────── */

export async function updateProfile(input: {
  name?: string
  bio?: string
  status?: string
  statusExpiresAt?: string | null
  accentColor?: string
  bannerStyle?: BannerStyle
  top4?: string[]
  nowPlaying?: { title: string; artist: string } | null
  /** публічні URL зі Storage (avatars/covers) */
  avatarUrl?: string | null
  coverUrl?: string | null
}): Promise<ActionResult> {
  if (input.accentColor && !HEX_RE.test(input.accentColor)) return { ok: false, error: "Колір має бути у форматі #rrggbb" }
  if (input.top4 && input.top4.length > 4) return { ok: false, error: "Не більше 4 людей у топі" }
  for (const url of [input.avatarUrl, input.coverUrl])
    if (url && (!/^https:\/\//.test(url) || url.length > 500)) return { ok: false, error: "Некоректне посилання на фото" }
  const { supabase, me } = await session()
  if (!supabase) return mockDelay().then(() => ({ ok: true, mock: true }))
  if (!me) return { ok: false, error: "Увійдіть" }

  const patch: Partial<ProfileRow> = {}
  if (input.name !== undefined) patch.display_name = input.name.slice(0, 50)
  if (input.bio !== undefined) patch.bio = input.bio.slice(0, 300)
  if (input.status !== undefined) patch.status = input.status.slice(0, 140)
  if (input.statusExpiresAt !== undefined) patch.status_expires_at = input.statusExpiresAt
  if (input.accentColor) patch.accent_color = input.accentColor
  if (input.bannerStyle) patch.banner_style = input.bannerStyle
  if (input.avatarUrl !== undefined) patch.avatar_url = input.avatarUrl
  if (input.coverUrl !== undefined) patch.cover_url = input.coverUrl
  if (input.top4 !== undefined || input.nowPlaying !== undefined) {
    const { data } = await supabase.from("profiles").select("widgets").eq("id", me).single()
    const widgets = { ...((data?.widgets as Record<string, Json>) ?? {}) }
    if (input.top4 !== undefined) widgets.top4 = input.top4
    if (input.nowPlaying !== undefined) widgets.now_playing = input.nowPlaying
    patch.widgets = widgets
  }
  const { error } = await supabase.from("profiles").update(patch).eq("id", me)
  return error ? { ok: false, error: error.message } : { ok: true }
}

export async function saveFeedPrefs(prefs: FeedPrefs): Promise<ActionResult> {
  const clamp = (n: number) => Math.min(1, Math.max(0, Number.isFinite(n) ? n : 0.5))
  const { supabase, me } = await session()
  if (!supabase) return { ok: true, mock: true }
  if (!me) return { ok: false, error: "Увійдіть" }
  const { error } = await supabase
    .from("profiles")
    .update({ feed_prefs: { social: clamp(prefs.social), media: clamp(prefs.media) } })
    .eq("id", me)
  return error ? { ok: false, error: error.message } : { ok: true }
}

export async function updatePrivacy(input: { isPrivate?: boolean; dmPolicy?: DmPolicy; hideFollowing?: boolean }): Promise<ActionResult> {
  const { supabase, me } = await session()
  if (!supabase) return mockDelay().then(() => ({ ok: true, mock: true }))
  if (!me) return { ok: false, error: "Увійдіть" }
  const patch: Partial<ProfileRow> = {}
  if (input.isPrivate !== undefined) patch.is_private = input.isPrivate
  if (input.dmPolicy) patch.dm_policy = input.dmPolicy
  if (input.hideFollowing !== undefined) patch.hide_following = input.hideFollowing
  const { error } = await supabase.from("profiles").update(patch).eq("id", me)
  return error ? { ok: false, error: error.message } : { ok: true }
}

/* ── Близькі друзі, блок, мют ───────────────────────────────────── */

type RelTable = "close_friends" | "blocks" | "mutes"
const REL_COLS: Record<RelTable, [string, string]> = {
  close_friends: ["owner_id", "friend_id"],
  blocks: ["blocker_id", "blocked_id"],
  mutes: ["muter_id", "muted_id"],
}

async function toggleRelation(table: RelTable, targetId: string, on: boolean): Promise<ActionResult> {
  const { supabase, me } = await session()
  if (!supabase) return mockDelay(200).then(() => ({ ok: true, mock: true }))
  if (!me) return { ok: false, error: "Увійдіть" }
  const [a, b] = REL_COLS[table]
  const row = { [a]: me, [b]: targetId }
  const { error } = on
    ? await supabase.from(table).upsert(row as never, { ignoreDuplicates: true })
    : await supabase.from(table).delete().match(row)
  return error ? { ok: false, error: error.message } : { ok: true }
}

export async function setCloseFriend(userId: string, on: boolean) {
  return toggleRelation("close_friends", userId, on)
}
export async function setBlocked(userId: string, on: boolean) {
  return toggleRelation("blocks", userId, on)
}
export async function setMuted(userId: string, on: boolean) {
  return toggleRelation("mutes", userId, on)
}

export async function reportContent(input: {
  targetType: ReportTarget
  targetId: string
  reason: ReportReason
  details?: string
}): Promise<ActionResult> {
  const { supabase, me } = await session()
  if (!supabase) return mockDelay(400).then(() => ({ ok: true, mock: true }))
  if (!me) return { ok: false, error: "Увійдіть, щоб поскаржитися" }
  const { error } = await supabase.from("reports").insert({
    reporter_id: me,
    target_type: input.targetType,
    target_id: input.targetId,
    reason: input.reason,
    details: (input.details ?? "").slice(0, 1000),
  })
  return error ? { ok: false, error: error.message } : { ok: true }
}

/* ── Онбординг, інвайти, вейтліст ───────────────────────────────── */

export async function checkHandle(handle: string, opts?: { forReservation?: boolean }): Promise<ActionResult<{ available: boolean; reservedByMe?: boolean }>> {
  const h = handle.trim().toLowerCase()
  if (RESERVED.has(h)) return { ok: true, data: { available: false } }
  if (!HANDLE_RE.test(h)) return { ok: true, data: { available: false } }
  const supabase = await getSupabaseServerClient()
  if (!supabase) {
    const { takenHandles } = await import("@/lib/mock-data")
    await mockDelay(220)
    return { ok: true, mock: true, data: { available: !takenHandles.has(h) } }
  }
  const { data, error } = await supabase.rpc("is_handle_available", { p_handle: h })
  if (error) return { ok: false, error: error.message }

  // Для бронювання на лендингу не вважаємо «мій нік» вільним, якщо він уже в reserved_handles
  if (opts?.forReservation) {
    if (data) return { ok: true, data: { available: true } }
    // Перевіряємо, чи це моя бронь (за email)
    const { data: claims } = await supabase.auth.getClaims()
    const me = claims?.claims?.sub as string | undefined
    if (me) {
      const { data: user } = await supabase.auth.getUser()
      const email = user.user?.email?.toLowerCase()
      if (email) {
        const { data: res } = await supabase.from("reserved_handles").select("email").eq("handle", h).maybeSingle()
        if (res && res.email === email) {
          return { ok: true, data: { available: false, reservedByMe: true } }
        }
      }
    }
    return { ok: true, data: { available: false } }
  }

  // Звичайна перевірка (онбординг): якщо нік уже мій у профілі — вважаємо вільним для мене
  if (data) return { ok: true, data: { available: true } }
  const { data: claims } = await supabase.auth.getClaims()
  const me = claims?.claims?.sub as string | undefined
  if (!me) return { ok: true, data: { available: false } }
  const { data: mine } = await supabase.from("profiles").select("id").eq("id", me).eq("username", h).maybeSingle()
  return { ok: true, data: { available: Boolean(mine) } }
}

/**
 * Стан онбордингу для /onboarding (Supabase).
 * inviteRequired: false, поки в системі немає жодного інвайту (перший користувач — власник).
 * needsMigration: у базі ще немає функції invite_required (міграція 0003).
 */
export async function getOnboardingStatus(): Promise<
  ActionResult<{ onboarded: boolean; username: string; inviteRequired: boolean; needsMigration: boolean }>
> {
  const { supabase, me } = await session()
  if (!supabase) return { ok: true, mock: true, data: { onboarded: false, username: "", inviteRequired: true, needsMigration: false } }
  if (!me) return { ok: false, error: "Увійдіть" }
  const [{ data: prof }, req] = await Promise.all([
    supabase.from("profiles").select("username, onboarded_at").eq("id", me).maybeSingle(),
    supabase.rpc("invite_required"),
  ])
  const needsMigration = Boolean(req.error)
  return {
    ok: true,
    data: {
      onboarded: Boolean(prof?.onboarded_at),
      username: prof?.username ?? "",
      // без 0003 стара функція invite_only() завжди вимагає код
      inviteRequired: needsMigration ? true : Boolean(req.data),
      needsMigration,
    },
  }
}

export async function reserveHandle(handle: string, email: string): Promise<ActionResult> {
  const h = handle.trim().toLowerCase()
  if (RESERVED.has(h)) return { ok: false, error: "Цей нік зарезервовано" }
  const e = email.trim().toLowerCase()
  if (!HANDLE_RE.test(h)) return { ok: false, error: "Нік: 3–24 символи, латиниця, цифри, _" }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return { ok: false, error: "Перевірте пошту" }
  const supabase = await getSupabaseServerClient()
  if (!supabase) {
    const { takenHandles } = await import("@/lib/mock-data")
    await mockDelay(600)
    return takenHandles.has(h) ? { ok: false, error: "Цей нік уже зайнятий" } : { ok: true, mock: true }
  }
  const { data, error } = await supabase.rpc("reserve_handle", { p_handle: h, p_email: e })
  if (error) return { ok: false, error: error.message }
  return data ? { ok: true } : { ok: false, error: "Нік зайнятий або на цю пошту вже є бронь" }
}

const ONBOARDING_ERRORS: Record<string, string> = {
  "invite required": "Потрібен інвайт-код",
  "invalid invite": "Інвайт недійсний або вже використаний",
  "username taken": "Цей нік уже зайнятий",
  "username reserved": "Цей нік заброньовано на іншу пошту",
  "invalid username": "Нік: 3–24 символи, латиниця, цифри, _",
  "already onboarded": "Ви вже пройшли онбординг",
  "min age": "Lumyn доступний з 16 років",
  "birth_year can be set only once": "Рік народження вже вказано",
}

export async function completeOnboarding(input: {
  username: string
  birthYear: number
  inviteCode: string
  accentColor: string
}): Promise<ActionResult> {
  const username = input.username.trim().toLowerCase()
  if (!HANDLE_RE.test(username)) return { ok: false, error: ONBOARDING_ERRORS["invalid username"] }
  if (new Date().getFullYear() - input.birthYear < 16) return { ok: false, error: "Lumyn доступний з 16 років" }
  const supabase = await getSupabaseServerClient()
  if (!supabase) {
    const { DEMO_INVITE_CODES, takenHandles } = await import("@/lib/mock-data")
    await mockDelay(700)
    if (takenHandles.has(username)) return { ok: false, error: ONBOARDING_ERRORS["username taken"] }
    if (!DEMO_INVITE_CODES.includes(input.inviteCode.trim().toUpperCase()))
      return { ok: false, error: ONBOARDING_ERRORS["invalid invite"] }
    return { ok: true, mock: true }
  }
  const { error } = await supabase.rpc("complete_onboarding", {
    p_username: username,
    p_birth_year: input.birthYear,
    p_invite_code: input.inviteCode.trim().toUpperCase() || null,
    p_accent: input.accentColor,
  })
  if (error) {
    const key = Object.keys(ONBOARDING_ERRORS).find((k) => error.message.includes(k))
    return { ok: false, error: key ? ONBOARDING_ERRORS[key] : error.message }
  }
  return { ok: true }
}

export async function createInvite(): Promise<ActionResult<{ code: string }>> {
  const { supabase, me } = await session()
  if (!supabase) return { ok: false, error: "У демо-режимі нові інвайти не створюються" }
  if (!me) return { ok: false, error: "Увійдіть" }
  const { data, error } = await supabase.rpc("create_invite")
  if (error) return { ok: false, error: error.message.includes("limit") ? "Усі 5 інвайтів уже використано" : error.message }
  return { ok: true, data: { code: data as string } }
}

/* ── Видалення акаунта ──────────────────────────────────────────── */

/** Видаляє мій акаунт (RPC delete_my_account: auth-користувач + каскадом усі дані) і виходить. */
export async function deleteAccount(confirmHandle: string): Promise<ActionResult> {
  const { supabase, me } = await session()
  if (!supabase) return { ok: false, error: "У демо-режимі акаунт не видаляється" }
  if (!me) return { ok: false, error: "Увійдіть" }
  const { data: prof } = await supabase.from("profiles").select("username").eq("id", me).maybeSingle()
  if (!prof || prof.username !== confirmHandle.trim().toLowerCase()) return { ok: false, error: "Нік не збігається" }
  const { error } = await supabase.rpc("delete_my_account")
  if (error) return { ok: false, error: error.message }
  await supabase.auth.signOut().catch(() => undefined)
  return { ok: true }
}
