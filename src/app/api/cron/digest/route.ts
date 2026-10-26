import { NextResponse, type NextRequest } from "next/server"
import { isDigestConfigured, runWeeklyDigest } from "@/lib/digest"

/** Крон тижневого дайджесту: crontab сервера POST-ить сюди з Bearer CRON_SECRET. */
async function handle(request: NextRequest) {
  const expected = process.env.CRON_SECRET?.trim()
  const got = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? new URL(request.url).searchParams.get("key") ?? ""
  if (!expected || got !== expected) return NextResponse.json({ error: "forbidden" }, { status: 403 })
  if (!isDigestConfigured)
    return NextResponse.json(
      { error: "not configured", hint: "додайте SUPABASE_SERVICE_ROLE_KEY, SMTP_HOST/PORT/USER/PASS, MAIL_FROM у .env" },
      { status: 503 }
    )
  try {
    const result = await runWeeklyDigest()
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 })
  }
}

export const GET = handle
export const POST = handle
