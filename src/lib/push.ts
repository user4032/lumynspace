import "server-only"
import webpush from "web-push"
import { getSupabaseServerClient } from "@/lib/supabase/server"

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim()
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY?.trim()

export const isPushConfigured = Boolean(VAPID_PUBLIC && VAPID_PRIVATE)
if (isPushConfigured) webpush.setVapidDetails("mailto:support@lumyn.space", VAPID_PUBLIC!, VAPID_PRIVATE!)

export type PushPayload = { title: string; body: string; url: string; tag?: string }

/** Надіслати push усім підпискам користувача (нема підписок/ключів — тихо нічого). */
export async function pushToUser(userId: string, payload: PushPayload): Promise<void> {
  if (!isPushConfigured) return
  const supabase = await getSupabaseServerClient()
  if (!supabase) return
  const { data } = await supabase.rpc("push_endpoints_for", { p_user: userId })
  const subs = (Array.isArray(data) ? data : []) as { endpoint: string; p256dh: string; auth: string }[]
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload)
        )
      } catch (e) {
        // підписка протухла (браузер видалив) — прибираємо
        const status = (e as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) {
          try {
            await supabase.rpc("push_remove_endpoint", { p_endpoint: s.endpoint })
          } catch {
            /* ігноруємо */
          }
        }
      }
    })
  )
}
