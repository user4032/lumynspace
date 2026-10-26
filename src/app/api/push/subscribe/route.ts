import { NextResponse, type NextRequest } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase/server"

/** Реєстрація/оновлення push-підписки поточного користувача (міграція 0012). */
export async function POST(request: NextRequest) {
  const supabase = await getSupabaseServerClient()
  if (!supabase) return NextResponse.json({ error: "push unavailable" }, { status: 503 })
  const { data } = await supabase.auth.getClaims()
  const me = (data?.claims?.sub as string | undefined) ?? null
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const body = (await request.json().catch(() => null)) as
    | { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } }
    | null
  const endpoint = typeof body?.endpoint === "string" ? body.endpoint : ""
  const p256dh = typeof body?.keys?.p256dh === "string" ? body.keys.p256dh : ""
  const auth = typeof body?.keys?.auth === "string" ? body.keys.auth : ""
  if (!/^https:\/\//.test(endpoint) || !p256dh || !auth)
    return NextResponse.json({ error: "invalid subscription" }, { status: 400 })

  const { error } = await supabase
    .from("push_subscriptions")
    .upsert(
      { user_id: me, endpoint, p256dh, auth, user_agent: request.headers.get("user-agent")?.slice(0, 300) ?? null } as never,
      { onConflict: "endpoint", ignoreDuplicates: false }
    )
  if (error?.code === "42P01") return NextResponse.json({ error: "run apply-pending-6.sql" }, { status: 503 })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

/** Видалення підписки (вийшов/вимкнув сповіщення). */
export async function DELETE(request: NextRequest) {
  const supabase = await getSupabaseServerClient()
  if (!supabase) return NextResponse.json({ error: "push unavailable" }, { status: 503 })
  const { data } = await supabase.auth.getClaims()
  if (!data?.claims?.sub) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const body = (await request.json().catch(() => null)) as { endpoint?: unknown } | null
  const endpoint = typeof body?.endpoint === "string" ? body.endpoint : ""
  if (!/^https:\/\//.test(endpoint)) return NextResponse.json({ error: "invalid" }, { status: 400 })
  const { error } = await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
