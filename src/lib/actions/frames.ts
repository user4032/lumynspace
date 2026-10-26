"use server"

import { getSupabaseServerClient } from "@/lib/supabase/server"
import type { ActionResult } from "./posts"

async function session() {
  const supabase = await getSupabaseServerClient()
  if (!supabase) return { supabase: null, me: null } as const
  const { data } = await supabase.auth.getClaims()
  return { supabase, me: (data?.claims?.sub as string | undefined) ?? null } as const
}

export type FrameCodeRow = {
  code: string
  frame: string
  duration_days: number
  used_by: string | null
  used_username: string | null
  used_at: string | null
  revoked: boolean
  created_at: string
}

/** Адмін: згенерувати одноразові коди на рамку. */
export async function createFrameCodes(frame: string, count: number, days: number): Promise<ActionResult<string[]>> {
  const { supabase, me } = await session()
  if (!supabase) return { ok: false, error: "Тільки з Supabase" }
  if (!me) return { ok: false, error: "Увійдіть" }
  const { data, error } = await supabase.rpc("create_frame_codes", { p_frame: frame, p_count: Math.min(50, Math.max(1, count)), p_days: Math.min(365, Math.max(1, days)) })
  if (error) return { ok: false, error: error.message.includes("forbidden") ? "Тільки для адміністраторів" : error.message }
  return { ok: true, data: (data ?? []) as string[] }
}

/** Адмін: список кодів зі статусами. */
export async function listFrameCodes(): Promise<ActionResult<FrameCodeRow[]>> {
  const supabase = await getSupabaseServerClient()
  if (!supabase) return { ok: true, data: [] }
  const { data, error } = await supabase.rpc("list_frame_codes")
  if (error) return { ok: false, error: error.message.includes("forbidden") ? "Тільки для адміністраторів" : error.message }
  return { ok: true, data: (data ?? []) as FrameCodeRow[] }
}

/** Адмін: деактивувати код (повернення коштів — рамка у користувача гасне). */
export async function revokeFrameCode(code: string): Promise<ActionResult> {
  const supabase = await getSupabaseServerClient()
  if (!supabase) return { ok: false, error: "Тільки з Supabase" }
  const { error } = await supabase.rpc("revoke_frame_code", { p_code: code })
  if (error) return { ok: false, error: error.message.includes("forbidden") ? "Тільки для адміністраторів" : error.message }
  return { ok: true }
}

/** Користувач: активувати рамку одноразовим промокодом. */
export async function activateFrameCode(code: string): Promise<ActionResult<{ frame: string; expiresAt: string }>> {
  const { supabase, me } = await session()
  if (!supabase) return { ok: false, error: "Тільки з Supabase" }
  if (!me) return { ok: false, error: "Увійдіть" }
  const c = code.trim().toUpperCase()
  if (!/^LUMN-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(c)) return { ok: false, error: "Код виглядає як LUMN-XXXX-XXXX" }
  const { data, error } = await supabase.rpc("activate_frame_code", { p_code: c })
  if (error) {
    const msg = error.message.includes("used") ? "Цей код уже хтось активував" : error.message.includes("revoked") ? "Код деактивовано" : error.message.includes("invalid") ? "Такого коду не існує" : error.message
    return { ok: false, error: msg }
  }
  const res = data as { frame?: string; expires_at?: string } | null
  return { ok: true, data: { frame: res?.frame ?? "", expiresAt: res?.expires_at ?? "" } }
}

/** Користувач: прибрати свою рамку. */
export async function clearMyFrame(): Promise<ActionResult> {
  const { supabase, me } = await session()
  if (!supabase) return { ok: false, error: "Тільки з Supabase" }
  if (!me) return { ok: false, error: "Увійдіть" }
  const { error } = await supabase.rpc("clear_my_frame")
  return error ? { ok: false, error: error.message } : { ok: true }
}

export type OwnedFrameRow = { frame: string; expires_at: string | null; acquired_at: string }

/** Користувач: колекція рамок (протухлі синхронізуються перед читанням). */
export async function listMyFrames(): Promise<ActionResult<OwnedFrameRow[]>> {
  const { supabase, me } = await session()
  if (!supabase) return { ok: true, data: [] }
  if (!me) return { ok: true, data: [] }
  await supabase.rpc("sync_expired_frames")
  const { data, error } = await supabase
    .from("user_frames")
    .select("frame, expires_at, acquired_at")
    .eq("user_id", me)
    .order("acquired_at", { ascending: false })
  if (error) return { ok: false, error: error.message }
  return { ok: true, data: (data ?? []) as OwnedFrameRow[] }
}

/** Користувач: обрати рамку з колекції. */
export async function selectMyFrame(frame: string): Promise<ActionResult<{ frame: string; expiresAt: string | null }>> {
  const { supabase, me } = await session()
  if (!supabase) return { ok: false, error: "Тільки з Supabase" }
  if (!me) return { ok: false, error: "Увійдіть" }
  const { data, error } = await supabase.rpc("select_my_frame", { p_frame: frame })
  if (error) return { ok: false, error: error.message.includes("not owned") ? "Цієї рамки немає у вашій колекції" : error.message }
  const res = data as { frame?: string; expires_at?: string | null } | null
  return { ok: true, data: { frame: res?.frame ?? frame, expiresAt: res?.expires_at ?? null } }
}
