import { NextResponse, type NextRequest } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase/server"

/** Колбек OAuth (GitHub / Google) і листів підтвердження пошти (code або token_hash). */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  // за nginx request.url має внутрішню адресу (localhost:3002), тому беремо справжній домен
  const fwdHost = request.headers.get("x-forwarded-host") ?? request.headers.get("host")
  const fwdProto = request.headers.get("x-forwarded-proto") ?? "https"
  const origin =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    (fwdHost ? `${fwdProto}://${fwdHost}` : new URL(request.url).origin)
  const code = searchParams.get("code")
  const tokenHash = searchParams.get("token_hash")
  const type = searchParams.get("type")
  const nextParam = searchParams.get("next") ?? (type === "signup" ? "/onboarding" : "/")
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/"

  const supabase = await getSupabaseServerClient()
  if (supabase) {
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      if (!error) return NextResponse.redirect(`${origin}${next}`)
    }
    // листи підтвердження/recovery інколи приходять із token_hash замість code
    if (tokenHash && (type === "signup" || type === "recovery" || type === "magiclink" || type === "invite")) {
      const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
      if (!error) return NextResponse.redirect(`${origin}${next}`)
    }
  }
  return NextResponse.redirect(`${origin}/login?error=auth`)
}
