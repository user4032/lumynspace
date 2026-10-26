"use server"

import { revalidatePath } from "next/cache"
import { getSupabaseServerClient } from "@/lib/supabase/server"

export type AdminResult = { ok: true } | { ok: false; error: string }

type Rpc = (fn: string, args?: object) => PromiseLike<{ data: unknown; error: { message: string } | null }>

/** Усі перевірки прав — у SQL (admin_require у кожній RPC). Тут лише виклик. */
async function call(fn: string, args: object, paths: string[] = ["/admin/users", "/admin/reports"]): Promise<AdminResult> {
  const supabase = await getSupabaseServerClient()
  if (!supabase) return { ok: false, error: "Немає підключення" }
  const { error } = await (supabase.rpc as unknown as Rpc)(fn, args)
  if (error) return { ok: false, error: error.message === "forbidden" ? "Немає прав адміністратора" : error.message }
  paths.forEach((p) => revalidatePath(p))
  return { ok: true }
}

export async function adminSetVerified(userId: string, verified: boolean) {
  return call("admin_set_verified", { p_user: userId, p_verified: verified })
}
export async function adminResetAvatar(userId: string) {
  return call("admin_reset_avatar", { p_user: userId })
}
export async function adminResetBanner(userId: string) {
  return call("admin_reset_banner", { p_user: userId })
}
export async function adminDeleteUser(userId: string) {
  return call("admin_delete_user", { p_user: userId })
}
export async function adminResolveReport(reportId: string, status: "resolved" | "dismissed") {
  return call("admin_resolve_report", { p_report: reportId, p_status: status })
}
export async function adminDeletePost(postId: string, reportId: string | null) {
  return call("admin_delete_post", { p_post: postId, p_report: reportId })
}
